// School mode: one shared switch across every app on this device that
// supports it. A convenience lock, not a security boundary.

import { host, type SchoolRecord } from "./platform";
import { readJSON, writeJSON } from "./store";

const KEY = "shared.school-mode.v1";
const DEFAULT: SchoolRecord = {
    v: 1,
    on: false,
    name: "School mode",
    pinHash: null,
    salt: null,
};

let record: SchoolRecord = DEFAULT;
let readable = true;
const listeners = new Set<(r: SchoolRecord) => void>();

export function current() {
    return record;
}

export function isReadable() {
    return readable;
}

function emit() {
    for (const l of listeners) l(record);
}

export function onChange(l: (r: SchoolRecord) => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

export async function load() {
    if (host) {
        const res = await host.sharedRecord.read();
        readable = res.ok;
        record = res.ok && res.record ? { ...DEFAULT, ...res.record } : DEFAULT;
        host.sharedRecord.watch((r) => {
            record = { ...DEFAULT, ...r };
            emit();
        });
    } else {
        record = { ...DEFAULT, ...(readJSON<SchoolRecord>(KEY) ?? {}) };
        window.addEventListener("storage", (e) => {
            if (e.key === KEY) {
                record = { ...DEFAULT, ...(readJSON<SchoolRecord>(KEY) ?? {}) };
                emit();
            }
        });
    }
    emit();
}

async function save(next: SchoolRecord) {
    record = next;
    if (host) {
        const r = await host.sharedRecord.write(next);
        readable = r.ok;
    } else writeJSON(KEY, next);
    emit();
}

async function hash(pin: string, salt: string) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: new TextEncoder().encode(salt),
            iterations: 120000,
        },
        key,
        256,
    );
    return [...new Uint8Array(bits)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function turnOn(pin: string) {
    const salt = crypto.randomUUID();
    await save({ ...record, on: true, salt, pinHash: await hash(pin, salt) });
}

export async function turnOff(pin: string): Promise<boolean> {
    if (
        record.pinHash &&
        record.salt &&
        (await hash(pin, record.salt)) !== record.pinHash
    )
        return false;
    await save({ ...record, on: false });
    return true;
}

export async function rename(name: string) {
    const clean = name.trim().slice(0, 60);
    if (clean) await save({ ...record, name: clean });
}
