# -*- coding: utf-8 -*-
"""爱莉 QQ 机器人 v4 (真身直答版)
收到消息 -> 转发真身(注入桥 followup 唤醒) -> 轮询回复接口 -> 真身回复发回 QQ (文字+语音)
分身不再自己调用模型回复, 所有回答都来自真身完整思考
"""
import os, sys, json, time, base64, io, wave, re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(BASE, 'qq-elysia.log')
DONE = os.path.join(BASE, 'tasks', 'done.json')
os.makedirs(os.path.join(BASE, 'tasks'), exist_ok=True)

WS_URL = 'ws://127.0.0.1:3001'
INJECT_URL = 'http://127.0.0.1:3080/api/qq/inject'
REPLY_URL = 'http://127.0.0.1:3080/api/qq/replies'

def log(msg):
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(line + '\n')
    print(line, flush=True)

# ---------- 共享配置 (安装脚本生成的 qq-config.json, 跟 profile / NapCat 用同一份值) ----------
QQ_CONFIG_PATH = os.path.join(BASE, 'qq-config.json')

def load_qq_config():
    """读共享配置。文件缺失/损坏 = 各项按空处理 (白名单空 = 全拦, 见 main 的警告)。"""
    cfg = {'inject_token': '', 'ws_token': '',
           'allowed_users': set(), 'allowed_group_ids': set(), 'bot_qq': ''}
    try:
        with open(QQ_CONFIG_PATH, encoding='utf-8-sig') as f:
            raw = json.load(f)
    except Exception:
        return cfg
    def _ids(key):
        val = raw.get(key) or []
        if isinstance(val, (str, int)):        # 容忍安装脚本把单元素数组写成标量
            val = [val]
        return {int(x) for x in val if str(x).strip().isdigit()}
    cfg['inject_token'] = str(raw.get('inject_token') or '')
    cfg['ws_token'] = str(raw.get('ws_token') or '')
    cfg['allowed_users'] = _ids('allowed_users')
    cfg['allowed_group_ids'] = _ids('allowed_group_ids')
    cfg['bot_qq'] = str(raw.get('bot_qq') or '')
    return cfg

CFG = load_qq_config()
# 新版桥是 bundle 插件, 注入和取回复都可以带共享口令 (P0-1)。
# 留空 = 两边都不校验, 跟插件的 token 默认值对齐 —— 只监听 127.0.0.1, 本机自用够。
TOKEN = CFG['inject_token']
# OneBot WebSocket 口令 (P0-3): 与 NapCat onebot11.json 里的 token 一致; 空 = 连接时不带。
WS_TOKEN = CFG['ws_token']
# 发送者白名单 (P0-2): 不在名单里的 QQ 号一律拦截。fail-closed: 名单为空 = 全拦。
ALLOWED_USERS = CFG['allowed_users']
# 群白名单 (可选): 配了就只回这些群; 空 = 不限群 (群内发送者仍要过 ALLOWED_USERS)。
ALLOWED_GROUP_IDS = CFG['allowed_group_ids']
# 爱莉小号的 QQ 号 (群里 @ 判定用); 没配就沿用老版本的写死值。
BOT_QQ = CFG['bot_qq'] or '2778339130'

# ffmpeg 解析 (P1-3): 系统 PATH 优先, 其次 <本目录>\bin\ffmpeg.exe; 都没有 = 语音不可用。
def find_ffmpeg():
    import shutil
    p = shutil.which('ffmpeg')
    if p:
        return p
    local = os.path.join(BASE, 'bin', 'ffmpeg.exe')
    return local if os.path.exists(local) else None

FFMPEG = find_ffmpeg()

def _sniff_ext(head):
    """按魔数认真实图片格式。ffmpeg 按扩展名配 demuxer, PNG 内容顶着 .jpg 名
    会"Picture size invalid"且退出码还是 0 —— 必须先认格式再命名。"""
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return '.png'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return '.webp'
    if head[:4] == b'GIF8':
        return '.gif'
    return '.jpg'

