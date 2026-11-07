// ffmpeg/ffprobe 核心逻辑：抽帧 / 场景检测 / GIF / 元数据探测。
// 全部走 child_process 调本机 ffmpeg/ffprobe，参数用 argv 数组（无 shell 注入）。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
const execFileAsync = promisify(execFile);
export class FFmpegError extends Error {
    stderr;
    constructor(message, stderr = '') {
        super(message);
        this.name = 'FFmpegError';
        this.stderr = stderr;
    }
}
async function run(cmd, { signal, check = true } = {}) {
    try {
        const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), {
            signal,
            maxBuffer: 16 * 1024 * 1024,
        });
        return { stdout, stderr };
    }
    catch (err) {
        if (err.name === 'AbortError')
            throw err;
        if (!check)
            return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.code };
        const msg = err.stderr?.slice(-500) || err.message;
        throw new FFmpegError(`ffmpeg 执行失败: ${msg}`, err.stderr);
    }
}
export function makeTempDir() {
    const d = join(tmpdir(), `dsh-video-frames-${randomBytes(6).toString('hex')}`);
    return d;
}
// 时间段转 ffmpeg 参数：-ss（input 定位）+ -t（duration，而非 -to，避开时间戳重置坑）
function timeArgs(start, end) {
    const args = [];
    if (start != null)
        args.push('-ss', String(start));
    if (start != null && end != null)
        args.push('-t', String(end - start));
    else if (end != null)
        args.push('-t', String(end));
    return args;
}
// ---- 元数据探测 ----
export async function probeVideo(video, { signal } = {}) {
    const { stdout } = await run([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,codec_name:format=duration',
        '-of', 'json', video,
    ], { signal });
    const data = JSON.parse(stdout);
    const out = { has_audio: false };
    for (const st of data.streams || []) {
        out.codec = st.codec_name ?? out.codec;
        out.width = st.width ?? out.width;
        out.height = st.height ?? out.height;
        // 优先 r_frame_rate，部分 concat 拼接视频是 0/0 或空，用 avg_frame_rate 兜底
        const src = st.r_frame_rate === '0/0' || !st.r_frame_rate ? st.avg_frame_rate : st.r_frame_rate;
        const [num, den] = (src || '').split('/');
        if (Number.isFinite(+num) && Number.isFinite(+den) && +den)
            out.fps = Math.round((+num / +den) * 100) / 100;
    }
    // 最后一招：数帧 / 时长 推算
    if (out.fps == null) {
        try {
            const { stdout: fc } = await run([
                'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', video,
            ], { signal });
            const n = parseInt(fc.trim(), 10);
            if (Number.isFinite(n) && n > 0 && out.duration)
                out.fps = Math.round((n / out.duration) * 100) / 100;
        }
        catch {
            /* 忽略推算失败 */
        }
    }
    if (data.format?.duration)
        out.duration = Math.round(parseFloat(data.format.duration) * 100) / 100;
    try {
        const { stdout: audioOut } = await run([
            'ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video,
        ], { signal });
        out.has_audio = audioOut.trim().length > 0;
    }
    catch {
        out.has_audio = false;
    }
    return out;
}
// ---- 均匀抽帧 ----
// 返回 [{ time, file }]，file 在临时目录。
export async function extractFrames(video, { interval = 5, start, end, signal } = {}) {
    const dir = makeTempDir();
    await mkdir(dir, { recursive: true });
    const pattern = join(dir, 'f_%04d.jpg');
    await run([
        'ffmpeg', '-y', '-loglevel', 'error',
        ...timeArgs(start, end),
        '-i', video,
        '-vf', `fps=1/${interval}`,
        '-q:v', '2',
        pattern,
    ], { signal });
    const files = (await readdir(dir)).filter((n) => n.startsWith('f_')).sort();
    if (!files.length)
        throw new FFmpegError('ffmpeg 没有抽出任何帧（interval 可能过大或视频过短）');
    return files.map((n, i) => ({ time: (start || 0) + i * interval, file: join(dir, n) }));
}
// ---- 场景感知抽帧 ----
export async function sceneFrames(video, { threshold = 0.3, start, end, signal } = {}) {
    // 第一遍：select 场景变化帧 + showinfo 打 pts_time
    const { stderr } = await run([
        'ffmpeg', '-y', '-loglevel', 'info',
        ...timeArgs(start, end),
        '-i', video,
        '-vf', `select='gt(scene,${threshold})',showinfo`,
        '-vsync', '0', '-q:v', '2', '-f', 'null', '-',
    ], { signal });
    const times = [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => parseFloat(m[1]));
    if (!times.length)
        throw new FFmpegError(`没有检测到场景切换（threshold=${threshold} 可能太高，试试调低）`);
    // 第二遍：按时间戳精抽
    const dir = makeTempDir();
    await mkdir(dir, { recursive: true });
    const frames = [];
    for (let i = 0; i < times.length; i++) {
        const f = join(dir, `s_${String(i).padStart(3, '0')}.jpg`);
        await run([
            'ffmpeg', '-y', '-loglevel', 'error', '-ss', String(times[i]), '-i', video,
            '-frames:v', '1', '-q:v', '2', f,
        ], { signal });
        frames.push({ time: times[i], file: f });
    }
    return frames;
}
// ---- GIF ----
export async function makeGif(video, outPath, { start, end, duration, fps = 10, width = 480, signal } = {}) {
    const args = ['ffmpeg', '-y', '-loglevel', 'error'];
    if (start != null)
        args.push('-ss', String(start));
    args.push('-i', video);
    if (duration != null)
        args.push('-t', String(duration));
    else if (start != null && end != null)
        args.push('-t', String(end - start));
    args.push('-vf', `fps=${fps},scale=${width}:-1`, outPath);
    // 部分精简 ffmpeg 写完 GIF 后会崩溃返回非零码，但文件已生成——以文件存在为准
    await run(args, { signal, check: false });
    await stat(outPath);
}
export async function cleanupDir(dir) {
    if (!dir)
        return;
    try {
        await rm(dir, { recursive: true, force: true });
    }
    catch {
        /* 忽略清理失败 */
    }
}
// 格式化时间戳 MM:SS / HH:MM:SS
export function fmtTs(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
