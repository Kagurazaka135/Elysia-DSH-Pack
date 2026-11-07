/**
 * 宿主服务的结构化最小类型（鸭子类型）。
 *
 * 关键点：本插件**不 import 宿主的任何 dsh-* 内部包**（除了 defineTool 的类型），
 * 只按服务名取用 —— 同一份包要能在 PC / 手机、0.1.x / 0.2.x 各版本宿主上加载。
 * 用到的字段全部可选化处理：服务形态对不上时按 undefined 处理，绝不抛。
 */
/**
 * 按名取宿主服务（**永不抛**）。
 *
 * Cordis 语义：未在 `inject` 里声明的服务，**读取属性本身就会抛**
 * （`cannot get property "x" without inject`）。所以：
 *  1. 先用 `ctx.get(name)`（Cordis 官方的可选读取入口，未提供时返回 undefined）；
 *  2. 退回属性读取，且包 try/catch（老宿主 / 伪上下文）。
 */
export function serviceOf(ctx, name) {
    if (ctx === null || ctx === undefined)
        return undefined;
    const record = ctx;
    if (typeof record.get === 'function') {
        try {
            const value = record.get(name);
            if (value !== undefined)
                return value;
        }
        catch {
            /* 未提供 / 未注入：继续尝试属性读取 */
        }
    }
    try {
        const direct = ctx[name];
        if (direct !== undefined)
            return direct;
    }
    catch {
        /* 未 inject：视为没有该服务 */
    }
    return undefined;
}
export function hostBundle(ctx) {
    return {
        sessions: serviceOf(ctx, 'sessions'),
        schedule: serviceOf(ctx, 'schedule'),
        sessionQuery: serviceOf(ctx, 'sessionQuery'),
        systemPrompt: serviceOf(ctx, 'systemPrompt'),
        llm: serviceOf(ctx, 'llm'),
        agentDefaultModel: serviceOf(ctx, 'agentDefaultModel'),
        logger: serviceOf(ctx, 'logger'),
    };
}
/** 释放一个可能实现了 Symbol.dispose 协议的宿主对象（观测租约等）。 */
const disposeSymbol = Symbol.dispose;
export function disposeValue(value) {
    if (value === null || value === undefined || disposeSymbol === undefined)
        return;
    const fn = value[disposeSymbol];
    if (typeof fn === 'function')
        fn.call(value);
}
