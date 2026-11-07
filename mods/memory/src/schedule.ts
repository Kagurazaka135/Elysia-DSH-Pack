/**
 * 夜间整理的定时注册（§3 铁律 3：定时归 host、插件只注册不自持）。
 *
 * 设计要点（踩过的坑都在这）：
 * - **不用 setInterval**：用 dsh 原生 schedule 服务（Host 级、持久、自动化任务页可见）。
 * - **幂等**：查 `catalog()`，已存在自己的任务（同会话 + 标题或 prompt 标记）就跳过。
 *   重启/热重载后不会重复注册，也不会删了重建。
 * - **不做 dispose 删除**：Cordis 里插件 dispose 发生在**应用退出/重载**，而不是"卸载"——
 *   要是在 dispose 里删任务，每次关应用都会把定时任务删掉。任务归 host 持久；
 *   要移除任务：把配置改成 `enable_schedule: false` 跑一次（本插件会主动清掉自己注册的任务），
 *   或在自动化任务页手动删。这一点写在 README。
 * - **整理会话物化（dsh ≥0.2.0-rc.2 的关键坑）**：到点投递时 Host 经
 *   `sessionController.resolveAgent(会话 id)` 恢复冷会话，要求会话**已持久化落盘**、
 *   header.cwd 非空。裸 `sessions.create + sessions.flush` 只进内存 store、不写盘
 *   （持久化后端只认自己的写句柄），冷恢复时找不到会话、投递被静默拒绝。正确姿势：
 *   `sessions.prepare`（构造但不进 store）→ `sessionPersistence.create(header)` →
 *   `handle.flush()`（物化空会话，磁盘上出现日志文件）→ `handle.close()`（释放写锁）。
 * - **daily 时间格式**：dsh ≥0.2.0-rc.2 的 schedule 只接受 `HH:MM:SS`（秒必填），
 *   传 `HH:MM` 会 `invalid_rule` 拒绝；normalizeDailyTime 统一输出秒级（见 config.ts）。
 * - **诊断落盘**：注册/清理结果除了 logger 还会追加到 `memory/log/YYYY-MM-DD.json`——
 *   真实教训：daily_time 格式被新版 schedule 拒绝时，只看 logger 是查不到的。
 * - **降级**：宿主没有 sessions/schedule/sessionPersistence 服务（如 dsh 0.1.x）时什么都不做，
 *   记忆工具照常可用。
 */
import type { MemoryConfig } from './config.ts'
import { normalizeDailyTime, normalizeTimeZone } from './config.ts'
import { localDate } from './organize.ts'
import { appendLog, resolvePaths } from './store.ts'
import {
  serviceOf, type ContextLike, type LoggerLike, type PersistenceHandleLike, type ScheduleLike, type ScheduleTaskLike,
  type SessionPersistenceLike, type SessionsLike,
} from './host.ts'
import type { YamlValue } from './yaml.ts'

export const SCHEDULE_TITLE = '记忆整理（dsh-memory·夜间）'
export const PROMPT_MARKER = '【dsh-memory 夜间整理】'
export const DEFAULT_ORGANIZER_SESSION = 'memory-organizer'

/** 到点投递进整理会话的提示词。 */
export function buildOrganizePrompt(dailyTime: string): string {
  return `${PROMPT_MARKER}现在是每日记忆整理时间（${dailyTime}）。

请调用 memory_organize 工具完成本次整理。它会：扫描最近会话与 L2 候选 → 走本地 broker 归纳 → 只追加地更新 L3 事实版本 / L2 候选 / L4 摘要 / 整理日志。

完成后用两三句话汇报：新增/版本化的事实、候选数、摘要是否更新。若工具报错（如 broker 未开），把错误原文简述一下即可——**不要手工编辑记忆文件**（只追加铁律由工具保证；手工改会绕过版本化）。`
}

interface Registered {
  id: string
  sessionId: string
}

let registered: Registered | undefined

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 整理会话的工作目录：优先 cwd（绝对路径），退回 home。 */
function organizerCwd(config: MemoryConfig): string {
  const fromCwd = process.cwd()
  if (fromCwd && (fromCwd.startsWith('/') || /^[A-Za-z]:[\\/]/.test(fromCwd))) return fromCwd
  const home = process.env.USERPROFILE ?? process.env.HOME
  if (home) return home
  return fromCwd || '/'
}

