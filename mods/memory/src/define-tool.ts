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

// ───────────────────────────── 本地 HarnessError ─────────────────────────────
/**
 * Base class for all harness errors. Carries a `code`（稳定、可编程）与人类可读的 `message`，
 * 支持标准 `ErrorOptions.cause`。`name` 默认取子类构造器名。
 * 照抄 `@deepseek-ai/dsh-llm/lib/types/error.js` 的 `HarnessError`。
 */
class HarnessError extends Error {
  readonly code: string

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = new.target.name
  }
}

// ─────────────────────────── dsh-util-values 的闭包 ───────────────────────────
/**
 * 标记一个不可达的闭合联合分支。
 * 照抄 `@deepseek-ai/dsh-util-values/lib/index.js:9`。
 */
function assertNever(value: any, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value)
  throw new Error(`unreachable variant${context ? ` in ${context}` : ''}: ${rendered}`)
}

/** 照抄 dsh-util-values 的 `hasIntrinsicConstructor`（为避免与 dsh-tools 同名函数冲突，加 uv 前缀）。 */
function uvHasIntrinsicConstructor(prototype: any, name: string): boolean {
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value
  if (typeof constructor !== 'function') return false
  try {
    return constructor.name === name
      && constructor.prototype === prototype
      && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(name === 'Array' ? Array : Object)
  } catch {
    return false
  }
}

/** 照抄 dsh-util-values 的 `isIntrinsicObjectPrototype`。 */
function uvIsIntrinsicObjectPrototype(value: any): boolean {
  return Object.getPrototypeOf(value) === null && uvHasIntrinsicConstructor(value, 'Object')
}

/** 照抄 dsh-util-values 的 `hasPlainArrayPrototype`。 */
function uvHasPlainArrayPrototype(value: any): boolean {
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(prototype) || !uvHasIntrinsicConstructor(prototype, 'Array')) return false
  const objectPrototype = Object.getPrototypeOf(prototype)
  return typeof objectPrototype === 'object' && objectPrototype !== null && uvIsIntrinsicObjectPrototype(objectPrototype)
}

/** 照抄 dsh-util-values 的 `hasPlainObjectPrototype`。 */
function uvHasPlainObjectPrototype(value: any): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || typeof prototype === 'object' && uvIsIntrinsicObjectPrototype(prototype)
}

/** 照抄 dsh-util-values 的 `enumerableStringKeys`。 */
function uvEnumerableStringKeys(value: any): string[] | undefined {
  const keys = Reflect.ownKeys(value)
  if (keys.some((key: any) => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(value, key))) return undefined
  return keys as string[]
}

/** 照抄 dsh-util-values 的 `walkJsonValue`。 */
function walkJsonValue(value: any, detach: boolean): any {
  const ancestors = new Set<any>()
  let root: any
  const assign = (destination: any, item: any): void => {
    if (destination === undefined) return
    if (destination.kind === 'root') root = item
    else if (destination.kind === 'array') destination.target[destination.index] = item
    else Object.defineProperty(destination.target, destination.key, {
      value: item,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  const tasks: any[] = [{
    kind: 'visit',
    value,
    ...(detach ? { destination: { kind: 'root' } } : {}),
  }]
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === 'leave') {
      ancestors.delete(task.source)
      continue
    }
    if (task.kind === 'array-item') {
      if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return undefined
      tasks.push({
        kind: 'visit',
        value: task.source[task.index],
        ...(task.target === undefined ? {} : {
          destination: {
            kind: 'array',
            target: task.target,
            index: task.index,
          },
        }),
      })
      continue
    }
    if (task.kind === 'object-property') {
      tasks.push({
        kind: 'visit',
        value: task.source[task.key],
        ...(task.target === undefined ? {} : {
          destination: {
            kind: 'object',
            target: task.target,
            key: task.key,
          },
        }),
      })
      continue
    }
    const current = task.value
    if (current === null) {
      assign(task.destination, null)
      continue
    }
    if (typeof current === 'boolean' || typeof current === 'string') {
      assign(task.destination, current)
      continue
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current) || Object.is(current, -0)) return undefined
      assign(task.destination, current)
      continue
    }
    if (typeof current !== 'object') return undefined
    if (ancestors.has(current)) return undefined
    if (Array.isArray(current)) {
      if (!uvHasPlainArrayPrototype(current)) return undefined
      const length = current.length
      if (Reflect.ownKeys(current).length !== length + 1) return undefined
      const target = detach ? [] : undefined
      if (target !== undefined) assign(task.destination, target)
      ancestors.add(current)
      tasks.push({
        kind: 'leave',
        source: current,
      })
      for (let index = length - 1; index >= 0; index--) {
        tasks.push({
          kind: 'array-item',
          source: current,
          index,
          ...(target === undefined ? {} : { target }),
        })
      }
      continue
    }
    if (!uvHasPlainObjectPrototype(current)) return undefined
    const keys = uvEnumerableStringKeys(current)
    if (keys === undefined) return undefined
    const target = detach ? {} : undefined
    if (target !== undefined) assign(task.destination, target)
    ancestors.add(current)
    tasks.push({
      kind: 'leave',
      source: current,
    })
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index]
      /* v8 ignore next -- the loop is bounded by the captured key count. */
      if (key === undefined) return undefined
      tasks.push({
        kind: 'object-property',
        source: current,
        key,
        ...(target === undefined ? {} : { target }),
      })
    }
  }
  return detach ? root : true
}

