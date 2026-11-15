import { h, icon, downloadText, logoMark } from "../lib/dom";
import { label, t, tIn, toneIn } from "../lib/i18n";
import type { StringKey } from "../lib/strings";
import { DEFAULT_SETTINGS, settings, type Settings } from "../lib/store";
import { activeVocabulary, applyFile, clearWording } from "../lib/wording";
import { celebrationHeadline } from "../lib/vocabulary";
import * as school from "../lib/school";
import * as narrator from "../lib/narrator";
import { host } from "../lib/platform";
import { notify } from "../ui/toast";
import { celebrate } from "../ui/celebrate";
import { superConfirm } from "../ui/confirm";
import { regexField } from "../ui/regexField";
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
let section: Section = "language";

interface Row {
    section: Section;
    title: StringKey;
    hint?: StringKey;
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
    const n = Object.keys(res.vocabulary.entries).length;
    if (viaDrop) {
        play("celebrate");
        celebrate(
            celebrationHeadline(res.vocabulary) ?? t("celebrate.fallback"),
        );
    }
    notify("success", "msg.vocabApplied", { count: n });
    return true;
}

function vocabControl() {
    const v = activeVocabulary();
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
        { class: "drop-zone", dataset: { el: "settings.vocab" } },
        h(
            "p",
            { class: "row", role: "status" },
            icon("upload", 22),
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
        h("p", { class: "muted small" }, t("set.vocabLimits")),
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
    });
    const nameIn = h("input", {
        class: "text-input",
        value: r.name,
        "aria-label": t("set.schoolRename"),
    });
    return h(
        "div",
        { class: "stack" },
        !school.isReadable()
            ? h(
                  "p",
                  { class: "bad small" },
                  "The shared record cannot be read or watched on this device.",
              )
            : null,
        h(
            "div",
            { class: "row wrap" },
            pin,
            sw(r.on, r.name, async (on) => {
                if (on) {
                    await school.turnOn(pin.value);
                    notify("info", "msg.schoolOn", { name: r.name });
                } else if (await school.turnOff(pin.value))
                    notify("info", "msg.schoolOff", { name: r.name });
                else notify("error", "msg.wrongPin", { name: r.name });
            }),
        ),
        h(
            "div",
            { class: "row wrap" },
            nameIn,
            h(
                "button",
                {
                    class: "btn",
                    onclick: () => void school.rename(nameIn.value),
                },
                label("set.schoolRename"),
            ),
        ),
    );
}

function voicePicker(lang: "en" | "yue") {
    const n = settings.get().narrator;
    const voices = narrator.voicesFor(lang);
    const st = narrator.voiceStatus(lang);
    const sel = h(
        "select",
        {
            class: "text-input",
            "aria-label": t(lang === "en" ? "set.voiceEn" : "set.voiceYue"),
            onchange: (e: Event) => {
                const v = (e.target as HTMLSelectElement).value;
                settings.set({
                    narrator: {
                        ...n,
                        [lang === "en" ? "voiceEn" : "voiceYue"]: v,
                    },
                });
            },
        },
        h("option", { value: "" }, t("set.voiceAuto")),
        ...voices.map((v) =>
            h(
                "option",
                {
                    value: v.id,
                    selected: (lang === "en" ? n.voiceEn : n.voiceYue) === v.id,
                },
                v.label,
            ),
        ),
    );
    const status =
        st.kind === "none"
            ? t("set.voiceNone")
            : st.kind === "missing"
              ? t("set.voiceMissing")
              : (st.label ?? "");
    return h(
        "div",
        { class: "stack" },
        sel,
        h("p", { class: "muted small", role: "status" }, status),
    );
}

function logoControl() {
    const s = settings.get();
    const upload = h("input", {
        type: "file",
        accept: "image/png,image/jpeg,image/webp",
        class: "visually-hidden",
        id: "logo-file",
        onchange: async (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const head = new Uint8Array(await f.slice(0, 12).arrayBuffer());
            const sig = [...head]
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            const okSig =
                sig.startsWith("89504e47") ||
                sig.startsWith("ffd8ff") ||
                (sig.startsWith("52494646") &&
                    sig.slice(16, 24) === "57454250");
            if (!okSig || f.size > 2 * 1024 * 1024) {
                notify("error", "msg.convertFailed", {
                    detail: "only PNG, JPEG or WebP up to 2 MiB",
                });
                return;
            }
            const bmp = await createImageBitmap(f).catch(() => null);
            if (!bmp || bmp.width * bmp.height > 16_000_000) {
                notify("error", "msg.convertFailed", {
                    detail: "the image could not be decoded safely",
                });
                return;
            }
            const c = document.createElement("canvas");
            c.width = c.height = 128;
            const g = c.getContext("2d");
            const side = Math.min(bmp.width, bmp.height);
            g?.drawImage(
                bmp,
                (bmp.width - side) / 2,
                (bmp.height - side) / 2,
                side,
                side,
                0,
                0,
                128,
                128,
            );
            settings.set({
                logo: { ...s.logo, custom: c.toDataURL("image/png") },
            });
            notify("success", "msg.converted", {
                from: f.type,
                to: "PNG 128×128",
            });
        },
    });
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
                    "aria-label": p,
                    onclick: () =>
                        settings.set({ logo: { preset: p, custom: null } }),
                },
                logoMark(p, null, 36),
            ),
        ),
        h(
            "label",
            { class: "btn", for: "logo-file", tabindex: 0 },
            label("set.logoUpload"),
        ),
        upload,
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

