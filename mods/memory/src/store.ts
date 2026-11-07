/**
 * 存储层 —— `$DSH_HOME/memory/`：
 *
 *   brief.md            L4 启动摘要（人可读 Markdown）
 *   facts.yaml          L3 永久事实（版本化，只追加 history）
 *   candidates.yaml     L2 待升格候选
 *   log/YYYY-MM-DD.json 夜间整理记录（append-only NDJSON 日记）
 *   .sessions.json      已内部化处理的会话 id（避免重复归纳）
 *
 * 铁律：**只追加不删** —— 本文件没有任何删除/覆盖历史条目的路径。
 * 唯一允许“覆盖”的是 brief.md 与 candidates.yaml 的当前态（二者可由 facts + 会话重建，
 * 且候选被升格/驳回时带 `status` 标记保留在文件里，不物理删除）。
 */
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseYaml, toYaml, type YamlValue } from './yaml.ts'
import type { MemoryConfig } from './config.ts'

export interface FactVersion {
  date: string
  value: string
  note?: string
}

export interface FactRecord {
  id: string
  fact: string
  since: string
  history: FactVersion[]
  source: string[]
  tags: string[]
  updated_at: string
}

export interface CandidateRecord {
  id: string
  fact: string
  first_seen: string
  last_seen: string
  count: number
  source: string[]
  tags: string[]
  /** merged = 被存量归并吃掉了（记录保留、计数与来源已并入保留者，不删）。 */
  status: 'pending' | 'promoted' | 'rejected' | 'merged'
  note?: string
}

export interface MemoryPaths {
  root: string
  brief: string
  facts: string
  candidates: string
  logDir: string
  seen: string
  /** 分片目录（`facts/`）；存在且含 .yaml 时启用分片布局。 */
  factsDir: string
  /** 分片索引（`facts/_index.yaml`）——**是缓存不是真相**，读不到就从分片文件重建。 */
  shardIndex: string
}

/** DSH_HOME 解析：配置 > `$DSH_HOME` > `~/.dsh`（与 dsh-home-paths 同一优先级）。 */
export function resolveDshHome(configured?: string): string {
  const configuredText = configured?.trim()
  if (configuredText) return configuredText
  const envText = process.env.DSH_HOME?.trim()
  if (envText) return envText
  return join(homedir(), '.dsh')
}

export function resolvePaths(config: MemoryConfig): MemoryPaths {
  const root = config.memory_dir?.trim() || join(resolveDshHome(), 'memory')
  const factsDir = join(root, 'facts')
  return {
    root,
    brief: join(root, 'brief.md'),
    facts: join(root, 'facts.yaml'),
    candidates: join(root, 'candidates.yaml'),
    logDir: join(root, 'log'),
    seen: join(root, '.sessions.json'),
    factsDir,
    shardIndex: join(factsDir, '_index.yaml'),
  }
}

export async function ensureDirs(paths: MemoryPaths): Promise<void> {
  await mkdir(paths.logDir, { recursive: true })
}

/** 原子写：临时文件 + rename；失败不留下半写文件。 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, path)
}

export async function readTextIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

// ---------- 事实（L3） ----------

const FACTS_HEADER = [
  'dsh-memory · L3 永久事实（版本化，只追加）',
  '由 memory_note / memory_promote / 夜间整理维护；history 是版本链，最新一条 = 当前值。',
  '请勿手写覆盖历史条目 —— 修改事实请用 memory_note（自动追加新版本）。',
]

/** 读单个事实文件（分片或旧单文件走同一条路径）。 */
async function readFactsFile(path: string): Promise<FactRecord[]> {
  const text = await readTextIfExists(path)
  if (text === undefined || text.trim() === '') return []
  const parsed = parseYaml(text)
  if (parsed === null) return []
  if (!Array.isArray(parsed)) throw new Error(`dsh-memory: ${path} 顶层应为数组（受限 YAML）`)
  return parsed.filter(isRecord).map(coerceFact)
}

