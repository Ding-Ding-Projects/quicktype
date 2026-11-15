// Two-key super confirmation for destructive actions: type the word, then
// press and hold. Either key alone does nothing.

import { h } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings } from "../lib/store";

export function superConfirm(
    action: string,
    word = "DELETE",
): Promise<boolean> {
    return new Promise((resolve) => {
        const prev = document.activeElement as HTMLElement | null;
        const input = h("input", {
            class: "text-input",
            "aria-label": t("confirm.typeIt", { word }),
            autocomplete: "off",
        });
        let timer: number | undefined;
        const holdBtn = h(
            "button",
            { class: "btn danger", disabled: true },
            label("confirm.do"),
        );
        const done = (ok: boolean) => {
            dlg.close();
            dlg.remove();
            prev?.focus();
            resolve(ok);
        };
        input.addEventListener(
            "input",
            () => (holdBtn.disabled = input.value !== word),
        );
        const start = () => {
            if (holdBtn.disabled) return;
            holdBtn.classList.add("holding");
            timer = window.setTimeout(() => done(true), 1200);
        };
        const stop = () => {
            holdBtn.classList.remove("holding");
            window.clearTimeout(timer);
        };
        holdBtn.addEventListener("pointerdown", start);
        holdBtn.addEventListener("pointerup", stop);
        holdBtn.addEventListener("pointerleave", stop);
        holdBtn.addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) start();
        });
        holdBtn.addEventListener("keyup", stop);
        const dlg = h(
            "dialog",
            { class: "dialog", "aria-labelledby": "confirm-title" },
            h(
                "h2",
                { id: "confirm-title" },
                settings.get().emojiInDialogs ? "🧨 " : "",
                t("confirm.title", { action }),
            ),
            h("p", null, t("confirm.typeIt", { word })),
            input,
            h("p", { class: "muted small" }, t("confirm.hold")),
            h(
                "div",
                { class: "row end" },
                h(
                    "button",
                    { class: "btn", onclick: () => done(false) },
                    label("confirm.cancel"),
                ),
                holdBtn,
            ),
        );
        dlg.addEventListener("cancel", (e) => {
            e.preventDefault();
            done(false);
        });
        document.body.appendChild(dlg);
        dlg.showModal();
        input.focus();
    });
}