export interface SetupResult {
  action: 'registered' | 'already' | 'skipped' | 'error'
  detail?: string
}

/** 把一次注册/清理的诊断追加到 `memory/log/<date>.json`（尽力而为，绝不影响主流程）。 */
async function recordSetup(config: MemoryConfig, entry: Record<string, YamlValue | undefined>): Promise<void> {
  try {
    await appendLog(resolvePaths(config), localDate(), entry)
  } catch {
    /* 诊断日志失败不致命 */
  }
}

/** 整理会话的物化结果：created=本次落盘；exists=之前已落盘；fallback=只内存（老宿主）；failed=物化失败。 */
type MaterializeState = 'created' | 'exists' | 'fallback' | 'failed'

/**
 * 物化整理会话：确保磁盘上存在一个可被 schedule 冷恢复的 `memory-organizer` 会话。
 *
 * 正规路径（dsh ≥0.2.x）：prepare → persistence.create(header) → handle.flush() → handle.close()。
 * 老宿主回退：sessions.create + sessions.flush（只进内存；若宿主另有写盘机制仍可能有效）。
 */
async function materializeOrganizerSession(
  ctx: ContextLike,
  config: MemoryConfig,
  organizerId: string,
): Promise<{ state: MaterializeState; detail?: string }> {
  const sessions = serviceOf<SessionsLike>(ctx, 'sessions')
  const persistence = serviceOf<SessionPersistenceLike>(ctx, 'sessionPersistence')
  const cwd = organizerCwd(config)

  // 已落盘：不再动（重启/重载场景）。
  if (persistence !== undefined) {
    try {
      const snapshot = await persistence.stat(organizerId)
      if (snapshot !== undefined) return { state: 'exists' }
    } catch {
      /* stat 失败按"不存在"处理，继续尝试创建（创建撞已有会另报 already-exists，也当 exists） */
    }
  }

  try {
    if (sessions === undefined) throw new Error('宿主没有 sessions 服务')
    if (persistence !== undefined && typeof sessions.prepare === 'function') {
      const prepared = sessions.prepare(organizerId, { meta: { cwd } })
      const header = (prepared as { header?: unknown }).header
      if (header === undefined) throw new Error('sessions.prepare 未返回 header')
      const handle: PersistenceHandleLike = await persistence.create(header)
      try {
        await handle.flush()
      } finally {
        await handle.close()
      }
      return { state: 'created' }
    }
    // 老宿主回退：只进内存 store（能投递与否取决于宿主；至少不阻塞注册）。
    if (sessions.get(organizerId) === undefined) {
      const session = sessions.create(organizerId, { meta: { cwd } })
      await sessions.flush(session)
    }
    return { state: 'fallback' }
  } catch (error: unknown) {
    const detail = messageOf(error)
    // 撞已存在（同进程/并发）不是错误——当作 exists。
    if (/already\s*exists/i.test(detail)) return { state: 'exists' }
    return { state: 'failed', detail }
  }
}

