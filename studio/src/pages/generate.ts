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
import { host } from "../lib/platform";
import { notify } from "../ui/toast";
import { register, type PaletteEntry } from "./registry";
import { SAMPLES } from "./samplesData";

type Kind = GenerateRequest["kind"];

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
    busy: boolean;
}

const STATE_KEY = "studio.generate.v1";

function loadState(): State {
    const fallback: State = {
        kind: "json",
        sources: [{ name: "input.json", text: SAMPLES[0].text }],
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
        busy: false,
    };
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw)
            return {
                ...fallback,
                ...JSON.parse(raw),
                result: null,
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

function persist() {
    try {
        const { result, busy, ...rest } = gen;
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
    schedule(0);
}

function problemText(r: Extract<GenerateResult, { ok: false }>) {
    return r.problems.map((p) => p.detail ?? p.value ?? p.code).join("; ");
}

async function run() {
    gen.busy = true;
    updateStatus();
    const req: GenerateRequest = {
        kind: gen.kind,
        sources: gen.sources,
        language: gen.language,
        topLevelName: gen.topLevelName || "TopLevel",
        rendererOptions: gen.options[gen.language] ?? {},
        ...gen.infer,
    };
    const result = await generate(req);
    gen.result = result;
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
    updateStatus();
}

function schedule(ms = 350) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(), ms);
}

function displayName(name: string) {
    return langs.find((l) => l.name === name)?.displayName ?? name;
}

let outputPre: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let sourceStatus: HTMLElement | null = null;

function drawOutput() {
    if (!outputPre) return;
    const r = gen.result;
    outputPre.textContent = r ? (r.ok ? r.code : "") : "";
    outputPre.classList.toggle("empty", !r?.ok);
    if (r && !r.ok)
        outputPre.textContent = t("gen.invalid", { detail: problemText(r) });
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
        sourceStatus.className = `source-status ${bad ? "bad" : "good"}`;
        sourceStatus.replaceChildren(
            icon(bad ? "info" : "check", 16),
            bad
                ? t("gen.invalid", {
                      detail: problemText(
                          r as Extract<GenerateResult, { ok: false }>,
                      ),
                  })
                : t("gen.valid", { lines }),
        );
    }
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
    };
    const tip = h(
        "div",
        { class: "toggletip", role: "status", hidden: true },
        o.description,
    );
    const info = h(
        "button",
        {
            class: "icon-btn",
            type: "button",
            "aria-label": `${t("opt.about")}: ${o.name}`,
            "aria-expanded": "false",
            onclick: () => {
                tip.hidden = !tip.hidden;
                info.setAttribute("aria-expanded", String(!tip.hidden));
            },
        },
        icon("info", 16),
    );
    let control: HTMLElement;
    const id = `opt-${gen.language}-${o.name}`;
    if (o.type === "boolean") {
        const on = current === true || current === "true";
        control = h(
            "button",
            {
                id,
                class: `switch ${on ? "on" : ""}`,
                role: "switch",
                "aria-checked": String(on),
                "aria-label": o.description,
                onclick: () => set(!on),
            },
            h("span", { class: "knob" }),
        );
    } else if (o.values && o.values.length > 0) {
        control = h(
            "select",
            {
                id,
                class: "text-input",
                "aria-label": o.description,
                onchange: (e: Event) =>
                    set((e.target as HTMLSelectElement).value),
            },
            ...o.values.map((v) =>
                h("option", { value: v, selected: String(current) === v }, v),
            ),
        );
    } else {
        control = h("input", {
            id,
            class: "text-input",
            "aria-label": o.description,
            value: current === undefined ? "" : String(current),
            onchange: (e: Event) => set((e.target as HTMLInputElement).value),
        });
    }
    return h(
        "div",
        { class: "opt-row", dataset: { el: `opt.${o.name}` } },
        h(
            "label",
            { class: "opt-text", for: id },
            h("span", { class: "opt-name" }, o.name),
            h("span", { class: "opt-desc" }, o.description),
        ),
        info,
        control,
        tip,
    );
}

