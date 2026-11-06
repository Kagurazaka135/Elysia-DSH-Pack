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
import type { MemoryConfig } from './config.ts';
import { type ContextLike } from './host.ts';
export declare const SCHEDULE_TITLE = "\u8BB0\u5FC6\u6574\u7406\uFF08dsh-memory\u00B7\u591C\u95F4\uFF09";
export declare const PROMPT_MARKER = "\u3010dsh-memory \u591C\u95F4\u6574\u7406\u3011";
export declare const DEFAULT_ORGANIZER_SESSION = "memory-organizer";
/** 到点投递进整理会话的提示词。 */
export declare function buildOrganizePrompt(dailyTime: string): string;
interface Registered {
    id: string;
    sessionId: string;
}
export interface SetupResult {
    action: 'registered' | 'already' | 'skipped' | 'error';
    detail?: string;
}
/** 幂等注册每日整理任务。可重复调用（重复 = no-op）。 */
export declare function setupNightlyOrganize(ctx: ContextLike, config: MemoryConfig): Promise<SetupResult>;
/**
 * 显式停用（`enable_schedule: false`）时清理自己注册的夜间整理任务。
 * 只删本插件自己的任务（会话 + 标题/prompt 标记双重匹配），绝不碰别人的任务。返回删除条数。
 */
export declare function cleanupNightlyOrganize(ctx: ContextLike, config: MemoryConfig): Promise<number>;
/** 当前已注册任务（供自检工具/日志用）。 */
export declare function registeredTask(): Registered | undefined;
export {};
