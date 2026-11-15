// A custom select: a button that opens a keyboard-driven listbox, with an
// optional search box (plain text by default, with its own regex builder).

import { h, icon } from "../lib/dom";
import { regexField } from "./regexField";

export interface Option {
    value: string;
    label: string;
    hint?: string;
    color?: string;
}

let seq = 0;

export function customSelect(opts: {
    value: string;
    options: Option[];
    label: string;
    onChange: (v: string) => void;
    searchable?: boolean;
    placeholder?: string;
}): HTMLButtonElement {
    const id = `sel-${++seq}`;
    const current = opts.options.find((o) => o.value === opts.value);
    const btn = h(
        "button",
        {
            type: "button",
            class: "select-btn",
            "aria-haspopup": "listbox",
            "aria-expanded": "false",
            "aria-label": `${opts.label}: ${current?.label ?? opts.placeholder ?? ""}`,
        },
        current?.color
            ? h("span", {
                  class: "lang-dot",
                  style: { background: current.color },
              })
            : null,
        h("span", { class: "grow" }, current?.label ?? opts.placeholder ?? ""),
        icon("chevron", 14),
    );

    btn.addEventListener("click", () => openList());
    btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
        }
    });

    function openList() {
        document.querySelector(".select-pop")?.remove();
        let match: (s: string) => boolean = () => true;
        let cursor = Math.max(
            0,
            opts.options.findIndex((o) => o.value === opts.value),
        );
        const list = h("div", {
            class: "select-list",
            role: "listbox",
            id,
            "aria-label": opts.label,
            tabindex: -1,
        });
        const pop = h("div", { class: "select-pop surface-pop" });
        const visible = () =>
            opts.options.filter((o) => match(`${o.label} ${o.hint ?? ""}`));
        const close = (focus = true) => {
            pop.remove();
            btn.setAttribute("aria-expanded", "false");
            document.removeEventListener("pointerdown", outside, true);
            if (focus) btn.focus();
        };
        const choose = (o: Option) => {
            close();
            if (o.value !== opts.value) opts.onChange(o.value);
        };
        const draw = () => {
            const v = visible();
            cursor = Math.min(cursor, Math.max(0, v.length - 1));
            list.replaceChildren(
                ...v.map((o, i) =>
                    h(
                        "button",
                        {
                            type: "button",
                            role: "option",
                            id: `${id}-${i}`,
                            class: `select-opt ${i === cursor ? "cursor" : ""}`,
                            "aria-selected": String(o.value === opts.value),
                            tabindex: -1,
                            onclick: () => choose(o),
                        },
                        o.color
                            ? h("span", {
                                  class: "lang-dot",
                                  style: { background: o.color },
                              })
                            : null,
                        h("span", { class: "grow" }, o.label),
                        o.hint
                            ? h("span", { class: "faint small" }, o.hint)
                            : null,
                    ),
                ),
            );
            list.setAttribute("aria-activedescendant", `${id}-${cursor}`);
            list.querySelector(".cursor")?.scrollIntoView({ block: "nearest" });
        };
        const keys = (e: KeyboardEvent) => {
            const v = visible();
            if (e.key === "ArrowDown")
                cursor = Math.min(v.length - 1, cursor + 1);
            else if (e.key === "ArrowUp") cursor = Math.max(0, cursor - 1);
            else if (e.key === "Home") cursor = 0;
            else if (e.key === "End") cursor = v.length - 1;
            else if (e.key === "Enter") {
                if (v[cursor]) choose(v[cursor]);
                e.preventDefault();
                return;
            } else if (e.key === "Escape" || e.key === "Tab") {
                close(e.key === "Escape");
                return;
            } else if (!opts.searchable && e.key.length === 1) {
                const i = v.findIndex((o) =>
                    o.label.toLowerCase().startsWith(e.key.toLowerCase()),
                );
                if (i >= 0) cursor = i;
            } else return;
            e.preventDefault();
            draw();
        };
        const outside = (e: Event) => {
            if (!pop.contains(e.target as Node) && e.target !== btn)
                close(false);
        };
        if (opts.searchable) {
            const search = regexField("palette.placeholder", (m) => {
                match = m.ok ? m.test : () => true;
                cursor = 0;
                draw();
            });
            search.input.setAttribute("aria-label", `Filter ${opts.label}`);
            search.input.placeholder = `Filter ${opts.label.toLowerCase()}`;
            search.input.addEventListener("keydown", keys);
            pop.append(search.el);
            setTimeout(() => search.focus());
        } else {
            list.addEventListener("keydown", keys);
            setTimeout(() => list.focus());
        }
        pop.append(list);
        document.body.appendChild(pop);
        draw();
        const r = btn.getBoundingClientRect();
        const pr = pop.getBoundingClientRect();
        pop.style.minWidth = `${Math.max(220, r.width)}px`;
        pop.style.left = `${Math.min(r.left, window.innerWidth - pr.width - 8)}px`;
        const below = r.bottom + 6 + pr.height < window.innerHeight;
        pop.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - pr.height - 6)}px`;
        btn.setAttribute("aria-expanded", "true");
        setTimeout(() =>
            document.addEventListener("pointerdown", outside, true),
        );
    }
    return btn;
}