# ---------- 图片下载 (二阶段 P2-4: 腾讯 CDN 白名单 + 400px 压缩 + 数量/大小上限) ----------
# SSRF 面 (P0-5): 只从 QQ 官方 CDN 下载。NapCat 推过来的图片 URL 本来就在这几个域里,
# 域外一律不碰 —— 既挡外部 URL, 也挡"构造消息让分身去拉内网地址"。
ALLOWED_IMG_HOSTS = ('multimedia.nt.qq.com.cn', 'gchat.qpic.cn', 'qq.com')
MAX_IMAGES = 3
MAX_IMG_BYTES = 5 * 1024 * 1024

def download_images(image_urls):
    """下载消息里的图片, 返回本地路径列表。每张: 白名单 -> 带上限下载 -> ffmpeg 压到 400px。"""
    from urllib.parse import urlparse
    import subprocess
    import urllib.request
    ok = []
    for i, url in enumerate(image_urls[:MAX_IMAGES]):
        host = urlparse(url).hostname or ''
        if not any(host == h or host.endswith('.' + h) for h in ALLOWED_IMG_HOSTS):
            log(f'[图片] 非白名单域名, 跳过: {host}')
            continue
        img_dir = os.path.join(BASE, 'tasks', 'qq-images')
        os.makedirs(img_dir, exist_ok=True)
        stamp = int(time.time() * 1000)
        dst = os.path.join(img_dir, f'qq_{stamp}_{i}.jpg')
        raw = dst
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read(MAX_IMG_BYTES + 1)   # 读满上限+1 就停, 刷大图打不爆内存/磁盘
            if len(data) > MAX_IMG_BYTES:
                log(f'[图片] 超过 {MAX_IMG_BYTES // (1024 * 1024)}MB 上限, 丢弃')
                continue
            # 先认格式再命名: ffmpeg 按扩展名配 demuxer, PNG 内容叫 .jpg 会解不动
            # (Picture size invalid, 且退出码还是 0, 靠产物检查兜底)
            raw = os.path.join(img_dir, f'raw_{stamp}_{i}{_sniff_ext(data[:16])}')
            with open(raw, 'wb') as f:
                f.write(data)
            if FFMPEG:                                    # 压到 400px 宽 (约 15-60KB), 省 token
                subprocess.run([FFMPEG, '-y', '-i', raw, '-vf', 'scale=400:-1',
                                '-q:v', '8', dst], capture_output=True, timeout=30)
            if os.path.exists(dst) and os.path.getsize(dst) > 500:
                os.remove(raw)
            else:
                os.replace(raw, dst)                      # 压失败/没 ffmpeg -> 用原图
            raw = dst
            ok.append(dst)
            log(f'[图片] 已下载 {dst} ({os.path.getsize(dst)}B)')
        except Exception as e:
            log(f'[图片下载失败] {e}')
            for p in {raw, dst}:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass
    if len(image_urls) > MAX_IMAGES:
        log(f'[图片] 只处理前 {MAX_IMAGES} 张 (消息里带了 {len(image_urls)} 张)')
    return ok

def load_json(path):
    if os.path.exists(path):
        try:
            return json.load(open(path, encoding='utf-8'))
        except Exception:
            return []
    return []

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class ForwardError(Exception):
    """注入接口返回了错误状态码。401=口令不对, 403=白名单没同步 —— 分身靠它区分话术。"""
    def __init__(self, status, detail=''):
        super().__init__(f'HTTP {status}: {detail}')
        self.status = status

