/** 一次非流式调用：把 chunk 流攒成完整文本。 */
export async function chat(options, messages, signal) {
    const selection = resolveSelection(options);
    const timeoutMs = options.timeoutMs ?? 300_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('dsh-memory: 模型调用超时')), timeoutMs);
    const fused = signal === undefined ? controller.signal : AbortSignal.any([signal, controller.signal]);
    let text = '';
    let reasoning = '';
    let failure;
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
                content: [{ type: 'text', text: message.content }],
            })),
            temperature: 0.2,
            maxTokens: options.maxTokens ?? 8192,
            signal: fused,
        });
        for await (const chunk of stream) {
            if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
                text += chunk.text;
            }
            else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
                // 推理模型的 reasoning 先于 content 生成：content 空但 reasoning 带完整
                // JSON 时靠它兜底（extractJsonObject 会抠出来）。
                reasoning += chunk.text;
            }
            else if (chunk.type === 'finish') {
                const reason = chunk.reason;
                if (reason?.kind === 'error' || reason?.kind === 'aborted') {
                    failure = reason.failure?.message ?? reason.failure?.code ?? reason.kind;
                }
                else if (reason?.kind === 'max-tokens' && text.trim() === '' && reasoning.trim() === '') {
                    failure = 'token 预算被推理过程耗尽（finish_reason=max-tokens）';
                }
            }
        }
    }
    catch (error) {
        throw new Error(`dsh-memory: 模型调用失败（${selection.provider}/${selection.model}）：${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        clearTimeout(timer);
    }
    if (failure !== undefined) {
        throw new Error(`dsh-memory: 模型调用失败（${selection.provider}/${selection.model}）：${failure}`);
    }
    if (text.trim() !== '')
        return text;
    if (reasoning.trim() !== '')
        return reasoning;
    throw new Error(`dsh-memory: 模型返回空内容（${selection.provider}/${selection.model}）`);
}
/** 显式配置优先，其次宿主当前默认选择。两者都没有就是宿主没配模型。 */
export function resolveSelection(options) {
    const provider = options.provider?.trim() || options.fallback?.provider?.trim();
    const model = options.model?.trim() || options.fallback?.model?.trim();
    if (!provider || !model) {
        throw new Error('dsh-memory: 宿主没有可用的默认模型（agentDefaultModel 缺失），也没在插件配置里指定 organizer_provider / organizer_model');
    }
    return { provider, model };
}
/** 从模型输出里抠出第一个 JSON 对象（容忍 ```json 代码栅栏与前后废话）。 */
export function extractJsonObject(raw) {
    const unfenced = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_, inner) => inner);
    for (const candidate of [unfenced, raw]) {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start === -1 || end <= start)
            continue;
        try {
            const parsed = JSON.parse(candidate.slice(start, end + 1));
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            /* 试下一个候选 */
        }
    }
    return undefined;
}
