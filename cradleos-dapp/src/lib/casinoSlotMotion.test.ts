import { describe, it, expect } from "vitest";
import { spinFleet, FLEET_KEYS, WILD } from "./casinoSlotFleet";
import {
  reelStrip,
  reelTravelKeyframes,
  reelTravelProgress,
  cascadePlacement,
  fallKeyframes,
  slotMotionPlan,
  slotRevealMs,
  REEL_STOPS,
  socketLanding,
} from "./casinoSlotMotion";
const rng =
  (seed = 71829) =>
  (bound: number) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % bound;
  };
describe("presentation motion contracts", () => {
  it("keeps velocity continuous at acceleration/cruise/braking boundaries", () => {
    const delta = 0.00001;
    for (const at of [0.18, 0.58]) {
      const left =
        (reelTravelProgress(at) - reelTravelProgress(at - delta)) / delta;
      const right =
        (reelTravelProgress(at + delta) - reelTravelProgress(at)) / delta;
      expect(Math.abs(left - right)).toBeLessThan(0.001);
    }
    expect(reelTravelProgress(0)).toBe(0);
    expect(reelTravelProgress(1)).toBeCloseTo(1, 12);
    expect(
      (reelTravelProgress(1) - reelTravelProgress(1 - delta)) / delta,
    ).toBeLessThan(0.001);
    const frames = reelTravelKeyframes(4000);
    expect(frames.length).toBeLessThan(65);
    for (let i = 1; i < 61; i++)
      expect(Number(frames[i].offset)).toBeGreaterThan(
        Number(frames[i - 1].offset),
      );
  });
  it("travels from the actual old rows into the exact saved original rows with bounded ordinary-only filler", () => {
    for (let c = 0; c < 5; c++)
      for (let rows = 2; rows <= 5; rows++) {
        const end = Array.from({ length: rows }, (_, r) => (c + r) % 9),
          before = Array.from({ length: rows }, (_, r) => (c + r + 3) % 9);
        const strip = reelStrip(end, c, before);
        expect(strip.slice(0, rows)).toEqual(end);
        expect(strip.slice(-rows)).toEqual(before);
        expect(strip.slice(rows, -rows).every((n) => n >= 0 && n < 7)).toBe(
          true,
        );
        expect(strip.length).toBeLessThanOrEqual(38);
        expect(strip).toEqual(reelStrip(end, c, before));
        const frames = reelTravelKeyframes(3000);
        expect(frames[0].transform).toContain("-3000px");
        expect(frames.slice(-1)[0]?.transform).toBe("translate3d(0,0,0)");
      }
  });
  it("maps every real collapsed survivor bijectively to its former position and admits refills only above the board", () => {
    const draw = rng();
    let compared = 0;
    for (const game of ["slot_reactor", "slot_feral"] as const)
      for (let i = 0; i < 300; i++) {
        const receipt = spinFleet(game, 2500, draw);
        for (let f = 1; f < receipt.frames.length; f++) {
          const now = receipt.frames[f],
            old = receipt.frames[f - 1];
          if (now.kind !== "cascade") continue;
          const winners = new Set(old.wins.flatMap((w) => w.cells));
          now.grid.forEach((col, c) => {
            const seen = new Set<number>();
            col.forEach((n, r) => {
              const p = cascadePlacement(old, c, r);
              if (p.inserted) expect(p.source).toBeLessThan(0);
              else {
                expect(n).toBe(old.grid[c][p.source]);
                expect(winners.has(c * 5 + p.source)).toBe(false);
                expect(seen.has(p.source)).toBe(false);
                seen.add(p.source);
              }
              expect(p.distance).toBeGreaterThanOrEqual(0);
              expect(p.delay).toBeGreaterThanOrEqual(260);
              expect(p.delay + p.duration).toBeLessThan(
                slotMotionPlan(game, now, old).rawStop,
              );
            });
            expect(seen.size).toBe(
              old.grid[c].length -
                [...winners].filter((id) => Math.floor(id / 5) === c).length,
            );
          });
          compared++;
        }
      }
    expect(compared).toBeGreaterThan(20);
  });
  it("places all stop/impact/expansion phases before the only parent completion deadline without mutating a receipt", () => {
    const draw = rng();
    for (const game of FLEET_KEYS)
      for (let i = 0; i < 30; i++) {
        const receipt = spinFleet(game, 2500, draw),
          snapshot = JSON.stringify(receipt);
        receipt.frames.forEach((frame, c) => {
          const p = slotMotionPlan(game, frame, receipt.frames[c - 1]);
          expect(p.finish).toBeLessThan(p.reveal);
          expect(slotRevealMs(receipt, c)).toBe(p.reveal);
          if (p.kind === "reels")
            expect(Math.max(...REEL_STOPS) + 22).toBeLessThan(p.finish);
          if (p.expand > p.rawStop) {
            expect(p.expand - p.rawStop).toBeGreaterThanOrEqual(300);
            expect(p.expand - 120 + 520).toBeLessThanOrEqual(p.finish);
          }
          if (p.kind === "hold")
            expect(socketLanding(4, 2) + 460).toBeLessThan(p.rawStop);
        });
        expect(JSON.stringify(receipt)).toBe(snapshot);
      }
  });
  it("treats a full initial Vault as collection, and transforms only genuine Gate wild columns", () => {
    const r = spinFleet("slot_vault", 2500, rng()),
      old = { ...r.frames[0], coins: Array(15).fill(1) };
    expect(slotMotionPlan("slot_vault", r.frames[0], old).kind).toBe("collect");
    const gate = spinFleet("slot_gatecrash", 2500, rng()).frames[0];
    const original = Array.from({ length: 5 }, () => [0, 1, 2]),
      grid = original.map((c) => [...c]);
    original[0][1] = WILD;
    grid[0] = [WILD, WILD, WILD];
    const plan = slotMotionPlan("slot_gatecrash", { ...gate, original, grid });
    expect(plan.expand).toBeGreaterThan(plan.rawStop);
    expect(
      slotMotionPlan("slot_gatecrash", { ...gate, original: grid, grid })
        .expand,
    ).toBe(1740);
    expect(fallKeyframes(155).slice(-1)[0]?.transform).toBe(
      "translate3d(0,0,0)",
    );
  });
});
