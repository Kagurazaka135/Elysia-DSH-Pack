/**
 * `defineTool` 及其依赖闭包的**本地副本**——为了真正零运行时依赖。
 *
 * 来源：`@deepseek-ai/dsh-tools@0.2.0-rc.2` 的 `lib/index.js`（手机 payload 里那一份）。
 * 抄写原则：**逐函数照抄，逻辑一个字不改**；只补 TypeScript 类型标注。
 *
 * 闭包（原文件行号，2026-10-24 盘点）：
 *   - 25   JsonSchemaError
 *   - 34   CONSTRAINT_KEYWORDS
 *   - 44   ANNOTATION_KEYWORDS
 *   - 50   SCHEMA_TYPES
 *   - 60   hasIntrinsicConstructor
 *   - 70   isIntrinsicObjectPrototype
 *   - 79   isPlainJsonRecord
 *   - 89   hasPlainArrayPrototype
 *   - 96   hasOnlyEnumerableStringKeys
 *   - 108  isJsonSchemaRecord
 *   - 116  isPlainJsonArray
 *   - 127  isJsonNumber
 *   - 131  scalarMatches
 *   - 143  ONE_OF_SIBLING_KEYWORDS
 *   - 152  checkObjectSchemaTail
 *   - 163  checkSchemaNode
 *   - 323  assertSupportedJsonSchema
 *   - 334  assertObjectJsonSchema
 *   - 341  safelyIsJsonValue        → 依赖 isJsonValue（dsh-util-values）
 *   - 349  diagnosticPath
 *   - 353  propertyPath
 *   - 357  losslessValueViolation
 *   - 361  appendViolations
 *   - 365  valueFrame
 *   - 380  checkScalarValue
 *   - 387  checkValue
 *   - 531  validateJsonSchemaValue
 *   - 537  ANNOTATION_KEYS
 *   - 544  authorError
 *   - 548  copyAnnotations
 *   - 555  assertAuthorKeys
 *   - 559  assignCompiledNode
 *   - 581  assignCompiledPropertyMap
 *   - 586  runSchemaCompiler
 *   - 756  compilePropertyMap
 *   - 771  compileValueSchema
 *   - 792  valueSchemaSpecToJsonSchema
 *   - 802  parameterSchemaSpecToJsonSchema
 *   - 813  ToolArgsError
 *   - 828  validateArgs
 *   - 838  defineTool
 *
 * 还额外内联了两处**上游包的私有依赖**（同样照抄）：
 *   - `HarnessError`：`@deepseek-ai/dsh-llm/lib/types/error.js:12`
 *   - `isJsonValue` / `walkJsonValue`：`@deepseek-ai/dsh-util-values/lib/index.js:9,46,167`
 *   - `assertNever`：`@deepseek-ai/dsh-util-values/lib/index.js:9`
 *
 * 唯一与上游不同的地方（不影响行为，均为必要的改名/类型）：
 *   - 本文件里的 `HarnessError` 是**同语义的本地类**，不是上游那个类本身。
 *     因此错误对象不再是上游 `HarnessError` 的 `instanceof` 实例；错误消息、`name`、`code` 全部一致。
 *   - dsh-util-values 的私有辅助函数与 dsh-tools 的同名函数逻辑相同但实现独立，为避免重名加 `uv` 前缀。
 */
/**
 * Base class for all harness errors. Carries a `code`（稳定、可编程）与人类可读的 `message`，
 * 支持标准 `ErrorOptions.cause`。`name` 默认取子类构造器名。
 * 照抄 `@deepseek-ai/dsh-llm/lib/types/error.js` 的 `HarnessError`。
 */
declare class HarnessError extends Error {
    readonly code: string;
    constructor(message: string, code: string, options?: ErrorOptions);
}
/**
 * Thrown when a raw schema falls outside the enforced subset. `violations`
 * lists every offending path instead of stopping at the first author error.
 */
export declare class JsonSchemaError extends HarnessError {
    /** Individual schema violations in walk order. */
    violations: string[];
    constructor(violations: string[]);
}
/**
 * Assert that an arbitrary raw schema uses only the enforced subset.
 * Annotation-only schemas are accepted as the standard unconstrained-JSON
 * form; callers that require an object root use {@link assertObjectJsonSchema}.
 */
export declare function assertSupportedJsonSchema(schema: any): void;
/**
 * Assert the enforced subset plus the object-root constraint retained by
 * subagent and workflow structured outputs.
 */
export declare function assertObjectJsonSchema(schema: any): void;
/**
 * Validate a candidate value against an asserted raw schema. The function is
 * total for arbitrary values and returns path-qualified violations.
 */
export declare function validateJsonSchemaValue(schema: any, value: any, path?: any): string[];
/**
 * Compile one author-facing value schema to the enforced raw JSON Schema
 * subset. The author-only `json` node becomes an annotation-only schema.
 */
export declare function valueSchemaSpecToJsonSchema(spec: any): any;
/**
 * Compile the implicit open parameter object into raw JSON Schema.
 */
export declare function parameterSchemaSpecToJsonSchema(spec: any): any;
/** Invalid model-generated arguments for a typed tool. */
export declare class ToolArgsError extends HarnessError {
    /** Individual violations in schema-walk order. */
    violations: string[];
    constructor(violations: string[]);
}
/**
 * Validate model-generated arguments against an implicit parameter schema.
 */
export declare function validateArgs(spec: any, args: any): string[];
/** 作者侧的 schema 描述（只为类型提示；运行时按原实现解释）。 */
export interface ValueSchemaSpec {
    type?: string;
    description?: string;
    title?: string;
    default?: unknown;
    examples?: unknown;
    oneOf?: ValueSchemaSpec[];
    properties?: Record<string, ValueSchemaSpec>;
    additionalProperties?: boolean;
    items?: ValueSchemaSpec;
    enum?: readonly unknown[];
    const?: unknown;
    required?: boolean;
    [key: string]: unknown;
}
/** 参数表：每项是作者侧 schema 描述。 */
export type ParameterSchemaSpec = Record<string, ValueSchemaSpec>;
/**
 * 工具执行上下文的最小结构化类型（替代 `@deepseek-ai/dsh-tools` 的 `ToolRunContext`）。
 * 插件只用到 `agent.id` 与 `signal`；其余字段按需保留，运行时由宿主注入。
 */
export interface ToolRunContext {
    readonly agent?: {
        id?: unknown;
    } | undefined;
    readonly signal: AbortSignal;
    readonly callId?: unknown;
    readonly rootCallId?: unknown;
    readonly name?: string;
    readonly arguments?: unknown;
    readonly schema?: unknown;
    readonly token?: unknown;
    readonly parent?: unknown;
    deferContext?(context: unknown): void;
    concludeTurn?(): void;
}
export interface DefineToolOptions {
    name: string;
    description: string;
    parameters: ParameterSchemaSpec;
    output: {
        schema: ValueSchemaSpec;
        render(args: any, value: any): unknown[];
        presentationMeta?(args: any, value: any): unknown;
    };
    timeoutMs?: number;
    deferLoading?: boolean;
    execute(args: any, exec: ToolRunContext): Promise<unknown>;
    projectContent?(exec: any, result: any): unknown;
    finalizeContent?(exec: any, result: any): unknown;
    presentCall?(args: any): unknown;
    presentResult?(args: any, result: any): unknown;
    isConcurrencySafe?(args: any): boolean;
}
/**
 * Define a first-party tool with inferred arguments and strict execution
 * validation. Replay-only presenters validate softly and fall back to generic
 * rendering for obsolete logged arguments.
 */
export declare function defineTool(options: DefineToolOptions): any;
export {};
