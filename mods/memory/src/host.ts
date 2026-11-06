/**
 * 宿主服务的结构化最小类型（鸭子类型）。
 *
 * 关键点：本插件**不 import 宿主的任何 dsh-* 内部包**（除了 defineTool 的类型），
 * 只按服务名取用 —— 同一份包要能在 PC / 手机、0.1.x / 0.2.x 各版本宿主上加载。
 * 用到的字段全部可选化处理：服务形态对不上时按 undefined 处理，绝不抛。
 */

/**
 * 宿主 `Context` 的最小结构化类型（替代 `@deepseek-ai/cordis` 的类型 import）。
 *
 * 运行时 Cordis Context 还带 `inject` / `get` / 各服务属性；这里只声明本插件用到的部分，
 * 其余按 `unknown` 索引读取（见 {@link serviceOf}）。这样 `lib/*.d.ts` 里不含任何
 * `@deepseek-ai` 的 import，插件成为真正的零运行时依赖包。
 */
export interface ContextLike {
  get?(key: string): unknown
  inject(names: string[], callback: (ctx: ContextLike) => unknown): unknown
  [key: string]: unknown
}

export interface SessionHeaderLike {
  id: string
  createdAt?: number
  cwd?: string
  origin?: string
  agentPreset?: string
}

export interface SessionLike {
  id: string
  header?: SessionHeaderLike
}

export interface SessionsLike {
  get(id: string): SessionLike | undefined
  create(id: string, options?: { meta?: { cwd?: string } }): SessionLike
  /** dsh ≥0.2.x：构造但**不进入** store 的会话（用于正规物化路径）。老宿主没有此方法。 */
  prepare?(id: string, options?: { meta?: { cwd?: string } }): SessionLike
  flush(session: SessionLike): Promise<boolean>
}

/** 持久化写句柄（`sessionPersistence.create()` 的返回值，最小子集）。 */
export interface PersistenceHandleLike {
  /** 物化：空会话也会在磁盘上生成日志文件。 */
  flush(options?: { signal?: AbortSignal }): Promise<void>
  /** 释放写锁（幂等）。 */
  close(): Promise<void>
}

/**
 * 会话持久层（dsh ≥0.2.x 的 `sessionPersistence` 服务；鸭子类型，只用到最小子集）。
 *
 * 为什么需要它：schedule 到点投递要经 sessionController 恢复冷会话，
 * 而"已持久化"的判定读的是持久层自己写盘的文件——普通 `sessions.create + flush`
 * 只进内存 store 不写盘，冷恢复会找不到会话。物化必须走这里。
 */
export interface SessionPersistenceLike {
  stat(id: string, options?: { signal?: AbortSignal }): Promise<{ header: SessionHeaderLike } | undefined>
  create(header: unknown, options?: { signal?: AbortSignal }): Promise<PersistenceHandleLike>
}

export interface ScheduleCreateRequestLike {
  prompt: string
  title: string
  daily?: { time: string; time_zone: string }
  after_seconds?: number
  at?: string
}

export interface ScheduleTaskLike {
  id: string
  title: string
  prompt?: string
  sessionId: string
  status: 'active' | 'inactive'
}

export interface ScheduleLike {
  create(sessionId: string, request: ScheduleCreateRequestLike, signal?: AbortSignal): Promise<{ id: string }>
  catalog(): Promise<ScheduleTaskLike[]>
  delete(request: { id: string; sessionId: string }): Promise<unknown>
}

export interface SessionEventLike {
  type: string
  time?: number
  data?: Record<string, unknown>
}

export interface ObservationLike {
  header: SessionHeaderLike
  events: readonly SessionEventLike[]
}

export interface SessionRecordLike {
  header: SessionHeaderLike
  live: boolean
  persisted: boolean
}

export interface SessionQueryLike {
  listSessions(signal?: AbortSignal): Promise<SessionRecordLike[]>
  observeSession(
    sessionId: string,
    options?: { signal?: AbortSignal; projectionMode?: 'all' | 'none' },
  ): Promise<ObservationLike>
}

export interface LoggerLike {
  info(message: string): void
  warn(message: string): void
  debug?(message: string): void
}

/** dsh `llm.stream()` 的返回块（只用到文本/推理增量与终止原因）。 */
export type LlmChunkLike =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'finish'; reason: { kind: string; failure?: { message?: string; code?: string } } }
  | { type: string; [key: string]: unknown }

