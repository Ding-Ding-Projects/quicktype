// GUI JSON editor: tree, code, split and table views over one document, with
// labelled undo and redo, regex find, JSONPath queries, drag and drop,
// schema validation and a hand-off to Generate.

import Ajv from "ajv";
import { h, icon, downloadText } from "../lib/dom";
import { t } from "../lib/i18n";
import { highlight, lineNumbers } from "../lib/highlight";
import { generate as runEngine } from "../lib/engineClient";
import { readJSON, writeJSON } from "../lib/store";
import {
    History,
    convert,
    duplicate,
    get,
    insertChild,
    kindOf,
    move,
    parseDocument,
    parseScalar,
    pathToPointer,
    pathToString,
    query,
    relocate,
    remove,
    removeNulls,
    renameKey,
    setValue,
    sortKeys,
    stats,
    type JSONValue,
    type Kind,
    type Path,
} from "../lib/jsonModel";
import { host } from "../lib/platform";
import { notify } from "../ui/toast";
import { regexField } from "../ui/regexField";
import { openTab } from "../ui/tabs";
import { setSource } from "./generate";
import { register, type PaletteEntry } from "./registry";
import { SAMPLES } from "./samplesData";

type View = "tree" | "code" | "split" | "table";
const KEY = "studio.json-editor.v1";
const MAX_ROWS = 4000;
const KIND_COLORS: Record<Kind, string> = {
    object: "var(--syn-num)",
    array: "var(--syn-key)",
    string: "var(--syn-str)",
    number: "var(--syn-num)",
    boolean: "var(--syn-type)",
    null: "var(--muted)",
};

const saved = readJSON<{ doc: JSONValue; view: View }>(KEY);
const history = new History(
    saved?.doc ?? (JSON.parse(SAMPLES[0].text) as JSONValue),
);
let view: View = saved?.view ?? "split";
let selected: Path = [];
let collapsed = new Set<string>();
let editing: { path: string; part: "key" | "value" } | null = null;
let findMatch: ((s: string) => boolean) | null = null;
let queryText = "";
let queryHits: Path[] = [];
let queryError = "";
let schema: {
    source: string;
    validate: ((d: unknown) => boolean) & {
        errors?: { instancePath: string; message?: string }[] | null;
    };
} | null = null;
let codeDraft: string | null = null;
let codeError = "";
let rerender: () => void = () => {};

const doc = () => history.current;
const key = (p: Path) => JSON.stringify(p);
const persist = () => writeJSON(KEY, { doc: doc(), view });

function commit(label: string, next: JSONValue, select?: Path) {
    history.push(label, next);
    if (select) selected = select;
    codeDraft = null;
    codeError = "";
    persist();
    rerender();
}

function attempt(
    label: string,
    fn: () => { doc: JSONValue; path?: Path } | JSONValue,
) {
    try {
        const r = fn();
        if (
            r &&
            typeof r === "object" &&
            "doc" in (r as object) &&
            !Array.isArray(r)
        ) {
            const x = r as { doc: JSONValue; path?: Path };
            commit(label, x.doc, x.path);
        } else commit(label, r as JSONValue);
    } catch (e) {
        notify("error", "msg.generateFailed", {
            detail: e instanceof Error ? e.message : String(e),
        });
    }
}

const isContainer = (v: JSONValue | undefined) =>
    v !== null && typeof v === "object";

function preview(v: JSONValue) {
    const k = kindOf(v);
    if (k === "array")
        return `[ ${(v as JSONValue[]).length} item${(v as JSONValue[]).length === 1 ? "" : "s"} ]`;
    if (k === "object") {
        const n = Object.keys(v as object).length;
        return `{ ${n} key${n === 1 ? "" : "s"} }`;
    }
    return k === "string" ? JSON.stringify(v) : String(v);
}

interface Row {
    path: Path;
    depth: number;
    label: string;
    value: JSONValue;
    keyEditable: boolean;
}

function visibleRows(): Row[] {
    const rows: Row[] = [];
    const walk = (
        v: JSONValue,
        path: Path,
        label: string,
        keyEditable: boolean,
    ) => {
        if (rows.length > MAX_ROWS) return;
        const text = `${label} ${isContainer(v) ? "" : String(v)}`;
        const selfMatch = !findMatch || findMatch(text);
        const start = rows.length;
        rows.push({ path, depth: path.length, label, value: v, keyEditable });
        let childMatched = false;
        if (isContainer(v) && (!collapsed.has(key(path)) || findMatch)) {
            const entries: [string | number, JSONValue][] = Array.isArray(v)
                ? v.map((x, i) => [i, x])
                : Object.entries(v as object);
            for (const [k, x] of entries) {
                const before = rows.length;
                walk(x, [...path, k], String(k), typeof k === "string");
                if (rows.length > before) childMatched = true;
            }
        }
        if (findMatch && !selfMatch && !childMatched) rows.length = start;
    };
    walk(doc(), [], "root", false);
    return rows;
}

