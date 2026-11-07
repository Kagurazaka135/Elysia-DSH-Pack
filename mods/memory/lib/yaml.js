/**
 * 受限 YAML 子集读写 —— 零依赖，只覆盖 `$DSH_HOME/memory/` 里我们自己写出的形状：
 *
 *   顶层：数组（数组项为对象）或对象；对象属性值：标量 / 标量数组（flow）/ 对象数组（block）。
 *   字符串一律 JSON 双引号转义（JSON 是 YAML 1.2 子集 ⇒ 输出是合法 YAML，也人可读）。
 *
 * 明确不支持：锚点、别名、块标量（| / >）、多行 flow、标签。手工编辑请保持结构，
 * 或干脆用 memory_* 工具改。解析失败会带着位置明确报错 —— 绝不猜测、绝不半写。
 */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isScalar(value) {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
function isScalarArray(value) {
    return Array.isArray(value) && value.every(item => isScalar(item));
}
function scalarText(value) {
    if (Array.isArray(value))
        return JSON.stringify(value);
    if (typeof value === 'string')
        return JSON.stringify(value);
    return JSON.stringify(value);
}
function writeBlock(value, indent, out) {
    const pad = ' '.repeat(indent);
    if (Array.isArray(value)) {
        for (const item of value) {
            if (isScalarArray(item) || isScalar(item)) {
                out.push(`${pad}- ${scalarText(item)}`);
                continue;
            }
            if (isRecord(item)) {
                const keys = Object.keys(item);
                if (keys.length === 0) {
                    out.push(`${pad}- {}`);
                    continue;
                }
                let first = true;
                for (const key of keys) {
                    const child = item[key];
                    const lead = first ? `${pad}- ` : `${pad}  `;
                    first = false;
                    if (isScalar(child) || isScalarArray(child)) {
                        out.push(`${lead}${key}: ${scalarText(child)}`);
                    }
                    else {
                        out.push(`${lead}${key}:`);
                        writeBlock(child, indent + 4, out);
                    }
                }
                continue;
            }
            // 嵌套数组项（我们没用到，但保持可写）
            out.push(`${pad}-`);
            writeBlock(item, indent + 2, out);
        }
        return;
    }
    if (isRecord(value)) {
        for (const [key, child] of Object.entries(value)) {
            if (isScalar(child) || isScalarArray(child)) {
                out.push(`${pad}${key}: ${scalarText(child)}`);
            }
            else {
                out.push(`${pad}${key}:`);
                writeBlock(child, indent + 2, out);
            }
        }
        return;
    }
    out.push(`${pad}${scalarText(value)}`);
}
/** 序列化为受限 YAML；`headerLines` 会以 `# ` 注释写在最前面。 */
export function toYaml(value, headerLines) {
    const lines = [];
    for (const line of headerLines ?? []) {
        const text = line.trim();
        lines.push(text.startsWith('#') ? text : `# ${text}`);
    }
    writeBlock(value, 0, lines);
    return lines.join('\n') + '\n';
}
/** 去掉行内注释：` #` 之后的内容（双引号内的 `#` 不算）。 */
function stripInlineComment(text) {
    let inQuote = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inQuote) {
            if (ch === '\\')
                i += 1;
            else if (ch === '"')
                inQuote = false;
            continue;
        }
        if (ch === '"') {
            inQuote = true;
            continue;
        }
        if (ch === '#' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\t')) {
            return text.slice(0, i).trimEnd();
        }
    }
    return text;
}
/** 拆 `key: rest`；`key` 支持裸标识符或 JSON 双引号串。找不到合法 key 时返回 null。 */
function splitKey(text) {
    let inQuote = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inQuote) {
            if (ch === '\\')
                i += 1;
            else if (ch === '"')
                inQuote = false;
            continue;
        }
        if (ch === '"') {
            inQuote = true;
            continue;
        }
        if (ch !== ':')
            continue;
        const keyText = text.slice(0, i).trim();
        if (keyText === '')
            return null;
        if (keyText.startsWith('"')) {
            try {
                const key = JSON.parse(keyText);
                if (typeof key !== 'string')
                    return null;
                return { key, rest: text.slice(i + 1).trim() };
            }
            catch {
                return null;
            }
        }
        if (!/^[A-Za-z0-9_.\-\u4e00-\u9fff]+$/.test(keyText))
            return null;
        return { key: keyText, rest: text.slice(i + 1).trim() };
    }
    return null;
}
function parseScalar(text, lineNumber) {
    const t = text.trim();
    if (t === '' || t === '~' || t === 'null')
        return null;
    if (t === 'true')
        return true;
    if (t === 'false')
        return false;
    if (t.startsWith('"') || t.startsWith('[') || t.startsWith('{')) {
        try {
            return JSON.parse(t);
        }
        catch {
            throw new Error(`dsh-memory: 第 ${lineNumber} 行标量解析失败（看起来是 JSON 但无法解析）：${t.slice(0, 80)}`);
        }
    }
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t))
        return Number(t);
    return t;
}
function parseBlock(lines, start, indent) {
    const first = lines[start];
    if (first === undefined)
        return { value: null, next: start };
    if (first.text === '-' || first.text.startsWith('- '))
        return parseArray(lines, start, indent);
    if (splitKey(first.text) !== null)
        return parseMapping(lines, start, indent);
    return { value: parseScalar(first.text, first.number), next: start + 1 };
}
function parseArray(lines, start, indent) {
    const items = [];
    let i = start;
    while (i < lines.length) {
        const line = lines[i];
        if (line.indent !== indent)
            break;
        if (!(line.text === '-' || line.text.startsWith('- ')))
            break;
        const rest = line.text === '-' ? '' : line.text.slice(2).trim();
        if (rest === '') {
            const childIndent = i + 1 < lines.length ? lines[i + 1].indent : -1;
            if (childIndent <= indent) {
                items.push(null);
                i += 1;
                continue;
            }
            const nested = parseBlock(lines, i + 1, childIndent);
            items.push(nested.value);
            i = nested.next;
            continue;
        }
        // 收集本项后续行（缩进 > 本项缩进），拼成该对象的子块
        let end = i + 1;
        while (end < lines.length && lines[end].indent > indent)
            end += 1;
        if (splitKey(rest) !== null) {
            const itemLines = [{ indent: indent + 2, text: rest, number: line.number }, ...lines.slice(i + 1, end)];
            const nested = parseMapping(itemLines, 0, indent + 2);
            items.push(nested.value);
        }
        else {
            items.push(parseScalar(rest, line.number));
        }
        i = end;
    }
    return { value: items, next: i };
}
function parseMapping(lines, start, indent) {
    const value = {};
    let i = start;
    while (i < lines.length && lines[i].indent === indent) {
        const line = lines[i];
        const pair = splitKey(line.text);
        if (pair === null)
            break;
        if (pair.rest === '') {
            const childIndent = i + 1 < lines.length ? lines[i + 1].indent : -1;
            if (childIndent > indent) {
                const nested = parseBlock(lines, i + 1, childIndent);
                value[pair.key] = nested.value;
                i = nested.next;
            }
            else {
                value[pair.key] = null;
                i += 1;
            }
            continue;
        }
        value[pair.key] = parseScalar(pair.rest, line.number);
        i += 1;
    }
    return { value, next: i };
}
/** 解析受限 YAML；空内容返回 null。 */
export function parseYaml(text) {
    const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const lines = [];
    rawLines.forEach((raw, index) => {
        if (raw.trim() === '' || raw.trimStart().startsWith('#'))
            return;
        if (/^\t/.test(raw))
            throw new Error(`dsh-memory: 第 ${index + 1} 行使用了 Tab 缩进（受限 YAML 不支持）`);
        const trimmedEnd = stripInlineComment(raw.trimEnd());
        if (trimmedEnd.trim() === '')
            return;
        const indent = trimmedEnd.length - trimmedEnd.trimStart().length;
        lines.push({ indent, text: trimmedEnd.trim(), number: index + 1 });
    });
    if (lines.length === 0)
        return null;
    const result = parseBlock(lines, 0, lines[0].indent);
    if (result.next < lines.length) {
        throw new Error(`dsh-memory: 第 ${lines[result.next].number} 行缩进不合法，无法解析（受限 YAML）`);
    }
    return result.value;
}
