// Settings: tabbed sections, each setting with an info button that explains
// what it changes and its default, plus a settings search with a regex builder.

import { h, icon, downloadText, logoMark } from "../lib/dom";
import { label, t, tIn, toneIn } from "../lib/i18n";
import type { StringKey } from "../lib/strings";
import {
    DEFAULT_SETTINGS,
    settings,
    type Schedule,
    type Settings,
} from "../lib/store";
import {
    activeVocabulary,
    applyFile,
    clearWording,
    wordingFacts,
} from "../lib/wording";
import { celebrationHeadline } from "../lib/vocabulary";
import * as school from "../lib/school";
import * as narrator from "../lib/narrator";
import { notify } from "../ui/toast";
import { celebrate } from "../ui/celebrate";
import { superConfirm } from "../ui/confirm";
import { regexField } from "../ui/regexField";
import { customSelect } from "../ui/select";
import { colorSwatch } from "../ui/colorPicker";
import { openLogoEditor } from "../ui/logoEditor";
import { resetAllAppearance } from "../ui/appearance";
import { play } from "../lib/sound";
import { register, type PaletteEntry } from "./registry";
import { checkForUpdates } from "../ui/updates";
import { restartWizard } from "../ui/wizard";

type Section =
    | "general"
    | "language"
    | "appearance"
    | "accessibility"
    | "narrator"
    | "updates"
    | "privacy";
const SECTIONS: Section[] = [
    "general",
    "language",
    "appearance",
    "accessibility",
    "narrator",
    "updates",
    "privacy",
];
const SECTION_ICONS: Record<Section, string> = {
    general: "settings",
    language: "languages",
    appearance: "sun",
    accessibility: "about",
    narrator: "bell",
    updates: "download",
    privacy: "pin",
};
let section: Section = "language";

interface Row {
    section: Section;
    title: StringKey;
    hint?: StringKey;
    explain: string;
    defaultText: string;
    keys: (keyof Settings)[];
    control: () => HTMLElement;
}

function sw(on: boolean, aria: string, onToggle: (v: boolean) => void) {
    return h(
        "button",
        {
            class: `switch ${on ? "on" : ""}`,
            role: "switch",
            "aria-checked": String(on),
            "aria-label": aria,
            onclick: () => onToggle(!on),
        },
        h("span", { class: "knob" }),
    );
}

function radios<T extends string>(
    value: T,
    options: [T, StringKey][],
    aria: string,
    set: (v: T) => void,
) {
    return h(
        "div",
        { class: "seg wrap", role: "radiogroup", "aria-label": aria },
        ...options.map(([v, k]) =>
            h(
                "button",
                {
                    role: "radio",
                    "aria-checked": String(value === v),
                    class: value === v ? "on" : "",
                    onclick: () => set(v),
                },
                label(k),
            ),
        ),
    );
}

export function describeProblem(p: {
    code: string;
    limit?: number;
    at?: number;
}) {
    return t(`vocab.${p.code}` as StringKey, {
        limit: p.limit ?? 0,
        at: p.at ?? 0,
    });
}

export async function loadWordingFile(file: File, viaDrop: boolean) {
    const res = await applyFile(file);
    if (!res.ok) {
        notify("error", "msg.vocabRefused", {
            detail: describeProblem(res.problem),
        });
        return false;
    }
    if (viaDrop) {
        play("celebrate");
        celebrate(
            celebrationHeadline(res.vocabulary) ?? t("celebrate.fallback"),
        );
    }
    notify("success", "msg.vocabApplied", {
        count: Object.keys(res.vocabulary.entries).length,
    });
    return true;
}

