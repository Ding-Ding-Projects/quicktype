// quicktype Studio desktop app: main process.
"use strict";

const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    protocol,
    net,
    shell,
    autoUpdater,
    Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const extensions = require("./extensions.cjs");

const WEB_ROOT = path.join(__dirname, "..", "dist", "web");
const UPDATE_FEED =
    "https://github.com/Ding-Ding-Projects/quicktype/releases/download/studio-channel";
const RELEASES_PAGE =
    "https://github.com/Ding-Ding-Projects/quicktype/releases?q=studio&expanded=true";

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: false,
        },
    },
]);

// Squirrel.Windows install, update and uninstall hooks. Returns true when the
// process was started only to run one of them.
function handleSquirrelEvent() {
    if (process.platform !== "win32") return false;
    const cmd = process.argv[1];
    if (
        ![
            "--squirrel-install",
            "--squirrel-updated",
            "--squirrel-uninstall",
            "--squirrel-obsolete",
        ].includes(cmd)
    )
        return false;
    const update = path.resolve(
        path.dirname(process.execPath),
        "..",
        "Update.exe",
    );
    const exe = path.basename(process.execPath);
    if (cmd !== "--squirrel-obsolete" && fs.existsSync(update)) {
        const { spawn } = require("node:child_process");
        spawn(
            update,
            [
                cmd === "--squirrel-uninstall"
                    ? "--removeShortcut"
                    : "--createShortcut",
                exe,
            ],
            { detached: true },
        );
    }
    setTimeout(() => app.quit(), 1000);
    return true;
}

const shouldRun = !handleSquirrelEvent() && app.requestSingleInstanceLock();
if (!shouldRun) app.quit();

let win = null;

function sharedRecordFile() {
    // One record shared by every app on this device that supports the switch.
    const dir = path.join(app.getPath("appData"), "DingDingShared");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "school-mode.json");
}

function createWindow() {
    win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 520,
        minHeight: 600,
        frame: false,
        backgroundColor: "#F7F3EC",
        title: "quicktype Studio",
        icon: path.join(__dirname, "..", "build", "icon.png"),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });
    win.once("ready-to-show", () => win.show());
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//.test(url)) void shell.openExternal(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", (e, url) => {
        if (!url.startsWith("app://studio/")) e.preventDefault();
    });
    void win.loadURL("app://studio/index.html");
}

function sendUpdate(state) {
    win?.webContents.send("updates:state", state);
}

let updateState = { state: "idle" };
function setupUpdates() {
    const squirrel =
        process.platform === "win32" &&
        fs.existsSync(
            path.resolve(path.dirname(process.execPath), "..", "Update.exe"),
        );
    if (!squirrel) {
        updateState = {
            state: "unsupported",
            detail: "This copy was not installed with the installer, so it cannot update itself.",
            notesUrl: RELEASES_PAGE,
        };
        return;
    }
    autoUpdater.setFeedURL({ url: UPDATE_FEED });
    autoUpdater.on("checking-for-update", () =>
        sendUpdate((updateState = { state: "checking" })),
    );
    autoUpdater.on("update-not-available", () =>
        sendUpdate((updateState = { state: "none" })),
    );
    autoUpdater.on("update-available", () =>
        sendUpdate((updateState = { state: "downloading" })),
    );
    autoUpdater.on("update-downloaded", (_e, _notes, name) =>
        sendUpdate(
            (updateState = {
                state: "ready",
                version: String(name || "new"),
                notesUrl: RELEASES_PAGE,
            }),
        ),
    );
    autoUpdater.on("error", (err) =>
        sendUpdate(
            (updateState = {
                state: "error",
                detail: String(err?.message ?? err),
            }),
        ),
    );
}

