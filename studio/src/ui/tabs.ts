// Browser-style tabs, docked left by default. Every tab starts open; tabs the
// user closes stay closed; tabs added by an update open once. Tabs can be
// pinned, reordered, grouped, restyled and found through four searches.

import { h, icon } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings, type Dock, type TabGroup } from "../lib/store";
import { pages, pageById } from "../pages/registry";
import { regexField } from "./regexField";
import { showMenu, type MenuItem } from "./contextMenu";
import { openAppearanceEditor } from "./appearance";

const GROUP_COLORS = [
    "#c6f432",
    "#7fd4ff",
    "#c792ea",
    "#f5b97a",
    "#ff8a7a",
    "#9be38a",
];

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
    const groups = s.tabGroups
        .map((g) => ({ ...g, tabs: g.tabs.filter((x) => all.includes(x)) }))
        .filter((g) => g.tabs.length);
    settings.set(
        {
            openTabs: open,
            knownTabs: all,
            activeTab: active,
            tabGroups: groups,
        },
        false,
    );
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
    settings.set(
        {
            openTabs: [
                ...s.openTabs,
                ...all.filter((id) => !s.openTabs.includes(id)),
            ],
        },
        false,
    );
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

const groupOf = (id: string) =>
    settings.get().tabGroups.find((g) => g.tabs.includes(id));

function setGroups(groups: TabGroup[]) {
    settings.set({ tabGroups: groups.filter((g) => g.tabs.length > 0) }, false);
}

function addToGroup(id: string, groupId: string | null) {
    const groups = settings
        .get()
        .tabGroups.map((g) => ({ ...g, tabs: g.tabs.filter((x) => x !== id) }));
    if (groupId === null) {
        const name = window.prompt(
            t("tabs.renameGroup"),
            `Group ${groups.length + 1}`,
        );
        if (!name) return;
        groups.push({
            id: crypto.randomUUID(),
            name: name.slice(0, 40),
            color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
            collapsed: false,
            tabs: [id],
        });
    } else groups.find((g) => g.id === groupId)?.tabs.push(id);
    setGroups(groups);
}

function groupMenu(g: TabGroup, at: { x: number; y: number }) {
    const groups = settings.get().tabGroups;
    const idx = groups.findIndex((x) => x.id === g.id);
    const update = (patch: Partial<TabGroup>) =>
        setGroups(groups.map((x) => (x.id === g.id ? { ...x, ...patch } : x)));
    showMenu(
        [
            {
                label: g.collapsed ? "Expand group" : "Collapse group",
                run: () => update({ collapsed: !g.collapsed }),
            },
            {
                label: t("tabs.renameGroup"),
                run: () => {
                    const name = window.prompt(t("tabs.renameGroup"), g.name);
                    if (name) update({ name: name.slice(0, 40) });
                },
            },
            ...GROUP_COLORS.map((c, i) => ({
                label: `${t("tabs.groupColor")}: ${["lime", "sky", "violet", "apricot", "coral", "mint"][i]}`,
                checked: g.color === c,
                run: () => update({ color: c }),
            })),
            {
                label: "Move group up",
                disabled: idx === 0,
                run: () => {
                    const next = [...groups];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    setGroups(next);
                },
            },
            {
                label: "Move group down",
                disabled: idx === groups.length - 1,
                run: () => {
                    const next = [...groups];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    setGroups(next);
                },
            },
            {
                label: t("tabs.ungroup"),
                run: () => setGroups(groups.filter((x) => x.id !== g.id)),
            },
        ],
        at,
    );
}

export function tabMenu(id: string | null, at: { x: number; y: number }) {
    const s = settings.get();
    const items: MenuItem[] = [];
    if (id) {
        const g = groupOf(id);
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
        items.push({
            label: t("tabs.editAppearance"),
            shortcut: "Shift+Right-click",
            run: () => {
                const el = document.getElementById(`tab-${id}`);
                if (el) void openAppearanceEditor(el);
            },
        });
        items.push({
            label: t("tabs.newGroup"),
            run: () => addToGroup(id, null),
        });
        for (const other of s.tabGroups.filter((x) => x.id !== g?.id))
            items.push({
                label: `${t("tabs.addToGroup")}: ${other.name}`,
                run: () => addToGroup(id, other.id),
            });
        if (g)
            items.push({
                label: t("tabs.removeFromGroup"),
                run: () =>
                    setGroups(
                        s.tabGroups.map((x) => ({
                            ...x,
                            tabs: x.tabs.filter((y) => y !== id),
                        })),
                    ),
            });
        items.push({
            label: "Move up",
            shortcut: "Alt+Shift+Up",
            run: () => move(id, -1),
        });
        items.push({
            label: "Move down",
            shortcut: "Alt+Shift+Down",
            run: () => move(id, 1),
        });
    }
    if (s.openTabs.length < pages.length)
        items.push({ label: t("tabs.openAll"), run: openEveryTab });
    items.push({ label: t("tabs.new"), shortcut: "Ctrl+T", run: openCatalog });
    items.push({
        label: s.stripCollapsed
            ? t("tabs.expandStrip")
            : t("tabs.collapseStrip"),
        run: () => settings.set({ stripCollapsed: !s.stripCollapsed }),
    });
    for (const d of ["left", "right", "top", "bottom"] as Dock[])
        items.push({
            label: `${t("tabs.dock")}: ${t(`dock.${d}`)}`,
            checked: s.dock === d,
            run: () => settings.set({ dock: d }),
        });
    showMenu(items, at);
}

