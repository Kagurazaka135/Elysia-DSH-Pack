/**
 * dsh-memory —— DeepSeek Harness 分层记忆插件（L3 版本化事实 + L4 摘要 + 夜间整理）。
 *
 * 挂载：profile 的 cordis.patch.yml `- insert: { id: dsh-memory, name: 'dsh-memory' }`。
 * 铁律：只追加不删；模型调用**一律走宿主的 `ctx.llm`**（不自己拼 HTTP、不配 key，
 *      用户在 dsh 里配的模型就是它用的模型）；定时归 host、插件只注册不自持（不用 setInterval）。
 */
import { DEFAULT_CONFIG, type MemoryConfig } from './config.ts'
import { serviceOf, type ContextLike, type LoggerLike } from './host.ts'
import { registerMemoryPrompt } from './prompt.ts'
import { cleanupNightlyOrganize, setupNightlyOrganize } from './schedule.ts'
import { readBrief, resolvePaths } from './store.ts'
import { registerMemoryTools } from './tools.ts'

export const name = 'dsh-memory'
/** 硬依赖：没有 tools 服务就什么也注册不了。其余（sessions/schedule/sessionQuery/sessionPersistence）都是可选能力。 */
export const inject = ['tools']

export function apply(ctx: ContextLike, config?: Partial<MemoryConfig>): void {
  const merged: MemoryConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) }
  const logger = serviceOf<LoggerLike>(ctx, 'logger')

  registerMemoryTools(ctx, { config: merged, paths: resolvePaths(merged), ctx })
  logger?.info(`dsh-memory: 记忆工具已注册（memory 目录：$DSH_HOME/memory${merged.memory_dir ? `，覆盖为 ${merged.memory_dir}` : ''}）`)

  // 预热简报缓存：context() 的提供者只能同步读，第一次装配前先把简报读进内存。
  void readBrief(resolvePaths(merged)).catch(() => undefined)

  // 可选能力：有 systemPrompt 就挂常驻能力块 + 简报快照；老宿主没有该服务则静默跳过。
  ctx.inject(['systemPrompt'], (sctx: ContextLike) => {
    if (registerMemoryPrompt(sctx, merged).registered) {
      serviceOf<LoggerLike>(sctx, 'logger')?.info('dsh-memory: 能力块与简报快照已注入 system prompt')
    }
  })

  if (merged.enable_schedule === false) {
    // 显式停用：主动清掉自己注册过的任务（幂等；没注册过则 no-op）。
    ctx.inject(['schedule'], (sctx: ContextLike) => {
      void cleanupNightlyOrganize(sctx, merged).catch((error: unknown) => {
        const log = serviceOf<LoggerLike>(sctx, 'logger')
        log?.warn(`dsh-memory: 清理夜间整理任务异常（忽略）：${error instanceof Error ? error.message : String(error)}`)
      })
    })
    return
  }
  // 可选依赖：sessions/schedule 齐全时才尝试自动注册夜间整理；sessionQuery/sessionPersistence
  // 各自按需取用（sessionQuery 用于扫会话，sessionPersistence 用于物化整理会话）。
  // 缺 schedule（如 dsh 0.1.x）则静默维持 pending，不影响已注册的工具。
  ctx.inject(['sessions', 'schedule'], (sctx: ContextLike) => {
    void setupNightlyOrganize(sctx, merged).catch((error: unknown) => {
      const log = serviceOf<LoggerLike>(sctx, 'logger')
      log?.warn(`dsh-memory: 自动注册夜间整理异常（忽略）：${error instanceof Error ? error.message : String(error)}`)
    })
  })
}
