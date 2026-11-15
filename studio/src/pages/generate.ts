// Generate: one editor with the source on the left and live, highlighted
// code on the right, plus an inspector of the inferred types and options.

import { h, icon, downloadText } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings } from "../lib/store";
import {
    generate,
    languages,
    type GenerateRequest,
    type GenerateResult,
    type LanguageInfo,
} from "../lib/engineClient";
import { add as addHistory } from "../lib/history";
import { highlight, languageColor, lineNumbers } from "../lib/highlight";
import { host } from "../lib/platform";
import { notify } from "../ui/toast";
import { customSelect } from "../ui/select";
import { register, type PaletteEntry } from "./registry";
import { SAMPLES } from "./samplesData";

type Kind = GenerateRequest["kind"];

interface InferredType {
    name: string;
    kind: "class" | "enum" | "union";
    fields: { name: string; type: string; optional: boolean }[];
}

interface State {
    kind: Kind;
    sources: { name: string; text: string }[];
    topLevelName: string;
    language: string;
    options: Record<string, Record<string, string | boolean>>;
    infer: {
        inferEnums: boolean;
        inferMaps: boolean;
        inferDateTimes: boolean;
        allPropertiesOptional: boolean;
    };
    result: GenerateResult | null;
    types: InferredType[];
    openTypes: string[];
    busy: boolean;
}

const STATE_KEY = "studio.generate.v1";

function loadState(): State {
    const fallback: State = {
        kind: "json",
        sources: [{ name: "pokedex.json", text: SAMPLES[0].text }],
        topLevelName: SAMPLES[0].topLevel,
        language: "typescript",
        options: {},
        infer: {
            inferEnums: true,
            inferMaps: true,
            inferDateTimes: true,
            allPropertiesOptional: false,
        },
        result: null,
        types: [],
        openTypes: [],
        busy: false,
    };
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw)
            return {
                ...fallback,
                ...JSON.parse(raw),
                result: null,
                types: [],
                busy: false,
            };
    } catch {
        /* first run */
    }
    return fallback;
}

export const gen: State = loadState();
let langs: LanguageInfo[] = [];
let timer: number | undefined;
let rerender: () => void = () => {};
let lastRecorded = "";
let runSeq = 0;

function persist() {
    try {
        const { result, busy, types, ...rest } = gen;
        localStorage.setItem(STATE_KEY, JSON.stringify(rest));
    } catch {
        /* storage full */
    }
}

export function setSource(kind: Kind, text: string, topLevel: string) {
    gen.kind = kind;
    gen.sources = [
        { name: kind === "typescript" ? "input.ts" : "input.json", text },
    ];
    gen.topLevelName = topLevel;
    gen.result = null;
    schedule(0);
}

export function generationSummary() {
    const r = gen.result;
    if (gen.busy) return "generating";
    if (!r) return "";
    return r.ok
        ? `${gen.types.length} type${gen.types.length === 1 ? "" : "s"} inferred · ${r.elapsedMs} ms`
        : "input has a problem";
}

function problemText(r: Extract<GenerateResult, { ok: false }>) {
    return r.problems.map((p) => p.detail ?? p.value ?? p.code).join("; ");
}

function describeSchemaType(s: Record<string, unknown> | undefined): string {
    if (!s) return "any";
    if (typeof s.$ref === "string") return s.$ref.split("/").pop() ?? "ref";
    if (Array.isArray(s.anyOf))
        return (s.anyOf as Record<string, unknown>[])
            .map(describeSchemaType)
            .join(" | ");
    if (s.type === "array")
        return `${describeSchemaType(s.items as Record<string, unknown>)}[]`;
    if (
        s.type === "object" &&
        s.additionalProperties &&
        typeof s.additionalProperties === "object"
    )
        return `map<${describeSchemaType(s.additionalProperties as Record<string, unknown>)}>`;
    if (s.format === "date-time") return "date-time";
    if (s.format === "integer" || s.type === "integer") return "integer";
    if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
    return String(s.type ?? "any");
}

function parseTypes(schemaText: string): InferredType[] {
    try {
        const schema = JSON.parse(schemaText) as {
            definitions?: Record<string, Record<string, unknown>>;
        };
        return Object.entries(schema.definitions ?? {}).map(([name, d]) => {
            if (Array.isArray(d.enum))
                return {
                    name,
                    kind: "enum" as const,
                    fields: (d.enum as unknown[]).map((v) => ({
                        name: String(v),
                        type: "case",
                        optional: false,
                    })),
                };
            if (Array.isArray(d.anyOf))
                return {
                    name,
                    kind: "union" as const,
                    fields: (d.anyOf as Record<string, unknown>[]).map((v) => ({
                        name: describeSchemaType(v),
                        type: "member",
                        optional: false,
                    })),
                };
            const req = new Set((d.required as string[] | undefined) ?? []);
            return {
                name,
                kind: "class" as const,
                fields: Object.entries(
                    (d.properties as Record<string, Record<string, unknown>>) ??
                        {},
                ).map(([f, s]) => ({
                    name: f,
                    type: describeSchemaType(s),
                    optional: !req.has(f),
                })),
            };
        });
    } catch {
        return [];
    }
}

