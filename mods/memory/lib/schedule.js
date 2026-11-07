import { normalizeDailyTime, normalizeTimeZone } from "./config.js";
import { localDate } from "./organize.js";
import { appendLog, resolvePaths } from "./store.js";
import { serviceOf, } from "./host.js";
export const SCHEDULE_TITLE = '记忆整理（dsh-memory·夜间）';
export const PROMPT_MARKER = '【dsh-memory 夜间整理】';
export const DEFAULT_ORGANIZER_SESSION = 'memory-organizer';
/** 到点投递进整理会话的提示词。 */
export function buildOrganizePrompt(dailyTime) {
    return `${PROMPT_MARKER}现在是每日记忆整理时间（${dailyTime}）。

请调用 memory_organize 工具完成本次整理。它会：扫描最近会话与 L2 候选 → 走本地 broker 归纳 → 只追加地更新 L3 事实版本 / L2 候选 / L4 摘要 / 整理日志。

完成后用两三句话汇报：新增/版本化的事实、候选数、摘要是否更新。若工具报错（如 broker 未开），把错误原文简述一下即可——**不要手工编辑记忆文件**（只追加铁律由工具保证；手工改会绕过版本化）。`;
}
let registered;
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** 整理会话的工作目录：优先 cwd（绝对路径），退回 home。 */
function organizerCwd(config) {
    const fromCwd = process.cwd();
    if (fromCwd && (fromCwd.startsWith('/') || /^[A-Za-z]:[\\/]/.test(fromCwd)))
        return fromCwd;
    const home = process.env.USERPROFILE ?? process.env.HOME;
    if (home)
        return home;
    return fromCwd || '/';
}
/** 把一次注册/清理的诊断追加到 `memory/log/<date>.json`（尽力而为，绝不影响主流程）。 */
async function recordSetup(config, entry) {
    try {
        await appendLog(resolvePaths(config), localDate(), entry);
    }
    catch {
        /* 诊断日志失败不致命 */
    }
}
/**
 * 物化整理会话：确保磁盘上存在一个可被 schedule 冷恢复的 `memory-organizer` 会话。
 *
 * 正规路径（dsh ≥0.2.x）：prepare → persistence.create(header) → handle.flush() → handle.close()。
 * 老宿主回退：sessions.create + sessions.flush（只进内存；若宿主另有写盘机制仍可能有效）。
 */
