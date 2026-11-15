import { defineConfig } from "vite";
import { execSync } from "node:child_process";

function git(cmd, fallback) {
    try {
        return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim();
    } catch {
        return fallback;
    }
}

const edition = process.env.STUDIO_EDITION ?? "web";
process.env.VITE_STUDIO_COMMIT ??= git("git rev-parse --short HEAD", "local");
process.env.VITE_STUDIO_BUILT_AT ??= new Date().toISOString();
process.env.VITE_STUDIO_VERSION ??= "24.0.0";

export default defineConfig({
    base: "./",
    build: {
        outDir: process.env.STUDIO_OUT ?? "dist/web",
        emptyOutDir: true,
        target: "es2022",
        chunkSizeWarningLimit: 4000,
    },
    worker: { format: "es" },
    define: { "process.env.NODE_DEBUG": "false" },
    plugins: [
        {
            name: "studio-edition",
            transformIndexHtml: (html) =>
                html.replace("%STUDIO_EDITION%", edition),
        },
    ],
    server: { fs: { allow: [".."] } },
});