async function run() {
    const mine = ++runSeq;
    gen.busy = true;
    updateStatus();
    const base: GenerateRequest = {
        kind: gen.kind,
        sources: gen.sources,
        language: gen.language,
        topLevelName: gen.topLevelName || "TopLevel",
        rendererOptions: gen.options[gen.language] ?? {},
        ...gen.infer,
    };
    const [result, schema] = await Promise.all([
        generate(base),
        generate({ ...base, language: "schema", rendererOptions: {} }),
    ]);
    if (mine !== runSeq) return;
    gen.result = result;
    gen.types = schema.ok ? parseTypes(schema.code) : [];
    gen.busy = false;
    persist();
    if (result.ok) {
        const sig = `${gen.language}|${gen.kind}|${result.code.length}`;
        if (sig !== lastRecorded) {
            lastRecorded = sig;
            addHistory({
                kind: "generate",
                summary: `${displayName(gen.language)} from ${gen.kind}, ${result.code.split("\n").length} lines`,
                data: {
                    language: gen.language,
                    kind: gen.kind,
                    topLevelName: gen.topLevelName,
                },
            });
        }
    }
    drawOutput();
    drawTypes();
    updateStatus();
    document.dispatchEvent(new CustomEvent("studio:generated"));
}

function schedule(ms = 300) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(), ms);
}

function displayName(name: string) {
    return langs.find((l) => l.name === name)?.displayName ?? name;
}

let outputCode: HTMLElement | null = null;
let outputGutter: HTMLElement | null = null;
let outputEmpty: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let sourceStatus: HTMLElement | null = null;
let typesBox: HTMLElement | null = null;

function drawOutput() {
    if (!outputCode || !outputGutter || !outputEmpty) return;
    const r = gen.result;
    const ok = Boolean(r?.ok);
    outputCode.parentElement?.parentElement?.toggleAttribute("hidden", !ok);
    outputEmpty.hidden = ok;
    if (r?.ok) {
        const py =
            gen.language === "python" ||
            gen.language === "ruby" ||
            gen.language === "elixir" ||
            gen.language === "crystal";
        outputCode.innerHTML = highlight(r.code, { hashComments: py });
        outputGutter.textContent = lineNumbers(r.code);
    } else {
        outputEmpty.textContent =
            r && !r.ok
                ? t("gen.invalid", { detail: problemText(r) })
                : t("gen.working");
        outputEmpty.classList.toggle("bad", Boolean(r && !r.ok));
    }
}

function drawTypes() {
    if (!typesBox) return;
    if (gen.types.length === 0) {
        typesBox.replaceChildren(
            h(
                "p",
                { class: "small muted", style: "margin:0" },
                gen.result && !gen.result.ok
                    ? "Fix the input to see its types."
                    : "Types appear here as you type.",
            ),
        );
        return;
    }
    typesBox.replaceChildren(
        ...gen.types.flatMap((ty) => {
            const open = gen.openTypes.includes(ty.name);
            const row = h(
                "button",
                {
                    type: "button",
                    class: "type-row",
                    "aria-expanded": String(open),
                    onclick: () => {
                        gen.openTypes = open
                            ? gen.openTypes.filter((x) => x !== ty.name)
                            : [...gen.openTypes, ty.name];
                        persist();
                        drawTypes();
                    },
                },
                h(
                    "span",
                    { class: `type-kind ${ty.kind === "enum" ? "enum" : ""}` },
                    ty.kind === "class" ? "type" : ty.kind,
                ),
                h("span", { class: "type-name" }, ty.name),
                h(
                    "span",
                    { class: "small faint" },
                    `${ty.fields.length} ${ty.kind === "enum" ? "case" : ty.kind === "union" ? "member" : "field"}${ty.fields.length === 1 ? "" : "s"}`,
                ),
            );
            if (!open) return [row];
            return [
                row,
                h(
                    "div",
                    { class: "type-fields" },
                    ...ty.fields.map((f) =>
                        h(
                            "span",
                            null,
                            h("b", null, `${f.name}${f.optional ? "?" : ""}`),
                            f.type,
                        ),
                    ),
                ),
            ];
        }),
    );
}