function inferRow(
    key: keyof State["infer"],
    textKey: Parameters<typeof label>[0],
) {
    const on = gen.infer[key];
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
                    gen.infer = { ...gen.infer, [key]: !on };
                    schedule(0);
                    rerender();
                },
            },
            h("span", { class: "knob" }),
        ),
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
    const kindSeg = h(
        "div",
        {
            class: "seg",
            role: "radiogroup",
            "aria-label": t("gen.kind"),
            dataset: { el: "gen.kind" },
        },
        ...kinds.map((k) =>
            h(
                "button",
                {
                    role: "radio",
                    "aria-checked": String(gen.kind === k),
                    class: gen.kind === k ? "on" : "",
                    onclick: () => {
                        gen.kind = k;
                        schedule(0);
                        ctx.rerender();
                    },
                },
                label(`kind.${k}`),
            ),
        ),
    );

    const editors = gen.sources.map((s, i) => {
        const ta = h("textarea", {
            class: "code-edit",
            spellcheck: false,
            "aria-label": `${t("gen.source")} ${i + 1}`,
            value: s.text,
            oninput: (e: Event) => {
                gen.sources[i].text = (e.target as HTMLTextAreaElement).value;
                schedule();
            },
        });
        ta.value = s.text;
        return h(
            "div",
            { class: "source-item" },
            gen.sources.length > 1
                ? h(
                      "div",
                      { class: "row small" },
                      h("span", { class: "grow mono" }, s.name),
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
                          icon("close", 14),
                      ),
                  )
                : null,
            ta,
        );
    });

    const fileInput = h("input", {
        type: "file",
        hidden: true,
        accept: ".json,.schema,.ts,.graphql,.gql,application/json",
        onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const text = await f.text();
            gen.sources = [{ name: f.name, text }];
            if (/\.ts$/i.test(f.name)) gen.kind = "typescript";
            schedule(0);
            ctx.rerender();
        },
    });

    const nameInput = h("input", {
        class: "text-input",
        value: gen.topLevelName,
        "aria-label": t("gen.topLevel"),
        oninput: (e: Event) => {
            gen.topLevelName = (e.target as HTMLInputElement).value;
            schedule();
        },
    });

    sourceStatus = h("div", { class: "source-status" });
    const sourceCard = h(
        "section",
        {
            class: "card source-card",
            "aria-label": t("gen.source"),
            dataset: { el: "gen.source" },
        },
        h(
            "div",
            { class: "card-head" },
            h(
                "label",
                { class: "field grow" },
                label("gen.topLevel"),
                nameInput,
            ),
            h(
                "button",
                {
                    class: "icon-btn round",
                    "aria-label": t("gen.openFile"),
                    onclick: () => fileInput.click(),
                },
                icon("folder", 18),
            ),
            fileInput,
        ),
        gen.kind === "graphql"
            ? h("p", { class: "muted small pad" }, t("gen.graphqlHint"))
            : null,
        h("div", { class: "editors" }, ...editors),
        h(
            "div",
            { class: "row pad" },
            h(
                "button",
                {
                    class: "btn small",
                    onclick: () => {
                        gen.sources.push({
                            name: `input${gen.sources.length + 1}`,
                            text: "",
                        });
                        ctx.rerender();
                    },
                },
                icon("plus", 16),
                label("gen.addSource"),
            ),
        ),
        sourceStatus,
    );

    const more = h(
        "select",
        {
            class: "chip-select",
            "aria-label": t("gen.more"),
            onchange: (e: Event) => {
                gen.language = (e.target as HTMLSelectElement).value;
                schedule(0);
                ctx.rerender();
            },
        },
        h(
            "option",
            { value: "" },
            `${t("gen.more")} (${Math.max(0, langs.length - chips.length)})`,
        ),
        ...langs
            .filter((l) => !chips.includes(l.name))
            .map((l) => h("option", { value: l.name }, l.displayName)),
    );

    outputPre = h("pre", {
        class: "code-out",
        tabindex: 0,
        "aria-label": t("gen.output"),
    });
    statusEl = h("span", {
        class: "grow muted-dark small",
        "aria-live": "polite",
    });
    const outCard = h(
        "section",
        {
            class: "card output-card",
            "aria-label": t("gen.output"),
            dataset: { el: "gen.output" },
        },
        h(
            "div",
            { class: "chips", role: "group", "aria-label": t("tab.languages") },
            ...chips.map((n) =>
                h(
                    "button",
                    {
                        class: `chip ${gen.language === n ? "on" : ""}`,
                        "aria-pressed": String(gen.language === n),
                        onclick: () => {
                            gen.language = n;
                            schedule(0);
                            ctx.rerender();
                        },
                    },
                    displayName(n),
                ),
            ),
            more,
        ),
        outputPre,
        h(
            "div",
            { class: "card-foot" },
            statusEl,
            h(
                "button",
                { class: "btn outline-dark", onclick: () => void saveCode() },
                icon("save", 16),
                label("gen.save"),
            ),
            h(
                "button",
                {
                    class: "btn accent",
                    onclick: () => void copyCode(),
                    "aria-keyshortcuts": "Control+Shift+C",
                },
                icon("copy", 16),
                label("gen.copy"),
            ),
        ),
    );

    const optCard = h(
        "aside",
        {
            class: "card options-card",
            "aria-label": t("gen.options", {
                lang: lang?.displayName ?? gen.language,
            }),
            dataset: { el: "gen.options" },
        },
        h(
            "h2",
            null,
            t("gen.options", { lang: lang?.displayName ?? gen.language }),
        ),
        h("h3", { class: "eyebrow" }, t("gen.inference")),
        inferRow("inferEnums", "opt.inferEnums"),
        inferRow("inferMaps", "opt.inferMaps"),
        inferRow("inferDateTimes", "opt.inferDateTimes"),
        inferRow("allPropertiesOptional", "opt.allOptional"),
        h("h3", { class: "eyebrow" }, lang?.displayName ?? ""),
        ...(lang?.options ?? []).map(optionControl),
    );

    const page = h(
        "div",
        { class: "page generate" },
        h(
            "div",
            { class: "page-head" },
            h(
                "div",
                { class: "grow" },
                h("p", { class: "eyebrow" }, t("gen.eyebrow")),
                h("h1", { class: "display" }, t("gen.title")),
            ),
            kindSeg,
        ),
        h("div", { class: "gen-grid" }, sourceCard, outCard, optCard),
    );
    queueMicrotask(() => {
        drawOutput();
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
