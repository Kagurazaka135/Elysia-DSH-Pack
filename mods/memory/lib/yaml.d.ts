/**
 * 受限 YAML 子集读写 —— 零依赖，只覆盖 `$DSH_HOME/memory/` 里我们自己写出的形状：
 *
 *   顶层：数组（数组项为对象）或对象；对象属性值：标量 / 标量数组（flow）/ 对象数组（block）。
 *   字符串一律 JSON 双引号转义（JSON 是 YAML 1.2 子集 ⇒ 输出是合法 YAML，也人可读）。
 *
 * 明确不支持：锚点、别名、块标量（| / >）、多行 flow、标签。手工编辑请保持结构，
 * 或干脆用 memory_* 工具改。解析失败会带着位置明确报错 —— 绝不猜测、绝不半写。
 */
export type YamlScalar = string | number | boolean | null;
export type YamlValue = YamlScalar | YamlValue[] | {
    [key: string]: YamlValue;
};
/** 序列化为受限 YAML；`headerLines` 会以 `# ` 注释写在最前面。 */
export declare function toYaml(value: YamlValue, headerLines?: readonly string[]): string;
/** 解析受限 YAML；空内容返回 null。 */
export declare function parseYaml(text: string): YamlValue | null;
