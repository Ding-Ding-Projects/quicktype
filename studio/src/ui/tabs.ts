// Browser-style tabs, docked left by default. Every tab starts open; tabs the
// user closes stay closed; tabs added by an update open once.

import { h, icon } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings, type Dock } from "../lib/store";
import { pages, pageById } from "../pages/registry";
import { regexField } from "./regexField";
import { showMenu } from "./contextMenu";

export function reconcileTabs() {
    const s = settings.get();
    const all = pages.map((p) => p.id);
    const known = new Set(s.knownTabs);
    const fresh = s.knownTabs.length === 0;
    let open = fresh ? [...all] : s.openTabs.filter((id) => all.includes(id));
    for (const id of all)
        if (!known.has(id) && !open.includes(id)) open.push(id);
    open = [
        ...s.pinnedTabs.filter((id) => open.includes(id)),
        ...open.filter((id) => !s.pinnedTabs.includes(id)),
    ];
    const active = open.includes(s.activeTab)
        ? s.activeTab
        : (open[0] ?? "generate");
    settings.set({ openTabs: open, knownTabs: all, activeTab: active }, false);
}

export function openTab(id: string) {
    const s = settings.get();
    const open = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
    settings.set({ openTabs: open, activeTab: id }, false);
}

export function closeTab(id: string) {
    const s = settings.get();
    const idx = s.openTabs.indexOf(id);
    const open = s.openTabs.filter((x) => x !== id);
    const active =
        s.activeTab === id
            ? (open[Math.max(0, idx - 1)] ?? open[0] ?? "")
            : s.activeTab;
    settings.set(
        {
            openTabs: open,
            activeTab: active,
            pinnedTabs: s.pinnedTabs.filter((x) => x !== id),
        },
        false,
    );
}

export function openEveryTab() {
    const s = settings.get();
    const all = pages.map((p) => p.id);
    const open = [
        ...s.openTabs,
        ...all.filter((id) => !s.openTabs.includes(id)),
    ];
    settings.set({ openTabs: open }, false);
}

function move(id: string, delta: number) {
    const s = settings.get();
    const open = [...s.openTabs];
    const i = open.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= open.length) return;
    [open[i], open[j]] = [open[j], open[i]];
    settings.set({ openTabs: open }, false);
}

function togglePin(id: string) {
    const s = settings.get();
    const pinned = s.pinnedTabs.includes(id)
        ? s.pinnedTabs.filter((x) => x !== id)
        : [...s.pinnedTabs, id];
    settings.set(
        {
            pinnedTabs: pinned,
            openTabs: [
                ...pinned.filter((x) => s.openTabs.includes(x)),
                ...s.openTabs.filter((x) => !pinned.includes(x)),
            ],
        },
        false,
    );
}

export function tabMenu(id: string | null, at: { x: number; y: number }) {
    const s = settings.get();
    const items = [];
    if (id) {
        items.push({
            label: t("tabs.close"),
            shortcut: "Ctrl+W",
            run: () => closeTab(id),
        });
        items.push({
            label: t("tabs.closeOthers"),
            run: () =>
                settings.set(
                    {
                        openTabs: s.openTabs.filter(
                            (x) => x === id || s.pinnedTabs.includes(x),
                        ),
                        activeTab: id,
                    },
                    false,
                ),
        });
        items.push({
            label: s.pinnedTabs.includes(id) ? t("tabs.unpin") : t("tabs.pin"),
            run: () => togglePin(id),
        });
    }
    if (s.openTabs.length < pages.length)
        items.push({ label: t("tabs.openAll"), run: openEveryTab });
    items.push({ label: t("tabs.new"), shortcut: "Ctrl+T", run: openCatalog });
    for (const d of ["left", "right", "top", "bottom"] as Dock[]) {
        items.push({
            label: `${t("tabs.dock")}: ${t(`dock.${d}`)}`,
            checked: s.dock === d,
            run: () => settings.set({ dock: d }),
        });
    }
    showMenu(items, at);
}

