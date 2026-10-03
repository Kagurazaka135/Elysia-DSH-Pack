# -*- coding: utf-8 -*-
"""把 src/ 重新打进 packages/ 里的四个 zip（src ↔ zip 对齐）。

install.bat 是 base64 包着 PowerShell 的 (certutil -decode)，改 setup.ps1 必须
重新编码塞回 BEGIN/END CERTIFICATE 之间。编码约定（与根 README 一致）：

    setup.ps1 文本 -> 去已有 BOM -> 换行统一 LF -> 按 UTF-8 带 BOM 编码
    -> base64 -> 每 100 字符一行 -> 包进 -----BEGIN/END CERTIFICATE-----
    （每行前缀 >>"%B64%" echo ；那个 BOM 不可省：PS5.1 没 BOM 会按 ANSI
    解码 UTF-8，中文全乱、甚至报不存在的语法错误）

其余文件一律以 src/ 为准原字节替换 / 新增，保证 packages/*.zip 与 src/ 对齐。
A2：zip 里的 install.bat 统一 CRLF（旧包是 LF-only）。

每一步都带断言：payload round-trip、bat 骨架未破坏、CRLF、写完后再读回核验。
用法：python tools/repack.py [--check]
    --check  只校验（zip 与 src 是否已对齐），不重写 zip。
"""
import base64
import os
import shutil
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
PKG = os.path.join(ROOT, 'packages')
WRAP = 100
BACKUP = '.before-feat'          # 重打包前的 zip 备份后缀
BEGIN, END = '-----BEGIN CERTIFICATE-----', '-----END CERTIFICATE-----'

PACKAGES = ['pkg1-core', 'pkg2-elysia', 'pkg3-qq', 'pkg4-video']
ZIP_NAMES = {
    'pkg1-core': 'elysia-pkg1-core.zip',
    'pkg2-elysia': 'elysia-pkg2-elysia.zip',
    'pkg3-qq': 'elysia-pkg3-qq.zip',
    'pkg4-video': 'elysia-pkg4-video.zip',
}


def payload_bytes(ps1_path):
    """setup.ps1 -> 待编码字节：去 BOM -> LF -> 带 BOM。"""
    text = open(ps1_path, 'rb').read().decode('utf-8-sig')
    text = text.replace('\r\n', '\n')
    return text.encode('utf-8-sig')


def encode_bat(orig_bat_bytes, ps1_bytes):
    """把新 payload 编进原 install.bat 的 base64 段，其余骨架原样保留。"""
    bat = orig_bat_bytes.decode('utf-8')
    head, rest = bat.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    b64 = base64.b64encode(ps1_bytes).decode('ascii')
    lines = [b64[i:i + WRAP] for i in range(0, len(b64), WRAP)]
    body = '\r\n'.join(f'>>"%B64%" echo {ln}' for ln in lines)
    new_bat = f'{head}{BEGIN}\r\n{body}\r\n>>"%B64%" echo {END}{tail}'
    # A2: 统一 CRLF
    new_bat = new_bat.replace('\r\n', '\n').replace('\n', '\r\n')
    # 断言 1: round-trip —— 抠回来解一遍必须逐字节相等
    grabbed = ''.join(
        l.split('echo ', 1)[1].strip() for l in new_bat.splitlines()
        if l.startswith('>>"%B64%" echo ') and 'CERTIFICATE' not in l
    )
    assert base64.b64decode(grabbed) == ps1_bytes, 'payload round-trip 校验失败'
    # 断言 2: 骨架 —— 除 payload 行外的所有行跟原 bat 完全一致（防截断/串位）
    def skeleton(text):
        return [l for l in text.replace('\r\n', '\n').split('\n')
                if not l.startswith('>>"%B64%" echo ')]
    orig_norm = orig_bat_bytes.decode('utf-8').replace('\r\n', '\n')
    assert skeleton(new_bat) == skeleton(orig_norm), 'install.bat 骨架被改动'
    return new_bat.encode('utf-8')


