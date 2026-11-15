// Full-window, non-blocking level-up headline after a wording file applies.

import { h, prefersReducedMotion } from "../lib/dom";
import { settings } from "../lib/store";

export function celebrate(headline: string) {
    const reduced = prefersReducedMotion(settings.get().reducedMotion);
    const live = document.getElementById("live-polite");
    if (live) live.textContent = headline;
    const el = h(
        "div",
        {
            class: `celebrate ${reduced ? "reduced" : ""}`,
            "aria-hidden": "true",
        },
        h("div", { class: "celebrate-headline" }, headline),
    );
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), 3000);
    setTimeout(() => el.remove(), 3600);
}
