import { describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript module
import {
    describeLanguages,
    generate,
    validateRequest,
} from "../shared/engine.mjs";

describe("engine", () => {
    it("describes every target language", () => {
        const langs = describeLanguages();
        expect(langs.length).toBeGreaterThan(20);
        expect(
            langs.some((l: { name: string }) => l.name === "typescript"),
        ).toBe(true);
    });
    it("generates TypeScript from JSON", async () => {
        const r = await generate({
            kind: "json",
            sources: [{ text: '{"a":1}' }],
            language: "typescript",
            topLevelName: "Thing",
        });
        expect(r.ok).toBe(true);
        expect(r.code).toContain("interface Thing");
    });
    it("rejects unknown languages and empty names before doing any work", () => {
        const problems = validateRequest({
            kind: "json",
            sources: [{ text: "{}" }],
            language: "nope",
            topLevelName: "",
        });
        expect(problems.map((p: { code: string }) => p.code).sort()).toEqual([
            "language.unknown",
            "name.empty",
        ]);
    });
    it("explains that TypeScript input needs a Node host when none is given", async () => {
        const r = await generate({
            kind: "typescript",
            sources: [{ text: "interface A {}" }],
            language: "go",
            topLevelName: "A",
        });
        expect(r.ok === false && r.problems[0].code).toBe(
            "typescript.needsHost",
        );
    });
});
