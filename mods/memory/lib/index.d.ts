/**
 * dsh-memory —— DeepSeek Harness 分层记忆插件（L3 版本化事实 + L4 摘要 + 夜间整理）。
 *
 * 挂载：profile 的 cordis.patch.yml `- insert: { id: dsh-memory, name: 'dsh-memory' }`。
 * 铁律：只追加不删；模型调用**一律走宿主的 `ctx.llm`**（不自己拼 HTTP、不配 key，
 *      用户在 dsh 里配的模型就是它用的模型）；定时归 host、插件只注册不自持（不用 setInterval）。
 */
import { type MemoryConfig } from './config.ts';
import { type ContextLike } from './host.ts';
export declare const name = "dsh-memory";
/** 硬依赖：没有 tools 服务就什么也注册不了。其余（sessions/schedule/sessionQuery/sessionPersistence）都是可选能力。 */
export declare const inject: string[];
export declare function apply(ctx: ContextLike, config?: Partial<MemoryConfig>): void;