function validationErrors(): { path: string; message: string }[] {
    if (!schema) return [];
    const ok = schema.validate(doc());
    if (ok) return [];
    return (schema.validate.errors ?? []).map((e) => ({
        path: e.instancePath || "/",
        message: e.message ?? "invalid",
    }));
}

async function lockSchema() {
    const res = await runEngine({
        kind: "json",
        sources: [{ text: JSON.stringify(doc()) }],
        language: "schema",
        topLevelName: "Document",
    });
    if (!res.ok) {
        notify("error", "msg.generateFailed", {
            detail: res.problems.map((p) => p.detail ?? p.code).join("; "),
        });
        return;
    }
    useSchema(res.code, "inferred from this document");
}

function useSchema(text: string, source: string) {
    try {
        const parsed = JSON.parse(text);
        delete parsed.$schema;
        const ajv = new Ajv({
            allErrors: true,
            strict: false,
            validateFormats: false,
        });
        schema = { source, validate: ajv.compile(parsed) as never };
        notify("success", "msg.converted", {
            from: source,
            to: "a validation schema",
        });
    } catch (e) {
        notify("error", "msg.convertFailed", {
            detail: e instanceof Error ? e.message : String(e),
        });
    }
    rerender();
}

function startEdit(path: Path, part: "key" | "value") {
    editing = { path: key(path), part };
    selected = path;
    rerender();
}

function inlineEditor(row: Row, part: "key" | "value") {
    const v = row.value;
    const input = h("input", {
        class: "text-input mono je-inline",
        value:
            part === "key"
                ? row.label
                : kindOf(v) === "string"
                  ? (v as string)
                  : JSON.stringify(v),
        "aria-label":
            part === "key"
                ? `Rename ${row.label}`
                : `Value of ${pathToString(row.path)}`,
    });
    const finish = (save: boolean) => {
        if (!editing) return;
        editing = null;
        if (!save) return rerender();
        if (part === "key") {
            if (input.value !== row.label)
                attempt("Rename key", () => ({
                    doc: renameKey(doc(), row.path, input.value),
                    path: [...row.path.slice(0, -1), input.value],
                }));
            else rerender();
        } else {
            const kind = kindOf(v);
            attempt("Edit value", () =>
                setValue(doc(), row.path, parseScalar(input.value, kind)),
            );
        }
    };
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
        e.stopPropagation();
    });
    input.addEventListener("blur", () => finish(true));
    queueMicrotask(() => {
        input.focus();
        input.select();
    });
    return input;
}

function moveSelection(rows: Row[], delta: number) {
    const i = rows.findIndex((r) => key(r.path) === key(selected));
    const next = rows[Math.min(rows.length - 1, Math.max(0, i + delta))];
    if (next) {
        selected = next.path;
        rerender();
        requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(".je-row.sel")?.focus(),
        );
    }
}

