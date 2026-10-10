import { clamp } from "./casinoTableMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
export const FLEET_SECONDS = 4;
export const FLEET_REVEAL = [0.22, 0.3];
export const FLEET_RESOLVE = 0.87;
export const FLEET_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
export const FLEET_IMPACTS = [0.7, 0.735, 0.77];
export type FleetSide = 0 | 1;
export const fleetWinner = (a: number, b: number): FleetSide | null =>
  a === b ? null : a > b ? 0 : 1;
export function fleetCardPose(t: number, side: FleetSide, has: boolean) {
  const p = has ? clamp((t - FLEET_REVEAL[side] + 0.09) / 0.18) : 0;
  return {
    shown: has && t >= FLEET_REVEAL[side],
    progress: p,
    angle: p < 0.5 ? p * 180 : (p - 1) * 180,
  };
}
/** Constant-velocity opposing wings: facing and momentum remain on their local +X. */
export function fleetShipPose(t: number, side: FleetSide, index: number) {
  const direction = side === 0 ? 1 : -1,
    scale = index === 0 ? 0.35 : 0.26;
  return {
    x:
      (side === 0 ? 90 : 510) + direction * (clamp(t) * 105 - (index ? 38 : 0)),
    y: [140, 73, 207][index],
    direction,
    scale,
    heading: side === 0 ? 0 : 180,
  };
}
export function fleetDamage(
  t: number,
  side: FleetSide,
  index: number,
  winner: FleetSide | null,
  has: boolean,
) {
  const destroyed =
      has && winner !== null && side !== winner && t >= FLEET_IMPACTS[index],
    elapsed = destroyed ? (clamp(t) - FLEET_IMPACTS[index]) * FLEET_SECONDS : 0;
  return {
    destroyed,
    elapsed,
    flash:
      destroyed && elapsed < 0.32
        ? (1 - Math.exp(-elapsed / 0.008)) *
          Math.exp(-elapsed / 0.055) *
          (1 - clamp((elapsed - 0.2) / 0.12))
        : 0,
  };
}
export function fleetFragmentPose(
  elapsed: number,
  index: number,
  scale: number,
) {
  const f = LAI_FRAGMENTS[index];
  return {
    x: (f.cx + f.vx * elapsed) * scale,
    y: (f.cy + f.vy * elapsed) * scale,
    angle: f.spin * elapsed,
  };
}
export type FleetShot = {
  side: FleetSide;
  index: number;
  target: number;
  fire: number;
  hit: number;
  lethal: boolean;
};
export function fleetShots(winner: FleetSide | null): FleetShot[] {
  const shots: FleetShot[] = [];
  for (const fire of [0.35, 0.46])
    for (const side of [0, 1] as FleetSide[])
      for (let index = 0; index < 3; index++) {
        const at = fire + index * 0.012 + side * 0.02;
        shots.push({
          side,
          index,
          target: (index + 1) % 3,
          fire: at,
          hit: at + 0.065,
          lethal: false,
        });
      }
  if (winner !== null)
    for (let index = 0; index < 3; index++)
      shots.push({
        side: winner,
        index,
        target: index,
        fire: FLEET_IMPACTS[index] - 0.065,
        hit: FLEET_IMPACTS[index],
        lethal: true,
      });
  return shots;
}
export function fleetShotPose(t: number, shot: FleetShot) {
  const source = fleetShipPose(shot.fire, shot.side, shot.index),
    target = fleetShipPose(shot.hit, shot.side === 0 ? 1 : 0, shot.target),
    from = { x: source.x + source.direction * 34 * source.scale, y: source.y },
    to = { x: target.x, y: target.y },
    p = clamp((t - shot.fire) / (shot.hit - shot.fire)),
    tail = Math.max(0, p - 0.12);
  return {
    active: t >= shot.fire && t < shot.hit,
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    tx: from.x + (to.x - from.x) * tail,
    ty: from.y + (to.y - from.y) * tail,
    from,
    to,
  };
}
