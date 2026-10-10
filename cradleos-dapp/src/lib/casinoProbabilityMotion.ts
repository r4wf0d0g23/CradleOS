import { clamp } from "./casinoTableMotion";
export const PROBABILITY_LAND_AT = 0.92;
export const probabilityPercent = (value: number) => ((value - 1) / 99) * 100;
/** Bounded continuous scan, progressively captured by the committed roll. */
export function probabilityRollPose(t: number, result: number) {
  const p = clamp(t / PROBABILITY_LAND_AT),
    capture = clamp((p - 0.35) / 0.65),
    weight = capture * capture * (3 - 2 * capture),
    scan = 50.5 - 49.5 * Math.cos(6 * Math.PI * p),
    position = p === 1 ? result : scan * (1 - weight) + result * weight;
  return {
    position,
    number: Math.round(position),
    percent: probabilityPercent(position),
    landed: p === 1,
  };
}
