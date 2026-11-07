import type { MemoryConfig } from './config.ts';
import { type MemoryPaths } from './store.ts';
export interface ToolDeps {
    config: MemoryConfig;
    paths: MemoryPaths;
    /** 插件 apply 时的上下文；宿主服务**调用时惰性解析**（后挂载的服务也能看到）。 */
    ctx: unknown;
}
export declare function registerMemoryTools(ctx: unknown, deps: ToolDeps): void;
