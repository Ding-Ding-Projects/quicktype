import { describe, expect, it } from "vitest";
import {
    History,
    convert,
    duplicate,
    get,
    insertChild,
    move,
    parseDocument,
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
} from "../src/lib/jsonModel";

const doc: JSONValue = {
    a: { b: [1, 2, 3], "odd key": null },
    list: [
        { name: "x", id: 1 },
        { name: "y", id: 2 },
    ],
};

describe("JSON document model", () => {
    it("edits without mutating the original", () => {
        const next = setValue(doc, ["a", "b", 1], 20);
        expect(get(next, ["a", "b", 1])).toBe(20);
        expect(get(doc, ["a", "b", 1])).toBe(2);
    });
    it("renames keys in place and refuses duplicates", () => {
        const next = renameKey(doc, ["a", "odd key"], "even");
        expect(Object.keys(get(next, ["a"]) as object)).toEqual(["b", "even"]);
        expect(() => renameKey(doc, ["a", "odd key"], "b")).toThrow(
            /already exists/,
        );
    });
    it("inserts, duplicates, moves and removes", () => {
        const ins = insertChild(doc, ["a", "b"], 9, 0);
        expect(get(ins.doc, ["a", "b"])).toEqual([9, 1, 2, 3]);
        const dup = duplicate(doc, ["list", 0]);
        expect((get(dup.doc, ["list"]) as unknown[]).length).toBe(3);
        const mv = move(doc, ["list", 0], 1);
        expect(get(mv.doc, ["list", 0, "name"])).toBe("y");
        expect(get(remove(doc, ["a"]), ["a"])).toBeUndefined();
    });
    it("relocates nodes and refuses moving a node into itself", () => {
        const r = relocate(doc, ["a", "b"], ["list", 0]);
        expect(get(r.doc, ["list", 0, "b"])).toEqual([1, 2, 3]);
        expect(() => relocate(doc, ["a"], ["a", "b"])).toThrow(/inside itself/);
    });
    it("converts between kinds", () => {
        expect(convert("12", "number")).toBe(12);
        expect(convert([1, 2], "object")).toEqual({ 0: 1, 1: 2 });
        expect(convert({ x: 1 }, "string")).toBe('{"x":1}');
    });
    it("runs the JSONPath subset", () => {
        expect(query(doc, "$.list[*].name").map((p) => get(doc, p))).toEqual([
            "x",
            "y",
        ]);
        expect(query(doc, "$..id").length).toBe(2);
        expect(query(doc, "$.a.b[-1]").map((p) => get(doc, p))).toEqual([3]);
        expect(query(doc, "$.a.b[0:2]").length).toBe(2);
        expect(query(doc, '$.a["odd key"]').length).toBe(1);
        expect(() => query(doc, "a.b")).toThrow();
    });
    it("formats paths", () => {
        expect(pathToString(["a", "odd key", 2])).toBe('$.a["odd key"][2]');
        expect(pathToPointer(["a/b", "c~d"])).toBe("/a~1b/c~0d");
    });
    it("keeps labelled undo and redo", () => {
        const hist = new History(doc);
        hist.push("one", setValue(doc, ["a", "b", 0], 100));
        hist.push("two", setValue(hist.current, ["a", "b", 0], 200));
        expect(hist.undo()).toBe("two");
        expect(get(hist.current, ["a", "b", 0])).toBe(100);
        expect(hist.redo()).toBe("two");
        hist.undoTo(2);
        expect(get(hist.current, ["a", "b", 0])).toBe(1);
    });
    it("parses leniently and reports where strict parsing fails", () => {
        const ok = parseDocument('{ "a": 1, // note\n "b": [1,2,], }', true);
        expect(ok.ok && ok.value).toEqual({ a: 1, b: [1, 2] });
        const bad = parseDocument('{\n  "a": 1,\n  "b": }');
        expect(bad.ok).toBe(false);
        if (!bad.ok) expect(bad.line).toBe(3);
    });
    it("computes stats and transforms", () => {
        expect(stats(doc).nodes).toBe(14);
        expect(Object.keys(sortKeys({ b: 1, a: 2 }) as object)).toEqual([
            "a",
            "b",
        ]);
        expect(removeNulls({ a: null, b: [null, 1] })).toEqual({ b: [1] });
    });
});
