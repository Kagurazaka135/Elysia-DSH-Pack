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
 * 且 agent 作用域可以单独挂权限闸门（本文件暂未挂，这是下一步的活）。
 */
import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, isAbsolute } from 'node:path'

import z from '@deepseek-ai/schemastery'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'

/** cordis 插件名，loader 诊断用。 */
export const name = 'dsh-qq-bridge'

/**
 * 依赖的服务：路由注册、agent 注册表、预设挂载、默认模型路由、
 * 附件落盘（看图用，二阶段 P2-4）、模型目录（图片能力硬门）。
 */
export const inject = ['webServer', 'agents', 'agentPresets', 'agentDefaultModel', 'attachments', 'llm']

export const Config = z.object({
  /** 注入/取回复要带的共享口令。实际生效值优先读 configPath 指向的 qq-config.json
   *  （与分身/NapCat 同源，A1 单源）；这里只是那份文件缺失时的兜底。 */
  token: z.string().default(''),
  /** 共享配置（qq-config.json）的绝对路径：白名单/口令的唯一真源。 */
  configPath: z.string().default('D:/AI/JARVIS/qq-config.json'),
  /** 每个 QQ 用户用哪个 agent preset。留空 = 用 settings 里的默认预设。 */
  agentPreset: z.string().default('elysia'),
  /** agent 的工作目录（必须是绝对路径且存在）。留空 = 用户主目录。 */
  cwd: z.string().default(''),
  /** 准入白名单，逗号分隔的 QQ 号；只在 qq-config.json 缺失时作兜底，
   *  留空 = 谁都能用（兜底语义，会打警告）。 */
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

/** 扩展名 → 媒体类型。dsh 的 saveImages 只认 png/jpeg/webp/gif，别的落不进去。
 *  （命名导出只为可测试；cordis 只消费 name/inject/Config/apply。） */
export const MEDIA_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/** 按魔数认图片真实类型，认不出返回 undefined。（命名导出只为可测试） */
export function sniffImageMediaType(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  if (buf.length >= 12
    && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  return undefined
}

/**
 * 本地图片路径 → dsh image content block（二阶段 P2-4）。
 * 分身把图落盘后把路径塞进注入 body 的 images 字段，这里读文件、经
 * attachments 服务换成 durable ref。单张失败/类型不支持只跳过那一张，
 * 绝不让整条注入 500。（命名导出只为可测试）
 */
export async function toImageBlocks(attachments, localPaths, log) {
  const inputs = []
  for (const p of localPaths) {
    if (typeof p !== 'string' || !isAbsolute(p)) {
      log.warn(`[qq-bridge] 忽略非法图片路径: ${String(p)}`)
      continue
    }
    try {
      const data = await readFile(p)
      // 分身统一按 .jpg 命名，但压失败时直存原图、字节未必是 jpeg ——
      // 按魔数认类型，扩展名只作兜底。
      const mediaType = sniffImageMediaType(data) ?? MEDIA_BY_EXT[extname(p).toLowerCase()]
      if (mediaType === undefined) {
        log.warn(`[qq-bridge] 不支持的图片类型, 跳过 ${p}`)
        continue
      }
      inputs.push({ data, mediaType, name: basename(p) })
    } catch (error) {
      log.warn(`[qq-bridge] 图片读失败, 跳过 ${p}: ${String(error)}`)
    }
  }
  if (inputs.length === 0) return []
  const refs = await attachments.saveImages(inputs)
  return refs.map(attachment => ({ type: 'image', attachment }))
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

  // ── A1 单源：白名单/口令以 qq-config.json 为唯一真源 ──────────────────────
  // 分身（Python）、NapCat（onebot11.json）、安装脚本都读写同一个文件；以前插件
  // 读的是 profile 里的副本，用户按 README 改了 qq-config.json 后插件永远不跟
  // → 新号 403 / 新 token 401。这里直读原文件、按 mtime 缓存：改完重启分身就
  // 生效，dsh 本体都不用重启。文件缺失/读不了才退回 profile 兜底配置（并警告）。
  let cfgCache = { mtimeMs: -1, auth: null }

  /**
   * 取当前生效的鉴权配置。
   * @returns {{ source: string, token: string, allowed: Set<string> }}
   *   source = 'qq-config.json' 时白名单语义与分身一致（空 = 全拦，fail-closed）；
   *   source = 'profile' 时保留旧语义（空 = 不限，fail-open）。
   */
  function effectiveAuth() {
    let stat = null
    try {
      stat = statSync(config.configPath)
    } catch { /* 文件不在 → 走兜底 */ }
    if (stat !== null) {
      if (stat.mtimeMs !== cfgCache.mtimeMs) {
        let auth = null
        try {
          const raw = JSON.parse(readFileSync(config.configPath, 'utf8'))
          const listed = raw.allowed_users ?? []
          const users = Array.isArray(listed) ? listed : [listed]
          auth = {
            source: 'qq-config.json',
            token: String(raw.inject_token ?? ''),
            allowed: new Set(users.map(u => String(u).trim()).filter(s => s !== '')),
          }
        } catch (error) {
          log.warn(`[qq-bridge] ${config.configPath} 读不出来（${String(error)}），暂用 profile 兜底配置`)
        }
        if (auth !== null) cfgCache = { mtimeMs: stat.mtimeMs, auth }
      }
      if (cfgCache.auth !== null) return cfgCache.auth
    } else if (cfgCache.mtimeMs !== -2) {
      cfgCache = { mtimeMs: -2, auth: null }
      log.warn(`[qq-bridge] 找不到共享配置 ${config.configPath} —— 白名单/口令退回 profile 兜底`
        + '（两处要一致；建议重装 QQ 包或检查安装路径）')
    }
    return {
      source: 'profile',
      token: config.token,
      allowed: new Set(config.allowedUsers.split(',').map(s => s.trim()).filter(s => s !== '')),
    }
  }

  // ── 看图硬门：路由模型能不能真的收图 ──────────────────────────────────────
  // dsh 对不支持图片输入的模型会把 image block 投影成占位文本、或在请求时直接
  // 拒发 —— 表现都是"看不见图"。目录里声明了 inputModalities 才能提前判定，
  // 判定不支持的就不发图块，改发带说明的纯文本，不让 QQ 那头干等。
  // 目录外/未声明的 id 判不了（null），照发图块、由 dsh 自己裁决。
  const imageCapability = new Map()

  async function routeImageCapable(provider, model) {
    const key = `${provider}/${model}`
    if (imageCapability.has(key)) return imageCapability.get(key)
    let verdict = null
    try {
      const models = await ctx.llm.listModels(provider)
      const info = models.find(m => m.id === model)
      verdict = info?.inputModalities === undefined ? null : info.inputModalities.includes('image')
    } catch (error) {
      log.warn(`[qq-bridge] 查询模型目录失败（${String(error)}），图片照常注入，由 dsh 裁决`)
    }
    imageCapability.set(key, verdict)
    if (verdict === false) {
      log.warn(`[qq-bridge] 默认模型 ${model}（provider ${provider}）不支持图片输入 —— 图片不会真正发给模型。`
        + '要看图请把默认模型换成支持视觉的模型（官方 deepseek-flash，或本地视觉模型）。')
    } else if (verdict === true) {
      log.info(`[qq-bridge] 默认模型 ${model} 支持图片输入，QQ 图片将真实可见`)
    } else {
      log.info(`[qq-bridge] 模型目录里查不到 ${model} 的模态声明，图片照常注入（dsh 会自行裁决）`)
    }
    return verdict
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
      const auth = effectiveAuth()
      if (auth.token !== '' && data.token !== auth.token) {
        // 401 = 没验过身份（口令不对）；403 = 验过了但没资格（白名单外）。
        // 分身按状态码区分话术（A1 验收项），别混用。
        sendJson(res, 401, { ok: false, error: 'bad token' })
        return
      }

      const text = String(data.text ?? '').trim()
      const userId = String(data.userId ?? '').trim()
      const groupId = String(data.groupId ?? '').trim()
      const images = Array.isArray(data.images)
        ? data.images.filter(p => typeof p === 'string' && p !== '').slice(0, 8)
        : []
      if (userId === '') {
        sendJson(res, 400, { ok: false, error: 'userId is required' })
        return
      }
      // 纯图消息（text 为空但有图片路径）是合法的 —— 分身让模型直接看图。
      if (text === '' && images.length === 0) {
        sendJson(res, 400, { ok: false, error: 'text or images are required' })
        return
      }
      // qq-config.json 是唯一真源，语义跟分身对齐：名单空 = 全拦（fail-closed）。
      // profile 兜底保留旧语义：名单空 = 不限（fail-open，启动时有警告）。
      const pass = auth.source === 'qq-config.json'
        ? auth.allowed.has(userId)
        : (auth.allowed.size === 0 || auth.allowed.has(userId))
      if (!pass) {
        log.warn(`[qq-bridge] 拒绝白名单外的用户 ${userId}（名单来源 ${auth.source}）`)
        sendJson(res, 403, { ok: false, error: 'sender not allowed' })
        return
      }

      try {
        const agent = await agentFor(userId)
        if (process.env.QQBRIDGE_DEBUG) process.stderr.write(`[qqdbg] agent.session.id=${agent.session.id} agentStatus=${JSON.stringify(agent.status ?? null)}\n`)
        // 记住这条会话最近一次是从哪儿来的，回复时才不会把群消息发成私聊。
        groupBySession.set(agent.session.id, groupId)
        const from = groupId !== '' ? `群 ${groupId}` : `私聊 ${userId}`

        // 看图（二阶段 P2-4）：先过能力硬门，再落盘换 image block。
        const selection = ctx.agentDefaultModel.currentSelection()
        let imageBlocks = []
        let imageNote = ''
        if (images.length > 0) {
          const capable = await routeImageCapable(selection.provider, selection.model)
          if (capable !== false) {
            imageBlocks = await toImageBlocks(ctx.attachments, images, log)
          }
          if (imageBlocks.length === 0) {
            imageNote = capable === false
              ? `\n（用户发来了 ${images.length} 张图，但当前模型 ${selection.model} 不支持看图，已按纯文本处理 —— 提醒用户换支持视觉的模型后再发图）`
              : `\n（用户发来了 ${images.length} 张图，但图片没能读出来，按纯文本处理）`
          }
        }

        agent.followup(createUserMessage({
          content: [{ type: 'text', text: `[QQ 消息 · 来自 ${from}]\n${text}${imageNote}` }, ...imageBlocks],
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
      const auth = effectiveAuth()
      if (auth.token !== '' && url.searchParams.get('token') !== auth.token) {
        sendJson(res, 401, { ok: false, error: 'bad token' })
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

  const bootAuth = effectiveAuth()
  if (bootAuth.token === '') {
    log.warn('[qq-bridge] inject_token 为空 —— 注入接口不校验口令，任何本机进程都能驱动 agent')
  }
  log.info(`[qq-bridge] 就绪（preset=${config.agentPreset || '(默认)'}，cwd=${cwd}，`
    + `白名单来源=${bootAuth.source}，名单=${bootAuth.allowed.size === 0 ? '(空)' : [...bootAuth.allowed].join(',')}）`)
}
