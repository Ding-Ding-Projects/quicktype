#!/usr/bin/env node
// Counts quicktype Studio's own lines from files Git tracks and prints the
// table the release notes publish. Generated and vendored files are listed
// separately and left out of the total.
//   node studio/scripts/count-lines.mjs [--markdown]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
    "git",
    [
        "ls-files",
        "studio",
        "site",
        "docs/studio",
        ".github/workflows/studio-*.yaml",
    ],
    { encoding: "utf8" },
)
    .split("\n")
    .filter(Boolean);
const GENERATED = [/package-lock\.json$/, /^studio\/build\/icon/, /^design\//];
const kind = (f) => {
    if (GENERATED.some((r) => r.test(f))) return "generated";
    if (/\/test\/|\.test\.[cm]?[jt]s$/.test(f)) return "tests";
    if (/\.(css|html|svg)$/.test(f)) return "styles and markup";
    if (/\.(md)$/.test(f)) return "documentation";
    if (/\.(m?[jt]s|cjs|bat|sh|ya?ml|json)$/.test(f)) return "source";
    return null;
};
const rows = {};
for (const f of files) {
    const k = kind(f);
    if (!k) continue;
    let text;
    try {
        text = readFileSync(f, "utf8");
    } catch {
        continue;
    }
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    rows[k] ??= { files: 0, total: 0, nonBlank: 0 };
    rows[k].files++;
    rows[k].total += lines.length;
    rows[k].nonBlank += lines.filter((l) => l.trim() !== "").length;
}
const order = [
    "source",
    "tests",
    "styles and markup",
    "documentation",
    "generated",
];
const project = order
    .filter((k) => k !== "generated" && rows[k])
    .reduce(
        (a, k) => ({
            files: a.files + rows[k].files,
            total: a.total + rows[k].total,
            nonBlank: a.nonBlank + rows[k].nonBlank,
        }),
        { files: 0, total: 0, nonBlank: 0 },
    );
console.log(
    "| Category | Files | Lines | Non-blank |\n| --- | ---: | ---: | ---: |",
);
for (const k of order)
    if (rows[k])
        console.log(
            `| ${k}${k === "generated" ? " (excluded)" : ""} | ${rows[k].files} | ${rows[k].total} | ${rows[k].nonBlank} |`,
        );
console.log(
    `| **Project total** | ${project.files} | ${project.total} | ${project.nonBlank} |`,
);
console.log(
    "\nCounted by `node studio/scripts/count-lines.mjs` over files Git tracks under studio/, site/, docs/studio/ and the Studio workflows.",
);