/**
 * 宿主契约里的内容块。**`content` 必须是块数组，不能是字符串** ——
 * 传字符串在入口不会报错，会一路滑到适配器的 `blocks.entries()` 才抛错。
 */
export interface TextBlockLike {
  type: 'text'
  text: string
}

/** dsh 的模型调用服务（`ctx.llm`）。走宿主配好的 provider，不自己拼 HTTP。 */
export interface LlmRuntimeLike {
  stream(options: {
    provider: string
    model: string
    messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: readonly TextBlockLike[]
    }>
    system?: string
    maxTokens?: number
    temperature?: number
    signal?: AbortSignal
  }): AsyncIterable<LlmChunkLike>
}

/** 宿主当前默认模型选择（`ctx.agentDefaultModel.currentSelection()`）。 */
export interface ModelSelectionLike {
  provider: string
  model: string
}

export interface AgentDefaultModelLike {
  currentSelection(): ModelSelectionLike
}

/** system prompt 的一个常驻段落（dsh `systemPrompt.section()` 的入参）。 */
export interface PromptSectionLike {
  name: string
  order: number
  text: string | ((context: unknown) => string)
}

/** system prompt 的一段动态快照（dsh `systemPrompt.context()` 的入参；`text` 只能同步）。 */
export interface PromptContextLike {
  name: string
  order: number
  text: string | ((context: unknown) => string)
}

/** 系统提示服务（dsh ≥0.1.x）。只用到 section / context，其余按 unknown。 */
export interface SystemPromptLike {
  section(section: PromptSectionLike): unknown
  context(context: PromptContextLike): unknown
}

/** 一次 apply 里用到的宿主服务集合（缺谁谁 undefined）。 */
export interface HostBundle {
  sessions?: SessionsLike
  schedule?: ScheduleLike
  sessionQuery?: SessionQueryLike
  systemPrompt?: SystemPromptLike
  llm?: LlmRuntimeLike
  agentDefaultModel?: AgentDefaultModelLike
  logger?: LoggerLike
}

/**
 * 按名取宿主服务（**永不抛**）。
 *
 * Cordis 语义：未在 `inject` 里声明的服务，**读取属性本身就会抛**
 * （`cannot get property "x" without inject`）。所以：
 *  1. 先用 `ctx.get(name)`（Cordis 官方的可选读取入口，未提供时返回 undefined）；
 *  2. 退回属性读取，且包 try/catch（老宿主 / 伪上下文）。
 */
export function serviceOf<T>(ctx: unknown, name: string): T | undefined {
  if (ctx === null || ctx === undefined) return undefined
  const record = ctx as { get?: (key: string) => unknown }
  if (typeof record.get === 'function') {
    try {
      const value = record.get(name)
      if (value !== undefined) return value as T
    } catch {
      /* 未提供 / 未注入：继续尝试属性读取 */
    }
  }
  try {
    const direct = (ctx as Record<string, unknown>)[name]
    if (direct !== undefined) return direct as T
  } catch {
    /* 未 inject：视为没有该服务 */
  }
  return undefined
}

export function hostBundle(ctx: unknown): HostBundle {
  return {
    sessions: serviceOf<SessionsLike>(ctx, 'sessions'),
    schedule: serviceOf<ScheduleLike>(ctx, 'schedule'),
    sessionQuery: serviceOf<SessionQueryLike>(ctx, 'sessionQuery'),
    systemPrompt: serviceOf<SystemPromptLike>(ctx, 'systemPrompt'),
    llm: serviceOf<LlmRuntimeLike>(ctx, 'llm'),
    agentDefaultModel: serviceOf<AgentDefaultModelLike>(ctx, 'agentDefaultModel'),
    logger: serviceOf<LoggerLike>(ctx, 'logger'),
  }
}

/** 释放一个可能实现了 Symbol.dispose 协议的宿主对象（观测租约等）。 */
const disposeSymbol = (Symbol as unknown as { dispose?: symbol }).dispose

export function disposeValue(value: unknown): void {
  if (value === null || value === undefined || disposeSymbol === undefined) return
  const fn = (value as Record<symbol, unknown>)[disposeSymbol]
  if (typeof fn === 'function') (fn as () => void).call(value)
}
