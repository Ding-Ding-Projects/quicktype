// Bundles the engine for the desktop main process into one CommonJS file so
// the packaged app does not depend on the monorepo's workspace links.
import { build } from "esbuild";

await build({
    entryPoints: [
        new URL("../shared/engine-node.mjs", import.meta.url).pathname,
    ],
    outfile: new URL("../desktop/engine.bundle.cjs", import.meta.url).pathname,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    // The TypeScript compiler and vm2 read files next to themselves at run time, so they ship as real packages.
    external: ["typescript", "vm2", "electron"],
    legalComments: "linked",
    logLevel: "info",
});
