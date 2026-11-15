// Runs quicktype off the main thread so typing never stutters.
import { describeLanguages, generate } from "../shared/engine.mjs";

self.onmessage = async (e: MessageEvent) => {
    const { id, type, payload } = e.data as {
        id: number;
        type: string;
        payload: unknown;
    };
    try {
        if (type === "languages")
            (self as unknown as Worker).postMessage({
                id,
                result: describeLanguages(),
            });
        else if (type === "generate")
            (self as unknown as Worker).postMessage({
                id,
                result: await generate(
                    payload as Parameters<typeof generate>[0],
                ),
            });
    } catch (error) {
        (self as unknown as Worker).postMessage({
            id,
            result: {
                ok: false,
                problems: [{ code: "generate.failed", detail: String(error) }],
            },
        });
    }
};