export function renderTabStrip(): HTMLElement {
    const s = settings.get();
    const vertical = s.dock === "left" || s.dock === "right";
    let stripQuery: (x: string) => boolean = () => true;
    const groupQuery = new Map<string, (x: string) => boolean>();
    const list = h("div", {
        class: "tab-list",
        role: "tablist",
        "aria-orientation": vertical ? "vertical" : "horizontal",
        "aria-label": t("tabs.catalog"),
    });
    const ordered = () => s.openTabs.filter((id) => pageById(id));

    const tabEl = (id: string) => {
        const p = pageById(id);
        if (!p) return null;
        const text = t(p.labelKey);
        const active = s.activeTab === id;
        const pinned = s.pinnedTabs.includes(id);
        return h(
            "div",
            {
                class: `tab ${active ? "active" : ""} ${pinned ? "pinned" : ""}`,
                role: "tab",
                id: `tab-${id}`,
                "aria-selected": String(active),
                "aria-controls": "page",
                "aria-label": text,
                tabindex: active ? 0 : -1,
                draggable: "true",
                title: text,
                dataset: { el: `tab.${id}`, tab: id },
                onclick: () => settings.set({ activeTab: id }, false),
                onkeydown: (e: KeyboardEvent) => {
                    const ids = ordered();
                    const i = ids.indexOf(id);
                    const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
                    const nextKey = vertical ? "ArrowDown" : "ArrowRight";
                    if (
                        e.altKey &&
                        e.shiftKey &&
                        (e.key === prevKey || e.key === nextKey)
                    )
                        move(id, e.key === prevKey ? -1 : 1);
                    else if (
                        e.key === prevKey ||
                        e.key === nextKey ||
                        e.key === "Home" ||
                        e.key === "End"
                    ) {
                        const nid =
                            e.key === "Home"
                                ? ids[0]
                                : e.key === "End"
                                  ? ids[ids.length - 1]
                                  : ids[
                                        (i +
                                            (e.key === prevKey ? -1 : 1) +
                                            ids.length) %
                                            ids.length
                                    ];
                        settings.set({ activeTab: nid }, false);
                        requestAnimationFrame(() =>
                            document.getElementById(`tab-${nid}`)?.focus(),
                        );
                    } else if (e.key === "Delete") closeTab(id);
                    else if (e.key === "F10" && e.shiftKey) {
                        const r = (
                            e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        tabMenu(id, { x: r.right, y: r.top });
                    } else return;
                    e.preventDefault();
                },
                oncontextmenu: (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.shiftKey)
                        void openAppearanceEditor(
                            e.currentTarget as HTMLElement,
                        );
                    else tabMenu(id, { x: e.clientX, y: e.clientY });
                },
                ondragstart: (e: DragEvent) =>
                    e.dataTransfer?.setData("text/x-studio-tab", id),
                ondragover: (e: DragEvent) => {
                    if (e.dataTransfer?.types.includes("text/x-studio-tab"))
                        e.preventDefault();
                },
                ondrop: (e: DragEvent) => {
                    const from = e.dataTransfer?.getData("text/x-studio-tab");
                    if (!from || from === id) return;
                    e.preventDefault();
                    const open = s.openTabs.filter((x) => x !== from);
                    open.splice(open.indexOf(id), 0, from);
                    const target = groupOf(id);
                    const groups = s.tabGroups.map((g) => ({
                        ...g,
                        tabs: g.tabs.filter((x) => x !== from),
                    }));
                    if (target)
                        groups.find((g) => g.id === target.id)?.tabs.push(from);
                    settings.set(
                        {
                            openTabs: open,
                            tabGroups: groups.filter((g) => g.tabs.length),
                        },
                        false,
                    );
                },
            },
            icon(p.icon, 18),
            h("span", { class: "tab-label" }, label(p.labelKey)),
            pinned
                ? h(
                      "span",
                      { class: "tab-pin", "aria-hidden": "true" },
                      icon("pin", 13),
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
                icon("close", 11),
            ),
        );
    };

    const draw = () => {
        list.replaceChildren();
        const grouped = new Set(s.tabGroups.flatMap((g) => g.tabs));
        for (const id of ordered()) {
            if (grouped.has(id)) continue;
            const p = pageById(id);
            if (p && stripQuery(t(p.labelKey))) {
                const el = tabEl(id);
                if (el) list.append(el);
            }
        }
        for (const g of s.tabGroups) {
            const members = ordered().filter((id) => g.tabs.includes(id));
            if (members.length === 0) continue;
            const gq = groupQuery.get(g.id) ?? (() => true);
            const shown = members.filter((id) => {
                const p = pageById(id);
                return p && stripQuery(t(p.labelKey)) && gq(t(p.labelKey));
            });
            const head = h(
                "button",
                {
                    type: "button",
                    class: "group-head",
                    "aria-expanded": String(!g.collapsed),
                    title: g.name,
                    onclick: () =>
                        setGroups(
                            s.tabGroups.map((x) =>
                                x.id === g.id
                                    ? { ...x, collapsed: !x.collapsed }
                                    : x,
                            ),
                        ),
                    oncontextmenu: (e: MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        groupMenu(g, { x: e.clientX, y: e.clientY });
                    },
                },
                h("span", {
                    class: "group-dot",
                    style: { background: g.color },
                }),
                h("span", { class: "lbl grow" }, g.name),
                h("span", { class: "faint mono" }, String(members.length)),
            );
            const box = h(
                "div",
                { class: "tab-group", role: "group", "aria-label": g.name },
                head,
            );
            if (!g.collapsed) {
                if (members.length > 2) {
                    const gs = regexField(
                        "tabs.groupSearch",
                        (m) => {
                            groupQuery.set(g.id, m.ok ? m.test : () => true);
                            draw();
                            requestAnimationFrame(() =>
                                document
                                    .getElementById(`gsearch-${g.id}`)
                                    ?.focus(),
                            );
                        },
                        { id: `gsearch-${g.id}` },
                    );
                    gs.el.classList.add("group-search");
                    box.append(gs.el);
                }
                for (const id of shown) {
                    const el = tabEl(id);
                    if (el) box.append(el);
                }
            }
            list.append(box);
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
            class: `tab-strip dock-${s.dock} ${s.stripCollapsed && vertical ? "collapsed" : ""}`,
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
                    class: "btn dashed small",
                    onclick: openCatalog,
                    "aria-keyshortcuts": "Control+T",
                    "aria-label": t("tabs.new"),
                },
                icon("plus", 16),
                label("tabs.new"),
            ),
            vertical
                ? h(
                      "button",
                      {
                          class: "icon-btn",
                          "aria-label": s.stripCollapsed
                              ? t("tabs.expandStrip")
                              : t("tabs.collapseStrip"),
                          title: s.stripCollapsed
                              ? t("tabs.expandStrip")
                              : t("tabs.collapseStrip"),
                          onclick: () =>
                              settings.set({
                                  stripCollapsed: !s.stripCollapsed,
                              }),
                      },
                      icon("sidebar", 16),
                  )
                : null,
        ),
    );
}

