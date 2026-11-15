// Built-in tools: a local file converter and a Base64 toolkit.

import YAML from "yaml";
import { h, downloadText } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { notify } from "../ui/toast";
import { register } from "./registry";

export type Format = "json" | "yaml" | "csv" | "tsv" | "query";

function parseDelimited(text: string, sep: string): Record<string, string>[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === sep) {
            row.push(cell);
            cell = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else cell += c;
    }
    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }
    const [head, ...body] = rows.filter((r) => r.some((x) => x !== ""));
    if (!head) return [];
    return body.map((r) =>
        Object.fromEntries(head.map((k, i) => [k, r[i] ?? ""])),
    );
}

function toDelimited(value: unknown, sep: string): string {
    const arr = Array.isArray(value) ? value : [value];
    const keys = [
        ...new Set(
            arr.flatMap((o) =>
                o && typeof o === "object" ? Object.keys(o) : [],
            ),
        ),
    ];
    const q = (v: unknown) => {
        const s =
            v === null || v === undefined
                ? ""
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v);
        return /["\n\r]/.test(s) || s.includes(sep)
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    return [
        keys.join(sep),
        ...arr.map((o) =>
            keys.map((k) => q((o as Record<string, unknown>)?.[k])).join(sep),
        ),
    ].join("\n");
}

export function convert(text: string, from: Format, to: Format): string {
    let value: unknown;
    if (from === "json") value = JSON.parse(text);
    else if (from === "yaml") value = YAML.parse(text);
    else if (from === "csv") value = parseDelimited(text, ",");
    else if (from === "tsv") value = parseDelimited(text, "\t");
    else
        value = Object.fromEntries(
            new URLSearchParams(text.replace(/^\?/, "")),
        );
    if (to === "json") return JSON.stringify(value, null, 2);
    if (to === "yaml") return YAML.stringify(value);
    if (to === "csv") return toDelimited(value, ",");
    if (to === "tsv") return toDelimited(value, "\t");
    const flat =
        value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    return new URLSearchParams(
        Object.entries(flat).map(([k, v]) => [
            k,
            typeof v === "object" ? JSON.stringify(v) : String(v),
        ]),
    ).toString();
}

export function b64encode(text: string, urlSafe: boolean) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const out = btoa(bin);
    return urlSafe
        ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/[=]+$/, "")
        : out;
}

export function b64decode(text: string) {
    let s = text
        .trim()
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .replace(/\s+/g, "");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

const FORMATS: Format[] = ["json", "yaml", "csv", "tsv", "query"];
const state = {
    from: "json" as Format,
    to: "yaml" as Format,
    input: '[{"name":"Ada","lang":"TypeScript"}]',
    output: "",
    b64in: "Hello, quicktype!",
    b64out: "",
    urlSafe: false,
};

register({
    id: "tools",
    labelKey: "tab.tools",
    icon: "tools",
    render: (ctx) => {
        const sel = (key: "from" | "to") =>
            h(
                "select",
                {
                    class: "text-input",
                    "aria-label": t(key === "from" ? "tools.from" : "tools.to"),
                    onchange: (e: Event) => {
                        state[key] = (e.target as HTMLSelectElement)
                            .value as Format;
                    },
                },
                ...FORMATS.map((f) =>
                    h(
                        "option",
                        { value: f, selected: state[key] === f },
                        f.toUpperCase(),
                    ),
                ),
            );
        const input = h("textarea", {
            class: "code-edit small",
            "aria-label": t("tools.input"),
            oninput: (e: Event) =>
                (state.input = (e.target as HTMLTextAreaElement).value),
        });
        input.value = state.input;
        const out = h("textarea", {
            class: "code-edit small",
            readonly: true,
            "aria-label": t("tools.result"),
        });
        out.value = state.output;
        const b64in = h("textarea", {
            class: "code-edit small",
            "aria-label": t("tools.input"),
            oninput: (e: Event) =>
                (state.b64in = (e.target as HTMLTextAreaElement).value),
        });
        b64in.value = state.b64in;
        const b64out = h("textarea", {
            class: "code-edit small",
            readonly: true,
            "aria-label": t("tools.result"),
        });
        b64out.value = state.b64out;
        return h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("tools.title")),
            h(
                "div",
                { class: "tools-grid" },
                h(
                    "section",
                    {
                        class: "card pad-lg",
                        "aria-label": t("tools.converter"),
                        dataset: { el: "tools.converter" },
                    },
                    h("h2", null, t("tools.converter")),
                    h(
                        "div",
                        { class: "row wrap" },
                        h(
                            "label",
                            { class: "field" },
                            label("tools.from"),
                            sel("from"),
                        ),
                        h(
                            "label",
                            { class: "field" },
                            label("tools.to"),
                            sel("to"),
                        ),
                        h(
                            "button",
                            {
                                class: "btn primary",
                                onclick: () => {
                                    try {
                                        state.output = convert(
                                            state.input,
                                            state.from,
                                            state.to,
                                        );
                                        notify("success", "msg.converted", {
                                            from: state.from.toUpperCase(),
                                            to: state.to.toUpperCase(),
                                        });
                                    } catch (e) {
                                        notify("error", "msg.convertFailed", {
                                            detail:
                                                e instanceof Error
                                                    ? e.message
                                                    : String(e),
                                        });
                                    }
                                    ctx.rerender();
                                },
                            },
                            label("tools.convert"),
                        ),
                        h(
                            "button",
                            {
                                class: "btn",
                                disabled: !state.output,
                                onclick: () =>
                                    downloadText(
                                        `converted.${state.to}`,
                                        state.output,
                                    ),
                            },
                            label("history.export"),
                        ),
                    ),
                    input,
                    out,
                ),
                h(
                    "section",
                    {
                        class: "card pad-lg",
                        "aria-label": t("tools.base64"),
                        dataset: { el: "tools.base64" },
                    },
                    h("h2", null, t("tools.base64")),
                    h(
                        "div",
                        { class: "row wrap" },
                        h(
                            "button",
                            {
                                class: "btn primary",
                                onclick: () => {
                                    state.b64out = b64encode(
                                        state.b64in,
                                        state.urlSafe,
                                    );
                                    ctx.rerender();
                                },
                            },
                            label("tools.encode"),
                        ),
                        h(
                            "button",
                            {
                                class: "btn",
                                onclick: () => {
                                    try {
                                        state.b64out = b64decode(state.b64in);
                                    } catch (e) {
                                        notify("error", "msg.convertFailed", {
                                            detail:
                                                e instanceof Error
                                                    ? e.message
                                                    : String(e),
                                        });
                                    }
                                    ctx.rerender();
                                },
                            },
                            label("tools.decode"),
                        ),
                        h(
                            "label",
                            { class: "chip-check" },
                            h("input", {
                                type: "checkbox",
                                checked: state.urlSafe,
                                onchange: (e: Event) =>
                                    (state.urlSafe = (
                                        e.target as HTMLInputElement
                                    ).checked),
                            }),
                            label("tools.urlSafe"),
                        ),
                    ),
                    b64in,
                    b64out,
                ),
            ),
        );
    },
});
