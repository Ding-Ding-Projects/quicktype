// Infinite colour picker and translator: saturation/value area, hue and alpha
// sliders, and editable HEX, RGB, HSL and OKLCH fields that stay in sync.

import { h } from "../lib/dom";
import {
    hsvToRgb,
    parseColor,
    rgbToHsv,
    toHex,
    toHsl,
    toOklch,
    toRgb,
    type RGBA,
} from "../lib/color";

export function colorSwatch(
    value: string | undefined,
    label: string,
    onChange: (css: string) => void,
): HTMLButtonElement {
    const fill = h("span", { style: { background: value ?? "transparent" } });
    const btn = h(
        "button",
        {
            type: "button",
            class: "swatch-btn",
            "aria-label": `${label}: ${value ?? "not set"}`,
            "aria-haspopup": "dialog",
        },
        fill,
    );
    btn.addEventListener("click", () =>
        openColorPicker(btn, value ?? "#c6f432", label, (css) => {
            fill.style.background = css;
            btn.setAttribute("aria-label", `${label}: ${css}`);
            onChange(css);
        }),
    );
    return btn;
}

export function openColorPicker(
    anchor: HTMLElement,
    initial: string,
    label: string,
    onChange: (css: string) => void,
) {
    document.querySelector(".color-pop")?.remove();
    let rgba: RGBA = parseColor(initial) ?? { r: 0.78, g: 0.96, b: 0.2, a: 1 };
    let hsv = rgbToHsv(rgba);
    const area = h("div", {
        class: "sv-area",
        role: "slider",
        tabindex: 0,
        "aria-label": `${label}: saturation and brightness`,
        "aria-valuetext": "",
    });
    const thumb = h("span", { class: "sv-thumb" });
    area.append(thumb);
    const hue = h("input", {
        type: "range",
        class: "hue-range",
        min: 0,
        max: 360,
        step: 1,
        "aria-label": `${label}: hue`,
    });
    const alpha = h("input", {
        type: "range",
        class: "alpha-range",
        min: 0,
        max: 100,
        step: 1,
        "aria-label": `${label}: opacity`,
    });
    const fields = {
        hex: h("input", { class: "text-input" }),
        rgb: h("input", { class: "text-input" }),
        hsl: h("input", { class: "text-input" }),
        oklch: h("input", { class: "text-input" }),
    };
    const status = h("p", {
        class: "small faint",
        role: "status",
        style: "margin:0",
    });

    const emit = (from?: keyof typeof fields) => {
        const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
        rgba = { r, g, b, a: rgba.a };
        const base = toRgb({ ...rgba, a: 1 });
        area.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`;
        thumb.style.left = `${hsv.s * 100}%`;
        thumb.style.top = `${(1 - hsv.v) * 100}%`;
        thumb.style.background = base;
        area.setAttribute(
            "aria-valuetext",
            `saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`,
        );
        hue.value = String(Math.round(hsv.h));
        alpha.value = String(Math.round(rgba.a * 100));
        alpha.style.background = `linear-gradient(90deg, transparent, ${base}), repeating-conic-gradient(#888 0 25%, #bbb 0 50%) 0 0 / 10px 10px`;
        const values = {
            hex: toHex(rgba),
            rgb: toRgb(rgba),
            hsl: toHsl(rgba),
            oklch: toOklch(rgba),
        };
        for (const k of Object.keys(fields) as (keyof typeof fields)[])
            if (k !== from) fields[k].value = values[k];
        onChange(values.hex);
    };
    const fromPointer = (e: PointerEvent) => {
        const r = area.getBoundingClientRect();
        hsv = {
            ...hsv,
            s: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
            v: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
        };
        emit();
    };
    area.addEventListener("pointerdown", (e) => {
        area.setPointerCapture(e.pointerId);
        fromPointer(e);
        const move = (ev: PointerEvent) => fromPointer(ev);
        area.addEventListener("pointermove", move);
        area.addEventListener(
            "pointerup",
            () => area.removeEventListener("pointermove", move),
            { once: true },
        );
    });
    area.addEventListener("keydown", (e) => {
        const d = e.shiftKey ? 0.1 : 0.02;
        if (e.key === "ArrowLeft") hsv.s = Math.max(0, hsv.s - d);
        else if (e.key === "ArrowRight") hsv.s = Math.min(1, hsv.s + d);
        else if (e.key === "ArrowUp") hsv.v = Math.min(1, hsv.v + d);
        else if (e.key === "ArrowDown") hsv.v = Math.max(0, hsv.v - d);
        else return;
        e.preventDefault();
        emit();
    });
    hue.addEventListener("input", () => {
        hsv = { ...hsv, h: Number(hue.value) };
        emit();
    });
    alpha.addEventListener("input", () => {
        rgba = { ...rgba, a: Number(alpha.value) / 100 };
        emit();
    });
    for (const [k, input] of Object.entries(fields) as [
        keyof typeof fields,
        HTMLInputElement,
    ][]) {
        input.setAttribute("aria-label", `${label} as ${k.toUpperCase()}`);
        input.addEventListener("input", () => {
            const parsed = parseColor(input.value);
            input.setAttribute("aria-invalid", String(!parsed));
            status.textContent = parsed
                ? ""
                : `Not a valid ${k.toUpperCase()} colour yet. The previous colour stays.`;
            if (!parsed) return;
            rgba = parsed;
            hsv = rgbToHsv(parsed);
            emit(k);
        });
    }
    const pop = h(
        "div",
        {
            class: "color-pop surface-pop",
            role: "dialog",
            "aria-label": `${label} colour picker`,
        },
        area,
        hue,
        alpha,
        h(
            "div",
            { class: "color-formats" },
            ...Object.entries(fields).flatMap(([k, input]) => [
                h("span", null, k.toUpperCase()),
                input,
            ]),
        ),
        status,
    );
    const close = () => {
        pop.remove();
        document.removeEventListener("pointerdown", outside, true);
        anchor.focus();
    };
    const outside = (e: Event) => {
        if (
            !pop.contains(e.target as Node) &&
            e.target !== anchor &&
            !anchor.contains(e.target as Node)
        )
            close();
    };
    pop.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            close();
        }
    });
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pr.width - 8))}px`;
    pop.style.top = `${r.bottom + 6 + pr.height < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - pr.height - 6)}px`;
    emit();
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
    area.focus();
}