/** New tab: a searchable catalog of every destination, with a group finder and a search over every open tab. */
export function openCatalog() {
    const prev = document.activeElement as HTMLElement | null;
    let match: (s: string) => boolean = () => true;
    let groupMatch: ((s: string) => boolean) | null = null;
    const list = h("ul", { class: "catalog-list" });
    const close = () => {
        dlg.close();
        dlg.remove();
        prev?.focus();
    };
    const draw = () => {
        const s = settings.get();
        const groups = s.tabGroups.filter(
            (g) => !groupMatch || groupMatch(g.name),
        );
        const rows = pages.filter(
            (p) =>
                match(t(p.labelKey)) &&
                (!groupMatch || groups.some((g) => g.tabs.includes(p.id))),
        );
        list.replaceChildren(
            ...rows.map((p) => {
                const g = s.tabGroups.find((x) => x.tabs.includes(p.id));
                const meta = [
                    s.openTabs.includes(p.id) ? "open" : "closed",
                    s.pinnedTabs.includes(p.id) ? "pinned" : "",
                    g ? `in ${g.name}` : "",
                ]
                    .filter(Boolean)
                    .join(" · ");
                return h(
                    "li",
                    null,
                    h(
                        "button",
                        {
                            class: "catalog-item",
                            onclick: () => {
                                close();
                                openTab(p.id);
                            },
                        },
                        icon(p.icon),
                        label(p.labelKey),
                        h("span", { class: "catalog-meta" }, meta),
                    ),
                );
            }),
        );
        if (rows.length === 0)
            list.append(h("li", { class: "muted" }, t("palette.nothing")));
    };
    const search = regexField(
        "tabs.masterSearch",
        (m) => {
            match = m.ok ? m.test : () => true;
            draw();
        },
        { id: "catalog-search" },
    );
    const groupSearch = regexField(
        "tabs.groupsSearch",
        (m) => {
            groupMatch = m.ok && m.source !== "" ? m.test : null;
            draw();
        },
        { id: "catalog-group-search" },
    );
    const dlg = h(
        "dialog",
        {
            class: "dialog catalog",
            "aria-labelledby": "catalog-title",
            style: "width: min(720px, calc(100vw - 32px))",
        },
        h("h2", { id: "catalog-title" }, t("tabs.catalog")),
        h(
            "div",
            { class: "row wrap" },
            search.el,
            settings.get().tabGroups.length ? groupSearch.el : null,
        ),
        list,
        h(
            "div",
            { class: "row end" },
            h(
                "button",
                { class: "btn", onclick: close },
                label("confirm.cancel"),
            ),
        ),
    );
    dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        close();
    });
    draw();
    document.body.appendChild(dlg);
    dlg.showModal();
    search.focus();
}
