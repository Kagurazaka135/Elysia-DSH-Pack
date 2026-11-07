/**
 * 六只记忆工具（§5 + memory_organize）：
 *
 *   memory_brief     读 L4 摘要（会话开始 / 需要时调）
 *   memory_recall    查 L3（关键词 / 标签），返回命中事实含版本历史
 *   memory_note      追加 L3 事实（同主题自动版本化，不覆盖历史）
 *   memory_candidate 记一条 L2 待升格候选
 *   memory_promote   把候选升格为 L3（人工确认后调）
 *   memory_organize  立刻跑一次夜间整理（schedule 到点提示的就是它；dry_run 只报告不落盘）
 */
import { defineTool } from "./define-tool.js";
import { localDate, runOrganize } from "./organize.js";
import { addCandidate, candidateKey, ensureDirs, readBrief, readCandidates, readFacts, readFactsForQuery, resolvePaths, upsertFact, writeCandidates, writeFacts, } from "./store.js";
import { hostBundle } from "./host.js";
/** 当前会话 id（工具调用的来源标注用）。 */
function callSessionId(exec) {
    const agent = exec.agent;
    const id = agent?.id;
    return typeof id === 'string' && id !== '' ? id : undefined;
}
function today() {
    return localDate();
}
/** 命中里含"具体名字"（路径/文件名/端口/IP）时提醒核验——那类内容最容易过期。 */
function looksLikeSpecificName(hits) {
    const specific = /[/\\]|\.(ts|js|mjs|json|yaml|yml|md|py|toml|ini|cfg|sh)\b|:\d{2,5}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/;
    return hits.some(fact => specific.test(fact.fact)
        || fact.history.some(version => specific.test(version.value)));
}
const TOOL_NAMES = {
    brief: 'memory_brief',
    recall: 'memory_recall',
    note: 'memory_note',
    candidate: 'memory_candidate',
    promote: 'memory_promote',
    organize: 'memory_organize',
};
export function registerMemoryTools(ctx, deps) {
    const tools = ctx.tools;
    if (tools === undefined || typeof tools.register !== 'function') {
        throw new Error('dsh-memory: 宿主没有 tools 服务，无法注册记忆工具');
    }
    // ---------- memory_brief ----------
    tools.register(defineTool({
        name: TOOL_NAMES.brief,
        description: '读取 L4 启动摘要（当前进度/关键状态/下一步）——会话开始或需要"我现在该知道什么"时先调它，一次拿全，',
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    ok: { type: 'boolean', required: true },
                    message: { type: 'string', required: true },
                    facts: { type: 'number', required: true },
                    candidates_pending: { type: 'number', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute() {
            await ensureDirs(deps.paths);
            const [brief, facts, candidates] = await Promise.all([
                readBrief(deps.paths), readFacts(deps.paths), readCandidates(deps.paths),
            ]);
            const pending = candidates.filter(item => item.status === 'pending').length;
            if (brief === undefined) {
                return {
                    ok: true, facts: facts.length, candidates_pending: pending,
                    message: `还没有 L4 摘要（facts：${facts.length} 条，待升格候选：${pending} 条）。先用 memory_note 记事实，或跑 memory_organize 生成摘要。`,
                };
            }
            return {
                ok: true, facts: facts.length, candidates_pending: pending,
                message: `${brief.trim()}\n\n---\n（L3 事实 ${facts.length} 条 · 待升格候选 ${pending} 条；查具体事实用 memory_recall）`,
            };
        },
    }));
    // ---------- memory_recall ----------
    tools.register(defineTool({
        name: TOOL_NAMES.recall,
        description: '检索 L3 永久事实（按关键词匹配 fact 与各版本值，或按 tags 过滤），返回命中事实的完整版本历史。想知道"某件稳定事实现在是什么/以前是什么"时调它。注意：命中的内容是**写入那一刻的断言**——涉及文件名/路径/配置值时，行动前先核验当前状态，别把记忆当现值用。',
        parameters: {
            query: { type: 'string', description: '关键词（不区分大小写，匹配主题与历史值；留空则只按 tags 过滤）' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签过滤（命中任一标签即算；可与 query 同时给）' },
            limit: { type: 'number', description: '最多返回多少条，默认 20' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: true,
                properties: {
                    ok: { type: 'boolean', required: true },
                    message: { type: 'string', required: true },
                    count: { type: 'number', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute(args) {
            const query = (args.query ?? '').trim();
            const needle = query.toLowerCase();
            const tagFilter = (args.tags ?? []).map(item => item.trim()).filter(Boolean);
            const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
            const loaded = await readFactsForQuery(deps.paths, query, tagFilter);
            const hits = loaded.facts.filter(fact => {
                if (tagFilter.length > 0 && !tagFilter.some(tag => fact.tags.includes(tag)))
                    return false;
                if (needle === '')
                    return true;
                const haystack = [fact.fact, ...fact.history.map(v => v.value)].join('\n').toLowerCase();
                return haystack.includes(needle);
            }).slice(0, limit);
            if (hits.length === 0) {
                return {
                    ok: true, count: 0,
                    message: [
                        `没有命中${query === '' ? '' : `「${query}」`}（共 ${loaded.facts.length} 条 L3 事实）。`,
                        '',
                        '**0 命中 ≠ 从未记录**——也可能只是措辞不同。别就此下"没记过"的结论，按顺序再试：',
                        '1. 换**更少、更独特**的词（「postgres 5433」比「数据库连接配置」容易命中）；',
                        '2. 只按标签查：`memory_recall { "tags": ["config"] }`，或留空 query 浏览全部；',
                        '3. 用 `memory_brief` 看当前摘要（可能概括成了别的说法）。',
                        '',
                        '（记忆是写入那一刻的断言；命中后涉及路径/文件名/配置值，行动前先核验当前状态。）',
                    ].join('\n'),
                };
            }
            const body = hits.map(fact => {
                const lines = [`### [${fact.id}] ${fact.fact}`];
                const versions = [...fact.history].reverse();
                versions.forEach((version, index) => {
                    const marker = index === 0 ? '（当前）' : '';
                    const note = version.note ? ` —— ${version.note}` : '';
                    lines.push(`- ${version.date}${marker}：${version.value}${note}`);
                });
                if (fact.tags.length > 0)
                    lines.push(`- tags: ${fact.tags.join(', ')}`);
                return lines.join('\n');
            });
            const footers = [];
            if (looksLikeSpecificName(hits))
                footers.push('⚠️ 上述内容含具体名称/路径/配置值——那是写入时的断言，用前先核验当前状态。');
            if (loaded.skipped.length > 0)
                footers.push(`（按分片索引只读了 ${loaded.scanned.join('/')}，跳过 ${loaded.skipped.length} 个分片）`);
            return {
                ok: true, count: hits.length,
                message: footers.length > 0 ? `${body.join('\n\n')}\n\n---\n${footers.join('\n')}` : body.join('\n\n'),
            };
        },
    }));
    // ---------- memory_note ----------
    tools.register(defineTool({
        name: TOOL_NAMES.note,
        description: '追加一条 L3 永久事实（长期有效才记：用户偏好、配置决定、项目约定、重要结论）。同主题已有事实会**追加新版本**（旧版本保留），值没变化则不写。短平快的信息别记，留给 memory_candidate。',
        parameters: {
            fact: { type: 'string', required: true, description: '事实主题（短，如"默认模型"；同主题视为同一事实）' },
            value: { type: 'string', required: true, description: '当前值（如"deepseek-flash"）' },
            id: { type: 'string', description: '已知事实 id（memory_recall 返回的 [mem-…]）；给了就定向追加新版本' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签（如 config / preference / project）' },
            note: { type: 'string', description: '为什么/依据（可选，会写进版本记录）' },
            source: { type: 'array', items: { type: 'string' }, description: '来源（默认填当前会话 id）' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: true,
                properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute(args, exec) {
            const factText = args.fact.trim();
            const value = args.value.trim();
            if (factText === '' || value === '')
                throw new Error('fact 与 value 都不能为空');
            await ensureDirs(deps.paths);
            const facts = await readFacts(deps.paths);
            const sessionId = callSessionId(exec);
            const source = args.source && args.source.length > 0 ? args.source : sessionId ? [sessionId] : [];
            const result = upsertFact(facts, {
                ...(args.id?.trim() ? { id: args.id.trim() } : {}),
                fact: factText, value, date: today(),
                source, tags: (args.tags ?? []).map(t => t.trim()).filter(Boolean),
                ...(args.note?.trim() ? { note: args.note.trim() } : {}),
            });
            if (result.action === 'unchanged') {
                return { ok: true, message: `未变化：事实「${result.fact.fact}」当前值已是 ${value}（未写文件）。` };
            }
            await writeFacts(deps.paths, facts);
            const action = result.action === 'created' ? '已新建' : '已追加新版本';
            const versions = result.fact.history.length;
            return {
                ok: true,
                message: `${action}：${result.fact.fact} = ${value}（id ${result.fact.id}，共 ${versions} 个版本，旧版本全部保留）`,
            };
        },
    }));
    // ---------- memory_candidate ----------
    tools.register(defineTool({
        name: TOOL_NAMES.candidate,
        description: '记一条 L2 待升格候选（"可能有用但还没定论"的线索：反复出现的话题、未确认的倾向、待办苗头）。同一线索重复记会自动累计次数，攒够了在整理时人工确认升格（memory_promote 或夜间整理）。',
        parameters: {
            fact: { type: 'string', required: true, description: '候选内容（一句话）' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签' },
            note: { type: 'string', description: '补充说明（可选）' },
            source: { type: 'array', items: { type: 'string' }, description: '来源（默认当前会话 id）' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: true,
                properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute(args, exec) {
            const text = args.fact.trim();
            if (text === '')
                throw new Error('fact 不能为空');
            await ensureDirs(deps.paths);
            const candidates = await readCandidates(deps.paths);
            const sessionId = callSessionId(exec);
            const source = args.source && args.source.length > 0 ? args.source : sessionId ? [sessionId] : [];
            const record = addCandidate(candidates, {
                fact: text, date: today(), source,
                tags: (args.tags ?? []).map(t => t.trim()).filter(Boolean),
                ...(args.note?.trim() ? { note: args.note.trim() } : {}),
            });
            await writeCandidates(deps.paths, candidates);
            return {
                ok: true,
                message: `候选已记录：${record.fact}（id ${record.id}，出现 ${record.count} 次；累计 ≥3 次时建议升格）`,
            };
        },
    }));
    // ---------- memory_promote ----------
    tools.register(defineTool({
        name: TOOL_NAMES.promote,
        description: '把 L2 候选升格为 L3 永久事实（人工确认后调；夜间整理也会给建议）。按候选 id 或内容文本指定；升格后候选保留标记为 promoted，不删除。',
        parameters: {
            id: { type: 'string', description: '候选 id（如 cand-…）；与 fact 二选一' },
            fact: { type: 'string', description: '候选内容文本（与 id 二选一，按归一化文本匹配）' },
            value: { type: 'string', description: '升格后的 L3 事实值（默认用候选文本本身）' },
            tags: { type: 'array', items: { type: 'string' }, description: 'L3 标签（默认沿用候选标签）' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: true,
                properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute(args) {
            await ensureDirs(deps.paths);
            const [facts, candidates] = await Promise.all([readFacts(deps.paths), readCandidates(deps.paths)]);
            let target = args.id?.trim() ? candidates.find(item => item.id === args.id?.trim()) : undefined;
            if (target === undefined && args.fact?.trim()) {
                // 与 addCandidate 同一口径：剥掉摘录腔尾巴再比，否则带「（出现 N 次）」的那条找不到
                const needle = candidateKey(args.fact);
                target = candidates.find(item => candidateKey(item.fact) === needle);
            }
            if (target === undefined) {
                return { ok: false, message: '没找到这条候选（用 id 或与候选完全一致的文本指定；候选列表在 candidates.yaml）。' };
            }
            if (target.status === 'promoted') {
                return { ok: true, message: `该候选已升格过（${target.id}），未重复操作。` };
            }
            const value = (args.value?.trim() || target.fact).trim();
            const tags = (args.tags ?? []).map(t => t.trim()).filter(Boolean);
            const upserted = upsertFact(facts, {
                fact: target.fact, value, date: today(),
                source: target.source, tags: tags.length > 0 ? tags : target.tags,
                note: `由候选 ${target.id} 升格（出现 ${target.count} 次）`,
            });
            if (upserted.action !== 'unchanged')
                await writeFacts(deps.paths, facts);
            target.status = 'promoted';
            target.last_seen = today();
            target.note = `升格为 ${upserted.fact.id}`;
            await writeCandidates(deps.paths, candidates);
            return {
                ok: true,
                message: `已升格：${target.fact} → L3 事实 [${upserted.fact.id}]${upserted.action === 'unchanged' ? '（值未变化，仅标记候选）' : ''}。候选记录保留为 promoted。`,
            };
        },
    }));
    // ---------- memory_organize ----------
    tools.register(defineTool({
        name: TOOL_NAMES.organize,
        description: '立刻执行一次"夜间整理"：扫描最近会话 + L2 候选 → 走本地 broker 归纳 → 只追加地更新 L3 事实版本 / L2 候选 / L4 摘要 / 整理日志。定时任务到点提示的就是它；也可随时手动调。dry_run=true 只看报告不写文件。',
        parameters: {
            dry_run: { type: 'boolean', description: '只生成报告、不写任何文件（默认 false）' },
            scan_sessions: { type: 'number', description: '本次最多扫描多少场会话（默认 12）' },
            reshard: { type: 'boolean', description: '重排已有分片（只对已分片的库有效；空库不会凭空造片，首次分片由 shard_threshold 触发）' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: true,
                properties: {
                    ok: { type: 'boolean', required: true },
                    message: { type: 'string', required: true },
                    dry_run: { type: 'boolean', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: value.message }],
        },
        async execute(args, exec) {
            const dryRun = args.dry_run === true;
            const config = {
                ...deps.config,
                ...(args.scan_sessions !== undefined ? { scan_sessions: args.scan_sessions } : {}),
            };
            const host = hostBundle(deps.ctx);
            const sessionId = callSessionId(exec);
            if (host.llm === undefined) {
                return { ok: false, dry_run: dryRun, message: '宿主没有 llm 服务，无法整理记忆（工具读写仍可用）。' };
            }
            const result = await runOrganize({
                config,
                llm: {
                    llm: host.llm,
                    ...(host.agentDefaultModel ? { fallback: host.agentDefaultModel.currentSelection() } : {}),
                    ...(deps.config.organizer_provider ? { provider: deps.config.organizer_provider } : {}),
                    ...(deps.config.organizer_model ? { model: deps.config.organizer_model } : {}),
                },
                ...(host.sessionQuery ? { sessionQuery: host.sessionQuery } : {}),
                ...(sessionId ? { skipSessionId: sessionId } : {}),
                signal: exec.signal,
                dryRun,
                ...(args.reshard === true ? { forceReshard: true } : {}),
            });
            const lines = [];
            if (!result.ok) {
                lines.push(`整理失败（未写入任何记忆）：${result.error ?? '未知错误'}`);
                lines.push('（可能原因：本地 broker 未开、模型名不对、响应不可解析。修复后重试即可。）');
            }
            else {
                const prefix = dryRun ? '[dry-run] ' : '';
                lines.push(`${prefix}整理完成（${result.date}）：扫描会话 ${result.sessionsScanned} 场${dryRun ? '' : ''}`);
                lines.push(`- L3 新建 ${result.factsCreated.length} 条${result.factsCreated.length ? `（${result.factsCreated.join(', ')}）` : ''}`);
                lines.push(`- L3 追加版本 ${result.factsVersioned.length} 条${result.factsVersioned.length ? `（${result.factsVersioned.join(', ')}）` : ''}`);
                lines.push(`- L2 新候选 ${result.candidatesAdded} 条`);
                lines.push(`- L4 摘要 ${result.briefUpdated ? '已更新（旧版归档在 log/）' : '无变化'}`);
                if (result.shards !== undefined && result.shards.length > 0) {
                    lines.push(`- 分片：${result.shards.length} 个文件（${result.shards.map(item => `${item.name} ${item.count}`).join(' · ')}）`);
                }
                if (result.summary)
                    lines.push(`- 说明：${result.summary}`);
                if (!dryRun)
                    lines.push(`- 日志：${result.logPath}`);
            }
            for (const note of result.notes)
                lines.push(`- 提示：${note}`);
            return { ok: result.ok, dry_run: dryRun, message: lines.join('\n') };
        },
    }));
}
