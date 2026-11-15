// A tiny element builder. Strings become text nodes, never HTML.

type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, unknown> & {
    class?: string;
    style?: Partial<CSSStyleDeclaration> | string;
};

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Attrs | null = null,
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null || v === false) continue;
            if (k === "class") el.className = String(v);
            else if (k === "style" && typeof v === "object")
                Object.assign(el.style, v);
            else if (k.startsWith("on") && typeof v === "function")
                el.addEventListener(
                    k.slice(2).toLowerCase(),
                    v as EventListener,
                );
            else if (k === "dataset" && typeof v === "object")
                Object.assign(el.dataset, v);
            else if (k in el && typeof v !== "string")
                (el as unknown as Record<string, unknown>)[k] = v;
            else el.setAttribute(k, v === true ? "" : String(v));
        }
    }
    append(el, children);
    return el;
}

function append(el: Node, children: Child[]) {
    for (const c of children) {
        if (c === null || c === undefined || c === false) continue;
        if (Array.isArray(c)) append(el, c);
        else if (c instanceof Node) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
    }
}

const SVG = "http://www.w3.org/2000/svg";

/** Stroke icons keyed by name; paths are original line drawings. */
export const ICONS: Record<string, string> = {
    generate: "M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3",
    samples: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z",
    languages:
        "M4 5h10M9 3v2M6 5c0 5 4 9 8 9M13 5c-1 4-4 7-8 9M14 21l4-10 4 10M15.5 18h5",
    history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2",
    tools: "M14 6l4 4-9 9H5v-4zM12 8l4 4",
    extensions: "M10 4h4v3a2 2 0 1 0 4 0V4h2v6h-3a2 2 0 1 0 0 4h3v6H4V4h6z",
    docs: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6",
    changelog: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h3",
    settings:
        "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
    about: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
    bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
    close: "M6 6l12 12M18 6L6 18",
    plus: "M12 5v14M5 12h14",
    pin: "M9 4h6l-1 6 3 3H7l3-3zM12 13v7",
    check: "M5 12l4 4 10-10",
    folder: "M4 6h6l2 2h8v10H4z",
    link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
    info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
    copy: "M8 8h11v12H8zM5 16V4h11",
    save: "M5 4h11l3 3v13H5zM8 4v5h8V4M8 20v-6h8v6",
    upload: "M12 15V4M7 9l5-5 5 5M5 20h14",
    download: "M12 4v11M7 10l5 5 5-5M5 20h14",
    trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
    minimize: "M5 12h14",
    maximize: "M5 5h14v14H5z",
    restore: "M8 8h11v11H8zM5 16V5h11",
    regex: "M5 18a1 1 0 1 0 0 .1M14 5v8M10.5 7l7 4M10.5 11l7-4",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2",
    play: "M7 5l12 7-12 7z",
};

export function icon(name: string, size = 20): SVGSVGElement {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", ICONS[name] ?? ICONS.info);
    svg.appendChild(p);
    return svg;
}

export function logoMark(
    preset: string,
    custom: string | null,
    size = 30,
): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "logo";
    wrap.style.width = wrap.style.height = `${size}px`;
    if (custom) {
        const img = document.createElement("img");
        img.src = custom;
        img.alt = "";
        img.width = img.height = size;
        wrap.appendChild(img);
        return wrap;
    }
    const colors: Record<string, [string, string, string]> = {
        brace: ["var(--primary)", "#FFFFFF", "#FFB38A"],
        sunset: ["#C2410C", "#FFFFFF", "#FFE1CF"],
        mint: ["#0F766E", "#FFFFFF", "#B9F3E4"],
        ink: ["#1C1B1F", "#FFFFFF", "#C9BFFF"],
    };
    const [bg, a, b] = colors[preset] ?? colors.brace;
    wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" fill="${bg}"/><path d="M11 9c-3 0-3 2-3 4s-1 3-2 3c1 0 2 1 2 3s0 4 3 4" fill="none" stroke="${a}" stroke-width="2.4" stroke-linecap="round"/><path d="M16 11h10M21 11v12" fill="none" stroke="${b}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    return wrap;
}

export function clear(el: Element) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

export function prefersReducedMotion(setting: "system" | "on" | "off") {
    if (setting === "on") return true;
    if (setting === "off") return false;
    return (
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
}

export function downloadText(
    filename: string,
    text: string,
    type = "text/plain",
) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
