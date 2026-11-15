// Bundles the engine for the desktop main process into one CommonJS file so
// the packaged app does not depend on the monorepo's workspace links.
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await build({
    entryPoints: [
        fileURLToPath(new URL("../shared/engine-node.mjs", import.meta.url)),
    ],
    outfile: fileURLToPath(
        new URL("../desktop/engine.bundle.cjs", import.meta.url),
    ),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    // The TypeScript compiler and vm2 read files next to themselves at run time, so they ship as real packages.
    external: ["typescript", "vm2", "electron"],
    legalComments: "linked",
    logLevel: "info",
});
