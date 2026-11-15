// Exposes a narrow, typed bridge to the interface. No Node access leaks through.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioHost", {
    edition: "desktop",
    version: process.env.npm_package_version ?? "",
    builtAt: "",
    window: {
        minimize: () => ipcRenderer.invoke("window:minimize"),
        toggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
        close: () => ipcRenderer.invoke("window:close"),
    },
    saveFile: (name, text) =>
        ipcRenderer.invoke("file:save", String(name), String(text)),
    generateTypeScript: (sources, request) =>
        ipcRenderer.invoke("engine:typescript", sources, request),
    sharedRecord: {
        read: () => ipcRenderer.invoke("shared:read"),
        write: (record) => ipcRenderer.invoke("shared:write", record),
        watch: (cb) => {
            ipcRenderer.on("shared:changed", (_e, record) => cb(record));
            ipcRenderer.send("shared:watch");
        },
    },
    extensions: {
        list: () => ipcRenderer.invoke("ext:list"),
        setEnabled: (id, on, granted) =>
            ipcRenderer.invoke(
                "ext:setEnabled",
                String(id),
                Boolean(on),
                Array.isArray(granted) ? granted.map(String) : [],
            ),
        run: (id, command, input) =>
            ipcRenderer.invoke(
                "ext:run",
                String(id),
                String(command),
                String(input),
            ),
        openFolder: () => ipcRenderer.invoke("ext:openFolder"),
    },
    updates: {
        check: () => ipcRenderer.invoke("updates:check"),
        onState: (cb) => ipcRenderer.on("updates:state", (_e, s) => cb(s)),
        restart: () => ipcRenderer.invoke("updates:restart"),
    },
});
