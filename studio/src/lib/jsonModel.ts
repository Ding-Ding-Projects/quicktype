// Document model for the JSON editor: immutable edits addressed by paths,
// labelled undo and redo, a JSONPath subset, statistics and transforms.

export type JSONValue =
    | null
    | boolean
    | number
    | string
    | JSONValue[]
    | { [k: string]: JSONValue };
export type Seg = string | number;
export type Path = Seg[];
export type Kind =
    | "object"
    | "array"
    | "string"
    | "number"
    | "boolean"
    | "null";

export const kindOf = (v: JSONValue): Kind =>
    v === null
        ? "null"
        : Array.isArray(v)
          ? "array"
          : typeof v === "object"
            ? "object"
            : (typeof v as Kind);

export function get(doc: JSONValue, path: Path): JSONValue | undefined {
    let cur: JSONValue | undefined = doc;
    for (const seg of path) {
        if (cur === null || typeof cur !== "object") return undefined;
        cur = Array.isArray(cur)
            ? cur[seg as number]
            : (cur as Record<string, JSONValue>)[seg as string];
    }
    return cur;
}

function setIn(
    doc: JSONValue,
    path: Path,
    fn: (v: JSONValue | undefined) => JSONValue | undefined,
): JSONValue {
    if (path.length === 0) return fn(doc) ?? null;
    const [head, ...rest] = path;
    if (Array.isArray(doc)) {
        const copy = [...doc];
        const next = rest.length
            ? setIn(copy[head as number], rest, fn)
            : fn(copy[head as number]);
        if (next === undefined) copy.splice(head as number, 1);
        else copy[head as number] = next;
        return copy;
    }
    if (doc && typeof doc === "object") {
        const obj = doc as Record<string, JSONValue>;
        const next = rest.length
            ? setIn(obj[head as string], rest, fn)
            : fn(obj[head as string]);
        const out: Record<string, JSONValue> = {};
        for (const k of Object.keys(obj)) {
            if (k !== head) out[k] = obj[k];
            else if (next !== undefined) out[k] = next;
        }
        if (!(head in obj) && next !== undefined) out[head as string] = next;
        return out;
    }
    throw new Error(
        "cannot descend into a value that is not an object or array",
    );
}

export const setValue = (doc: JSONValue, path: Path, value: JSONValue) =>
    setIn(doc, path, () => value);
export const remove = (doc: JSONValue, path: Path) =>
    setIn(doc, path, () => undefined);

/** Rename an object key, keeping its position. Refuses a key that already exists. */
export function renameKey(
    doc: JSONValue,
    path: Path,
    newKey: string,
): JSONValue {
    const parentPath = path.slice(0, -1);
    const oldKey = path[path.length - 1] as string;
    const parent = get(doc, parentPath);
    if (!parent || typeof parent !== "object" || Array.isArray(parent))
        throw new Error("only object keys can be renamed");
    if (newKey !== oldKey && newKey in parent)
        throw new Error(`the key "${newKey}" already exists here`);
    const out: Record<string, JSONValue> = {};
    for (const [k, v] of Object.entries(parent))
        out[k === oldKey ? newKey : k] = v;
    return setValue(doc, parentPath, out);
}

function uniqueKey(obj: Record<string, JSONValue>, base: string) {
    if (!(base in obj)) return base;
    for (let i = 2; ; i++) if (!(`${base}${i}` in obj)) return `${base}${i}`;
}

/** Insert a child into an object or array container. Returns the new document and the new child's path. */
export function insertChild(
    doc: JSONValue,
    containerPath: Path,
    value: JSONValue,
    at?: number,
    key = "newKey",
): { doc: JSONValue; path: Path } {
    const container = get(doc, containerPath);
    if (Array.isArray(container)) {
        const index = at ?? container.length;
        const copy = [...container];
        copy.splice(index, 0, value);
        return {
            doc: setValue(doc, containerPath, copy),
            path: [...containerPath, index],
        };
    }
    if (container && typeof container === "object") {
        const obj = container as Record<string, JSONValue>;
        const name = uniqueKey(obj, key);
        const entries = Object.entries(obj);
        entries.splice(at ?? entries.length, 0, [name, value]);
        return {
            doc: setValue(doc, containerPath, Object.fromEntries(entries)),
            path: [...containerPath, name],
        };
    }
    throw new Error("children can only be added to objects and arrays");
}