export const SHARD_INDEX_FILE = '_index.yaml'
export const UNSORTED_SHARD = 'unsorted'

/** 分片名白名单：小写字母/数字/短横线，≤32 字符。不合规的名一律回落 unsorted。 */
export function safeShardName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  return normalized === '' ? UNSORTED_SHARD : normalized
}

/** 列出已有分片文件名（不含扩展名、不含索引）。没有分片目录时返回空数组。 */
export async function listShardFiles(paths: MemoryPaths): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(paths.factsDir)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return entries
    .filter(name => name.endsWith('.yaml') && name !== SHARD_INDEX_FILE)
    .map(name => name.slice(0, -'.yaml'.length))
    .sort()
}

export interface ShardEntry {
  name: string
  count: number
  updated_at: string
  tags: string[]
  keywords: string[]
}

export interface ShardIndex {
  shards: ShardEntry[]
  total: number
  updated_at: string
}

/** 读 L3 事实：有分片就读分片（合并），否则读旧的单文件 `facts.yaml`。 */
export async function readFacts(paths: MemoryPaths): Promise<FactRecord[]> {
  const shardNames = await listShardFiles(paths)
  if (shardNames.length === 0) return readFactsFile(paths.facts)
  const all: FactRecord[] = []
  for (const name of shardNames) all.push(...await readFactsFile(join(paths.factsDir, `${name}.yaml`)))
  return all
}

/** 事实 id → 所在分片；无分片布局时返回 undefined。 */
export async function readShardLayout(paths: MemoryPaths): Promise<Map<string, string> | undefined> {
  const shardNames = await listShardFiles(paths)
  if (shardNames.length === 0) return undefined
  const layout = new Map<string, string>()
  for (const name of shardNames) {
    for (const fact of await readFactsFile(join(paths.factsDir, `${name}.yaml`))) layout.set(fact.id, name)
  }
  return layout
}

