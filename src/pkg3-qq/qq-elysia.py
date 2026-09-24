# -*- coding: utf-8 -*-
"""爱莉 QQ 机器人 v4 (真身直答版)
收到消息 -> 转发真身(注入桥 followup 唤醒) -> 轮询 reply.json -> 真身回复发回 QQ (文字+语音)
分身不再自己调用模型回复, 所有回答都来自真身完整思考
"""
import os, sys, json, time, base64, io, wave, re, threading

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(BASE, 'qq-elysia.log')
PENDING = os.path.join(BASE, 'tasks', 'pending.json')
DONE = os.path.join(BASE, 'tasks', 'done.json')
os.makedirs(os.path.join(BASE, 'tasks'), exist_ok=True)

WS_URL = 'ws://127.0.0.1:3001'
INJECT_URL = 'http://127.0.0.1:3080/api/qq/inject'
REPLY_URL = 'http://127.0.0.1:3080/api/qq/replies'
# 新版桥是 bundle 插件, 注入和取回复都可以带共享口令。
# 留空 = 两边都不校验, 跟插件的 token 默认值对齐 —— 只监听 127.0.0.1, 本机自用够。
TOKEN = ''

def log(msg):
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(line + '\n')
    print(line, flush=True)

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

def forward_to_host(text, user_id, group_id=None, images=None):
    """转发给真身, 返回 sessionId; images 为本地图片路径列表 (新版桥暂不吃图片)"""
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
    tmp_wav = os.path.join(tempfile.gettempdir(), 'elys_send.wav')
    tmp_mp3 = os.path.join(tempfile.gettempdir(), 'elys_send.mp3')
    with open(tmp_wav, 'wb') as f:
        f.write(wav_bytes)
    ffmpeg = os.path.join(BASE, 'bin', 'ffmpeg.exe')
    subprocess.run([ffmpeg, '-y', '-i', tmp_wav, '-ar', '44100', '-ac', '1', '-b:a', '64k', tmp_mp3],
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
                    # 完成后通知 (done.json 兼容旧汇报)
                    done = load_json(DONE)
                    done.append({'result': reply, 'time': time.strftime('%H:%M')})
                    save_json(DONE, done)
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

async def handle_message(ws, msg):
    user_id = msg.get('user_id')
    mtype = msg.get('message_type')
    group_id = msg.get('group_id')
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
            if qq == '2778339130' or qq == 'all':
                is_at_me = True
    text = text.strip()
    if not text and not image_urls:
        return

    # 去重: 10 秒内同一用户相同消息只处理一次 (加锁防并发穿透)
    dedup_key = f'{user_id}:{group_id}:{text}'
    now = time.time()
    with DEDUP_LOCK:
        if dedup_key in LAST_MSG and now - LAST_MSG[dedup_key] < 10:
            log(f'[去重] 忽略重复消息: {text[:30]}')
            return
        LAST_MSG[dedup_key] = now

    # 群聊: 只有被 @ 才响应
    if mtype == 'group' and not is_at_me:
        return

    # 下载图片 -> 压缩到 400px (省 token) -> 保存本地
    local_images = []
    if image_urls:
        import urllib.request
        import subprocess
        for i, url in enumerate(image_urls[:3]):
            try:
                img_dir = os.path.join(BASE, 'tasks', 'qq-images')
                os.makedirs(img_dir, exist_ok=True)
                raw_path = os.path.join(img_dir, f'raw_{int(time.time())}_{i}.jpg')
                urllib.request.urlretrieve(url, raw_path)
                # 压缩到 400px, q=8 (约 15-30KB, token 大减)
                img_path = os.path.join(img_dir, f'qq_{int(time.time())}_{i}.jpg')
                ffmpeg = os.path.join(BASE, 'bin', 'ffmpeg.exe')
                subprocess.run([ffmpeg, '-y', '-i', raw_path, '-vf', 'scale=400:-1', '-q:v', '8', img_path],
                               capture_output=True, timeout=30)
                os.remove(raw_path)
                if os.path.exists(img_path) and os.path.getsize(img_path) > 500:
                    local_images.append(img_path)
                    log(f'[图片] 已下载+压缩 {img_path} ({os.path.getsize(img_path)}B)')
                else:
                    # 压缩失败则用原图
                    urllib.request.urlretrieve(url, img_path)
                    local_images.append(img_path)
                    log(f'[图片] 压缩失败用原图 {img_path}')
            except Exception as e:
                log(f'[图片下载失败] {e}')

    # 新版桥还不吃图片: 纯图片消息没有文字可转, 说明白就行。
    # 不拦的话它会带着空 text 转发 -> 桥返回 400 -> 用户收到"连接有点问题", 那是误导。
    # 判据是 text 为空 —— 上面已经拦掉"文字和图片都没有"的情况, 走到这儿说明本来就带了图
    # (图下载失败也一样, 反正都没有文字可转)。
    if not text:
        log(f'[图片] {user_id} 只发了图, 当前不支持')
        await send_text(ws, user_id, '呜…爱莉现在还没长出眼睛，看不见图片呢。发文字给爱莉好不好？', group_id)
        return

    if local_images:
        log(f'[图片] 桥暂不支持图片, 本次只转发文字 ({len(local_images)} 张被忽略)')
    log(f'[收到→真身] {user_id} ({"group:"+str(group_id) if group_id else "private"}): {text} 图片x{len(local_images)}')
    try:
        msg_id = forward_to_host(text, user_id, group_id, local_images)
        log(f'[已转发] msgId={msg_id}')
        await send_text(ws, user_id, '嗯哼～爱莉收到啦，正在认真看哦，稍等一下下♪', group_id)
    except Exception as e:
        log(f'[转发失败] {e}')
        await send_text(ws, user_id, '呜…爱莉的连接有点问题，再试一次好不好？', group_id)

async def main():
    import websockets
    import asyncio
    while True:
        try:
            log(f'[启动] 连接 {WS_URL} ...')
            async with websockets.connect(WS_URL, max_size=20*1024*1024) as ws:
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
                hb_task.cancel()
                poll_task.cancel()
        except Exception as e:
            log(f'[断线] {e}, 5 秒后重连...')
            await asyncio.sleep(5)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