function treeView(): HTMLElement {
    const rows = visibleRows();
    const hitKeys = new Set(queryHits.map(key));
    const errs = new Set(validationErrors().map((e) => e.path));
    let dragFrom: Path | null = null;
    const list = h("div", {
        class: "je-tree",
        role: "tree",
        "aria-label": "JSON document",
        "aria-multiselectable": "false",
    });
    for (const row of rows) {
        const k = key(row.path);
        const sel = k === key(selected);
        const v = row.value;
        const kind = kindOf(v);
        const container = isContainer(v);
        const isCollapsed = collapsed.has(k);
        const pointer = pathToPointer(row.path) || "/";
        const el = h(
            "div",
            {
                class: `je-row ${sel ? "sel" : ""} ${hitKeys.has(k) ? "hit" : ""} ${errs.has(pointer) ? "err" : ""}`,
                role: "treeitem",
                "aria-level": row.depth + 1,
                "aria-selected": String(sel),
                "aria-expanded": container ? String(!isCollapsed) : undefined,
                tabindex: sel ? 0 : -1,
                draggable: row.path.length > 0 ? "true" : undefined,
                onclick: () => {
                    selected = row.path;
                    rerender();
                },
                ondblclick: (e: MouseEvent) => {
                    if (!container)
                        startEdit(
                            row.path,
                            (e.target as HTMLElement).closest(".je-key") &&
                                row.keyEditable
                                ? "key"
                                : "value",
                        );
                },
                ondragstart: (e: DragEvent) => {
                    dragFrom = row.path;
                    e.dataTransfer?.setData("text/x-json-path", k);
                },
                ondragover: (e: DragEvent) => {
                    if (e.dataTransfer?.types.includes("text/x-json-path")) {
                        e.preventDefault();
                        el.classList.add("drop");
                    }
                },
                ondragleave: () => el.classList.remove("drop"),
                ondrop: (e: DragEvent) => {
                    el.classList.remove("drop");
                    const raw = e.dataTransfer?.getData("text/x-json-path");
                    if (!raw) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const from = (dragFrom ?? JSON.parse(raw)) as Path;
                    // Dropping on a container moves the node inside it; on anything else, just before it.
                    if (container && !isCollapsed)
                        attempt("Move node", () =>
                            relocate(doc(), from, row.path, 0),
                        );
                    else {
                        const parent = row.path.slice(0, -1);
                        const pv = get(doc(), parent);
                        const at = Array.isArray(pv)
                            ? (row.path[row.path.length - 1] as number)
                            : Object.keys(pv as object).indexOf(
                                  row.path[row.path.length - 1] as string,
                              );
                        attempt("Move node", () =>
                            relocate(doc(), from, parent, at),
                        );
                    }
                },
                onkeydown: (e: KeyboardEvent) => {
                    const mod = e.ctrlKey || e.metaKey;
                    if (e.key === "ArrowDown" && e.altKey)
                        attempt("Move down", () => move(doc(), row.path, 1));
                    else if (e.key === "ArrowUp" && e.altKey)
                        attempt("Move up", () => move(doc(), row.path, -1));
                    else if (e.key === "ArrowDown") moveSelection(rows, 1);
                    else if (e.key === "ArrowUp") moveSelection(rows, -1);
                    else if (e.key === "ArrowRight" && container) {
                        collapsed.delete(k);
                        rerender();
                    } else if (e.key === "ArrowLeft") {
                        if (container && !isCollapsed) collapsed.add(k);
                        else if (row.path.length)
                            selected = row.path.slice(0, -1);
                        rerender();
                    } else if (e.key === "Enter" && !container)
                        startEdit(row.path, "value");
                    else if (e.key === "F2" && row.keyEditable)
                        startEdit(row.path, "key");
                    else if (e.key === "Delete" && row.path.length)
                        attempt("Delete node", () => ({
                            doc: remove(doc(), row.path),
                            path: row.path.slice(0, -1),
                        }));
                    else if (
                        mod &&
                        e.key.toLowerCase() === "d" &&
                        row.path.length
                    )
                        attempt("Duplicate", () => duplicate(doc(), row.path));
                    else if (e.key === "Insert" && container)
                        attempt("Add child", () =>
                            insertChild(doc(), row.path, ""),
                        );
                    else return;
                    e.preventDefault();
                },
            },
            h("span", {
                class: "je-indent",
                style: { width: `${row.depth * 18}px` },
            }),
            container
                ? h(
                      "button",
                      {
                          type: "button",
                          class: "je-caret",
                          tabindex: -1,
                          "aria-label": isCollapsed ? "Expand" : "Collapse",
                          onclick: (e: Event) => {
                              e.stopPropagation();
                              if (isCollapsed) collapsed.delete(k);
                              else collapsed.add(k);
                              rerender();
                          },
                      },
                      icon(isCollapsed ? "play" : "chevron", 12),
                  )
                : h("span", { class: "je-caret" }),
            editing?.path === k && editing.part === "key"
                ? inlineEditor(row, "key")
                : h(
                      "span",
                      { class: `je-key ${row.keyEditable ? "" : "index"}` },
                      row.label,
                  ),
            h("span", { class: "je-colon" }, row.path.length ? ":" : ""),
            editing?.path === k && editing.part === "value"
                ? inlineEditor(row, "value")
                : kind === "boolean"
                  ? h(
                        "button",
                        {
                            type: "button",
                            class: "je-bool",
                            tabindex: -1,
                            "aria-label": `Toggle ${pathToString(row.path)}`,
                            onclick: (e: Event) => {
                                e.stopPropagation();
                                attempt("Toggle value", () =>
                                    setValue(doc(), row.path, !(v as boolean)),
                                );
                            },
                        },
                        String(v),
                    )
                  : h("span", { class: `je-val k-${kind}` }, preview(v)),
            h("span", { class: "grow" }),
            h(
                "span",
                { class: "je-kind", style: { color: KIND_COLORS[kind] } },
                kind,
            ),
        );
        list.appendChild(el);
    }
    if (rows.length > MAX_ROWS)
        list.append(
            h(
                "p",
                { class: "muted small pad" },
                `Showing the first ${MAX_ROWS} rows. Collapse branches or use find to narrow the view.`,
            ),
        );
    if (rows.length === 0)
        list.append(
            h("p", { class: "muted pad" }, "Nothing matches the current find."),
        );
    return list;
}

