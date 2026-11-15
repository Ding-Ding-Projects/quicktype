// Personal wording state: validated private cache, apply, replace, clear.

import {
    parseVocabulary,
    type Vocabulary,
    type VocabularyProblem,
} from "./vocabulary";
import { setActiveVocabulary } from "./i18n";
import { removeKey } from "./store";

const CACHE_KEY = "studio.private-wording.v1";
const AT_KEY = "studio.private-wording.loaded-at";
let active: Vocabulary | null = null;
const listeners = new Set<() => void>();

export function activeVocabulary() {
    return active;
}

export function onWording(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

function emit() {
    setActiveVocabulary(active);
    for (const l of listeners) l();
}

/** Revalidate the private cache before every load; fail closed to original wording. */
export function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return;
        const res = parseVocabulary(new TextEncoder().encode(raw));
        if (res.ok) active = res.vocabulary;
        else removeKey(CACHE_KEY);
    } catch {
        active = null;
    }
    emit();
}

export async function applyFile(
    file: File,
): Promise<
    | { ok: true; vocabulary: Vocabulary }
    | { ok: false; problem: VocabularyProblem | { code: "notJson" } }
> {
    const looksJson =
        /\.json$/i.test(file.name) || file.type === "application/json";
    if (!looksJson) return { ok: false, problem: { code: "notJson" } };
    if (file.size > 256 * 1024)
        return { ok: false, problem: { code: "tooLarge", limit: 256 * 1024 } };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const res = parseVocabulary(bytes);
    if (!res.ok) return res;
    active = res.vocabulary;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.vocabulary));
        localStorage.setItem(AT_KEY, new Date().toISOString());
    } catch {
        /* the wording still applies for this session */
    }
    emit();
    return res;
}

export function clearWording() {
    active = null;
    removeKey(CACHE_KEY);
    removeKey(AT_KEY);
    emit();
}

/** Facts about the active file that reveal nothing of its contents or name. */
export function wordingFacts() {
    if (!active) return null;
    const keys = Object.keys(active.entries);
    const values = Object.values(active.entries);
    let loadedAt: string | null = null;
    try {
        loadedAt = localStorage.getItem(AT_KEY);
    } catch {
        loadedAt = null;
    }
    return {
        entries: keys.length,
        bytes: new TextEncoder().encode(JSON.stringify(active)).length,
        longestKey: Math.max(0, ...keys.map((k) => [...k].length)),
        longestValue: Math.max(0, ...values.map((v) => [...v].length)),
        loadedAt,
    };
}
