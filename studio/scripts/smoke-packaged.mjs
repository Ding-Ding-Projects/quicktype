// Starts a packaged build and checks that generation works through the host,
// including TypeScript input and a built-in extension run.
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const exe = process.argv[2];
const out = process.argv[3] ?? "captures";
const child = spawn(
    exe,
    [
        "--remote-debugging-port=9334",
        "--no-sandbox",
        "--user-data-dir=/tmp/studio-pkg-profile",
    ],
    { stdio: "ignore" },
);
await new Promise((r) => setTimeout(r, 5000));
const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9334",
    defaultViewport: null,
});
const page = (await browser.pages()).find((p) => p.url().startsWith("app://"));
const ts = await page.evaluate(() =>
    window.studioHost.generateTypeScript(
        [
            {
                name: "u.ts",
                text: "export interface U { id: number; tags: string[] }",
            },
        ],
        {
            kind: "typescript",
            sources: [
                {
                    name: "u.ts",
                    text: "export interface U { id: number; tags: string[] }",
                },
            ],
            language: "swift",
            topLevelName: "U",
        },
    ),
);
console.log(
    "typescript via host:",
    ts.ok,
    ts.ok ? ts.code.split("\n").length + " lines" : JSON.stringify(ts.problems),
);
const exts = await page.evaluate(() => window.studioHost.extensions.list());
console.log("extensions:", exts.map((e) => `${e.id}@${e.version}`).join(", "));
await page.evaluate(() =>
    window.studioHost.extensions.setEnabled("code-stats", true, [
        "read-generated-code",
    ]),
);
const run = await page.evaluate(() =>
    window.studioHost.extensions.run(
        "code-stats",
        "stats",
        "struct A {}\nclass B {}\n",
    ),
);
console.log("extension run:", JSON.stringify(run));
const upd = await page.evaluate(() => window.studioHost.updates.check());
console.log("update state:", JSON.stringify(upd));
await page.screenshot({ path: `${out}/packaged-linux.png` });
await browser.disconnect();
child.kill();
