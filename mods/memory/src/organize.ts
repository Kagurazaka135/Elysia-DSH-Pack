/**
 * 夜间整理引擎（§6）。
 *
 * 流程：扫当天会话 + L2 候选 → 走 broker 归纳 → **只追加** L3 版本（无变化不写）
 *      → 更新 L4 brief（旧版归档，不丢） → 写 log → 记已处理会话台账。
 *
 * 铁律：只追加不删。模型提议的事实若与现状相同 → 不算新版本（unchanged）；
 * broker 失败 → 什么都不写（除 log 里一条失败记录），绝不编造记忆。
 */
import type { MemoryConfig } from './config.ts'
import { chat, extractJsonObject, resolveSelection, type ChatMessage, type OrganizerModel } from './llm.ts'
import { digestSession, listRecentSessions } from './session-scan.ts'
import {
  addCandidate, appendLog, archiveBrief, composeBrief, ensureDirs, listShardFiles, localDate, readBrief,
  mergeDuplicateCandidates, readCandidates, readFacts, readSeenSessions, readShardIndex, readShardLayout,
  resolvePaths, safeShardName, UNSORTED_SHARD, upsertFact, writeBrief, writeCandidates, writeFacts,
  writeSeenSessions, writeShardGroups, type FactRecord,
} from './store.ts'
import type { SessionQueryLike } from './host.ts'

export interface OrganizeOptions {
  config: MemoryConfig
  /** 宿主的模型服务（必需）：整理与分片都要调模型。 */
  llm: OrganizerModel
  sessionQuery?: SessionQueryLike
  signal?: AbortSignal
  /** true = 只生成报告不改文件（手动试跑用）。 */
  dryRun?: boolean
  /** 扫描时跳过的会话 id（整理会话自身，默认取 config.organizer_session 或 memory-organizer）。 */
  skipSessionId?: string
  /** 强制重排分片（忽略条数阈值）。 */
  forceReshard?: boolean
}

export interface OrganizeResult {
  ok: boolean
  date: string
  sessionsScanned: number
  factsCreated: string[]
  factsVersioned: string[]
  candidatesAdded: number
  briefUpdated: boolean
  summary?: string
  error?: string
  logPath: string
  notes: string[]
  /** 本次是否重排了分片。 */
  shards?: Array<{ name: string; count: number }>
}

interface FactProposal {
  id?: string
  fact: string
  value: string
  source: string[]
  tags: string[]
  note?: string
}

interface CandidateProposal {
  fact: string
  source: string[]
  tags: string[]
}

interface OrganizerOutput {
  facts: FactProposal[]
  candidates: CandidateProposal[]
  brief?: string
  summary?: string
}

export { localDate } from './store.ts'

const MAX_FACT_OPS = 20
const MAX_CANDIDATE_OPS = 20
const MAX_DIGEST_CHARS = 60_000
const MAX_SHARDS = 24
/** unsorted 攒到多少条才值得为它们单独问一次模型。 */
const UNSORTED_KEEP = 15
const TRUNCATION_MARK = '\n…（本场已截断）'

interface FittedDigests {
  digests: Array<{ id: string; text: string }>
  originalChars: number
  truncatedChars: number
}

/**
 * 把会话摘录压进字数预算：先按会话均分，余量再分给被截断的那些。
 *
 * 旧实现是先拼好完整 prompt 再统计字数、超了只 push 一条提示，预算等于没生效。
 */
export function fitDigests(digests: Array<{ id: string; text: string }>, maxChars: number): FittedDigests {
  const originalChars = digests.reduce((sum, item) => sum + item.text.length, 0)
  if (originalChars <= maxChars || digests.length === 0) {
    return { digests, originalChars, truncatedChars: 0 }
  }
  const share = Math.max(200, Math.floor(maxChars / digests.length))
  const sizes = digests.map(item => Math.min(item.text.length, share))
  const leftover = maxChars - sizes.reduce((sum, size) => sum + size, 0)
  const shortened = digests.map((_item, index) => index).filter(index => digests[index].text.length > sizes[index])
  if (leftover > 0 && shortened.length > 0) {
    const extra = Math.floor(leftover / shortened.length)
    for (const index of shortened) {
      sizes[index] = Math.min(digests[index].text.length, sizes[index] + extra)
    }
  }
  const fitted = digests.map((item, index) => {
    if (sizes[index] >= item.text.length) return item
    const keep = Math.max(0, sizes[index] - TRUNCATION_MARK.length)
    return { id: item.id, text: `${item.text.slice(0, keep)}${TRUNCATION_MARK}` }
  })
  return {
    digests: fitted,
    originalChars,
    truncatedChars: originalChars - fitted.reduce((sum, item) => sum + item.text.length, 0),
  }
}

