/** Cosmetic choreography only. No randomness, payouts, storage or wallet calls. */
import {
  FLEET,
  WILD,
  type FleetKey,
  type SlotReceipt,
  type SlotFrame,
} from "./casinoSlotFleet";
export type SlotMotionRun = { id: number; started: number };
export const REEL_STOPS = [1160, 1305, 1450, 1595, 1740] as const;
export const CLEAR_MS = 260;
export type SlotMotionPlan = {
  kind: "reels" | "cascade" | "hold" | "collect";
  rawStop: number;
  expand: number;
  finish: number;
  reveal: number;
};
export function slotMotionPlan(
  game: FleetKey,
  frame?: SlotFrame,
  previous?: SlotFrame,
): SlotMotionPlan {
  if (frame?.kind === "cascade")
    return {
      kind: "cascade",
      rawStop: 1120,
      expand: 1120,
      finish: 1220,
      reveal: 1440,
    };
  if (FLEET[game].mode === "hold") {
    if (previous?.coins.length === 15 && previous.coins.every((n) => n > 0))
      return {
        kind: "collect",
        rawStop: 0,
        expand: 0,
        finish: 650,
        reveal: 850,
      };
    return {
      kind: "hold",
      rawStop: 1220,
      expand: 1220,
      finish: 1280,
      reveal: 1500,
    };
  }
  const gate =
    game === "slot_gatecrash" &&
    !!frame?.original.some(
      (col, c) =>
        col.some((n) => n === WILD) &&
        col.some((n, r) => n !== frame.grid[c][r]),
    );
  return {
    kind: "reels",
    rawStop: 1740,
    expand: gate ? 2080 : 1740,
    finish: gate ? 2480 : 1840,
    reveal: gate ? 2660 : 2060,
  };
}
export function slotRevealMs(receipt: SlotReceipt, cursor = receipt.cursor) {
  return slotMotionPlan(
    receipt.key,
    receipt.frames[cursor],
    receipt.frames[cursor - 1],
  ).reveal;
}
/** Final rows lead the strip; translating from a negative offset brings them down into view. Decorative entries never create fake wild/scatter near misses. */
export function reelStrip(
  final: number[],
  column: number,
  before?: number[],
): number[] {
  return [
    ...final,
    ...Array.from(
      { length: 20 + column * 2 },
      (_, i) => (i * 3 + column * 2) % 7,
    ),
    ...final.map((_, r) => before?.[r] ?? (r + column) % 7),
  ];
}
/** Integrated cosine velocity: continuous acceleration, cruise and braking. */
export function reelTravelProgress(t: number) {
  const a = 0.18,
    b = 0.58,
    d = 1 - b,
    speed = 1 / (a / 2 + b - a + d / 2);
  if (t <= a)
    return speed * (t / 2 - (a * Math.sin((Math.PI * t) / a)) / (2 * Math.PI));
  if (t <= b) return speed * (t - a / 2);
  const u = Math.min(1, t) - b;
  return (
    speed *
    (b - a / 2 + u / 2 + (d * Math.sin((Math.PI * u) / d)) / (2 * Math.PI))
  );
}
export function reelTravelKeyframes(distance: number): Keyframe[] {
  const travel: Keyframe[] = Array.from({ length: 61 }, (_, i) => ({
    transform: `translate3d(0,${-distance + (distance + 3) * reelTravelProgress(i / 60)}px,0)`,
    offset: (0.92 * i) / 60,
    easing: "linear",
  }));
  travel[60].easing = "ease-in-out";
  return [
    ...travel,
    { transform: "translate3d(0,-1px,0)", offset: 0.97, easing: "ease-in-out" },
    { transform: "translate3d(0,0,0)", offset: 1 },
  ];
}
export function cascadePlacement(
  previous: SlotFrame,
  column: number,
  row: number,
) {
  const winners = new Set(previous.wins.flatMap((w) => w.cells));
  const kept = previous.grid[column].flatMap((_, r) =>
    winners.has(column * 5 + r) ? [] : [r],
  );
  const inserted = previous.grid[column].length - kept.length;
  const source = row < inserted ? row - inserted - 1 : kept[row - inserted];
  const distance = row - source;
  return {
    source,
    distance,
    inserted: row < inserted,
    delay: CLEAR_MS + column * 20,
    duration: Math.min(590, Math.sqrt(Math.max(0, distance)) * 230) + 140,
  };
}
export function fallKeyframes(distance: number): Keyframe[] {
  return [
    {
      transform: `translate3d(0,${-distance}px,0)`,
      opacity: 1,
      offset: 0,
      easing: "cubic-bezier(.5,0,.85,.55)",
    },
    {
      transform: "translate3d(0,3px,0)",
      opacity: 1,
      offset: 0.8,
      easing: "ease-out",
    },
    {
      transform: "translate3d(0,-1px,0)",
      opacity: 1,
      offset: 0.94,
      easing: "ease-in-out",
    },
    { transform: "translate3d(0,0,0)", opacity: 1, offset: 1 },
  ];
}
export const socketLanding = (column: number, row: number) =>
  120 + column * 110 + row * 70;
