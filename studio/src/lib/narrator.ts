// Spoken narration for app events. Off by default. One utterance at a time,
// debounced per category, with a superseded line replacing the queued one.

import { settings } from "./store";

export interface VoiceChoice {
    id: string;
    label: string;
    local: boolean;
}

const cooldownMs = 4000;
const lastSpoken = new Map<string, number>();
let queued: { text: string; lang: string; voiceId: string } | null = null;
let speaking = false;
const voiceListeners = new Set<() => void>();

function synth(): SpeechSynthesis | null {
    return typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis
        : null;
}

export function available() {
    return synth() !== null;
}

/** Voices for a language, resolved at runtime. The list may arrive late. */
export function voicesFor(lang: "en" | "yue"): VoiceChoice[] {
    const s = synth();
    if (!s) return [];
    const match = (v: SpeechSynthesisVoice) =>
        lang === "en" ? /^en/i.test(v.lang) : /^(yue|zh-HK)/i.test(v.lang);
    return s
        .getVoices()
        .filter(match)
        .map((v) => ({
            id: v.voiceURI,
            label: `${v.name} (${v.lang})${v.localService ? "" : " · online"}`,
            local: v.localService,
        }));
}

export function onVoicesChanged(cb: () => void) {
    voiceListeners.add(cb);
    return () => voiceListeners.delete(cb);
}

if (typeof window !== "undefined" && synth()) {
    synth()?.addEventListener?.("voiceschanged", () => {
        for (const l of voiceListeners) l();
    });
}

export type VoiceStatus = {
    kind: "auto" | "chosen" | "missing" | "none" | "online";
    label?: string;
};

export function voiceStatus(lang: "en" | "yue"): VoiceStatus {
    const n = settings.get().narrator;
    const list = voicesFor(lang);
    if (list.length === 0) return { kind: "none" };
    const chosen = lang === "en" ? n.voiceEn : n.voiceYue;
    if (!chosen) return { kind: "auto", label: list[0].label };
    const v = list.find((x) => x.id === chosen);
    if (!v) return { kind: "missing", label: list[0].label };
    return { kind: v.local ? "chosen" : "online", label: v.label };
}

function pick(lang: "en" | "yue") {
    const s = synth();
    if (!s) return null;
    const n = settings.get().narrator;
    const chosen = lang === "en" ? n.voiceEn : n.voiceYue;
    const all = s.getVoices();
    return (
        all.find((v) => v.voiceURI === chosen) ??
        all.find((v) =>
            lang === "en" ? /^en/i.test(v.lang) : /^(yue|zh-HK)/i.test(v.lang),
        ) ??
        null
    );
}

function pump() {
    const s = synth();
    if (!s || speaking || !queued) return;
    const item = queued;
    queued = null;
    const u = new SpeechSynthesisUtterance(item.text);
    const lang = item.lang === "yue" ? "yue" : "en";
    const voice = pick(lang);
    if (voice) u.voice = voice;
    u.lang = lang === "yue" ? "zh-HK" : "en-US";
    u.rate = settings.get().narrator.rate;
    u.pitch = settings.get().narrator.pitch;
    speaking = true;
    u.onend = u.onerror = () => {
        speaking = false;
        pump();
    };
    s.speak(u);
}

/** Speak an event. Errors bypass the cooldown so failures are always heard. */
export function narrate(
    category: string,
    en: string,
    yue: string,
    force = false,
) {
    const n = settings.get().narrator;
    if (!n.on || !synth()) return;
    const now = Date.now();
    if (!force && now - (lastSpoken.get(category) ?? 0) < cooldownMs) return;
    lastSpoken.set(category, now);
    if (n.lang === "en" || n.lang === "both") {
        queued = { text: en, lang: "en", voiceId: n.voiceEn };
        pump();
    }
    if (n.lang === "yue" || n.lang === "both") {
        // Strictly serialized: English first, then Cantonese.
        const wait = () => {
            if (speaking || queued) setTimeout(wait, 120);
            else {
                queued = { text: yue, lang: "yue", voiceId: n.voiceYue };
                pump();
            }
        };
        wait();
    }
}