export async function runOrganize(options: OrganizeOptions): Promise<OrganizeResult> {
  const { config, llm, sessionQuery, signal, dryRun } = options
  const paths = resolvePaths(config)
  const date = localDate()
  const logPath = `${paths.logDir}/${date}.json`
  const notes: string[] = []
  const result: OrganizeResult = {
    ok: false, date, sessionsScanned: 0, factsCreated: [], factsVersioned: [],
    candidatesAdded: 0, briefUpdated: false, logPath, notes,
  }

  await ensureDirs(paths)
  const [facts, candidates, brief, seen] = await Promise.all([
    readFacts(paths).catch(() => []),
    readCandidates(paths).catch(() => []),
    readBrief(paths).catch(() => undefined),
    readSeenSessions(paths).catch(() => []),
  ])

  // ---- 0. 存量归并：先把已经分裂的同义候选收拢（只标 merged，不删） ----
  const mergedDupes = mergeDuplicateCandidates(candidates, date)
  if (mergedDupes > 0) notes.push(`合并了 ${mergedDupes} 条同义重复候选（标 merged 保留，计数已并入）`)

  // ---- 1. 扫会话 ----
  const scanLimit = Math.max(1, Math.min(config.scan_sessions ?? 12, 40))
  // 三个都要跳过：调用方给的会话（通常是触发整理的这场）、配置的整理会话、默认名。
  // 按 id 判定而不是按消息文本——文本是用户/模型可控的，改个措辞就绕过了。
  const skipIds = new Set(
    [options.skipSessionId?.trim(), config.organizer_session?.trim(), 'memory-organizer']
      .filter((value): value is string => typeof value === 'string' && value !== ''),
  )
  const digests: Array<{ id: string; text: string }> = []
  const seenNow: string[] = []
  if (sessionQuery !== undefined) {
    try {
      const records = await listRecentSessions(sessionQuery, { days: 2, limit: scanLimit, ...(signal ? { signal } : {}) })
      for (const record of records) {
        if (skipIds.has(record.header.id)) continue
        if (record.header.origin === 'subagent') continue
        const digest = await digestSession(sessionQuery, record.header.id, signal ? { signal } : {})
        if (digest === undefined) continue
        digests.push({ id: digest.id, text: digest.lines.join('\n') })
        seenNow.push(digest.id)
      }
    } catch (error: unknown) {
      notes.push(`会话扫描失败（继续整理已有记忆）：${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    notes.push('宿主未提供 sessionQuery 服务：本次整理只看 L2 候选，不扫会话')
  }
  result.sessionsScanned = digests.length

  // ---- 2. 走 broker 归纳 ----
  const pendingCandidates = candidates.filter(item => item.status === 'pending')
  const fitted = fitDigests(digests, MAX_DIGEST_CHARS)
  if (fitted.truncatedChars > 0) {
    notes.push(`会话内容较长（${fitted.originalChars} 字），已截断 ${fitted.truncatedChars} 字后再喂模型`)
  }
  const prompt = buildPrompt({
    date,
    facts: facts.map(item => ({ id: item.id, fact: item.fact, value: item.history.at(-1)?.value ?? '', since: item.since })),
    candidates: pendingCandidates.map(item => ({ fact: item.fact, count: item.count })),
    digests: fitted.digests,
    brief: brief ?? '',
  })
  let output: OrganizerOutput
  try {
    output = await callOrganizer(llm, prompt, signal)
  } catch (error: unknown) {
    // 上游偶发（空 content / 超时）重试一次；仍失败才放弃 —— 宁可不写，不编造。
    try {
      output = await callOrganizer(llm, prompt, signal)
    } catch (retryError: unknown) {
      const message = retryError instanceof Error ? retryError.message : String(retryError)
      result.error = message
      await appendLog(paths, date, {
        action: 'organize', ok: false, error: message,
        sessions_scanned: result.sessionsScanned,
        note: '整理失败（已重试一次）：未写入任何事实/摘要（只追加铁律与"不编造"原则）',
      })
      return result
    }
  }

  // ---- 3. 只追加地落地 ----
  const createdIds: string[] = []
  const versionedIds: string[] = []
  for (const proposal of output.facts.slice(0, MAX_FACT_OPS)) {
    if (!proposal.fact || !proposal.value) continue
    const upserted = upsertFact(facts, {
      ...(proposal.id ? { id: proposal.id } : {}),
      fact: proposal.fact,
      value: proposal.value,
      date,
      source: proposal.source,
      tags: proposal.tags,
      ...(proposal.note ? { note: proposal.note } : {}),
    })
    if (upserted.action === 'created') createdIds.push(upserted.fact.id)
    else if (upserted.action === 'versioned') versionedIds.push(upserted.fact.id)
  }

  let candidatesAdded = 0
  for (const proposal of output.candidates.slice(0, MAX_CANDIDATE_OPS)) {
    if (!proposal.fact) continue
    const before = candidates.length
    const record = addCandidate(candidates, { fact: proposal.fact, date, source: proposal.source, tags: proposal.tags })
    if (record.count === 1 && candidates.length > before) candidatesAdded += 1
  }

  let briefUpdated = false
  if (!dryRun) {
    if (createdIds.length > 0 || versionedIds.length > 0) await writeFacts(paths, facts)
    // 归并也是改动：哪怕这次没新增候选，只要归并过就要写回
    if (output.candidates.length > 0 || mergedDupes > 0) await writeCandidates(paths, candidates)
    const briefBody = output.brief?.trim()
    if (briefBody !== undefined && briefBody !== '') {
      const next = composeBrief(date, briefBody)
      if (next !== brief) {
        if (brief !== undefined) await archiveBrief(paths, date, brief)
        await writeBrief(paths, next)
        briefUpdated = true
      }
    }
    await writeSeenSessions(paths, [...seen, ...seenNow])
    const used = describeModel(llm)
    await appendLog(paths, date, {
      action: 'organize', ok: true,
      model: used,
      sessions_scanned: result.sessionsScanned,
      sessions: seenNow,
      facts: [
        ...createdIds.map(id => ({ id, op: 'created' })),
        ...versionedIds.map(id => ({ id, op: 'versioned' })),
      ],
      candidates_added: candidatesAdded,
      brief_updated: briefUpdated,
      summary: output.summary ?? '',
    })

    // ---- 分片 ----
    //
    // **已有分片时绝不全量重排**：重排会让模型每次给新片名，旧分片留 0 条空壳、
    // 布局来回漂（2026-10-25 实测：sampling-verify → checks → verify，三次整理改两次名）。
    // 所以分三种情况：
    //   1. 还没有分片、事实超过阈值 → 首次规划（问模型一次）
    //   2. 已有分片 → **纯代码增量归属**，新事实按标签进现有分片，进不去就 unsorted；
    //      unsorted 攒多了才问一次模型"给这批新事实分片，优先复用现有片名"
    //   3. 显式 reshard → 才全量重排
    const threshold = config.shard_threshold ?? 80
    const shardEnabled = config.enable_shard !== false && threshold > 0
    if (shardEnabled) {
      try {
        const existing = await listShardFiles(paths)
        const needInitialPlan = existing.length === 0 && facts.length > threshold
        const needReshard = options.forceReshard === true && existing.length > 0
        let index
        if (needReshard) {
          index = await writeShardGroups(paths, await planShards(llm, facts, signal, existing), existing)
          notes.push(`已重排分片（手动触发）`)
        } else if (needInitialPlan) {
          index = await writeShardGroups(paths, await planShards(llm, facts, signal), [])
          notes.push(`已首次分片`)
        } else if (existing.length > 0) {
          index = await placeNewFacts(paths, facts, existing, llm, signal)
        }
        if (index !== undefined) {
          result.shards = index.shards.map(entry => ({ name: entry.name, count: entry.count }))
          notes.push(`分片：${index.shards.length} 个文件 / ${index.total} 条事实（索引 ${paths.shardIndex}）`)
          await appendLog(paths, date, {
            action: 'shard', ok: true,
            mode: needReshard ? 'reshard' : needInitialPlan ? 'initial' : 'incremental',
            shards: index.shards.map(entry => ({ name: entry.name, count: entry.count })),
            total: index.total,
          })
        }
      } catch (error: unknown) {
        // 分片失败不影响已写入的事实：原有布局照旧可用
        notes.push(`分片未执行（事实不受影响）：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else {
    notes.push('dry_run：不落盘')
    briefUpdated = output.brief !== undefined && output.brief.trim() !== ''
  }

  result.ok = true
  result.factsCreated = createdIds
  result.factsVersioned = versionedIds
  result.candidatesAdded = candidatesAdded
  result.briefUpdated = briefUpdated
  result.summary = output.summary
  return result
}

/**
 * 增量归属：**只给新事实找位置，已有分片一条都不动。**
 *
 * 顺序：先按标签归入现有分片 → 归不进去的进 `unsorted` →
 * 只有当这批新事实多到 unsorted 该独立成片时，才问一次模型（且要求复用现有片名）。
 *
 * 这样日常整理**零额外模型调用**，片名也不会被模型一轮轮改掉。
 */
async function placeNewFacts(
  paths: ReturnType<typeof resolvePaths>,
  facts: readonly FactRecord[],
  existingNames: readonly string[],
  llm: OrganizerModel,
  signal?: AbortSignal,
) {
  const layout = await readShardLayout(paths) ?? new Map<string, string>()
  const index = await readShardIndex(paths)
  const tagsOf = new Map((index?.shards ?? []).map(entry => [entry.name, entry.tags]))

  const groups = new Map<string, FactRecord[]>()
  for (const name of existingNames) groups.set(name, [])
  const push = (shard: string, fact: FactRecord): void => {
    const list = groups.get(shard)
    if (list === undefined) groups.set(shard, [fact])
    else list.push(fact)
  }

  const newcomers: FactRecord[] = []
  for (const fact of facts) {
    const home = layout.get(fact.id)
    if (home !== undefined) push(home, fact)
    else newcomers.push(fact)
  }

  const unplaced: FactRecord[] = []
  for (const fact of newcomers) {
    const match = existingNames.find(name => {
      const tags = tagsOf.get(name) ?? []
      return fact.tags.length > 0 && fact.tags.some(tag => tags.includes(tag))
    })
    if (match !== undefined) push(match, fact)
    else unplaced.push(fact)
  }

  // 一大批新事实同时进来（如首次导入、批量补录）才值得再问一次模型
  if (unplaced.length > UNSORTED_KEEP && unplaced.length < facts.length) {
    try {
      const plan = await planShards(llm, unplaced, signal, existingNames)
      for (const [shard, members] of plan) for (const fact of members) push(shard, fact)
      unplaced.length = 0
    } catch {
      /* 问不动就照旧进 unsorted——绝不丢数据 */
    }
  }
  for (const fact of unplaced) push(UNSORTED_SHARD, fact)

  return writeShardGroups(paths, groups, existingNames)
}

/** 日志里记下这次到底用的哪个模型（结论能不能比对，全靠这一行）。 */
export function describeModel(llm: OrganizerModel): string {
  try {
    const selection = resolveSelection(llm)
    return `${selection.provider}/${selection.model}`
  } catch {
    return 'unknown'
  }
}

/** 调一次整理模型并解析输出。 */
async function callOrganizer(llm: OrganizerModel, prompt: string, signal?: AbortSignal): Promise<OrganizerOutput> {
  const raw = await chat(llm, [{ role: 'user', content: prompt } satisfies ChatMessage], signal)
  return parseOrganizerOutput(raw)
}

/**
 * 分片方案：模型只提"哪些事实放一起"，落盘分组**由代码裁定**。
 *
 *   - 编造的 id      → 丢弃
 *   - 重复分配       → 先到先得，后面的忽略
 *   - 没分到的 id    → 全部进 unsorted（一条都不许丢）
 *   - 片数超上限     → 溢出的合并进 unsorted
 */
async function planShards(
  llm: OrganizerModel,
  facts: readonly FactRecord[],
  signal?: AbortSignal,
  existingNames: readonly string[] = [],
): Promise<Map<string, FactRecord[]>> {
  const byId = new Map(facts.map(fact => [fact.id, fact]))
  const groups = new Map<string, FactRecord[]>()
  const assigned = new Set<string>()
  if (existingNames.length > 0) {
    // 已经有分片了：预先占位，模型只能往这些名字里放或新开——避免已有片被"改名换代"
    for (const name of existingNames) groups.set(safeShardName(name), [])
  }
  const put = (name: string, fact: FactRecord): void => {
    const shard = safeShardName(name)
    const list = groups.get(shard)
    if (list === undefined) groups.set(shard, [fact])
    else list.push(fact)
    assigned.add(fact.id)
  }

  if (facts.length > 0) {
    const list = facts.map(fact => `- ${fact.id} · ${fact.fact}`).join('\n')
    const reuseBlock = existingNames.length === 0
      ? ''
      : `

## 现有分片（**优先复用这些名字**）
${existingNames.map(name => `- ${name}`).join('\n')}

⚠️ 除非某条事实与所有现有分片都无关，否则**不要新起片名**。片名一改，旧分片就废了。`
    const prompt = `你在给一份长期记忆库做"分片归档"。事实已经有全局唯一 id，分片只是**存放位置**，不改变任何内容。

## 全部事实（id · 主题）
${list}${reuseBlock}

## 要求
1. 把主题相近的分到同一片，每片 15~30 条左右，总共不超过 ${MAX_SHARDS} 片。
2. 片名用简短小写英文或拼音，只允许 a-z 0-9 -，≤32 字符（例：config、project-dsh、people、finance）。
3. **每条 id 必须且只能出现在一个分组里**：不要漏、不要重复、不要编造 id。
4. 只输出 JSON，不要解释。

## 输出格式
{"groups": {"config": ["mem-...", "mem-..."], "people": ["mem-..."]}}`
    const raw = await chat(llm, [{ role: 'user', content: prompt } satisfies ChatMessage], signal)
    const parsed = extractJsonObject(raw)
    const rawGroups = parsed?.groups
    if (rawGroups === null || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) {
      throw new Error(`分片模型输出不合格式（前 200 字：${raw.slice(0, 200)}）`)
    }
    for (const [name, ids] of Object.entries(rawGroups as Record<string, unknown>)) {
      if (!Array.isArray(ids)) continue
      for (const id of ids) {
        if (typeof id !== 'string') continue
        const fact = byId.get(id.trim())
        if (fact === undefined || assigned.has(fact.id)) continue
        if (groups.size >= MAX_SHARDS && !groups.has(safeShardName(name))) continue
        put(name, fact)
      }
    }
    if (assigned.size === 0) throw new Error('分片模型没有返回任何可用 id')
  }

  // 兜底：没分到的、超出上限的，全进 unsorted
  for (const fact of facts) if (!assigned.has(fact.id)) put(UNSORTED_SHARD, fact)
  return groups
}

function buildPrompt(input: {
  date: string
  facts: Array<{ id: string; fact: string; value: string; since: string }>
  candidates: Array<{ fact: string; count: number }>
  digests: Array<{ id: string; text: string }>
  brief: string
}): string {
  const factsBlock = input.facts.length === 0
    ? '（空）'
    : input.facts.map(item => `- [${item.id}] ${item.fact} = ${item.value}（since ${item.since}）`).join('\n')
  const candidatesBlock = input.candidates.length === 0
    ? '（空）'
    : input.candidates.map(item => `- [已出现 ${item.count} 次] ${item.fact}`).join('\n')
  const sessionsBlock = input.digests.length === 0
    ? '（今天没有可扫描的会话）'
    : input.digests.map(item => `### 会话 ${item.id}\n${item.text}`).join('\n\n')
  const briefBlock = input.brief.trim() === '' ? '（还没有摘要）' : input.brief.trim()

  return `你是"记忆整理器"。今天是 ${input.date}。你要从今天的会话里提炼**稳定、以后还用得上**的事实与进展，输出严格 JSON。

## 现有 L3 事实（版本化，只能追加新版本，不能改写历史）
${factsBlock}

## 现有 L2 待升格候选
${candidatesBlock}

## 当前 L4 启动摘要
${briefBlock}

## 今天的会话摘录
${sessionsBlock}

## 禁止收录（先看这条）
以下内容**一律不许**写进 facts 或 candidates，也不许写进 brief 的"当前在做什么"：
- 工具调用过程、你自己（整理器）本次做了什么、整理统计（扫了几场会话、提炼了几条）
- dry-run / 演练 / 测试数据 / 调试时的中间值
- 绝对路径、主机名、端口号、IP —— **除非用户明确要求长期记住某个地址**
- 本记忆系统自身的文件名与目录（facts.yaml / brief.md / memory 目录 / 分片名等）
- 一天内就会变的状态（"今天在做什么"、"刚跑了什么命令"）

判据：**这条东西半年后还成立吗？换个环境还成立吗？** 两个都否 → 不收。

## 任务
1. facts：只收录**长期有效的稳定事实**（用户偏好/配置/约定/项目状态/重要结论）。规则：
   - **先查上面的候选列表**：如果这件事已经在 L2 候选里（哪怕是换个措辞），说明它还没定论，
     **不要**同时再写成 L3 事实——同一件事在候选区和事实区各存一份，等于把它升格了两次。
     要么只留候选、要么明确把它升格（这时才写 facts）。
   - **尊重会话里的层级指令**：会话里用户明说「先放候选」「别记成事实」「还不确定」，
     就只进 candidates，不进 facts。用户说了算，判断"它其实很稳定"也不行。
   - 与现有事实同主题但值变了 → 给 \`"id"\` 表示给该条追加新版本（保留旧版）；
   - 全新事实 → 不给 id，我会自动编号；
   - 与现有事实**值相同** → 不要输出（我会判重）；
   - 拿不准是否长期有效 → 放进 candidates 而不是 facts。
2. candidates：值得跟踪但还没定论的线索（反复出现的话题、待办倾向、可能成为事实的苗头）。规则：
   - **先看上面"现有 L2 待升格候选"列表**。如果新线索与其中某条**语义重复**（同一件事换个说法），
     必须**原样照抄那一条的文本**，一个字都不要改写——改写会被存成新的一条，同一条待办就会分裂成好几份。
   - 输出时 **fact 字段只放线索正文本身**。不要加「已出现 N 次」这类计数标注，
     也不要在末尾补「（待定）」「（待跟进）」等状态注释——那些是列表的格式，不是线索的一部分。
   - 只有确实是新线索，才写新文本。
3. brief：更新后的 L4 启动摘要（中文 Markdown，≤120 行）：当前在做什么/关键事实/进度/下一步。
   - **不许把"我在整理记忆"写进"当前在做什么"**——那是你此刻的动作，不是用户的进度。
   - 没有实质变化就原样返回旧摘要。
4. summary：一句话说明本次整理做了什么。

## 输出格式（只输出 JSON，不要解释）
{
  "facts": [{ "id": "可选，已有事实的 id", "fact": "主题（短）", "value": "当前值", "source": ["会话id"], "tags": ["标签"], "note": "可选，为什么" }],
  "candidates": [{ "fact": "线索", "source": ["会话id"], "tags": [] }],
  "brief": "# Markdown 摘要正文",
  "summary": "一句话"
}`
}

/** 解析模型输出；非法输出抛错（宁可不写）。 */
export function parseOrganizerOutput(raw: string): OrganizerOutput {
  const parsed = extractJsonObject(raw)
  if (parsed === undefined) {
    throw new Error(`dsh-memory: 整理模型输出不是可解析的 JSON（前 200 字：${raw.slice(0, 200)}）`)
  }
  const facts: FactProposal[] = []
  const rawFacts = parsed.facts
  if (Array.isArray(rawFacts)) {
    for (const item of rawFacts) {
      if (item === null || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const fact = typeof record.fact === 'string' ? record.fact.trim() : ''
      const value = typeof record.value === 'string' ? record.value.trim() : ''
      if (fact === '' || value === '') continue
      facts.push({
        ...(typeof record.id === 'string' && record.id.trim() !== '' ? { id: record.id.trim() } : {}),
        fact,
        value,
        source: stringArray(record.source),
        tags: stringArray(record.tags),
        ...(typeof record.note === 'string' && record.note.trim() !== '' ? { note: record.note.trim() } : {}),
      })
    }
  }
  const candidates: CandidateProposal[] = []
  const rawCandidates = parsed.candidates
  if (Array.isArray(rawCandidates)) {
    for (const item of rawCandidates) {
      if (item === null || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const fact = typeof record.fact === 'string' ? record.fact.trim() : ''
      if (fact === '') continue
      candidates.push({ fact, source: stringArray(record.source), tags: stringArray(record.tags) })
    }
  }
  return {
    facts,
    candidates,
    ...(typeof parsed.brief === 'string' ? { brief: parsed.brief } : {}),
    ...(typeof parsed.summary === 'string' ? { summary: parsed.summary } : {}),
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
}
