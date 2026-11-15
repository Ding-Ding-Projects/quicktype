// Builds the quicktype Studio website into site/dist.
// The site documents the app and offers downloads; it is not the app.
//   node build.mjs            (set STUDIO_RELEASE_JSON to a verified release manifest to show the download button)
import {
    cpSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
    existsSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const out = join(here, "dist");
const BASE = process.env.SITE_BASE ?? "/quicktype/";
const SITE_URL =
    process.env.SITE_URL ?? "https://ding-ding-projects.github.io/quicktype/";
const builtAt = new Date().toISOString();
const commit = process.env.GITHUB_SHA?.slice(0, 12) ?? "local";

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "docs"), { recursive: true });
mkdirSync(join(out, "fonts"), { recursive: true });

// Fonts are vendored from the installed font packages; nothing loads from a CDN.
const fontFiles = [
    [
        "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2",
        "body-400.woff2",
    ],
    [
        "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2",
        "body-700.woff2",
    ],
    [
        "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
        "display.woff2",
    ],
    [
        "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
        "mono.woff2",
    ],
];
for (const [src, name] of fontFiles)
    cpSync(join(here, "node_modules", src), join(out, "fonts", name));
cpSync(join(here, "src", "site.css"), join(out, "site.css"));
cpSync(join(here, "src", "site.js"), join(out, "site.js"));
cpSync(join(repo, "studio", "public", "icon.svg"), join(out, "icon.svg"));
if (existsSync(join(repo, "studio", "social-preview.png")))
    cpSync(
        join(repo, "studio", "social-preview.png"),
        join(out, "social-preview.png"),
    );
for (const shot of ["generate.png", "settings.png", "desktop-drop.png"]) {
    const p = join(repo, "studio", "media", shot);
    if (existsSync(p)) {
        mkdirSync(join(out, "captures"), { recursive: true });
        cpSync(p, join(out, "captures", shot));
    }
}

// Articles: one page per Markdown file under docs/studio.
const docsRoot = join(repo, "docs", "studio");
const walk = (d) =>
    readdirSync(d).flatMap((n) =>
        statSync(join(d, n)).isDirectory()
            ? walk(join(d, n))
            : n.endsWith(".md")
              ? [join(d, n)]
              : [],
    );
