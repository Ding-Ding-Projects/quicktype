// Samples, Languages, History, Changelog and About.

import { h, icon, downloadText, logoMark } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings } from "../lib/store";
import { languages, type LanguageInfo } from "../lib/engineClient";
import {
    exportEntries,
    list as historyList,
    remove as historyRemove,
    type ExportFormat,
} from "../lib/history";
import { BUILD, edition } from "../lib/platform";
import { notify } from "../ui/toast";
import { regexField } from "../ui/regexField";
import { superConfirm } from "../ui/confirm";
import { openTab } from "../ui/tabs";
import { register } from "./registry";
import { SAMPLES } from "./samplesData";
import { setSource } from "./generate";
import CHANGELOG from "../../CHANGELOG.md?raw";

register({
    id: "samples",
    labelKey: "tab.samples",
    icon: "samples",
    render: () =>
        h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("samples.title")),
            h(
                "div",
                { class: "card-grid" },
                ...SAMPLES.map((s) =>
                    h(
                        "article",
                        {
                            class: "card sample",
                            dataset: { el: `sample.${s.id}` },
                        },
                        h("h2", null, s.title),
                        h("p", { class: "muted small" }, t(`kind.${s.kind}`)),
                        h(
                            "pre",
                            { class: "code-mini" },
                            s.text.split("\n").slice(0, 8).join("\n"),
                        ),
                        h(
                            "button",
                            {
                                class: "btn primary",
                                onclick: () => {
                                    setSource(s.kind, s.text, s.topLevel);
                                    openTab("generate");
                                },
                            },
                            label("samples.use"),
                        ),
                    ),
                ),
            ),
        ),
});

let langCache: LanguageInfo[] = [];
register({
    id: "languages",
    labelKey: "tab.languages",
    icon: "languages",
    render: (ctx) => {
        if (langCache.length === 0)
            void languages().then((l) => {
                langCache = l;
                ctx.rerender();
            });
        let match: (s: string) => boolean = () => true;
        const grid = h("div", { class: "card-grid" });
        const draw = () => {
            const fav = settings.get().favoriteLanguages;
            grid.replaceChildren(
                ...langCache
                    .filter((l) =>
                        match(`${l.displayName} ${l.names.join(" ")}`),
                    )
                    .map((l) => {
                        const on = fav.includes(l.name);
                        return h(
                            "article",
                            {
                                class: "card lang",
                                dataset: { el: `lang.${l.name}` },
                            },
                            h("h2", null, l.displayName),
                            h(
                                "p",
                                { class: "mono small muted" },
                                `.${l.extension} · ${l.options.length} options`,
                            ),
                            h(
                                "label",
                                { class: "row" },
                                h("input", {
                                    type: "checkbox",
                                    checked: on,
                                    onchange: () => {
                                        settings.set({
                                            favoriteLanguages: on
                                                ? fav.filter(
                                                      (x) => x !== l.name,
                                                  )
                                                : [...fav, l.name],
                                        });
                                    },
                                }),
                                label("languages.favorite"),
                            ),
                        );
                    }),
            );
        };
        const search = regexField("languages.filter", (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        });
        draw();
        return h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("languages.title")),
            search.el,
            grid,
        );
    },
});

register({
    id: "history",
    labelKey: "tab.history",
    icon: "history",
    render: (ctx) => {
        const selected = new Set<string>();
        let match: (s: string) => boolean = () => true;
        const rows = h("div", { class: "history-list" });
        const draw = () => {
            const items = historyList().filter((e) =>
                match(`${e.kind} ${e.summary}`),
            );
            if (items.length === 0) {
                rows.replaceChildren(
                    h("p", { class: "muted" }, t("history.empty")),
                );
                return;
            }
            rows.replaceChildren(
                ...items.map((e) =>
                    h(
                        "label",
                        { class: "history-row card" },
                        h("input", {
                            type: "checkbox",
                            checked: selected.has(e.id),
                            onchange: (ev: Event) => {
                                if ((ev.target as HTMLInputElement).checked)
                                    selected.add(e.id);
                                else selected.delete(e.id);
                            },
                        }),
                        h(
                            "span",
                            { class: "grow" },
                            h("strong", null, e.summary),
                            h(
                                "span",
                                { class: "muted small block" },
                                `${new Date(e.at).toLocaleString()} · ${e.kind}`,
                            ),
                        ),
                        e.kind === "settings"
                            ? h(
                                  "button",
                                  {
                                      class: "btn small",
                                      onclick: (ev: Event) => {
                                          ev.preventDefault();
                                          settings.set(
                                              (
                                                  e.data as {
                                                      before: Record<
                                                          string,
                                                          unknown
                                                      >;
                                                  }
                                              ).before as never,
                                          );
                                      },
                                  },
                                  label("history.restore"),
                              )
                            : null,
                    ),
                ),
            );
        };
        const search = regexField("history.filter", (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        });
        draw();
        const fmt = h(
            "select",
            { class: "text-input", "aria-label": t("history.export") },
            ...(["json", "csv", "md", "html", "txt"] as ExportFormat[]).map(
                (f) => h("option", { value: f }, f.toUpperCase()),
            ),
        );
        return h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("history.title")),
            h("p", { class: "muted" }, t("history.omitted")),
            h(
                "div",
                { class: "row wrap" },
                search.el,
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: () => {
                            for (const e of historyList()) selected.add(e.id);
                            draw();
                        },
                    },
                    label("history.selectAll"),
                ),
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: async () => {
                            if (selected.size === 0) return;
                            if (!(await superConfirm(t("history.delete"))))
                                return;
                            const n = historyRemove(selected);
                            notify("success", "msg.historyDeleted", {
                                count: n,
                            });
                            ctx.rerender();
                        },
                    },
                    icon("trash", 16),
                    label("history.delete"),
                ),
                fmt,
                h(
                    "button",
                    {
                        class: "btn primary",
                        onclick: () => {
                            const items = selected.size
                                ? historyList().filter((e) =>
                                      selected.has(e.id),
                                  )
                                : historyList();
                            const f = fmt.value as ExportFormat;
                            const file = `quicktype-studio-history.${f}`;
                            downloadText(file, exportEntries(items, f));
                            notify("success", "msg.exported", { file });
                        },
                    },
                    icon("download", 16),
                    label("history.export"),
                ),
            ),
            rows,
        );
    },
});

