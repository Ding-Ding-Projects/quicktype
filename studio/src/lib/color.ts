// Colour conversions for the colour picker: HEX, RGB, HSL, HSV and OKLCH.

export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function parseColor(input: string): RGBA | null {
    const s = input.trim().toLowerCase();
    let m = /^#([0-9a-f]{3,8})$/.exec(s);
    if (m) {
        let hex = m[1];
        if (hex.length === 3 || hex.length === 4)
            hex = [...hex].map((c) => c + c).join("");
        if (hex.length !== 6 && hex.length !== 8) return null;
        const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) : 1 };
    }
    m =
        /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(
            s,
        );
    if (m)
        return {
            r: clamp(+m[1] / 255),
            g: clamp(+m[2] / 255),
            b: clamp(+m[3] / 255),
            a: alpha(m[4]),
        };
    m =
        /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(
            s,
        );
    if (m)
        return { ...hslToRgb(+m[1], +m[2] / 100, +m[3] / 100), a: alpha(m[4]) };
    m =
        /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
            s,
        );
    if (m)
        return {
            ...oklchToRgb(m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]),
            a: alpha(m[5]),
        };
    return null;
}

function alpha(v?: string) {
    if (!v) return 1;
    return clamp(
        v.endsWith("%") ? Number.parseFloat(v) / 100 : Number.parseFloat(v),
    );
}

const hex2 = (v: number) =>
    Math.round(clamp(v) * 255)
        .toString(16)
        .padStart(2, "0");
export const toHex = (c: RGBA) =>
    `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(c.a) : ""}`;
export const toRgb = (c: RGBA) =>
    `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)}${c.a < 1 ? ` / ${+c.a.toFixed(2)}` : ""})`;

export function toHsl(c: RGBA) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h =
            max === c.r
                ? (c.g - c.b) / d + (c.g < c.b ? 6 : 0)
                : max === c.g
                  ? (c.b - c.r) / d + 2
                  : (c.r - c.g) / d + 4;
        h *= 60;
    }
    return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%${c.a < 1 ? ` / ${+c.a.toFixed(2)}` : ""})`;
}

export function hslToRgb(h: number, s: number, l: number) {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: f(0), g: f(8), b: f(4) };
}

export function rgbToHsv(c: RGBA) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const d = max - min;
    let h = 0;
    if (d)
        h =
            max === c.r
                ? ((c.g - c.b) / d) % 6
                : max === c.g
                  ? (c.b - c.r) / d + 2
                  : (c.r - c.g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToRgb(h: number, s: number, v: number) {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: f(5), g: f(3), b: f(1) };
}

const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const gam = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

export function toOklch(c: RGBA) {
    const r = lin(c.r);
    const g = lin(c.g);
    const b = lin(c.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.sqrt(A * A + B * B);
    const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)}${c.a < 1 ? ` / ${+c.a.toFixed(2)}` : ""})`;
}

export function oklchToRgb(L: number, C: number, H: number) {
    const a = C * Math.cos((H * Math.PI) / 180);
    const b = C * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return {
        r: clamp(gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
        g: clamp(gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
        b: clamp(gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    };
}

/** WCAG contrast ratio between two opaque colours. */
export function contrast(a: RGBA, b: RGBA) {
    const lum = (c: RGBA) =>
        0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}