export function duplicate(
    doc: JSONValue,
    path: Path,
): { doc: JSONValue; path: Path } {
    const parentPath = path.slice(0, -1);
    const parent = get(doc, parentPath);
    const v = structuredClone(get(doc, path) as JSONValue);
    if (Array.isArray(parent))
        return insertChild(
            doc,
            parentPath,
            v,
            (path[path.length - 1] as number) + 1,
        );
    const keys = Object.keys(parent as object);
    return insertChild(
        doc,
        parentPath,
        v,
        keys.indexOf(path[path.length - 1] as string) + 1,
        `${path[path.length - 1]}Copy`,
    );
}

/** Move a node one place up or down among its siblings. */
export function move(
    doc: JSONValue,
    path: Path,
    delta: number,
): { doc: JSONValue; path: Path } {
    const parentPath = path.slice(0, -1);
    const parent = get(doc, parentPath);
    const last = path[path.length - 1];
    if (Array.isArray(parent)) {
        const i = last as number;
        const j = i + delta;
        if (j < 0 || j >= parent.length) return { doc, path };
        const copy = [...parent];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return {
            doc: setValue(doc, parentPath, copy),
            path: [...parentPath, j],
        };
    }
    const entries = Object.entries(parent as Record<string, JSONValue>);
    const i = entries.findIndex(([k]) => k === last);
    const j = i + delta;
    if (j < 0 || j >= entries.length) return { doc, path };
    [entries[i], entries[j]] = [entries[j], entries[i]];
    return {
        doc: setValue(doc, parentPath, Object.fromEntries(entries)),
        path,
    };
}

/** Move a node to another container (drag and drop). */
export function relocate(
    doc: JSONValue,
    from: Path,
    toContainer: Path,
    at?: number,
): { doc: JSONValue; path: Path } {
    if (
        toContainer.length >= from.length &&
        from.every((s, i) => toContainer[i] === s)
    )
        throw new Error("a node cannot be moved inside itself");
    const value = get(doc, from) as JSONValue;
    const key =
        typeof from[from.length - 1] === "string"
            ? (from[from.length - 1] as string)
            : "item";
    // Adjust the target index when moving within the same array.
    let target = at;
    const sameParent =
        from.length - 1 === toContainer.length &&
        toContainer.every((s, i) => from[i] === s);
    if (
        sameParent &&
        Array.isArray(get(doc, toContainer)) &&
        target !== undefined &&
        (from[from.length - 1] as number) < target
    )
        target -= 1;
    const without = remove(doc, from);
    return insertChild(without, toContainer, value, target, key);
}

export function convert(value: JSONValue, to: Kind): JSONValue {
    const from = kindOf(value);
    if (from === to) return value;
    switch (to) {
        case "null":
            return null;
        case "boolean":
            return from === "string"
                ? value === "true" || (value as string).length > 0
                : from === "number"
                  ? value !== 0
                  : from !== "null";
        case "number": {
            const n = Number(from === "boolean" ? Number(value) : value);
            return Number.isFinite(n) ? n : 0;
        }
        case "string":
            return from === "object" || from === "array"
                ? JSON.stringify(value)
                : String(value);
        case "array":
            return from === "object"
                ? Object.values(value as object)
                : value === null
                  ? []
                  : [value];
        case "object":
            return from === "array"
                ? Object.fromEntries(
                      (value as JSONValue[]).map((v, i) => [String(i), v]),
                  )
                : value === null
                  ? {}
                  : { value };
    }
}

export function parseScalar(text: string, kind: Kind): JSONValue {
    if (kind === "string") return text;
    if (kind === "number") {
        const n = Number(text);
        if (!Number.isFinite(n) || text.trim() === "")
            throw new Error(`"${text}" is not a number`);
        return n;
    }
    if (kind === "boolean") {
        if (text !== "true" && text !== "false")
            throw new Error("use true or false");
        return text === "true";
    }
    if (kind === "null") return null;
    return JSON.parse(text);
}

export function stats(doc: JSONValue) {
    let nodes = 0;
    let depth = 0;
    const kinds: Record<Kind, number> = {
        object: 0,
        array: 0,
        string: 0,
        number: 0,
        boolean: 0,
        null: 0,
    };
    const walk = (v: JSONValue, d: number) => {
        nodes++;
        depth = Math.max(depth, d);
        kinds[kindOf(v)]++;
        if (Array.isArray(v)) for (const x of v) walk(x, d + 1);
        else if (v && typeof v === "object")
            for (const x of Object.values(v)) walk(x, d + 1);
    };
    walk(doc, 0);
    return {
        nodes,
        depth,
        kinds,
        bytes: new TextEncoder().encode(JSON.stringify(doc)).length,
    };
}

