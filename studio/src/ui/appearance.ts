// Per-element and per-tab appearance editor. Any element marked with data-el
// can be restyled; every property resets on its own, per element, or globally.

import { h, icon } from "../lib/dom";
import { t } from "../lib/i18n";
import { settings } from "../lib/store";
import { colorSwatch } from "./colorPicker";
import { customSelect } from "./select";

type Prop =
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "fontStyle"
    | "letterSpacing"
    | "lineHeight"
    | "textTransform"
    | "color"
    | "backgroundColor"
    | "borderColor"
    | "borderWidth"
    | "borderRadius"
    | "padding"
    | "boxShadow";

const PROPS: Prop[] = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "color",
    "backgroundColor",
    "borderColor",
    "borderWidth",
    "borderRadius",
    "padding",
    "boxShadow",
];
const SHADOWS: Record<string, string> = {
    none: "none",
    soft: "0 8px 24px rgba(0,0,0,.25)",
    strong: "0 20px 60px rgba(0,0,0,.5)",
    glow: "0 0 0 1px var(--primary), 0 0 32px color-mix(in srgb, var(--primary) 40%, transparent)",
};

export function applyElementStyles(root: ParentNode = document) {
    const styles = settings.get().elementStyles;
    for (const el of root.querySelectorAll<HTMLElement>("[data-el]")) {
        const s = styles[el.dataset.el as string];
        for (const p of PROPS) el.style[p] = s?.[p] ?? "";
        el.style.borderStyle = s?.borderWidth ? "solid" : "";
    }
}

let fontCache: string[] | null = null;
async function fonts(): Promise<string[]> {
    if (fontCache) return fontCache;
    const base = [
        "Geist Variable",
        "Geist Mono Variable",
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
        if (q)
            fontCache = [
                ...new Set([...base, ...(await q()).map((f) => f.family)]),
            ];
    } catch {
        /* permission denied: shipped fonts only */
    }
    fontCache ??= base;
    return fontCache;
}

