// Extension manager. Extensions run out of process in the desktop app.

import { h, icon } from "../lib/dom";
import { label, t } from "../lib/i18n";
import {
    host,
    DESKTOP_DOWNLOAD_URL,
    type ExtensionInfo,
} from "../lib/platform";
import { regexField } from "../ui/regexField";
import { notify } from "../ui/toast";
import { gen } from "./generate";
import { register } from "./registry";

let cache: ExtensionInfo[] | null = null;
const outputs = new Map<string, string>();

register({
    id: "extensions",
    labelKey: "tab.extensions",
    icon: "extensions",
    render: (ctx) => {
        if (!host) {
            return h(
                "div",
                { class: "page" },
                h("h1", { class: "display" }, t("ext.title")),
                h(
                    "div",
                    { class: "card pad-lg note-warm" },
                    h("p", null, t("ext.desktopOnly")),
                    h(
                        "a",
                        {
                            class: "btn primary",
                            href: DESKTOP_DOWNLOAD_URL,
                            target: "_blank",
                            rel: "noreferrer",
                        },
                        icon("download", 16),
                        label("desktop.download"),
                    ),
                ),
            );
        }
        if (!cache)
            void host.extensions.list().then((l) => {
                cache = l;
                ctx.rerender();
            });
        let match: (s: string) => boolean = () => true;
        const grid = h("div", { class: "card-grid" });
        const draw = () =>
            grid.replaceChildren(
                ...(cache ?? [])
                    .filter((e) => match(`${e.name} ${e.description}`))
                    .map((e) =>
                        h(
                            "article",
                            {
                                class: "card ext",
                                dataset: { el: `ext.${e.id}` },
                            },
                            h(
                                "h2",
                                null,
                                e.name,
                                " ",
                                h(
                                    "span",
                                    { class: "muted small mono" },
                                    e.version,
                                ),
                            ),
                            h("p", null, e.description),
                            h(
                                "p",
                                { class: "small" },
                                h("strong", null, t("ext.permissions")),
                                ": ",
                                e.permissions.length
                                    ? e.permissions.join(", ")
                                    : "—",
                            ),
                            h(
                                "label",
                                { class: "row" },
                                h("input", {
                                    type: "checkbox",
                                    checked: e.enabled,
                                    onchange: async (ev: Event) => {
                                        const on = (
                                            ev.target as HTMLInputElement
                                        ).checked;
                                        if (
                                            on &&
                                            e.permissions.length &&
                                            !window.confirm(
                                                t("ext.consent", {
                                                    name: e.name,
                                                    perms: e.permissions.join(
                                                        ", ",
                                                    ),
                                                }),
                                            )
                                        ) {
                                            (
                                                ev.target as HTMLInputElement
                                            ).checked = false;
                                            return;
                                        }
                                        const r =
                                            await host?.extensions.setEnabled(
                                                e.id,
                                                on,
                                                on ? e.permissions : [],
                                            );
                                        if (r && !r.ok)
                                            notify(
                                                "error",
                                                "msg.generateFailed",
                                                { detail: r.detail ?? "" },
                                            );
                                        cache = null;
                                        ctx.rerender();
                                    },
                                }),
                                label("ext.enable"),
                            ),
                            ...e.commands.map((c) =>
                                h(
                                    "button",
                                    {
                                        class: "btn",
                                        disabled: !e.enabled,
                                        onclick: async () => {
                                            const code = gen.result?.ok
                                                ? gen.result.code
                                                : "";
                                            const r =
                                                await host?.extensions.run(
                                                    e.id,
                                                    c.id,
                                                    code,
                                                );
                                            outputs.set(
                                                e.id,
                                                r?.ok
                                                    ? (r.output ?? "")
                                                    : (r?.detail ?? "failed"),
                                            );
                                            ctx.rerender();
                                        },
                                    },
                                    icon("play", 14),
                                    c.title,
                                ),
                            ),
                            outputs.has(e.id)
                                ? h(
                                      "pre",
                                      { class: "code-mini" },
                                      outputs.get(e.id) ?? "",
                                  )
                                : null,
                        ),
                    ),
            );
        const search = regexField("ext.filter", (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        });
        draw();
        return h(
            "div",
            { class: "page" },
            h("h1", { class: "display" }, t("ext.title")),
            h(
                "div",
                { class: "row wrap" },
                search.el,
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: () => host?.extensions.openFolder(),
                    },
                    icon("folder", 16),
                    "Extensions folder",
                ),
            ),
            grid,
        );
    },
});
