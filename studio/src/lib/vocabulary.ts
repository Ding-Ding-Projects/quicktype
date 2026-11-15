// Personal wording files: a strict, local-only loader.
//
// The file format is the neutral version 1 contract documented in
// docs/studio/features/personal-wording.md. No wording ships with the app:
// until a user supplies a valid file, every surface shows its original text.

export const VOCABULARY_LIMITS = Object.freeze({
    maxBytes: 256 * 1024,
    maxDepth: 8,
    maxKeyCodePoints: 160,
    maxValueCodePoints: 1000,
    schemaVersion: 1,
});

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
// Control characters other than tab, line feed and carriage return.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type VocabularyProblem =
    | { code: "tooLarge"; limit: number }
    | { code: "notUtf8" }
    | { code: "malformed"; at: number }
    | { code: "duplicateKey"; key: string }
    | { code: "tooDeep"; limit: number }
    | { code: "rootShape" }
    | { code: "version"; found: unknown }
    | { code: "unsafeKey" }
    | { code: "keyLength" }
    | { code: "valueType" }
    | { code: "valueLength" }
    | { code: "controlCharacter" };

export interface Vocabulary {
    schemaVersion: 1;
    entries: Record<string, string>;
}

export type ParseResult =
    | { ok: true; vocabulary: Vocabulary }
    | { ok: false; problem: VocabularyProblem };

class StrictJsonError extends Error {
    constructor(public readonly problem: VocabularyProblem) {
        super(problem.code);
    }
}

/** A JSON parser that rejects duplicate keys and excessive nesting. */
function parseStrict(text: string): unknown {
    let i = 0;
    const fail = (): never => {
        throw new StrictJsonError({ code: "malformed", at: i });
    };
    const ws = () => {
        while (i < text.length && " \t\n\r".includes(text[i])) i++;
    };
    const str = (): string => {
        if (text[i] !== '"') fail();
        i++;
        let out = "";
        while (i < text.length) {
            const c = text[i++];
            if (c === '"') return out;
            if (c === "\\") {
                const e = text[i++];
                const map: Record<string, string> = {
                    '"': '"',
                    "\\": "\\",
                    "/": "/",
                    b: "\b",
                    f: "\f",
                    n: "\n",
                    r: "\r",
                    t: "\t",
                };
                if (e in map) out += map[e];
                else if (e === "u") {
                    const hex = text.slice(i, i + 4);
                    if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
                    out += String.fromCharCode(Number.parseInt(hex, 16));
                    i += 4;
                } else fail();
            } else {
                if (c < " ") fail();
                out += c;
            }
        }
        return fail();
    };
    const value = (depth: number): unknown => {
        ws();
        const c = text[i];
        if (c === "{") {
            if (depth + 1 > VOCABULARY_LIMITS.maxDepth) {
                throw new StrictJsonError({
                    code: "tooDeep",
                    limit: VOCABULARY_LIMITS.maxDepth,
                });
            }
            i++;
            const obj: Record<string, unknown> = Object.create(null);
            const seen = new Set<string>();
            ws();
            if (text[i] === "}") {
                i++;
                return obj;
            }
            for (;;) {
                ws();
                const key = str();
                if (seen.has(key))
                    throw new StrictJsonError({ code: "duplicateKey", key });
                seen.add(key);
                ws();
                if (text[i++] !== ":") fail();
                obj[key] = value(depth + 1);
                ws();
                const n = text[i++];
                if (n === "}") return obj;
                if (n !== ",") fail();
            }
        }
        if (c === "[") {
            if (depth + 1 > VOCABULARY_LIMITS.maxDepth) {
                throw new StrictJsonError({
                    code: "tooDeep",
                    limit: VOCABULARY_LIMITS.maxDepth,
                });
            }
            i++;
            const arr: unknown[] = [];
            ws();
            if (text[i] === "]") {
                i++;
                return arr;
            }
            for (;;) {
                arr.push(value(depth + 1));
                ws();
                const n = text[i++];
                if (n === "]") return arr;
                if (n !== ",") fail();
            }
        }
        if (c === '"') return str();
        const m =
            /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(
                text.slice(i),
            );
        if (!m) return fail();
        i += m[0].length;
        return JSON.parse(m[0]);
    };
    const result = value(0);
    ws();
    if (i !== text.length) fail();
    return result;
}

const codePoints = (s: string) => [...s].length;

/** Validate the complete payload. Nothing is applied unless everything passes. */
export function parseVocabulary(bytes: Uint8Array): ParseResult {
    if (bytes.byteLength > VOCABULARY_LIMITS.maxBytes) {
        return {
            ok: false,
            problem: { code: "tooLarge", limit: VOCABULARY_LIMITS.maxBytes },
        };
    }
    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return { ok: false, problem: { code: "notUtf8" } };
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    let root: unknown;
    try {
        root = parseStrict(text);
    } catch (e) {
        if (e instanceof StrictJsonError)
            return { ok: false, problem: e.problem };
        return { ok: false, problem: { code: "malformed", at: 0 } };
    }
    if (root === null || typeof root !== "object" || Array.isArray(root))
        return { ok: false, problem: { code: "rootShape" } };
    const keys = Object.keys(root);
    if (
        keys.length !== 2 ||
        !keys.includes("schemaVersion") ||
        !keys.includes("entries")
    ) {
        return { ok: false, problem: { code: "rootShape" } };
    }
    const r = root as Record<string, unknown>;
    if (r.schemaVersion !== VOCABULARY_LIMITS.schemaVersion)
        return {
            ok: false,
            problem: { code: "version", found: r.schemaVersion },
        };
    const entries = r.entries;
    if (
        entries === null ||
        typeof entries !== "object" ||
        Array.isArray(entries)
    )
        return { ok: false, problem: { code: "rootShape" } };
    const clean: Record<string, string> = {};
    for (const [key, val] of Object.entries(
        entries as Record<string, unknown>,
    )) {
        if (UNSAFE_KEYS.has(key))
            return { ok: false, problem: { code: "unsafeKey" } };
        if (
            key.length === 0 ||
            codePoints(key) > VOCABULARY_LIMITS.maxKeyCodePoints
        )
            return { ok: false, problem: { code: "keyLength" } };
        if (typeof val !== "string")
            return { ok: false, problem: { code: "valueType" } };
        if (codePoints(val) > VOCABULARY_LIMITS.maxValueCodePoints)
            return { ok: false, problem: { code: "valueLength" } };
        if (CONTROL.test(key) || CONTROL.test(val))
            return { ok: false, problem: { code: "controlCharacter" } };
        clean[key] = val;
    }
    return { ok: true, vocabulary: { schemaVersion: 1, entries: clean } };
}

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a replacer that applies the longest key first at word edges. */
export function makeReplacer(
    vocabulary: Vocabulary | null,
): (text: string) => string {
    if (!vocabulary) return (text) => text;
    const keys = Object.keys(vocabulary.entries).sort(
        (a, b) => b.length - a.length,
    );
    if (keys.length === 0) return (text) => text;
    const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${keys.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "gu",
    );
    return (text) => text.replace(pattern, (m) => vocabulary.entries[m] ?? m);
}

/** The headline for the apply celebration: the file's own name for itself. */
export function celebrationHeadline(vocabulary: Vocabulary): string | null {
    const v = vocabulary.entries["private vocabulary"];
    return typeof v === "string" && v.trim() !== "" ? v : null;
}