export async function openAppearanceEditor(target: HTMLElement) {
    const id = target.dataset.el;
    if (!id) return;
    document.querySelector(".appearance-pop")?.remove();
    const name = target.getAttribute("aria-label") ?? target.title ?? id;
    const cur = (): Record<string, string> => ({
        ...(settings.get().elementStyles[id] ?? {}),
    });
    const save = (p: Prop, v: string) => {
        const next = cur();
        if (v) next[p] = v;
        else delete next[p];
        const all = { ...settings.get().elementStyles };
        if (Object.keys(next).length) all[id] = next;
        else delete all[id];
        settings.set({ elementStyles: all }, true);
        applyElementStyles();
    };
    const fontList = await fonts();
    const prop = (
        labelText: string,
        p: Prop,
        control: HTMLElement,
        wide = false,
    ) =>
        h(
            "div",
            { class: `ap-prop ${wide ? "wide" : ""}` },
            h(
                "div",
                { class: "row" },
                h("span", { class: "grow" }, labelText),
                h(
                    "button",
                    {
                        type: "button",
                        class: "ap-reset",
                        "aria-label": `Reset ${labelText}`,
                        title: `Reset ${labelText}`,
                        onclick: () => {
                            save(p, "");
                            void openAppearanceEditor(target);
                        },
                    },
                    icon("close", 12),
                ),
            ),
            control,
        );
    const num = (p: Prop, unit: string, min: number, max: number, step = 1) => {
        const v = cur()[p]?.replace(unit, "") ?? "";
        const input = h("input", {
            class: "text-input",
            type: "number",
            min,
            max,
            step,
            value: v,
            "aria-label": `${p} in ${unit || "units"}`,
        });
        input.addEventListener("change", () =>
            save(p, input.value === "" ? "" : `${input.value}${unit}`),
        );
        return input;
    };
    const sel = (
        p: Prop,
        labelText: string,
        options: { value: string; label: string }[],
        searchable = false,
    ) =>
        customSelect({
            value: cur()[p] ?? "",
            label: labelText,
            searchable,
            placeholder: "Inherited",
            options: [{ value: "", label: "Inherited" }, ...options],
            onChange: (v) => save(p, v),
        });
    const c = cur();
    const close = () => {
        pop.remove();
        target.focus();
    };
    const pop = h(
        "div",
        {
            class: "appearance-pop surface-pop",
            role: "dialog",
            "aria-label": t("appearance.title", { name }),
        },
        h(
            "div",
            { class: "row" },
            h("h2", { class: "grow" }, t("appearance.title", { name })),
            h(
                "button",
                {
                    type: "button",
                    class: "icon-btn",
                    "aria-label": t("appearance.done"),
                    onclick: () => close(),
                },
                icon("close", 16),
            ),
        ),
        h(
            "div",
            { class: "ap-grid" },
            prop(
                t("appearance.font"),
                "fontFamily",
                sel(
                    "fontFamily",
                    t("appearance.font"),
                    fontList.map((f) => ({ value: f, label: f })),
                    true,
                ),
                true,
            ),
            prop(
                t("appearance.size"),
                "fontSize",
                num("fontSize", "px", 8, 96),
            ),
            prop(
                "Weight",
                "fontWeight",
                sel(
                    "fontWeight",
                    "Weight",
                    [300, 400, 500, 600, 700, 800].map((w) => ({
                        value: String(w),
                        label: String(w),
                    })),
                ),
            ),
            prop(
                "Style",
                "fontStyle",
                sel("fontStyle", "Style", [
                    { value: "normal", label: "Normal" },
                    { value: "italic", label: "Italic" },
                ]),
            ),
            prop(
                "Letter spacing",
                "letterSpacing",
                num("letterSpacing", "em", -0.1, 0.5, 0.01),
            ),
            prop(
                "Line height",
                "lineHeight",
                num("lineHeight", "", 0.8, 3, 0.05),
            ),
            prop(
                "Case",
                "textTransform",
                sel("textTransform", "Case", [
                    { value: "none", label: "As typed" },
                    { value: "uppercase", label: "UPPERCASE" },
                    { value: "lowercase", label: "lowercase" },
                    { value: "capitalize", label: "Capitalized" },
                ]),
            ),
            prop(
                t("appearance.color"),
                "color",
                colorSwatch(c.color, t("appearance.color"), (v) =>
                    save("color", v),
                ),
            ),
            prop(
                t("appearance.background"),
                "backgroundColor",
                colorSwatch(
                    c.backgroundColor,
                    t("appearance.background"),
                    (v) => save("backgroundColor", v),
                ),
            ),
            prop(
                "Border",
                "borderColor",
                colorSwatch(c.borderColor, "Border colour", (v) =>
                    save("borderColor", v),
                ),
            ),
            prop(
                "Border width",
                "borderWidth",
                num("borderWidth", "px", 0, 12),
            ),
            prop(
                t("appearance.radius"),
                "borderRadius",
                num("borderRadius", "px", 0, 60),
            ),
            prop("Padding", "padding", num("padding", "px", 0, 60)),
            prop(
                "Shadow",
                "boxShadow",
                customSelect({
                    value:
                        Object.entries(SHADOWS).find(
                            ([, v]) => v === c.boxShadow,
                        )?.[0] ?? "",
                    label: "Shadow",
                    placeholder: "Inherited",
                    options: [
                        { value: "", label: "Inherited" },
                        ...Object.keys(SHADOWS).map((k) => ({
                            value: k,
                            label: k[0].toUpperCase() + k.slice(1),
                        })),
                    ],
                    onChange: (v) => save("boxShadow", v ? SHADOWS[v] : ""),
                }),
            ),
        ),
        h(
            "div",
            { class: "row end" },
            h(
                "button",
                {
                    type: "button",
                    class: "btn small",
                    onclick: () => {
                        const next = { ...settings.get().elementStyles };
                        delete next[id];
                        settings.set({ elementStyles: next });
                        applyElementStyles();
                        close();
                    },
                },
                t("appearance.reset"),
            ),
            h(
                "button",
                {
                    type: "button",
                    class: "btn small primary",
                    onclick: () => close(),
                },
                t("appearance.done"),
            ),
        ),
    );
    pop.addEventListener("keydown", (e) => {
        if (
            e.key === "Escape" &&
            !document.querySelector(".select-pop, .color-pop")
        )
            close();
    });
    document.body.appendChild(pop);
    const rect = target.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const right = rect.right + 8 + pr.width < window.innerWidth;
    pop.style.left = `${right ? rect.right + 8 : Math.max(8, rect.left - pr.width - 8)}px`;
    pop.style.top = `${Math.min(window.innerHeight - pr.height - 12, Math.max(12, rect.top))}px`;
    pop.querySelector<HTMLElement>("button.select-btn")?.focus();
}

export function resetAllAppearance() {
    settings.set({ elementStyles: {} });
    applyElementStyles();
}
