import { describe, expect, it } from "vitest";
import {
    makeReplacer,
    parseVocabulary,
    celebrationHeadline,
    VOCABULARY_LIMITS,
} from "../src/lib/vocabulary";

const enc = (s: string) => new TextEncoder().encode(s);
const ok = (entries: Record<string, string>) =>
    enc(JSON.stringify({ schemaVersion: 1, entries }));

describe("personal wording files", () => {
    it("accepts a valid version 1 file", () => {
        const r = parseVocabulary(ok({ "ordinary wording": "replacement" }));
        expect(r.ok).toBe(true);
    });
    it.each([
        [
            "duplicate keys",
            '{"schemaVersion":1,"entries":{"a":"b","a":"c"}}',
            "duplicateKey",
        ],
        ["malformed JSON", '{"schemaVersion":1,"entries":{', "malformed"],
        [
            "unknown root field",
            '{"schemaVersion":1,"entries":{},"extra":1}',
            "rootShape",
        ],
        ["wrong version", '{"schemaVersion":2,"entries":{}}', "version"],
        [
            "unsafe key",
            '{"schemaVersion":1,"entries":{"__proto__":"x"}}',
            "unsafeKey",
        ],
        ["empty key", '{"schemaVersion":1,"entries":{"":"x"}}', "keyLength"],
        [
            "non-string value",
            '{"schemaVersion":1,"entries":{"a":1}}',
            "valueType",
        ],
        [
            "control character",
            '{"schemaVersion":1,"entries":{"a":"b\\u0001"}}',
            "controlCharacter",
        ],
    ])("refuses %s as a whole", (_name, text, code) => {
        const r = parseVocabulary(enc(text));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.problem.code).toBe(code);
    });
    it("enforces the size, depth and length limits", () => {
        expect(
            parseVocabulary(new Uint8Array(VOCABULARY_LIMITS.maxBytes + 1)).ok,
        ).toBe(false);
        const deep = `${"[".repeat(9)}${"]".repeat(9)}`;
        const r = parseVocabulary(
            enc(`{"schemaVersion":1,"entries":{"a":${deep}}}`),
        );
        expect(r.ok === false && r.problem.code).toBe("tooDeep");
        expect(parseVocabulary(ok({ ["k".repeat(161)]: "v" })).ok).toBe(false);
        expect(parseVocabulary(ok({ k: "v".repeat(1001) })).ok).toBe(false);
        expect(
            parseVocabulary(ok({ ["k".repeat(160)]: "v".repeat(1000) })).ok,
        ).toBe(true);
    });
    it("rejects bytes that are not UTF-8", () => {
        const r = parseVocabulary(new Uint8Array([0x7b, 0xff, 0x7d]));
        expect(r.ok === false && r.problem.code).toBe("notUtf8");
    });
    it("replaces the longest key first and only at word edges", () => {
        const r = parseVocabulary(
            ok({ Studio: "S", "quicktype Studio": "Q", type: "T" }),
        );
        if (!r.ok) throw new Error("expected valid");
        const replace = makeReplacer(r.vocabulary);
        expect(replace("quicktype Studio")).toBe("Q");
        expect(replace("Studio type typed")).toBe("S T typed");
    });
    it("takes the celebration headline from the file only", () => {
        const r = parseVocabulary(
            ok({ "private vocabulary": "Headline from the file" }),
        );
        if (!r.ok) throw new Error("expected valid");
        expect(celebrationHeadline(r.vocabulary)).toBe(
            "Headline from the file",
        );
        const none = parseVocabulary(ok({ a: "b" }));
        if (!none.ok) throw new Error("expected valid");
        expect(celebrationHeadline(none.vocabulary)).toBeNull();
    });
});
