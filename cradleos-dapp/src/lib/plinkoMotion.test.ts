import { expect, it } from "vitest";
import {
  buildPlinkoRoute,
  samplePlinko,
  plinkoPeg,
  plinkoBucketX,
  PLINKO_ENTRY_MS,
  PLINKO_HOP_MS,
  PLINKO_CONTACT_MS,
  PLINKO_MOTION_MS,
  PLINKO_REVEAL_MS,
  PLINKO_BALL_RADIUS,
  PLINKO_PEG_RADIUS,
} from "./plinkoMotion";
import { initialPractice, playPractice, PLINKO_BPS } from "./casinoPractice";

it("all4096 committed outcomes strike twelve real pegs and end at the paid bucket", () => {
  for (let mask = 0; mask < 4096; mask++) {
    const bits = Array.from({ length: 12 }, (_, row) => (mask >> row) & 1);
    let draw = 0;
    const s = playPractice(
      initialPractice(),
      "plinko",
      10000,
      {},
      () => bits[draw++],
    );
    const r = buildPlinkoRoute(s.history[0].values);
    expect(r.bucket).toBe(bits.reduce((a, b) => a + b, 0));
    expect(s.history[0].payout).toBe(PLINKO_BPS[r.bucket]);
    expect(r.landing).toEqual({ x: plinkoBucketX(r.bucket), y: 219 });
    let column = 0;
    r.contacts.forEach((c, row) => {
      const peg = plinkoPeg(row, column);
      expect(c.x).toBe(peg.x);
      expect(peg.y - c.y).toBe(PLINKO_BALL_RADIUS + PLINKO_PEG_RADIUS);
      expect(samplePlinko(r, PLINKO_ENTRY_MS + row * PLINKO_HOP_MS)).toEqual(c);
      column += bits[row];
    });
    expect(samplePlinko(r, PLINKO_MOTION_MS)).toEqual(r.landing);
    expect(s.balance).toBe(1000000 - 10000 + s.history[0].payout);
  }
});
it("bounce arcs lift off contacts and do not cut through any peg", () => {
  const cases = [
    Array(12).fill(0),
    Array(12).fill(1),
    Array.from({ length: 12 }, (_, i) => i % 2),
    [0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0],
  ];
  const pegs = Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: row + 1 }, (_, col) => plinkoPeg(row, col)),
  ).flat();
  for (const bits of cases) {
    const r = buildPlinkoRoute(bits);
    for (let ms = 0; ms <= PLINKO_MOTION_MS; ms += 4) {
      const p = samplePlinko(r, ms);
      for (const peg of pegs)
        expect(Math.hypot(p.x - peg.x, p.y - peg.y)).toBeGreaterThanOrEqual(
          7 - 1e-8,
        );
      expect(p.x).toBeGreaterThanOrEqual(42);
      expect(p.x).toBeLessThanOrEqual(258);
    }
    for (let row = 0; row < 12; row++) {
      const p = samplePlinko(
        r,
        PLINKO_ENTRY_MS + row * PLINKO_HOP_MS + PLINKO_HOP_MS * 0.2,
      );
      expect(p.y).toBeLessThan(r.contacts[row].y);
      expect(Math.sign(p.x - r.contacts[row].x)).toBe(bits[row] ? 1 : -1);
    }
  }
});
it("timing clamps safely and leaves a landing beat before payout reveal", () => {
  const r = buildPlinkoRoute(Array(12).fill(0));
  expect(samplePlinko(r, -100)).toEqual(r.start);
  expect(samplePlinko(r, PLINKO_REVEAL_MS + 1000)).toEqual(r.landing);
  expect(PLINKO_REVEAL_MS - PLINKO_MOTION_MS).toBeGreaterThanOrEqual(150);
});
it("rejects invented or incomplete paths instead of animating a different payout", () => {
  for (const bits of [
    [],
    [0],
    Array(13).fill(0),
    Array(12).fill(2),
    Array(12).fill(NaN),
  ])
    expect(() => buildPlinkoRoute(bits)).toThrow();
});

it("keeps each peg contact visible for two frames before the rebound", () => {
  const route = buildPlinkoRoute(Array(12).fill(1));
  route.contacts.forEach((contact, row) => {
    expect(
      samplePlinko(
        route,
        PLINKO_ENTRY_MS + row * PLINKO_HOP_MS + PLINKO_CONTACT_MS - 1,
      ),
    ).toEqual(contact);
  });
});
