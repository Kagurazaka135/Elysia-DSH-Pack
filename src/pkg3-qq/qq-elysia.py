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

def forward_to_host(text, user_id, group_id=None):
    """转发给真身, 返回 sessionId"""
    import urllib.request
    body = json.dumps({'text': text, 'userId': user_id, 'groupId': group_id or '',
                       'token': TOKEN}).encode()
    req = urllib.request.Request(INJECT_URL, body,
                                 {'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data.get('sessionId', '')

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

# 等待中的 msgId -> user_id 映射
WAITING = {}

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

    # 去重: 10 秒内同一用户相同消息只处理一次 (加锁防并发穿透)
    if dedup_is_repeat(f'{user_id}:{group_id}:{text}'):
        log(f'[去重] 忽略重复消息: {text[:30]}')
        return

    # 群聊: 只有被 @ 才响应
    if mtype == 'group' and not is_at_me:
        return

    # 暂不支持看图: 消息里的图片一律不下载。旧版会 urlretrieve 任意 URL ——
    # 纯属 SSRF 面, 而且下回来也没人用。二阶段做图片支持时, 带上腾讯 CDN
    # 域名白名单 (multimedia.nt.qq.com.cn / gchat.qpic.cn) 再加回来。
    if image_urls:
        log(f'[图片] 忽略 {len(image_urls)} 张 (暂不支持看图, 不下载)')

    # 纯图片消息没有文字可转, 说明白就行。不拦的话它会带着空 text 转发
    # -> 桥返回 400 -> 用户收到"连接有点问题", 那是误导。
    if not text:
        log(f'[图片] {user_id} 只发了图, 当前不支持')
        await send_text(ws, user_id, '呜…爱莉现在还没长出眼睛，看不见图片呢。发文字给爱莉好不好？', group_id)
        return

    log(f'[收到→真身] {user_id} ({"group:"+str(group_id) if group_id else "private"}): {text}')
    try:
        msg_id = forward_to_host(text, user_id, group_id)
        log(f'[已转发] msgId={msg_id}')
        await send_text(ws, user_id, '嗯哼～爱莉收到啦，正在认真看哦，稍等一下下♪', group_id)
    except Exception as e:
        log(f'[转发失败] {e}')
        await send_text(ws, user_id, '呜…爱莉的连接有点问题，再试一次好不好？', group_id)

async def main():
    import websockets
    import asyncio
    if not ALLOWED_USERS:
        log(f'[警告] 白名单为空 —— fail-closed: 所有消息都会被拦截。'
            f'请在 {QQ_CONFIG_PATH} 的 allowed_users 里填 QQ 号数组后重启')
    if not FFMPEG:
        log('[警告] 找不到 ffmpeg (系统 PATH 和 本目录\\bin 都没有) —— 语音不可用, 只发文字')

    def ws_connect():
        """带 Bearer 口令连 NapCat (P0-3); websockets <14 的参数名是 extra_headers。"""
        kw = {'max_size': 20 * 1024 * 1024}
        if not WS_TOKEN:
            return websockets.connect(WS_URL, **kw)
        hdr = {'Authorization': f'Bearer {WS_TOKEN}'}
        try:
            return websockets.connect(WS_URL, additional_headers=hdr, **kw)
        except TypeError:
            return websockets.connect(WS_URL, extra_headers=hdr, **kw)

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
            log(f'[断线] {e}, 5 秒后重连...')
            await asyncio.sleep(5)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
