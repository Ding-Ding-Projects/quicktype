import type { StringKey } from "../lib/strings";

export interface PageContext {
    rerender(): void;
    go(id: string): void;
}

export interface Page {
    id: string;
    labelKey: StringKey;
    icon: string;
    render(ctx: PageContext): HTMLElement;
    /** Settings-style search entries this page contributes to the palette. */
    paletteEntries?(): PaletteEntry[];
}

export interface PaletteEntry {
    group: "commands" | "settings" | "places" | "elements";
    title: string;
    detail?: string;
    keywords?: string;
    shortcut?: string;
    run?: () => void;
    control?: () => HTMLElement;
}

export const pages: Page[] = [];

const ORDER = [
    "generate",
    "json",
    "samples",
    "languages",
    "history",
    "tools",
    "extensions",
    "docs",
    "settings",
    "changelog",
    "about",
];

export function register(p: Page) {
    pages.push(p);
    pages.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

export function pageById(id: string) {
    return pages.find((p) => p.id === id);
}