def forward_to_host(text, user_id, group_id=None, images=None):
    """转发给真身, 返回 sessionId。images = 已落盘的本地图片路径 (二阶段 P2-4)。"""
    import urllib.request
    import urllib.error
    body = json.dumps({'text': text, 'userId': user_id, 'groupId': group_id or '',
                       'token': TOKEN, 'images': images or []}).encode()
    req = urllib.request.Request(INJECT_URL, body,
                                 {'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        return data.get('sessionId', '')
    except urllib.error.HTTPError as e:
        try:
            detail = str(json.loads(e.read().decode('utf-8', 'replace')).get('error') or '')
        except Exception:
            detail = ''
        raise ForwardError(e.code, detail) from None

# ---------- TTS ----------
_cv = None
def get_cosy():
    global _cv
    if _cv is None:
        sys.path.insert(0, os.path.join(BASE, 'cosyvoice'))
        from cosyvoice.cli.cosyvoice import CosyVoice2
        MODEL_DIR = os.path.join(BASE, 'models', 'cosyvoice2')
        spk2info = os.path.join(MODEL_DIR, 'spk2info.pt')
        if not os.path.exists(spk2info):
            import torch
            torch.save({}, spk2info)
        _cv = CosyVoice2(MODEL_DIR, load_jit=False, load_trt=False, load_vllm=False, fp16=False)
        log('[TTS] CosyVoice2 已加载')
    return _cv

def tts_wav(text, prompt_wav, prompt_text, speed=1.0):
    import numpy as np
    cv = get_cosy()
    parts = re.split(r'(?<=[。！？!?～~♪])', text)
    sents = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) <= 24:
            if len(p) < 10 and sents:
                sents[-1] += p
            else:
                sents.append(p)
        else:
            subs = re.split(r'(?<=[，,、；;])', p)
            cur = ''
            for s in subs:
                if len(cur) + len(s) > 24 and cur:
                    sents.append(cur); cur = s
                else:
                    cur += s
            if cur:
                sents.append(cur)
    while len(sents) >= 2 and len(sents[0]) < 10:
        sents[0] += sents[1]; sents.pop(1)
    chunks = []
    for s in sents:
        for ch in cv.inference_zero_shot(s, prompt_text, prompt_wav, '',
                                         stream=False, speed=speed, text_frontend=False):
            chunks.append(np.asarray(ch['tts_speech']).reshape(-1))
    audio = np.concatenate(chunks)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(cv.sample_rate)
        wf.writeframes((audio * 32767).astype(np.int16).tobytes())
    return buf.getvalue()

def wav_to_amr_base64(wav_bytes):
    """wav -> mp3 (NapCat 支持 mp3 语音) -> base64"""
    import subprocess, tempfile
    if not FFMPEG:
        raise RuntimeError('找不到 ffmpeg (系统 PATH 和 本目录\\bin 都没有), 语音不可用')
    tmp_wav = os.path.join(tempfile.gettempdir(), 'elys_send.wav')
    tmp_mp3 = os.path.join(tempfile.gettempdir(), 'elys_send.mp3')
    with open(tmp_wav, 'wb') as f:
        f.write(wav_bytes)
    subprocess.run([FFMPEG, '-y', '-i', tmp_wav, '-ar', '44100', '-ac', '1', '-b:a', '64k', tmp_mp3],
                   capture_output=True, timeout=60)
    with open(tmp_mp3, 'rb') as f:
        return base64.b64encode(f.read()).decode()

# ---------- WS 发送 (支持私聊+群聊) ----------
async def send_text(ws, user_id, text, group_id=None):
    if group_id:
        await ws.send(json.dumps({
            'action': 'send_group_msg',
            'params': {'group_id': group_id, 'message': text},
            'echo': 'reply'
        }))
    else:
        await ws.send(json.dumps({
            'action': 'send_private_msg',
            'params': {'user_id': user_id, 'message': text},
            'echo': 'reply'
        }))

async def send_voice(ws, user_id, wav_bytes, group_id=None):
    amr = wav_to_amr_base64(wav_bytes)
    if group_id:
        await ws.send(json.dumps({
            'action': 'send_group_msg',
            'params': {'group_id': group_id, 'message': [{'type': 'record', 'data': {'file': f'base64://{amr}'}}]},
            'echo': 'voice'
        }))
    else:
        await ws.send(json.dumps({
            'action': 'send_private_msg',
            'params': {'user_id': user_id, 'message': [{'type': 'record', 'data': {'file': f'base64://{amr}'}}]},
            'echo': 'voice'
        }))

# 取回复的游标必须落盘。新版桥的回复队列在内存里、不会自己清, 如果每次启动都
# 从 0 开始拉, 重启分身就会把攒下的历史回复整个再发一遍 (刷屏)。
# 存下"上次取到哪": 关掉分身期间 agent 的回复仍会补发, 已发过的不会重发。
CURSOR = os.path.join(BASE, 'tasks', 'reply-cursor.json')

def load_cursor():
    try:
        with open(CURSOR, encoding='utf-8') as f:
            return int(json.load(f).get('since', 0))
    except Exception:
        return 0

def save_cursor(n):
    try:
        with open(CURSOR, 'w', encoding='utf-8') as f:
            json.dump({'since': n}, f)
    except Exception:
        pass

async def poll_replies(ws):
    """轮询 HTTP 接口取真身回复, 发回 QQ。

    新版桥把回复放在内存队列里, 用递增的 seq 做游标 —— 不再有「读-清-写」
    竞态, 也不会因为外部程序晚一步启动就丢回复。游标本身存盘, 所以重启分身
    只会补发「没发过的」, 不会把发过的一股脑重发。
    """
    import asyncio
    import urllib.request
    since = load_cursor()
    saved = since
    while True:
        try:
            url = f'{REPLY_URL}?token={TOKEN}&since={since}'
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read())
            if not data.get('ok'):
                log(f'[轮询错误] {data.get("error")}')
            else:
                for r in data.get('replies', []):
                    since = max(since, r.get('seq', 0))
                    uid = r.get('userId', '')
                    reply = (r.get('text') or '').strip()
                    group_id = r.get('groupId') or None
                    if not uid or not reply:
                        continue
                    await send_text(ws, uid, reply, group_id)
                    log(f'[真身回复→QQ] {uid} (group={group_id}): {reply[:50]}')
                    # 语音 (只对较短的回复)
                    if len(reply) <= 100:
                        try:
                            wav = tts_wav(reply,
                                          os.path.join(BASE, 'models', 'elysia-voice', 'clips', 'guide-elysia', 'g-05.wav'),
                                          '作为游客，芽衣只需要负责好好享受这件事就好啦')
                            await send_voice(ws, uid, wav, group_id)
                            log('[语音] 已发送')
                        except Exception as e:
                            log(f'[语音失败·仅文字已发] {type(e).__name__}: {e}')
                    # 完成后通知 (done.json 兼容旧汇报); 封顶 200 条, 别无限涨
                    done = load_json(DONE)
                    done.append({'result': reply, 'time': time.strftime('%H:%M')})
                    save_json(DONE, done[-200:])
                since = max(since, data.get('nextSeq', 0))
        except Exception as e:
            log(f'[轮询错误] {e}')
        if since != saved:
            save_cursor(since)
            saved = since
        await asyncio.sleep(2)