function vocabControl() {
    const v = activeVocabulary();
    const facts = wordingFacts();
    const fileInput = h("input", {
        type: "file",
        accept: "application/json,.json",
        class: "visually-hidden",
        id: "vocab-file",
        onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) await loadWordingFile(f, false);
            (e.target as HTMLInputElement).value = "";
        },
    });
    return h(
        "div",
        {
            class: "drop-zone",
            dataset: { el: "settings.vocab" },
            "aria-label": t("set.vocab"),
        },
        h(
            "p",
            { class: "row", role: "status" },
            icon("upload", 20),
            h(
                "strong",
                null,
                v
                    ? t("set.vocabLoaded", {
                          count: Object.keys(v.entries).length,
                      })
                    : t("set.vocabNone"),
            ),
        ),
        v && facts
            ? h(
                  "dl",
                  { class: "vocab-facts" },
                  h("dt", null, "Entries"),
                  h("dd", null, String(facts.entries)),
                  h("dt", null, "Size"),
                  h(
                      "dd",
                      null,
                      `${facts.bytes.toLocaleString()} of 262,144 bytes`,
                  ),
                  h("dt", null, "Longest key"),
                  h("dd", null, `${facts.longestKey} of 160 characters`),
                  h("dt", null, "Longest value"),
                  h("dd", null, `${facts.longestValue} of 1,000 characters`),
                  h("dt", null, "Schema"),
                  h("dd", null, "version 1"),
                  h("dt", null, "Loaded"),
                  h(
                      "dd",
                      null,
                      facts.loadedAt
                          ? new Date(facts.loadedAt).toLocaleString()
                          : "earlier",
                  ),
                  h("dt", null, "Stored"),
                  h("dd", null, "this device only, never exported"),
              )
            : null,
        h(
            "div",
            { class: "row wrap" },
            h(
                "label",
                {
                    class: "btn primary",
                    for: "vocab-file",
                    tabindex: 0,
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInput.click();
                        }
                    },
                },
                icon("upload", 14),
                label(v ? "set.vocabReplace" : "set.vocabChoose"),
            ),
            fileInput,
            h(
                "button",
                {
                    class: "btn",
                    disabled: !v,
                    onclick: () => {
                        clearWording();
                        notify("info", "msg.vocabCleared");
                    },
                },
                label("set.vocabClear"),
            ),
        ),
        h("p", { class: "small faint" }, t("set.vocabLimits")),
    );
}

function schoolControl() {
    const r = school.current();
    const pin = h("input", {
        class: "text-input",
        type: "password",
        inputmode: "numeric",
        autocomplete: "off",
        "aria-label": t("set.schoolPin"),
        placeholder: t("set.schoolPin"),
        style: "width:150px",
    });
    const nameIn = h("input", {
        class: "text-input",
        value: r.name,
        "aria-label": t("set.schoolRename"),
        style: "width:160px",
    });
    return h(
        "div",
        { class: "stack" },
        !school.isReadable()
            ? h(
                  "p",
                  { class: "bad small" },
                  "The shared record cannot be read or watched on this device, so this switch may not match other apps.",
              )
            : null,
        h(
            "div",
            { class: "row wrap" },
            pin,
            sw(r.on, r.name, async (on) => {
                if (on) {
                    if (pin.value.length < 4) {
                        notify("warning", "msg.wrongPin", { name: r.name });
                        return;
                    }
                    await school.turnOn(pin.value);
                    notify("info", "msg.schoolOn", { name: r.name });
                } else if (await school.turnOff(pin.value))
                    notify("info", "msg.schoolOff", { name: r.name });
                else notify("error", "msg.wrongPin", { name: r.name });
            }),
            h(
                "span",
                { class: "small muted" },
                r.on ? "On everywhere" : "Off everywhere",
            ),
        ),
        h(
            "div",
            { class: "row wrap" },
            nameIn,
            h(
                "button",
                {
                    class: "btn small",
                    onclick: () => void school.rename(nameIn.value),
                },
                label("set.schoolRename"),
            ),
        ),
        h(
            "p",
            { class: "small faint", style: "margin:0" },
            "Use a PIN of at least 4 digits. It is stored only as a salted hash.",
        ),
    );
}

function voicePicker(lang: "en" | "yue") {
    const n = settings.get().narrator;
    const voices = narrator.voicesFor(lang);
    const st = narrator.voiceStatus(lang);
    const status =
        st.kind === "none"
            ? t("set.voiceNone")
            : st.kind === "missing"
              ? t("set.voiceMissing")
              : st.kind === "online"
                ? `${st.label}. This voice needs the network.`
                : `Speaking with ${st.label ?? ""}`;
    return h(
        "div",
        { class: "stack" },
        customSelect({
            value: (lang === "en" ? n.voiceEn : n.voiceYue) || "",
            label: t(lang === "en" ? "set.voiceEn" : "set.voiceYue"),
            searchable: voices.length > 8,
            options: [
                { value: "", label: t("set.voiceAuto") },
                ...voices.map((v) => ({ value: v.id, label: v.label })),
            ],
            onChange: (v) =>
                settings.set({
                    narrator: {
                        ...n,
                        [lang === "en" ? "voiceEn" : "voiceYue"]: v,
                    },
                }),
        }),
        h(
            "p",
            { class: "small muted", role: "status", style: "margin:0" },
            status,
        ),
    );
}

