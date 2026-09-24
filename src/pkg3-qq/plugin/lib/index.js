/**
 * dsh-qq-bridge — QQ (OneBot 11) 与 DeepSeek Harness 之间的桥。
 *
 * 两个方向：
 *   POST /api/qq/inject   外部机器人把 QQ 消息送进来 → 注入该用户的 agent
 *   GET  /api/qq/replies  外部机器人把 agent 的回复取走
 *
 * 回复是**订阅 session 事件流**拿到的（照 ACP 的做法：`session/event` 里过滤
 * `assistant/message`），不靠模型写文件、也不靠模型调工具 —— 模型不需要知道
 * 自己在跟 QQ 说话。
 *
 * 一个 QQ 号 = 一个 agent = 一条会话，所以不同用户的上下文天然隔离，
 * 且 agent 作用域可以单独挂权限闸门（本文件暂未挂，见 README 的"还没做"）。
 */
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { isAbsolute } from 'node:path'

import z from '@deepseek-ai/schemastery'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'

/** cordis 插件名，loader 诊断用。 */
export const name = 'dsh-qq-bridge'

/** 依赖的服务：路由注册、agent 注册表、预设挂载、默认模型路由。 */
export const inject = ['webServer', 'agents', 'agentPresets', 'agentDefaultModel']

export const Config = z.object({
  /** 注入/取回复要带的共享口令；留空 = 不校验（会打警告）。 */
  token: z.string().default(''),
  /** 每个 QQ 用户用哪个 agent preset。留空 = 用 settings 里的默认预设。 */
  agentPreset: z.string().default('elysia'),
  /** agent 的工作目录（必须是绝对路径且存在）。留空 = 用户主目录。 */
  cwd: z.string().default(''),
  /** 准入白名单，逗号分隔的 QQ 号；留空 = 谁都能用。 */
  allowedUsers: z.string().default(''),
  /** 请求体上限（字节）。 */
  maxBodyBytes: z.number().default(64 * 1024),
  /** 回复队列最多留多少条，防止外部程序长期不取导致内存涨。 */
  replyBuffer: z.number().default(500),
})

/** 读取有上限的请求体；超限返回 null（并 drain 掉剩余，好让拒绝是个可读响应）。 */
async function readBoundedBody(req, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > maxBytes) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