# 消息去重: 同一用户 10 秒内相同文本只处理一次 (NapCat 会重复推送)
import threading as _th
LAST_MSG = {}
DEDUP_LOCK = _th.Lock()

def dedup_is_repeat(key):
    """True = 10 秒内的重复消息。顺手清掉 10 分钟前的旧记录, 去重表不会无限涨。"""
    now = time.time()
    with DEDUP_LOCK:
        if key in LAST_MSG and now - LAST_MSG[key] < 10:
            return True
        LAST_MSG[key] = now
        if len(LAST_MSG) > 1000:
            for k in [k for k, t in LAST_MSG.items() if now - t > 600]:
                del LAST_MSG[k]
        # 10 分钟内刷出上千条不同消息的极端情况: 硬上限兜底, 逐出最旧的
        while len(LAST_MSG) > 1000:
            del LAST_MSG[min(LAST_MSG, key=LAST_MSG.get)]
        return False

async def handle_message(ws, msg):
    user_id = msg.get('user_id')
    mtype = msg.get('message_type')
    group_id = msg.get('group_id')

    # 白名单 (P0-2): 先拦人, 连去重都不用为陌生人做。
    # 不回话 —— 回了反而给陌生人一个探测面, 让他知道这儿有个 bot。
    if user_id not in ALLOWED_USERS:
        log(f'[拦截] 非白名单用户 {user_id} ({"group:"+str(group_id) if group_id else "private"}), 丢弃')
        return
    if mtype == 'group' and ALLOWED_GROUP_IDS and group_id not in ALLOWED_GROUP_IDS:
        log(f'[拦截] 非白名单群 {group_id}, 丢弃')
        return

    text = ''
    is_at_me = False
    image_urls = []
    for seg in msg.get('message', []):
        if seg.get('type') == 'text':
            text += seg.get('data', {}).get('text', '')
        elif seg.get('type') == 'image':
            url = seg.get('data', {}).get('url', '')
            if url:
                image_urls.append(url)
        elif seg.get('type') == 'at':
            qq = seg.get('data', {}).get('qq')
            if qq == BOT_QQ or qq == 'all':
                is_at_me = True
    text = text.strip()
    if not text and not image_urls:
        return

    # 去重: 10 秒内同一用户相同消息只处理一次 (加锁防并发穿透)。
    # 纯图消息 text 为空, 键里补上首图 URL, 不然两张不同的图会被当成重复。
    dedup_key = f'{user_id}:{group_id}:{text}:{image_urls[0] if image_urls else ""}'
    if dedup_is_repeat(dedup_key):
        log(f'[去重] 忽略重复消息: {text[:30]}')
        return

    # 群聊: 只有被 @ 才响应
    if mtype == 'group' and not is_at_me:
        return

    # 看图 (二阶段 P2-4): 落盘后把路径随注入交给插件, 插件转成 image block。
    # 白名单/数量/大小上限都在 download_images 里; 全失败时 local_images 为空。
    local_images = download_images(image_urls) if image_urls else []
    if image_urls and not local_images:
        log(f'[图片] {len(image_urls)} 张全部下载失败/被拦')

    # 纯图但一张都没下下来才回话术。文字为空但有图 -> 照常转发 (文字留空), 让模型看图。
    if not text and not local_images:
        await send_text(ws, user_id, '呜…爱莉刚才没能把图片接住，再发一次好不好？', group_id)
        return

    log(f'[收到→真身] {user_id} ({"group:"+str(group_id) if group_id else "private"}): '
        f'{text or f"(纯图 x{len(local_images)})"}')
    try:
        msg_id = forward_to_host(text, user_id, group_id, local_images)
        log(f'[已转发] msgId={msg_id}')
        await send_text(ws, user_id, '嗯哼～爱莉收到啦，正在认真看哦，稍等一下下♪', group_id)
    except ForwardError as e:
        # 话术按状态码区分 (A1 验收): 401 = 口令/token 没同步, 403 = 白名单没同步,
        # 别再一概回"连接有点问题"误导人。
        log(f'[转发被拒] HTTP {e.status}')
        if e.status == 401:
            await send_text(ws, user_id,
                            '呜…爱莉这边的口令没对上（401）。检查 qq-config.json 的 inject_token，'
                            '然后重启爱莉分身再试。', group_id)
        elif e.status == 403:
            await send_text(ws, user_id,
                            '唔…名单好像没同步（403）。确认 qq-config.json 的 allowed_users 里有你，'
                            '然后重启爱莉分身再试。', group_id)
        else:
            await send_text(ws, user_id, '呜…爱莉的连接有点问题，再试一次好不好？', group_id)
    except Exception as e:
        log(f'[转发失败] {e}')
        await send_text(ws, user_id, '呜…爱莉的连接有点问题，再试一次好不好？', group_id)

