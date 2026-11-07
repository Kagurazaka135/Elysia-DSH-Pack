/**
 * 会话扫描 —— 夜间整理要从"当天聊过什么"里发现问题。
 *
 * 只做只读扫描：用宿主 `sessionQuery`（若挂载）列出会话、读事件，
 * 提取 user/assistant 文本喂给整理模型。不写任何会话内容、不激活会话。
 */
import { type SessionQueryLike, type SessionRecordLike } from './host.ts';
export interface SessionDigest {
    id: string;
    createdAt?: number;
    title?: string;
    lines: string[];
}
/** 取最近 n 天（含今天）的会话列表；没有 now 参数时按调用时刻。 */
export declare function listRecentSessions(query: SessionQueryLike, options: {
    days: number;
    limit: number;
    signal?: AbortSignal;
}): Promise<SessionRecordLike[]>;
/** 把一场会话读成"人类可读摘要行"（只读字面量文本，忽略工具噪声）。 */
export declare function digestSession(query: SessionQueryLike, sessionId: string, options?: {
    signal?: AbortSignal;
}): Promise<SessionDigest | undefined>;