function codeView(): HTMLElement {
    const text = codeDraft ?? JSON.stringify(doc(), null, 2);
    const pre = h("pre", { "aria-hidden": "true" });
    pre.innerHTML = `${highlight(text)}\n`;
    const gutter = h(
        "div",
        { class: "gutter", "aria-hidden": "true" },
        lineNumbers(text),
    );
    const ta = h("textarea", {
        spellcheck: false,
        "aria-label": "JSON text",
        "aria-invalid": String(Boolean(codeError)),
    });
    ta.value = text;
    let timer: number | undefined;
    ta.addEventListener("input", () => {
        codeDraft = ta.value;
        pre.innerHTML = `${highlight(ta.value)}\n`;
        gutter.textContent = lineNumbers(ta.value);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            const r = parseDocument(ta.value, true);
            if (r.ok) {
                codeError = "";
                const pos = ta.selectionStart;
                history.push("Edit text", r.value);
                persist();
                const keep = ta.value;
                codeDraft = keep;
                rerender();
                requestAnimationFrame(() => {
                    const again =
                        document.querySelector<HTMLTextAreaElement>(
                            ".je-code textarea",
                        );
                    if (again) {
                        again.focus();
                        again.setSelectionRange(pos, pos);
                    }
                });
            } else {
                codeError = `Line ${r.line}, column ${r.column}: ${r.message}`;
                const status = document.querySelector(".je-code-status");
                if (status) {
                    status.textContent = codeError;
                    status.className = "je-code-status pane-foot bad";
                }
            }
        }, 450);
    });
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
            ta.dispatchEvent(new Event("input"));
        }
    });
    return h(
        "div",
        { class: "je-code pane" },
        h(
            "div",
            { class: "code-wrap" },
            h(
                "div",
                { class: "code-grid" },
                gutter,
                h("div", { class: "code-edit-wrap" }, pre, ta),
            ),
        ),
        h(
            "div",
            {
                class: `je-code-status pane-foot ${codeError ? "bad" : "good"}`,
                role: "status",
            },
            codeError ||
                "Valid JSON. Comments and trailing commas are accepted and removed.",
        ),
    );
}

function tableView(): HTMLElement {
    let target = get(doc(), selected);
    let base = selected;
    if (!Array.isArray(target)) {
        // Fall back to the nearest array above the selection.
        for (
            let i = selected.length - 1;
            i >= 0 && !Array.isArray(target);
            i--
        ) {
            base = selected.slice(0, i);
            target = get(doc(), base);
        }
    }
    if (!Array.isArray(target))
        return h(
            "div",
            { class: "pad muted" },
            "Select an array (for example a list of objects) to edit it as a table.",
        );
    const items = target as JSONValue[];
    const cols = [
        ...new Set(
            items.flatMap((x) =>
                x && typeof x === "object" && !Array.isArray(x)
                    ? Object.keys(x)
                    : ["value"],
            ),
        ),
    ];
    const table = h(
        "table",
        { class: "je-table" },
        h(
            "caption",
            { class: "small muted" },
            `${pathToString(base)}: ${items.length} rows, ${cols.length} columns`,
        ),
        h(
            "thead",
            null,
            h(
                "tr",
                null,
                h("th", { scope: "col" }, "#"),
                ...cols.map((c) => h("th", { scope: "col" }, c)),
                h(
                    "th",
                    { scope: "col" },
                    h("span", { class: "visually-hidden" }, "Actions"),
                ),
            ),
        ),
        h(
            "tbody",
            null,
            ...items.map((item, i) =>
                h(
                    "tr",
                    null,
                    h("th", { scope: "row", class: "mono faint" }, String(i)),
                    ...cols.map((c) => {
                        const isObj =
                            item &&
                            typeof item === "object" &&
                            !Array.isArray(item);
                        const cellPath = isObj ? [...base, i, c] : [...base, i];
                        const cell = isObj
                            ? (item as Record<string, JSONValue>)[c]
                            : c === "value"
                              ? item
                              : undefined;
                        if (cell === undefined)
                            return h("td", { class: "faint" }, "—");
                        if (isContainer(cell))
                            return h(
                                "td",
                                null,
                                h(
                                    "button",
                                    {
                                        type: "button",
                                        class: "btn small",
                                        onclick: () => {
                                            selected = cellPath;
                                            view = "split";
                                            rerender();
                                        },
                                    },
                                    preview(cell),
                                ),
                            );
                        const input = h("input", {
                            class: `je-cell k-${kindOf(cell)}`,
                            value:
                                kindOf(cell) === "string"
                                    ? (cell as string)
                                    : String(cell),
                            "aria-label": `${c}, row ${i}`,
                        });
                        input.addEventListener("change", () =>
                            attempt("Edit cell", () =>
                                setValue(
                                    doc(),
                                    cellPath,
                                    parseScalar(input.value, kindOf(cell)),
                                ),
                            ),
                        );
                        return h("td", null, input);
                    }),
                    h(
                        "td",
                        null,
                        h(
                            "button",
                            {
                                type: "button",
                                class: "icon-btn",
                                "aria-label": `Delete row ${i}`,
                                onclick: () =>
                                    attempt("Delete row", () =>
                                        remove(doc(), [...base, i]),
                                    ),
                            },
                            icon("trash", 14),
                        ),
                    ),
                ),
            ),
        ),
    );
    return h(
        "div",
        { class: "je-table-wrap" },
        table,
        h(
            "div",
            { class: "row pad" },
            h(
                "button",
                {
                    type: "button",
                    class: "btn small",
                    onclick: () =>
                        attempt("Add row", () =>
                            insertChild(
                                doc(),
                                base,
                                Object.fromEntries(cols.map((c) => [c, ""])),
                            ),
                        ),
                },
                icon("plus", 14),
                "Add row",
            ),
        ),
    );
}

