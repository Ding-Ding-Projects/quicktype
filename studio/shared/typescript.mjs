// TypeScript input needs the TypeScript compiler, so it only runs on Node
// hosts: the desktop main process and the self-hosted server.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export async function typescriptToSchema(sources) {
    const { schemaForTypeScriptSources } = await import(
        "quicktype-typescript-input"
    );
    // The compiler options pin rootDir to the working directory, so the
    // scratch folder must live under it.
    const dir = await mkdtemp(join(process.cwd(), ".studio-ts-"));
    try {
        const files = [];
        for (const [i, s] of sources.entries()) {
            const name = basename(String(s.name || `input${i}.ts`)).replace(
                /[^\w.-]/g,
                "_",
            );
            const file = join(dir, name.endsWith(".ts") ? name : `${name}.ts`);
            await writeFile(file, s.text, "utf8");
            files.push(file);
        }
        const result = schemaForTypeScriptSources(files);
        return result.schema;
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
