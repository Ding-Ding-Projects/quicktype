// A small, language-agnostic syntax highlighter for generated code and JSON.
// It returns escaped HTML made of spans with token classes, never raw input.

const KEYWORDS = new Set(
    (
        "abstract and as async await bool boolean break byte case catch char class const constructor continue data def default defer delegate do double dynamic elif else enum export extends extension false final finally fn for from func function get go if impl implements import in init int interface internal is let long map match module mut namespace new nil none not null object of open operator or override package pass private protected pub public raise readonly record return sealed self set short static string struct super switch this throw throws trait true try type typealias typedef typeof uint union unsafe use using val var virtual void when where while with yield " +
        "Int Int64 Double Float Bool String Any List Map Vec Option Some Result Self i64 i32 f64 u64 usize str"
    ).split(" "),
);

const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
    );

const TOKEN =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#(?![[!])[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[A-Za-z_][A-Za-z0-9_]*)/g;

export function highlight(
    code: string,
    opts: { hashComments?: boolean } = {},
): string {
    let out = "";
    let last = 0;
    for (const m of code.matchAll(TOKEN)) {
        const tok = m[0];
        const at = m.index ?? 0;
        out += esc(code.slice(last, at));
        last = at + tok.length;
        let cls = "";
        if (tok.startsWith("//") || tok.startsWith("/*")) cls = "tk-com";
        else if (tok.startsWith("#")) cls = opts.hashComments ? "tk-com" : "";
        else if (tok[0] === '"' || tok[0] === "'" || tok[0] === "`") {
            const rest = code.slice(last);
            cls = /^\s*:/.test(rest) ? "tk-prop" : "tk-str";
        } else if (/^\d|^0x/.test(tok)) cls = "tk-num";
        else if (KEYWORDS.has(tok)) cls = "tk-key";
        else if (/^[A-Z][A-Za-z0-9_]*$/.test(tok)) cls = "tk-type";
        if (tok.startsWith("#") && !opts.hashComments) {
            // Rust attributes and C preprocessor lines read as keywords.
            out += `<span class="tk-key">${esc(tok)}</span>`;
            continue;
        }
        out += cls ? `<span class="${cls}">${esc(tok)}</span>` : esc(tok);
    }
    out += esc(code.slice(last));
    return out;
}

export function lineNumbers(code: string): string {
    const n = code.split("\n").length;
    let s = "";
    for (let i = 1; i <= n; i++) s += `${i}\n`;
    return s;
}

/** Brand-ish colour per language for the small dots on language tabs. */
export const LANGUAGE_COLORS: Record<string, string> = {
    typescript: "#3178C6",
    javascript: "#F0DB4F",
    swift: "#F05138",
    kotlin: "#A97BFF",
    rust: "#DEA584",
    go: "#00ADD8",
    python: "#4B8BBE",
    "c#": "#9B4F96",
    cs: "#9B4F96",
    java: "#E76F00",
    dart: "#0175C2",
    ruby: "#CC342D",
    php: "#777BB4",
    "c++": "#00599C",
    cpp: "#00599C",
    elm: "#60B5CC",
    haskell: "#5E5086",
    scala3: "#DC322F",
    crystal: "#9A9A9A",
    flow: "#E8BD36",
    "objective-c": "#438EFF",
    schema: "#9BE38A",
    cjson: "#A8B9CC",
    pike: "#005390",
    elixir: "#6E4A7E",
    smithy4a: "#C9C5D6",
    "typescript-zod": "#3068B7",
    "typescript-effect-schema": "#1E1E1E",
    "javascript-prop-types": "#61DAFB",
};

export function languageColor(name: string) {
    return LANGUAGE_COLORS[name] ?? "#9A96AB";
}
