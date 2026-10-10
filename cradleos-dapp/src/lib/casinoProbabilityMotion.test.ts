import { describe, it, expect } from "vitest";
import {
  probabilityRollPose,
  probabilityPercent,
  PROBABILITY_LAND_AT,
} from "./casinoProbabilityMotion";
describe("Probability Drive committed landing", () => {
  it("converges continuously to every legal roll and holds it before unlock", () => {
    for (let roll = 1; roll <= 100; roll++) {
      const near = probabilityRollPose(PROBABILITY_LAND_AT - 1e-5, roll),
        land = probabilityRollPose(PROBABILITY_LAND_AT, roll);
      expect(Math.abs(near.position - roll)).toBeLessThan(0.00001);
      expect(land.position).toBe(roll);
      expect(land.number).toBe(roll);
      expect(land.landed).toBe(true);
      expect(probabilityRollPose(1, roll)).toEqual(land);
    }
  });
  it("keeps the marker/readout bounded and synchronized throughout all 100 outcomes", () => {
    for (let roll = 1; roll <= 100; roll++)
      for (let i = 0; i <= 300; i++) {
        const p = probabilityRollPose(i / 300, roll);
        expect(p.position).toBeGreaterThanOrEqual(1);
        expect(p.position).toBeLessThanOrEqual(100);
        expect(p.number).toBe(Math.round(1 + p.percent * 0.99));
        expect(p.landed).toBe(i / 300 >= PROBABILITY_LAND_AT);
      }
  });
  it("uses one 1–100 coordinate map for endpoints, ticks, targets and rolls", () => {
    expect(probabilityPercent(1)).toBe(0);
    expect(probabilityPercent(100)).toBe(100);
    for (const n of [1, 2, 10, 49, 50, 51, 90, 98, 99, 100])
      expect(probabilityRollPose(1, n).percent).toBe(probabilityPercent(n));
    expect(probabilityRollPose(0, 50).position).toBe(1);
  });
});