function inspector(): HTMLElement {
    const v = get(doc(), selected);
    const exists = v !== undefined;
    if (!exists) selected = [];
    const value = get(doc(), selected) as JSONValue;
    const kind = kindOf(value);
    const st = stats(doc());
    const errors = validationErrors();
    const isRoot = selected.length === 0;
    let valueEditor: HTMLElement;
    if (kind === "string") {
        const ta = h("textarea", {
            class: "code-edit",
            rows: 3,
            "aria-label": "Value",
        });
        ta.value = value as string;
        ta.addEventListener("change", () =>
            attempt("Edit value", () => setValue(doc(), selected, ta.value)),
        );
        valueEditor = ta;
    } else if (kind === "number") {
        const n = h("input", {
            class: "text-input mono",
            type: "number",
            step: "any",
            value: String(value),
            "aria-label": "Value",
        });
        n.addEventListener("change", () =>
            attempt("Edit value", () =>
                setValue(doc(), selected, parseScalar(n.value, "number")),
            ),
        );
        valueEditor = n;
    } else if (kind === "boolean") {
        valueEditor = h(
            "button",
            {
                class: `switch ${value ? "on" : ""}`,
                role: "switch",
                "aria-checked": String(value),
                "aria-label": "Value",
                onclick: () =>
                    attempt("Toggle value", () =>
                        setValue(doc(), selected, !value),
                    ),
            },
            h("span", { class: "knob" }),
        );
    } else
        valueEditor = h(
            "p",
            { class: "muted small", style: "margin:0" },
            kind === "null" ? "null has no value to edit." : preview(value),
        );
    const act = (
        label: string,
        ico: string,
        fn: () => void,
        disabled = false,
    ) =>
        h(
            "button",
            { type: "button", class: "btn small", disabled, onclick: fn },
            icon(ico, 14),
            label,
        );
    const parentKind = isRoot
        ? null
        : kindOf(get(doc(), selected.slice(0, -1)) as JSONValue);
    const hist = history.labels();
    return h(
        "aside",
        {
            class: "inspector je-inspector",
            "aria-label": "Selected node",
            dataset: { el: "json.inspector" },
        },
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, "Selected"),
            h(
                "div",
                { class: "row" },
                h("code", { class: "je-path grow" }, pathToString(selected)),
                h(
                    "button",
                    {
                        type: "button",
                        class: "icon-btn",
                        "aria-label": "Copy JSONPath",
                        title: "Copy JSONPath",
                        onclick: () =>
                            void navigator.clipboard?.writeText(
                                pathToString(selected),
                            ),
                    },
                    icon("copy", 14),
                ),
                h(
                    "button",
                    {
                        type: "button",
                        class: "icon-btn",
                        "aria-label": "Copy JSON Pointer",
                        title: "Copy JSON Pointer",
                        onclick: () =>
                            void navigator.clipboard?.writeText(
                                pathToPointer(selected),
                            ),
                    },
                    icon("link", 14),
                ),
            ),
            !isRoot && parentKind === "object"
                ? h(
                      "label",
                      { class: "field" },
                      "Key",
                      (() => {
                          const k = h("input", {
                              class: "text-input mono",
                              value: String(selected[selected.length - 1]),
                          });
                          k.addEventListener("change", () =>
                              attempt("Rename key", () => ({
                                  doc: renameKey(doc(), selected, k.value),
                                  path: [...selected.slice(0, -1), k.value],
                              })),
                          );
                          return k;
                      })(),
                  )
                : null,
            h("div", { class: "field" }, "Value", valueEditor),
            h(
                "div",
                { class: "je-types", role: "radiogroup", "aria-label": "Type" },
                ...(
                    [
                        "object",
                        "array",
                        "string",
                        "number",
                        "boolean",
                        "null",
                    ] as Kind[]
                ).map((k) =>
                    h(
                        "button",
                        {
                            type: "button",
                            role: "radio",
                            "aria-checked": String(k === kind),
                            class: k === kind ? "on" : "",
                            style:
                                k === kind
                                    ? { color: KIND_COLORS[k] }
                                    : undefined,
                            onclick: () =>
                                attempt(`Change type to ${k}`, () =>
                                    setValue(
                                        doc(),
                                        selected,
                                        convert(value, k),
                                    ),
                                ),
                        },
                        k,
                    ),
                ),
            ),
            h(
                "div",
                { class: "je-actions" },
                act(
                    "Add child",
                    "plus",
                    () =>
                        attempt("Add child", () =>
                            insertChild(doc(), selected, ""),
                        ),
                    !isContainer(value),
                ),
                act(
                    "Add sibling",
                    "plus",
                    () => {
                        const parent = selected.slice(0, -1);
                        const pv = get(doc(), parent);
                        const at = Array.isArray(pv)
                            ? (selected[selected.length - 1] as number) + 1
                            : Object.keys(pv as object).indexOf(
                                  selected[selected.length - 1] as string,
                              ) + 1;
                        attempt("Add sibling", () =>
                            insertChild(doc(), parent, "", at),
                        );
                    },
                    isRoot,
                ),
                act(
                    "Duplicate",
                    "duplicate",
                    () =>
                        attempt("Duplicate", () => duplicate(doc(), selected)),
                    isRoot,
                ),
                act(
                    "Move up",
                    "up",
                    () => attempt("Move up", () => move(doc(), selected, -1)),
                    isRoot,
                ),
                act(
                    "Move down",
                    "down",
                    () => attempt("Move down", () => move(doc(), selected, 1)),
                    isRoot,
                ),
                act(
                    "Sort keys here",
                    "sort",
                    () =>
                        attempt("Sort keys", () =>
                            setValue(doc(), selected, sortKeys(value)),
                        ),
                    kind !== "object",
                ),
                h(
                    "button",
                    {
                        type: "button",
                        class: "btn small danger",
                        disabled: isRoot,
                        onclick: () =>
                            attempt("Delete node", () => ({
                                doc: remove(doc(), selected),
                                path: selected.slice(0, -1),
                            })),
                    },
                    icon("trash", 14),
                    "Delete",
                ),
            ),
            h(
                "button",
                {
                    type: "button",
                    class: "btn primary",
                    disabled: !isContainer(value),
                    onclick: () =>
                        sendToGenerate(
                            value,
                            isRoot
                                ? "Document"
                                : String(selected[selected.length - 1]),
                        ),
                },
                icon("generate", 16),
                isRoot
                    ? "Generate types from this document"
                    : "Generate types from this node",
            ),
        ),
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, "Validation"),
            schema
                ? h(
                      "p",
                      {
                          class: `small ${errors.length ? "bad" : "good"}`,
                          role: "status",
                          style: "margin:0",
                      },
                      errors.length
                          ? `${errors.length} problem${errors.length === 1 ? "" : "s"} against the schema ${schema.source}`
                          : `Matches the schema ${schema.source}`,
                  )
                : h(
                      "p",
                      { class: "small muted", style: "margin:0" },
                      "Lock the current shape as a schema, or load a JSON Schema file, and every edit is checked against it.",
                  ),
            ...errors.slice(0, 8).map((e) =>
                h(
                    "button",
                    {
                        type: "button",
                        class: "type-row",
                        onclick: () => {
                            const p = e.path
                                .split("/")
                                .slice(1)
                                .map((s) => {
                                    const u = s
                                        .replace(/~1/g, "/")
                                        .replace(/~0/g, "~");
                                    return /^\d+$/.test(u) &&
                                        Array.isArray(get(doc(), selected))
                                        ? Number(u)
                                        : /^\d+$/.test(u)
                                          ? Number(u)
                                          : u;
                                });
                            if (get(doc(), p) !== undefined) selected = p;
                            rerender();
                        },
                    },
                    h("span", { class: "type-kind enum" }, "error"),
                    h("span", { class: "type-name" }, `${e.path} ${e.message}`),
                ),
            ),
            h(
                "div",
                { class: "row wrap" },
                h(
                    "button",
                    {
                        type: "button",
                        class: "btn small",
                        onclick: () => void lockSchema(),
                    },
                    icon("check2", 14),
                    "Lock current shape",
                ),
                h(
                    "label",
                    { class: "btn small", tabindex: 0 },
                    icon("upload", 14),
                    "Load schema",
                    h("input", {
                        type: "file",
                        accept: ".json,.schema,application/json",
                        class: "visually-hidden",
                        onchange: async (e: Event) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (f) useSchema(await f.text(), `from ${f.name}`);
                        },
                    }),
                ),
                schema
                    ? h(
                          "button",
                          {
                              type: "button",
                              class: "btn small",
                              onclick: () => {
                                  schema = null;
                                  rerender();
                              },
                          },
                          "Clear",
                      )
                    : null,
            ),
        ),
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, "Document"),
            h(
                "dl",
                { class: "vocab-facts" },
                h("dt", null, "Nodes"),
                h("dd", null, String(st.nodes)),
                h("dt", null, "Depth"),
                h("dd", null, String(st.depth)),
                h("dt", null, "Size"),
                h("dd", null, `${st.bytes.toLocaleString()} bytes`),
                h("dt", null, "Mix"),
                h(
                    "dd",
                    null,
                    (Object.entries(st.kinds) as [Kind, number][])
                        .filter(([, n]) => n)
                        .map(([k, n]) => `${n} ${k}`)
                        .join(", "),
                ),
            ),
            h(
                "div",
                { class: "je-actions" },
                act("Open file", "folder", openFile),
                act("Save as", "save", () => void saveFile()),
                act("Remove nulls", "filter", () =>
                    attempt("Remove nulls", () => removeNulls(doc())),
                ),
                act("Sort all keys", "sort", () =>
                    attempt("Sort all keys", () => sortKeys(doc())),
                ),
                act("New empty", "plus", () =>
                    attempt("New document", () => ({ doc: {}, path: [] })),
                ),
            ),
        ),
        h(
            "section",
            null,
            h("h2", { class: "section-title" }, "History"),
            hist.past.length === 0 && hist.future.length === 0
                ? h(
                      "p",
                      { class: "small muted", style: "margin:0" },
                      "Edits appear here. Click one to go back to just before it.",
                  )
                : null,
            ...hist.past
                .map((label, i) =>
                    h(
                        "button",
                        {
                            type: "button",
                            class: "type-row",
                            onclick: () => {
                                history.undoTo(hist.past.length - i);
                                persist();
                                rerender();
                            },
                        },
                        h("span", { class: "type-kind" }, String(i + 1)),
                        h("span", { class: "type-name" }, label),
                    ),
                )
                .reverse()
                .slice(0, 12),
            ...hist.future.map((label) =>
                h(
                    "div",
                    { class: "type-row faint" },
                    h("span", { class: "type-kind" }, "redo"),
                    h("span", { class: "type-name" }, label),
                ),
            ),
        ),
    );
}

