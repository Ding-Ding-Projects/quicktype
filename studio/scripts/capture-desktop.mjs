// Launches the packaged-layout desktop app under a virtual display and
// captures it through the DevTools protocol.
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const out = process.argv[2] ?? "captures/desktop";
await mkdir(out, { recursive: true });
const electron = (await import("electron")).default;
const child = spawn(
    electron,
    [
        ".",
        "--remote-debugging-port=9333",
        "--no-sandbox",
        `--user-data-dir=${process.env.STUDIO_PROFILE ?? "/tmp/studio-profile"}`,
    ],
    { stdio: "inherit" },
);
await new Promise((r) => setTimeout(r, 4000));
const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9333",
    defaultViewport: null,
});
const [page] = (await browser.pages()).filter((p) =>
    p.url().startsWith("app://"),
);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("saved", name);
};
await shot("desktop-01-start");
await page.evaluate(() => {
    for (const w of document.querySelectorAll(".wizard")) w.remove();
});
await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("studio.settings.v1") ?? "{}");
    s.onboarding = { done: true, step: 4, skipped: [] };
    localStorage.setItem("studio.settings.v1", JSON.stringify(s));
});
await shot("desktop-02-generate");
// Drop a neutral test wording file onto the window.
await page.evaluate(() => {
    const json = JSON.stringify({
        schemaVersion: 1,
        entries: { Generate: "Make", "private vocabulary": "Wording unlocked" },
    });
    const dt = new DataTransfer();
    dt.items.add(
        new File([json], "wording.json", { type: "application/json" }),
    );
    window.dispatchEvent(
        new DragEvent("drop", {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
        }),
    );
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${out}/desktop-03-drop-celebration.png` });
await new Promise((r) => setTimeout(r, 3500));
await shot("desktop-04-wording-applied");
// An invalid drop is refused and changes nothing.
await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(
        new File(
            ['{"schemaVersion":1,"entries":{"a":"b","a":"c"}}'],
            "bad.json",
            { type: "application/json" },
        ),
    );
    window.dispatchEvent(
        new DragEvent("drop", {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
        }),
    );
});
await shot("desktop-05-invalid-drop");
await page.click("#tab-extensions");
await shot("desktop-06-extensions");
console.log("errors", JSON.stringify(errors));
await browser.disconnect();
child.kill();
