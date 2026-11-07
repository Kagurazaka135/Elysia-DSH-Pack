import { type YamlValue } from './yaml.ts';
import type { MemoryConfig } from './config.ts';
export interface FactVersion {
    date: string;
    value: string;
    note?: string;
}
export interface FactRecord {
    id: string;
    fact: string;
    since: string;
    history: FactVersion[];
    source: string[];
    tags: string[];
    updated_at: string;
}
export interface CandidateRecord {
    id: string;
    fact: string;
    first_seen: string;
    last_seen: string;
    count: number;
    source: string[];
    tags: string[];
    /** merged = 被存量归并吃掉了（记录保留、计数与来源已并入保留者，不删）。 */
    status: 'pending' | 'promoted' | 'rejected' | 'merged';
    note?: string;
}
export interface MemoryPaths {
    root: string;
    brief: string;
    facts: string;
    candidates: string;
    logDir: string;
    seen: string;
    /** 分片目录（`facts/`）；存在且含 .yaml 时启用分片布局。 */
    factsDir: string;
    /** 分片索引（`facts/_index.yaml`）——**是缓存不是真相**，读不到就从分片文件重建。 */
    shardIndex: string;
}
/** DSH_HOME 解析：配置 > `$DSH_HOME` > `~/.dsh`（与 dsh-home-paths 同一优先级）。 */
export declare function resolveDshHome(configured?: string): string;
export declare function resolvePaths(config: MemoryConfig): MemoryPaths;
export declare function ensureDirs(paths: MemoryPaths): Promise<void>;
/** 原子写：临时文件 + rename；失败不留下半写文件。 */
export declare function writeFileAtomic(path: string, content: string): Promise<void>;
export declare function readTextIfExists(path: string): Promise<string | undefined>;
export declare const SHARD_INDEX_FILE = "_index.yaml";
export declare const UNSORTED_SHARD = "unsorted";
/** 分片名白名单：小写字母/数字/短横线，≤32 字符。不合规的名一律回落 unsorted。 */
export declare function safeShardName(value: string): string;
/** 列出已有分片文件名（不含扩展名、不含索引）。没有分片目录时返回空数组。 */
export declare function listShardFiles(paths: MemoryPaths): Promise<string[]>;
export interface ShardEntry {
    name: string;
    count: number;
    updated_at: string;
    tags: string[];
    keywords: string[];
}
export interface ShardIndex {
    shards: ShardEntry[];
    total: number;
    updated_at: string;
}
/** 读 L3 事实：有分片就读分片（合并），否则读旧的单文件 `facts.yaml`。 */
export declare function readFacts(paths: MemoryPaths): Promise<FactRecord[]>;
/** 事实 id → 所在分片；无分片布局时返回 undefined。 */
export declare function readShardLayout(paths: MemoryPaths): Promise<Map<string, string> | undefined>;
export declare function factToYaml(record: FactRecord): YamlValue;
/**
 * 写 L3 事实。
 *
 * 分片布局下按已有归属分组，**新事实进 unsorted**（下次整理再归档）；
 * 一律不删分片文件——变空的分片写成只剩表头的空文件，避免读到陈旧内容。
 */
export declare function writeFacts(paths: MemoryPaths, facts: readonly FactRecord[]): Promise<void>;
export declare function localDate(now?: Date): string;
/** 读分片索引；读不到/格式不对都返回 undefined（调用方回落"全读"）。 */
export declare function readShardIndex(paths: MemoryPaths): Promise<ShardIndex | undefined>;
/**
 * 写分片 + 重建索引。
 *
 * `existingNames` 里的分片即使这次没有事实也会写一个只有表头的空文件——
 * 宁可留个空壳，也不要让旧的 .yaml 留在盘上被下次读到。
 */
export declare function writeShardGroups(paths: MemoryPaths, groups: ReadonlyMap<string, readonly FactRecord[]>, existingNames?: readonly string[]): Promise<ShardIndex>;
export interface ShardQueryResult {
    facts: FactRecord[];
    sharded: boolean;
    /** 实际读了的分片；非分片布局为空。 */
    scanned: string[];
    /** 索引判定不必读而跳过的分片。 */
    skipped: string[];
}
/**
 * 按索引挑分片读事实。
 *
 * **索引只用来缩小范围，判不准就全读** —— 漏读是错，多读只是慢。
 */
export declare function readFactsForQuery(paths: MemoryPaths, query: string, tags?: readonly string[]): Promise<ShardQueryResult>;
/** 派发新 id：`mem-<时间戳><序号>`（可读、稳定、不依赖随机数）。 */
export declare function nextFactId(now?: Date): string;
export interface UpsertResult {
    fact: FactRecord;
    action: 'created' | 'versioned' | 'unchanged';
}
/**
 * 追加式写入：同 id 且最新版本值相同 → unchanged（不写）；
 * 值不同 → 追加 history 版本（旧的永不删）。找不到 id 时按 fact 文本匹配同名事实。
 */
export declare function upsertFact(facts: FactRecord[], input: {
    id?: string;
    fact: string;
    value: string;
    date: string;
    source?: string[];
    tags?: string[];
    note?: string;
}): UpsertResult;
export declare function readCandidates(paths: MemoryPaths): Promise<CandidateRecord[]>;
export declare function candidateToYaml(record: CandidateRecord): YamlValue;
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
export declare function mergeDuplicateCandidates(records: CandidateRecord[], date: string): number;
export declare function writeCandidates(paths: MemoryPaths, records: readonly CandidateRecord[]): Promise<void>;
export declare function nextCandidateId(now?: Date): string;
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
export declare function candidateKey(value: string): string;
export declare function addCandidate(records: CandidateRecord[], input: {
    fact: string;
    date: string;
    source?: string[];
    tags?: string[];
    note?: string;
}): CandidateRecord;
export declare function cachedBrief(): string | undefined;
export declare function readBrief(paths: MemoryPaths): Promise<string | undefined>;
/** 生成新的摘要正文（当前态）。旧版由 archiveBrief() 归档到 log/，内容不丢。 */
export declare function composeBrief(today: string, body: string): string;
/** 归档旧摘要到 log/brief-<日期>.md（只追加不删：旧内容以文件形式保留）。 */
export declare function archiveBrief(paths: MemoryPaths, date: string, previous: string): Promise<string>;
export declare function writeBrief(paths: MemoryPaths, content: string): Promise<void>;
export declare function appendLog(paths: MemoryPaths, date: string, entry: Record<string, YamlValue | undefined>): Promise<void>;
export declare function readLog(paths: MemoryPaths, date: string): Promise<Array<Record<string, YamlValue>>>;
export declare function readSeenSessions(paths: MemoryPaths): Promise<string[]>;
export declare function writeSeenSessions(paths: MemoryPaths, ids: readonly string[]): Promise<void>;