export function rows(): Row[] {
    const s = settings.get();
    const schoolOn = school.current().on;
    const all: (Row | false)[] = [
        {
            section: "general",
            title: "set.displayName",
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
            keys: ["dimSum"],
            control: () =>
                sw(s.dimSum, t("set.dimSum"), (v) =>
                    settings.set({ dimSum: v }),
                ),
        },
        {
            section: "general",
            title: "set.onboardingAgain",
            keys: ["onboarding"],
            control: () =>
                h(
                    "button",
                    { class: "btn", onclick: restartWizard },
                    label("set.onboardingAgain"),
                ),
        },
        !schoolOn && {
            section: "language",
            title: "set.language",
            hint: "set.bilingualHint",
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
            keys: ["funEn"],
            control: () => funSlider("funEn", "en"),
        },
        !schoolOn && {
            section: "language",
            title: "set.funYue",
            keys: ["funYue"],
            control: () => funSlider("funYue", "yue"),
        },
        !schoolOn && {
            section: "language",
            title: "set.vocab",
            hint: "set.vocabHint",
            keys: [],
            control: vocabControl,
        },
        {
            section: "language",
            title: "set.school",
            hint: "set.schoolHint",
            keys: [],
            control: schoolControl,
        },
        {
            section: "appearance",
            title: "set.theme",
            keys: ["theme"],
            control: () =>
                radios(
                    s.theme,
                    [
                        ["system", "theme.system"],
                        ["light", "theme.light"],
                        ["dark", "theme.dark"],
                        ["contrast", "theme.contrast"],
                    ],
                    t("set.theme"),
                    (v) => settings.set({ theme: v }),
                ),
        },
        {
            section: "appearance",
            title: "set.accent",
            keys: ["accent"],
            control: () =>
                h(
                    "div",
                    { class: "row" },
                    h("input", {
                        type: "color",
                        value: s.accent,
                        "aria-label": t("set.accent"),
                        oninput: (e: Event) =>
                            settings.set({
                                accent: (e.target as HTMLInputElement).value,
                            }),
                    }),
                    h("input", {
                        class: "text-input mono",
                        value: s.accent,
                        "aria-label": `${t("set.accent")} hex`,
                        onchange: (e: Event) => {
                            const v = (
                                e.target as HTMLInputElement
                            ).value.trim();
                            if (/^#[0-9a-f]{6}$/i.test(v))
                                settings.set({ accent: v });
                        },
                    }),
                ),
        },
        {
            section: "appearance",
            title: "set.density",
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
            keys: ["logo"],
            control: logoControl,
        },
        {
            section: "accessibility",
            title: "set.textScale",
            keys: ["textScale"],
            control: () =>
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
        },
        {
            section: "accessibility",
            title: "set.motion",
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
            keys: ["adhd"],
            control: () =>
                sw(s.adhd.focus, t("set.adhdFocus"), (v) =>
                    settings.set({ adhd: { ...s.adhd, focus: v } }),
                ),
        },
        {
            section: "accessibility",
            title: "set.adhdChunk",
            keys: ["adhd"],
            control: () =>
                sw(s.adhd.chunked, t("set.adhdChunk"), (v) =>
                    settings.set({ adhd: { ...s.adhd, chunked: v } }),
                ),
        },
        {
            section: "narrator",
            title: "set.sounds",
            keys: ["sounds"],
            control: () =>
                sw(s.sounds, t("set.sounds"), (v) =>
                    settings.set({ sounds: v }),
                ),
        },
        {
            section: "narrator",
            title: "set.narrator",
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
                            class: "btn",
                            disabled: !narrator.available(),
                            onclick: () =>
                                narrator.narrate(
                                    "test",
                                    "quicktype Studio narrator test.",
                                    "quicktype Studio 旁白測試。",
                                    true,
                                ),
                        },
                        label("set.test"),
                    ),
                ),
        },
        {
            section: "narrator",
            title: "set.narratorLang",
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
            keys: ["narrator"],
            control: () => voicePicker("en"),
        },
        {
            section: "narrator",
            title: "set.voiceYue",
            keys: ["narrator"],
            control: () => voicePicker("yue"),
        },
        {
            section: "narrator",
            title: "set.rate",
            keys: ["narrator"],
            control: () =>
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
        },
        {
            section: "narrator",
            title: "set.pitch",
            keys: ["narrator"],
            control: () =>
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
        },
        {
            section: "updates",
            title: "set.autoUpdate",
            keys: ["updates"],
            control: () =>
                sw(s.updates.auto, t("set.autoUpdate"), (v) =>
                    settings.set({ updates: { auto: v } }),
                ),
        },
        {
            section: "updates",
            title: "set.checkNow",
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
                    label("set.export"),
                ),
        },
        {
            section: "privacy",
            title: "set.import",
            keys: [],
            control: () => {
                const inp = h("input", {
                    type: "file",
                    accept: ".json,application/json",
                    "aria-label": t("set.import"),
                    onchange: async (e: Event) => {
                        const f = (e.target as HTMLInputElement).files?.[0];
                        if (!f || f.size > 512 * 1024) return;
                        try {
                            const data = JSON.parse(await f.text()) as {
                                settings?: Partial<Settings>;
                            };
                            const allowed = Object.fromEntries(
                                Object.entries(data.settings ?? {}).filter(
                                    ([k]) => k in DEFAULT_SETTINGS && k !== "v",
                                ),
                            );
                            settings.set(allowed as Partial<Settings>);
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
                return inp;
            },
        },
        {
            section: "privacy",
            title: "set.wipe",
            hint: "set.wipeHint",
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
                    label("set.wipe"),
                ),
        },
    ];
    return all.filter(Boolean) as Row[];
}

function funSlider(key: "funEn" | "funYue", lang: "en" | "yue") {
    const s = settings.get();
    const value = s[key];
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
        { class: "stack" },
        h(
            "div",
            { class: "row" },
            h("input", {
                type: "range",
                min: 1,
                max: 5,
                step: 1,
                value,
                "aria-label": t(key === "funEn" ? "set.funEn" : "set.funYue"),
                "aria-valuetext": `${value} of 5`,
                onchange: (e: Event) =>
                    settings.set({
                        [key]: Number((e.target as HTMLInputElement).value),
                    } as Partial<Settings>),
            }),
            h("span", { class: "mono" }, `${value} / 5`),
            h(
                "button",
                {
                    class: "btn small",
                    disabled: value === 5,
                    onclick: () =>
                        settings.set({ [key]: 5 } as Partial<Settings>),
                },
                label("settings.reset"),
            ),
        ),
        h(
            "p",
            {
                class: "sample-line",
                lang: lang === "yue" ? "yue-Hant-HK" : "en",
                style: "white-space: pre-line",
            },
            sample,
        ),
    );
}

