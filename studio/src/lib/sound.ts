// Short synthesized action sounds. No audio files, no network.

import { settings } from "./store";

let ctx: AudioContext | null = null;

type Cue = "success" | "error" | "tap" | "celebrate";

const CUES: Record<Cue, [number, number][]> = {
    tap: [[660, 0.05]],
    success: [
        [523, 0.07],
        [784, 0.11],
    ],
    error: [
        [330, 0.09],
        [247, 0.14],
    ],
    celebrate: [
        [523, 0.08],
        [659, 0.08],
        [784, 0.08],
        [1047, 0.18],
    ],
};

export function play(cue: Cue) {
    if (!settings.get().sounds) return;
    try {
        ctx ??= new AudioContext();
        let t = ctx.currentTime;
        for (const [freq, dur] of CUES[cue]) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
            t += dur * 0.9;
        }
    } catch {
        /* audio may be unavailable; sounds are optional */
    }
}