function updateStatus() {
    const r = gen.result;
    if (statusEl)
        statusEl.textContent = gen.busy
            ? t("gen.working")
            : r?.ok
              ? t("gen.done", {
                    count: r.code.split("\n").length,
                    ms: r.elapsedMs,
                })
              : "";
    if (sourceStatus) {
        const lines = gen.sources.reduce(
            (n, s) => n + s.text.split("\n").length,
            0,
        );
        const bad = r && !r.ok;
        sourceStatus.className = `pane-foot ${bad ? "bad" : "good"}`;
        sourceStatus.replaceChildren(
            icon(bad ? "info" : "check2", 14),
            h(
                "span",
                { class: "grow" },
                bad
                    ? t("gen.invalid", {
                          detail: problemText(
                              r as Extract<GenerateResult, { ok: false }>,
                          ),
                      })
                    : t("gen.valid", { lines }),
            ),
        );
    }
    document
        .querySelector(".crumb-status")
        ?.replaceChildren(generationSummary());
}

async function copyCode() {
    const r = gen.result;
    if (!r?.ok) return;
    try {
        await navigator.clipboard.writeText(r.code);
        notify("success", "msg.copied", { count: r.code.split("\n").length });
    } catch (e) {
        notify("error", "msg.copyFailed", {
            detail: e instanceof Error ? e.message : String(e),
        });
    }
}

async function saveCode() {
    const r = gen.result;
    if (!r?.ok) return;
    const ext = langs.find((l) => l.name === gen.language)?.extension ?? "txt";
    const name = `${gen.topLevelName || "TopLevel"}.${ext}`;
    if (host) {
        const res = await host.saveFile(name, r.code);
        if (res.ok) notify("success", "msg.saved", { file: res.path ?? name });
        else if (res.detail)
            notify("error", "msg.generateFailed", { detail: res.detail });
    } else {
        downloadText(name, r.code);
        notify("success", "msg.saved", { file: name });
    }
}

function optionControl(o: LanguageInfo["options"][number]) {
    const current = gen.options[gen.language]?.[o.name] ?? o.defaultValue;
    const set = (v: string | boolean) => {
        gen.options[gen.language] = {
            ...(gen.options[gen.language] ?? {}),
            [o.name]: v,
        };
        schedule(0);
        rerender();
    };
    const tip = h(
        "div",
        { class: "toggletip", role: "status", hidden: true },
        `${o.description}. Default: ${String(o.defaultValue ?? "none")}.`,
    );
    const info = h(
        "button",
        {
            class: "info-btn",
            type: "button",
            "aria-label": `${t("opt.about")}: ${o.name}`,
            "aria-expanded": "false",
            onclick: () => {
                tip.hidden = !tip.hidden;
                info.setAttribute("aria-expanded", String(!tip.hidden));
            },
        },
        icon("info", 14),
    );
    let control: HTMLElement;
    const pretty = o.name
        .replace(/-/g, " ")
        .replace(/^./, (c) => c.toUpperCase());
    if (o.type === "boolean") {
        const on = current === true || current === "true";
        control = h(
            "button",
            {
                class: `switch ${on ? "on" : ""}`,
                role: "switch",
                "aria-checked": String(on),
                "aria-label": pretty,
                onclick: () => set(!on),
            },
            h("span", { class: "knob" }),
        );
    } else if (o.values && o.values.length > 0) {
        control = customSelect({
            value: String(current),
            label: pretty,
            options: o.values.map((v) => ({ value: v, label: v })),
            onChange: set,
        });
    } else {
        control = h("input", {
            class: "text-input",
            "aria-label": pretty,
            value: current === undefined ? "" : String(current),
            onchange: (e: Event) => set((e.target as HTMLInputElement).value),
        });
    }
    return h(
        "div",
        { class: "opt-row", dataset: { el: `opt.${o.name}` } },
        h(
            "span",
            { class: "opt-text" },
            h("span", { class: "opt-name" }, pretty),
        ),
        info,
        control,
        tip,
    );
}

function inferRow(
    k: keyof State["infer"],
    textKey: Parameters<typeof label>[0],
) {
    const on = gen.infer[k];
    return h(
        "div",
        { class: "opt-row" },
        h(
            "span",
            { class: "opt-text" },
            h("span", { class: "opt-name" }, label(textKey)),
        ),
        h(
            "button",
            {
                class: `switch ${on ? "on" : ""}`,
                role: "switch",
                "aria-checked": String(on),
                "aria-label": t(textKey),
                onclick: () => {
                    gen.infer = { ...gen.infer, [k]: !on };
                    schedule(0);
                    rerender();
                },
            },
            h("span", { class: "knob" }),
        ),
    );
}