def build_updates(pkg):
    """{zip内路径: 新字节}，install.bat 特殊处理，其余 src 原字节。

    不进 zip 的: setup.ps1 (约定为 src 专属可读版, zip 里以 base64 内嵌于
    install.bat)、node_modules/__pycache__/*.pyc (本地产物)、
    package-lock.json (本机测试 npm install 的副产物, 维持现包"不带
    lockfile、装机时现装"的行为)。
    """
    src_dir = os.path.join(SRC, pkg)
    updates = {}
    for dirpath, dirnames, filenames in os.walk(src_dir):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', '__pycache__')]
        for fn in filenames:
            if fn == 'setup.ps1' or fn.endswith('.pyc') or fn == 'package-lock.json':
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, src_dir).replace('\\', '/')
            data = open(full, 'rb').read()
            if rel == 'install.bat':
                data = encode_bat(data, payload_bytes(os.path.join(src_dir, 'setup.ps1')))
            updates[rel] = data
    return updates


def rebuild(zip_path, updates, dry):
    bak = zip_path + BACKUP
    if not dry and not os.path.exists(bak):
        shutil.copy2(zip_path, bak)
        print(f'  备份 -> {os.path.basename(bak)}')
    with zipfile.ZipFile(zip_path) as zin:
        items = [(i, zin.read(i.filename)) for i in zin.infolist()]
    zip_names = {i.filename for i, _ in items}
    new_names = set(updates) - zip_names
    if new_names:
        print(f'  新增条目: {sorted(new_names)}')
    missing = zip_names - set(updates) - {p + BACKUP for p in []}
    if missing:
        print(f'  !! zip 里有但 src 没有（原样保留）: {sorted(missing)}')
    if dry:
        for name, data in updates.items():
            old = dict((i.filename, d) for i, d in items).get(name)
            status = '新增' if old is None else ('相同' if old == data else f'不同({len(old)}->{len(data)})')
            if status != '相同':
                print(f'  需更新 {name}: {status}')
        return
    out = []
    for info, data in items:
        if info.filename in updates:
            data = updates[info.filename]
        out.append((info, data))
    for name, data in updates.items():
        if name in zip_names:
            continue
        zi = zipfile.ZipInfo(name, date_time=(2026, 10, 4, 2, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        out.append((zi, data))
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info, data in out:
            zout.writestr(info, data)
    print(f'  OK -> {os.path.basename(zip_path)} ({os.path.getsize(zip_path)} 字节)')


def verify(zip_path, updates, pkg):
    """写完后读回：逐文件与期望一致；install.bat 另验 round-trip/CRLF/BOM。"""
    with zipfile.ZipFile(zip_path) as z:
        names = set(z.namelist())
        for name, want in updates.items():
            assert name in names, f'{zip_path}: 缺条目 {name}'
            got = z.read(name)
            assert got == want, f'{zip_path}: {name} 内容与期望不符'
        bat = z.read('install.bat')
    assert b'\r\n' in bat, f'{zip_path}: install.bat 不是 CRLF'
    lone_lf = bat.count(b'\n') - bat.count(b'\r\n')
    assert lone_lf == 0, f'{zip_path}: install.bat 有 {lone_lf} 个裸 LF'
    grabbed = ''.join(
        l.split('echo ', 1)[1].strip() for l in bat.decode('utf-8').splitlines()
        if l.startswith('>>"%B64%" echo ') and 'CERTIFICATE' not in l
    )
    decoded = base64.b64decode(grabbed)
    assert decoded[:3] == b'\xef\xbb\xbf', f'{zip_path}: payload 缺 UTF-8 BOM'
    assert decoded == payload_bytes(os.path.join(SRC, pkg, 'setup.ps1')), \
        f'{zip_path}: install.bat payload round-trip 失败'
    print(f'  校验通过: {os.path.basename(zip_path)} ({len(updates)} 个文件与 src 一致, '
          'bat CRLF, payload round-trip+BOM OK)')


def main():
    dry = '--check' in sys.argv
    for pkg in PACKAGES:
        zip_path = os.path.join(PKG, ZIP_NAMES[pkg])
        print(f'{pkg}:')
        updates = build_updates(pkg)
        rebuild(zip_path, updates, dry)
        if not dry:
            verify(zip_path, updates, pkg)
    print('完成' + ('（dry-run，未写入）' if dry else ''))


if __name__ == '__main__':
    main()
