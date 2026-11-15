import { describe, expect, it } from "vitest";
import { compile, displayText, emptyQuery, fromTyped } from "../src/lib/regex";

describe("search queries", () => {
    it("defaults to plain text", () => {
        const q = { ...emptyQuery(), text: "a.b" };
        const m = compile(q);
        expect(m.ok && m.test("xA.Bx")).toBe(true);
        expect(m.ok && m.test("axb")).toBe(false);
    });
    it("keeps typed anchors and the anchor switches in sync", () => {
        const q = fromTyped(
            { ...emptyQuery(), mode: "regex" },
            "^dark.*theme$",
        );
        expect(q.anchorStart && q.anchorEnd).toBe(true);
        expect(displayText({ ...q, anchorEnd: false })).toBe("^dark.*theme");
        const m = compile(q);
        expect(m.ok && m.test("Dark mode theme")).toBe(true);
        expect(m.ok && m.test("a dark theme")).toBe(false);
    });
    it("reports an invalid pattern instead of throwing", () => {
        const m = compile({ ...emptyQuery(), mode: "regex", text: "(" });
        expect(m.ok).toBe(false);
    });
});
