// Offline documentation browser: the same articles the website publishes.

import { h } from "../lib/dom";
import { t } from "../lib/i18n";
import { regexField } from "../ui/regexField";
import { renderMarkdown } from "./simplePages";
import { register } from "./registry";

const files = import.meta.glob("../../../docs/studio/**/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

export interface Article {
    slug: string;
    title: string;
    category: string;
    body: string;
}

export const ARTICLES: Article[] = Object.entries(files)
    .map(([path, body]) => {
        const rel = path.split("docs/studio/")[1] ?? path;
        const parts = rel.replace(/\.md$/, "").split("/");
        const title = /^#\s+(.+)$/m.exec(body)?.[1] ?? parts[parts.length - 1];
        return {
            slug: parts.join("/"),
            title,
            category: parts.length > 1 ? parts[parts.length - 2] : "overview",
            body,
        };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

let current =
    ARTICLES.find((a) => a.slug.endsWith("README"))?.slug ??
    ARTICLES[0]?.slug ??
    "";

register({
    id: "docs",
    labelKey: "tab.docs",
    icon: "docs",
    render: (ctx) => {
        let match: (s: string) => boolean = () => true;
        const nav = h("nav", {
            class: "docs-nav",
            "aria-label": t("docs.title"),
        });
        const draw = () =>
            nav.replaceChildren(
                ...ARTICLES.filter((a) =>
                    match(`${a.title} ${a.category}`),
                ).map((a) =>
                    h(
                        "button",
                        {
                            class: `docs-link ${a.slug === current ? "on" : ""}`,
                            "aria-current":
                                a.slug === current ? "page" : undefined,
                            onclick: () => {
                                current = a.slug;
                                ctx.rerender();
                            },
                        },
                        h("span", { class: "muted small block" }, a.category),
                        a.title,
                    ),
                ),
            );
        const search = regexField("docs.filter", (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        });
        draw();
        const art = ARTICLES.find((a) => a.slug === current);
        const suggestions = ARTICLES.filter(
            (a) => a.category === art?.category && a.slug !== current,
        ).slice(0, 4);
        const body = art ? renderMarkdown(art.body) : h("p", null, "—");
        body.addEventListener("click", (e) => {
            const a = (e.target as HTMLElement).closest("a");
            const href = a?.getAttribute("href") ?? "";
            if (href.endsWith(".md") && !href.startsWith("http")) {
                e.preventDefault();
                const name = href.replace(/^\.\//, "").replace(/\.md$/, "");
                const hit = ARTICLES.find((x) => x.slug.endsWith(name));
                if (hit) {
                    current = hit.slug;
                    ctx.rerender();
                }
            }
        });
        return h(
            "div",
            { class: "page docs" },
            h("div", { class: "docs-side" }, search.el, nav),
            h(
                "article",
                {
                    class: "card pad-lg docs-body",
                    dataset: { el: "docs.article" },
                },
                body,
                suggestions.length
                    ? h(
                          "footer",
                          { class: "suggested" },
                          h("h2", null, t("docs.suggested")),
                          ...suggestions.map((s) =>
                              h(
                                  "button",
                                  {
                                      class: "btn small",
                                      onclick: () => {
                                          current = s.slug;
                                          ctx.rerender();
                                      },
                                  },
                                  s.title,
                              ),
                          ),
                      )
                    : null,
            ),
        );
    },
});
