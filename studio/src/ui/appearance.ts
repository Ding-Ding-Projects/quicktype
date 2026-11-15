// Per-element appearance editor. Any element marked with data-el can be
// restyled; choices persist and reset per property or per element.

import { h } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings } from "../lib/store";

const PROPS = [
    "fontFamily",
    "fontSize",
    "color",
    "backgroundColor",
    "borderRadius",
] as const;
type Prop = (typeof PROPS)[number];

export function applyElementStyles(root: ParentNode = document) {
    const styles = settings.get().elementStyles;
    for (const el of root.querySelectorAll<HTMLElement>("[data-el]")) {
        const s = styles[el.dataset.el as string];
        for (const p of PROPS) el.style[p] = s?.[p] ?? "";
    }
}

async function fonts(): Promise<string[]> {
    const base = [
        "Atkinson Hyperlegible Next",
        "Bricolage Grotesque Variable",
        "JetBrains Mono Variable",
        "system-ui",
        "serif",
        "monospace",
    ];
    try {
        const q = (
            window as unknown as {
                queryLocalFonts?: () => Promise<{ family: string }[]>;
            }
        ).queryLocalFonts;
        if (q) {
            const list = await q();
            return [...new Set([...base, ...list.map((f) => f.family)])];
        }
    } catch {
        /* permission denied: shipped fonts only */
    }
    return base;
}

export async function openAppearanceEditor(target: HTMLElement) {
    const id = target.dataset.el;
    if (!id) return;
    document.querySelector(".appearance-pop")?.remove();
    const cur = { ...(settings.get().elementStyles[id] ?? {}) };
    const save = (p: Prop, v: string) => {
        if (v) cur[p] = v;
        else delete cur[p];
        settings.set({
            elementStyles: {
                ...settings.get().elementStyles,
                [id]: { ...cur },
            },
        });
        applyElementStyles();
    };
    const fontSel = h(
        "select",
        {
            class: "text-input",
            onchange: () => save("fontFamily", fontSel.value),
        },
        h("option", { value: "" }, "—"),
    );
    for (const f of await fonts())
        fontSel.append(
            h("option", { value: f, selected: cur.fontFamily === f }, f),
        );
    const field = (key: Parameters<typeof label>[0], control: HTMLElement) =>
        h("label", { class: "field" }, label(key), control);
    const size = h("input", {
        type: "number",
        min: 8,
        max: 72,
        class: "text-input",
        value: (cur.fontSize ?? "").replace("px", ""),
        oninput: () => save("fontSize", size.value ? `${size.value}px` : ""),
    });
    const color = h("input", {
        type: "color",
        value: cur.color ?? "#1c1b1f",
        oninput: () => save("color", color.value),
    });
    const bg = h("input", {
        type: "color",
        value: cur.backgroundColor ?? "#ffffff",
        oninput: () => save("backgroundColor", bg.value),
    });
    const radius = h("input", {
        type: "range",
        min: 0,
        max: 40,
        value: (cur.borderRadius ?? "0").replace("px", ""),
        oninput: () => save("borderRadius", `${radius.value}px`),
    });
    const rect = target.getBoundingClientRect();
    const pop = h(
        "div",
        {
            class: "appearance-pop surface-pop",
            role: "dialog",
            "aria-label": t("appearance.title", {
                name: target.getAttribute("aria-label") ?? id,
            }),
        },
        h(
            "h2",
            null,
            t("appearance.title", {
                name: target.getAttribute("aria-label") ?? id,
            }),
        ),
        field("appearance.font", fontSel),
        field("appearance.size", size),
        field("appearance.color", color),
        field("appearance.background", bg),
        field("appearance.radius", radius),
        h(
            "div",
            { class: "row end" },
            h(
                "button",
                {
                    class: "btn",
                    onclick: () => {
                        const next = { ...settings.get().elementStyles };
                        delete next[id];
                        settings.set({ elementStyles: next });
                        applyElementStyles();
                        pop.remove();
                    },
                },
                label("appearance.reset"),
            ),
            h(
                "button",
                { class: "btn primary", onclick: () => pop.remove() },
                label("appearance.done"),
            ),
        ),
    );
    pop.style.top = `${Math.min(window.innerHeight - 420, Math.max(8, rect.top))}px`;
    pop.style.left = `${Math.min(window.innerWidth - 340, Math.max(8, rect.right + 8))}px`;
    pop.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            pop.remove();
            target.focus();
        }
    });
    document.body.appendChild(pop);
    fontSel.focus();
}
