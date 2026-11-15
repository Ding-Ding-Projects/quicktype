import { host, serverGenerate, edition } from "./platform";

export interface LanguageInfo {
    name: string;
    names: string[];
    displayName: string;
    extension: string;
    options: {
        name: string;
        description: string;
        type: string;
        kind: string;
        defaultValue: unknown;
        values?: string[];
    }[];
}

export interface GenerateRequest {
    kind: "json" | "schema" | "graphql" | "typescript";
    sources: { name?: string; text: string }[];
    language: string;
    topLevelName: string;
    rendererOptions?: Record<string, string | boolean>;
    inferMaps?: boolean;
    inferEnums?: boolean;
    inferDateTimes?: boolean;
    allPropertiesOptional?: boolean;
}

export type GenerateResult =
    | {
          ok: true;
          code: string;
          elapsedMs: number;
          annotations: { message: string }[];
      }
    | {
          ok: false;
          problems: {
              code: string;
              detail?: string;
              value?: string;
              limit?: number;
          }[];
          elapsedMs?: number;
      };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (v: unknown) => void>();

function w() {
    if (!worker) {
        worker = new Worker(new URL("../worker.ts", import.meta.url), {
            type: "module",
        });
        worker.onmessage = (e) => {
            const { id, result } = e.data as { id: number; result: unknown };
            pending.get(id)?.(result);
            pending.delete(id);
        };
    }
    return worker;
}

function call<T>(type: string, payload?: unknown): Promise<T> {
    const id = ++seq;
    return new Promise((resolve) => {
        pending.set(id, resolve as (v: unknown) => void);
        w().postMessage({ id, type, payload });
    });
}

let languagesCache: Promise<LanguageInfo[]> | null = null;
export function languages() {
    languagesCache ??= call<LanguageInfo[]>("languages");
    return languagesCache;
}

export async function generate(req: GenerateRequest): Promise<GenerateResult> {
    if (req.kind === "typescript") {
        // TypeScript input needs the TypeScript compiler, which lives in the host.
        try {
            if (host)
                return (await host.generateTypeScript(
                    req.sources.map((s, i) => ({
                        name: s.name ?? `input${i}.ts`,
                        text: s.text,
                    })),
                    req,
                )) as GenerateResult;
            if (edition() !== "desktop")
                return (await serverGenerate(req)) as GenerateResult;
        } catch (e) {
            return {
                ok: false,
                problems: [
                    {
                        code: "generate.failed",
                        detail: e instanceof Error ? e.message : String(e),
                    },
                ],
            };
        }
    }
    return call<GenerateResult>("generate", req);
}
