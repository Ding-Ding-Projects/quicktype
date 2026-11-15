// Extension host. Each extension is a folder with a versioned manifest and a
// program that speaks one JSON line in and one JSON line out over stdio, so
// extensions can be written in any language. They run in their own process
// with a time limit, an output size limit and a clean environment.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MANIFEST_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 60000;
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_OUTPUT_BYTES = 1024 * 1024;
const KNOWN_PERMISSIONS = new Set([
    "read-generated-code",
    "write-generated-code",
]);

function readManifest(dir) {
    const file = path.join(dir, "studio-extension.json");
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    if (m.manifestVersion !== MANIFEST_VERSION)
        throw new Error(`unsupported manifestVersion in ${file}`);
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(m.id)))
        throw new Error(`invalid id in ${file}`);
    if (!Array.isArray(m.command) || m.command.length === 0)
        throw new Error(`missing command in ${file}`);
    const permissions = (m.permissions ?? []).map(String);
    for (const p of permissions)
        if (!KNOWN_PERMISSIONS.has(p))
            throw new Error(`unknown permission ${p} in ${file}`);
    return {
        id: m.id,
        name: String(m.name ?? m.id).slice(0, 80),
        version: String(m.version ?? "0.0.0").slice(0, 30),
        description: String(m.description ?? "").slice(0, 400),
        command: m.command.map(String),
        permissions,
        commands: (m.commands ?? []).map((c) => ({
            id: String(c.id),
            title: String(c.title).slice(0, 60),
        })),
        timeoutMs: Math.min(
            MAX_TIMEOUT_MS,
            Number(m.limits?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        ),
        maxOutputBytes: Math.min(
            8 * DEFAULT_OUTPUT_BYTES,
            Number(m.limits?.maxOutputBytes ?? DEFAULT_OUTPUT_BYTES),
        ),
        dir,
    };
}

function register(ipcMain, { userData, builtInDir, shell }) {
    const userDir = path.join(userData, "extensions");
    const stateFile = path.join(userData, "extensions-state.json");
    fs.mkdirSync(userDir, { recursive: true });

    const readState = () => {
        try {
            return JSON.parse(fs.readFileSync(stateFile, "utf8"));
        } catch {
            return {};
        }
    };
    const writeState = (s) =>
        fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));

    const discover = () => {
        const found = new Map();
        for (const [root, builtIn] of [
            [builtInDir, true],
            [userDir, false],
        ]) {
            if (!fs.existsSync(root)) continue;
            for (const name of fs.readdirSync(root)) {
                const dir = path.join(root, name);
                if (!fs.statSync(dir).isDirectory()) continue;
                try {
                    const m = readManifest(dir);
                    if (!found.has(m.id)) found.set(m.id, { ...m, builtIn });
                } catch {
                    /* an invalid manifest is skipped, not run */
                }
            }
        }
        return found;
    };

    const enabled = (m, state) => {
        const s = state[m.id];
        if (!s?.enabled) return false;
        // New or changed permissions need fresh consent.
        return m.permissions.every((p) => (s.granted ?? []).includes(p));
    };

    ipcMain.handle("ext:list", () => {
        const state = readState();
        return [...discover().values()].map((m) => ({
            id: m.id,
            name: m.name,
            version: m.version,
            description: m.description,
            permissions: m.permissions,
            enabled: enabled(m, state),
            builtIn: m.builtIn,
            commands: m.commands,
        }));
    });
    ipcMain.handle("ext:setEnabled", (_e, id, on, granted) => {
        const m = discover().get(id);
        if (!m) return { ok: false, detail: "extension not found" };
        const state = readState();
        state[id] = {
            enabled: on,
            granted: on ? m.permissions.filter((p) => granted.includes(p)) : [],
            version: m.version,
        };
        writeState(state);
        return { ok: true };
    });
    ipcMain.handle("ext:openFolder", () => shell.openPath(userDir));
    ipcMain.handle("ext:run", async (_e, id, command, input) => {
        const m = discover().get(id);
        if (!m) return { ok: false, detail: "extension not found" };
        if (!enabled(m, readState()))
            return {
                ok: false,
                detail: "extension is disabled or needs permission",
            };
        if (!m.commands.some((c) => c.id === command))
            return { ok: false, detail: "unknown command" };
        if (Buffer.byteLength(input) > MAX_INPUT_BYTES)
            return { ok: false, detail: "input too large" };
        const payload = {
            protocol: 1,
            command,
            input: m.permissions.includes("read-generated-code") ? input : "",
        };
        const [exe, ...args] = m.command;
        const program = exe === "node" ? process.execPath : exe;
        return await new Promise((resolve) => {
            // Only a minimal environment; no tokens or user secrets pass through.
            const child = spawn(program, args, {
                cwd: m.dir,
                env: {
                    ELECTRON_RUN_AS_NODE: "1",
                    PATH: process.env.PATH ?? "",
                    SYSTEMROOT: process.env.SYSTEMROOT ?? "",
                },
                stdio: ["pipe", "pipe", "pipe"],
                windowsHide: true,
            });
            let out = "";
            let done = false;
            const finish = (r) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                child.kill();
                resolve(r);
            };
            const timer = setTimeout(
                () =>
                    finish({
                        ok: false,
                        detail: `timed out after ${m.timeoutMs} ms`,
                    }),
                m.timeoutMs,
            );
            child.stdout.on("data", (d) => {
                out += d;
                if (Buffer.byteLength(out) > m.maxOutputBytes)
                    finish({
                        ok: false,
                        detail: "output exceeded its size limit",
                    });
            });
            child.on("error", (err) =>
                finish({ ok: false, detail: String(err.message) }),
            );
            child.on("close", () => {
                try {
                    const line = out.trim().split("\n").pop() ?? "";
                    const r = JSON.parse(line);
                    finish({
                        ok: Boolean(r.ok),
                        output: typeof r.output === "string" ? r.output : "",
                        detail: r.error ? String(r.error) : undefined,
                    });
                } catch {
                    finish({
                        ok: false,
                        detail: "the extension did not answer with JSON",
                    });
                }
            });
            child.stdin.end(`${JSON.stringify(payload)}\n`);
        });
    });
}

module.exports = { register, readManifest, MANIFEST_VERSION };
