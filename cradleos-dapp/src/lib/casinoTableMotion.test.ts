import { describe, it, expect } from "vitest";
import {
  wheelAngle,
  rouletteBall,
  coinPose,
  blackjackPlan,
} from "./casinoTableMotion";
import {
  initialSession,
  playSession,
  actSession,
  restoreSession,
  revealClassicSpin,
  startSpinRun,
  advanceSpinRun,
  revealSlot,
  pendingSlot,
  spinRunTotals,
  stopSpinRun,
  activeSession,
} from "./casinoSessions";
import { FLEET_KEYS } from "./casinoSlotFleet";
const seeded = (seed: number) => {
  let x = seed >>> 0;
  return (bound: number) => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return x % bound;
  };
};
describe("physical outcome endpoints and native deal order", () => {
  it("every equiprobable wheel pocket rests under pointer with a ball at its center", () => {
    for (const n of [20, 37, 54])
      for (let i = 0; i < n; i++) {
        const a = wheelAngle(1, i, n);
        const error = (((a + (i * 360) / n) % 360) + 360) % 360;
        expect(Math.min(error, 360 - error)).toBeLessThan(1e-8);
        const ball = rouletteBall(1, a);
        expect(ball.x).toBeCloseTo(160);
        expect(ball.y).toBeCloseTo(33);
        expect(wheelAngle(0.99, i, n)).toBeLessThan(a);
      }
  });
  it("roulette ball counter-rotates against the wheel before pocket landing", () => {
    const p = rouletteBall(0.1, 0),
      q = rouletteBall(0.101, 0);
    expect((p.x - 160) * (q.y - 160) - (p.y - 160) * (q.x - 160)).toBeLessThan(
      0,
    );
    expect(wheelAngle(0.101, 5, 37)).toBeGreaterThan(wheelAngle(0.1, 5, 37));
  });
  it("coin lands continuously on the committed face with no remaining lift", () => {
    for (const face of [0, 1]) {
      const pose = coinPose(1, face);
      expect(pose.angle % 360).toBe(face * 180);
      expect(pose.lift).toBeCloseTo(0);
      expect(pose.tilt).toBeCloseTo(0);
      expect(Math.abs(coinPose(0.999, face).angle - pose.angle)).toBeLessThan(
        0.001,
      );
    }
  });
  it("split keeps unrelated seats stationary; only new cards and moved split card are staged", () => {
    let s;
    for (let seed = 1; seed < 5000; seed++) {
      const candidate = playSession(
        initialSession(),
        "blackjack",
        100,
        {},
        { seats: 3 },
        seeded(seed),
      );
      if (
        candidate.table?.active === 0 &&
        candidate.table.hands[0].cards[0] % 13 ===
          candidate.table.hands[0].cards[1] % 13
      ) {
        s = candidate;
        break;
      }
    }
    expect(s).toBeDefined();
    const next = actSession(s!, "split"),
      plan = blackjackPlan(next, s);
    expect(restoreSession(JSON.stringify(next))).toEqual(next);
    expect(plan.events.filter((e) => e.row >= 2)).toEqual([]);
    expect(plan.events.filter((e) => e.row >= 0).length).toBe(3);
  });
  it("initial three-seat deal alternates in two passes before dealer hole reveal and any draw", () => {
    const s = playSession(
        initialSession(),
        "blackjack",
        100,
        {},
        { seats: 3 },
        seeded(23),
      ),
      plan = blackjackPlan(s);
    expect(plan.events.slice(0, 8).map((e) => [e.row, e.index])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [-1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [-1, 1],
    ]);
  });
});
describe("batch and one-spin engine equivalence", () => {
  it("all nine games at all four finite counts conserve balance and reveal counters across reload", () => {
    for (const game of ["slots", ...FLEET_KEYS] as const)
      for (const count of [1, 3, 5, 10]) {
        const runRng = seeded(102),
          singleRng = seeded(102);
        let run = startSpinRun(initialSession(), game, 100, count, runRng),
          one = initialSession();
        for (let n = 0; n < count; n++) {
          one = playSession(one, game, 100, {}, {}, singleRng);
          expect(run.pack?.rounds).toEqual(one.pack?.rounds);
          expect(run.balance).toBe(one.balance);
          expect(run.spinRun?.paid).toBe(n + 1);
          expect(run.spinRun?.shown).toBe(n);
          expect(spinRunTotals(run).stake).toBe(n * 100);
          run = pendingSlot(run)
            ? revealSlot(run, true)
            : revealClassicSpin(run);
          one = pendingSlot(one) ? revealSlot(one, true) : one;
          run = restoreSession(JSON.stringify(run));
          expect(run.notice).toBeUndefined();
          if (n + 1 < count) run = advanceSpinRun(run, runRng);
        }
        expect(run.spinRun?.shown).toBe(count);
        expect(activeSession(run)).toBe(false);
        expect(spinRunTotals(run).stake).toBe(count * 100);
      }
  });
  it("stopping a paid pending bonus never unlocks or discards it; next unrelated hand removes run metadata", () => {
    for (const game of ["slots", ...FLEET_KEYS] as const) {
      let s = stopSpinRun(
        startSpinRun(initialSession(), game, 100, 5, seeded(3)),
      );
      expect(activeSession(s)).toBe(true);
      expect(() => playSession(s, "coinflip", 100)).toThrow();
      s = pendingSlot(s) ? revealSlot(s, true) : revealClassicSpin(s);
      expect(activeSession(s)).toBe(false);
      s = playSession(s, "blackjack", 100, {}, {}, seeded(8));
      expect(s.spinRun).toBeUndefined();
      expect(restoreSession(JSON.stringify(s))).toEqual(s);
    }
  });
});