function schedulesControl() {
    const s = settings.get();
    const update = (list: Schedule[]) => settings.set({ schedules: list });
    const values: Record<Schedule["key"], string[]> = {
        theme: ["dark", "light", "contrast", "system"],
        language: ["en", "yue", "both"],
        density: ["comfortable", "compact"],
    };
    return h(
        "div",
        { class: "stack" },
        ...s.schedules.map((r) => {
            const upd = (patch: Partial<Schedule>) =>
                update(
                    s.schedules.map((x) =>
                        x.id === r.id ? { ...x, ...patch } : x,
                    ),
                );
            const from = h("input", {
                class: "text-input mono",
                type: "time",
                value: r.from,
                "aria-label": "From",
                onchange: (e: Event) =>
                    upd({ from: (e.target as HTMLInputElement).value }),
            });
            const to = h("input", {
                class: "text-input mono",
                type: "time",
                value: r.to,
                "aria-label": "Until",
                onchange: (e: Event) =>
                    upd({ to: (e.target as HTMLInputElement).value }),
            });
            return h(
                "div",
                { class: "schedule-row" },
                from,
                to,
                customSelect({
                    value: r.key,
                    label: "Setting",
                    options: [
                        { value: "theme", label: "Theme" },
                        { value: "language", label: "Language" },
                        { value: "density", label: "Density" },
                    ],
                    onChange: (v) =>
                        upd({
                            key: v as Schedule["key"],
                            value: values[v as Schedule["key"]][0],
                        }),
                }),
                customSelect({
                    value: r.value,
                    label: "Value",
                    options: values[r.key].map((v) => ({ value: v, label: v })),
                    onChange: (v) => upd({ value: v }),
                }),
                h(
                    "button",
                    {
                        class: "icon-btn",
                        "aria-label": "Remove schedule",
                        onclick: () =>
                            update(s.schedules.filter((x) => x.id !== r.id)),
                    },
                    icon("trash", 14),
                ),
            );
        }),
        h(
            "div",
            { class: "row" },
            h(
                "button",
                {
                    class: "btn small",
                    onclick: () =>
                        update([
                            ...s.schedules,
                            {
                                id: crypto.randomUUID(),
                                from: "20:00",
                                to: "07:00",
                                key: "theme",
                                value: "dark",
                                enabled: true,
                            },
                        ]),
                },
                icon("plus", 14),
                "Add a schedule",
            ),
        ),
        h(
            "p",
            { class: "small faint", style: "margin:0" },
            "While a schedule is active it overrides the setting; outside its hours your own choice returns. Times use this device's clock.",
        ),
    );
}

function logoControl() {
    const s = settings.get();
    return h(
        "div",
        { class: "row wrap" },
        ...["brace", "sunset", "mint", "ink"].map((p) =>
            h(
                "button",
                {
                    class: `logo-choice ${s.logo.preset === p && !s.logo.custom ? "on" : ""}`,
                    "aria-pressed": String(
                        s.logo.preset === p && !s.logo.custom,
                    ),
                    "aria-label": `Logo preset ${p}`,
                    onclick: () =>
                        settings.set({ logo: { preset: p, custom: null } }),
                },
                logoMark(p, null, 32),
            ),
        ),
        s.logo.custom
            ? h(
                  "span",
                  {
                      class: "logo-choice on",
                      "aria-label": "Custom logo in use",
                  },
                  logoMark("brace", s.logo.custom, 32),
              )
            : null,
        h(
            "button",
            { class: "btn", onclick: openLogoEditor },
            icon("upload", 14),
            label("set.logoUpload"),
        ),
        h(
            "button",
            {
                class: "btn",
                disabled: !s.logo.custom && s.logo.preset === "brace",
                onclick: () =>
                    settings.set({ logo: { preset: "brace", custom: null } }),
            },
            label("set.logoReset"),
        ),
    );
}