WS_HDR_KEY = None   # 延迟判定 + 自愈: 第一次连 NapCat 时按特征选定, 连不上还能翻面重试

def ws_connect():
    """带 Bearer 口令连 NapCat (P0-3)。

    参数名按特征分支, 不按异常 (A4): websockets 的 connect 是惰性构造, 未知
    关键字参数在构造时不抛, 到 await/__aenter__ 才抛 TypeError —— 旧版的
    try/except TypeError 永远抓不到, 带着错参数直通就无限 [断线] 重连。

    ⚠️ 判据不能用 hasattr(websockets, 'asyncio'): v14+ 的包属性走 lazy_import,
    未触发解析前 hasattr 是 False (v15.0.1 实测), 会误选旧参数名 —— 而本机
    v15 上 extra_headers 在 await 时才抛 TypeError, 正是 A4 要修的死循环。
    稳定特征是 connect 的实现模块: v14+ 是 websockets.asyncio.* (参数名
    additional_headers), v13 及以下是 legacy (extra_headers)。
    """
    import websockets
    global WS_HDR_KEY
    kw = {'max_size': 20 * 1024 * 1024}
    if not WS_TOKEN:
        return websockets.connect(WS_URL, **kw)
    hdr = {'Authorization': f'Bearer {WS_TOKEN}'}
    if WS_HDR_KEY is None:
        mod = getattr(websockets.connect, '__module__', '') or ''
        WS_HDR_KEY = 'additional_headers' if mod.startswith('websockets.asyncio') else 'extra_headers'
        log(f'[WS] 头参数名按特征定为 {WS_HDR_KEY} (connect 来自 {mod})')
    return websockets.connect(WS_URL, **{WS_HDR_KEY: hdr}, **kw)

