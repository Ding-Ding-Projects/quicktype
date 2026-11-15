// Site behaviour: theme, navigation language, personal wording for the
// navigation, a regex-capable filter and the Ctrl+Shift+F palette.
(() => {
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem("site." + k);
                return v === null ? d : JSON.parse(v);
            } catch {
                return d;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem("site." + k, JSON.stringify(v));
            } catch {
                /* private mode */
            }
        },
        del(k) {
            try {
                localStorage.removeItem("site." + k);
            } catch {
                /* ignore */
            }
        },
    };
    const root = document.body.dataset.root || "./";

    function applyTheme() {
        const t = store.get("theme", "system");
        const dark =
            t === "dark" ||
            (t === "system" &&
                matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.dataset.theme = dark ? "dark" : "light";
    }

    // Strict check of a personal wording file (version 1). Any problem refuses the whole file.
    function parseWording(text) {
        if (new TextEncoder().encode(text).length > 262144)
            throw new Error("the file is larger than 256 KiB");
        const _seen = [];
        const data = JSON.parse(text, (_key, value) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const keys = Object.keys(value);
                if (new Set(keys).size !== keys.length)
                    throw new Error("a key appears twice");
            }
            return value;
        });
        const dup = /"((?:[^"\\]|\\.)*)"\s*:/g;
        const inEntries = new Set();
        let m;
        while ((m = dup.exec(text))) {
            if (
                inEntries.has(m[1]) &&
                m[1] !== "schemaVersion" &&
                m[1] !== "entries"
            )
                throw new Error("a key appears twice");
            inEntries.add(m[1]);
        }
        if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("the file must be a JSON object");
        const keys = Object.keys(data);
        if (
            keys.length !== 2 ||
            !keys.includes("schemaVersion") ||
            !keys.includes("entries")
        )
            throw new Error(
                "the file must contain exactly schemaVersion and entries",
            );
        if (data.schemaVersion !== 1)
            throw new Error("schemaVersion must be 1");
        for (const [k, v] of Object.entries(data.entries || {})) {
            if (["__proto__", "prototype", "constructor"].includes(k))
                throw new Error("a key uses a reserved name");
            if (!k || [...k].length > 160)
                throw new Error("a key is empty or longer than 160 characters");
            if (typeof v !== "string" || [...v].length > 1000)
                throw new Error(
                    "every replacement must be text up to 1,000 characters",
                );
            if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(k + v))
                throw new Error(
                    "a key or replacement contains a control character",
                );
        }
        return data;
    }

    function wordingFor(text) {
        const w = store.get("wording", null);
        if (!w?.entries) return text;
        const keys = Object.keys(w.entries).sort((a, b) => b.length - a.length);
        if (!keys.length) return text;
        const re = new RegExp(
            "(?<![\\p{L}\\p{N}])(?:" +
                keys
                    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                    .join("|") +
                ")(?![\\p{L}\\p{N}])",
            "gu",
        );
        return text.replace(re, (x) => w.entries[x] ?? x);
    }

    function applyNav() {
        const lang = store.get("lang", "en");
        for (const a of document.querySelectorAll(".tab")) {
            const lbl = a.querySelector(".lbl");
            if (!a.dataset.en) a.dataset.en = lbl.textContent;
            const en = wordingFor(a.dataset.en),
                yue = a.dataset.yue;
            lbl.replaceChildren();
            if (lang === "yue") {
                lbl.textContent = yue;
                a.lang = "yue-Hant-HK";
            } else if (lang === "both") {
                lbl.append(en);
                const s = document.createElement("small");
                s.lang = "yue-Hant-HK";
                s.textContent = yue;
                lbl.append(s);
            } else lbl.textContent = en;
        }
    }

    function tone(fact, kind) {
        const lvl = store.get("funEn", 5);
        const wraps = {
            ok: ["{f}.", "{f}.", "Done: {f}.", "Nice. {f}.", "Ta-da! {f}."],
            bad: [
                "{f}.",
                "Problem: {f}.",
                "Hmm, that didn't work. {f}.",
                "Oops. {f}.",
                "Whoops! {f}. Nothing changed.",
            ],
        };
        return wraps[kind][Math.min(4, Math.max(0, lvl - 1))].replace(
            "{f}",
            fact,
        );
    }

    function wireSettings() {
        for (const group of document.querySelectorAll("[data-setting]")) {
            const key = group.dataset.setting;
            if (group.matches("input[type=range]")) {
                group.value = store.get(key, 5);
                group.addEventListener("change", () =>
                    store.set(key, Number(group.value)),
                );
                continue;
            }
            const cur = store.get(key, key === "theme" ? "system" : "en");
            for (const b of group.querySelectorAll("button")) {
                b.setAttribute("aria-checked", String(b.dataset.value === cur));
                b.addEventListener("click", () => {
                    store.set(key, b.dataset.value);
                    for (const x of group.querySelectorAll("button"))
                        x.setAttribute("aria-checked", String(x === b));
                    applyTheme();
                    applyNav();
                });
            }
        }
        const status = document.querySelector(".vocab-status");
        const show = () => {
            if (status) {
                const w = store.get("wording", null);
                status.textContent = w
                    ? "Personal wording is active (" +
                      Object.keys(w.entries).length +
                      " entries)."
                    : "No file loaded. Original wording is in use.";
            }
        };
        show();
        document
            .querySelector("[data-vocab-file]")
            ?.addEventListener("change", async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                try {
                    const d = parseWording(await f.text());
                    store.set("wording", {
                        schemaVersion: 1,
                        entries: d.entries,
                    });
                    status.textContent = tone(
                        "Personal wording applied: " +
                            Object.keys(d.entries).length +
                            " entries",
                        "ok",
                    );
                    applyNav();
                } catch (err) {
                    status.textContent = tone(
                        "The wording file was refused and nothing changed: " +
                            err.message,
                        "bad",
                    );
                }
                e.target.value = "";
            });
        document
            .querySelector("[data-vocab-clear]")
            ?.addEventListener("click", () => {
                store.del("wording");
                show();
                applyNav();
            });
    }

    function matcher(input, toggle, status) {
        const q = input.value;
        const regex = toggle.getAttribute("aria-pressed") === "true";
        if (!q) return () => true;
        if (!regex) {
            const n = q.toLowerCase();
            return (s) => s.toLowerCase().includes(n);
        }
        try {
            const re = new RegExp(q, "iu");
            if (status) status.textContent = "";
            return (s) => re.test(s);
        } catch (e) {
            if (status) status.textContent = "Pattern problem: " + e.message;
            return () => true;
        }
    }

    function wireFilters() {
        for (const box of document.querySelectorAll("[data-filter-target]")) {
            const list = document.querySelector(box.dataset.filterTarget);
            const input = box.querySelector("input"),
                toggle = box.querySelector(".rx-toggle"),
                status = box.querySelector(".rx-status");
            const run = () => {
                const m = matcher(input, toggle, status);
                for (const li of list.children)
                    li.hidden = !m(li.dataset.text || li.textContent);
            };
            input.addEventListener("input", run);
            toggle.addEventListener("click", () => {
                toggle.setAttribute(
                    "aria-pressed",
                    String(toggle.getAttribute("aria-pressed") !== "true"),
                );
                run();
            });
        }
    }

    let index = null;
    async function openPalette() {
        if (document.querySelector("dialog.palette")) return;
        index ??= await fetch(root + "search-index.json")
            .then((r) => r.json())
            .catch(() => []);
        const dlg = document.createElement("dialog");
        dlg.className = "palette";
        dlg.setAttribute("aria-label", "Search the site");
        dlg.innerHTML =
            '<div class="rx-row"><input type="search" aria-label="Search the site" autocomplete="off"><button type="button" class="rx-toggle" aria-pressed="false" title="Use a regular expression">.*</button></div><p class="rx-status" aria-live="polite" style="padding:0 16px"></p><ul role="listbox"></ul>';
        const input = dlg.querySelector("input"),
            toggle = dlg.querySelector(".rx-toggle"),
            ul = dlg.querySelector("ul"),
            status = dlg.querySelector(".rx-status");
        let cursor = 0;
        const draw = () => {
            const m = matcher(input, toggle, status);
            const hits = index
                .filter((e) =>
                    m(e.title + " " + (e.kind || "") + " " + (e.text || "")),
                )
                .slice(0, 40);
            cursor = Math.min(cursor, Math.max(0, hits.length - 1));
            ul.replaceChildren(
                ...hits.map((h, i) => {
                    const li = document.createElement("li");
                    const a = document.createElement("a");
                    a.href = root + h.url;
                    a.setAttribute("role", "option");
                    a.setAttribute("aria-selected", String(i === cursor));
                    const k = document.createElement("small");
                    k.className = "muted";
                    k.textContent = h.kind || "";
                    const t = document.createElement("strong");
                    t.textContent = h.title;
                    a.append(k, t);
                    li.append(a);
                    return li;
                }),
            );
            if (!hits.length) {
                const li = document.createElement("li");
                li.className = "muted";
                li.style.padding = "12px 16px";
                li.textContent = "No matches.";
                ul.append(li);
            }
        };
        input.addEventListener("input", () => {
            cursor = 0;
            draw();
        });
        toggle.addEventListener("click", () => {
            toggle.setAttribute(
                "aria-pressed",
                String(toggle.getAttribute("aria-pressed") !== "true"),
            );
            draw();
        });
        input.addEventListener("keydown", (e) => {
            const links = ul.querySelectorAll("a");
            if (e.key === "ArrowDown") {
                cursor = Math.min(links.length - 1, cursor + 1);
                draw();
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                cursor = Math.max(0, cursor - 1);
                draw();
                e.preventDefault();
            } else if (e.key === "Enter" && links[cursor]) {
                location.href = links[cursor].href;
            }
        });
        dlg.addEventListener("close", () => dlg.remove());
        document.body.append(dlg);
        dlg.showModal();
        draw();
        input.focus();
    }

    applyTheme();
    document.addEventListener("DOMContentLoaded", () => {
        applyNav();
        wireSettings();
        wireFilters();
        document
            .querySelector("[data-open-palette]")
            ?.addEventListener("click", openPalette);
    });
    document.addEventListener("keydown", (e) => {
        if (
            (e.ctrlKey || e.metaKey) &&
            e.shiftKey &&
            e.key.toLowerCase() === "f"
        ) {
            e.preventDefault();
            openPalette();
        }
    });
})();
