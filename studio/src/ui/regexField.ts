// A search field that defaults to plain text and carries its own adjacent,
// anchored regex builder. Every search keeps its own independent state.

import { h, icon } from "../lib/dom";
import { t, label } from "../lib/i18n";
import {
    BLOCKS,
    compile,
    displayText,
    emptyQuery,
    fromTyped,
    type Matcher,
    type QueryState,
} from "../lib/regex";
import type { StringKey } from "../lib/strings";

export interface RegexField {
    el: HTMLElement;
    input: HTMLInputElement;
    matcher(): Matcher;
    state(): QueryState;
    focus(): void;
}

let fieldSeq = 0;

export function regexField(
    placeholderKey: StringKey,
    onChange: (m: Matcher) => void,
    opts: { id?: string } = {},
): RegexField {
    let q = emptyQuery();
    const id = opts.id ?? `search-${++fieldSeq}`;
    const input = h("input", {
        id,
        type: "search",
        class: "search-input",
        placeholder: t(placeholderKey),
        "aria-label": t(placeholderKey),
        autocomplete: "off",
        spellcheck: false,
    });
    const status = h("div", { class: "rx-status", "aria-live": "polite" });
    const panel = h("div", {
        class: "rx-panel",
        hidden: true,
        role: "group",
        "aria-label": t("search.builder"),
    });
    const toggle = h(
        "button",
        {
            class: "rx-toggle",
            type: "button",
            "aria-expanded": "false",
            "aria-controls": `${id}-builder`,
            "aria-label": t("search.openBuilder"),
            title: t("search.openBuilder"),
        },
        ".*",
    );
    panel.id = `${id}-builder`;

    const emit = () => {
        const m = compile(q);
        status.textContent = m.ok
            ? ""
            : t("search.invalidPattern", { detail: m.detail });
        status.classList.toggle("bad", !m.ok);
        input.setAttribute("aria-invalid", String(!m.ok));
        onChange(m);
        renderPanel();
    };

    const flag = (key: StringKey, prop: keyof QueryState) => {
        const box = h("input", {
            type: "checkbox",
            checked: Boolean(q[prop]),
            onchange: () => {
                q = { ...q, [prop]: box.checked };
                if (prop === "anchorStart" || prop === "anchorEnd")
                    input.value = displayText(q);
                emit();
            },
        });
        return h("label", { class: "chip-check" }, box, label(key));
    };

    function renderPanel() {
        panel.replaceChildren(
            ...[
                h(
                    "div",
                    {
                        class: "seg",
                        role: "radiogroup",
                        "aria-label": t("search.builder"),
                    },
                    ...(["plain", "regex"] as const).map((mode) =>
                        h(
                            "button",
                            {
                                type: "button",
                                role: "radio",
                                "aria-checked": String(q.mode === mode),
                                class: q.mode === mode ? "on" : "",
                                onclick: () => {
                                    q = { ...q, mode };
                                    input.value = displayText(q);
                                    emit();
                                },
                            },
                            label(
                                mode === "plain"
                                    ? "search.plain"
                                    : "search.regex",
                            ),
                        ),
                    ),
                ),
                h(
                    "div",
                    { class: "rx-flags" },
                    flag("search.ignoreCase", "ignoreCase"),
                    q.mode === "regex"
                        ? [
                              flag("search.multiline", "multiline"),
                              flag("search.unicode", "unicode"),
                              flag("search.anchorStart", "anchorStart"),
                              flag("search.anchorEnd", "anchorEnd"),
                          ]
                        : null,
                ),
                q.mode === "regex"
                    ? h(
                          "div",
                          { class: "rx-blocks" },
                          h(
                              "span",
                              { class: "muted small" },
                              t("search.blocks"),
                          ),
                          ...BLOCKS.map((b) =>
                              h(
                                  "button",
                                  {
                                      type: "button",
                                      class: "token",
                                      onclick: () => {
                                          q = fromTyped(
                                              q,
                                              displayText({ ...q }).replace(
                                                  /\$$/,
                                                  "",
                                              ) +
                                                  b.token +
                                                  (q.anchorEnd ? "$" : ""),
                                          );
                                          input.value = displayText(q);
                                          emit();
                                          input.focus();
                                      },
                                  },
                                  h("code", null, b.token),
                                  " ",
                                  t(b.key),
                              ),
                          ),
                      )
                    : null,
                h(
                    "code",
                    { class: "rx-source" },
                    compile(q).ok
                        ? `/${(compile(q) as { source: string }).source}/`
                        : "",
                ),
            ].filter((x): x is HTMLElement => x !== null),
        );
    }

    input.addEventListener("input", () => {
        q = fromTyped(q, input.value);
        emit();
    });
    toggle.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) renderPanel();
    });
    const el = h(
        "div",
        { class: "rx-field" },
        h("div", { class: "rx-row" }, icon("search", 16), input, toggle),
        status,
        panel,
    );
    renderPanel();
    return {
        el,
        input,
        matcher: () => compile(q),
        state: () => q,
        focus: () => input.focus(),
    };
}
