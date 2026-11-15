import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles/app.css";
import "./styles/json-editor.css";

import "./pages/generate";
import "./pages/jsonEditor";
import "./pages/simplePages";
import "./pages/tools";
import "./pages/extensions";
import "./pages/docs";
import "./pages/settings";

import { h, icon, logoMark, prefersReducedMotion, clear } from "./lib/dom";
import {
    htmlLang,
    label,
    setLanguageOverride,
    setSchoolModeForText,
    t,
} from "./lib/i18n";
import { DEFAULT_SETTINGS, settings, type Settings } from "./lib/store";
import { loadCache, onWording } from "./lib/wording";
import * as school from "./lib/school";
import { BUILD, DESKTOP_DOWNLOAD_URL, edition, host } from "./lib/platform";
import { pages, pageById } from "./pages/registry";
import {
    closeTab,
    openCatalog,
    reconcileTabs,
    renderTabStrip,
} from "./ui/tabs";
import { openPalette, addPaletteSource } from "./ui/palette";
import { installGlobalContextMenu } from "./ui/contextMenu";
import {
    allNotes,
    clearNotes,
    markRead,
    notify,
    onNotes,
    unread,
} from "./ui/toast";
import { applyElementStyles } from "./ui/appearance";
import { loadWordingFile } from "./pages/settings";
import {
    needsWizard,
    setWizardDone,
    showWizard,
    restartWizard,
} from "./ui/wizard";
import { initUpdates, checkForUpdates } from "./ui/updates";
import { generateActions, generationSummary } from "./pages/generate";
import { onHistory } from "./lib/history";

const app = document.getElementById("app") as HTMLElement;

/** Settings with any active time-of-day schedule applied on top. */
function effective(): Settings {
    const s = settings.get();
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (v: string) => {
        const [hh, mm] = v.split(":").map(Number);
        return (hh || 0) * 60 + (mm || 0);
    };
    const out = { ...s };
    for (const r of s.schedules) {
        if (!r.enabled) continue;
        const a = toMin(r.from);
        const b = toMin(r.to);
        const inside = a <= b ? mins >= a && mins < b : mins >= a || mins < b;
        if (inside) (out as Record<string, unknown>)[r.key] = r.value;
    }
    return out;
}

function applyTheme() {
    const s = effective();
    if (
        setLanguageOverride(
            s.language !== settings.get().language ? s.language : null,
        ) &&
        app.childElementCount
    )
        queueMicrotask(render);
    const root = document.documentElement;
    const dark =
        s.theme === "dark" ||
        (s.theme === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme =
        s.theme === "contrast" ? "contrast" : dark ? "dark" : "light";
    root.dataset.density = s.density;
    root.dataset.motion = prefersReducedMotion(s.reducedMotion)
        ? "reduced"
        : "full";
    root.dataset.focus = s.adhd.focus ? "on" : "off";
    const accent =
        s.accent === DEFAULT_SETTINGS.accent && root.dataset.theme === "light"
            ? "#4b2fe0"
            : s.accent;
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--text-scale", String(s.textScale));
    root.lang = htmlLang();
    document.title = s.displayName;
}

function notificationButton() {
    const n = unread();
    const btn = h(
        "button",
        {
            class: "icon-btn",
            "aria-label": `${t("notify.center")}${n ? `, ${n}` : ""}`,
            "aria-haspopup": "dialog",
            onclick: () => {
                const panel = h(
                    "div",
                    {
                        class: "notify-panel surface-pop",
                        role: "dialog",
                        "aria-label": t("notify.center"),
                    },
                    h(
                        "div",
                        { class: "row" },
                        h(
                            "h2",
                            { class: "grow", style: "margin:0;font-size:1rem" },
                            t("notify.center"),
                        ),
                        h(
                            "button",
                            {
                                class: "btn small",
                                onclick: () => {
                                    clearNotes();
                                    panel.remove();
                                },
                            },
                            label("notify.clear"),
                        ),
                    ),
                    allNotes().length === 0
                        ? h("p", { class: "muted" }, t("notify.none"))
                        : h(
                              "ul",
                              { class: "notify-list" },
                              ...allNotes().map((x) =>
                                  h(
                                      "li",
                                      null,
                                      h(
                                          "span",
                                          { style: "white-space: pre-line" },
                                          x.text,
                                      ),
                                      h(
                                          "span",
                                          { class: "faint small block" },
                                          x.at.toLocaleTimeString(),
                                      ),
                                  ),
                              ),
                          ),
                );
                document.querySelector(".notify-panel")?.remove();
                document.body.appendChild(panel);
                markRead();
                const close = (e: Event) => {
                    if (!panel.contains(e.target as Node) && e.target !== btn) {
                        panel.remove();
                        document.removeEventListener(
                            "pointerdown",
                            close,
                            true,
                        );
                    }
                };
                setTimeout(() =>
                    document.addEventListener("pointerdown", close, true),
                );
                panel.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        panel.remove();
                        btn.focus();
                    }
                });
                panel.querySelector("button")?.focus();
            },
        },
        icon("bell", 18),
        n ? h("span", { class: "badge", "aria-hidden": "true" }) : null,
    );
    return btn;
}

