// Ctrl+Shift+F: one palette for commands, places, live settings and every
// labelled element, with its own anchored regex builder.

import { h, icon } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { pages, type PaletteEntry } from "../pages/registry";
import { openTab } from "./tabs";
import { regexField } from "./regexField";

const commandSources: (() => PaletteEntry[])[] = [];
export function addPaletteSource(fn: () => PaletteEntry[]) {
    commandSources.push(fn);
}

function teleport(el: HTMLElement) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("teleported");
    if (!el.matches("button, input, select, textarea, a, [tabindex]"))
        el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    setTimeout(() => el.classList.remove("teleported"), 1600);
}

function entries(): PaletteEntry[] {
    const out: PaletteEntry[] = [];
    for (const p of pages)
        out.push({
            group: "places",
            title: t(p.labelKey),
            run: () => openTab(p.id),
        });
    for (const p of pages)
        if (p.paletteEntries) out.push(...p.paletteEntries());
    for (const src of commandSources) out.push(...src());
    for (const el of document.querySelectorAll<HTMLElement>(
        "#page [data-el][aria-label], #page [data-el] > h2, #page [data-el] > h3",
    )) {
        const target = el.closest<HTMLElement>("[data-el]") ?? el;
        const name = el.getAttribute("aria-label") ?? el.textContent ?? "";
        if (name.trim())
            out.push({
                group: "elements",
                title: name.trim(),
                run: () => teleport(target),
            });
    }
    return out;
}

export function openPalette() {
    if (document.querySelector(".palette")) return;
    const prev = document.activeElement as HTMLElement | null;
    let match: (s: string) => boolean = () => true;
    let cursor = 0;
    const all = entries();
    const results = h("div", {
        class: "palette-results",
        role: "listbox",
        id: "palette-results",
        "aria-label": t("palette.label"),
    });

    const visible = () =>
        all.filter((e) =>
            match(`${e.title} ${e.detail ?? ""} ${e.keywords ?? ""}`),
        );
    const close = () => {
        dlg.close();
        dlg.remove();
        prev?.focus?.();
    };
    const activate = (e: PaletteEntry) => {
        if (e.control) return;
        close();
        e.run?.();
    };
    const draw = () => {
        const v = visible();
        cursor = Math.min(cursor, Math.max(0, v.length - 1));
        results.replaceChildren();
        if (v.length === 0) {
            results.append(
                h("p", { class: "muted pad" }, t("palette.nothing")),
            );
            return;
        }
        let lastGroup = "";
        v.slice(0, 80).forEach((e, i) => {
            if (e.group !== lastGroup) {
                lastGroup = e.group;
                results.append(
                    h(
                        "div",
                        { class: "palette-group", role: "presentation" },
                        t(`palette.${e.group}` as "palette.commands"),
                    ),
                );
            }
            const row = h(
                "div",
                {
                    class: `palette-row ${i === cursor ? "cursor" : ""}`,
                    role: "option",
                    id: `pal-${i}`,
                    "aria-selected": String(i === cursor),
                    onclick: () => activate(e),
                },
                h(
                    "span",
                    { class: "palette-text" },
                    h("span", { class: "palette-title" }, e.title),
                    e.detail
                        ? h("span", { class: "muted small" }, e.detail)
                        : null,
                ),
                e.control ? e.control() : null,
                e.shortcut ? h("kbd", null, e.shortcut) : null,
            );
            results.append(row);
        });
        search.input.setAttribute("aria-activedescendant", `pal-${cursor}`);
        results.querySelector(".cursor")?.scrollIntoView({ block: "nearest" });
    };
    const search = regexField(
        "palette.placeholder",
        (m) => {
            match = m.ok ? m.test : () => true;
            cursor = 0;
            draw();
        },
        { id: "palette-search" },
    );
    search.input.setAttribute("role", "combobox");
    search.input.setAttribute("aria-controls", "palette-results");
    search.input.setAttribute("aria-expanded", "true");
    search.input.addEventListener("keydown", (e) => {
        const v = visible();
        if (e.key === "ArrowDown") cursor = Math.min(v.length - 1, cursor + 1);
        else if (e.key === "ArrowUp") cursor = Math.max(0, cursor - 1);
        else if (e.key === "Enter") {
            const entry = v[cursor];
            if (entry?.control) {
                const ctl = results.querySelector<HTMLElement>(
                    ".cursor input, .cursor select, .cursor button",
                );
                ctl?.focus();
            } else if (entry) activate(entry);
            e.preventDefault();
            return;
        } else if (
            e.key === " " &&
            v[cursor]?.control &&
            search.input.value === ""
        ) {
            results
                .querySelector<HTMLElement>(
                    ".cursor button, .cursor input[type=checkbox]",
                )
                ?.click();
        } else return;
        e.preventDefault();
        draw();
    });
    const dlg = h(
        "dialog",
        { class: "dialog palette", "aria-label": t("palette.label") },
        search.el,
        results,
        h("div", { class: "palette-foot muted small" }, t("palette.hint")),
    );
    dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        close();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    draw();
    search.focus();
}

export function paletteButton() {
    return h(
        "button",
        {
            class: "palette-trigger",
            "aria-keyshortcuts": "Control+Shift+F",
            onclick: openPalette,
            "aria-label": t("palette.label"),
        },
        icon("search", 16),
        h("span", { class: "grow" }, label("app.searchHint")),
        h("kbd", null, "Ctrl+Shift+F"),
    );
}
