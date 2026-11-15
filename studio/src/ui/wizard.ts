// First-run setup: real choices that change the app, saved after every step.

import { h, icon, logoMark } from "../lib/dom";
import { label, t } from "../lib/i18n";
import { settings } from "../lib/store";
import { languages } from "../lib/engineClient";
import { SAMPLES } from "../pages/samplesData";
import { setSource } from "../pages/generate";

const STEPS = [
    "wizard.s1",
    "wizard.s2",
    "wizard.s3",
    "wizard.s4",
    "wizard.s5",
] as const;
let onDone: () => void = () => {};

export function setWizardDone(fn: () => void) {
    onDone = fn;
}

export function restartWizard() {
    settings.set({ onboarding: { done: false, step: 0, skipped: [] } }, false);
    showWizard();
}

export function needsWizard() {
    return !settings.get().onboarding.done;
}

export async function showWizard() {
    document.querySelector(".wizard")?.remove();
    const langs = await languages();
    const root = h("div", {
        class: "wizard",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "wizard-heading",
    });
    const draw = () => {
        const s = settings.get();
        const step = s.onboarding.step;
        const go = (n: number, skip = false) => {
            const skipped = skip
                ? [...new Set([...s.onboarding.skipped, STEPS[step]])]
                : s.onboarding.skipped;
            if (n >= STEPS.length) {
                settings.set(
                    {
                        onboarding: {
                            done: true,
                            step: STEPS.length - 1,
                            skipped,
                        },
                    },
                    false,
                );
                root.remove();
                onDone();
                return;
            }
            settings.set(
                { onboarding: { done: false, step: n, skipped } },
                false,
            );
            draw();
            root.querySelector<HTMLElement>("#wizard-heading")?.focus();
        };
        let body: HTMLElement;
        if (step === 0)
            body = h(
                "div",
                { class: "stack", style: "gap:18px" },
                h("p", { class: "lead" }, t("wizard.s1Body")),
                h(
                    "div",
                    { class: "wizard-hero glass" },
                    h(
                        "pre",
                        { class: "code-text", "aria-label": "Sample input" },
                        '{\n  "id": 1,\n  "name": "Bulbasaur",\n  "type": ["Grass"]\n}',
                    ),
                    h(
                        "span",
                        { class: "wizard-arrow", "aria-hidden": "true" },
                        icon("generate", 22),
                    ),
                    h(
                        "pre",
                        {
                            class: "code-text",
                            "aria-label": "Generated TypeScript",
                        },
                        "interface Pokemon {\n  id:   number;\n  name: string;\n  type: string[];\n}",
                    ),
                ),
                h(
                    "div",
                    { class: "wizard-features" },
                    ...[
                        [
                            "generate",
                            "27 languages",
                            "TypeScript, Swift, Kotlin, Rust, Go, C# and more, with serializers.",
                        ],
                        [
                            "json",
                            "A full JSON editor",
                            "Tree, code, split and table views with undo, find and validation.",
                        ],
                        [
                            "pin",
                            "Private by design",
                            "Your data and settings never leave this device.",
                        ],
                    ].map(([ico, title, text]) =>
                        h(
                            "div",
                            { class: "wizard-feature" },
                            icon(ico, 20),
                            h("strong", null, title),
                            h("span", { class: "small muted" }, text),
                        ),
                    ),
                ),
            );
        else if (step === 1)
            body = h(
                "div",
                { class: "stack" },
                h("p", { class: "lead" }, t("wizard.s2Body")),
                h(
                    "div",
                    {
                        class: "wizard-langs",
                        role: "group",
                        "aria-label": t("wizard.s2"),
                    },
                    ...langs.map((l) => {
                        const on = s.favoriteLanguages.includes(l.name);
                        return h(
                            "button",
                            {
                                class: `wizard-lang ${on ? "on" : ""}`,
                                "aria-pressed": String(on),
                                onclick: () => {
                                    settings.set(
                                        {
                                            favoriteLanguages: on
                                                ? s.favoriteLanguages.filter(
                                                      (x) => x !== l.name,
                                                  )
                                                : [
                                                      ...s.favoriteLanguages,
                                                      l.name,
                                                  ],
                                        },
                                        false,
                                    );
                                    draw();
                                },
                            },
                            h(
                                "span",
                                { class: "mono small" },
                                `.${l.extension}`,
                            ),
                            h("strong", null, l.displayName),
                        );
                    }),
                ),
            );
        else if (step === 2)
            body = h(
                "div",
                { class: "stack" },
                h("h3", null, t("set.language")),
                h(
                    "div",
                    {
                        class: "seg wrap",
                        role: "radiogroup",
                        "aria-label": t("set.language"),
                    },
                    ...(["en", "yue", "both"] as const).map((v) =>
                        h(
                            "button",
                            {
                                role: "radio",
                                "aria-checked": String(s.language === v),
                                class: s.language === v ? "on" : "",
                                onclick: () => {
                                    settings.set({ language: v });
                                    draw();
                                },
                            },
                            label(`lang.${v}`),
                        ),
                    ),
                ),
                h("h3", null, t("set.theme")),
                h(
                    "div",
                    {
                        class: "seg wrap",
                        role: "radiogroup",
                        "aria-label": t("set.theme"),
                    },
                    ...(["system", "light", "dark", "contrast"] as const).map(
                        (v) =>
                            h(
                                "button",
                                {
                                    role: "radio",
                                    "aria-checked": String(s.theme === v),
                                    class: s.theme === v ? "on" : "",
                                    onclick: () => {
                                        settings.set({ theme: v });
                                        draw();
                                    },
                                },
                                label(`theme.${v}`),
                            ),
                    ),
                ),
                h("p", { class: "muted small" }, t("set.funHint")),
            );
        else if (step === 3)
            body = h(
                "div",
                { class: "stack" },
                h("p", { class: "lead" }, t("wizard.s4Body")),
                h(
                    "div",
                    { class: "row wrap" },
                    h(
                        "button",
                        {
                            class: "btn primary",
                            onclick: () => {
                                setSource(
                                    "json",
                                    SAMPLES[0].text,
                                    SAMPLES[0].topLevel,
                                );
                                go(4);
                            },
                        },
                        label("wizard.s4Sample"),
                    ),
                    h(
                        "button",
                        {
                            class: "btn",
                            onclick: () => {
                                setSource("json", "{}", "TopLevel");
                                go(4);
                            },
                        },
                        label("wizard.s4Empty"),
                    ),
                ),
            );
        else body = h("p", { class: "lead" }, t("wizard.s5Body"));

        root.replaceChildren(
            h(
                "aside",
                { class: "wizard-side" },
                h(
                    "div",
                    { class: "row" },
                    logoMark(s.logo.preset, s.logo.custom, 34),
                    h("strong", null, s.displayName),
                ),
                h("h2", { class: "display" }, t("wizard.title")),
                h(
                    "ol",
                    { class: "wizard-steps" },
                    ...STEPS.map((k, i) =>
                        h(
                            "li",
                            {
                                class:
                                    i === step
                                        ? "current"
                                        : i < step
                                          ? "done"
                                          : "",
                                "aria-current": i === step ? "step" : undefined,
                            },
                            h(
                                "span",
                                { class: "dot" },
                                i < step ? icon("check", 16) : String(i + 1),
                            ),
                            label(k),
                        ),
                    ),
                ),
                h("p", { class: "small" }, t("wizard.saved")),
            ),
            h(
                "main",
                { class: "wizard-main" },
                h(
                    "p",
                    { class: "eyebrow" },
                    t("wizard.step", { n: step + 1, total: STEPS.length }),
                ),
                h(
                    "h1",
                    { id: "wizard-heading", class: "display", tabindex: -1 },
                    t(STEPS[step]),
                ),
                h(
                    "div",
                    {
                        class: "progress",
                        role: "progressbar",
                        "aria-valuemin": 0,
                        "aria-valuemax": STEPS.length,
                        "aria-valuenow": step + 1,
                    },
                    h("span", {
                        style: `width:${((step + 1) / STEPS.length) * 100}%`,
                    }),
                ),
                body,
                h("div", { class: "grow" }),
                h(
                    "div",
                    { class: "row wrap wizard-nav" },
                    h(
                        "button",
                        {
                            class: "btn",
                            disabled: step === 0,
                            onclick: () => go(step - 1),
                        },
                        label("wizard.back"),
                    ),
                    h("span", { class: "grow" }),
                    step > 0 && step < STEPS.length - 1
                        ? h(
                              "button",
                              {
                                  class: "btn ghost",
                                  onclick: () => go(step + 1, true),
                              },
                              label("wizard.skip"),
                          )
                        : null,
                    h(
                        "button",
                        { class: "btn primary", onclick: () => go(step + 1) },
                        label(
                            step === STEPS.length - 1
                                ? "wizard.finish"
                                : "wizard.next",
                        ),
                    ),
                ),
            ),
        );
    };
    draw();
    document.body.appendChild(root);
    root.querySelector<HTMLElement>("#wizard-heading")?.focus();
}
