/**
 * 整理专用模型调用 —— 走**宿主的 `ctx.llm` 服务**。
 *
 * 为什么不用自己拼 HTTP：dsh 自己就要靠模型上班，provider / 地址 / 真钥匙
 * 全在宿主的模型设置里（PC 上 profile 指向本地 broker，手机上是 App 里配的
 * 那一套）。插件跟着宿主走，两端都不用额外配置，也不会有"真 key 进仓库"的问题。
 */
import type { LlmRuntimeLike, ModelSelectionLike } from './host.ts';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface OrganizerModel {
    llm: LlmRuntimeLike;
    /** 没显式指定时用宿主当前的默认选择。 */
    fallback?: ModelSelectionLike;
    /** 配置里显式指定的 provider / model（可以只给 model）。 */
    provider?: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
}
/** 一次非流式调用：把 chunk 流攒成完整文本。 */
export declare function chat(options: OrganizerModel, messages: readonly ChatMessage[], signal?: AbortSignal): Promise<string>;
/** 显式配置优先，其次宿主当前默认选择。两者都没有就是宿主没配模型。 */
export declare function resolveSelection(options: OrganizerModel): ModelSelectionLike;
/** 从模型输出里抠出第一个 JSON 对象（容忍 ```json 代码栅栏与前后废话）。 */
export declare function extractJsonObject(raw: string): Record<string, unknown> | undefined;