async function materializeOrganizerSession(ctx, config, organizerId) {
    const sessions = serviceOf(ctx, 'sessions');
    const persistence = serviceOf(ctx, 'sessionPersistence');
    const cwd = organizerCwd(config);
    // 已落盘：不再动（重启/重载场景）。
    if (persistence !== undefined) {
        try {
            const snapshot = await persistence.stat(organizerId);
            if (snapshot !== undefined)
                return { state: 'exists' };
        }
        catch {
            /* stat 失败按"不存在"处理，继续尝试创建（创建撞已有会另报 already-exists，也当 exists） */
        }
    }
    try {
        if (sessions === undefined)
            throw new Error('宿主没有 sessions 服务');
        if (persistence !== undefined && typeof sessions.prepare === 'function') {
            const prepared = sessions.prepare(organizerId, { meta: { cwd } });
            const header = prepared.header;
            if (header === undefined)
                throw new Error('sessions.prepare 未返回 header');
            const handle = await persistence.create(header);
            try {
                await handle.flush();
            }
            finally {
                await handle.close();
            }
            return { state: 'created' };
        }
        // 老宿主回退：只进内存 store（能投递与否取决于宿主；至少不阻塞注册）。
        if (sessions.get(organizerId) === undefined) {
            const session = sessions.create(organizerId, { meta: { cwd } });
            await sessions.flush(session);
        }
        return { state: 'fallback' };
    }
    catch (error) {
        const detail = messageOf(error);
        // 撞已存在（同进程/并发）不是错误——当作 exists。
        if (/already\s*exists/i.test(detail))
            return { state: 'exists' };
        return { state: 'failed', detail };
    }
}
/** 幂等注册每日整理任务。可重复调用（重复 = no-op）。 */
export async function setupNightlyOrganize(ctx, config) {
    const sessions = serviceOf(ctx, 'sessions');
    const schedule = serviceOf(ctx, 'schedule');
    const logger = serviceOf(ctx, 'logger');
    if (sessions === undefined || schedule === undefined) {
        logger?.info('dsh-memory: 宿主没有 schedule 服务（dsh < 0.2.0-rc.2），跳过夜间整理自动注册；记忆工具不受影响');
        return { action: 'skipped', detail: 'no-schedule-service' };
    }
    const organizerId = config.organizer_session?.trim() || DEFAULT_ORGANIZER_SESSION;
    const daily = normalizeDailyTime(config.daily_time);
    const timeZone = normalizeTimeZone(config.time_zone);
    // ---- 1. 物化整理会话（已落盘则跳过） ----
    const material = await materializeOrganizerSession(ctx, config, organizerId);
    if (material.state === 'created') {
        logger?.info(`dsh-memory: 已物化整理会话 "${organizerId}"（sessionPersistence，可被定时投递冷恢复）`);
    }
    else if (material.state === 'exists') {
        logger?.info(`dsh-memory: 整理会话 "${organizerId}" 已存在且落盘，直接复用`);
    }
    else if (material.state === 'fallback') {
        logger?.warn(`dsh-memory: 宿主无 sessionPersistence，整理会话仅内存物化（定时投递可能无法冷恢复）`);
    }
    else {
        logger?.warn(`dsh-memory: 整理会话物化失败（继续注册定时任务）：${material.detail ?? ''}`);
    }
    // ---- 2. 幂等检查 ----
    let existing = [];
    try {
        existing = await schedule.catalog();
    }
    catch (error) {
        logger?.warn(`dsh-memory: 读取定时任务目录失败（按未注册处理）：${messageOf(error)}`);
    }
    const mine = existing.find(task => task.sessionId === organizerId
        && task.status === 'active'
        && (task.title === SCHEDULE_TITLE || task.prompt?.includes(PROMPT_MARKER) === true));
    if (mine !== undefined) {
        registered = { id: mine.id, sessionId: organizerId };
        logger?.info(`dsh-memory: 夜间整理任务已注册（${mine.id}，每日 ${daily} ${timeZone}）`);
        await recordSetup(config, {
            action: 'schedule-setup', result: 'already', task: mine.id,
            session: organizerId, daily, time_zone: timeZone,
        });
        return { action: 'already', detail: mine.id };
    }
    // ---- 3. 注册 ----
    try {
        const created = await schedule.create(organizerId, {
            title: SCHEDULE_TITLE,
            prompt: buildOrganizePrompt(daily),
            daily: { time: daily, time_zone: timeZone },
        });
        registered = { id: created.id, sessionId: organizerId };
        logger?.info(`dsh-memory: 已注册夜间整理任务（每日 ${daily} ${timeZone}）→ 会话 "${organizerId}"；可在自动化任务页查看`);
        await recordSetup(config, {
            action: 'schedule-setup', result: 'registered', task: created.id,
            session: organizerId, daily, time_zone: timeZone, materialize: material.state,
        });
        return { action: 'registered', detail: created.id };
    }
    catch (error) {
        const detail = messageOf(error);
        logger?.warn(`dsh-memory: 夜间整理任务注册失败（记忆工具不受影响）：${detail}`);
        await recordSetup(config, {
            action: 'schedule-setup', result: 'error', detail,
            session: organizerId, daily, time_zone: timeZone, materialize: material.state,
        });
        return { action: 'error', detail };
    }
}
/**
 * 显式停用（`enable_schedule: false`）时清理自己注册的夜间整理任务。
 * 只删本插件自己的任务（会话 + 标题/prompt 标记双重匹配），绝不碰别人的任务。返回删除条数。
 */
export async function cleanupNightlyOrganize(ctx, config) {
    const schedule = serviceOf(ctx, 'schedule');
    const logger = serviceOf(ctx, 'logger');
    if (schedule === undefined)
        return 0;
    const organizerId = config.organizer_session?.trim() || DEFAULT_ORGANIZER_SESSION;
    let removed = 0;
    try {
        const existing = await schedule.catalog();
        for (const task of existing) {
            const isMine = task.sessionId === organizerId
                && (task.title === SCHEDULE_TITLE || task.prompt?.includes(PROMPT_MARKER) === true);
            if (!isMine)
                continue;
            try {
                await schedule.delete({ id: task.id, sessionId: task.sessionId });
                removed += 1;
            }
            catch (error) {
                logger?.warn(`dsh-memory: 移除夜间整理任务 ${task.id} 失败：${messageOf(error)}`);
            }
        }
    }
    catch (error) {
        logger?.warn(`dsh-memory: 清理夜间整理任务失败：${messageOf(error)}`);
    }
    if (removed > 0) {
        logger?.info(`dsh-memory: enable_schedule=false，已移除 ${removed} 条夜间整理任务`);
        await recordSetup(config, { action: 'schedule-cleanup', removed });
    }
    else {
        logger?.info('dsh-memory: enable_schedule=false，夜间整理任务未注册（无需清理）');
    }
    return removed;
}
/** 当前已注册任务（供自检工具/日志用）。 */
export function registeredTask() {
    return registered;
}
