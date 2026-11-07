import { serviceOf } from "./host.js";
import { cachedBrief, resolvePaths } from "./store.js";
export const CAPABILITY_SECTION = 'dsh-memory:capabilities';
export const BRIEF_CONTEXT = 'dsh-memory:brief';
/** 排在 MCP_SERVERS(3100) 之后、TOOLS_SDK(5000) 之前：跟其他能力说明放一起。 */
const CAPABILITY_ORDER = 3200;
const BRIEF_ORDER = 3200;
/**
 * 能力块正文。**改这里就是在改前缀缓存的分母**：不要塞任何随会话变化的东西。
 */
export const CAPABILITY_TEXT = `# 记忆系统（dsh-memory）

你有一份跨会话的长期记忆，是明文文件，放在 DSH_HOME 的 memory 目录下（当前真实路径见对话中的「记忆当前快照」）。它分三层：

- **L3 永久事实**：主题 + 当前值 + 版本链。改值只追加新版本、旧版本永远保留，所以"什么时候改成了什么"可以追溯。
- **L2 待升格候选**：还没定论、值得跟踪的线索。
- **L4 启动摘要（简报）**：上一次干到哪、关键状态、下一步。

六只工具：\`memory_brief\`（读简报）、\`memory_recall\`（查事实）、\`memory_note\`（记事实）、\`memory_candidate\`（记线索）、\`memory_promote\`（把线索升格成事实）、\`memory_organize\`（整理一次，支持试跑）。

## 什么时候写
- 用户说出**长期有效**的偏好、配置、约定、项目决策 → \`memory_note\`
- 拿不准是否长期、但值得跟踪 → \`memory_candidate\`
- 别记流水账、工具调用过程、临时状态、绝对路径（除非用户明确要求长期记住某个地址）

## 什么时候读
- **要问用户某件可能已经记录过的事之前，先 \`memory_recall\` 再问** —— 记忆里有的东西不要再问一遍。
- 会话开始需要接续上次的工作 → \`memory_brief\`

## 两条硬规则
1. **记忆是写入那一刻的断言，不是现值。** 涉及函数名、文件路径、配置值、版本号时，行动前先核验当前状态——文件可能已经改了、配置可能已经变了。核验的成本远低于按过期记忆行事的成本。
2. **0 命中不等于从未记录。** 换个措辞、换更少更独特的词再试；一次查不到不代表没有。
`;
/** 把能力块和简报快照挂到宿主的 system prompt 上。缺服务时静默跳过。 */
export function registerMemoryPrompt(ctx, config) {
    const systemPrompt = serviceOf(ctx, 'systemPrompt');
    if (systemPrompt === undefined)
        return { registered: false };
    const paths = resolvePaths(config);
    systemPrompt.section({ name: CAPABILITY_SECTION, order: CAPABILITY_ORDER, text: CAPABILITY_TEXT });
    systemPrompt.context({
        name: BRIEF_CONTEXT,
        order: BRIEF_ORDER,
        text: () => {
            const brief = cachedBrief()?.trim() ?? '';
            const pathLine = `记忆目录：${paths.root}（明文 Markdown / YAML，可直接打开、手改、搬走）`;
            if (brief === '')
                return `# 记忆当前快照\n\n（还没有简报。${pathLine}）`;
            return `# 记忆当前快照\n\n${brief}\n\n---\n${pathLine}`;
        },
    });
    return { registered: true };
}
