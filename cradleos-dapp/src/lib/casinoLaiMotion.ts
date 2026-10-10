import { clamp } from "./casinoTableMotion";
// Presentation of an already committed Limbo result. This never draws or settles a round.
export const LAI_ACCELERATION_END = 0.72;
export function laiJumpPose(
  t: number,
  limit: number,
  target: number,
  has: boolean,
) {
  const p = clamp(t),
    win = has && limit >= target;
  const charge = has ? clamp(p / LAI_ACCELERATION_END) : 0;
  const resolution = has
    ? clamp((p - LAI_ACCELERATION_END) / (1 - LAI_ACCELERATION_END))
    : 0;
  const speed = has ? Math.min(limit, target) * Math.pow(charge, 1.65) : 0;
  const reached = has && p >= LAI_ACCELERATION_END;
  const phase = !has
    ? "ready"
    : !reached
      ? "accelerating"
      : win
        ? p === 1
          ? "warped"
          : "warping"
        : p === 1
          ? "destroyed"
          : "exploding";
  const departure = win ? Math.pow(clamp(resolution / 0.72), 2.4) : 0;
  return {
    phase,
    win,
    charge,
    resolution,
    speed,
    x: 220 + charge * 28 + departure * 390,
    y: 172 - Math.sin(charge * Math.PI) * 7 - departure * 32,
    bank:
      has && !reached ? Math.sin(charge * Math.PI * 3) * (1 - charge) * 2.5 : 0,
    hullOpacity: !reached
      ? 1
      : win
        ? 1 - clamp((resolution - 0.48) / 0.22)
        : 1 - clamp(resolution / 0.09),
    stretch: 1 + (win ? Math.sin(clamp(resolution / 0.72) * Math.PI) * 2.6 : 0),
    flash: reached ? Math.sin(clamp(resolution / 0.58) * Math.PI) : 0,
    shock: reached ? Math.pow(resolution, 0.55) : 0,
  };
}
/** Don't round a failed attempt up to its target. Values are integer basis points. */
export function laiSpeedLabel(speed: number, target: number) {
  const x = speed / 10000,
    goal = target / 10000;
  return `${speed < target && Number(x.toFixed(2)) >= goal ? x.toFixed(4) : x.toFixed(2)}×`;
}
