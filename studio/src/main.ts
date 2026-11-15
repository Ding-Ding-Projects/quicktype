import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./styles/app.css";

import "./pages/generate";
import "./pages/simplePages";
import "./pages/tools";
import "./pages/extensions";
import "./pages/docs";
import "./pages/settings";

import { h, icon, logoMark, prefersReducedMotion, clear } from "./lib/dom";
import { htmlLang, label, setSchoolModeForText, t } from "./lib/i18n";
import { settings } from "./lib/store";
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
import { openPalette, paletteButton, addPaletteSource } from "./ui/palette";
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
import { generateActions } from "./pages/generate";
import { onHistory } from "./lib/history";

const app = document.getElementById("app") as HTMLElement;

function applyTheme() {
    const s = settings.get();
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
    root.style.setProperty("--primary", s.accent);
    root.style.setProperty("--text-scale", String(s.textScale));
    root.lang = htmlLang();
    document.title = s.displayName;
}

function notificationButton() {
    const n = unread();
    const btn = h(
        "button",
        {
            class: "icon-btn round",
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
                        h("h2", { class: "grow" }, t("notify.center")),
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
                                      { class: `note-${x.tone}` },
                                      h(
                                          "span",
                                          { style: "white-space: pre-line" },
                                          x.text,
                                      ),
                                      h(
                                          "span",
                                          { class: "muted small block" },
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
        icon("bell", 20),
        n ? h("span", { class: "badge", "aria-hidden": "true" }) : null,
    );
    return btn;
}

function titleBar() {
    const s = settings.get();
    return h(
        "header",
        { class: "titlebar" },
        h(
            "div",
            { class: "brand" },
            logoMark(s.logo.preset, s.logo.custom, 28),
            h("span", { class: "brand-name" }, s.displayName),
            edition() !== "desktop"
                ? h("span", { class: "pill teal" }, t(`edition.${edition()}`))
                : null,
            school.current().on
                ? h("span", { class: "pill" }, school.current().name)
                : null,
        ),
        paletteButton(),
        h(
            "div",
            { class: "title-actions" },
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
                  icon("download", 20),
                  h("span", { class: "grow" }, t("desktop.banner")),
                  h(
                      "a",
                      {
                          class: "btn warm",
                          href: DESKTOP_DOWNLOAD_URL,
                          target: "_blank",
                          rel: "noreferrer",
                      },
                      label("desktop.download"),
                  ),
              )
            : null;
    const footer = h(
        "footer",
        { class: "statusbar" },
        h("span", null, t("app.offline")),
        h("span", { class: "grow" }),
        h(
            "span",
            null,
            t("app.version", {
                version: BUILD.version,
                codeName: BUILD.codeName || "—",
            }),
        ),
        h(
            "span",
            { class: "muted" },
            t("about.updated", {
                date: new Date(BUILD.builtAt).toLocaleDateString(),
            }),
        ),
    );
    app.append(
        titleBar(),
        banner ?? "",
        h(
            "div",
            { class: `body dock-${s.dock}` },
            renderTabStrip(),
            h("div", { class: "content-wrap" }, content, footer),
        ),
    );
    applyElementStyles();
    if (focusedId) document.getElementById(focusedId)?.focus();
}

function installKeys() {
    document.addEventListener("keydown", (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
            e.preventDefault();
            openPalette();
        } else if (mod && !e.shiftKey && e.key.toLowerCase() === "t") {
            e.preventDefault();
            openCatalog();
        } else if (mod && !e.shiftKey && e.key.toLowerCase() === "w") {
            e.preventDefault();
            closeTab(settings.get().activeTab);
        } else if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
            e.preventDefault();
            void generateActions.copyCode();
        } else if (mod && !e.shiftKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            void generateActions.saveCode();
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
        if (edition() === "desktop" && !school.current().on)
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
        const file = e.dataTransfer.files[0];
        if (school.current().on) return;
        if (edition() !== "desktop") {
            notify("info", "desktop.only");
            return;
        }
        await loadWordingFile(file, true);
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
    reconcileTabs();
    settings.subscribe(() => render());
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", applyTheme);
    installKeys();
    installDrop();
    installGlobalContextMenu(openPalette);
    render();
    initUpdates();
    setWizardDone(render);
    if (needsWizard()) void showWizard();
}

void boot();
