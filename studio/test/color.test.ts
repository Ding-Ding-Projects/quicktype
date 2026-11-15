import { describe, expect, it } from "vitest";
import { contrast, parseColor, toHex, toOklch } from "../src/lib/color";

describe("colour translator", () => {
    it("parses and converts every supported format", () => {
        for (const c of [
            "#c6f432",
            "rgb(198 244 50)",
            "hsl(75 90% 58%)",
            "oklch(91.2% 0.214 124.6)",
        ]) {
            const rgba = parseColor(c);
            expect(rgba).not.toBeNull();
            expect(toHex(rgba!).slice(0, 2)).toBe("#c");
        }
        expect(toOklch(parseColor("#ffffff")!)).toMatch(/^oklch\(100/);
    });
    it("rejects nonsense and measures contrast", () => {
        expect(parseColor("not a colour")).toBeNull();
        expect(contrast(parseColor("#000")!, parseColor("#fff")!)).toBeCloseTo(
            21,
            0,
        );
    });
});
