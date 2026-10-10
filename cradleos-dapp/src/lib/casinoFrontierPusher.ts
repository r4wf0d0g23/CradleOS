/** Deterministic disc contacts. No RNG or payout-selected trajectories. Units: tray units, seconds. */
export const PUSHER_COST = 2500,
  PUSHER_RADIUS = 13,
  PUSHER_SECONDS = 7.2;
export type PusherToken = { id: number; x: number; y: number };
export type PusherFrame = {
  t: number;
  motor: number;
  tokens: PusherToken[];
  collected: number[];
  missed: number[];
};
export type PusherResult = {
  tray: PusherToken[];
  collected: number[];
  missed: number[];
  frames: PusherFrame[];
};
export const initialTray = (): PusherToken[] =>
  Array.from({ length: 81 }, (_, i) => ({
    id: i + 1,
    x: 68 + (i % 9) * 28 + (Math.floor(i / 9) % 2) * 2,
    y: 164 + Math.floor(i / 9) * 27,
  }));
export function validTray(tray: unknown): tray is PusherToken[] {
  return (
    Array.isArray(tray) &&
    tray.length <= 100 &&
    new Set(tray.map((t) => t?.id)).size === tray.length &&
    tray.every(
      (t) =>
        t &&
        Number.isSafeInteger(t.id) &&
        t.id > 0 &&
        t.id < 1e9 &&
        Number.isFinite(t.x) &&
        t.x >= PUSHER_RADIUS &&
        t.x <= 360 - PUSHER_RADIUS &&
        Number.isFinite(t.y) &&
        t.y >= 0 &&
        t.y <= 400,
    )
  );
}
const quantize = (n: number) => Math.round(n * 1e6) / 1e6;
export const motorPosition = (phase: number) =>
  quantize(65 + (135 * (1 - Math.cos(phase * 2 * Math.PI))) / 2);
export function simulatePusher(
  tray: PusherToken[],
  x: number,
  phase: number,
  id: number,
  record = false,
): PusherResult {
  if (
    !validTray(tray) ||
    tray.length >= 100 ||
    !Number.isFinite(x) ||
    x < 36 ||
    x > 324 ||
    !Number.isFinite(phase) ||
    phase < 0 ||
    phase >= 1 ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    tray.some((t) => t.id === id)
  )
    throw Error("Invalid pusher drop.");
  const r = PUSHER_RADIUS,
    dt = 1 / 120,
    ticks = PUSHER_SECONDS / dt;
  const tokens = tray.map((t) => ({ ...t, vx: 0, vy: 0 }));
  // The chute places the new token immediately ahead of the current pusher face.
  let dropped = false;
  const collected: number[] = [],
    missed: number[] = [],
    frames: PusherFrame[] = [];
  let last = motorPosition(0);
  for (let step = 0; step <= ticks; step++) {
    const t = step * dt,
      motor = motorPosition((t / 3.6) % 1),
      speed = (motor - last) / dt;
    last = motor;
    if (!dropped && t >= phase * 3.6) {
      tokens.push({ id, x, y: motor + r + 1, vx: 0, vy: 32 });
      dropped = true;
    }
    for (const p of tokens) {
      p.vx *= Math.exp(-5 * dt);
      p.vy *= Math.exp(-5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // Iterative contacts transfer the motor impulse through stacked cargo.
    for (let iteration = 0; iteration < 7; iteration++) {
      for (const p of tokens) {
        if (p.y - r < motor) {
          p.y = motor + r;
          p.vy = Math.max(p.vy, Math.max(0, speed) * 0.75);
        }
        if (p.x < r) {
          p.x = r;
          p.vx = Math.abs(p.vx) * 0.15;
        }
        if (p.x > 360 - r) {
          p.x = 360 - r;
          p.vx = -Math.abs(p.vx) * 0.15;
        }
      }
      for (let a = 0; a < tokens.length; a++)
        for (let b = a + 1; b < tokens.length; b++) {
          const p = tokens[a],
            q = tokens[b],
            dx = q.x - p.x,
            dy = q.y - p.y,
            d2 = dx * dx + dy * dy;
          if (d2 >= 4 * r * r) continue;
          const d = Math.sqrt(d2);
          const nx = d > 1e-8 ? dx / d : 1,
            ny = d > 1e-8 ? dy / d : 0,
            overlap = 2 * r - d;
          p.x -= nx * overlap * 0.5;
          p.y -= ny * overlap * 0.5;
          q.x += nx * overlap * 0.5;
          q.y += ny * overlap * 0.5;
          const closing = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (closing < 0) {
            const impulse = -closing * 0.55;
            p.vx -= impulse * nx;
            p.vy -= impulse * ny;
            q.vx += impulse * nx;
            q.vy += impulse * ny;
          }
        }
    }
    // Fixed precision keeps saved replay identical across JS math-library versions.
    for (const p of tokens) {
      p.x = quantize(p.x);
      p.y = quantize(p.y);
      p.vx = quantize(p.vx);
      p.vy = quantize(p.vy);
    }
    for (let i = tokens.length - 1; i >= 0; i--) {
      const p = tokens[i];
      if (p.y > 390) {
        (p.x >= 36 && p.x <= 324 ? collected : missed).push(p.id);
        tokens.splice(i, 1);
      } else if (p.y > 355 && (p.x < 27 || p.x > 333)) {
        missed.push(p.id);
        tokens.splice(i, 1);
      }
    }
    if (record && (step % 4 === 0 || step === ticks))
      frames.push({
        t,
        motor,
        tokens: tokens.map(({ id, x, y }) => ({ id, x, y })),
        collected: [...collected],
        missed: [...missed],
      });
  }
  // Freeze residual velocities between paid drops; retain the per-tick fixed-precision coordinates.
  const next = tokens.map(({ id, x, y }) => ({
    id,
    x: Math.max(r, Math.min(360 - r, x)),
    y: Math.max(0, Math.min(400, y)),
  }));
  if (!validTray(next)) throw Error("Pusher simulation unavailable.");
  return { tray: next, collected, missed, frames };
}