if (shouldRun)
    app.whenReady().then(async () => {
        // TypeScript input pins its rootDir to the working directory.
        process.chdir(app.getPath("userData"));
        Menu.setApplicationMenu(null);
        protocol.handle("app", (req) => {
            const url = new URL(req.url);
            const rel = decodeURIComponent(
                url.pathname === "/" ? "/index.html" : url.pathname,
            );
            const file = path.normalize(path.join(WEB_ROOT, rel));
            if (!file.startsWith(WEB_ROOT + path.sep))
                return new Response("Forbidden", { status: 403 });
            return net.fetch(pathToFileURL(file).toString());
        });
        // The packaged app uses the bundled engine; a source checkout falls back to the modules.
        const engine = fs.existsSync(path.join(__dirname, "engine.bundle.cjs"))
            ? require("./engine.bundle.cjs")
            : await import("../shared/engine-node.mjs");
        const { typescriptToSchema } = engine;

        ipcMain.handle("window:minimize", () => win?.minimize());
        ipcMain.handle("window:toggleMaximize", () =>
            win?.isMaximized() ? win.unmaximize() : win?.maximize(),
        );
        ipcMain.handle("window:close", () => win?.close());
        ipcMain.handle("file:save", async (_e, name, text) => {
            if (typeof name !== "string" || typeof text !== "string")
                return { ok: false, detail: "invalid request" };
            const res = await dialog.showSaveDialog(win, {
                defaultPath: path.basename(name),
            });
            if (res.canceled || !res.filePath) return { ok: false };
            try {
                await fs.promises.writeFile(res.filePath, text, "utf8");
                return { ok: true, path: res.filePath };
            } catch (err) {
                return { ok: false, detail: String(err.message) };
            }
        });
        ipcMain.handle("engine:typescript", async (_e, _sources, request) =>
            engine.generate(request, { typescriptToSchema }),
        );
        ipcMain.handle("shared:read", async () => {
            try {
                const raw = await fs.promises
                    .readFile(sharedRecordFile(), "utf8")
                    .catch(() => null);
                return { ok: true, record: raw ? JSON.parse(raw) : undefined };
            } catch (err) {
                return { ok: false, detail: String(err.message) };
            }
        });
        ipcMain.handle("shared:write", async (_e, record) => {
            try {
                const clean = {
                    v: 1,
                    on: Boolean(record?.on),
                    name: String(record?.name ?? "School mode").slice(0, 60),
                    pinHash: record?.pinHash ?? null,
                    salt: record?.salt ?? null,
                };
                await fs.promises.writeFile(
                    sharedRecordFile(),
                    JSON.stringify(clean),
                    "utf8",
                );
                return { ok: true };
            } catch (err) {
                return { ok: false, detail: String(err.message) };
            }
        });
        let watcher = null;
        ipcMain.on("shared:watch", (e) => {
            watcher?.close();
            try {
                watcher = fs.watch(
                    sharedRecordFile(),
                    { persistent: false },
                    async () => {
                        const raw = await fs.promises
                            .readFile(sharedRecordFile(), "utf8")
                            .catch(() => null);
                        if (raw) {
                            try {
                                e.sender.send(
                                    "shared:changed",
                                    JSON.parse(raw),
                                );
                            } catch {
                                /* a half-written file; the next event carries the full record */
                            }
                        }
                    },
                );
            } catch {
                /* the record does not exist yet; it is created on first write */
            }
        });
        extensions.register(ipcMain, {
            userData: app.getPath("userData"),
            builtInDir: path.join(__dirname, "extensions"),
            shell,
        });
        setupUpdates();
        ipcMain.handle("updates:check", async () => {
            if (updateState.state === "unsupported") return updateState;
            try {
                autoUpdater.checkForUpdates();
                return { state: "checking" };
            } catch (err) {
                return { state: "error", detail: String(err.message) };
            }
        });
        ipcMain.handle("updates:restart", () => autoUpdater.quitAndInstall());
        ipcMain.handle("app:info", () => ({ version: app.getVersion() }));
        createWindow();
    });

app.on("second-instance", () => {
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});
app.on("window-all-closed", () => app.quit());