/** 照抄 dsh-util-values 的 `isJsonValue`。 */
function isJsonValue(value: any): boolean {
  return walkJsonValue(value, false) === true
}

// ──────────────────────────── dsh-tools/json-schema ────────────────────────────
/**
 * Thrown when a raw schema falls outside the enforced subset. `violations`
 * lists every offending path instead of stopping at the first author error.
 */
export class JsonSchemaError extends HarnessError {
  /** Individual schema violations in walk order. */
  violations: string[]

  constructor(violations: string[]) {
    super(`unsupported JSON schema: ${violations.join('; ')}`, 'UNSUPPORTED_SCHEMA')
    this.name = 'JsonSchemaError'
    this.violations = violations
  }
}

const CONSTRAINT_KEYWORDS = new Set([
  'type',
  'oneOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
])

const ANNOTATION_KEYWORDS = new Set([
  'description',
  'title',
  'default',
  'examples',
])

const SCHEMA_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'integer',
  'boolean',
  'null',
]

/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype: any, name: string): boolean {
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value
  if (typeof constructor !== 'function') return false
  try {
    return constructor.name === name
      && constructor.prototype === prototype
      && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`
  } catch {
    return false
  }
}

/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype(value: any): boolean {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, 'Object')
}

/**
 * Test for a realm-agnostic plain JSON record without accepting arrays or
 * exotic objects.
 */
function isPlainJsonRecord(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === null
      || typeof prototype === 'object' && isIntrinsicObjectPrototype(prototype)
  } catch {
    return false
  }
}

/** Whether an array uses one realm's intrinsic `Array.prototype`. */
function hasPlainArrayPrototype(value: any): boolean {
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, 'Array')) return false
  const objectPrototype = Object.getPrototypeOf(prototype)
  return typeof objectPrototype === 'object' && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype)
}

/** Return whether a record contains only own enumerable string keys. */
function hasOnlyEnumerableStringKeys(value: any): boolean {
  try {
    return Reflect.ownKeys(value).every((key: any) =>
      typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key))
  } catch {
    return false
  }
}

/**
 * Test for an ordinary schema record whose keys survive JSON projection.
 */
function isJsonSchemaRecord(value: any): boolean {
  return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value)
}

/**
 * Test for a dense ordinary array with no JSON-invisible decorations.
 */
function isPlainJsonArray(value: any): boolean {
  if (!Array.isArray(value)) return false
  try {
    if (!hasPlainArrayPrototype(value) || Reflect.ownKeys(value).length !== value.length + 1) return false
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) return false
    }
    return true
  } catch {
    return false
  }
}

/** Lossless finite JSON number, excluding negative zero. */
function isJsonNumber(value: any): boolean {
  return typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)
}

/** Whether a scalar is valid for one declared schema type. */
function scalarMatches(type: any, value: any): boolean {
  switch (type) {
    case 'string': return typeof value === 'string'
    case 'number': return isJsonNumber(value)
    case 'integer': return isJsonNumber(value) && Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    /* v8 ignore next -- JsonSchemaScalarType is closed; this retains compile-time exhaustiveness. */
    default: return assertNever(type, 'JsonSchemaType')
  }
}

/** Keywords that are invalid beside `oneOf`. */
const ONE_OF_SIBLING_KEYWORDS = [
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
]

/** Validate object-only fields after its property schemas have been visited. */
function checkObjectSchemaTail(node: any, path: any, properties: any, violations: string[]): void {
  const hasRequired = Object.hasOwn(node, 'required')
  const required = hasRequired ? node.required : undefined
  if (hasRequired) {
    if (!isPlainJsonArray(required) || required.some((entry: any) => typeof entry !== 'string')) {
      violations.push(`${path}.required must be an array of strings`)
    } else {
      const declared = isJsonSchemaRecord(properties) ? properties : {}
      for (const key of required) {
        if (!Object.hasOwn(declared, key)) violations.push(`${path}.required names "${key}" which is not in properties`)
      }
    }
  }
  if (Object.hasOwn(node, 'additionalProperties') && typeof node.additionalProperties !== 'boolean') {
    violations.push(`${path}.additionalProperties must be a boolean`)
  }
}

/** Collect every violation for one raw schema tree without using the JavaScript call stack. */
function checkSchemaNode(root: any, rootPath: any, violations: string[], seen: Set<any>): void {
  const tasks: any[] = [{
    kind: 'enter',
    node: root,
    path: rootPath,
  }]
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === 'leave') {
      seen.delete(task.node)
      continue
    }
    if (task.kind === 'one-of-tail') {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`)
      }
      continue
    }
    if (task.kind === 'object-tail') {
      checkObjectSchemaTail(task.node, task.path, task.properties, violations)
      continue
    }
    const { node, path } = task
    if (!isJsonSchemaRecord(node)) {
      violations.push(`${path} must be a schema object`)
      continue
    }
    if (seen.has(node)) {
      violations.push(`${path} is circular`)
      continue
    }
    seen.add(node)
    tasks.push({
      kind: 'leave',
      node,
    })
    for (const key of Object.keys(node)) {
      if (CONSTRAINT_KEYWORDS.has(key)) continue
      if (ANNOTATION_KEYWORDS.has(key)) {
        try {
          if (!isJsonValue(node[key])) violations.push(`${path}.${key} annotation must be lossless JSON data`)
        } catch {
          violations.push(`${path}.${key} annotation must be lossless JSON data`)
        }
        continue
      }
      violations.push(`${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`)
    }
    if (Object.hasOwn(node, 'description') && typeof node.description !== 'string') {
      violations.push(`${path}.description must be a string`)
    }
    if (Object.hasOwn(node, 'title') && typeof node.title !== 'string') {
      violations.push(`${path}.title must be a string`)
    }
    const hasType = Object.hasOwn(node, 'type')
    const hasOneOf = Object.hasOwn(node, 'oneOf')
    if (hasType && hasOneOf) {
      violations.push(`${path} cannot declare both type and oneOf`)
      continue
    }
    if (!hasType && !hasOneOf) {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(node, key)) violations.push(`${path}.${key} requires type or oneOf`)
      }
      continue
    }
    if (hasOneOf) {
      const oneOf = node.oneOf
      tasks.push({
        kind: 'one-of-tail',
        node,
        path,
      })
      if (!isPlainJsonArray(oneOf) || oneOf.length < 2) {
        violations.push(`${path}.oneOf must be an array of at least two schemas`)
      } else {
        for (let index = oneOf.length - 1; index >= 0; index--) {
          tasks.push({
            kind: 'enter',
            node: oneOf[index],
            path: `${path}.oneOf[${index}]`,
          })
        }
      }
      continue
    }
    const type = node.type
    if (typeof type !== 'string' || !SCHEMA_TYPES.includes(type)) {
      violations.push(Array.isArray(type)
        ? `${path}.type must be a single type string (type arrays are not supported)`
        : `${path}.type must be one of ${SCHEMA_TYPES.join('/')}`)
      continue
    }
    const schemaType = type
    for (const [key, types] of Object.entries({
      properties: ['object'],
      required: ['object'],
      additionalProperties: ['object'],
      items: ['array'],
      enum: [
        'string',
        'number',
        'integer',
        'boolean',
        'null',
      ],
      const: [
        'string',
        'number',
        'integer',
        'boolean',
        'null',
      ],
    })) {
      if (Object.hasOwn(node, key) && !(types as string[]).includes(schemaType)) {
        violations.push(`${path}.${key} is not supported on type "${schemaType}"`)
      }
    }
    switch (schemaType) {
      case 'object': {
        const properties = Object.hasOwn(node, 'properties') ? node.properties : undefined
        tasks.push({
          kind: 'object-tail',
          node,
          path,
          properties,
        })
        if (Object.hasOwn(node, 'properties')) {
          if (!isJsonSchemaRecord(properties)) {
            violations.push(`${path}.properties must be an object of schemas`)
          } else {
            const entries = Object.entries(properties)
            for (let index = entries.length - 1; index >= 0; index--) {
              const entry = entries[index]
              /* v8 ignore next -- the loop is bounded by the captured entry count. */
              if (entry === undefined) continue
              tasks.push({
                kind: 'enter',
                node: entry[1],
                path: `${path}.properties.${entry[0]}`,
              })
            }
          }
        }
        break
      }
      case 'array':
        if (Object.hasOwn(node, 'items')) {
          tasks.push({
            kind: 'enter',
            node: node.items,
            path: `${path}.items`,
          })
        }
        break
      case 'string':
      case 'number':
      case 'integer':
      case 'boolean':
      case 'null': {
        const hasEnum = Object.hasOwn(node, 'enum')
        const allowed = hasEnum ? node.enum : undefined
        const enumValid = isPlainJsonArray(allowed) && allowed.length > 0
          && allowed.every((entry: any) => scalarMatches(schemaType, entry))
        if (hasEnum && !enumValid) violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`)
        const hasConst = Object.hasOwn(node, 'const')
        const declaredConst = hasConst ? node.const : undefined
        const constValid = scalarMatches(schemaType, declaredConst)
        if (hasConst) {
          if (!constValid) violations.push(`${path}.const must be a ${schemaType} value`)
          else if (enumValid && !allowed.includes(declaredConst)) {
            violations.push(`${path}.const must be one of ${path}.enum when both are declared`)
          }
        }
        break
      }
      /* v8 ignore next -- schemaType was narrowed from the closed SCHEMA_TYPES table above. */
      default: assertNever(schemaType, 'JsonSchemaType')
    }
  }
}

/**
 * Assert that an arbitrary raw schema uses only the enforced subset.
 * Annotation-only schemas are accepted as the standard unconstrained-JSON
 * form; callers that require an object root use {@link assertObjectJsonSchema}.
 */
export function assertSupportedJsonSchema(schema: any): void {
  const violations: string[] = []
  checkSchemaNode(schema, 'schema', violations, new Set())
  if (violations.length > 0) throw new JsonSchemaError(violations)
}

/**
 * Assert the enforced subset plus the object-root constraint retained by
 * subagent and workflow structured outputs.
 */
export function assertObjectJsonSchema(schema: any): void {
  const violations: string[] = []
  checkSchemaNode(schema, 'schema', violations, new Set())
  if (violations.length === 0 && (!isJsonSchemaRecord(schema) || !Object.hasOwn(schema, 'type') || schema.type !== 'object')) {
    violations.push('schema.type must be "object" (structured output is object-rooted)')
  }
  if (violations.length > 0) throw new JsonSchemaError(violations)
}

// ─────────────────────────── dsh-tools 参数值校验 ───────────────────────────
/** Safely test the lossless JSON boundary when a getter may throw. */
function safelyIsJsonValue(value: any): boolean {
  try {
    return isJsonValue(value)
  } catch {
    return false
  }
}

/** Root-aware diagnostic path for the parameter validator's empty sentinel. */
function diagnosticPath(path: any): any {
  return path === '' ? 'arguments' : path
}

/** Append one object property without a leading dot at an implicit root. */
function propertyPath(path: any, key: any): string {
  return path === '' ? key : `${path}.${key}`
}

/** The generic exception-containment diagnostic owned by one valid schema node. */
function losslessValueViolation(path: any): string[] {
  return [`"${diagnosticPath(path)}" must be a lossless JSON value`]
}

/** Append diagnostics without spreading a potentially wide child result as call arguments. */
function appendViolations(target: string[], source: readonly string[]): void {
  for (const violation of source) target.push(violation)
}

/** Initialize one validation frame with empty aggregation state. */
function valueFrame(node: any, value: any, path: any): any {
  return {
    node,
    value,
    path,
    catches: false,
    phase: 'start',
    children: [],
    childIndex: 0,
    violations: [],
    tailViolations: [],
    matches: 0,
  }
}

/** Validate one scalar node after its primitive type check. */
function checkScalarValue(node: any, value: any, path: any): string[] {
  const allowed = Object.hasOwn(node, 'enum') ? node.enum : undefined
  if (allowed !== undefined && !allowed.includes(value)) {
    return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`]
  }
  if (Object.hasOwn(node, 'const') && value !== node.const) {
    return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`]
  }
  return []
}

/** Validate one trusted schema/value pair with explicit frames rather than recursive calls. */
function checkValue(schema: any, value: any, path: any): string[] {
  const frames: any[] = [valueFrame(schema, value, path)]
  let rootResult: string[] | undefined
  const receive = (result: string[]): void => {
    const parent = frames.at(-1)
    if (parent === undefined) {
      rootResult = result
      return
    }
    if (parent.kind === 'oneOf') {
      if (result.length === 0) parent.matches++
    } else appendViolations(parent.violations, result)
  }
  const finish = (result: string[]): void => {
    frames.pop()
    receive(result)
  }
  while (frames.length > 0) {
    const frame = frames.at(-1)
    /* v8 ignore next -- the loop condition guarantees a current frame. */
    if (frame === undefined) break
    try {
      if (frame.phase === 'children') {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex]
          /* v8 ignore next -- childIndex is bounded by children.length. */
          if (child === undefined) throw new Error('missing schema-value child frame')
          frame.childIndex++
          frames.push(valueFrame(child.node, child.value, child.path))
          continue
        }
        if (frame.kind === 'oneOf') {
          finish(frame.matches === 1
            ? []
            : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`])
          continue
        }
        appendViolations(frame.violations, frame.tailViolations)
        if (frame.violations.length > 0) finish(frame.violations)
        else if (frame.kind === 'object') {
          finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`])
        } else {
          finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`])
        }
        continue
      }
      const nodeType = Object.hasOwn(frame.node, 'type') ? frame.node.type : undefined
      frame.catches = !(nodeType !== undefined && !SCHEMA_TYPES.includes(nodeType))
      const oneOf = Object.hasOwn(frame.node, 'oneOf') ? frame.node.oneOf : undefined
      if (oneOf !== undefined) {
        frame.kind = 'oneOf'
        frame.children = Array.from(oneOf, (branch: any) => ({
          node: branch,
          value: frame.value,
          path: frame.path,
        }))
        frame.childIndex = 0
        frame.matches = 0
        frame.phase = 'children'
        continue
      }
      if (nodeType === undefined) {
        finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path))
        continue
      }
      switch (nodeType) {
        case 'object': {
          if (!isPlainJsonRecord(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an object`])
            break
          }
          const properties = Object.hasOwn(frame.node, 'properties') ? frame.node.properties ?? {} : {}
          const violations: string[] = []
          const required = Object.hasOwn(frame.node, 'required') ? frame.node.required ?? [] : []
          for (const key of required) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) {
              violations.push(`missing required property "${propertyPath(frame.path, key)}"`)
            }
          }
          const children: any[] = []
          for (const [key, child] of Object.entries(properties)) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) continue
            children.push({
              node: child,
              value: frame.value[key],
              path: propertyPath(frame.path, key),
            })
          }
          const tailViolations: string[] = []
          if (Object.hasOwn(frame.node, 'additionalProperties') && frame.node.additionalProperties === false) {
            for (const key of Object.keys(frame.value)) {
              if (!Object.hasOwn(properties, key)) {
                tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`)
              }
            }
          }
          frame.kind = 'object'
          frame.children = children
          frame.childIndex = 0
          frame.violations = violations
          frame.tailViolations = tailViolations
          frame.phase = 'children'
          break
        }
        case 'array': {
          if (!Array.isArray(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an array`])
            break
          }
          const items = Object.hasOwn(frame.node, 'items') ? frame.node.items : undefined
          const children = items === undefined ? [] : frame.value.flatMap((entry: any, index: number) => [{
            node: items,
            value: entry,
            path: `${frame.path}[${index}]`,
          }])
          frame.kind = 'array'
          frame.children = children
          frame.childIndex = 0
          frame.violations = []
          frame.phase = 'children'
          break
        }
        case 'string':
          finish(typeof frame.value === 'string'
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be a string`])
          break
        case 'number':
          finish(typeof frame.value !== 'number'
            ? [`"${diagnosticPath(frame.path)}" must be a number`]
            : !isJsonNumber(frame.value)
              ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`]
              : checkScalarValue(frame.node, frame.value, frame.path))
          break
        case 'integer':
          finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value)
            ? [`"${diagnosticPath(frame.path)}" must be an integer`]
            : checkScalarValue(frame.node, frame.value, frame.path))
          break
        case 'boolean':
          finish(typeof frame.value === 'boolean'
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be a boolean`])
          break
        case 'null':
          finish(frame.value === null
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be null`])
          break
        default: finish(assertNever(nodeType, 'JsonSchemaType'))
      }
    } catch (error) {
      let failed = frames.pop()
      while (failed !== undefined && !failed.catches) failed = frames.pop()
      if (failed === undefined) throw error
      receive(losslessValueViolation(failed.path))
    }
  }
  /* v8 ignore next -- every root frame finishes or throws. */
  return rootResult ?? losslessValueViolation(path)
}

/**
 * Validate a candidate value against an asserted raw schema. The function is
 * total for arbitrary values and returns path-qualified violations.
 */
export function validateJsonSchemaValue(schema: any, value: any, path: any = 'value'): string[] {
  return checkValue(schema, value, path)
}

// ─────────────────────────── dsh-tools 作者 schema 编译 ───────────────────────────
const ANNOTATION_KEYS = [
  'description',
  'title',
  'default',
  'examples',
]

/** Throw one author-schema violation through the shared schema error type. */
function authorError(message: string): never {
  throw new JsonSchemaError([message])
}

/** Copy own annotation fields for validation by the raw-schema boundary. */
function copyAnnotations(source: any, target: any): void {
  if (Object.hasOwn(source, 'description')) target.description = source.description
  if (Object.hasOwn(source, 'title')) target.title = source.title
  if (Object.hasOwn(source, 'default')) target.default = source.default
  if (Object.hasOwn(source, 'examples')) target.examples = source.examples
}

/** Reject author-only keys outside one node's declared vocabulary. */
function assertAuthorKeys(source: any, path: string, allowed: string[]): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) authorError(`${path}.${key} is not supported by the value schema DSL`)
  }
}

/** Install a compiled node without giving `__proto__` assignment semantics. */
function assignCompiledNode(destination: any, node: any): void {
  switch (destination.kind) {
    case 'root':
      destination.holder.value = node
      break
    case 'property':
      Object.defineProperty(destination.target, destination.key, {
        value: node,
        enumerable: true,
        configurable: true,
        writable: true,
      })
      break
    case 'item':
      destination.target.items = node
      break
    case 'one-of':
      destination.target[destination.index] = node
      break
  }
}

/** Install a compiled property map at its root or containing object node. */
function assignCompiledPropertyMap(destination: any, compiled: any): void {
  if (destination.kind === 'root') destination.holder.value = compiled
  else destination.target.properties = compiled.properties
}

/** Execute an author-schema compilation task graph without recursive descent. */
function runSchemaCompiler(initial: any): void {
  const seen = new Set<any>()
  const tasks: any[] = [initial]
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === 'leave') {
      seen.delete(task.input)
      continue
    }
    if (task.kind === 'property-map-tail') {
      if (task.required.length > 0) {
        task.compiled.required = task.required
        if (task.destination.kind === 'object') task.destination.target.required = task.required
      }
      continue
    }
    if (task.kind === 'property') {
      if (!isJsonSchemaRecord(task.property)) authorError(`${task.path} must be a value schema object`)
      if (Object.hasOwn(task.property, 'required') && task.property.required !== true) {
        authorError(`${task.path}.required must be true when present`)
      }
      if (Object.hasOwn(task.property, 'required') && task.property.required === true) task.required.push(task.key)
      tasks.push({
        kind: 'value',
        input: task.property,
        path: task.path,
        allowRequired: true,
        destination: {
          kind: 'property',
          target: task.properties,
          key: task.key,
        },
      })
      continue
    }
    if (task.kind === 'property-map') {
      if (!isJsonSchemaRecord(task.input)) authorError(`${task.path} must be an object of value schemas`)
      if (seen.has(task.input)) authorError(`${task.path} is circular`)
      seen.add(task.input)
      const compiled = { properties: {} }
      const required: string[] = []
      assignCompiledPropertyMap(task.destination, compiled)
      tasks.push({
        kind: 'leave',
        input: task.input,
      })
      tasks.push({
        kind: 'property-map-tail',
        compiled,
        required,
        destination: task.destination,
      })
      const entries = Object.entries(task.input)
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]
        /* v8 ignore next -- the loop is bounded by the captured entry count. */
        if (entry === undefined) continue
        tasks.push({
          kind: 'property',
          property: entry[1],
          path: `${task.path}.${entry[0]}`,
          key: entry[0],
          properties: compiled.properties,
          required,
        })
      }
      continue
    }
    const { input, path } = task
    if (!isJsonSchemaRecord(input)) authorError(`${path} must be a value schema object`)
    if (seen.has(input)) authorError(`${path} is circular`)
    seen.add(input)
    const authorKeys = [...ANNOTATION_KEYS, ...task.allowRequired ? ['required'] : []]
    const node: any = {}
    assignCompiledNode(task.destination, node)
    tasks.push({
      kind: 'leave',
      input,
    })
    if (Object.hasOwn(input, 'oneOf')) {
      assertAuthorKeys(input, path, [
        ...authorKeys,
        'oneOf',
        'type',
      ])
      if (Object.hasOwn(input, 'type')) authorError(`${path} cannot declare both type and oneOf`)
      if (!isPlainJsonArray(input.oneOf)) {
        authorError(`${path}.oneOf must be an array of at least two value schemas`)
      }
      const branches: any[] = []
      node.oneOf = branches
      copyAnnotations(input, node)
      for (let index = input.oneOf.length - 1; index >= 0; index--) {
        tasks.push({
          kind: 'value',
          input: input.oneOf[index],
          path: `${path}.oneOf[${index}]`,
          allowRequired: false,
          destination: {
            kind: 'one-of',
            target: branches,
            index,
          },
        })
      }
      continue
    }
    const inputType = Object.hasOwn(input, 'type') ? input.type : undefined
    switch (inputType) {
      case 'json':
        assertAuthorKeys(input, path, [...authorKeys, 'type'])
        copyAnnotations(input, node)
        break
      case 'object':
        assertAuthorKeys(input, path, [
          ...authorKeys,
          'type',
          'properties',
          'additionalProperties',
        ])
        if (!Object.hasOwn(input, 'additionalProperties') || typeof input.additionalProperties !== 'boolean') {
          authorError(`${path}.additionalProperties must be explicitly true or false`)
        }
        node.type = 'object'
        copyAnnotations(input, node)
        node.additionalProperties = input.additionalProperties
        if (Object.hasOwn(input, 'properties')) {
          tasks.push({
            kind: 'property-map',
            input: input.properties,
            path: `${path}.properties`,
            destination: {
              kind: 'object',
              target: node,
            },
          })
        }
        break
      case 'array':
        assertAuthorKeys(input, path, [
          ...authorKeys,
          'type',
          'items',
        ])
        node.type = 'array'
        copyAnnotations(input, node)
        if (Object.hasOwn(input, 'items')) {
          tasks.push({
            kind: 'value',
            input: input.items,
            path: `${path}.items`,
            allowRequired: false,
            destination: {
              kind: 'item',
              target: node,
            },
          })
        }
        break
      case 'string':
      case 'number':
      case 'integer':
      case 'boolean':
      case 'null':
        assertAuthorKeys(input, path, [
          ...authorKeys,
          'type',
          'enum',
          'const',
        ])
        node.type = inputType
        copyAnnotations(input, node)
        if (Object.hasOwn(input, 'enum')) {
          if (!isPlainJsonArray(input.enum)) authorError(`${path}.enum must be a non-empty array of scalar values`)
          node.enum = Array.from(input.enum, (entry: any) => entry)
        }
        if (Object.hasOwn(input, 'const')) node.const = input.const
        break
      default: authorError(`${path}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`)
    }
  }
}

/** Compile one implicit property map, collecting per-property requiredness. */
function compilePropertyMap(input: any, path: string): any {
  const holder: any = {}
  runSchemaCompiler({
    kind: 'property-map',
    input,
    path,
    destination: {
      kind: 'root',
      holder,
    },
  })
  /* v8 ignore next -- the root task assigns before scheduling any descendants. */
  return holder.value ?? authorError(`${path} did not compile`)
}

/** Compile one author node without applying any consumer root restriction. */
function compileValueSchema(input: any, path: string): any {
  const holder: any = {}
  runSchemaCompiler({
    kind: 'value',
    input,
    path,
    allowRequired: false,
    destination: {
      kind: 'root',
      holder,
    },
  })
  /* v8 ignore next -- the root task assigns before scheduling any descendants. */
  return holder.value ?? authorError(`${path} did not compile`)
}

/**
 * Compile one author-facing value schema to the enforced raw JSON Schema
 * subset. The author-only `json` node becomes an annotation-only schema.
 */
export function valueSchemaSpecToJsonSchema(spec: any): any {
  const schema = compileValueSchema(spec, 'schema')
  assertSupportedJsonSchema(schema)
  return schema
}

/**
 * Compile the implicit open parameter object into raw JSON Schema.
 */
export function parameterSchemaSpecToJsonSchema(spec: any): any {
  const compiled = compilePropertyMap(spec, 'parameters')
  const schema = {
    type: 'object',
    properties: compiled.properties,
    ...compiled.required === undefined ? {} : { required: compiled.required },
  }
  assertSupportedJsonSchema(schema)
  return schema
}

/** Invalid model-generated arguments for a typed tool. */
export class ToolArgsError extends HarnessError {
  /** Individual violations in schema-walk order. */
  violations: string[]

  constructor(violations: string[]) {
    super(`invalid arguments: ${violations.join('; ')}`, 'INVALID_ARGS')
    this.name = 'ToolArgsError'
    this.violations = violations
  }
}

/**
 * Validate model-generated arguments against an implicit parameter schema.
 */
export function validateArgs(spec: any, args: any): string[] {
  return validateJsonSchemaValue(parameterSchemaSpecToJsonSchema(spec), args, '')
}

// ──────────────────────────────── defineTool ────────────────────────────────
/** 作者侧的 schema 描述（只为类型提示；运行时按原实现解释）。 */
export interface ValueSchemaSpec {
  type?: string
  description?: string
  title?: string
  default?: unknown
  examples?: unknown
  oneOf?: ValueSchemaSpec[]
  properties?: Record<string, ValueSchemaSpec>
  additionalProperties?: boolean
  items?: ValueSchemaSpec
  enum?: readonly unknown[]
  const?: unknown
  required?: boolean
  [key: string]: unknown
}

/** 参数表：每项是作者侧 schema 描述。 */
export type ParameterSchemaSpec = Record<string, ValueSchemaSpec>

/**
 * 工具执行上下文的最小结构化类型（替代 `@deepseek-ai/dsh-tools` 的 `ToolRunContext`）。
 * 插件只用到 `agent.id` 与 `signal`；其余字段按需保留，运行时由宿主注入。
 */
export interface ToolRunContext {
  readonly agent?: { id?: unknown } | undefined
  readonly signal: AbortSignal
  readonly callId?: unknown
  readonly rootCallId?: unknown
  readonly name?: string
  readonly arguments?: unknown
  readonly schema?: unknown
  readonly token?: unknown
  readonly parent?: unknown
  deferContext?(context: unknown): void
  concludeTurn?(): void
}

export interface DefineToolOptions {
  name: string
  description: string
  parameters: ParameterSchemaSpec
  output: {
    schema: ValueSchemaSpec
    render(args: any, value: any): unknown[]
    presentationMeta?(args: any, value: any): unknown
  }
  timeoutMs?: number
  deferLoading?: boolean
  execute(args: any, exec: ToolRunContext): Promise<unknown>
  projectContent?(exec: any, result: any): unknown
  finalizeContent?(exec: any, result: any): unknown
  presentCall?(args: any): unknown
  presentResult?(args: any, result: any): unknown
  isConcurrencySafe?(args: any): boolean
}

/**
 * Define a first-party tool with inferred arguments and strict execution
 * validation. Replay-only presenters validate softly and fall back to generic
 * rendering for obsolete logged arguments.
 */
export function defineTool(options: DefineToolOptions): any {
  const userExecute = options.execute
  const userFinalizeContent = options.finalizeContent
  const userProjectContent = options.projectContent
  const userRender = options.output.render
  const userPresentationMeta = options.output.presentationMeta
  const userPresentCall = options.presentCall
  const userPresentResult = options.presentResult
  const userIsConcurrencySafe = options.isConcurrencySafe
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`)
  }
  const parameters = parameterSchemaSpecToJsonSchema(options.parameters)
  const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema)
  const validate = (args: any): string[] => validateJsonSchemaValue(parameters, args, '')
  const tool: any = {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: outputSchema,
      render(args: any, value: any): unknown[] {
        return userRender(args, value)
      },
      ...userPresentationMeta !== undefined ? {
        presentationMeta(args: any, value: any): unknown {
          return userPresentationMeta(args, value)
        },
      } : {},
    },
    ...options.deferLoading === true ? { deferLoading: options.deferLoading } : {},
    ...options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {},
    async execute(args: any, exec: any): Promise<unknown> {
      const violations = validate(args)
      if (violations.length > 0) throw new ToolArgsError(violations)
      return userExecute(args, exec)
    },
  }
  if (userProjectContent) tool.projectContent = (exec: any, result: any) => userProjectContent(exec, result)
  if (userFinalizeContent) tool.finalizeContent = (exec: any, result: any) => userFinalizeContent(exec, result)
  if (userPresentCall) {
    tool.presentCall = (args: any) => {
      if (validate(args).length > 0) return undefined
      return userPresentCall(args)
    }
  }
  if (userPresentResult) {
    tool.presentResult = (args: any, result: any) => {
      if (validate(args).length > 0) return undefined
      return userPresentResult(args, result)
    }
  }
  if (userIsConcurrencySafe) {
    tool.isConcurrencySafe = (args: any) => {
      if (validate(args).length > 0) return false
      return userIsConcurrencySafe(args)
    }
  }
  return tool
}