let timerEnd = 0;
function focusTimer() {
    const s = settings.get();
    if (!s.adhd.timers) return null;
    const el = h("button", {
        class: "focus-timer",
        type: "button",
        "aria-live": "off",
        title: "Focus timer: click to start or restart",
    });
    const tick = () => {
        if (!timerEnd) {
            el.textContent = `${s.focusMinutes}:00 focus`;
            return;
        }
        const left = Math.max(0, timerEnd - Date.now());
        el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
        if (left === 0) {
            timerEnd = 0;
            notify("info", "msg.converted", {
                from: `${s.focusMinutes} minutes of focus`,
                to: "a break",
            });
        }
    };
    el.addEventListener("click", () => {
        timerEnd = Date.now() + s.focusMinutes * 60000;
        tick();
    });
    tick();
    const iv = setInterval(
        () => (el.isConnected ? tick() : clearInterval(iv)),
        1000,
    );
    return el;
}

function titleBar() {
    const s = settings.get();
    const page = pageById(s.activeTab);
    return h(
        "header",
        { class: "titlebar" },
        h(
            "div",
            { class: "brand" },
            logoMark(s.logo.preset, s.logo.custom, 24),
            h("span", { class: "brand-name" }, s.displayName),
        ),
        h(
            "nav",
            { class: "crumbs", "aria-label": "Location" },
            h("span", { "aria-hidden": "true" }, "/"),
            h("span", { class: "here" }, page ? t(page.labelKey) : ""),
            s.activeTab === "generate"
                ? h(
                      "span",
                      { class: "chiplet accent crumb-status" },
                      generationSummary(),
                  )
                : null,
            edition() !== "desktop"
                ? h("span", { class: "pill teal" }, t(`edition.${edition()}`))
                : null,
            school.current().on
                ? h("span", { class: "pill" }, school.current().name)
                : null,
        ),
        h(
            "div",
            { class: "title-actions" },
            focusTimer(),
            h(
                "span",
                { class: "chiplet", title: "Everything runs on this device" },
                "local · offline",
            ),
            notificationButton(),
            host
                ? [
                      h(
                          "button",
                          {
                              class: "win-btn",
                              "aria-label": "Minimize window",
                              onclick: () => host?.window.minimize(),
                          },
                          icon("minimize", 14),
                      ),
                      h(
                          "button",
                          {
                              class: "win-btn",
                              "aria-label": "Maximize window",
                              onclick: () => host?.window.toggleMaximize(),
                          },
                          icon("maximize", 14),
                      ),
                      h(
                          "button",
                          {
                              class: "win-btn close",
                              "aria-label": "Close window",
                              onclick: () => host?.window.close(),
                          },
                          icon("close", 14),
                      ),
                  ]
                : null,
        ),
    );
}

function commandBar() {
    return h(
        "button",
        {
            class: "cmdbar",
            type: "button",
            onclick: openPalette,
            "aria-keyshortcuts": "Control+Shift+F",
            "aria-label": t("palette.label"),
        },
        icon("search", 16),
        h("span", { class: "grow" }, t("app.searchHint")),
        h("span", { class: "cmdbar-meta" }, ".*"),
        h("kbd", null, "Ctrl Shift F"),
    );
}

function render() {
    applyTheme();
    const s = settings.get();
    const page = pageById(s.activeTab);
    const focusedId = (document.activeElement as HTMLElement | null)?.id;
    clear(app);
    const content = h("main", {
        id: "page",
        class: "content",
        tabindex: -1,
        "aria-labelledby": page ? `tab-${page.id}` : undefined,
    });
    if (page)
        content.appendChild(
            page.render({
                rerender: render,
                go: (id) => settings.set({ activeTab: id }, false),
            }),
        );
    else
        content.appendChild(
            h(
                "div",
                { class: "page empty-state" },
                h("p", null, t("tabs.catalog")),
                h(
                    "button",
                    { class: "btn primary", onclick: openCatalog },
                    label("tabs.new"),
                ),
            ),
        );
    const banner =
        edition() !== "desktop"
            ? h(
                  "div",
                  { class: "desktop-banner", role: "note" },
                  icon("download", 18),
                  h("span", { class: "grow" }, t("desktop.banner")),
                  h(
                      "a",
                      {
                          class: "btn small warm",
                          href: DESKTOP_DOWNLOAD_URL,
                          target: "_blank",
                          rel: "noreferrer",
                      },
                      label("desktop.download"),
                  ),
              )
            : null;
    app.append(
        titleBar(),
        banner ?? "",
        h(
            "div",
            { class: `body dock-${s.dock}` },
            renderTabStrip(),
            h("div", { class: "content-wrap" }, content),
        ),
        commandBar(),
    );
    applyElementStyles();
    if (focusedId) document.getElementById(focusedId)?.focus();
}

