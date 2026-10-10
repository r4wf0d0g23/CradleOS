import { expect, it } from "vitest";
import {
  buildPlinkoRoute,
  samplePlinko,
  plinkoPeg,
  plinkoBucketX,
  PLINKO_GRAVITY as G,
  PLINKO_RESTITUTION as E,
  PLINKO_MOTION_MS,
  PLINKO_COLLECTION_MS,
  PLINKO_LAUNCH_MS,
  PLINKO_REVEAL_MS,
  PLINKO_BALL_RADIUS,
  PLINKO_PEG_RADIUS,
  type Flight,
} from "./plinkoMotion";
import { initialPractice, playPractice, PLINKO_BPS } from "./casinoPractice";
const radius = PLINKO_BALL_RADIUS + PLINKO_PEG_RADIUS;
const allPegs = Array.from({ length: 12 }, (_, r) =>
  Array.from({ length: r + 1 }, (_, c) => plinkoPeg(r, c)),
).flat();
// Exact minima of squared distance on a ballistic span: endpoints + all roots
// of its cubic derivative. Bisection intervals are split at both turning points.
function clearance(f: Flight, x: number, y: number) {
  const dx = f.start.x - x,
    dy = f.start.y - y,
    vx = f.velocity.x,
    vy = f.velocity.y,
    end = f.duration / 1000;
  const a = 0.5 * G * G,
    b = 1.5 * vy * G,
    c = vx * vx + vy * vy + dy * G,
    d = dx * vx + dy * vy;
  const poly = (t: number) => ((a * t + b) * t + c) * t + d;
  const det = b * b - 3 * a * c;
  const cuts = [
    0,
    ...(det >= 0
      ? [
          (-b - Math.sqrt(det)) / (3 * a),
          (-b + Math.sqrt(det)) / (3 * a),
        ].filter((t) => t > 0 && t < end)
      : []),
    end,
  ];
  const times = [...cuts];
  for (let i = 1; i < cuts.length; i++) {
    let l = cuts[i - 1],
      r = cuts[i];
    if (poly(l) * poly(r) >= 0) continue;
    for (let n = 0; n < 45; n++) {
      const m = (l + r) / 2;
      if (poly(l) * poly(m) <= 0) r = m;
      else l = m;
    }
    times.push((l + r) / 2);
  }
  return Math.min(
    ...times.map((t) => Math.hypot(dx + vx * t, dy + vy * t + 0.5 * G * t * t)),
  );
}
it("all 4096 paths satisfy passive peg impacts, continuous clearance and the original paid outcome", () => {
  for (let mask = 0; mask < 4096; mask++) {
    const bits = Array.from({ length: 12 }, (_, r) => (mask >> r) & 1),
      r = buildPlinkoRoute(bits);
    let draw = 0;
    const state = playPractice(
      initialPractice(),
      "plinko",
      10000,
      {},
      () => bits[draw++],
    );
    expect(r.bucket).toBe(bits.reduce((a, b) => a + b, 0));
    expect(state.history[0].values).toEqual(bits);
    expect(state.history[0].payout).toBe(PLINKO_BPS[r.bucket]);
    expect(state.balance).toBe(1000000 - 10000 + state.history[0].payout);
    expect(r.landing).toEqual({ x: plinkoBucketX(r.bucket), y: 219 });
    expect(r.flights[0].velocity.x).toBe(0);
    expect(r.flights[0].velocity.y).toBeCloseTo(0, 6);
    let column = 0;
    for (const c of r.contacts) {
      expect(c.peg).toEqual(plinkoPeg(c.row, column));
      column += bits[c.row];
      const nx = (c.point.x - c.peg.x) / radius,
        ny = (c.point.y - c.peg.y) / radius;
      expect(Math.hypot(nx, ny)).toBeCloseTo(1, 9);
      expect(ny).toBeLessThan(0);
      const vn = c.incoming.x * nx + c.incoming.y * ny;
      expect(vn).toBeLessThan(0);
      expect(c.outgoing.x).toBeCloseTo(c.incoming.x - (1 + E) * vn * nx, 5);
      expect(c.outgoing.y).toBeCloseTo(c.incoming.y - (1 + E) * vn * ny, 5);
      expect(Math.hypot(c.outgoing.x, c.outgoing.y)).toBeLessThan(
        Math.hypot(c.incoming.x, c.incoming.y),
      );
      expect(Math.sign(c.outgoing.x)).toBe(bits[c.row] ? 1 : -1);
      expect(
        Math.hypot(
          samplePlinko(r, c.at).x - c.point.x,
          samplePlinko(r, c.at).y - c.point.y,
        ),
      ).toBeLessThan(1e-7);
    }
    for (const f of r.flights) {
      const end = samplePlinko(r, f.at + f.duration),
        t = f.duration / 1000;
      expect(end.x).toBeCloseTo(f.start.x + f.velocity.x * t, 6);
      expect(end.y).toBeCloseTo(
        f.start.y + f.velocity.y * t + 0.5 * G * t * t,
        6,
      );
      for (const peg of allPegs) {
        if (
          peg.x < Math.min(f.start.x, end.x) - radius ||
          peg.x > Math.max(f.start.x, end.x) + radius
        )
          continue;
        const distance = clearance(f, peg.x, peg.y);
        if (distance < radius - 1e-7)
          throw Error(
            `Peg penetration: mask${mask} at${f.at} peg${peg.x},${peg.y} distance${distance}`,
          );
      }
      // Catch tray divider tops at y=216; vertical segments end at the floor.
      for (const x of [r.landing.x - 9, r.landing.x + 9]) {
        if (clearance(f, x, 216) < PLINKO_BALL_RADIUS + 0.5 - 1e-7)
          throw Error(`Tray divider penetration: mask${mask}`);
      }
    }
    const incoming = r.flights[12];
    const vy = incoming.velocity.y + (G * incoming.duration) / 1000;
    expect(Math.abs(incoming.velocity.x)).toBeLessThan(0.3 * 1.16 * vy);
    expect(r.duration + PLINKO_COLLECTION_MS).toBeLessThan(PLINKO_MOTION_MS);
    expect(samplePlinko(r, r.duration)).toEqual(r.landing);
    expect(samplePlinko(r, PLINKO_MOTION_MS + 1000)).toEqual(r.landing);
  }
}, 30000);
it("free flight has constant horizontal velocity and downward acceleration, without contact freezes", () => {
  const r = buildPlinkoRoute([0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0]);
  for (const f of r.flights) {
    const t = f.at + f.duration / 2,
      dt = Math.min(1, f.duration / 10);
    const a = samplePlinko(r, t - dt),
      b = samplePlinko(r, t),
      c = samplePlinko(r, t + dt);
    expect(c.x - 2 * b.x + a.x).toBeCloseTo(0, 8);
    expect((c.y - 2 * b.y + a.y) / (dt / 1000) ** 2).toBeCloseTo(G, 4);
  }
  for (const contact of r.contacts)
    expect(samplePlinko(r, contact.at + 16)).not.toEqual(contact.point);
  const bounces = r.flights.slice(13);
  expect(bounces.length).toBeGreaterThan(1);
  expect(Math.abs(bounces[1].velocity.y)).toBeLessThan(
    Math.abs(bounces[0].velocity.y),
  );
});
it("is deterministic, mirrored, clamped and leaves a final reveal beat", () => {
  const bits = [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0];
  const a = buildPlinkoRoute(bits),
    b = buildPlinkoRoute(bits.map((n) => 1 - n));
  expect(buildPlinkoRoute(bits)).toEqual(a);
  for (let ms = 0; ms < PLINKO_MOTION_MS; ms += 4) {
    const p = samplePlinko(a, ms),
      q = samplePlinko(b, ms);
    expect(p.x + q.x).toBeCloseTo(300, 5);
    expect(p.y).toBeCloseTo(q.y, 5);
  }
  expect(samplePlinko(a, -100)).toEqual(a.start);
  expect(PLINKO_REVEAL_MS - PLINKO_MOTION_MS).toBeGreaterThanOrEqual(150);
});
it("rejects invented or incomplete paths", () => {
  for (const bits of [
    [],
    [0],
    Array(13).fill(0),
    Array(12).fill(2),
    Array(12).fill(NaN),
  ])
    expect(() => buildPlinkoRoute(bits)).toThrow();
});

it("360ms release spacing separates every committed vertical envelope through collection", () => {
  const min = Array(901).fill(Infinity),
    max = Array(901).fill(-Infinity);
  for (let mask = 0; mask < 4096; mask++) {
    const r = buildPlinkoRoute(
      Array.from({ length: 12 }, (_, i) => (mask >> i) & 1),
    );
    for (
      let i = 0;
      i < min.length && i * 4 < r.duration + PLINKO_COLLECTION_MS;
      i++
    ) {
      const y = samplePlinko(r, i * 4).y;
      min[i] = Math.min(min[i], y);
      max[i] = Math.max(max[i], y);
    }
  }
  for (let i = PLINKO_LAUNCH_MS / 4; i < min.length; i++) {
    if (
      min[i] !== Infinity &&
      min[i] - max[i - PLINKO_LAUNCH_MS / 4] < 2 * PLINKO_BALL_RADIUS
    )
      throw Error(
        `Release overlap at ${i * 4}ms: ${min[i] - max[i - PLINKO_LAUNCH_MS / 4]}`,
      );
  }
}, 30000);
