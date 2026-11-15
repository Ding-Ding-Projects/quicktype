// Drives the built interface in headless Chrome and saves screenshots.
// Usage: node scripts/capture.mjs <url> <outDir> [--steps name,name]
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const [url = "http://localhost:8080/", out = "captures"] =
    process.argv.slice(2);
const chrome = process.env.CHROME ?? "/usr/bin/google-chrome";
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.setViewport({ width: 1440, height: 900 });
const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("saved", `${out}/${name}.png`);
};
await page.goto(url, { waitUntil: "networkidle0" });
await shot("01-wizard");
for (let i = 0; i < 5; i++) {
    const next = await page.$(".wizard .btn.primary");
    if (!next) break;
    if (i === 3) {
        await page.evaluate(() =>
            [...document.querySelectorAll(".wizard .btn.primary")][0].click(),
        );
    } else await next.click();
    await new Promise((r) => setTimeout(r, 300));
    if (i === 1) await shot("02-wizard-languages");
}
await new Promise((r) => setTimeout(r, 1500));
await shot("03-generate");
const tabs = [
    "json",
    "samples",
    "languages",
    "history",
    "tools",
    "extensions",
    "docs",
    "changelog",
    "settings",
    "about",
];
for (const id of tabs) {
    await page.click(`#tab-${id}`);
    await shot(`tab-${id}`);
}
await page.keyboard.down("Control");
await page.keyboard.down("Shift");
await page.keyboard.press("KeyF");
await page.keyboard.up("Shift");
await page.keyboard.up("Control");
await page.keyboard.type("theme");
await shot("palette");
await page.keyboard.press("Escape");
await page.evaluate(() => {
    localStorage.setItem(
        "studio.settings.v1",
        JSON.stringify({
            ...JSON.parse(localStorage.getItem("studio.settings.v1")),
            language: "both",
            theme: "dark",
            activeTab: "generate",
        }),
    );
});
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));
await shot("generate-dark-bilingual");
await page.setViewport({ width: 390, height: 844, isMobile: true });
await shot("phone-generate");
console.log("console errors:", JSON.stringify(errors, null, 1));
await browser.close();