export function sortKeys(v: JSONValue, deep = true): JSONValue {
    if (Array.isArray(v)) return deep ? v.map((x) => sortKeys(x, deep)) : v;
    if (v && typeof v === "object")
        return Object.fromEntries(
            Object.keys(v)
                .sort((a, b) => a.localeCompare(b))
                .map((k) => [
                    k,
                    deep
                        ? sortKeys((v as Record<string, JSONValue>)[k], deep)
                        : (v as Record<string, JSONValue>)[k],
                ]),
        );
    return v;
}

export function removeNulls(v: JSONValue): JSONValue {
    if (Array.isArray(v)) return v.filter((x) => x !== null).map(removeNulls);
    if (v && typeof v === "object")
        return Object.fromEntries(
            Object.entries(v)
                .filter(([, x]) => x !== null)
                .map(([k, x]) => [k, removeNulls(x)]),
        );
    return v;
}

/** Display form of a path: $.a.b[2]["odd key"] */
export function pathToString(path: Path) {
    return `$${path.map((s) => (typeof s === "number" ? `[${s}]` : /^[A-Za-z_$][\w$]*$/.test(s) ? `.${s}` : `[${JSON.stringify(s)}]`)).join("")}`;
}

/** JSON Pointer form of a path (RFC 6901). */
export const pathToPointer = (path: Path) =>
    path.length
        ? `/${path.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`
        : "";

/**
 * Evaluate a JSONPath subset: $, .key, ["key"], [n], [-n], [*], .*, ..key and [a:b].
 * Returns every matching path.
 */
