// Code generation engine shared by the browser worker, the desktop main
// process and the self-hosted server. It wraps quicktype-core and returns
// plain data so it can cross worker, IPC and HTTP boundaries.

import {
    InputData,
    JSONSchemaInput,
    FetchingJSONSchemaStore,
    jsonInputForTargetLanguage,
    quicktype,
    defaultTargetLanguages,
} from "quicktype-core";

/** Source kinds every edition understands. TypeScript needs a Node host. */
export const SOURCE_KINDS = ["json", "schema", "graphql", "typescript"];

/** Hard limits so a pasted sample can never hang the interface. */
export const LIMITS = Object.freeze({
    maxSourceBytes: 8 * 1024 * 1024,
    maxSources: 32,
    maxTopLevelNameLength: 120,
});

/** Describe every target language and its options for the UI. */
export function describeLanguages() {
    return defaultTargetLanguages.map((lang) => ({
        name: lang.names[0],
        names: [...lang.names],
        displayName: lang.displayName,
        extension: lang.extension,
        options: lang.optionDefinitions
            .filter((o) => o.kind !== "cli")
            .map((o) => ({
                name: o.name,
                description: o.description,
                type: o.optionType,
                kind: o.kind ?? "primary",
                defaultValue: o.defaultValue,
                values: o.values ? Object.keys(o.values) : undefined,
            })),
    }));
}

function byteLength(text) {
    return new TextEncoder().encode(text).length;
}

/**
 * Validate a request before any work happens. Returns a list of problems,
 * each with a stable code the interface can translate.
 */
export function validateRequest(request) {
    const problems = [];
    if (!request || typeof request !== "object") {
        return [{ code: "request.invalid" }];
    }
    const { kind, sources, language, topLevelName } = request;
    if (!SOURCE_KINDS.includes(kind))
        problems.push({ code: "kind.unknown", value: String(kind) });
    if (!Array.isArray(sources) || sources.length === 0)
        problems.push({ code: "sources.empty" });
    else if (sources.length > LIMITS.maxSources)
        problems.push({ code: "sources.tooMany", limit: LIMITS.maxSources });
    else {
        let total = 0;
        for (const s of sources) {
            if (typeof s?.text !== "string")
                problems.push({ code: "source.notText" });
            else total += byteLength(s.text);
        }
        if (total > LIMITS.maxSourceBytes)
            problems.push({
                code: "sources.tooLarge",
                limit: LIMITS.maxSourceBytes,
            });
    }
    if (
        typeof language !== "string" ||
        !defaultTargetLanguages.some((l) => l.names.includes(language))
    ) {
        problems.push({ code: "language.unknown", value: String(language) });
    }
    if (typeof topLevelName !== "string" || topLevelName.trim() === "")
        problems.push({ code: "name.empty" });
    else if (topLevelName.length > LIMITS.maxTopLevelNameLength)
        problems.push({ code: "name.tooLong" });
    return problems;
}

/**
 * Generate code.
 * @param {{kind:string, sources:{name?:string,text:string}[], language:string, topLevelName:string, rendererOptions?:Record<string,string|boolean>, inferMaps?:boolean, inferEnums?:boolean, inferDateTimes?:boolean, allPropertiesOptional?:boolean}} request
 * @param {{typescriptToSchema?:(sources:{name:string,text:string}[])=>Promise<string>|string}} [hooks]
 */
export async function generate(request, hooks = {}) {
    const problems = validateRequest(request);
    if (problems.length > 0) return { ok: false, problems };
    const started = Date.now();
    const { kind, sources, language, topLevelName } = request;
    const inputData = new InputData();
    try {
        if (kind === "json") {
            const input = jsonInputForTargetLanguage(language);
            for (const s of sources) {
                await input.addSource({
                    name: topLevelName,
                    samples: [s.text],
                });
            }
            inputData.addInput(input);
        } else if (kind === "schema" || kind === "typescript") {
            let schemaText;
            if (kind === "typescript") {
                if (!hooks.typescriptToSchema) {
                    return {
                        ok: false,
                        problems: [{ code: "typescript.needsHost" }],
                    };
                }
                schemaText = await hooks.typescriptToSchema(
                    sources.map((s, i) => ({
                        name: s.name ?? `input${i}.ts`,
                        text: s.text,
                    })),
                );
            }
            const input = new JSONSchemaInput(new FetchingJSONSchemaStore());
            if (kind === "typescript") {
                await input.addSource({
                    name: topLevelName,
                    schema: schemaText,
                });
            } else {
                for (const s of sources)
                    await input.addSource({
                        name: topLevelName,
                        schema: s.text,
                    });
            }
            inputData.addInput(input);
        } else if (kind === "graphql") {
            const { GraphQLInput } = await import("quicktype-graphql-input");
            const [schemaSource, ...queries] = sources;
            if (!schemaSource || queries.length === 0) {
                return {
                    ok: false,
                    problems: [{ code: "graphql.needsSchemaAndQuery" }],
                };
            }
            const input = new GraphQLInput();
            const schema = JSON.parse(schemaSource.text);
            for (const q of queries)
                await input.addSource({
                    name: topLevelName,
                    schema,
                    query: q.text,
                });
            inputData.addInput(input);
        }
        const result = await quicktype({
            inputData,
            lang: language,
            rendererOptions: request.rendererOptions ?? {},
            inferMaps: request.inferMaps ?? true,
            inferEnums: request.inferEnums ?? true,
            inferDateTimes: request.inferDateTimes ?? true,
            allPropertiesOptional: request.allPropertiesOptional ?? false,
        });
        return {
            ok: true,
            code: result.lines.join("\n"),
            annotations: result.annotations.map((a) => ({
                message: String(a.annotation?.message ?? a.annotation ?? ""),
            })),
            elapsedMs: Date.now() - started,
        };
    } catch (error) {
        return {
            ok: false,
            problems: [
                {
                    code: "generate.failed",
                    detail:
                        error instanceof Error ? error.message : String(error),
                },
            ],
            elapsedMs: Date.now() - started,
        };
    }
}
