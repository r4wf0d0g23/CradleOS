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

import {
  laiFragmentPose,
  LAI_FRAGMENTS,
  LAI_HULL,
  LAI_SECONDS,
  LAI_TERMINAL_SPEED,
} from "./casinoLaiMotion";
describe("Lai inertial flight", () => {
  it("integrates velocity and preserves position/velocity through both cutoff branches", () => {
    const e = 1e-6,
      cut = LAI_ACCELERATION_END;
    for (const limit of [19999, 20000]) {
      for (const t of [0.2, 0.5, cut - 0.001, cut + 0.001, 0.85]) {
        const a = laiJumpPose(t - e, limit, 20000, true),
          b = laiJumpPose(t + e, limit, 20000, true),
          p = laiJumpPose(t, limit, 20000, true);
        expect((b.worldX - a.worldX) / (2 * e * LAI_SECONDS)).toBeCloseTo(
          p.velocity,
          4,
        );
      }
      const before = laiJumpPose(cut - e, limit, 20000, true),
        after = laiJumpPose(cut + e, limit, 20000, true);
      expect(Math.abs(after.worldX - before.worldX)).toBeLessThan(0.002);
      expect(Math.abs(after.velocity - before.velocity)).toBeLessThan(0.001);
      expect(Math.abs(after.cameraX - before.cameraX)).toBeLessThan(0.002);
    }
  });
  it("never stretches, banks, reverses, or dissolves an in-frame winning hull", () => {
    let previous = 0;
    for (let i = 0; i <= 1000; i++) {
      const p = laiJumpPose(i / 1000, 30000, 20000, true);
      expect(p.stretch).toBe(1);
      expect(p.bank).toBe(0);
      expect(p.y).toBe(160);
      expect(p.x).toBeGreaterThanOrEqual(previous);
      previous = p.x;
      if (p.x < 580) expect(p.hullOpacity).toBe(1);
    }
  });
  it("fractures in place and preserves mass-weighted linear and angular momentum", () => {
    const cut = laiJumpPose(LAI_ACCELERATION_END, 10000, 20000, true);
    const mass = LAI_FRAGMENTS.reduce((s, f) => s + f.mass, 0),
      inertia = LAI_FRAGMENTS.reduce((s, f) => s + f.inertia, 0);
    for (let i = 0; i < LAI_FRAGMENTS.length; i++) {
      const f = LAI_FRAGMENTS[i],
        p = laiFragmentPose(LAI_ACCELERATION_END, i);
      expect(p.x - f.cx).toBeCloseTo(cut.x, 8);
      expect(p.y - f.cy).toBe(160);
      expect(p.angle).toBeCloseTo(0, 10);
    }
    expect(
      LAI_FRAGMENTS.reduce((s, f) => s + f.mass * f.vx, 0) / mass,
    ).toBeCloseTo(0, 10);
    expect(
      LAI_FRAGMENTS.reduce((s, f) => s + f.mass * f.vy, 0) / mass,
    ).toBeCloseTo(0, 10);
    expect(
      LAI_FRAGMENTS.reduce((s, f) => s + f.inertia * f.spin, 0) / inertia,
    ).toBeCloseTo(0, 10);
    const cx = LAI_FRAGMENTS.reduce((s, f) => s + f.mass * f.cx, 0) / mass;
    const cy = LAI_FRAGMENTS.reduce((s, f) => s + f.mass * f.cy, 0) / mass;
    expect(
      LAI_FRAGMENTS.reduce(
        (s, f) => s + f.mass * ((f.cx - cx) * f.vy - (f.cy - cy) * f.vx),
        0,
      ) / mass,
    ).toBeCloseTo(0, 8);
  });
  it("keeps debris velocity constant after separation, with no drag or gravity", () => {
    for (let i = 0; i < LAI_FRAGMENTS.length; i++) {
      const a = laiFragmentPose(0.8, i),
        b = laiFragmentPose(0.9, i),
        c = laiFragmentPose(1, i);
      expect(b.worldX - a.worldX).toBeCloseTo(c.worldX - b.worldX, 8);
      expect(b.y - a.y).toBeCloseTo(c.y - b.y, 8);
      expect((b.worldX - a.worldX) / (0.1 * LAI_SECONDS)).toBeCloseTo(
        LAI_TERMINAL_SPEED + LAI_FRAGMENTS[i].vx,
        8,
      );
      expect(b.angle - a.angle).toBeCloseTo(c.angle - b.angle, 8);
    }
  });
  it("uses aft projected engine attachment points and cuts thrust immediately on failure", () => {
    expect(LAI_HULL.engines).toHaveLength(3);
    expect(LAI_HULL.engines.every((e) => e.x < 0)).toBe(true);
    expect(laiJumpPose(0.71, 10000, 20000, true).thrust).toBe(1);
    expect(laiJumpPose(0.72, 10000, 20000, true).thrust).toBe(0);
    expect(laiJumpPose(0, 0, 20000, false).thrust).toBe(0);
  });
});
