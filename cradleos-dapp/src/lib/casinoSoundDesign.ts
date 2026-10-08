/** Original, bounded voices. Presentation only; never controls game state. */
import type { FleetKey } from "./casinoSlotFleet";
export type CasinoCue =
  | "select"
  | "deal"
  | "spin"
  | "win"
  | "loss"
  | "stop"
  | "bonus"
  | "cascade"
  | "coin";
export type SoundNote = {
  hz: number;
  endHz: number;
  at: number;
  duration: number;
  attack: number;
  gain: number;
  wave: OscillatorType;
};
const NOTES: Record<CasinoCue, number[]> = {
  bonus: [293.66, 440, 587.33, 880],
  cascade: [220, 293.66, 349.23],
  coin: [880, 1174.66],
  stop: [164.81],
  win: [261.63, 329.63, 392],
  loss: [110, 82.41],
  spin: [146.83, 220],
  deal: [392],
  select: [660],
};
type Voice = {
  pitch: number;
  wave: OscillatorType;
  duration: number;
  spacing: number;
  attack: number;
  sweep: number;
  gain: number;
  echo?: number;
};
const VOICES: Record<FleetKey, Voice> = {
  slot_scrapyard: {
    pitch: 0.65,
    wave: "triangle",
    duration: 0.11,
    spacing: 0.08,
    attack: 0.002,
    sweep: 0.42,
    gain: 0.05,
    echo: 0.035,
  },
  slot_wreckways: {
    pitch: 0.48,
    wave: "sine",
    duration: 0.48,
    spacing: 0.19,
    attack: 0.025,
    sweep: 0.97,
    gain: 0.048,
  },
  slot_reactor: {
    pitch: 0.7,
    wave: "sawtooth",
    duration: 0.23,
    spacing: 0.11,
    attack: 0.018,
    sweep: 1.9,
    gain: 0.012,
  },
  slot_feral: {
    pitch: 1.4,
    wave: "square",
    duration: 0.06,
    spacing: 0.045,
    attack: 0.002,
    sweep: 0.35,
    gain: 0.013,
    echo: 0.095,
  },
  slot_vault: {
    pitch: 1.1,
    wave: "sine",
    duration: 0.36,
    spacing: 0.13,
    attack: 0.003,
    sweep: 0.99,
    gain: 0.045,
    echo: 0.11,
  },
  slot_gatecrash: {
    pitch: 0.55,
    wave: "triangle",
    duration: 0.32,
    spacing: 0.14,
    attack: 0.025,
    sweep: 2.8,
    gain: 0.032,
  },
  slot_drones: {
    pitch: 1.25,
    wave: "square",
    duration: 0.095,
    spacing: 0.14,
    attack: 0.005,
    sweep: 1,
    gain: 0.015,
  },
  slot_eclipse: {
    pitch: 1.8,
    wave: "sine",
    duration: 0.6,
    spacing: 0.22,
    attack: 0.055,
    sweep: 1,
    gain: 0.035,
    echo: 0.18,
  },
};
export function casinoSoundNotes(cue: CasinoCue, game?: FleetKey): SoundNote[] {
  const voice = game ? VOICES[game] : undefined;
  const v = voice ?? {
    pitch: 1,
    wave: cue === "spin" ? "triangle" : "sine",
    duration: 0.24,
    spacing: 0.09,
    attack: 0.012,
    sweep: 0.8,
    gain: 0.045,
  };
  return NOTES[cue].flatMap((hz, i) => {
    const n: SoundNote = {
      hz: hz * v.pitch,
      endHz: hz * v.pitch * v.sweep,
      at: i * v.spacing,
      duration: v.duration,
      attack: v.attack,
      gain: v.gain,
      wave: v.wave,
    };
    return voice?.echo
      ? [
          n,
          {
            ...n,
            at: n.at + voice.echo,
            hz: n.hz * 1.5,
            endHz: n.endHz * 1.5,
            gain: n.gain * 0.28,
          },
        ]
      : [n];
  });
}