async def main():
    import asyncio
    if not ALLOWED_USERS:
        log(f'[警告] 白名单为空 —— fail-closed: 所有消息都会被拦截。'
            f'请在 {QQ_CONFIG_PATH} 的 allowed_users 里填 QQ 号数组后重启')
    if not FFMPEG:
        log('[警告] 找不到 ffmpeg (系统 PATH 和 本目录\\bin 都没有) —— 语音不可用, 只发文字')

    while True:
        try:
            log(f'[启动] 连接 {WS_URL} ...')
            async with ws_connect() as ws:
                log('[连接] 已建立, 等待消息...')
                poll_task = asyncio.create_task(poll_replies(ws))
                async def heartbeat():
                    while True:
                        try:
                            await ws.send(json.dumps({'action': 'get_login_info', 'params': {}, 'echo': 'hb'}))
                        except Exception:
                            break
                        await asyncio.sleep(30)
                hb_task = asyncio.create_task(heartbeat())
                try:
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                        except Exception:
                            continue
                        if msg.get('post_type') != 'message':
                            continue
                        if msg.get('message_type') not in ('private', 'group'):
                            continue
                        asyncio.create_task(handle_message(ws, msg))
                finally:
                    # 收尾必须走 finally: 接收循环一抛异常, 不 cancel 就泄漏 (P2-4)
                    hb_task.cancel()
                    poll_task.cancel()
        except Exception as e:
            # 自愈兜底: 头参数名万一选错 (特征被花式打包环境骗过), 错误要等到
            # await 才冒出来 —— 此时翻面换另一个名字, 别让机器人死循环重连。
            if isinstance(e, TypeError) and WS_HDR_KEY and 'headers' in str(e):
                flipped = 'extra_headers' if WS_HDR_KEY == 'additional_headers' else 'additional_headers'
                log(f'[断线] 头参数名 {WS_HDR_KEY} 不被本机 websockets 认可, 下次重连改用 {flipped}')
                WS_HDR_KEY = flipped
            log(f'[断线] {e}, 5 秒后重连...')
            await asyncio.sleep(5)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