/** 幂等注册每日整理任务。可重复调用（重复 = no-op）。 */
export async function setupNightlyOrganize(ctx: ContextLike, config: MemoryConfig): Promise<SetupResult> {
  const sessions = serviceOf<SessionsLike>(ctx, 'sessions')
  const schedule = serviceOf<ScheduleLike>(ctx, 'schedule')
  const logger = serviceOf<LoggerLike>(ctx, 'logger')
  if (sessions === undefined || schedule === undefined) {
    logger?.info('dsh-memory: 宿主没有 schedule 服务（dsh < 0.2.0-rc.2），跳过夜间整理自动注册；记忆工具不受影响')
    return { action: 'skipped', detail: 'no-schedule-service' }
  }

  const organizerId = config.organizer_session?.trim() || DEFAULT_ORGANIZER_SESSION
  const daily = normalizeDailyTime(config.daily_time)
  const timeZone = normalizeTimeZone(config.time_zone)

  // ---- 1. 物化整理会话（已落盘则跳过） ----
  const material = await materializeOrganizerSession(ctx, config, organizerId)
  if (material.state === 'created') {
    logger?.info(`dsh-memory: 已物化整理会话 "${organizerId}"（sessionPersistence，可被定时投递冷恢复）`)
  } else if (material.state === 'exists') {
    logger?.info(`dsh-memory: 整理会话 "${organizerId}" 已存在且落盘，直接复用`)
  } else if (material.state === 'fallback') {
    logger?.warn(`dsh-memory: 宿主无 sessionPersistence，整理会话仅内存物化（定时投递可能无法冷恢复）`)
  } else {
    logger?.warn(`dsh-memory: 整理会话物化失败（继续注册定时任务）：${material.detail ?? ''}`)
  }

  // ---- 2. 幂等检查 ----
  let existing: ScheduleTaskLike[] = []
  try {
    existing = await schedule.catalog()
  } catch (error: unknown) {
    logger?.warn(`dsh-memory: 读取定时任务目录失败（按未注册处理）：${messageOf(error)}`)
  }
  const mine = existing.find(task =>
    task.sessionId === organizerId
    && task.status === 'active'
    && (task.title === SCHEDULE_TITLE || task.prompt?.includes(PROMPT_MARKER) === true))
  if (mine !== undefined) {
    registered = { id: mine.id, sessionId: organizerId }
    logger?.info(`dsh-memory: 夜间整理任务已注册（${mine.id}，每日 ${daily} ${timeZone}）`)
    await recordSetup(config, {
      action: 'schedule-setup', result: 'already', task: mine.id,
      session: organizerId, daily, time_zone: timeZone,
    })
    return { action: 'already', detail: mine.id }
  }

  // ---- 3. 注册 ----
  try {
    const created = await schedule.create(organizerId, {
      title: SCHEDULE_TITLE,
      prompt: buildOrganizePrompt(daily),
      daily: { time: daily, time_zone: timeZone },
    })
    registered = { id: created.id, sessionId: organizerId }
    logger?.info(`dsh-memory: 已注册夜间整理任务（每日 ${daily} ${timeZone}）→ 会话 "${organizerId}"；可在自动化任务页查看`)
    await recordSetup(config, {
      action: 'schedule-setup', result: 'registered', task: created.id,
      session: organizerId, daily, time_zone: timeZone, materialize: material.state,
    })
    return { action: 'registered', detail: created.id }
  } catch (error: unknown) {
    const detail = messageOf(error)
    logger?.warn(`dsh-memory: 夜间整理任务注册失败（记忆工具不受影响）：${detail}`)
    await recordSetup(config, {
      action: 'schedule-setup', result: 'error', detail,
      session: organizerId, daily, time_zone: timeZone, materialize: material.state,
    })
    return { action: 'error', detail }
  }
}

/**
 * 显式停用（`enable_schedule: false`）时清理自己注册的夜间整理任务。
 * 只删本插件自己的任务（会话 + 标题/prompt 标记双重匹配），绝不碰别人的任务。返回删除条数。
 */
export async function cleanupNightlyOrganize(ctx: ContextLike, config: MemoryConfig): Promise<number> {
  const schedule = serviceOf<ScheduleLike>(ctx, 'schedule')
  const logger = serviceOf<LoggerLike>(ctx, 'logger')
  if (schedule === undefined) return 0

  const organizerId = config.organizer_session?.trim() || DEFAULT_ORGANIZER_SESSION
  let removed = 0
  try {
    const existing = await schedule.catalog()
    for (const task of existing) {
      const isMine = task.sessionId === organizerId
        && (task.title === SCHEDULE_TITLE || task.prompt?.includes(PROMPT_MARKER) === true)
      if (!isMine) continue
      try {
        await schedule.delete({ id: task.id, sessionId: task.sessionId })
        removed += 1
      } catch (error: unknown) {
        logger?.warn(`dsh-memory: 移除夜间整理任务 ${task.id} 失败：${messageOf(error)}`)
      }
    }
  } catch (error: unknown) {
    logger?.warn(`dsh-memory: 清理夜间整理任务失败：${messageOf(error)}`)
  }
  if (removed > 0) {
    logger?.info(`dsh-memory: enable_schedule=false，已移除 ${removed} 条夜间整理任务`)
    await recordSetup(config, { action: 'schedule-cleanup', removed })
  } else {
    logger?.info('dsh-memory: enable_schedule=false，夜间整理任务未注册（无需清理）')
  }
  return removed
}

/** 当前已注册任务（供自检工具/日志用）。 */
export function registeredTask(): Registered | undefined {
  return registered
}
