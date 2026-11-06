import { registerVideoTools } from "./tools.js";
export const name = 'dsh-video-frames';
// video_analyze 走 ctx.attachments + ctx.llm，其余工具只用 ctx.tools。
// Cordis 的 inject 是必需语义：不声明就访问即抛 "cannot get property ... without inject"。
export const inject = ['tools', 'attachments', 'llm'];
export function apply(ctx) {
    registerVideoTools(ctx);
}
