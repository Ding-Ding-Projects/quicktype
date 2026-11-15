// What edition is running, and what the host can do for the interface.

export interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    permissions: string[];
    enabled: boolean;
    builtIn: boolean;
    commands: { id: string; title: string }[];
}

export interface UpdateState {
    state:
        | "idle"
        | "checking"
        | "none"
        | "available"
        | "downloading"
        | "ready"
        | "error"
        | "unsupported";
    version?: string;
    notesUrl?: string;
    detail?: string;
}

export interface DesktopHost {
    edition: "desktop";
    version: string;
    builtAt: string;
    window: { minimize(): void; toggleMaximize(): void; close(): void };
    saveFile(
        name: string,
        text: string,
    ): Promise<{ ok: boolean; path?: string; detail?: string }>;
    generateTypeScript(
        sources: { name: string; text: string }[],
        request: unknown,
    ): Promise<unknown>;
    sharedRecord: {
        read(): Promise<{
            ok: boolean;
            record?: SchoolRecord;
            detail?: string;
        }>;
        write(r: SchoolRecord): Promise<{ ok: boolean; detail?: string }>;
        watch(cb: (r: SchoolRecord) => void): void;
    };
    extensions: {
        list(): Promise<ExtensionInfo[]>;
        setEnabled(
            id: string,
            on: boolean,
            grantedPermissions: string[],
        ): Promise<{ ok: boolean; detail?: string }>;
        run(
            id: string,
            command: string,
            input: string,
        ): Promise<{ ok: boolean; output?: string; detail?: string }>;
        openFolder(): void;
    };
    updates: {
        check(): Promise<UpdateState>;
        onState(cb: (s: UpdateState) => void): void;
        restart(): void;
    };
}

export interface SchoolRecord {
    v: 1;
    on: boolean;
    name: string;
    pinHash: string | null;
    salt: string | null;
}

declare global {
    interface Window {
        studioHost?: DesktopHost;
        __STUDIO_EDITION__?: "web" | "appliance";
    }
}

export const host: DesktopHost | null =
    typeof window !== "undefined" ? (window.studioHost ?? null) : null;

export type Edition = "desktop" | "web" | "appliance" | "browser";

export function edition(): Edition {
    if (host) return "desktop";
    const meta = document
        .querySelector('meta[name="studio-edition"]')
        ?.getAttribute("content");
    if (meta === "appliance" || meta === "browser") return meta;
    return "web";
}

export const BUILD = {
    version:
        (import.meta.env.VITE_STUDIO_VERSION as string | undefined) ?? "24.0.0",
    builtAt:
        (import.meta.env.VITE_STUDIO_BUILT_AT as string | undefined) ??
        new Date().toISOString(),
    commit:
        (import.meta.env.VITE_STUDIO_COMMIT as string | undefined) ?? "local",
    codeName:
        (import.meta.env.VITE_STUDIO_CODENAME as string | undefined) ?? "",
};

export const DESKTOP_DOWNLOAD_URL =
    "https://github.com/Ding-Ding-Projects/quicktype/releases?q=studio&expanded=true";

/** Thrown when an edition has no server to run the TypeScript compiler. */
export const NO_SERVER_MESSAGE =
    "TypeScript input needs the TypeScript compiler, which this page cannot run in your browser. Use the desktop app or the self-hosted container for TypeScript input; every other source kind works here.";

/** Can the server do TypeScript input for the web editions? */
export async function serverGenerate(request: unknown): Promise<unknown> {
    if (edition() === "browser") throw new Error(NO_SERVER_MESSAGE);
    const res = await fetch("api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
    });
    if (!res.ok && res.status !== 422) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
