#!/usr/bin/env node
// Self-hosted web edition: serves the built interface and a small JSON API.
// No outbound network requests are made. Every route is local to this host.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces, hostname } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describeLanguages, generate } from "../shared/engine.mjs";
import { typescriptToSchema } from "../shared/typescript.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(
    process.env.STUDIO_WEB_ROOT ?? join(here, "..", "dist", "web"),
);
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";
const EDITION = process.env.STUDIO_EDITION ?? "web";
const MAX_BODY = 9 * 1024 * 1024;
const startedAt = new Date();

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".json": "application/json",
    ".md": "text/markdown; charset=utf-8",
};

const SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
};

function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
}

function json(res, status, value) {
    send(res, status, JSON.stringify(value), {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    });
}

async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY)
            throw Object.assign(new Error("request body too large"), {
                status: 413,
            });
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

export function lanAddresses() {
    const out = [];
    for (const list of Object.values(networkInterfaces())) {
        for (const a of list ?? [])
            if (a.family === "IPv4" && !a.internal) out.push(a.address);
    }
    return out;
}

async function serveStatic(_req, res, pathname) {
    const rel = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT + sep) && file !== ROOT)
        return send(res, 403, "Forbidden");
    try {
        const s = await stat(file);
        if (!s.isFile()) throw new Error("not a file");
        let body = await readFile(file);
        if (file.endsWith("index.html")) {
            body = body
                .toString("utf8")
                .replace(
                    /<meta name="studio-edition" content="[^"]*">/,
                    `<meta name="studio-edition" content="${EDITION}">`,
                );
        }
        const cache = rel.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache";
        send(res, 200, body, {
            "content-type": TYPES[extname(file)] ?? "application/octet-stream",
            "cache-control": cache,
        });
    } catch {
        send(res, 404, "Not found", {
            "content-type": "text/plain; charset=utf-8",
        });
    }
}

export const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
        if (url.pathname === "/healthz")
            return json(res, 200, {
                ok: true,
                edition: EDITION,
                startedAt: startedAt.toISOString(),
            });
        if (url.pathname === "/api/languages" && req.method === "GET")
            return json(res, 200, describeLanguages());
        if (url.pathname === "/api/generate") {
            if (req.method !== "POST")
                return json(res, 405, {
                    ok: false,
                    problems: [{ code: "method" }],
                });
            if (
                !String(req.headers["content-type"] ?? "").startsWith(
                    "application/json",
                )
            )
                return json(res, 415, {
                    ok: false,
                    problems: [{ code: "contentType" }],
                });
            let request;
            try {
                request = JSON.parse(await readBody(req));
            } catch (e) {
                return json(res, e.status ?? 400, {
                    ok: false,
                    problems: [{ code: "request.invalid", detail: e.message }],
                });
            }
            const result = await generate(request, { typescriptToSchema });
            return json(res, result.ok ? 200 : 422, result);
        }
        if (url.pathname === "/api/status" && req.method === "GET") {
            return json(res, 200, {
                edition: EDITION,
                host: hostname(),
                addresses: lanAddresses().map((a) => `http://${a}:${PORT}/`),
                uptimeSeconds: Math.round(process.uptime()),
                node: process.version,
            });
        }
        if (url.pathname === "/appliance" || url.pathname === "/appliance/") {
            const page = await readFile(join(here, "appliance.html"));
            return send(res, 200, page, {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-cache",
            });
        }
        if (req.method !== "GET" && req.method !== "HEAD")
            return send(res, 405, "Method not allowed");
        return serveStatic(req, res, url.pathname);
    } catch (e) {
        return json(res, 500, {
            ok: false,
            problems: [{ code: "server", detail: String(e?.message ?? e) }],
        });
    }
});

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    server.listen(PORT, HOST, () => {
        const verifiedAt = new Date();
        console.log(`quicktype Studio (${EDITION}) is serving ${ROOT}`);
        console.log(`  Local:   http://localhost:${PORT}/`);
        for (const a of lanAddresses())
            console.log(`  Network: http://${a}:${PORT}/`);
        console.log(`  Started: ${verifiedAt.toISOString()} (UTC)`);
    });
    const stop = () => server.close(() => process.exit(0));
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
}
