import { describe, expect, it } from "vitest";
import { b64decode, b64encode, convert } from "../src/pages/tools";

describe("tools", () => {
    it("round-trips JSON through CSV", () => {
        const csv = convert('[{"name":"Ada, L.","n":1}]', "json", "csv");
        expect(csv).toBe('name,n\n"Ada, L.",1');
        expect(JSON.parse(convert(csv, "csv", "json"))).toEqual([
            { name: "Ada, L.", n: "1" },
        ]);
    });
    it("handles UTF-8 and the URL-safe alphabet in Base64", () => {
        const text = "héllo 👋 ?>";
        expect(b64decode(b64encode(text, false))).toBe(text);
        expect(b64encode(text, true)).not.toMatch(/[+/=]/);
        expect(b64decode(b64encode(text, true))).toBe(text);
    });
});
