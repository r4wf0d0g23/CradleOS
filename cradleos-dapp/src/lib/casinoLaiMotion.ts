import { clamp } from "./casinoTableMotion";
import hull from "./casinoLaiHull.json";
// Authored world-space units, not game m/s. One rigid +X axis, camera separated.
export const LAI_ACCELERATION_END = 0.72;
export const LAI_SECONDS = 4;
export const LAI_BURN_SECONDS = LAI_SECONDS * LAI_ACCELERATION_END;
export const LAI_ACCELERATION = 36;
export const LAI_CAMERA_FRACTION = 0.84;
export const LAI_TERMINAL_SPEED = LAI_ACCELERATION * LAI_BURN_SECONDS;
const burnDistance = 0.5 * LAI_ACCELERATION * LAI_BURN_SECONDS ** 2;
const mass = hull.fragments.reduce((s, f) => s + f.mass, 0);
const com = {
  x: hull.fragments.reduce((s, f) => s + f.mass * f.cx, 0) / mass,
  y: hull.fragments.reduce((s, f) => s + f.mass * f.cy, 0) / mass,
};
const rawFragments = hull.fragments.map((f) => {
  const dx = f.cx - com.x,
    dy = f.cy - com.y,
    d = Math.hypot(dx, dy) || 1;
  return { ...f, vx: (dx / d) * 68, vy: (dy / d) * 68 };
});
const meanX = rawFragments.reduce((s, f) => s + f.mass * f.vx, 0) / mass;
const meanY = rawFragments.reduce((s, f) => s + f.mass * f.vy, 0) / mass;
const meanSpin =
  rawFragments.reduce((s, f) => s + f.inertia * f.spin, 0) /
  rawFragments.reduce((s, f) => s + f.inertia, 0);
export const LAI_HULL = hull;
export const LAI_FRAGMENTS = rawFragments.map((f) => ({
  ...f,
  vx: f.vx - meanX,
  vy: f.vy - meanY,
  spin: f.spin - meanSpin,
}));
export function laiJumpPose(
  t: number,
  limit: number,
  target: number,
  has: boolean,
) {
  const p = clamp(t),
    seconds = has ? p * LAI_SECONDS : 0;
  const burn = Math.min(seconds, LAI_BURN_SECONDS);
  const elapsed = Math.max(0, seconds - LAI_BURN_SECONDS);
  const charge = burn / LAI_BURN_SECONDS;
  const resolution = elapsed / (LAI_SECONDS - LAI_BURN_SECONDS);
  const reached = has && p >= LAI_ACCELERATION_END;
  const win = has && limit >= target;
  const baseDistance = reached
    ? burnDistance + LAI_TERMINAL_SPEED * elapsed
    : 0.5 * LAI_ACCELERATION * burn ** 2;
  const cameraX = baseDistance * LAI_CAMERA_FRACTION;
  // Fictional warp adds forward jerk from zero, retaining the burn's position/velocity.
  const warpDistance = reached && win ? (4200 * elapsed ** 3) / 6 : 0;
  const worldX = 210 + baseDistance + warpDistance;
  const x = worldX - cameraX;
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
  return {
    phase,
    win,
    charge,
    resolution,
    elapsed,
    cameraX,
    worldX,
    x,
    y: 160,
    velocity:
      LAI_ACCELERATION * burn + (reached && win ? 2100 * elapsed ** 2 : 0),
    speed: has ? Math.min(limit, target) * charge : 0,
    // The intact ship doesn't dissolve/stretch. It exits the frame or fractures in place.
    hullOpacity: reached && !win ? 0 : x > 620 ? 0 : 1,
    bank: 0,
    stretch: 1,
    flash:
      reached && !win
        ? (1 - Math.exp(-elapsed / 0.012)) * Math.exp(-elapsed / 0.18)
        : 0,
    thrust: has && (!reached || win) ? Math.min(1, seconds / 0.18) : 0,
  };
}
export function laiFragmentPose(t: number, index: number) {
  const elapsed = Math.max(0, clamp(t) * LAI_SECONDS - LAI_BURN_SECONDS);
  const f = LAI_FRAGMENTS[index];
  const worldX =
    210 + burnDistance + f.cx + (LAI_TERMINAL_SPEED + f.vx) * elapsed;
  const cameraX =
    (burnDistance + LAI_TERMINAL_SPEED * elapsed) * LAI_CAMERA_FRACTION;
  return {
    x: worldX - cameraX,
    y: 160 + f.cy + f.vy * elapsed,
    angle: f.spin * elapsed,
    worldX,
    vx: LAI_TERMINAL_SPEED + f.vx,
    vy: f.vy,
  };
}
/** Don't round a failed attempt up to its target. Values are integer basis points. */
export function laiSpeedLabel(speed: number, target: number) {
  const x = speed / 10000,
    goal = target / 10000;
  return `${speed < target && Number(x.toFixed(2)) >= goal ? x.toFixed(4) : x.toFixed(2)}×`;
}
