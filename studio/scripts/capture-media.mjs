// Captures the real built web edition for the README, the website and link previews.
//   node scripts/capture-media.mjs http://localhost:8099/
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:8080/";
const browser = await puppeteer.launch({
    executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
});
const page = await browser.newPage();
const done = { onboarding: { done: true, step: 4, skipped: [] }, v: 1 };
await page.evaluateOnNewDocument((s) => {
    if (!localStorage.getItem("studio.settings.v1"))
        localStorage.setItem("studio.settings.v1", JSON.stringify(s));
}, done);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0" });
await wait(1800);
await page.screenshot({ path: "media/generate.png" });
await page.click("#tab-settings");
await wait(800);
await page.screenshot({ path: "media/settings.png" });
await page.click("#tab-generate");
await page.setViewport({ width: 1200, height: 630 });
await wait(1500);
await page.screenshot({ path: "social-preview.png" });
await browser.close();
console.log("media captured");