export function query(doc: JSONValue, expr: string): Path[] {
    const src = expr.trim();
    if (!src.startsWith("$")) throw new Error("a query starts with $");
    type Step =
        | { kind: "child"; key: Seg | "*" }
        | { kind: "deep"; key: string | "*" }
        | { kind: "slice"; from?: number; to?: number };
    const steps: Step[] = [];
    let i = 1;
    while (i < src.length) {
        if (src.startsWith("..", i)) {
            const m = /^\.\.(\*|[A-Za-z_$][\w$-]*)/.exec(src.slice(i));
            if (!m)
                throw new Error(`cannot read the query near "${src.slice(i)}"`);
            steps.push({ kind: "deep", key: m[1] });
            i += m[0].length;
        } else if (src[i] === ".") {
            const m = /^\.(\*|[A-Za-z_$][\w$-]*)/.exec(src.slice(i));
            if (!m)
                throw new Error(`cannot read the query near "${src.slice(i)}"`);
            steps.push({ kind: "child", key: m[1] });
            i += m[0].length;
        } else if (src[i] === "[") {
            const end = src.indexOf("]", i);
            if (end < 0) throw new Error("a [ is not closed");
            const inner = src.slice(i + 1, end).trim();
            if (inner === "*") steps.push({ kind: "child", key: "*" });
            else if (/^-?\d+$/.test(inner))
                steps.push({ kind: "child", key: Number(inner) });
            else if (/^-?\d*:-?\d*$/.test(inner)) {
                const [a, b] = inner.split(":");
                steps.push({
                    kind: "slice",
                    from: a === "" ? undefined : Number(a),
                    to: b === "" ? undefined : Number(b),
                });
            } else if (/^(["']).*\1$/.test(inner))
                steps.push({ kind: "child", key: inner.slice(1, -1) });
            else throw new Error(`cannot read the selector [${inner}]`);
            i = end + 1;
        } else throw new Error(`cannot read the query near "${src.slice(i)}"`);
    }
    const children = (v: JSONValue | undefined, p: Path): Path[] =>
        Array.isArray(v)
            ? v.map((_, k) => [...p, k])
            : v && typeof v === "object"
              ? Object.keys(v).map((k) => [...p, k])
              : [];
    let current: Path[] = [[]];
    for (const step of steps) {
        const next: Path[] = [];
        for (const p of current) {
            const v = get(doc, p);
            if (step.kind === "child") {
                if (step.key === "*") next.push(...children(v, p));
                else if (typeof step.key === "number" && Array.isArray(v)) {
                    const idx = step.key < 0 ? v.length + step.key : step.key;
                    if (idx >= 0 && idx < v.length) next.push([...p, idx]);
                } else if (
                    v &&
                    typeof v === "object" &&
                    !Array.isArray(v) &&
                    String(step.key) in v
                )
                    next.push([...p, String(step.key)]);
            } else if (step.kind === "slice") {
                if (Array.isArray(v)) {
                    const n = v.length;
                    const norm = (x: number | undefined, d: number) =>
                        x === undefined
                            ? d
                            : x < 0
                              ? Math.max(0, n + x)
                              : Math.min(n, x);
                    for (let k = norm(step.from, 0); k < norm(step.to, n); k++)
                        next.push([...p, k]);
                }
            } else {
                const visit = (q: Path) => {
                    const val = get(doc, q);
                    for (const c of children(val, q)) {
                        if (step.key === "*" || c[c.length - 1] === step.key)
                            next.push(c);
                        visit(c);
                    }
                };
                visit(p);
            }
        }
        current = next;
    }
    return current;
}

export interface HistoryItem {
    label: string;
    doc: JSONValue;
}

/** Labelled undo and redo over whole-document snapshots (structural sharing keeps them cheap). */
export class History {
    private past: HistoryItem[] = [];
    private future: HistoryItem[] = [];
    constructor(
        public current: JSONValue,
        private limit = 200,
    ) {}
    push(label: string, doc: JSONValue) {
        this.past.push({ label, doc: this.current });
        if (this.past.length > this.limit) this.past.shift();
        this.future = [];
        this.current = doc;
    }
    undo(): string | null {
        const prev = this.past.pop();
        if (!prev) return null;
        this.future.push({ label: prev.label, doc: this.current });
        this.current = prev.doc;
        return prev.label;
    }
    redo(): string | null {
        const next = this.future.pop();
        if (!next) return null;
        this.past.push({ label: next.label, doc: this.current });
        this.current = next.doc;
        return next.label;
    }
    get canUndo() {
        return this.past.length > 0;
    }
    get canRedo() {
        return this.future.length > 0;
    }
    labels() {
        return {
            past: this.past.map((p) => p.label),
            future: [...this.future].reverse().map((f) => f.label),
        };
    }
    /** Jump back n steps at once. */
    undoTo(stepsBack: number) {
        for (let i = 0; i < stepsBack; i++) this.undo();
    }
}

/** Find the index of the first syntax error, for engines whose messages carry no position. */
export function findErrorIndex(src: string): number {
    let i = 0;
    const ws = () => {
        while (i < src.length && " \t\n\r".includes(src[i])) i++;
    };
    const fail = (): never => {
        throw i;
    };
    const str = () => {
        if (src[i] !== '"') fail();
        i++;
        while (i < src.length && src[i] !== '"') {
            if (src[i] === "\\") i++;
            else if (src[i] < " ") fail();
            i++;
        }
        if (src[i] !== '"') fail();
        i++;
    };
    const value = (): void => {
        ws();
        const c = src[i];
        if (c === "{" || c === "[") {
            const close = c === "{" ? "}" : "]";
            i++;
            ws();
            if (src[i] === close) {
                i++;
                return;
            }
            for (;;) {
                ws();
                if (c === "{") {
                    str();
                    ws();
                    if (src[i] !== ":") fail();
                    i++;
                }
                value();
                ws();
                if (src[i] === ",") i++;
                else if (src[i] === close) {
                    i++;
                    return;
                } else fail();
            }
        }
        if (c === '"') return str();
        const m =
            /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(
                src.slice(i),
            );
        if (!m) fail();
        i += (m as RegExpExecArray)[0].length;
    };
    try {
        value();
        ws();
        return i < src.length ? i : -1;
    } catch (at) {
        return typeof at === "number" ? at : 0;
    }
}

/** Parse JSON and report a friendly line and column on failure. Accepts comments and trailing commas when lenient. */
export function parseDocument(
    text: string,
    lenient = false,
):
    | { ok: true; value: JSONValue }
    | { ok: false; message: string; line: number; column: number } {
    let src = text;
    if (lenient)
        src = src
            .replace(
                /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
                (m, s) => s ?? "",
            )
            .replace(/,(\s*[}\]])/g, "$1");
    try {
        return { ok: true, value: JSON.parse(src) as JSONValue };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        let pos = Number(/position (\d+)/.exec(message)?.[1] ?? Number.NaN);
        if (!Number.isFinite(pos)) pos = findErrorIndex(src);
        let line = 1;
        let column = 1;
        const lc = /line (\d+) column (\d+)/.exec(message);
        if (lc) {
            line = Number(lc[1]);
            column = Number(lc[2]);
        } else if (Number.isFinite(pos)) {
            const before = src.slice(0, pos).split("\n");
            line = before.length;
            column = before[before.length - 1].length + 1;
        }
        return {
            ok: false,
            message: message
                .replace(/^JSON\.parse: /, "")
                .replace(/ in JSON at position \d+.*$/, ""),
            line,
            column,
        };
    }
}
