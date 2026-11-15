// One context menu for every element, with the shortcuts that really work.

import { h, icon } from "../lib/dom";
import { t } from "../lib/i18n";
import { openAppearanceEditor } from "./appearance";

export interface MenuItem {
    label: string;
    shortcut?: string;
    checked?: boolean;
    disabled?: boolean;
    run: () => void;
}

export function showMenu(items: MenuItem[], at: { x: number; y: number }) {
    document.querySelector(".ctx-menu")?.remove();
    const prev = document.activeElement as HTMLElement | null;
    const menu = h("div", { class: "ctx-menu surface-pop", role: "menu" });
    const close = () => {
        menu.remove();
        document.removeEventListener("pointerdown", outside, true);
        prev?.focus?.();
    };
    const outside = (e: Event) => {
        if (!menu.contains(e.target as Node)) close();
    };
    for (const it of items) {
        menu.appendChild(
            h(
                "button",
                {
                    class: "ctx-item",
                    role:
                        it.checked === undefined
                            ? "menuitem"
                            : "menuitemcheckbox",
                    "aria-checked":
                        it.checked === undefined
                            ? undefined
                            : String(it.checked),
                    disabled: it.disabled,
                    onclick: () => {
                        close();
                        it.run();
                    },
                },
                h(
                    "span",
                    { class: "ctx-check", "aria-hidden": "true" },
                    it.checked ? icon("check", 14) : null,
                ),
                h("span", { class: "ctx-label" }, it.label),
                it.shortcut ? h("kbd", null, it.shortcut) : null,
            ),
        );
    }
    menu.addEventListener("keydown", (e) => {
        const btns = [
            ...menu.querySelectorAll<HTMLButtonElement>(
                ".ctx-item:not([disabled])",
            ),
        ];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape") close();
        else if (e.key === "ArrowDown") btns[(i + 1) % btns.length]?.focus();
        else if (e.key === "ArrowUp")
            btns[(i - 1 + btns.length) % btns.length]?.focus();
        else return;
        e.preventDefault();
    });
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(at.x, window.innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(at.y, window.innerHeight - r.height - 8)}px`;
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
    menu.querySelector<HTMLButtonElement>(".ctx-item")?.focus();
}

export function installGlobalContextMenu(openPalette: () => void) {
    document.addEventListener("contextmenu", (e) => {
        const target = e.target as HTMLElement;
        if (e.defaultPrevented) return;
        e.preventDefault();
        const styled = target.closest<HTMLElement>("[data-el]");
        if (e.shiftKey && styled) {
            void openAppearanceEditor(styled);
            return;
        }
        const editable = target.closest<HTMLElement>(
            "input, textarea, [contenteditable=true]",
        );
        const selection = window.getSelection()?.toString() ?? "";
        const items: MenuItem[] = [];
        if (selection || editable)
            items.push({
                label: t("menu.copy"),
                shortcut: "Ctrl+C",
                disabled: !selection,
                run: () => void navigator.clipboard?.writeText(selection),
            });
        if (editable) {
            items.push({
                label: t("menu.paste"),
                shortcut: "Ctrl+V",
                run: async () => {
                    const text = await navigator.clipboard?.readText?.();
                    if (
                        text &&
                        (editable instanceof HTMLInputElement ||
                            editable instanceof HTMLTextAreaElement)
                    )
                        editable.setRangeText(
                            text,
                            editable.selectionStart ?? 0,
                            editable.selectionEnd ?? 0,
                            "end",
                        );
                    editable.dispatchEvent(
                        new Event("input", { bubbles: true }),
                    );
                },
            });
            items.push({
                label: t("menu.selectAll"),
                shortcut: "Ctrl+A",
                run: () => (editable as HTMLInputElement).select?.(),
            });
        }
        if (styled)
            items.push({
                label: t("menu.appearance"),
                shortcut: "Shift+Right-click",
                run: () => void openAppearanceEditor(styled),
            });
        items.push({
            label: t("menu.palette"),
            shortcut: "Ctrl+Shift+F",
            run: openPalette,
        });
        showMenu(items, { x: e.clientX, y: e.clientY });
    });
}