function funSlider(key: "funEn" | "funYue", lang: "en" | "yue") {
    const value = settings.get()[key];
    const sample = toneIn(
        lang,
        "error",
        tIn(lang, "msg.generateFailed", {
            detail:
                lang === "en"
                    ? "line 4 has a trailing comma"
                    : "第 4 行多咗個逗號",
        }),
    );
    return h(
        "div",
        { class: "stack", style: "min-width: 320px" },
        h(
            "div",
            { class: "row" },
            h("input", {
                type: "range",
                min: 1,
                max: 5,
                step: 1,
                value,
                style: "flex:1",
                "aria-label": t(key === "funEn" ? "set.funEn" : "set.funYue"),
                "aria-valuetext": `${value} of 5`,
                onchange: (e: Event) =>
                    settings.set({
                        [key]: Number((e.target as HTMLInputElement).value),
                    } as Partial<Settings>),
            }),
            h("span", { class: "chiplet accent" }, `${value} / 5`),
            h(
                "button",
                {
                    class: "btn small",
                    disabled: value === 5,
                    onclick: () =>
                        settings.set({ [key]: 5 } as Partial<Settings>),
                },
                label("set.resetOne"),
            ),
        ),
        h(
            "p",
            {
                class: "sample-line",
                lang: lang === "yue" ? "yue-Hant-HK" : "en",
            },
            sample,
        ),
    );
}

