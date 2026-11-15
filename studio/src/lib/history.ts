// Local version history for generations and settings changes.
// Personal wording data is never stored here.

import {
    readJSON,
    writeJSON,
    onSettingsRecorded,
    type Settings,
} from "./store";

export interface HistoryEntry {
    id: string;
    at: string;
    kind: "generate" | "settings";
    summary: string;
    data: Record<string, unknown>;
}

const KEY = "studio.history.v1";
const MAX = 300;

let entries: HistoryEntry[] = readJSON<HistoryEntry[]>(KEY) ?? [];
const listeners = new Set<() => void>();

function persist() {
    writeJSON(KEY, entries.slice(0, MAX));
    for (const l of listeners) l();
}

export function onHistory(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

export function list() {
    return entries;
}

export function add(e: Omit<HistoryEntry, "id" | "at">) {
    entries = [
        { ...e, id: crypto.randomUUID(), at: new Date().toISOString() },
        ...entries,
    ].slice(0, MAX);
    persist();
}

export function remove(ids: Set<string>) {
    const before = entries.length;
    entries = entries.filter((e) => !ids.has(e.id));
    persist();
    return before - entries.length;
}

// Keys that never enter history snapshots.
const PRIVATE_KEYS: (keyof Settings)[] = ["logo"];

onSettingsRecorded((before, after, keys) => {
    const visible = keys.filter(
        (k) =>
            !PRIVATE_KEYS.includes(k) &&
            k !== "openTabs" &&
            k !== "knownTabs" &&
            k !== "activeTab",
    );
    if (visible.length === 0) return;
    const prev = Object.fromEntries(visible.map((k) => [k, before[k]]));
    const next = Object.fromEntries(visible.map((k) => [k, after[k]]));
    add({
        kind: "settings",
        summary: visible.join(", "),
        data: { before: prev, after: next },
    });
});

export type ExportFormat = "json" | "csv" | "md" | "html" | "txt";

export function exportEntries(
    items: HistoryEntry[],
    format: ExportFormat,
): string {
    const note = "Personal wording data and file details are never included.";
    if (format === "json")
        return JSON.stringify({ note, entries: items }, null, 2);
    if (format === "csv") {
        const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [
            "at,kind,summary",
            ...items.map((e) => [e.at, e.kind, e.summary].map(q).join(",")),
        ].join("\n");
    }
    if (format === "md")
        return [
            `> ${note}`,
            "",
            "| When | Kind | Summary |",
            "| --- | --- | --- |",
            ...items.map(
                (e) =>
                    `| ${e.at} | ${e.kind} | ${e.summary.replace(/\|/g, "\\|")} |`,
            ),
        ].join("\n");
    if (format === "html") {
        const esc = (s: string) =>
            s.replace(
                /[&<>"]/g,
                (c) =>
                    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
                        c
                    ] as string,
            );
        return `<!doctype html><meta charset="utf-8"><title>History</title><p>${note}</p><table><tr><th>When</th><th>Kind</th><th>Summary</th></tr>${items.map((e) => `<tr><td>${esc(e.at)}</td><td>${e.kind}</td><td>${esc(e.summary)}</td></tr>`).join("")}</table>`;
    }
    return [
        note,
        "",
        ...items.map((e) => `${e.at}  ${e.kind}  ${e.summary}`),
    ].join("\n");
}