function openFile() {
    const input = h("input", {
        type: "file",
        accept: ".json,.jsonc,.json5,application/json",
    });
    input.addEventListener("change", async () => {
        const f = input.files?.[0];
        if (f) await loadText(await f.text(), f.name);
    });
    input.click();
}

async function loadText(text: string, name: string) {
    const r = parseDocument(text, true);
    if (!r.ok) {
        notify("error", "msg.convertFailed", {
            detail: `${name}, line ${r.line}, column ${r.column}: ${r.message}`,
        });
        return;
    }
    collapsed = new Set();
    commit(`Open ${name}`, r.value, []);
}

async function saveFile() {
    const text = `${JSON.stringify(doc(), null, 2)}\n`;
    if (host) {
        const res = await host.saveFile("document.json", text);
        if (res.ok)
            notify("success", "msg.saved", {
                file: res.path ?? "document.json",
            });
    } else {
        downloadText("document.json", text, "application/json");
        notify("success", "msg.saved", { file: "document.json" });
    }
}

function sendToGenerate(value: JSONValue, name: string) {
    const top =
        name
            .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) =>
                c ? c.toUpperCase() : "",
            )
            .replace(/^./, (c) => c.toUpperCase()) || "Document";
    setSource("json", JSON.stringify(value, null, 2), top);
    openTab("generate");
}

