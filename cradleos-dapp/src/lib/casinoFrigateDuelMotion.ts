import { clamp } from "./casinoTableMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
export type FrigateSide = 0 | 1;
export const FRIGATE_SECONDS = 4.2;
export const FRIGATE_REVEAL = [0.16, 0.25];
export const FRIGATE_IMPACT = 0.75;
export const FRIGATE_RESOLVE = 0.9;
export const frigateWinner = (a: number, b: number): FrigateSide | null =>
  a === b ? null : a > b ? 0 : 1;
export function frigateCardProgress(
  t: number,
  side: FrigateSide,
  has: boolean,
) {
  return has ? clamp(0.5 + (t - FRIGATE_REVEAL[side]) / 0.13) : 0;
}
/** Fixed inertial velocity; +X nose and heading agree with the travel vector. */
export function frigatePose(t: number, side: FrigateSide) {
  const direction = side === 0 ? 1 : -1;
  return {
    x: (side === 0 ? 110 : 490) + direction * clamp(t) * 125,
    y: (side === 0 ? 190 : 130) - direction * clamp(t) * 32,
    heading: (Math.atan2(-direction * 32, direction * 125) * 180) / Math.PI,
    scale: 0.62,
    vx: (direction * 125) / FRIGATE_SECONDS,
    vy: (-direction * 32) / FRIGATE_SECONDS,
  };
}
export function frigatePoint(t: number, side: FrigateSide, x: number, y = 0) {
  const p = frigatePose(t, side),
    a = (p.heading * Math.PI) / 180;
  return {
    x: p.x + (x * Math.cos(a) - y * Math.sin(a)) * p.scale,
    y: p.y + (x * Math.sin(a) + y * Math.cos(a)) * p.scale,
  };
}
export type FrigateShot = {
  side: FrigateSide;
  fire: number;
  hit: number;
  lethal: boolean;
};
export function frigateShots(winner: FrigateSide | null): FrigateShot[] {
  const shots: FrigateShot[] = [];
  for (const fire of [0.35, 0.49])
    for (const side of [0, 1] as FrigateSide[])
      shots.push({
        side,
        fire: fire + side * 0.018,
        hit: fire + side * 0.018 + 0.085,
        lethal: false,
      });
  if (winner !== null)
    shots.push({
      side: winner,
      fire: FRIGATE_IMPACT - 0.085,
      hit: FRIGATE_IMPACT,
      lethal: true,
    });
  return shots;
}
/** A bolt follows a straight constant-velocity path to the future hull intercept. */
export function frigateShotPose(t: number, shot: FrigateShot) {
  const from = frigatePoint(shot.fire, shot.side, 38),
    to = frigatePoint(shot.hit, shot.side === 0 ? 1 : 0, 32),
    p = clamp((t - shot.fire) / (shot.hit - shot.fire)),
    tail = Math.max(0, p - 0.075);
  return {
    from,
    to,
    active: t >= shot.fire && t < shot.hit,
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    tx: from.x + (to.x - from.x) * tail,
    ty: from.y + (to.y - from.y) * tail,
  };
}
export function frigateDamage(
  t: number,
  side: FrigateSide,
  winner: FrigateSide | null,
  has: boolean,
) {
  const destroyed =
      has && winner !== null && side !== winner && t >= FRIGATE_IMPACT,
    elapsed = destroyed ? (clamp(t) - FRIGATE_IMPACT) * FRIGATE_SECONDS : 0;
  return {
    destroyed,
    elapsed,
    flash:
      destroyed && elapsed < 0.28
        ? (1 - Math.exp(-elapsed / 0.01)) *
          Math.exp(-elapsed / 0.065) *
          (1 - clamp((elapsed - 0.18) / 0.1))
        : 0,
  };
}
export function frigateFragmentPose(elapsed: number, index: number) {
  const f = LAI_FRAGMENTS[index],
    scale = frigatePose(0, 0).scale;
  return {
    x: (f.cx + f.vx * elapsed) * scale,
    y: (f.cy + f.vy * elapsed) * scale,
    angle: f.spin * elapsed,
  };
}