function installKeys() {
    document.addEventListener("keydown", (e) => {
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (mod && e.shiftKey && k === "f") {
            e.preventDefault();
            openPalette();
        } else if (mod && !e.shiftKey && k === "t") {
            e.preventDefault();
            openCatalog();
        } else if (mod && !e.shiftKey && k === "w") {
            e.preventDefault();
            closeTab(settings.get().activeTab);
        } else if (
            mod &&
            e.shiftKey &&
            k === "c" &&
            settings.get().activeTab === "generate"
        ) {
            e.preventDefault();
            void generateActions.copyCode();
        } else if (
            mod &&
            !e.shiftKey &&
            k === "s" &&
            settings.get().activeTab === "generate"
        ) {
            e.preventDefault();
            void generateActions.saveCode();
        } else if (mod && k === "b") {
            e.preventDefault();
            settings.set({ stripCollapsed: !settings.get().stripCollapsed });
        }
    });
}

function installDrop() {
    let depth = 0;
    const overlay = h(
        "div",
        { class: "drop-overlay", "aria-hidden": "true" },
        h("div", null, icon("upload", 40), h("p", null, t("set.vocab"))),
    );
    window.addEventListener("dragenter", (e) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        depth++;
        if (
            edition() === "desktop" &&
            !school.current().on &&
            settings.get().activeTab !== "json"
        )
            document.body.appendChild(overlay);
    });
    window.addEventListener("dragleave", () => {
        depth = Math.max(0, depth - 1);
        if (depth === 0) overlay.remove();
    });
    window.addEventListener("dragover", (e) => {
        if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    window.addEventListener("drop", async (e) => {
        if (!e.dataTransfer?.files.length) return;
        e.preventDefault();
        depth = 0;
        overlay.remove();
        if (school.current().on) return;
        if (edition() !== "desktop") {
            notify("info", "desktop.only");
            return;
        }
        await loadWordingFile(e.dataTransfer.files[0], true);
    });
}

const DISHES = [
    ["Har gow", "蝦餃"],
    ["Siu mai", "燒賣"],
    ["Char siu bao", "叉燒包"],
    ["Cheung fun", "腸粉"],
    ["Egg tart", "蛋撻"],
    ["Lo mai gai", "糯米雞"],
];
let generations = 0;
onHistory(() => {
    generations++;
    const s = settings.get();
    if (s.dimSum && !school.current().on && generations % 15 === 0) {
        const [en, zh] = DISHES[Math.floor(Math.random() * DISHES.length)];
        notify("info", "msg.dimSum", { dish: `${en} ${zh}` });
    }
});

addPaletteSource(() => [
    {
        group: "commands",
        title: t("tabs.new"),
        shortcut: "Ctrl+T",
        run: openCatalog,
    },
    {
        group: "commands",
        title: t("tabs.close"),
        shortcut: "Ctrl+W",
        run: () => closeTab(settings.get().activeTab),
    },
    {
        group: "commands",
        title: settings.get().stripCollapsed
            ? t("tabs.expandStrip")
            : t("tabs.collapseStrip"),
        shortcut: "Ctrl+B",
        run: () =>
            settings.set({ stripCollapsed: !settings.get().stripCollapsed }),
    },
    { group: "commands", title: t("set.onboardingAgain"), run: restartWizard },
    {
        group: "commands",
        title: t("set.checkNow"),
        run: () => void checkForUpdates(true),
    },
    {
        group: "commands",
        title: `${t("set.theme")}: ${t("theme.dark")}`,
        run: () => settings.set({ theme: "dark" }),
    },
    {
        group: "commands",
        title: `${t("set.theme")}: ${t("theme.light")}`,
        run: () => settings.set({ theme: "light" }),
    },
    ...pages.map((p) => ({
        group: "commands" as const,
        title: `${t("menu.goTo")}: ${t(p.labelKey)}`,
        run: () => settings.set({ activeTab: p.id }, false),
    })),
]);

async function boot() {
    loadCache();
    await school.load();
    setSchoolModeForText(school.current().on);
    school.onChange((r) => {
        setSchoolModeForText(r.on);
        render();
    });
    onWording(render);
    onNotes(() => {
        const btn = document.querySelector<HTMLElement>(
            ".title-actions .icon-btn",
        );
        if (btn) btn.replaceWith(notificationButton());
    });
    document.addEventListener("studio:generated", () => {
        const c = document.querySelector(".crumb-status");
        if (c) c.textContent = generationSummary();
    });
    reconcileTabs();
    settings.subscribe(() => render());
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", applyTheme);
    // Scheduled settings take effect at their minute without a restart.
    setInterval(applyTheme, 30_000);
    installKeys();
    installDrop();
    installGlobalContextMenu(openPalette);
    render();
    initUpdates();
    setWizardDone(render);
    if (needsWizard()) void showWizard();
}

void boot();
