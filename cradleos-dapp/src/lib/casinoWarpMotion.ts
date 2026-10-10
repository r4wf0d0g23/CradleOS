import { clamp } from "./casinoTableMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
// Authored scene units, not game m/s. Warp fiction uses consistent inertial motion.
export const WARP_SECONDS = 2.6;
export const WARP_FAILURE_AT = 0.74;
export const WARP_FAILURE_SECONDS = WARP_SECONDS * WARP_FAILURE_AT;
export const WARP_RAMP_SECONDS = 0.35;
export const WARP_ACCELERATION = 300;
export const WARP_START_X = 168;
export const WARP_CAMERA_FRACTION = 0.78;
export const WARP_HULL_SCALE = 0.64;
const smooth = (x: number) => {
  const p = clamp(x);
  return p * p * (3 - 2 * p);
};
/** Exact integral of ramped thrust; after drive loss all carriers coast. */
export function warpTravel(seconds: number) {
  const s = Math.max(0, seconds),
    burn = Math.min(s, WARP_FAILURE_SECONDS),
    ramp = Math.min(burn, WARP_RAMP_SECONDS),
    cruise = Math.max(0, burn - WARP_RAMP_SECONDS),
    jerk = WARP_ACCELERATION / WARP_RAMP_SECONDS,
    rampVelocity = (jerk * ramp * ramp) / 2,
    velocity = rampVelocity + WARP_ACCELERATION * cruise,
    distance =
      (jerk * ramp ** 3) / 6 +
      rampVelocity * cruise +
      (WARP_ACCELERATION * cruise * cruise) / 2 +
      velocity * Math.max(0, s - WARP_FAILURE_SECONDS);
  return {
    distance,
    velocity,
    acceleration: s >= WARP_FAILURE_SECONDS ? 0 : jerk * ramp,
  };
}
export function warpPose(
  t: number,
  limit: number,
  target: number,
  has: boolean,
) {
  const seconds = has ? clamp(t) * WARP_SECONDS : 0,
    travel = warpTravel(seconds),
    elapsed = Math.max(0, seconds - WARP_FAILURE_SECONDS),
    failed = has && seconds >= WARP_FAILURE_SECONDS,
    progress = Math.min(1, seconds / WARP_FAILURE_SECONDS),
    cross =
      limit >= target && limit > 10000
        ? Math.log(target / 10000) / Math.log(limit / 10000)
        : Infinity,
    paid = has && limit >= target && (failed || progress >= cross),
    multiplier = !has
      ? 10000
      : failed
        ? limit
        : limit <= 10000
          ? 10000
          : 10000 * Math.exp(Math.log(limit / 10000) * progress),
    cameraX = travel.distance * WARP_CAMERA_FRACTION,
    worldX = WARP_START_X + travel.distance;
  return {
    seconds,
    elapsed,
    failed,
    paid,
    multiplier,
    cross,
    phase: !has ? "ready" : failed ? "ended" : "flight",
    worldX,
    cameraX,
    x: worldX - cameraX,
    y: 155,
    velocity: travel.velocity,
    cameraVelocity: travel.velocity * WARP_CAMERA_FRACTION,
    thrust: has && !failed ? travel.acceleration / WARP_ACCELERATION : 0,
    flash: failed
      ? (1 - Math.exp(-elapsed / 0.009)) *
        Math.exp(-elapsed / 0.075) *
        (1 - smooth((elapsed - 0.14) / 0.16))
      : 0,
    wake: has ? 1 - smooth(elapsed / 0.16) : 0,
  };
}
export function warpFragmentPose(t: number, index: number) {
  const seconds = clamp(t) * WARP_SECONDS,
    u = Math.max(0, seconds - WARP_FAILURE_SECONDS),
    cutoff = warpTravel(WARP_FAILURE_SECONDS),
    f = LAI_FRAGMENTS[index],
    cameraX = warpTravel(seconds).distance * WARP_CAMERA_FRACTION,
    vx = cutoff.velocity + f.vx * WARP_HULL_SCALE,
    vy = f.vy * WARP_HULL_SCALE,
    worldX = WARP_START_X + cutoff.distance + f.cx * WARP_HULL_SCALE + vx * u;
  return {
    x: worldX - cameraX,
    y: 155 + f.cy * WARP_HULL_SCALE + vy * u,
    worldX,
    vx,
    vy,
    angle: f.spin * u,
  };
}
/** A not-yet-reached target must not appear reached merely through rounding. */
export function warpMultiplierLabel(value: number, target: number) {
  const multiple = value / 10000;
  return `${
    value < target && Number(multiple.toFixed(2)) >= target / 10000
      ? (Math.floor(value) / 10000).toFixed(4)
      : multiple.toFixed(2)
  }×`;
}