function render(ctx: { rerender(): void }): HTMLElement {
    rerender = ctx.rerender;
    const st = stats(doc());
    const views: [View, string, string][] = [
        ["tree", "Tree", "tree"],
        ["code", "Code", "code"],
        ["split", "Split", "split"],
        ["table", "Table", "table"],
    ];
    const find = regexField(
        "history.filter",
        (m) => {
            findMatch = m.ok && m.source !== "" ? m.test : null;
            const body = document.querySelector(".je-body-tree");
            if (body) body.replaceChildren(treeView());
        },
        { id: "json-find" },
    );
    find.input.placeholder = "Find keys and values";
    find.input.setAttribute("aria-label", "Find keys and values");
    const q = h("input", {
        class: "search-input mono",
        value: queryText,
        placeholder: "$..name",
        "aria-label": "JSONPath query",
        spellcheck: false,
    });
    q.addEventListener("change", () => {
        queryText = q.value.trim();
        queryError = "";
        queryHits = [];
        if (queryText) {
            try {
                queryHits = query(doc(), queryText);
                if (queryHits[0]) {
                    selected = queryHits[0];
                    for (const p of queryHits)
                        for (let i = 0; i < p.length; i++)
                            collapsed.delete(key(p.slice(0, i)));
                }
            } catch (e) {
                queryError = e instanceof Error ? e.message : String(e);
            }
        }
        rerender();
    });
    const tool = (
        label: string,
        ico: string,
        fn: () => void,
        disabled = false,
        keys?: string,
    ) =>
        h(
            "button",
            {
                type: "button",
                class: "icon-btn",
                "aria-label": label,
                title: keys ? `${label} (${keys})` : label,
                disabled,
                "aria-keyshortcuts": keys,
                onclick: fn,
            },
            icon(ico, 16),
        );
    const toolbar = h(
        "div",
        { class: "pane-head je-toolbar" },
        h(
            "div",
            { class: "seg", role: "tablist", "aria-label": "View" },
            ...views.map(([id, label, ico]) =>
                h(
                    "button",
                    {
                        type: "button",
                        role: "tab",
                        "aria-selected": String(view === id),
                        class: view === id ? "on" : "",
                        onclick: () => {
                            view = id;
                            persist();
                            rerender();
                        },
                    },
                    h("span", { class: "row" }, icon(ico, 14), label),
                ),
            ),
        ),
        tool(
            "Undo",
            "undo",
            () => {
                const l = history.undo();
                if (l) persist();
                rerender();
            },
            !history.canUndo,
            "Control+Z",
        ),
        tool(
            "Redo",
            "redo",
            () => {
                const l = history.redo();
                if (l) persist();
                rerender();
            },
            !history.canRedo,
            "Control+Y",
        ),
        tool("Expand all", "expand", () => {
            collapsed = new Set();
            rerender();
        }),
        tool("Collapse all", "collapse", () => {
            const all = new Set<string>();
            const walk = (v: JSONValue, p: Path) => {
                if (isContainer(v)) {
                    if (p.length) all.add(key(p));
                    for (const [k, x] of Array.isArray(v)
                        ? v.map((y, i) => [i, y] as const)
                        : Object.entries(v as object))
                        walk(x as JSONValue, [...p, k]);
                }
            };
            walk(doc(), []);
            collapsed = all;
            rerender();
        }),
        h("span", { class: "grow" }),
        h(
            "div",
            {
                class: "rx-row je-query",
                title: "JSONPath: $.a.b, [0], [*], ..key, [1:3]",
            },
            h("span", { class: "mono small" }, "$"),
            q,
            queryText
                ? h(
                      "span",
                      { class: `chiplet ${queryError ? "" : "accent"}` },
                      queryError
                          ? "error"
                          : `${queryHits.length} hit${queryHits.length === 1 ? "" : "s"}`,
                  )
                : null,
        ),
        find.el,
    );
    const body =
        view === "tree"
            ? h("div", { class: "je-body je-body-tree" }, treeView())
            : view === "code"
              ? codeView()
              : view === "table"
                ? h("div", { class: "je-body" }, tableView())
                : h(
                      "div",
                      { class: "je-split" },
                      h("div", { class: "je-body je-body-tree" }, treeView()),
                      codeView(),
                  );
    const statusbar = h(
        "div",
        { class: "pane-foot" },
        h(
            "span",
            { class: codeError ? "bad" : "good" },
            codeError
                ? "● Text has an error; the tree shows the last valid version"
                : "● Valid JSON",
        ),
        h("span", null, `${st.nodes} nodes`),
        h("span", null, `${st.bytes.toLocaleString()} bytes`),
        h("span", null, `depth ${st.depth}`),
        queryError ? h("span", { class: "bad" }, `Query: ${queryError}`) : null,
        h("span", { class: "grow" }),
        h("code", { class: "mono" }, pathToString(selected)),
    );
    const editorCard = h(
        "section",
        {
            class: "card glass je-main",
            "aria-label": "JSON editor",
            dataset: { el: "json.editor" },
            ondragover: (e: DragEvent) => {
                if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
            },
            ondrop: async (e: DragEvent) => {
                const f = e.dataTransfer?.files[0];
                if (!f) return;
                // A file dropped on the editor opens as a document instead of being read as a wording file.
                e.preventDefault();
                e.stopPropagation();
                await loadText(await f.text(), f.name);
            },
        },
        toolbar,
        body,
        statusbar,
    );
    const page = h(
        "div",
        { class: "page generate" },
        h("div", { class: "workspace" }, editorCard, inspector()),
    );
    page.addEventListener("keydown", (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod || (e.target as HTMLElement).matches("input, textarea"))
            return;
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
            history.undo();
            persist();
            rerender();
            e.preventDefault();
        } else if (
            e.key.toLowerCase() === "y" ||
            (e.key.toLowerCase() === "z" && e.shiftKey)
        ) {
            history.redo();
            persist();
            rerender();
            e.preventDefault();
        }
    });
    return page;
}

register({
    id: "json",
    labelKey: "tab.json",
    icon: "json",
    render,
    paletteEntries: (): PaletteEntry[] => [
        {
            group: "commands",
            title: `${t("tab.json")}: open file`,
            run: () => {
                openTab("json");
                openFile();
            },
        },
        {
            group: "commands",
            title: `${t("tab.json")}: generate types from the document`,
            run: () => sendToGenerate(doc(), "Document"),
        },
        {
            group: "commands",
            title: `${t("tab.json")}: sort all keys`,
            run: () => attempt("Sort all keys", () => sortKeys(doc())),
        },
        {
            group: "commands",
            title: `${t("tab.json")}: remove nulls`,
            run: () => attempt("Remove nulls", () => removeNulls(doc())),
        },
    ],
});

/** Lets other pages open text in the JSON editor. */
export function openInJsonEditor(text: string, name: string) {
    void loadText(text, name);
    openTab("json");
}
