// Personal wording state: validated private cache, apply, replace, clear.

import {
    parseVocabulary,
    type Vocabulary,
    type VocabularyProblem,
} from "./vocabulary";
import { setActiveVocabulary } from "./i18n";
import { removeKey } from "./store";

const CACHE_KEY = "studio.private-wording.v1";
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
    } catch {
        /* the wording still applies for this session */
    }
    emit();
    return res;
}

export function clearWording() {
    active = null;
    removeKey(CACHE_KEY);
    emit();
}