export function renderTabStrip(): HTMLElement {
    const s = settings.get();
    const vertical = s.dock === "left" || s.dock === "right";
    let stripQuery: (x: string) => boolean = () => true;
    const list = h("div", {
        class: "tab-list",
        role: "tablist",
        "aria-orientation": vertical ? "vertical" : "horizontal",
        "aria-label": t("tabs.catalog"),
    });

    const draw = () => {
        list.replaceChildren();
        for (const id of s.openTabs) {
            const p = pageById(id);
            if (!p) continue;
            const text = t(p.labelKey);
            if (!stripQuery(text)) continue;
            const active = s.activeTab === id;
            const pinned = s.pinnedTabs.includes(id);
            const tab = h(
                "div",
                {
                    class: `tab ${active ? "active" : ""} ${pinned ? "pinned" : ""}`,
                    role: "tab",
                    id: `tab-${id}`,
                    "aria-selected": String(active),
                    "aria-controls": "page",
                    tabindex: active ? 0 : -1,
                    draggable: "true",
                    title: text,
                    dataset: { el: `tab.${id}`, tab: id },
                    onclick: () => settings.set({ activeTab: id }, false),
                    onkeydown: (e: KeyboardEvent) => {
                        const ids = s.openTabs;
                        const i = ids.indexOf(id);
                        const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
                        const nextKey = vertical ? "ArrowDown" : "ArrowRight";
                        if (
                            e.altKey &&
                            e.shiftKey &&
                            (e.key === prevKey || e.key === nextKey)
                        ) {
                            move(id, e.key === prevKey ? -1 : 1);
                            e.preventDefault();
                        } else if (e.key === prevKey || e.key === nextKey) {
                            const nid =
                                ids[
                                    (i +
                                        (e.key === prevKey ? -1 : 1) +
                                        ids.length) %
                                        ids.length
                                ];
                            settings.set({ activeTab: nid }, false);
                            requestAnimationFrame(() =>
                                document.getElementById(`tab-${nid}`)?.focus(),
                            );
                            e.preventDefault();
                        } else if (e.key === "Home" || e.key === "End") {
                            const nid =
                                e.key === "Home" ? ids[0] : ids[ids.length - 1];
                            settings.set({ activeTab: nid }, false);
                            requestAnimationFrame(() =>
                                document.getElementById(`tab-${nid}`)?.focus(),
                            );
                            e.preventDefault();
                        } else if (e.key === "Delete") closeTab(id);
                    },
                    oncontextmenu: (e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        tabMenu(id, { x: e.clientX, y: e.clientY });
                    },
                    ondragstart: (e: DragEvent) =>
                        e.dataTransfer?.setData("text/x-studio-tab", id),
                    ondragover: (e: DragEvent) => e.preventDefault(),
                    ondrop: (e: DragEvent) => {
                        const from =
                            e.dataTransfer?.getData("text/x-studio-tab");
                        if (!from || from === id) return;
                        e.preventDefault();
                        const open = s.openTabs.filter((x) => x !== from);
                        open.splice(open.indexOf(id), 0, from);
                        settings.set({ openTabs: open }, false);
                    },
                },
                icon(p.icon),
                h("span", { class: "tab-label" }, label(p.labelKey)),
                pinned
                    ? h(
                          "span",
                          { class: "tab-pin", "aria-hidden": "true" },
                          icon("pin", 14),
                      )
                    : null,
                h(
                    "button",
                    {
                        class: "tab-close",
                        type: "button",
                        tabindex: -1,
                        "aria-label": `${t("tabs.close")}: ${text}`,
                        onclick: (e: Event) => {
                            e.stopPropagation();
                            closeTab(id);
                        },
                    },
                    icon("close", 12),
                ),
            );
            list.appendChild(tab);
        }
    };
    draw();

    const search = regexField(
        "tabs.search",
        (m) => {
            stripQuery = m.ok ? m.test : () => true;
            draw();
        },
        { id: "tab-strip-search" },
    );
    search.el.classList.add("tab-search");

    return h(
        "nav",
        {
            class: `tab-strip dock-${s.dock}`,
            "aria-label": t("tabs.catalog"),
            oncontextmenu: (e: MouseEvent) => {
                e.preventDefault();
                tabMenu(null, { x: e.clientX, y: e.clientY });
            },
        },
        search.el,
        list,
        h(
            "div",
            { class: "tab-strip-foot" },
            s.openTabs.length < pages.length
                ? h(
                      "button",
                      { class: "btn ghost small", onclick: openEveryTab },
                      label("tabs.openAll"),
                  )
                : null,
            h(
                "button",
                {
                    class: "btn dashed",
                    onclick: openCatalog,
                    "aria-keyshortcuts": "Control+T",
                },
                icon("plus", 18),
                label("tabs.new"),
            ),
        ),
    );
}

/** New tab: a searchable catalog of every destination. */
export function openCatalog() {
    const prev = document.activeElement as HTMLElement | null;
    let match: (s: string) => boolean = () => true;
    const list = h("ul", { class: "catalog-list" });
    const draw = () => {
        list.replaceChildren(
            ...pages
                .filter((p) => match(t(p.labelKey)))
                .map((p) =>
                    h(
                        "li",
                        null,
                        h(
                            "button",
                            {
                                class: "catalog-item",
                                onclick: () => {
                                    dlg.close();
                                    dlg.remove();
                                    openTab(p.id);
                                },
                            },
                            icon(p.icon),
                            label(p.labelKey),
                            settings.get().openTabs.includes(p.id)
                                ? h("span", { class: "muted small" }, "•")
                                : null,
                        ),
                    ),
                ),
        );
    };
    const search = regexField(
        "tabs.search",
        (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        },
        { id: "catalog-search" },
    );
    const dlg = h(
        "dialog",
        { class: "dialog catalog", "aria-labelledby": "catalog-title" },
        h("h2", { id: "catalog-title" }, t("tabs.catalog")),
        search.el,
        list,
        h(
            "div",
            { class: "row end" },
            h(
                "button",
                {
                    class: "btn",
                    onclick: () => {
                        dlg.close();
                        dlg.remove();
                        prev?.focus();
                    },
                },
                label("confirm.cancel"),
            ),
        ),
    );
    dlg.addEventListener("close", () => prev?.focus());
    draw();
    document.body.appendChild(dlg);
    dlg.showModal();
    search.focus();
}
