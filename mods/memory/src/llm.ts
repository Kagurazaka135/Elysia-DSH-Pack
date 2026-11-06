/**
 * 整理专用模型调用 —— 走**宿主的 `ctx.llm` 服务**。
 *
 * 为什么不用自己拼 HTTP：dsh 自己就要靠模型上班，provider / 地址 / 真钥匙
 * 全在宿主的模型设置里（PC 上 profile 指向本地 broker，手机上是 App 里配的
 * 那一套）。插件跟着宿主走，两端都不用额外配置，也不会有"真 key 进仓库"的问题。
 */
import type { LlmRuntimeLike, ModelSelectionLike } from './host.ts'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OrganizerModel {
  llm: LlmRuntimeLike
  /** 没显式指定时用宿主当前的默认选择。 */
  fallback?: ModelSelectionLike
  /** 配置里显式指定的 provider / model（可以只给 model）。 */
  provider?: string
  model?: string
  maxTokens?: number
  timeoutMs?: number
}

/** 一次非流式调用：把 chunk 流攒成完整文本。 */
export async function chat(options: OrganizerModel, messages: readonly ChatMessage[], signal?: AbortSignal): Promise<string> {
  const selection = resolveSelection(options)
  const timeoutMs = options.timeoutMs ?? 300_000
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error('dsh-memory: 模型调用超时')),
    timeoutMs,
  )
  const fused = signal === undefined ? controller.signal : AbortSignal.any([signal, controller.signal])

  let text = ''
  let reasoning = ''
  let failure: string | undefined
  try {
    const stream = options.llm.stream({
      provider: selection.provider,
      model: selection.model,
      // 宿主契约：RequestMessage.content 是 **ContentBlock 数组**，不是字符串
      // （`UserMessage['content']` → `MessageBase.content: readonly ContentBlock[]`）。
      // 传字符串不会在入口报错——上游 `for…of` 迭代出字符、`block.type` 恒 undefined，
      // 一路滑到适配器的 `blocks.entries()` 才抛 TypeError，外层只剩
      // "DeepSeek Messages transport failed"，完全看不出是形状问题。别改回字符串。
      messages: messages.map(message => ({
        role: message.role,
        content: [{ type: 'text' as const, text: message.content }],
      })),
      temperature: 0.2,
      maxTokens: options.maxTokens ?? 8192,
      signal: fused,
    })
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        text += chunk.text
      } else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
        // 推理模型的 reasoning 先于 content 生成：content 空但 reasoning 带完整
        // JSON 时靠它兜底（extractJsonObject 会抠出来）。
        reasoning += chunk.text
      } else if (chunk.type === 'finish') {
        const reason = chunk.reason as { kind?: string; failure?: { message?: string; code?: string } } | undefined
        if (reason?.kind === 'error' || reason?.kind === 'aborted') {
          failure = reason.failure?.message ?? reason.failure?.code ?? reason.kind
        } else if (reason?.kind === 'max-tokens' && text.trim() === '' && reasoning.trim() === '') {
          failure = 'token 预算被推理过程耗尽（finish_reason=max-tokens）'
        }
      }
    }
  } catch (error: unknown) {
    throw new Error(`dsh-memory: 模型调用失败（${selection.provider}/${selection.model}）：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }

  if (failure !== undefined) {
    throw new Error(`dsh-memory: 模型调用失败（${selection.provider}/${selection.model}）：${failure}`)
  }
  if (text.trim() !== '') return text
  if (reasoning.trim() !== '') return reasoning
  throw new Error(`dsh-memory: 模型返回空内容（${selection.provider}/${selection.model}）`)
}

/** 显式配置优先，其次宿主当前默认选择。两者都没有就是宿主没配模型。 */
export function resolveSelection(options: OrganizerModel): ModelSelectionLike {
  const provider = options.provider?.trim() || options.fallback?.provider?.trim()
  const model = options.model?.trim() || options.fallback?.model?.trim()
  if (!provider || !model) {
    throw new Error(
      'dsh-memory: 宿主没有可用的默认模型（agentDefaultModel 缺失），也没在插件配置里指定 organizer_provider / organizer_model',
    )
  }
  return { provider, model }
}

/** 从模型输出里抠出第一个 JSON 对象（容忍 ```json 代码栅栏与前后废话）。 */
export function extractJsonObject(raw: string): Record<string, unknown> | undefined {
  const unfenced = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_, inner: string) => inner)
  for (const candidate of [unfenced, raw]) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) continue
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* 试下一个候选 */
    }
  }
  return undefined
}
