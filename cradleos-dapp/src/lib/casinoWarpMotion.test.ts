import { describe, expect, it } from "vitest";
import {
  warpTravel,
  warpPose,
  warpFragmentPose,
  warpMultiplierLabel,
  WARP_SECONDS,
  WARP_RAMP_SECONDS,
  WARP_FAILURE_SECONDS,
  WARP_FAILURE_AT,
  WARP_HULL_SCALE,
} from "./casinoWarpMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
import { expandedOutcome } from "./casinoExpanded";
describe("Warp Run inertial presentation", () => {
  it("starts at rest and integrates velocity continuously through ignition and drive cutoff", () => {
    expect(warpTravel(0)).toEqual({
      distance: 0,
      velocity: 0,
      acceleration: 0,
    });
    const h = 1e-6;
    for (const s of [
      0.08,
      0.3,
      0.8,
      WARP_FAILURE_SECONDS - 0.01,
      WARP_FAILURE_SECONDS + 0.01,
      2.5,
    ])
      expect(
        (warpTravel(s + h).distance - warpTravel(s - h).distance) / (2 * h),
      ).toBeCloseTo(warpTravel(s).velocity, 5);
    for (const cut of [WARP_RAMP_SECONDS, WARP_FAILURE_SECONDS]) {
      const a = warpTravel(cut - h),
        b = warpTravel(cut + h);
      expect(a.distance + a.velocity * h).toBeCloseTo(
        b.distance - b.velocity * h,
        8,
      );
      expect(Math.abs(b.velocity - a.velocity)).toBeLessThan(0.001);
    }
  });
  it("keeps heading/height rigid and camera position/velocity continuous at breakup", () => {
    let x = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const p = warpPose(i / 1000, 40000, 20000, true);
      expect(p.y).toBe(155);
      expect(p.x).toBeGreaterThanOrEqual(x);
      x = p.x;
      expect(p.velocity).toBeGreaterThanOrEqual(0);
    }
    const a = warpPose(WARP_FAILURE_AT - 1e-6, 40000, 20000, true),
      b = warpPose(WARP_FAILURE_AT + 1e-6, 40000, 20000, true);
    expect(Math.abs(b.x - a.x)).toBeLessThan(0.001);
    expect(a.cameraX + a.cameraVelocity * WARP_SECONDS * 1e-6).toBeCloseTo(
      b.cameraX - b.cameraVelocity * WARP_SECONDS * 1e-6,
      8,
    );
    expect(Math.abs(b.cameraVelocity - a.cameraVelocity)).toBeLessThan(0.001);
  });
  it("fractures in place with zero net impulse and inherited forward velocity", () => {
    const p = warpPose(WARP_FAILURE_AT, 40000, 20000, true),
      mass = LAI_FRAGMENTS.reduce((s, f) => s + f.mass, 0);
    for (const [i, f] of LAI_FRAGMENTS.entries()) {
      const q = warpFragmentPose(WARP_FAILURE_AT, i);
      expect(q.x - f.cx * WARP_HULL_SCALE).toBeCloseTo(p.x, 8);
      expect(q.y - f.cy * WARP_HULL_SCALE).toBeCloseTo(p.y, 8);
      expect(q.angle).toBeCloseTo(0, 10);
    }
    expect(
      LAI_FRAGMENTS.reduce(
        (s, f, i) => s + f.mass * warpFragmentPose(WARP_FAILURE_AT, i).vx,
        0,
      ) / mass,
    ).toBeCloseTo(p.velocity, 9);
    expect(
      LAI_FRAGMENTS.reduce(
        (s, f, i) => s + f.mass * warpFragmentPose(WARP_FAILURE_AT, i).vy,
        0,
      ) / mass,
    ).toBeCloseTo(0, 9);
  });
  it("lets fragments coast without drag/gravity and cuts thrust immediately", () => {
    for (let i = 0; i < LAI_FRAGMENTS.length; i++) {
      const a = warpFragmentPose(0.8, i),
        b = warpFragmentPose(0.9, i),
        c = warpFragmentPose(1, i);
      expect(b.worldX - a.worldX).toBeCloseTo(c.worldX - b.worldX, 9);
      expect(b.y - a.y).toBeCloseTo(c.y - b.y, 9);
      expect(b.angle - a.angle).toBeCloseTo(c.angle - b.angle, 9);
      expect((b.worldX - a.worldX) / (0.1 * WARP_SECONDS)).toBeCloseTo(a.vx, 9);
    }
    expect(warpPose(WARP_FAILURE_AT - 1e-6, 40000, 20000, true).thrust).toBe(1);
    expect(warpPose(WARP_FAILURE_AT, 40000, 20000, true).thrust).toBe(0);
  });
  it("never invents an auto-stop win at sub-one, exact, near-target or maximum boundaries", () => {
    for (const target of [10100, 20000, 10000000])
      for (const limit of [
        9800,
        10000,
        target - 1,
        target,
        target + 1,
        10000000,
      ])
        for (const t of [
          0,
          0.2,
          0.5,
          WARP_FAILURE_AT - 1e-8,
          WARP_FAILURE_AT,
          0.9,
          1,
        ]) {
          const p = warpPose(t, limit, target, true);
          expect(
            [p.x, p.y, p.multiplier, p.velocity, p.flash].every(
              Number.isFinite,
            ),
          ).toBe(true);
          if (limit < target) expect(p.paid).toBe(false);
          if (limit === target && t < WARP_FAILURE_AT)
            expect(p.paid).toBe(false);
          if (t >= WARP_FAILURE_AT) {
            expect(p.multiplier).toBe(limit);
            expect(p.paid).toBe(limit >= target);
          }
        }
    expect(warpMultiplierLabel(19999.9, 20000)).toBe("1.9999×");
    expect(warpMultiplierLabel(20000, 20000)).toBe("2.00×");
    for (const roll of [0, 250, 999]) {
      const r = expandedOutcome("crash", { target: 200 }, () => roll);
      expect(warpPose(1, r.values[0], r.values[1], true).paid).toBe(r.bps > 0);
    }
  });
  it("keeps flight independent of auto-stop and ends transient effects before settle", () => {
    const a = warpPose(0.5, 40000, 10100, true),
      b = warpPose(0.5, 40000, 10000000, true);
    expect(a.paid).toBe(true);
    expect(b.paid).toBe(false);
    expect([a.x, a.y, a.velocity, a.cameraX]).toEqual([
      b.x,
      b.y,
      b.velocity,
      b.cameraX,
    ]);
    for (const t of [0.9, 1]) {
      const p = warpPose(t, 40000, 20000, true);
      expect(p.flash).toBe(0);
      expect(p.wake).toBe(0);
    }
    const ready = warpPose(1, 10000, 20000, false);
    expect(ready.phase).toBe("ready");
    expect(ready.thrust).toBe(0);
    expect(ready.wake).toBe(0);
    expect(ready.paid).toBe(false);
  });
});
