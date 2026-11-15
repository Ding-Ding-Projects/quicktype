// Renders the master logo (public/icon.svg) to the PNG sizes packaging needs.
import puppeteer from "puppeteer-core";
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile(
    new URL("../public/icon.svg", import.meta.url),
    "utf8",
);
const browser = await puppeteer.launch({
    executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
});
const page = await browser.newPage();
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    await page.setViewport({ width: size, height: size });
    await page.setContent(
        `<html><body style="margin:0;background:transparent">${svg.replace(/width="256" height="256"/, `width="${size}" height="${size}"`)}</body></html>`,
    );
    const png = await page.screenshot({ omitBackground: true, type: "png" });
    await writeFile(new URL(`../build/icon-${size}.png`, import.meta.url), png);
    if (size === 512)
        await writeFile(new URL("../build/icon.png", import.meta.url), png);
}
await browser.close();
// A multi-resolution .ico built from the PNG frames.
const sizes = [16, 32, 48, 64, 128, 256];
const frames = await Promise.all(
    sizes.map((s) =>
        readFile(new URL(`../build/icon-${s}.png`, import.meta.url)),
    ),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s === 256 ? 0 : s, e);
    header.writeUInt8(s === 256 ? 0 : s, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(frames[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += frames[i].length;
});
await writeFile(
    new URL("../build/icon.ico", import.meta.url),
    Buffer.concat([header, ...frames]),
);
console.log("icons written to build/");
