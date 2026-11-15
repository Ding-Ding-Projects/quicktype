// Versioned local settings. Everything lives on this device; nothing syncs.

export type LanguageMode = "en" | "yue" | "both";
export type Dock = "left" | "right" | "top" | "bottom";
export type Theme = "light" | "dark" | "system" | "contrast";

export interface TabGroup {
    id: string;
    name: string;
    color: string;
    collapsed: boolean;
    tabs: string[];
}

export interface Schedule {
    id: string;
    from: string;
    to: string;
    key: "theme" | "language" | "density";
    value: string;
    enabled: boolean;
}

export interface Settings {
    v: 1;
    language: LanguageMode;
    funEn: number;
    funYue: number;
    emojiInDialogs: boolean;
    theme: Theme;
    accent: string;
    density: "comfortable" | "compact";
    textScale: number;
    reducedMotion: "system" | "on" | "off";
    sounds: boolean;
    narrator: {
        on: boolean;
        lang: "en" | "yue" | "both";
        voiceEn: string;
        voiceYue: string;
        rate: number;
        pitch: number;
    };
    dock: Dock;
    openTabs: string[];
    knownTabs: string[];
    pinnedTabs: string[];
    activeTab: string;
    favoriteLanguages: string[];
    logo: { preset: string; custom: string | null };
    displayName: string;
    onboarding: { done: boolean; step: number; skipped: string[] };
    adhd: { focus: boolean; chunked: boolean; timers: boolean };
    dimSum: boolean;
    elementStyles: Record<string, Record<string, string>>;
    updates: { auto: boolean };
    tabGroups: TabGroup[];
    stripCollapsed: boolean;
    schedules: Schedule[];
    focusMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
    v: 1,
    language: "en",
    funEn: 5,
    funYue: 5,
    emojiInDialogs: true,
    theme: "dark",
    accent: "#c6f432",
    density: "comfortable",
    textScale: 1,
    reducedMotion: "system",
    sounds: true,
    narrator: {
        on: false,
        lang: "en",
        voiceEn: "",
        voiceYue: "",
        rate: 1,
        pitch: 1,
    },
    dock: "left",
    openTabs: [],
    knownTabs: [],
    pinnedTabs: [],
    activeTab: "generate",
    favoriteLanguages: [
        "typescript",
        "swift",
        "kotlin",
        "rust",
        "go",
        "python",
    ],
    logo: { preset: "brace", custom: null },
    displayName: "quicktype Studio",
    onboarding: { done: false, step: 0, skipped: [] },
    adhd: { focus: false, chunked: false, timers: false },
    dimSum: true,
    elementStyles: {},
    updates: { auto: true },
    tabGroups: [],
    stripCollapsed: false,
    schedules: [],
    focusMinutes: 25,
};

const KEY = "studio.settings.v1";

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readJSON<T>(key: string): T | null {
    try {
        const raw = storage()?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function writeJSON(key: string, value: unknown) {
    try {
        storage()?.setItem(key, JSON.stringify(value));
    } catch {
        /* storage may be full or blocked; settings stay in memory */
    }
}

export function removeKey(key: string) {
    try {
        storage()?.removeItem(key);
    } catch {
        /* ignore */
    }
}

type Listener = (s: Settings, changed: (keyof Settings)[]) => void;

class SettingsStore {
    private value: Settings;
    private listeners = new Set<Listener>();

    constructor() {
        const saved = readJSON<Partial<Settings>>(KEY);
        this.value = {
            ...DEFAULT_SETTINGS,
            ...(saved && saved.v === 1 ? saved : {}),
        } as Settings;
        this.value.narrator = {
            ...DEFAULT_SETTINGS.narrator,
            ...this.value.narrator,
        };
        // The first release shipped a violet default accent; untouched defaults move to the new one.
        if (this.value.accent.toLowerCase() === "#4b2fe0")
            this.value.accent = DEFAULT_SETTINGS.accent;
    }

    get(): Settings {
        return this.value;
    }

    set(patch: Partial<Settings>, record = true) {
        const before = this.value;
        this.value = { ...this.value, ...patch };
        writeJSON(KEY, this.value);
        const changed = Object.keys(patch) as (keyof Settings)[];
        if (record) recordSettingsChange(before, this.value, changed);
        for (const l of this.listeners) l(this.value, changed);
    }

    reset(keys?: (keyof Settings)[]) {
        if (!keys)
            this.set({
                ...DEFAULT_SETTINGS,
                onboarding: this.value.onboarding,
            });
        else
            this.set(
                Object.fromEntries(
                    keys.map((k) => [k, DEFAULT_SETTINGS[k]]),
                ) as Partial<Settings>,
            );
    }

    subscribe(l: Listener) {
        this.listeners.add(l);
        return () => this.listeners.delete(l);
    }
}

let recordSettingsChange: (
    before: Settings,
    after: Settings,
    keys: (keyof Settings)[],
) => void = () => {};
export function onSettingsRecorded(fn: typeof recordSettingsChange) {
    recordSettingsChange = fn;
}

export const settings = new SettingsStore();
