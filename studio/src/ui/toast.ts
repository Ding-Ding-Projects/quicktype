// Non-blocking notifications plus a notification centre.

import { h, icon } from "../lib/dom";
import { msg, t, type Tone } from "../lib/i18n";
import type { StringKey } from "../lib/strings";
import { settings } from "../lib/store";
import { play } from "../lib/sound";
import { narrate } from "../lib/narrator";
import { tIn } from "../lib/i18n";

export interface Note {
    id: string;
    tone: Tone;
    text: string;
    at: Date;
    read: boolean;
}

const notes: Note[] = [];
const listeners = new Set<() => void>();
const EMOJI: Record<Tone, string> = {
    success: "🎉",
    error: "🙈",
    info: "💡",
    warning: "⚠️",
};

export function onNotes(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}
export function allNotes() {
    return notes;
}
export function unread() {
    return notes.filter((n) => !n.read).length;
}
export function clearNotes() {
    notes.length = 0;
    for (const l of listeners) l();
}
export function markRead() {
    for (const n of notes) n.read = true;
    for (const l of listeners) l();
}

function region() {
    let r = document.getElementById("toasts");
    if (!r) {
        r = h("div", {
            id: "toasts",
            class: "toasts",
            role: "region",
            "aria-label": t("notify.center"),
        });
        document.body.appendChild(r);
    }
    return r;
}

export function notify(
    tone: Tone,
    key: StringKey,
    params?: Record<string, string | number>,
) {
    const text = msg(tone, key, params);
    const note: Note = {
        id: crypto.randomUUID(),
        tone,
        text,
        at: new Date(),
        read: false,
    };
    notes.unshift(note);
    if (notes.length > 100) notes.pop();
    for (const l of listeners) l();
    play(tone === "error" ? "error" : tone === "success" ? "success" : "tap");
    narrate(
        tone,
        tIn("en", key, params),
        tIn("yue", key, params),
        tone === "error",
    );
    const decoration = settings.get().emojiInDialogs
        ? h(
              "span",
              { class: "toast-emoji", "aria-hidden": "true" },
              EMOJI[tone],
          )
        : null;
    const el = h(
        "div",
        {
            class: `toast toast-${tone}`,
            role: tone === "error" ? "alert" : "status",
        },
        decoration,
        h(
            "span",
            { class: "toast-text", style: "white-space: pre-line" },
            text,
        ),
        h(
            "button",
            {
                class: "icon-btn",
                "aria-label": t("notify.dismiss"),
                onclick: () => el.remove(),
            },
            icon("close", 16),
        ),
    );
    region().appendChild(el);
    setTimeout(() => el.remove(), tone === "error" ? 9000 : 5000);
}