function sourceEditor(i: number) {
    const s = gen.sources[i];
    const pre = h("pre", { "aria-hidden": "true" });
    const gutter = h(
        "div",
        { class: "gutter", "aria-hidden": "true" },
        lineNumbers(s.text),
    );
    const ta = h("textarea", {
        spellcheck: false,
        "aria-label": `${t("gen.source")} ${i + 1}`,
        autocomplete: "off",
    });
    ta.value = s.text;
    const paint = () => {
        pre.innerHTML = `${highlight(ta.value)}\n`;
        gutter.textContent = lineNumbers(ta.value);
    };
    paint();
    ta.addEventListener("input", () => {
        gen.sources[i].text = ta.value;
        paint();
        schedule();
    });
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
            ta.dispatchEvent(new Event("input"));
        }
    });
    return h(
        "div",
        { class: "code-grid" },
        gutter,
        h("div", { class: "code-edit-wrap" }, pre, ta),
    );
}

function render(ctx: { rerender(): void }): HTMLElement {
    rerender = ctx.rerender;
    if (langs.length === 0) {
        void languages().then((l) => {
            langs = l;
            ctx.rerender();
        });
    }
    const fav = settings.get().favoriteLanguages;
    const chips = [...new Set([...fav, gen.language])].filter(
        (n) => langs.length === 0 || langs.some((l) => l.name === n),
    );
    const lang = langs.find((l) => l.name === gen.language);
    const kinds: Kind[] = ["json", "schema", "typescript", "graphql"];

    const fileInput = h("input", {
        type: "file",
        hidden: true,
        accept: ".json,.schema,.ts,.graphql,.gql,application/json",
        onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            gen.sources = [{ name: f.name, text: await f.text() }];
            if (/\.ts$/i.test(f.name)) gen.kind = "typescript";
            schedule(0);
            ctx.rerender();
        },
    });

    sourceStatus = h("div", { class: "pane-foot", role: "status" });
    const sourcePane = h(
        "div",
        {
            class: "pane",
            "aria-label": t("gen.source"),
            dataset: { el: "gen.source" },
        },
        h(
            "div",
            { class: "pane-head" },
            h("strong", null, label("gen.source")),
            customSelect({
                value: gen.kind,
                label: t("gen.kind"),
                options: kinds.map((k) => ({
                    value: k,
                    label: t(`kind.${k}`),
                })),
                onChange: (v) => {
                    gen.kind = v as Kind;
                    schedule(0);
                    ctx.rerender();
                },
            }),
            h("span", { class: "grow" }),
            h("input", {
                class: "text-input mono top-name",
                value: gen.topLevelName,
                "aria-label": t("gen.topLevel"),
                title: t("gen.topLevel"),
                oninput: (e: Event) => {
                    gen.topLevelName = (e.target as HTMLInputElement).value;
                    schedule();
                },
            }),
            h(
                "button",
                {
                    class: "icon-btn",
                    "aria-label": t("gen.openFile"),
                    title: t("gen.openFile"),
                    onclick: () => fileInput.click(),
                },
                icon("folder", 16),
            ),
            h(
                "button",
                {
                    class: "icon-btn",
                    "aria-label": t("gen.addSource"),
                    title: t("gen.addSource"),
                    onclick: () => {
                        gen.sources.push({
                            name: `input${gen.sources.length + 1}`,
                            text: "",
                        });
                        ctx.rerender();
                    },
                },
                icon("plus", 16),
            ),
            fileInput,
        ),
        gen.kind === "graphql"
            ? h(
                  "p",
                  { class: "small muted pad", style: "margin:0" },
                  t("gen.graphqlHint"),
              )
            : null,
        h(
            "div",
            { class: "code-wrap" },
            ...gen.sources.map((s, i) =>
                h(
                    "div",
                    { class: "source-block" },
                    gen.sources.length > 1
                        ? h(
                              "div",
                              { class: "row pad small" },
                              h("span", { class: "grow mono faint" }, s.name),
                              h(
                                  "button",
                                  {
                                      class: "icon-btn",
                                      "aria-label": t("gen.removeSource"),
                                      onclick: () => {
                                          gen.sources.splice(i, 1);
                                          schedule(0);
                                          ctx.rerender();
                                      },
                                  },
                                  icon("close", 12),
                              ),
                          )
                        : null,
                    sourceEditor(i),
                ),
            ),
        ),
        sourceStatus,
    );

    outputCode = h("pre", {
        class: "code-text",
        tabindex: 0,
        "aria-label": t("gen.output"),
    });
    outputGutter = h("div", { class: "gutter", "aria-hidden": "true" });
    outputEmpty = h("div", { class: "code-empty", role: "status" });
    statusEl = h("span", { class: "grow", "aria-live": "polite" });
    const more = customSelect({
        value: chips.includes(gen.language) ? "" : gen.language,
        label: t("gen.more"),
        searchable: true,
        placeholder: `+${Math.max(0, langs.length - chips.length)}`,
        options: langs
            .filter((l) => !chips.includes(l.name))
            .map((l) => ({
                value: l.name,
                label: l.displayName,
                hint: `.${l.extension}`,
                color: languageColor(l.name),
            })),
        onChange: (v) => {
            gen.language = v;
            schedule(0);
            ctx.rerender();
        },
    });
    const outputPane = h(
        "div",
        {
            class: "pane",
            "aria-label": t("gen.output"),
            dataset: { el: "gen.output" },
        },
        h(
            "div",
            { class: "pane-head" },
            h(
                "div",
                {
                    class: "lang-tabs",
                    role: "tablist",
                    "aria-label": t("tab.languages"),
                },
                ...chips.map((n) =>
                    h(
                        "button",
                        {
                            type: "button",
                            role: "tab",
                            "aria-selected": String(gen.language === n),
                            class: `lang-tab ${gen.language === n ? "on" : ""}`,
                            onclick: () => {
                                gen.language = n;
                                schedule(0);
                                ctx.rerender();
                            },
                        },
                        h("span", {
                            class: "lang-dot",
                            style: { background: languageColor(n) },
                        }),
                        displayName(n),
                    ),
                ),
            ),
            more,
            h(
                "button",
                {
                    class: "btn small accent",
                    onclick: () => void copyCode(),
                    "aria-keyshortcuts": "Control+Shift+C",
                    "aria-label": t("gen.copy"),
                    title: `${t("gen.copy")} (Ctrl+Shift+C)`,
                },
                icon("copy", 14),
            ),
        ),
        h(
            "div",
            { class: "code-wrap" },
            h("div", { class: "code-grid" }, outputGutter, outputCode),
        ),
        outputEmpty,
        h(
            "div",
            { class: "pane-foot" },
            statusEl,
            h(
                "button",
                { class: "btn small", onclick: () => void saveCode() },
                icon("save", 14),
                label("gen.save"),
            ),
        ),
    );

    typesBox = h("div", { class: "stack", style: "gap:4px" });
    const inspectorEl = h(
        "aside",
        {
            class: "inspector",
            "aria-label": t("gen.options", {
                lang: lang?.displayName ?? gen.language,
            }),
            dataset: { el: "gen.inspector" },
        },
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, "Inferred types"),
            typesBox,
        ),
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, t("gen.inference")),
            inferRow("inferEnums", "opt.inferEnums"),
            inferRow("inferMaps", "opt.inferMaps"),
            inferRow("inferDateTimes", "opt.inferDateTimes"),
            inferRow("allPropertiesOptional", "opt.allOptional"),
        ),
        h(
            "section",
            { dataset: { el: "gen.options" } },
            h(
                "h2",
                { class: "section-title" },
                t("gen.options", { lang: lang?.displayName ?? gen.language }),
            ),
            ...(lang?.options ?? []).map(optionControl),
        ),
    );

    const page = h(
        "div",
        { class: "page generate" },
        h(
            "div",
            { class: "workspace" },
            h(
                "section",
                { class: "card glass editor", "aria-label": t("gen.title") },
                sourcePane,
                outputPane,
            ),
            inspectorEl,
        ),
    );
    queueMicrotask(() => {
        drawOutput();
        drawTypes();
        updateStatus();
        if (!gen.result) schedule(0);
    });
    return page;
}

register({
    id: "generate",
    labelKey: "tab.generate",
    icon: "generate",
    render,
    paletteEntries: (): PaletteEntry[] => [
        {
            group: "commands",
            title: t("gen.copy"),
            shortcut: "Ctrl+Shift+C",
            run: () => void copyCode(),
        },
        {
            group: "commands",
            title: t("gen.save"),
            shortcut: "Ctrl+S",
            run: () => void saveCode(),
        },
        ...langs.map((l) => ({
            group: "commands" as const,
            title: `${t("tab.generate")}: ${l.displayName}`,
            keywords: l.names.join(" "),
            run: () => {
                gen.language = l.name;
                schedule(0);
                rerender();
            },
        })),
    ],
});

export const generateActions = { copyCode, saveCode };
