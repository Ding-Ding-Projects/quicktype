// Search queries: plain text by default, with a full regex mode whose
// pattern, flags and anchors stay in sync with the visual builder.

export interface QueryState {
    mode: "plain" | "regex";
    text: string;
    ignoreCase: boolean;
    multiline: boolean;
    unicode: boolean;
    anchorStart: boolean;
    anchorEnd: boolean;
}

export const emptyQuery = (): QueryState => ({
    mode: "plain",
    text: "",
    ignoreCase: true,
    multiline: false,
    unicode: true,
    anchorStart: false,
    anchorEnd: false,
});

export type Matcher =
    | { ok: true; test: (s: string) => boolean; source: string }
    | { ok: false; detail: string };

function escapeText(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compile(q: QueryState): Matcher {
    if (q.text === "") return { ok: true, test: () => true, source: "" };
    if (q.mode === "plain") {
        const needle = q.ignoreCase ? q.text.toLowerCase() : q.text;
        return {
            ok: true,
            test: (s) => (q.ignoreCase ? s.toLowerCase() : s).includes(needle),
            source: escapeText(q.text),
        };
    }
    let body = q.text;
    // Anchors are owned by the toggles so the text field and builder agree.
    if (body.startsWith("^")) body = body.slice(1);
    if (body.endsWith("$") && !body.endsWith("\\$")) body = body.slice(0, -1);
    const source = `${q.anchorStart ? "^" : ""}${body}${q.anchorEnd ? "$" : ""}`;
    const flags = `${q.ignoreCase ? "i" : ""}${q.multiline ? "m" : ""}${q.unicode ? "u" : ""}`;
    try {
        if (source.length > 2000)
            return { ok: false, detail: "pattern longer than 2000 characters" };
        const re = new RegExp(source, flags);
        return { ok: true, test: (s) => re.test(s.slice(0, 20000)), source };
    } catch (e) {
        return {
            ok: false,
            detail:
                e instanceof Error
                    ? e.message.replace(/^Invalid regular expression: /, "")
                    : String(e),
        };
    }
}

/** Parse a typed pattern back into builder state (anchors become toggles). */
export function fromTyped(q: QueryState, typed: string): QueryState {
    if (q.mode !== "regex") return { ...q, text: typed };
    const anchorStart = typed.startsWith("^");
    const anchorEnd = typed.endsWith("$") && !typed.endsWith("\\$");
    return { ...q, text: typed, anchorStart, anchorEnd };
}

/** Text shown in the field for the current state. */
export function displayText(q: QueryState): string {
    if (q.mode !== "regex") return q.text;
    let body = q.text;
    if (body.startsWith("^")) body = body.slice(1);
    if (body.endsWith("$") && !body.endsWith("\\$")) body = body.slice(0, -1);
    return `${q.anchorStart ? "^" : ""}${body}${q.anchorEnd ? "$" : ""}`;
}

export const BLOCKS: {
    key:
        | "block.any"
        | "block.digit"
        | "block.word"
        | "block.space"
        | "block.either";
    token: string;
}[] = [
    { key: "block.any", token: ".*" },
    { key: "block.digit", token: "\\d" },
    { key: "block.word", token: "\\w+" },
    { key: "block.space", token: "\\s+" },
    { key: "block.either", token: "(this|that)" },
];