export function rows(): Row[] {
    const s = settings.get();
    const schoolOn = school.current().on;
    const all: (Row | false)[] = [
        {
            section: "general",
            title: "set.displayName",
            explain:
                "The name shown in the title bar, the window title and About. It never changes the installed app's identity.",
            defaultText: DEFAULT_SETTINGS.displayName,
            keys: ["displayName"],
            control: () =>
                h("input", {
                    class: "text-input",
                    value: s.displayName,
                    "aria-label": t("set.displayName"),
                    onchange: (e: Event) =>
                        settings.set({
                            displayName:
                                (e.target as HTMLInputElement).value.slice(
                                    0,
                                    60,
                                ) || DEFAULT_SETTINGS.displayName,
                        }),
                }),
        },
        {
            section: "general",
            title: "set.dimSum",
            explain:
                "Every so often after a generation, a notification suggests a dim sum dish. It never interrupts what you are doing.",
            defaultText: "On",
            keys: ["dimSum"],
            control: () =>
                sw(s.dimSum, t("set.dimSum"), (v) =>
                    settings.set({ dimSum: v }),
                ),
        },
        {
            section: "general",
            title: "set.onboardingAgain",
            explain:
                "Opens the five-step first-run setup again. Your current choices are kept as the starting point.",
            defaultText: "Runs once on first start",
            keys: ["onboarding"],
            control: () =>
                h(
                    "button",
                    { class: "btn", onclick: restartWizard },
                    label("set.onboardingAgain"),
                ),
        },
        {
            section: "general",
            title: "set.schedules" as StringKey,
            explain:
                "Switch the theme, language or density automatically at set times of day, for example a dark theme in the evening.",
            defaultText: "No schedules",
            keys: ["schedules"],
            control: schedulesControl,
        },
        !schoolOn && {
            section: "language",
            title: "set.language",
            hint: "set.bilingualHint",
            explain:
                "Changes every label and message. Code, file names and your data are never translated.",
            defaultText: "English",
            keys: ["language"],
            control: () =>
                radios(
                    s.language,
                    [
                        ["en", "lang.en"],
                        ["yue", "lang.yue"],
                        ["both", "lang.both"],
                    ],
                    t("set.language"),
                    (v) => settings.set({ language: v }),
                ),
        },
        {
            section: "language",
            title: "set.emoji",
            hint: "set.emojiHint",
            explain:
                "Adds a small decorative emoji to notifications and dialogs. The words never change, and buttons and labels never get one.",
            defaultText: "On",
            keys: ["emojiInDialogs"],
            control: () =>
                sw(s.emojiInDialogs, t("set.emoji"), (v) =>
                    settings.set({ emojiInDialogs: v }),
                ),
        },
        !schoolOn && {
            section: "language",
            title: "set.funEn",
            hint: "set.funHint",
            explain:
                "Level 1 is fully serious; level 5 is the most playful. The facts in every message stay the same at every level.",
            defaultText: "5",
            keys: ["funEn"],
            control: () => funSlider("funEn", "en"),
        },
        !schoolOn && {
            section: "language",
            title: "set.funYue",
            explain:
                "The same, for Cantonese messages. The two languages are set independently.",
            defaultText: "5",
            keys: ["funYue"],
            control: () => funSlider("funYue", "yue"),
        },
        !schoolOn && {
            section: "language",
            title: "set.vocab",
            hint: "set.vocabHint",
            explain:
                "Replaces the app's own words with yours from a version 1 personal vocabulary file. Code and your data are never changed.",
            defaultText: "No file",
            keys: [],
            control: vocabControl,
        },
        {
            section: "language",
            title: "set.school",
            hint: "set.schoolHint",
            explain:
                "One switch shared by every app on this device that supports it. It needs a PIN to turn off.",
            defaultText: "Off",
            keys: [],
            control: schoolControl,
        },
        {
            section: "appearance",
            title: "set.theme",
            explain:
                "Midnight is the dark default. Light suits bright rooms; high contrast uses pure black and white with a yellow accent.",
            defaultText: "Dark",
            keys: ["theme"],
            control: () =>
                radios(
                    s.theme,
                    [
                        ["dark", "theme.dark"],
                        ["light", "theme.light"],
                        ["contrast", "theme.contrast"],
                        ["system", "theme.system"],
                    ],
                    t("set.theme"),
                    (v) => settings.set({ theme: v }),
                ),
        },
        {
            section: "appearance",
            title: "set.accent",
            explain:
                "The colour of the active tab, primary buttons, switches and focus rings. Any colour works; HEX, RGB, HSL and OKLCH can all be typed.",
            defaultText: DEFAULT_SETTINGS.accent,
            keys: ["accent"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    colorSwatch(s.accent, t("set.accent"), (v) =>
                        settings.set({ accent: v }),
                    ),
                    h("code", { class: "chiplet" }, s.accent),
                    h(
                        "button",
                        {
                            class: "btn small",
                            onclick: () =>
                                settings.set({
                                    accent: DEFAULT_SETTINGS.accent,
                                }),
                        },
                        label("set.resetOne"),
                    ),
                ),
        },
        {
            section: "appearance",
            title: "set.density",
            explain:
                "Compact tightens the gaps between panels so more fits on small screens.",
            defaultText: "Comfortable",
            keys: ["density"],
            control: () =>
                radios(
                    s.density,
                    [
                        ["comfortable", "density.comfortable"],
                        ["compact", "density.compact"],
                    ],
                    t("set.density"),
                    (v) => settings.set({ density: v }),
                ),
        },
        {
            section: "appearance",
            title: "tabs.dock",
            explain:
                "Which edge of the window holds the tab strip. Left fits the most tabs legibly.",
            defaultText: "Left",
            keys: ["dock"],
            control: () =>
                radios(
                    s.dock,
                    [
                        ["left", "dock.left"],
                        ["right", "dock.right"],
                        ["top", "dock.top"],
                        ["bottom", "dock.bottom"],
                    ],
                    t("tabs.dock"),
                    (v) => settings.set({ dock: v }),
                ),
        },
        {
            section: "appearance",
            title: "set.logo",
            explain:
                "Pick a shipped logo or make one from your own image with crop, zoom and background controls. It changes the picture only.",
            defaultText: "Lime brace",
            keys: ["logo"],
            control: logoControl,
        },
        {
            section: "appearance",
            title: "set.resetAppearance" as StringKey,
            explain:
                "Removes every per-element and per-tab appearance change at once. Right-click any panel and choose Edit appearance to restyle one.",
            defaultText: "No element changes",
            keys: ["elementStyles"],
            control: () =>
                h(
                    "button",
                    {
                        class: "btn",
                        disabled: Object.keys(s.elementStyles).length === 0,
                        onclick: resetAllAppearance,
                    },
                    `Reset ${Object.keys(s.elementStyles).length} element changes`,
                ),
        },
        {
            section: "accessibility",
            title: "set.textScale",
            explain: "Scales every piece of text and the controls around it.",
            defaultText: "100%",
            keys: ["textScale"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    h("input", {
                        type: "range",
                        min: 0.85,
                        max: 1.6,
                        step: 0.05,
                        value: s.textScale,
                        "aria-label": t("set.textScale"),
                        "aria-valuetext": `${Math.round(s.textScale * 100)}%`,
                        onchange: (e: Event) =>
                            settings.set({
                                textScale: Number(
                                    (e.target as HTMLInputElement).value,
                                ),
                            }),
                    }),
                    h(
                        "span",
                        { class: "chiplet" },
                        `${Math.round(s.textScale * 100)}%`,
                    ),
                ),
        },
        {
            section: "accessibility",
            title: "set.motion",
            explain:
                "Turns off animations, including the celebration headline, which becomes a simple notice.",
            defaultText: "Match system",
            keys: ["reducedMotion"],
            control: () =>
                radios(
                    s.reducedMotion,
                    [
                        ["system", "motion.system"],
                        ["on", "motion.on"],
                        ["off", "motion.off"],
                    ],
                    t("set.motion"),
                    (v) => settings.set({ reducedMotion: v }),
                ),
        },
        {
            section: "accessibility",
            title: "set.adhdFocus",
            explain: "Dims every panel except the one you are working in.",
            defaultText: "Off",
            keys: ["adhd"],
            control: () =>
                sw(s.adhd.focus, t("set.adhdFocus"), (v) =>
                    settings.set({ adhd: { ...s.adhd, focus: v } }),
                ),
        },
        {
            section: "accessibility",
            title: "set.adhdChunk",
            explain: "Long forms show one step at a time.",
            defaultText: "Off",
            keys: ["adhd"],
            control: () =>
                sw(s.adhd.chunked, t("set.adhdChunk"), (v) =>
                    settings.set({ adhd: { ...s.adhd, chunked: v } }),
                ),
        },
        {
            section: "accessibility",
            title: "set.adhdTimer" as StringKey,
            explain:
                "Shows a focus timer in the title bar. It counts down quietly and tells you when time is up.",
            defaultText: "Off, 25 minutes",
            keys: ["adhd", "focusMinutes"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    sw(s.adhd.timers, "Focus timer", (v) =>
                        settings.set({ adhd: { ...s.adhd, timers: v } }),
                    ),
                    h("input", {
                        class: "text-input mono",
                        type: "number",
                        min: 5,
                        max: 120,
                        value: s.focusMinutes,
                        style: "width:80px",
                        "aria-label": "Minutes",
                        onchange: (e: Event) =>
                            settings.set({
                                focusMinutes: Math.min(
                                    120,
                                    Math.max(
                                        5,
                                        Number(
                                            (e.target as HTMLInputElement)
                                                .value,
                                        ) || 25,
                                    ),
                                ),
                            }),
                    }),
                    h("span", { class: "small muted" }, "minutes"),
                ),
        },
        {
            section: "narrator",
            title: "set.sounds",
            explain:
                "Short synthesized sounds for success, errors and taps. No audio files are used.",
            defaultText: "On",
            keys: ["sounds"],
            control: () =>
                sw(s.sounds, t("set.sounds"), (v) =>
                    settings.set({ sounds: v }),
                ),
        },
        {
            section: "narrator",
            title: "set.narrator",
            explain:
                "Reads app events aloud using your device's voices. Lines never overlap, and errors are always read.",
            defaultText: "Off",
            keys: ["narrator"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    sw(s.narrator.on, t("set.narrator"), (v) =>
                        settings.set({ narrator: { ...s.narrator, on: v } }),
                    ),
                    h(
                        "button",
                        {
                            class: "btn small",
                            disabled: !narrator.available(),
                            onclick: () =>
                                narrator.narrate(
                                    "test",
                                    "quicktype Studio narrator test.",
                                    "quicktype Studio 旁白測試。",
                                    true,
                                ),
                        },
                        icon("play", 12),
                        label("set.test"),
                    ),
                ),
        },
        {
            section: "narrator",
            title: "set.narratorLang",
            explain:
                "Both reads the English line first, then the Cantonese line.",
            defaultText: "English",
            keys: ["narrator"],
            control: () =>
                radios(
                    s.narrator.lang,
                    [
                        ["en", "lang.en"],
                        ["yue", "lang.yue"],
                        ["both", "lang.both"],
                    ],
                    t("set.narratorLang"),
                    (v) =>
                        settings.set({ narrator: { ...s.narrator, lang: v } }),
                ),
        },
        {
            section: "narrator",
            title: "set.voiceEn",
            explain:
                "Any English voice installed on this device. Your choice is kept even if the voice is removed later.",
            defaultText: "Choose automatically",
            keys: ["narrator"],
            control: () => voicePicker("en"),
        },
        {
            section: "narrator",
            title: "set.voiceYue",
            explain: "Any Cantonese voice installed on this device.",
            defaultText: "Choose automatically",
            keys: ["narrator"],
            control: () => voicePicker("yue"),
        },
        {
            section: "narrator",
            title: "set.rate",
            explain: "How fast the narrator speaks.",
            defaultText: "1.0",
            keys: ["narrator"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    h("input", {
                        type: "range",
                        min: 0.5,
                        max: 2,
                        step: 0.1,
                        value: s.narrator.rate,
                        "aria-label": t("set.rate"),
                        onchange: (e: Event) =>
                            settings.set({
                                narrator: {
                                    ...s.narrator,
                                    rate: Number(
                                        (e.target as HTMLInputElement).value,
                                    ),
                                },
                            }),
                    }),
                    h("span", { class: "chiplet" }, s.narrator.rate.toFixed(1)),
                ),
        },
        {
            section: "narrator",
            title: "set.pitch",
            explain: "How high or low the narrator sounds.",
            defaultText: "1.0",
            keys: ["narrator"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    h("input", {
                        type: "range",
                        min: 0,
                        max: 2,
                        step: 0.1,
                        value: s.narrator.pitch,
                        "aria-label": t("set.pitch"),
                        onchange: (e: Event) =>
                            settings.set({
                                narrator: {
                                    ...s.narrator,
                                    pitch: Number(
                                        (e.target as HTMLInputElement).value,
                                    ),
                                },
                            }),
                    }),
                    h(
                        "span",
                        { class: "chiplet" },
                        s.narrator.pitch.toFixed(1),
                    ),
                ),
        },
        {
            section: "updates",
            title: "set.autoUpdate",
            explain:
                "Checks at start and every few hours, downloads in the background and asks before restarting. Updates are not code-signed.",
            defaultText: "On",
            keys: ["updates"],
            control: () =>
                sw(s.updates.auto, t("set.autoUpdate"), (v) =>
                    settings.set({ updates: { auto: v } }),
                ),
        },
        {
            section: "updates",
            title: "set.checkNow",
            explain: "Checks right now and tells you the result.",
            defaultText: "",
            keys: [],
            control: () =>
                h(
                    "button",
                    { class: "btn", onclick: () => void checkForUpdates(true) },
                    label("set.checkNow"),
                ),
        },
        {
            section: "privacy",
            title: "set.export",
            explain:
                "Saves your settings as JSON. Personal wording and custom logos are never included.",
            defaultText: "",
            keys: [],
            control: () =>
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: () => {
                            const { elementStyles, logo, ...rest } =
                                settings.get();
                            downloadText(
                                "quicktype-studio-settings.json",
                                JSON.stringify(
                                    {
                                        note: "Personal wording data is never included.",
                                        settings: {
                                            ...rest,
                                            elementStyles,
                                            logo: {
                                                preset: logo.preset,
                                                custom: null,
                                            },
                                        },
                                    },
                                    null,
                                    2,
                                ),
                                "application/json",
                            );
                            notify("success", "msg.exported", {
                                file: "quicktype-studio-settings.json",
                            });
                        },
                    },
                    icon("download", 14),
                    label("set.export"),
                ),
        },
        {
            section: "privacy",
            title: "set.import",
            explain:
                "Loads a settings file exported from this app. Unknown keys are ignored.",
            defaultText: "",
            keys: [],
            control: () => {
                const inp = h("input", {
                    type: "file",
                    accept: ".json,application/json",
                    class: "visually-hidden",
                    id: "settings-import",
                    onchange: async (e: Event) => {
                        const f = (e.target as HTMLInputElement).files?.[0];
                        if (!f || f.size > 512 * 1024) return;
                        try {
                            const data = JSON.parse(await f.text()) as {
                                settings?: Partial<Settings>;
                            };
                            settings.set(
                                Object.fromEntries(
                                    Object.entries(data.settings ?? {}).filter(
                                        ([k]) =>
                                            k in DEFAULT_SETTINGS && k !== "v",
                                    ),
                                ) as Partial<Settings>,
                            );
                            notify("success", "msg.converted", {
                                from: f.name,
                                to: t("settings.title"),
                            });
                        } catch (err) {
                            notify("error", "msg.convertFailed", {
                                detail: String(err),
                            });
                        }
                    },
                });
                return h(
                    "label",
                    { class: "btn", for: "settings-import", tabindex: 0 },
                    icon("upload", 14),
                    label("set.import"),
                    inp,
                );
            },
        },
        {
            section: "privacy",
            title: "set.wipe",
            hint: "set.wipeHint",
            explain:
                "Deletes every setting, the history, the JSON editor document and the wording cache from this device. It asks twice.",
            defaultText: "",
            keys: [],
            control: () =>
                h(
                    "button",
                    {
                        class: "btn danger",
                        onclick: async () => {
                            if (!(await superConfirm(t("set.wipe")))) return;
                            localStorage.clear();
                            location.reload();
                        },
                    },
                    icon("trash", 14),
                    label("set.wipe"),
                ),
        },
    ];
    return all.filter(Boolean) as Row[];
}