const articles = walk(docsRoot)
    .filter((f) => !f.endsWith("README.md"))
    .map((file) => {
        const rel = relative(docsRoot, file).replace(/\\/g, "/");
        const md = readFileSync(file, "utf8");
        const title = /^#\s+(.+)$/m.exec(md)?.[1] ?? rel;
        const [category] = rel.split("/");
        const slug = rel.replace(/\.md$/, "").replace(/\//g, "--");
        const summary =
            md.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "";
        return { rel, md, title, category, slug, summary };
    });
const CATEGORY = {
    generating: "Generating code",
    wording: "Language and wording",
    look: "Look and layout",
    navigation: "Navigation and search",
    records: "History and messages",
    tools: "Tools and extensions",
    running: "Running it yourself",
};

const release = process.env.STUDIO_RELEASE_JSON
    ? JSON.parse(readFileSync(process.env.STUDIO_RELEASE_JSON, "utf8"))
    : null;

const NAV = [
    ["index", "Home", "主頁"],
    ["features", "Features", "功能"],
    ["docs", "Docs", "文件"],
    ["download", "Download", "下載"],
    ["changelog", "Changelog", "更新紀錄"],
    ["status", "Status", "狀態"],
    ["settings", "Site settings", "網站設定"],
];

const esc = (s) =>
    String(s).replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

function page({ id, title, description, body, depth = 0 }) {
    const up = depth ? "../".repeat(depth) : "./";
    const nav = NAV.map(
        ([pid, en, yue]) =>
            `<a class="tab${pid === id ? " active" : ""}" href="${up}${pid === "index" ? "" : `${pid}.html`}"${pid === id ? ' aria-current="page"' : ""} data-yue="${yue}"><span class="lbl">${en}</span></a>`,
    ).join("");
    const url = `${SITE_URL}${id === "index" ? "" : id.startsWith("docs/") ? `${id}.html` : `${id}.html`}`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="quicktype Studio">
<meta property="og:image" content="${SITE_URL}social-preview.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The quicktype Studio window generating TypeScript from sample JSON">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}social-preview.png">
<link rel="icon" href="${up}icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}site.css">
<script src="${up}site.js" defer></script>
</head>
<body data-root="${up}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
<a class="brand" href="${up}"><img src="${up}icon.svg" width="30" height="30" alt=""><span>quicktype Studio</span></a>
<span class="pill">This site documents the app. It is not the app.</span>
<button class="palette-btn" type="button" data-open-palette aria-keyshortcuts="Control+Shift+F"><span>Search the site</span><kbd>Ctrl+Shift+F</kbd></button>
</header>
<div class="shell">
<nav class="tabs" aria-label="Site pages">${nav}</nav>
<main id="main" tabindex="-1">${body}</main>
</div>
<footer class="foot"><span>Built ${builtAt.slice(0, 10)} from ${commit}. Built on the open-source quicktype engine, Apache-2.0.</span><a href="https://github.com/Ding-Ding-Projects/quicktype">Source code</a></footer>
</body>
</html>
`;
}

const write = (name, html) => {
    mkdirSync(dirname(join(out, name)), { recursive: true });
    writeFileSync(join(out, name), html);
};

const downloadButton = release
    ? `<a class="btn primary big" href="${esc(release.portableUrl)}">Download for Windows</a><p class="muted">Version ${esc(release.version)}, portable, ${esc(release.sizeMb)} MB. Not code-signed: Windows may warn about an unknown publisher.</p>`
    : `<p class="note">No verified Windows release has been published yet, so there is no download button. It appears here automatically once a release is verified.</p>`;

write(
    "index.html",
    page({
        id: "index",
        title: "quicktype Studio: sample JSON in, typed models out",
        description:
            "Turn sample JSON, JSON Schema, TypeScript or GraphQL into typed models with serializers in 27 languages, on your own machine.",
        body: `<section class="hero">
<div class="hero-text">
<h1>Turn sample JSON into real types in 27 languages.</h1>
<p class="lead">quicktype Studio reads JSON, JSON Schema, TypeScript or GraphQL and writes models with serializers for TypeScript, Swift, Kotlin, Rust, Go, C# and more. It runs on your machine. Your data stays there.</p>
<div class="actions">${release ? `<a class="btn primary big" href="${esc(release.portableUrl)}">Download for Windows</a>` : `<a class="btn primary big" href="download.html">Get the desktop app</a>`}<a class="btn big" href="#run">Other ways to run it</a></div>
</div>
${existsSync(join(out, "captures", "generate.png")) ? `<img class="hero-shot" src="captures/generate.png" width="1440" height="900" alt="quicktype Studio generating TypeScript types from a Pokédex sample">` : ""}
</section>
<section id="run" class="band">
<h2>Three ways to run it</h2>
<div class="cards">
<article class="card violet"><h3>Desktop app</h3><p>An installer that updates itself, or one portable file, for Windows. Every feature, including personal wording files, extensions and saving straight into your project folders.</p><a href="download.html">Download</a></article>
<article class="card teal"><h3>Self-hosted container</h3><p>Run the web version on a server on your network and open it from any browser.</p><pre><code>docker compose -f studio/compose.yaml up -d</code></pre><a href="docs/running--self-hosted.html">Container guide</a></article>
<article class="card warm"><h3>Appliance image</h3><p>A small system image that boots straight into Studio. Flash it to a spare machine or boot it in a virtual machine.</p><a href="docs/running--appliance.html">Appliance guide</a></article>
</div>
<div class="callout"><p>If a feature does not work in the web version or on the appliance, download the desktop app. It is the only edition that can read files you drop on its window and run extensions.</p><a class="btn accent" href="download.html">Get the desktop app</a></div>
</section>`,
    }),
);

write(
    "features.html",
    page({
        id: "features",
        title: "Features, quicktype Studio",
        description:
            "Every quicktype Studio feature, grouped by what it helps with, each with its own article.",
        body: `<h1>Features</h1><p class="lead">Every feature has its own article covering how to use it, what happens when something goes wrong, privacy, and how to check it works.</p>
${Object.entries(CATEGORY)
    .map(
        ([c, name]) =>
            `<h2>${name}</h2><div class="cards">${articles
                .filter((a) => a.category === c)
                .map(
                    (a) =>
                        `<a class="card link" href="docs/${a.slug}.html"><h3>${esc(a.title)}</h3><p>${esc(a.summary.slice(0, 180))}${a.summary.length > 180 ? "…" : ""}</p></a>`,
                )
                .join("")}</div>`,
    )
    .join("\n")}`,
    }),
);

const docIndex = `<h1>Documentation</h1>
<div class="search" data-filter-target="#doc-list"><label for="doc-filter">Filter articles</label><div class="rx-row"><input id="doc-filter" type="search" autocomplete="off"><button type="button" class="rx-toggle" aria-pressed="false" title="Use a regular expression">.*</button></div><p class="rx-status" aria-live="polite"></p></div>
<ul id="doc-list" class="doc-list">${articles.map((a) => `<li data-text="${esc(`${a.title} ${CATEGORY[a.category]}`)}"><a href="docs/${a.slug}.html"><span class="muted small">${CATEGORY[a.category]}</span><strong>${esc(a.title)}</strong></a></li>`).join("")}</ul>`;
write(
    "docs.html",
    page({
        id: "docs",
        title: "Documentation, quicktype Studio",
        description: "Every quicktype Studio article in one place.",
        body: docIndex,
    }),
);

marked.use({
    renderer: {
        link({ href, text }) {
            const fixed = href.endsWith(".md")
                ? href
                      .replace(/^\.\.\//, "")
                      .replace(/\.md$/, ".html")
                      .replace(/\//g, "--")
                : href;
            return `<a href="${esc(fixed)}">${text}</a>`;
        },
    },
});
for (const a of articles) {
    const html = marked.parse(a.md.replace(/^#\s+.+\n/, ""));
    write(
        `docs/${a.slug}.html`,
        page({
            id: "docs",
            depth: 1,
            title: `${a.title}, quicktype Studio docs`,
            description: a.summary.slice(0, 200),
            body: `<p class="crumbs"><a href="../docs.html">Docs</a> / ${CATEGORY[a.category]}</p><article class="prose"><h1>${esc(a.title)}</h1>${html}</article>`,
        }).replace(
            /href="(?!https?:|#|\.\.\/|mailto:)([a-z]+--[a-z-]+\.html)"/g,
            'href="$1"',
        ),
    );
}

write(
    "download.html",
    page({
        id: "download",
        title: "Download quicktype Studio",
        description:
            "Download the quicktype Studio desktop app, container image or appliance image.",
        body: `<h1>Download</h1>${downloadButton}
<h2>Self-hosted container</h2><pre><code>docker pull ghcr.io/ding-ding-projects/quicktype-studio:latest</code></pre>
<h2>Appliance image</h2><p>Each release carries a BIOS disk image and an EFI ISO. See the <a href="docs/running--appliance.html">appliance guide</a>.</p>
<p><a href="https://github.com/Ding-Ding-Projects/quicktype/releases?q=studio&amp;expanded=true">All quicktype Studio releases</a></p>`,
    }),
);

const changelog = marked.parse(
    readFileSync(join(repo, "studio", "CHANGELOG.md"), "utf8").replace(
        /^#\s+.+\n/,
        "",
    ),
);
write(
    "changelog.html",
    page({
        id: "changelog",
        title: "Changelog, quicktype Studio",
        description: "What changed in each quicktype Studio version.",
        body: `<h1>Changelog</h1><div class="prose">${changelog}</div>`,
    }),
);

write(
    "status.html",
    page({
        id: "status",
        title: "Status, quicktype Studio",
        description: "Build and release status for quicktype Studio.",
        body: `<h1>Status</h1><dl class="facts"><dt>Site built</dt><dd>${builtAt}</dd><dt>From commit</dt><dd><code>${commit}</code></dd><dt>Latest verified release</dt><dd>${release ? esc(release.version) : "None yet"}</dd><dt>Articles</dt><dd>${articles.length}</dd></dl>
<p><a href="https://github.com/Ding-Ding-Projects/quicktype/actions">Build runs</a></p>`,
    }),
);

write(
    "settings.html",
    page({
        id: "settings",
        title: "Site settings, quicktype Studio",
        description:
            "Theme, language and wording settings for this website. They are stored in this browser only.",
        body: `<h1>Site settings</h1><p class="muted">Stored in this browser only. Nothing is sent anywhere.</p>
<section class="card setting"><h2 id="s-theme">Theme</h2><div class="seg" role="radiogroup" aria-labelledby="s-theme" data-setting="theme"><button type="button" role="radio" data-value="system">Match system</button><button type="button" role="radio" data-value="light">Light</button><button type="button" role="radio" data-value="dark">Dark</button></div></section>
<section class="card setting"><h2 id="s-lang">Navigation language</h2><div class="seg" role="radiogroup" aria-labelledby="s-lang" data-setting="lang"><button type="button" role="radio" data-value="en">English</button><button type="button" role="radio" data-value="yue">Cantonese</button><button type="button" role="radio" data-value="both">Bilingual</button></div><p class="muted small">Articles are written in English.</p></section>
<section class="card setting"><h2 id="s-fun">How playful should site messages be?</h2><label>English <input type="range" min="1" max="5" value="5" data-setting="funEn"></label><label>Cantonese <input type="range" min="1" max="5" value="5" data-setting="funYue"></label><p class="muted small">Both start at 5. Messages always keep the facts.</p></section>
<section class="card setting"><h2 id="s-vocab">Personal wording file</h2><p>Load a personal vocabulary JSON to replace this site's navigation words with your own, in this browser only. It is checked in full first; any problem refuses the whole file.</p><p class="vocab-status" role="status">No file loaded. Original wording is in use.</p><label class="btn">Choose JSON file<input type="file" accept="application/json,.json" data-vocab-file class="visually-hidden"></label> <button type="button" class="btn" data-vocab-clear>Clear and restore original</button></section>`,
    }),
);

writeFileSync(
    join(out, "search-index.json"),
    JSON.stringify([
        ...NAV.map(([id, en]) => ({
            title: en,
            url: id === "index" ? "" : `${id}.html`,
            kind: "Page",
        })),
        ...articles.map((a) => ({
            title: a.title,
            url: `docs/${a.slug}.html`,
            kind: CATEGORY[a.category],
            text: a.summary.slice(0, 160),
        })),
    ]),
);
writeFileSync(join(out, ".nojekyll"), "");
writeFileSync(
    join(out, "404.html"),
    page({
        id: "missing",
        title: "Not found, quicktype Studio",
        description: "This page does not exist.",
        body: `<h1>Not found</h1><p><a href="${BASE}">Back to the home page</a></p>`,
    }),
);
console.log(
    `site built: ${articles.length} articles, release ${release ? release.version : "none"}`,
);
