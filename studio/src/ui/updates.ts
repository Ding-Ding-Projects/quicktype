// Update status and the non-blocking ready-to-restart banner.

import { h } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { host, type UpdateState } from "../lib/platform";
import { settings } from "../lib/store";
import { notify } from "./toast";

let state: UpdateState = { state: host ? "idle" : "unsupported" };
let dismissedFor = "";

export function updateState() {
    return state;
}

function render() {
    document.querySelector(".update-banner")?.remove();
    if (
        state.state !== "ready" ||
        !state.version ||
        dismissedFor === state.version
    )
        return;
    const banner = h(
        "div",
        { class: "update-banner", role: "status", "aria-live": "polite" },
        h(
            "span",
            { class: "grow" },
            t("update.ready", { version: state.version }),
        ),
        state.notesUrl
            ? h(
                  "a",
                  { href: state.notesUrl, target: "_blank", rel: "noreferrer" },
                  t("update.notes"),
              )
            : null,
        h(
            "button",
            {
                class: "btn",
                onclick: () => {
                    dismissedFor = state.version ?? "";
                    render();
                },
            },
            label("update.later"),
        ),
        h(
            "button",
            { class: "btn primary", onclick: () => host?.updates.restart() },
            label("update.restart"),
        ),
    );
    document.getElementById("app")?.prepend(banner);
}

export async function checkForUpdates(manual = false) {
    if (!host) {
        if (manual) notify("info", "update.webManaged");
        return;
    }
    state = await host.updates.check();
    render();
    if (!manual) return;
    if (state.state === "none") notify("success", "update.none");
    else if (state.state === "error")
        notify("error", "update.failed", { detail: state.detail ?? "" });
}

export function initUpdates() {
    if (!host) return;
    host.updates.onState((s) => {
        state = s;
        render();
    });
    if (settings.get().updates.auto) {
        void checkForUpdates();
        setInterval(
            () => settings.get().updates.auto && void checkForUpdates(),
            6 * 60 * 60 * 1000,
        );
    }
}