function rowEl(r: Row) {
    const tip = h(
        "div",
        { class: "toggletip", hidden: true, role: "note" },
        r.explain,
        r.defaultText
            ? h(
                  "span",
                  { class: "block setting-default", style: "margin-top:4px" },
                  `Default: ${r.defaultText}`,
              )
            : null,
    );
    const info = h(
        "button",
        {
            type: "button",
            class: "info-btn",
            "aria-label": `About ${t(r.title)}`,
            "aria-expanded": "false",
            onclick: () => {
                tip.hidden = !tip.hidden;
                info.setAttribute("aria-expanded", String(!tip.hidden));
            },
        },
        icon("info", 14),
    );
    return h(
        "div",
        {
            class: "setting-row",
            dataset: { el: `setting.${r.title}` },
            "aria-label": t(r.title),
        },
        h(
            "div",
            { class: "setting-text" },
            h("h3", null, label(r.title), info),
            r.hint ? h("p", { class: "muted small" }, t(r.hint)) : null,
        ),
        h("div", { class: "setting-control" }, r.control()),
        tip,
    );
}

register({
    id: "settings",
    labelKey: "tab.settings",
    icon: "settings",
    render: (ctx) => {
        let match: ((s: string) => boolean) | null = null;
        const all = rows();
        const body = h("div", {
            class: "settings-body",
            role: "tabpanel",
            id: "settings-panel",
            "aria-labelledby": `stab-${section}`,
        });
        const draw = () => {
            const visible = all.filter((r) =>
                match
                    ? match(
                          `${t(r.title)} ${r.hint ? t(r.hint) : ""} ${r.explain}`,
                      )
                    : r.section === section,
            );
            body.replaceChildren(
                ...visible.map(rowEl),
                ...(visible.length === 0
                    ? [h("p", { class: "muted pad" }, t("palette.nothing"))]
                    : []),
            );
        };
        const search = regexField(
            "settings.search",
            (m) => {
                match = m.ok && m.source !== "" ? m.test : null;
                draw();
            },
            { id: "settings-search" },
        );
        draw();
        const tabs = h(
            "div",
            {
                class: "subtabs",
                role: "tablist",
                "aria-orientation": "vertical",
                "aria-label": t("settings.title"),
            },
            ...SECTIONS.map((sec) =>
                h(
                    "button",
                    {
                        role: "tab",
                        id: `stab-${sec}`,
                        "aria-selected": String(section === sec),
                        "aria-controls": "settings-panel",
                        tabindex: section === sec ? 0 : -1,
                        class: section === sec ? "on" : "",
                        onclick: () => {
                            section = sec;
                            ctx.rerender();
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            const i = SECTIONS.indexOf(sec);
                            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                e.preventDefault();
                                section =
                                    SECTIONS[
                                        (i +
                                            (e.key === "ArrowDown" ? 1 : -1) +
                                            SECTIONS.length) %
                                            SECTIONS.length
                                    ];
                                ctx.rerender();
                                requestAnimationFrame(() =>
                                    document
                                        .getElementById(`stab-${section}`)
                                        ?.focus(),
                                );
                            }
                        },
                    },
                    icon(SECTION_ICONS[sec], 16),
                    label(`sec.${sec}` as StringKey),
                    h(
                        "span",
                        { class: "count" },
                        String(all.filter((r) => r.section === sec).length),
                    ),
                ),
            ),
            h("div", { style: "height:8px" }),
            h(
                "button",
                {
                    onclick: async () => {
                        if (await superConfirm(t("settings.resetAll"), "RESET"))
                            settings.reset();
                    },
                },
                icon("undo", 16),
                label("settings.resetAll"),
            ),
        );
        return h(
            "div",
            { class: "page" },
            h(
                "div",
                { class: "page-head" },
                h("h1", { class: "display grow" }, t("settings.title")),
                search.el,
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: () => {
                            const keys = [
                                ...new Set(
                                    all
                                        .filter((r) => r.section === section)
                                        .flatMap((r) => r.keys),
                                ),
                            ];
                            settings.reset(keys);
                            notify("info", "msg.settingsReset", {
                                section: t(`sec.${section}` as StringKey),
                            });
                        },
                    },
                    icon("undo", 14),
                    label("settings.reset"),
                ),
            ),
            h("div", { class: "settings-layout" }, tabs, body),
        );
    },
    paletteEntries: (): PaletteEntry[] =>
        rows().map((r) => ({
            group: "settings",
            title: t(r.title),
            detail: `${t("tab.settings")}, ${t(`sec.${r.section}` as StringKey)}`,
            keywords: r.explain,
            control: r.control,
            run: () => {
                section = r.section;
            },
        })),
});
