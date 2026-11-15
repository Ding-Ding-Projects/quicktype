import { STRINGS, type StringKey } from "./strings";
import { settings } from "./store";
import { makeReplacer, type Vocabulary } from "./vocabulary";

let replacer: (s: string) => string = (s) => s;
let schoolModeOn = false;

export function setActiveVocabulary(v: Vocabulary | null) {
    replacer = makeReplacer(v);
}

export function setSchoolModeForText(on: boolean) {
    schoolModeOn = on;
}

let languageOverride: "en" | "yue" | "both" | null = null;

/** A scheduled language that applies for part of the day. Returns true when it changed. */
export function setLanguageOverride(v: "en" | "yue" | "both" | null) {
    const changed = v !== languageOverride;
    languageOverride = v;
    return changed;
}

export function effectiveLanguage(): "en" | "yue" | "both" {
    return schoolModeOn ? "en" : (languageOverride ?? settings.get().language);
}

function fill(template: string, params?: Record<string, string | number>) {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) =>
        k in params ? String(params[k]) : `{${k}}`,
    );
}

function personal(text: string) {
    return schoolModeOn ? text : replacer(text);
}

/** One language's text for a key. */
export function tIn(
    lang: "en" | "yue",
    key: StringKey,
    params?: Record<string, string | number>,
): string {
    const pair = STRINGS[key];
    const raw = pair ? pair[lang === "en" ? 0 : 1] : key;
    return personal(fill(raw, params));
}

/** Text for the current mode. Bilingual joins both languages with a slash. */
export function t(
    key: StringKey,
    params?: Record<string, string | number>,
): string {
    const mode = effectiveLanguage();
    if (mode === "both") {
        const en = tIn("en", key, params);
        const yue = tIn("yue", key, params);
        return en === yue ? en : `${en} / ${yue}`;
    }
    return tIn(mode, key, params);
}

/** A label element: primary text, with the Cantonese line underneath in bilingual mode. */
export function label(
    key: StringKey,
    params?: Record<string, string | number>,
): HTMLElement {
    const mode = effectiveLanguage();
    const span = document.createElement("span");
    span.className = "lbl";
    if (mode !== "both") {
        span.textContent = tIn(mode, key, params);
        return span;
    }
    const en = tIn("en", key, params);
    const yue = tIn("yue", key, params);
    const a = document.createElement("span");
    a.className = "lbl-primary";
    a.textContent = en;
    span.append(a);
    if (yue !== en) {
        const b = document.createElement("span");
        b.className = "lbl-secondary";
        b.lang = "yue-Hant-HK";
        b.textContent = yue;
        span.append(b);
    }
    return span;
}

export type Tone = "success" | "error" | "info" | "warning";

// Voice wrappers. The fact is always kept whole; only the framing changes.
const TONE: Record<
    "en" | "yue",
    Record<Tone, [string, string, string, string, string]>
> = {
    en: {
        success: [
            "{fact}.",
            "{fact}.",
            "Done: {fact}.",
            "Nice. {fact}.",
            "Ta-da! {fact}. High five.",
        ],
        error: [
            "{fact}.",
            "Problem: {fact}.",
            "Hmm, that didn't work. {fact}.",
            "Oops. {fact}. Let's fix it.",
            "Whoops! {fact}. Even computers trip sometimes.",
        ],
        info: [
            "{fact}.",
            "{fact}.",
            "Heads up: {fact}.",
            "Quick note: {fact}.",
            "Psst! {fact}.",
        ],
        warning: [
            "Warning: {fact}.",
            "Warning: {fact}.",
            "Careful: {fact}.",
            "Hold on: {fact}.",
            "Whoa there! {fact}. Think twice.",
        ],
    },
    yue: {
        success: [
            "{fact}。",
            "{fact}。",
            "搞掂：{fact}。",
            "好嘢！{fact}。",
            "噹噹！{fact}，畀個 like 自己！",
        ],
        error: [
            "{fact}。",
            "出錯：{fact}。",
            "唔得喎。{fact}。",
            "哎呀，{fact}，執返佢先。",
            "弊傢伙！{fact}。電腦都會跣腳㗎。",
        ],
        info: [
            "{fact}。",
            "{fact}。",
            "提提你：{fact}。",
            "講聲你知：{fact}。",
            "喂喂！{fact}。",
        ],
        warning: [
            "警告：{fact}。",
            "警告：{fact}。",
            "小心：{fact}。",
            "等等先：{fact}。",
            "嘩！{fact}，諗清楚先啦！",
        ],
    },
};

function funLevel(lang: "en" | "yue") {
    if (schoolModeOn) return 1;
    const s = settings.get();
    return Math.min(
        5,
        Math.max(1, Math.round(lang === "en" ? s.funEn : s.funYue)),
    );
}

export function toneIn(lang: "en" | "yue", tone: Tone, fact: string) {
    const clean = fact.replace(/[.。]\s*$/, "");
    return personal(
        TONE[lang][tone][funLevel(lang) - 1].replace("{fact}", clean),
    );
}

/** A complete message in the current mode, styled by the playfulness level. */
export function msg(
    tone: Tone,
    key: StringKey,
    params?: Record<string, string | number>,
): string {
    const mode = effectiveLanguage();
    if (mode === "both")
        return `${toneIn("en", tone, tIn("en", key, params))}\n${toneIn("yue", tone, tIn("yue", key, params))}`;
    return toneIn(mode, tone, tIn(mode, key, params));
}

export function htmlLang() {
    const m = effectiveLanguage();
    return m === "yue" ? "yue-Hant-HK" : "en";
}