function rowEl(r: Row) {
    return h(
        "div",
        {
            class: "setting-row card",
            dataset: { el: `setting.${r.title}` },
            "aria-label": t(r.title),
        },
        h(
            "div",
            { class: "setting-text" },
            h("h3", null, label(r.title)),
            r.hint ? h("p", { class: "muted small" }, t(r.hint)) : null,
        ),
        h("div", { class: "setting-control" }, r.control()),
    );
}

register({
    id: "settings",
    labelKey: "tab.settings",
    icon: "settings",
    render: (ctx) => {
        let match: ((s: string) => boolean) | null = null;
        const body = h("div", {
            class: "settings-body",
            role: "tabpanel",
            id: "settings-panel",
            "aria-labelledby": `stab-${section}`,
        });
        const draw = () => {
            const visible = rows().filter((r) =>
                match
                    ? match(`${t(r.title)} ${r.hint ? t(r.hint) : ""}`)
                    : r.section === section,
            );
            body.replaceChildren(
                ...visible.map(rowEl),
                ...(match
                    ? []
                    : [
                          h(
                              "div",
                              { class: "row end" },
                              h(
                                  "button",
                                  {
                                      class: "btn",
                                      onclick: () => {
                                          const keys = [
                                              ...new Set(
                                                  rows()
                                                      .filter(
                                                          (r) =>
                                                              r.section ===
                                                              section,
                                                      )
                                                      .flatMap((r) => r.keys),
                                              ),
                                          ];
                                          settings.reset(keys);
                                          notify("info", "msg.settingsReset", {
                                              section: t(
                                                  `sec.${section === "language" ? "language" : section}` as StringKey,
                                              ),
                                          });
                                      },
                                  },
                                  label("settings.reset"),
                              ),
                          ),
                      ]),
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
                            if (
                                e.key === "ArrowRight" ||
                                e.key === "ArrowLeft"
                            ) {
                                section =
                                    SECTIONS[
                                        (i +
                                            (e.key === "ArrowRight" ? 1 : -1) +
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
                    label(`sec.${sec}` as StringKey),
                ),
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
            ),
            tabs,
            body,
            h(
                "div",
                { class: "row end pad" },
                h(
                    "button",
                    {
                        class: "btn",
                        onclick: async () => {
                            if (
                                await superConfirm(
                                    t("settings.resetAll"),
                                    "RESET",
                                )
                            )
                                settings.reset();
                        },
                    },
                    label("settings.resetAll"),
                ),
            ),
        );
    },
    paletteEntries: (): PaletteEntry[] =>
        rows().map((r) => ({
            group: "settings",
            title: t(r.title),
            detail: `${t("tab.settings")}, ${t(`sec.${r.section}` as StringKey)}`,
            control: r.control,
            run: () => {
                section = r.section;
            },
        })),
});

export { host as _host };