function renderMarkdown(md: string): HTMLElement {
    // A small, safe Markdown subset: headings, lists, code, paragraphs, links.
    const root = h("div", { class: "prose" });
    let listEl: HTMLUListElement | null = null;
    let code: string[] | null = null;
    const inline = (text: string) => {
        const frag = document.createDocumentFragment();
        const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
        let last = 0;
        for (const m of text.matchAll(re)) {
            frag.append(text.slice(last, m.index));
            const tok = m[0];
            if (tok.startsWith("`"))
                frag.append(h("code", null, tok.slice(1, -1)));
            else if (tok.startsWith("**"))
                frag.append(h("strong", null, tok.slice(2, -2)));
            else {
                const [, txt, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok) ?? [];
                const safe = /^(https?:|#|\.\/|\.\.\/|[\w-]+\.md)/.test(
                    href ?? "",
                )
                    ? href
                    : "#";
                frag.append(
                    h(
                        "a",
                        {
                            href: safe,
                            target: safe.startsWith("http")
                                ? "_blank"
                                : undefined,
                            rel: "noreferrer",
                        },
                        txt,
                    ),
                );
            }
            last = (m.index ?? 0) + tok.length;
        }
        frag.append(text.slice(last));
        return frag;
    };
    for (const line of md.split("\n")) {
        if (code) {
            if (line.startsWith("```")) {
                root.append(h("pre", { class: "code-mini" }, code.join("\n")));
                code = null;
            } else code.push(line);
            continue;
        }
        if (line.startsWith("```")) {
            code = [];
            listEl = null;
            continue;
        }
        const hm = /^(#{1,4})\s+(.*)$/.exec(line);
        if (hm) {
            listEl = null;
            const tag = `h${Math.min(4, hm[1].length + 1)}` as "h2";
            root.append(h(tag, null, inline(hm[2])));
        } else if (/^\s*[-*]\s+/.test(line)) {
            listEl ??= root.appendChild(h("ul", null));
            listEl.append(
                h(
                    "li",
                    null,
                    inline(line.replace(/^\s*[-*]\s+(\[[ x]\]\s+)?/, "")),
                ),
            );
        } else if (line.trim() === "") listEl = null;
        else {
            listEl = null;
            root.append(h("p", null, inline(line)));
        }
    }
    return root;
}
export { renderMarkdown };

register({
    id: "changelog",
    labelKey: "tab.changelog",
    icon: "changelog",
    render: () =>
        h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("changelog.title")),
            h("div", { class: "card pad-lg" }, renderMarkdown(CHANGELOG)),
        ),
});

register({
    id: "about",
    labelKey: "tab.about",
    icon: "about",
    render: () => {
        const s = settings.get();
        return h(
            "div",
            { class: "page" },
            h(
                "div",
                { class: "card pad-lg about", dataset: { el: "about.card" } },
                logoMark(s.logo.preset, s.logo.custom, 72),
                h("h1", { class: "display" }, s.displayName),
                h(
                    "p",
                    null,
                    t("app.version", {
                        version: BUILD.version,
                        codeName: BUILD.codeName || "—",
                    }),
                ),
                h(
                    "p",
                    { class: "muted" },
                    t("about.updated", {
                        date: new Date(BUILD.builtAt).toLocaleString(),
                    }),
                    ` · ${BUILD.commit}`,
                ),
                h("p", null, t(`edition.${edition()}`)),
                h("p", null, t("about.engine")),
                h("p", { class: "muted" }, t("about.license")),
            ),
        );
    },
});
