/** Server-owned view movement. No wallet, wager, shell or filesystem input. */
export const BOUNDS = { x: 19.2, z: 23.2 };
export const TERMINALS = [];
for (let i = 0; i < 9; i++)
  TERMINALS.push({ x: -16 + (i % 3) * 4, z: -16 + Math.floor(i / 3) * 6 });
for (let i = 0; i < 8; i++)
  TERMINALS.push({ x: 8 + (i % 3) * 4, z: -16 + Math.floor(i / 3) * 6 });
for (let i = 0; i < 11; i++)
  TERMINALS.push({ x: -15 + (i % 6) * 6, z: 6 + Math.floor(i / 6) * 6 });
for (let i = 0; i < 6; i++)
  TERMINALS.push({ x: -3 + (i % 2) * 6, z: -16 + Math.floor(i / 2) * 6 });
export const spawn = () => ({ x: 0, z: 21, yaw: 0, pitch: 0 });
export const idle = () => ({ forward: 0, strafe: 0, turn: 0, look: 0 });
export function parseInput(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    raw.type !== "input"
  )
    return null;
  if (
    Object.keys(raw).some(
      (k) => !["type", "forward", "strafe", "turn", "look"].includes(k),
    )
  )
    return null;
  const out = {};
  for (const k of ["forward", "strafe", "turn", "look"]) {
    if (
      typeof raw[k] !== "number" ||
      !Number.isFinite(raw[k]) ||
      Math.abs(raw[k]) > 1
    )
      return null;
    out[k] = raw[k];
  }
  return out;
}
function clear(x, z) {
  return (
    Math.abs(x) <= BOUNDS.x &&
    Math.abs(z) <= BOUNDS.z &&
    !TERMINALS.some(
      (t) => Math.abs(x - t.x) < 1.3 && z > t.z - 0.9 && z < t.z + 1.3,
    )
  );
}
export function move(p, input, elapsed) {
  const dt = Math.max(0, Math.min(0.05, elapsed));
  const yaw =
    ((p.yaw + input.turn * 1.8 * dt + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const pitch = Math.max(-0.9, Math.min(0.9, p.pitch + input.look * 1.2 * dt));
  const n = Math.max(1, Math.hypot(input.forward, input.strafe));
  const dx =
    ((Math.sin(yaw) * input.forward + Math.cos(yaw) * input.strafe) * 4 * dt) /
    n;
  const dz =
    ((-Math.cos(yaw) * input.forward + Math.sin(yaw) * input.strafe) * 4 * dt) /
    n;
  let x = p.x,
    z = p.z;
  if (clear(x + dx, z)) x += dx;
  if (clear(x, z + dz)) z += dz;
  return { x, z, yaw, pitch };
}
export function camera(p) {
  return {
    eye: [p.x, 1.7, p.z],
    focus: [
      p.x + Math.sin(p.yaw) * Math.cos(p.pitch),
      1.7 + Math.sin(p.pitch),
      p.z - Math.cos(p.yaw) * Math.cos(p.pitch),
    ],
  };
}
export function nearestTerminal(p) {
  let best = null,
    distance = 2.5;
  for (let index = 0; index < TERMINALS.length; index++) {
    const t = TERMINALS[index],
      d = Math.hypot(t.x - p.x, t.z + 0.8 - p.z);
    if (d < distance && p.z > t.z) {
      best = index;
      distance = d;
    }
  }
  return best;
}
