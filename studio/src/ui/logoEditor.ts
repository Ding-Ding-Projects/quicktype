// Logo editor: load an image, then crop by dragging, zoom, choose fit, fill or
// contain, pick a background colour and check every display size before applying.
// Everything happens on this device; the original image is never uploaded.

import { h, icon } from "../lib/dom";
import { settings } from "../lib/store";
import { colorSwatch } from "./colorPicker";
import { notify } from "./toast";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const SIZES = [16, 32, 64, 128];

function sniff(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
    const hex = [...bytes.slice(0, 12)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    if (hex.startsWith("89504e470d0a1a0a")) return "png";
    if (hex.startsWith("ffd8ff")) return "jpeg";
    if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250")
        return "webp";
    return null;
}

export function openLogoEditor() {
    let bitmap: ImageBitmap | null = null;
    let zoom = 1;
    let offset = { x: 0, y: 0 };
    let fit: "fill" | "contain" | "cover" = "cover";
    let background = "transparent";
    let report = "";
    const stage = h("canvas", {
        width: 440,
        height: 440,
        "aria-label": "Logo crop preview",
        role: "img",
    });
    const previews = SIZES.map((s) =>
        h("canvas", {
            width: s,
            height: s,
            style: {
                width: `${Math.max(s, 24)}px`,
                height: `${Math.max(s, 24)}px`,
                imageRendering: "pixelated",
                borderRadius: "6px",
            },
        }),
    );
    const status = h(
        "p",
        { class: "small muted", role: "status", style: "margin:0" },
        "Choose a PNG, JPEG or WebP image up to 4 MiB.",
    );
    const applyBtn = h(
        "button",
        { class: "btn primary", disabled: true },
        "Use this logo",
    );

    const draw = (ctx: CanvasRenderingContext2D, size: number) => {
        ctx.clearRect(0, 0, size, size);
        if (background !== "transparent") {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, size, size);
        }
        if (!bitmap) return;
        const { width: w, height: hgt } = bitmap;
        const base =
            fit === "contain"
                ? Math.min(size / w, size / hgt)
                : fit === "cover"
                  ? Math.max(size / w, size / hgt)
                  : 0;
        const sx = fit === "fill" ? (size / w) * zoom : base * zoom;
        const sy = fit === "fill" ? (size / hgt) * zoom : base * zoom;
        const dw = w * sx;
        const dh = hgt * sy;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
            bitmap,
            (size - dw) / 2 + offset.x * (size / 440),
            (size - dh) / 2 + offset.y * (size / 440),
            dw,
            dh,
        );
    };
    const paint = () => {
        const c = stage.getContext("2d");
        if (c) draw(c, 440);
        previews.forEach((p, i) => {
            const c2 = p.getContext("2d");
            if (c2) draw(c2, SIZES[i]);
        });
    };

    const file = h("input", {
        type: "file",
        accept: "image/png,image/jpeg,image/webp",
        class: "visually-hidden",
        id: "logo-editor-file",
    });
    file.addEventListener("change", async () => {
        const f = file.files?.[0];
        if (!f) return;
        if (f.size > MAX_BYTES) {
            status.textContent =
                "That file is larger than 4 MiB. The current logo stays.";
            return;
        }
        const kind = sniff(new Uint8Array(await f.slice(0, 12).arrayBuffer()));
        if (!kind) {
            status.textContent =
                "The file's bytes are not a PNG, JPEG or WebP image, whatever its name says. The current logo stays.";
            return;
        }
        const bmp = await createImageBitmap(f).catch(() => null);
        if (!bmp || bmp.width * bmp.height > MAX_PIXELS) {
            status.textContent =
                "The image could not be decoded safely (too large or damaged). The current logo stays.";
            return;
        }
        bitmap = bmp;
        zoom = 1;
        offset = { x: 0, y: 0 };
        report = `${kind.toUpperCase()} ${bmp.width}×${bmp.height}`;
        status.textContent = `${report}. Drag to move, use the slider to zoom.`;
        applyBtn.disabled = false;
        paint();
    });

    stage.addEventListener("pointerdown", (e) => {
        if (!bitmap) return;
        stage.setPointerCapture(e.pointerId);
        const start = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
        };
        const scale = 440 / stage.getBoundingClientRect().width;
        const mv = (ev: PointerEvent) => {
            offset = {
                x: start.ox + (ev.clientX - start.x) * scale,
                y: start.oy + (ev.clientY - start.y) * scale,
            };
            paint();
        };
        stage.addEventListener("pointermove", mv);
        stage.addEventListener(
            "pointerup",
            () => stage.removeEventListener("pointermove", mv),
            { once: true },
        );
    });
    stage.tabIndex = 0;
    stage.addEventListener("keydown", (e) => {
        const d = e.shiftKey ? 20 : 4;
        if (e.key === "ArrowLeft") offset.x -= d;
        else if (e.key === "ArrowRight") offset.x += d;
        else if (e.key === "ArrowUp") offset.y -= d;
        else if (e.key === "ArrowDown") offset.y += d;
        else return;
        e.preventDefault();
        paint();
    });

    const zoomInput = h("input", {
        type: "range",
        min: 0.2,
        max: 4,
        step: 0.01,
        value: 1,
        "aria-label": "Zoom",
        style: "width:100%",
    });
    zoomInput.addEventListener("input", () => {
        zoom = Number(zoomInput.value);
        paint();
    });
    const fitSeg = h(
        "div",
        { class: "seg", role: "radiogroup", "aria-label": "Fit" },
        ...(["cover", "contain", "fill"] as const).map((f) => {
            const b = h(
                "button",
                {
                    type: "button",
                    role: "radio",
                    "aria-checked": String(fit === f),
                    class: fit === f ? "on" : "",
                },
                f === "cover"
                    ? "Fill square"
                    : f === "contain"
                      ? "Fit inside"
                      : "Stretch",
            );
            b.addEventListener("click", () => {
                fit = f;
                for (const x of fitSeg.querySelectorAll("button")) {
                    x.classList.toggle("on", x === b);
                    x.setAttribute("aria-checked", String(x === b));
                }
                paint();
            });
            return b;
        }),
    );

    applyBtn.addEventListener("click", () => {
        const out = document.createElement("canvas");
        out.width = out.height = 256;
        const c = out.getContext("2d");
        if (!c || !bitmap) return;
        draw(c, 256);
        const url = out.toDataURL("image/png");
        settings.set({ logo: { ...settings.get().logo, custom: url } });
        const lost =
            background === "transparent"
                ? "transparency kept"
                : "transparent areas filled with the background colour";
        notify("success", "msg.converted", {
            from: report,
            to: `a 256×256 PNG logo, ${lost}`,
        });
        close();
    });

    const dlg = h(
        "dialog",
        {
            class: "dialog",
            "aria-labelledby": "logo-editor-title",
            style: "max-width: 720px; width: calc(100vw - 32px)",
        },
        h("h2", { id: "logo-editor-title" }, "Make a logo from an image"),
        h(
            "div",
            { class: "logo-editor" },
            h(
                "div",
                { class: "stack" },
                h(
                    "div",
                    { class: "logo-stage" },
                    stage,
                    h("span", { class: "logo-safe", "aria-hidden": "true" }),
                ),
                h(
                    "span",
                    { class: "small faint" },
                    "Dashed line: safe area for small sizes",
                ),
            ),
            h(
                "div",
                { class: "stack" },
                h(
                    "label",
                    { class: "btn", for: "logo-editor-file", tabindex: 0 },
                    icon("upload", 14),
                    "Choose image",
                    file,
                ),
                status,
                h("div", { class: "field" }, "Zoom", zoomInput),
                h("div", { class: "field" }, "Fit", fitSeg),
                h(
                    "div",
                    { class: "field" },
                    "Background",
                    h(
                        "div",
                        { class: "row" },
                        colorSwatch(undefined, "Logo background", (v) => {
                            background = v;
                            paint();
                        }),
                        h(
                            "button",
                            {
                                class: "btn small",
                                onclick: () => {
                                    background = "transparent";
                                    paint();
                                },
                            },
                            "Transparent",
                        ),
                    ),
                ),
                h(
                    "div",
                    { class: "field" },
                    "Every size the app uses",
                    h(
                        "div",
                        { class: "logo-sizes" },
                        ...previews.map((p, i) =>
                            h(
                                "figure",
                                null,
                                p,
                                h("figcaption", null, `${SIZES[i]} px`),
                            ),
                        ),
                    ),
                ),
            ),
        ),
        h(
            "div",
            { class: "row end", style: "margin-top:14px" },
            h("button", { class: "btn", onclick: () => close() }, "Cancel"),
            applyBtn,
        ),
    );
    const close = () => {
        dlg.close();
        dlg.remove();
    };
    dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        close();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    paint();
}