function isRecord(value: unknown): value is { [key: string]: YamlValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function coerceFact(raw: Record<string, unknown>): FactRecord {
  const history: FactVersion[] = Array.isArray(raw.history)
    ? raw.history.filter(isRecord).map(entry => ({
        date: asString(entry.date),
        value: asString(entry.value),
        ...(typeof entry.note === 'string' && entry.note ? { note: entry.note } : {}),
      })).filter(entry => entry.value !== '')
    : []
  const latest = history.at(-1)
  return {
    id: asString(raw.id),
    fact: asString(raw.fact),
    since: asString(raw.since, latest?.date ?? ''),
    history,
    source: asStringArray(raw.source),
    tags: asStringArray(raw.tags),
    updated_at: asString(raw.updated_at, latest?.date ?? ''),
  }
}

export function factToYaml(record: FactRecord): YamlValue {
  return {
    id: record.id,
    fact: record.fact,
    since: record.since,
    history: record.history.map(version => ({
      date: version.date,
      value: version.value,
      ...(version.note ? { note: version.note } : {}),
    })),
    source: record.source,
    tags: record.tags,
    updated_at: record.updated_at,
  }
}

/**
 * 写 L3 事实。
 *
 * 分片布局下按已有归属分组，**新事实进 unsorted**（下次整理再归档）；
 * 一律不删分片文件——变空的分片写成只剩表头的空文件，避免读到陈旧内容。
 */
export async function writeFacts(paths: MemoryPaths, facts: readonly FactRecord[]): Promise<void> {
  const shardNames = await listShardFiles(paths)
  if (shardNames.length === 0) {
    await writeFileAtomic(paths.facts, toYaml(facts.map(factToYaml), FACTS_HEADER))
    return
  }
  const layout = await readShardLayout(paths) ?? new Map<string, string>()
  const groups = new Map<string, FactRecord[]>()
  for (const fact of facts) {
    const shard = layout.get(fact.id) ?? UNSORTED_SHARD
    const list = groups.get(shard)
    if (list === undefined) groups.set(shard, [fact])
    else list.push(fact)
  }
  await writeShardGroups(paths, groups, shardNames)
}

// ---------- 分片（L3 事实多了以后按主题拆文件） ----------

const shardHeader = (name: string): string[] => [
  `dsh-memory · L3 永久事实分片「${name}」（版本化，只追加）`,
  '分片只是存放位置，不是事实身份——id 全局唯一，跨分片不重复。',
  '请勿手写覆盖历史条目 —— 修改事实请用 memory_note（自动追加新版本）。',
]

const SHARD_INDEX_HEADER = [
  'dsh-memory · 分片索引（缓存，可从分片文件重建；删掉索引不会丢任何事实）',
  'shards[].keywords 只用于检索时挑分片，不是事实内容。',
]

export function localDate(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function shardTags(list: readonly FactRecord[]): string[] {
  const out: string[] = []
  for (const fact of list) for (const tag of fact.tags) if (!out.includes(tag)) out.push(tag)
  return out.slice(0, 20)
}

/** 从事实主题里取几个词当分片关键词；只影响"要不要读这个分片"，漏了不影响正确性。 */
function shardKeywords(list: readonly FactRecord[], limit = 12): string[] {
  const out: string[] = []
  for (const fact of list) {
    for (const word of fact.fact.split(/[\s,，、;；:：()（）[\]/|]+/)) {
      const trimmed = word.trim()
      if (trimmed.length < 2 || out.includes(trimmed)) continue
      out.push(trimmed)
      if (out.length >= limit) return out
    }
  }
  return out
}

function buildShardEntry(name: string, list: readonly FactRecord[], date: string): ShardEntry {
  return {
    name,
    count: list.length,
    updated_at: list.map(fact => fact.updated_at).filter(Boolean).sort().at(-1) || date,
    tags: shardTags(list),
    keywords: shardKeywords(list),
  }
}

function indexToYaml(index: ShardIndex): YamlValue {
  return {
    updated_at: index.updated_at,
    total: index.total,
    shards: index.shards.map(entry => ({
      name: entry.name,
      count: entry.count,
      updated_at: entry.updated_at,
      tags: entry.tags,
      keywords: entry.keywords,
    })),
  }
}

/** 读分片索引；读不到/格式不对都返回 undefined（调用方回落"全读"）。 */
export async function readShardIndex(paths: MemoryPaths): Promise<ShardIndex | undefined> {
  const text = await readTextIfExists(paths.shardIndex)
  if (text === undefined || text.trim() === '') return undefined
  const parsed = parseYaml(text)
  if (parsed === null || !isRecord(parsed)) return undefined
  const rawShards = parsed.shards
  if (!Array.isArray(rawShards)) return undefined
  const shards = rawShards.filter(isRecord).map((raw): ShardEntry => ({
    name: asString(raw.name),
    count: typeof raw.count === 'number' ? raw.count : 0,
    updated_at: asString(raw.updated_at),
    tags: asStringArray(raw.tags),
    keywords: asStringArray(raw.keywords),
  })).filter(entry => entry.name !== '')
  return {
    shards,
    total: typeof parsed.total === 'number' ? parsed.total : shards.reduce((sum, entry) => sum + entry.count, 0),
    updated_at: asString(parsed.updated_at),
  }
}

/**
 * 写分片 + 重建索引。
 *
 * `existingNames` 里的分片即使这次没有事实也会写一个只有表头的空文件——
 * 宁可留个空壳，也不要让旧的 .yaml 留在盘上被下次读到。
 */
export async function writeShardGroups(
  paths: MemoryPaths,
  groups: ReadonlyMap<string, readonly FactRecord[]>,
  existingNames: readonly string[] = [],
): Promise<ShardIndex> {
  const date = localDate()
  // 首次分片：把旧的单文件挪进 archive（移动不是删除，事实一条不少）
  if (existingNames.length === 0) await archiveLegacyFacts(paths, date)

  const names = [...new Set([...existingNames, ...groups.keys()])].sort()
  const shards: ShardEntry[] = []
  for (const name of names) {
    const list = groups.get(name) ?? []
    await writeFileAtomic(join(paths.factsDir, `${name}.yaml`), toYaml(list.map(factToYaml), shardHeader(name)))
    // 0 条的分片改名叫"空壳"：文件留着（不删）但**不进索引**——
    // 免得它参与检索挑选、还把尾注里的"跳过 N 个"数字带漂。
    if (list.length > 0) shards.push(buildShardEntry(name, list, date))
  }
  shards.sort((a, b) => {
    if (a.name === UNSORTED_SHARD) return 1
    if (b.name === UNSORTED_SHARD) return -1
    return a.name.localeCompare(b.name)
  })
  const index: ShardIndex = {
    shards,
    total: shards.reduce((sum, entry) => sum + entry.count, 0),
    updated_at: date,
  }
  await writeFileAtomic(paths.shardIndex, toYaml(indexToYaml(index), SHARD_INDEX_HEADER))
  return index
}

/** 旧的单文件挪进 `.archive/`，不删。 */
async function archiveLegacyFacts(paths: MemoryPaths, date: string): Promise<void> {
  try {
    await mkdir(join(paths.root, '.archive'), { recursive: true })
    await rename(paths.facts, join(paths.root, '.archive', `facts-${date}.yaml`))
  } catch (error: unknown) {
    // 没有旧文件（首次就是分片）或已被移走：忽略
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}

export interface ShardQueryResult {
  facts: FactRecord[]
  sharded: boolean
  /** 实际读了的分片；非分片布局为空。 */
  scanned: string[]
  /** 索引判定不必读而跳过的分片。 */
  skipped: string[]
}

/**
 * 按索引挑分片读事实。
 *
 * **索引只用来缩小范围，判不准就全读** —— 漏读是错，多读只是慢。
 */
export async function readFactsForQuery(
  paths: MemoryPaths,
  query: string,
  tags: readonly string[] = [],
): Promise<ShardQueryResult> {
  const shardNames = await listShardFiles(paths)
  if (shardNames.length === 0) {
    return { facts: await readFactsFile(paths.facts), sharded: false, scanned: [], skipped: [] }
  }
  const readAll = async (): Promise<FactRecord[]> => {
    const all: FactRecord[] = []
    for (const name of shardNames) all.push(...await readFactsFile(join(paths.factsDir, `${name}.yaml`)))
    return all
  }
  const index = await readShardIndex(paths)
  const wanted = tags.map(tag => tag.trim().toLowerCase()).filter(Boolean)
  const needle = query.trim().toLowerCase()
  if (index === undefined || (wanted.length === 0 && needle === '')) {
    return { facts: await readAll(), sharded: true, scanned: shardNames, skipped: [] }
  }
  const words = needle.split(/\s+/).filter(word => word !== '')
  const selected = index.shards.filter(entry => {
    if (wanted.length > 0 && entry.tags.some(tag => wanted.includes(tag.toLowerCase()))) return true
    if (words.length === 0) return false
    const haystack = [entry.name, ...entry.tags, ...entry.keywords].join(' ').toLowerCase()
    return words.some(word => haystack.includes(word))
  })
  // 一片都没挑中 → 判不准，全读（宁可慢，不许漏）
  const target = selected.length > 0 ? selected.map(entry => entry.name) : shardNames
  const facts: FactRecord[] = []
  for (const name of target) {
    const path = join(paths.factsDir, `${name}.yaml`)
    facts.push(...await readFactsFile(path))
  }
  return { facts, sharded: true, scanned: target, skipped: shardNames.filter(name => !target.includes(name)) }
}

let factCounter = 0

/** 派发新 id：`mem-<时间戳><序号>`（可读、稳定、不依赖随机数）。 */
export function nextFactId(now = new Date()): string {
  factCounter = (factCounter + 1) % 1000
  const pad = String(now.getTime()).padStart(13, '0')
  return `mem-${pad}-${String(factCounter).padStart(3, '0')}`
}

export interface UpsertResult {
  fact: FactRecord
  action: 'created' | 'versioned' | 'unchanged'
}

/**
 * 追加式写入：同 id 且最新版本值相同 → unchanged（不写）；
 * 值不同 → 追加 history 版本（旧的永不删）。找不到 id 时按 fact 文本匹配同名事实。
 */
export function upsertFact(
  facts: FactRecord[],
  input: { id?: string; fact: string; value: string; date: string; source?: string[]; tags?: string[]; note?: string },
): UpsertResult {
  const normalized = normalizeText(input.value)
  // 命中顺序：先按 id（同一事实的稳定身份），再按 fact 文本（去空白相等即同一主题）——
  // 二者都没有才是新事实。这样"改一条事实"永远落到同一条目上、只追加版本。
  let target: FactRecord | undefined
  if (input.id) target = facts.find(item => item.id === input.id)
  if (target === undefined) target = facts.find(item => normalizeText(item.fact) === normalizeText(input.fact))
  if (target === undefined) {
    const version: FactVersion = { date: input.date, value: input.value, ...(input.note ? { note: input.note } : {}) }
    const created: FactRecord = {
      id: input.id ?? nextFactId(),
      fact: input.fact,
      since: input.date,
      history: [version],
      source: input.source ?? [],
      tags: input.tags ?? [],
      updated_at: input.date,
    }
    facts.push(created)
    return { fact: created, action: 'created' }
  }
  const latest = target.history.at(-1)
  const sameValue = latest !== undefined && normalizeText(latest.value) === normalized
  if (sameValue) {
    // 值没变：只合并来源/标签（去重、只增不减），不算新版本
    target.source = mergeUnique(target.source, input.source ?? [])
    target.tags = mergeUnique(target.tags, input.tags ?? [])
    return { fact: target, action: 'unchanged' }
  }
  target.history.push({ date: input.date, value: input.value, ...(input.note ? { note: input.note } : {}) })
  target.source = mergeUnique(target.source, input.source ?? [])
  target.tags = mergeUnique(target.tags, input.tags ?? [])
  target.updated_at = input.date
  if (input.fact && input.fact !== target.fact) target.fact = input.fact
  return { fact: target, action: 'versioned' }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function mergeUnique(base: string[], added: string[]): string[] {
  const out = [...base]
  for (const item of added) if (!out.includes(item)) out.push(item)
  return out
}

// ---------- 候选（L2） ----------

const CANDIDATES_HEADER = [
  'dsh-memory · L2 待升格候选（只追加，升格/驳回/归并只改 status 不删除）',
  'status: pending 待确认 | promoted 已升格 | rejected 已驳回 | merged 已并入同义条目',
]

export async function readCandidates(paths: MemoryPaths): Promise<CandidateRecord[]> {
  const text = await readTextIfExists(paths.candidates)
  if (text === undefined || text.trim() === '') return []
  const parsed = parseYaml(text)
  if (parsed === null) return []
  if (!Array.isArray(parsed)) throw new Error('dsh-memory: candidates.yaml 顶层应为数组（受限 YAML）')
  return parsed.filter(isRecord).map((raw): CandidateRecord => {
    const statusText = asString(raw.status, 'pending')
    const status: CandidateRecord['status'] =
      statusText === 'promoted' || statusText === 'rejected' || statusText === 'merged' ? statusText : 'pending'
    return {
      id: asString(raw.id),
      fact: asString(raw.fact),
      first_seen: asString(raw.first_seen),
      last_seen: asString(raw.last_seen),
      count: typeof raw.count === 'number' ? raw.count : 1,
      source: asStringArray(raw.source),
      tags: asStringArray(raw.tags),
      status,
      ...(typeof raw.note === 'string' && raw.note ? { note: raw.note } : {}),
    }
  }).filter(item => item.id !== '' && item.fact !== '')
}

export function candidateToYaml(record: CandidateRecord): YamlValue {
  return {
    id: record.id,
    fact: record.fact,
    first_seen: record.first_seen,
    last_seen: record.last_seen,
    count: record.count,
    source: record.source,
    tags: record.tags,
    status: record.status,
    ...(record.note ? { note: record.note } : {}),
  }
}

/**
 * 存量归并：把**已经分裂**的同义 pending 候选收拢成一条。
 *
 * `candidateKey` 只在新增路径起作用，所以先分裂的存量会一直躺着——
 * 防增量不清存量等于半截工程（2026-10-25 实测：两条同义候选连跑 3 次整理没人管）。
 *
 * **只追加铁律**：多余的份不删，标 `merged` 并在 note 里记去向；
 * 计数/来源/标签并入保留的那条（最早出现的），所以信息一条不丢。
 *
 * @returns 实际归并掉几条（0 = 没有重复）
 */
export function mergeDuplicateCandidates(records: CandidateRecord[], date: string): number {
  const keep = new Map<string, CandidateRecord>()
  let merged = 0
  for (const record of records) {
    if (record.status !== 'pending') continue
    const key = candidateKey(record.fact)
    const head = keep.get(key)
    if (head === undefined) {
      keep.set(key, record)
      continue
    }
    head.count += record.count
    head.source = mergeUnique(head.source, record.source)
    head.tags = mergeUnique(head.tags, record.tags)
    if (record.first_seen !== '' && record.first_seen < head.first_seen) head.first_seen = record.first_seen
    if (record.last_seen > head.last_seen) head.last_seen = record.last_seen
    head.note = head.note ?? record.note
    head.last_seen = date > head.last_seen ? date : head.last_seen

    record.status = 'merged'
    record.count = 0
    record.note = `已并入 ${head.id}（同义归并 ${date}）`
    merged += 1
  }
  return merged
}

export async function writeCandidates(paths: MemoryPaths, records: readonly CandidateRecord[]): Promise<void> {
  await writeFileAtomic(paths.candidates, toYaml(records.map(candidateToYaml), CANDIDATES_HEADER))
}

let candidateCounter = 0

export function nextCandidateId(now = new Date()): string {
  candidateCounter = (candidateCounter + 1) % 1000
  return `cand-${String(now.getTime()).padStart(13, '0')}-${String(candidateCounter).padStart(3, '0')}`
}

/** 记录一条候选：同条目（fact 去空白后相同）重复出现 → count+1、刷新 last_seen。 */
/**
 * 候选文本的比对口径：归一化空白**再剥掉摘录腔尾巴**。
 *
 * 模型很爱把列表格式当正文抄下来——实测（2026-10-25）同一条待办被存成
 * 「…需在模型通道恢复后重试。」和「…需在模型通道恢复后重试。（出现 1 次）」两条。
 * prompt 里写了"原样照抄"也拦不住，所以这里做最后一道兜底。
 *
 * 只剥**明确的元信息后缀**，不做模糊匹配：宁可偶尔多存一条，不能误合并丢线索。
 */
export function candidateKey(value: string): string {
  return normalizeText(
    value
      .replace(/\s*[（(]\s*出现\s*\d+\s*次\s*[）)]\s*$/u, '')
      .replace(/\s*[（(]\s*appears?\s+\d+\s+times?\s*[）)]\s*$/iu, ''),
  )
}

export function addCandidate(
  records: CandidateRecord[],
  input: { fact: string; date: string; source?: string[]; tags?: string[]; note?: string },
): CandidateRecord {
  const normalized = candidateKey(input.fact)
  const existing = records.find(item => candidateKey(item.fact) === normalized)
  if (existing !== undefined) {
    existing.count += 1
    existing.last_seen = input.date
    existing.source = mergeUnique(existing.source, input.source ?? [])
    existing.tags = mergeUnique(existing.tags, input.tags ?? [])
    if (input.note) existing.note = input.note
    return existing
  }
  const created: CandidateRecord = {
    id: nextCandidateId(),
    fact: input.fact,
    first_seen: input.date,
    last_seen: input.date,
    count: 1,
    source: input.source ?? [],
    tags: input.tags ?? [],
    status: 'pending',
    ...(input.note ? { note: input.note } : {}),
  }
  records.push(created)
  return created
}

// ---------- 摘要（L4） ----------

const BRIEF_HEADER = [
  'dsh-memory · L4 启动摘要（O(1) 读；丢了可由 facts.yaml + 会话重建）',
  '由夜间整理 / memory_organize 更新。',
]

/**
 * 最近一次已知的简报正文（同步读）。
 *
 * system prompt 的 `context()` 提供者**只能同步**，所以这里缓存一份：
 * 读盘时刷新、写盘时也刷新。缓存没热起来时返回 undefined，下一轮装配就有值了。
 */
let briefCache: string | undefined

export function cachedBrief(): string | undefined {
  return briefCache
}

export async function readBrief(paths: MemoryPaths): Promise<string | undefined> {
  const text = await readTextIfExists(paths.brief)
  const value = text === undefined || text.trim() === '' ? undefined : text
  briefCache = value
  return value
}

/** 生成新的摘要正文（当前态）。旧版由 archiveBrief() 归档到 log/，内容不丢。 */
export function composeBrief(today: string, body: string): string {
  const lines: string[] = [
    ...BRIEF_HEADER.map(line => `<!-- ${line} -->`),
    '',
    `<!-- 摘要更新于 ${today} -->`,
    '',
    body.trim(),
    '',
  ]
  return lines.join('\n')
}

/** 归档旧摘要到 log/brief-<日期>.md（只追加不删：旧内容以文件形式保留）。 */
export async function archiveBrief(paths: MemoryPaths, date: string, previous: string): Promise<string> {
  await ensureDirs(paths)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(paths.logDir, `brief-${date}-${stamp}.md`)
  await writeFileAtomic(path, previous)
  return path
}

export async function writeBrief(paths: MemoryPaths, content: string): Promise<void> {
  await writeFileAtomic(paths.brief, content)
  briefCache = content
}

// ---------- 整理日志（append-only NDJSON） ----------

export async function appendLog(paths: MemoryPaths, date: string, entry: Record<string, YamlValue | undefined>): Promise<void> {
  await ensureDirs(paths)
  const path = join(paths.logDir, `${date}.json`)
  const line = JSON.stringify({ time: new Date().toISOString(), ...dropUndefined(entry) })
  const existing = (await readTextIfExists(path)) ?? ''
  await writeFileAtomic(path, `${existing}${line}\n`)
}

function dropUndefined(input: Record<string, YamlValue | undefined>): Record<string, YamlValue> {
  const out: Record<string, YamlValue> = {}
  for (const [key, value] of Object.entries(input)) if (value !== undefined) out[key] = value
  return out
}

export async function readLog(paths: MemoryPaths, date: string): Promise<Array<Record<string, YamlValue>>> {
  const text = await readTextIfExists(join(paths.logDir, `${date}.json`))
  if (text === undefined) return []
  const out: Array<Record<string, YamlValue>> = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (isRecord(parsed)) out.push(parsed as Record<string, YamlValue>)
    } catch {
      /* 坏行跳过（只读路径不修文件） */
    }
  }
  return out
}

// ---------- 已处理会话台账 ----------

export async function readSeenSessions(paths: MemoryPaths): Promise<string[]> {
  const text = await readTextIfExists(paths.seen)
  if (text === undefined) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (isRecord(parsed) && Array.isArray(parsed.ids)) {
      return parsed.ids.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    /* 损坏就当作空台账（下次整理重新记账；不会删任何记忆内容） */
  }
  return []
}

export async function writeSeenSessions(paths: MemoryPaths, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)]
  await writeFileAtomic(paths.seen, `${JSON.stringify({ ids: unique.slice(-500) }, null, 2)}\n`)
}
