/**
 * 会话扫描 —— 夜间整理要从"当天聊过什么"里发现问题。
 *
 * 只做只读扫描：用宿主 `sessionQuery`（若挂载）列出会话、读事件，
 * 提取 user/assistant 文本喂给整理模型。不写任何会话内容、不激活会话。
 */
import { disposeValue, type ObservationLike, type SessionEventLike, type SessionQueryLike, type SessionRecordLike } from './host.ts'

export interface SessionDigest {
  id: string
  createdAt?: number
  title?: string
  lines: string[]
}

const MAX_LINES_PER_SESSION = 80
const MAX_CHARS_PER_LINE = 400
const MAX_TOTAL_CHARS = 24_000

/** 取最近 n 天（含今天）的会话列表；没有 now 参数时按调用时刻。 */
export async function listRecentSessions(
  query: SessionQueryLike,
  options: { days: number; limit: number; signal?: AbortSignal },
): Promise<SessionRecordLike[]> {
  const records = await query.listSessions(options.signal)
  const cutoff = Date.now() - options.days * 24 * 60 * 60 * 1000
  const recent = records
    .filter(record => {
      const created = record.header.createdAt
      return created === undefined || created >= cutoff
    })
    .sort((a, b) => (b.header.createdAt ?? 0) - (a.header.createdAt ?? 0))
  return recent.slice(0, Math.min(options.limit, 40))
}

/** 把一场会话读成"人类可读摘要行"（只读字面量文本，忽略工具噪声）。 */
export async function digestSession(
  query: SessionQueryLike,
  sessionId: string,
  options: { signal?: AbortSignal } = {},
): Promise<SessionDigest | undefined> {
  let observation: ObservationLike | undefined
  try {
    observation = await query.observeSession(sessionId, { signal: options.signal, projectionMode: 'none' })
    const lines = extractLines(observation.events)
    if (lines.length === 0) return undefined
    return { id: sessionId, createdAt: observation.header.createdAt, lines }
  } catch {
    return undefined
  } finally {
    disposeValue(observation)
  }
}

function extractLines(events: readonly SessionEventLike[]): string[] {
  const lines: string[] = []
  let totalChars = 0
  for (const event of events) {
    if (lines.length >= MAX_LINES_PER_SESSION || totalChars >= MAX_TOTAL_CHARS) break
    const data = event.data
    if (data === undefined) continue
    if (event.type === 'user/message') {
      const text = textOf(data.content)
      // 跳过整理自己注入的提示与系统噪声
      if (text === '' || text.includes('dsh-memory') || text.includes('记忆整理')) continue
      lines.push(`用户: ${clip(text)}`)
      totalChars += text.length
    } else if (event.type === 'assistant/message') {
      const message = data.message as { content?: unknown } | undefined
      const text = textOf(message?.content)
      if (text === '') continue
      lines.push(`助手: ${clip(text)}`)
      totalChars += text.length
    }
  }
  return lines
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') parts.push(text)
    }
  }
  return parts.join('\n').trim()
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_CHARS_PER_LINE ? `${flat.slice(0, MAX_CHARS_PER_LINE)}…` : flat
}