/** 把一个 JSON 对象写回去。 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(body)
}

/** 从 assistant 消息里取出正文（只取 text block，忽略 reasoning / tool-call）。 */
function assistantText(message) {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

export function apply(ctx, config) {
  const log = ctx.logger

  /** userId -> { handle, sessionId } */
  const agentsByUser = new Map()
  /** sessionId -> userId，回复回来时用来找主人。 */
  const userBySession = new Map()
  /** sessionId -> groupId（私聊为空串），好让回复发回群里而不是发成私聊。 */
  const groupBySession = new Map()
  /** sessionId -> 当前回合最后一段非空 assistant 文本。 */
  const pendingText = new Map()
  /** 待外部取走的回复。 */
  const replies = []
  let replySeq = 0

  const allowAll = config.allowedUsers.trim() === ''
  const allowed = new Set(
    config.allowedUsers.split(',').map(s => s.trim()).filter(s => s !== ''),
  )

  if (config.token === '') {
    log.warn('[qq-bridge] token 为空 —— 注入接口不校验口令，任何本机进程都能驱动 agent')
  }

  const cwd = config.cwd !== '' ? config.cwd : homedir()
  if (!isAbsolute(cwd)) {
    throw new Error(`dsh-qq-bridge: cwd 必须是绝对路径，收到 ${JSON.stringify(cwd)}`)
  }

  /**
   * 拿到某个 QQ 号的 agent，没有就按「一人一 agent」建一个。
   * @param userId - QQ 号。
   * @returns 该用户的 agent handle。
   */
  async function agentFor(userId) {
    const existing = agentsByUser.get(userId)
    if (existing !== undefined) return existing.handle.agent

    const sessionId = SessionId(`qq-${userId}-${randomUUID()}`)
    const preset = config.agentPreset !== '' ? config.agentPreset : undefined

    // 没有这一步，prompt 里的 {{model}} / {{provider}} 会注册了却没有值，
    // 人格段落一渲染就报 "has no value for this assembly"。headless 和 ACP
    // 都是这么接的，抄它们。
    const selection = ctx.agentDefaultModel.currentSelection()
    const agentOptions = { provider: selection.provider, model: selection.model }

    const handle = await ctx.agents.create({
      sessionId,
      meta: {
        cwd,
        ...(preset !== undefined ? { agentPreset: preset } : {}),
      },
      agentOptions,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
        // 光给 meta.agentPreset 只会在日志里 warning，真正把预设挂上去得在这里显式调。
        if (preset !== undefined) {
          try {
            await ctx.agentPresets.mount(agentCtx, preset)
          } catch (error) {
            // 预设没装（比如人格包没装 / 名字写错）不该让整条链路陪葬 ——
            // 降级成默认预设，至少还能聊。人格包是可选的。
            log.warn(`[qq-bridge] 预设 "${preset}" 挂载失败，改用默认预设：${String(error)}`)
          }
        }
      },
    })

    agentsByUser.set(userId, { handle, sessionId })
    userBySession.set(sessionId, userId)
    log.info(`[qq-bridge] 为 ${userId} 建了新 agent（session ${sessionId}，preset ${preset ?? '(默认)'}）`)
    return handle.agent
  }

  /** 把回复塞进待取队列。 */
  function pushReply(userId, sessionId, text) {
    replySeq += 1
    replies.push({
      seq: replySeq,
      userId,
      groupId: groupBySession.get(sessionId) ?? '',
      sessionId,
      text,
      at: Date.now(),
    })
    if (replies.length > config.replyBuffer) replies.splice(0, replies.length - config.replyBuffer)
    log.info(`[qq-bridge] ${userId} 的回复已入队（seq ${replySeq}，${text.length} 字）`)
  }

  // ── 回复捕获：只认回合最后一段非空文本，中间的工具步骤不外发 ──────────────
  ctx.on('session/event', (session, event) => {
    const sessionId = session.id
    if (process.env.QQBRIDGE_DEBUG) process.stderr.write(`[qqdbg] ${JSON.stringify(event, (k, v) => (k === 'signal' ? '[signal]' : v)).slice(0, 1200)}\n`)
    if (userBySession.get(sessionId) === undefined) return

    if (event.type === 'assistant/message') {
      const text = assistantText(event.data.message)
      // 空文本（纯工具调用回合）不覆盖上一条，避免把真回复冲掉。
      if (text !== '') pendingText.set(sessionId, text)
      return
    }
    if (event.type === 'turn/end') {
      const text = pendingText.get(sessionId)
      pendingText.delete(sessionId)
      const userId = userBySession.get(sessionId)
      if (text !== undefined && text !== '' && userId !== undefined) {
        pushReply(userId, sessionId, text)
      }
    }
  })

  // ── 注入接口 ────────────────────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/qq/inject',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      const raw = await readBoundedBody(req, config.maxBodyBytes)
      if (raw === null) {
        sendJson(res, 413, { ok: false, error: 'body too large' })
        return
      }
      let data
      try {
        data = JSON.parse(raw)
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      if (typeof data !== 'object' || data === null) {
        sendJson(res, 400, { ok: false, error: 'body must be a json object' })
        return
      }
      if (config.token !== '' && data.token !== config.token) {
        sendJson(res, 403, { ok: false, error: 'bad token' })
        return
      }

      const text = String(data.text ?? '').trim()
      const userId = String(data.userId ?? '').trim()
      const groupId = String(data.groupId ?? '').trim()
      if (text === '' || userId === '') {
        sendJson(res, 400, { ok: false, error: 'text and userId are required' })
        return
      }
      if (!allowAll && !allowed.has(userId)) {
        log.warn(`[qq-bridge] 拒绝白名单外的用户 ${userId}`)
        sendJson(res, 403, { ok: false, error: 'sender not allowed' })
        return
      }

      try {
        const agent = await agentFor(userId)
        if (process.env.QQBRIDGE_DEBUG) process.stderr.write(`[qqdbg] agent.session.id=${agent.session.id} agentStatus=${JSON.stringify(agent.status ?? null)}\n`)
        // 记住这条会话最近一次是从哪儿来的，回复时才不会把群消息发成私聊。
        groupBySession.set(agent.session.id, groupId)
        const from = groupId !== '' ? `群 ${groupId}` : `私聊 ${userId}`
        agent.followup(createUserMessage({
          content: [{ type: 'text', text: `[QQ 消息 · 来自 ${from}]\n${text}` }],
          source: { kind: 'plugin', plugin: 'qq-bridge', userId, groupId },
        }))
        sendJson(res, 200, { ok: true, sessionId: agent.session.id })
      } catch (error) {
        log.error(`[qq-bridge] 注入失败: ${String(error)}`)
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  }), 'qq-bridge: inject route')

  // ── 取回复接口 ──────────────────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/qq/replies',
    handler: (req, res) => {
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (config.token !== '' && url.searchParams.get('token') !== config.token) {
        sendJson(res, 403, { ok: false, error: 'bad token' })
        return
      }
      const since = Number(url.searchParams.get('since') ?? '0')
      const from = Number.isFinite(since) && since > 0 ? since : 0
      const batch = replies.filter(r => r.seq > from)
      sendJson(res, 200, { ok: true, replies: batch, nextSeq: replySeq })
    },
  }), 'qq-bridge: replies route')

  // 插件卸载时把建过的 agent 收干净。
  ctx.effect(() => () => {
    for (const { handle } of agentsByUser.values()) handle.dispose()
    agentsByUser.clear()
    userBySession.clear()
    groupBySession.clear()
    pendingText.clear()
    replies.length = 0
  }, 'qq-bridge: agent teardown')

  log.info(`[qq-bridge] 就绪（preset=${config.agentPreset || '(默认)'}，cwd=${cwd}，`
    + `白名单=${allowAll ? '(不限)' : [...allowed].join(',')}）`)
}
