import { describe, it, expect } from "vitest";
import {
  laiJumpPose,
  laiSpeedLabel,
  LAI_ACCELERATION_END,
} from "./casinoLaiMotion";
import { expandedOutcome } from "./casinoExpanded";
describe("Lai committed jump presentation", () => {
  it("warps only at or above the exact committed threshold, including one-unit boundaries", () => {
    for (const target of [10100, 20000, 10000000])
      for (const limit of [target - 1, target, target + 1]) {
        expect(laiJumpPose(0.3, limit, target, true).phase).toBe(
          "accelerating",
        );
        const end = laiJumpPose(1, limit, target, true);
        expect(end.phase).toBe(limit >= target ? "warped" : "destroyed");
        expect(end.speed).toBe(Math.min(limit, target));
        expect(end.hullOpacity).toBe(0);
        for (let i = 0; i < 100; i++) {
          const p = laiJumpPose(i / 100, limit, target, true);
          expect(
            [p.x, p.y, p.speed, p.hullOpacity, p.flash, p.bank].every(
              Number.isFinite,
            ),
          ).toBe(true);
          expect(p.speed).toBeLessThanOrEqual(Math.min(limit, target));
        }
      }
  });
  it("rises continuously to the committed limit then keeps speed fixed through the exit sequence", () => {
    for (const limit of [9800, 19999, 20000, 10000000]) {
      let before = -1;
      for (let k = 0; k <= 1000; k++) {
        const p = laiJumpPose(k / 1000, limit, 20000, true);
        expect(p.speed).toBeGreaterThanOrEqual(before);
        before = p.speed;
      }
      expect(laiJumpPose(LAI_ACCELERATION_END, limit, 20000, true).speed).toBe(
        Math.min(limit, 20000),
      );
    }
    expect(laiJumpPose(1, 0, 20000, false).phase).toBe("ready");
  });
  it("does not round a failed jump up to target, and matches engine-produced wins and losses", () => {
    expect(laiSpeedLabel(19999, 20000)).toBe("1.9999×");
    expect(laiSpeedLabel(20000, 20000)).toBe("2.00×");
    for (const roll of [0, 250, 999]) {
      const o = expandedOutcome("limbo", { target: 200 }, () => roll);
      expect(laiJumpPose(1, o.values[0], o.values[1], true).win).toBe(
        o.bps > 0,
      );
    }
  });
});
