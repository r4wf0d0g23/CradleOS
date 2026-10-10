import { describe, expect, it } from "vitest";
import {
  warpTravel,
  warpShipTravel,
  WARP_CLEAR_X,
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
      const p = warpPose(i / 1000, 15000, 20000, true);
      expect(p.y).toBe(155);
      expect(p.x).toBeGreaterThanOrEqual(x);
      x = p.x;
      expect(p.velocity).toBeGreaterThanOrEqual(0);
    }
    const a = warpPose(WARP_FAILURE_AT - 1e-6, 15000, 20000, true),
      b = warpPose(WARP_FAILURE_AT + 1e-6, 15000, 20000, true);
    expect(Math.abs(b.x - a.x)).toBeLessThan(0.001);
    expect(a.cameraX + a.cameraVelocity * WARP_SECONDS * 1e-6).toBeCloseTo(
      b.cameraX - b.cameraVelocity * WARP_SECONDS * 1e-6,
      8,
    );
    expect(Math.abs(b.cameraVelocity - a.cameraVelocity)).toBeLessThan(0.001);
  });
  it("fractures in place with zero net impulse and inherited forward velocity", () => {
    const p = warpPose(WARP_FAILURE_AT, 15000, 20000, true),
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
    expect(warpPose(WARP_FAILURE_AT - 1e-6, 15000, 20000, true).thrust).toBe(1);
    expect(warpPose(WARP_FAILURE_AT, 15000, 20000, true).thrust).toBe(0);
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
            expect(p.failed).toBe(limit < target);
            if (limit >= target) expect(p.flash).toBe(0);
          }
        }
    expect(warpMultiplierLabel(19999.9, 20000)).toBe("1.9999×");
    expect(warpMultiplierLabel(20000, 20000)).toBe("2.00×");
    for (const roll of [0, 250, 999]) {
      const r = expandedOutcome("crash", { target: 200 }, () => roll);
      expect(warpPose(1, r.values[0], r.values[1], true).paid).toBe(r.bps > 0);
    }
  });
  it("warps successful runs at auto-stop and never explodes, including exact-target wins", () => {
    for (const [limit, target] of [
      [40000, 10100],
      [40000, 20000],
      [20000, 20000],
      [20001, 20000],
      [10000000, 10000000],
    ]) {
      const cross = Math.log(target / 10000) / Math.log(limit / 10000),
        at = cross * WARP_FAILURE_AT;
      for (let i = 0; i <= 1000; i++) {
        const t = i / 1000,
          p = warpPose(t, limit, target, true);
        expect(p.failed).toBe(false);
        expect(p.flash).toBe(0);
        expect(p.paid).toBe(t >= at);
        if (t < at) expect(p.phase).toBe("flight");
        if (p.paid && !p.escaped) expect(p.phase).toBe("warping");
        if (p.hullOpacity === 0) expect(p.x).toBeGreaterThan(WARP_CLEAR_X);
      }
      const final = warpPose(1, limit, target, true);
      expect(final.phase).toBe("warped");
      expect(final.multiplier).toBe(limit);
      expect(final.hullOpacity).toBe(0);
      expect(final.wake).toBe(0);
      expect(final.thrust).toBe(0);
      const h = 1e-6,
        a = warpPose(at - h, limit, target, true),
        b = warpPose(at + h, limit, target, true);
      expect(
        a.x + (a.velocity - a.cameraVelocity) * WARP_SECONDS * h,
      ).toBeCloseTo(
        b.x - (b.velocity - b.cameraVelocity) * WARP_SECONDS * h,
        7,
      );
      expect(Math.abs(b.velocity - a.velocity)).toBeLessThan(0.002);
      for (const s of [at * WARP_SECONDS + 0.1, at * WARP_SECONDS + 0.4]) {
        expect(
          (warpShipTravel(s + h, at * WARP_SECONDS).distance -
            warpShipTravel(s - h, at * WARP_SECONDS).distance) /
            (2 * h),
        ).toBeCloseTo(warpShipTravel(s, at * WARP_SECONDS).velocity, 5);
      }
    }
  });
  it("lets the historical wake clear independently after the intact hull exits", () => {
    const leaving = warpPose(0.94, 20000, 20000, true);
    expect(leaving.escaped).toBe(true);
    expect(leaving.wake).toBe(1);
    expect(warpPose(1, 20000, 20000, true).wake).toBe(0);
  });
  it("keeps losses and ready state free of successful departures", () => {
    for (const limit of [9800, 10000, 19999]) {
      const p = warpPose(1, limit, 20000, true);
      expect(p.phase).toBe("ended");
      expect(p.failed).toBe(true);
      expect(p.escaped).toBe(false);
      expect(p.hullOpacity).toBe(0);
      expect(p.flash).toBe(0);
      expect(p.wake).toBe(0);
    }
    const ready = warpPose(1, 10000, 20000, false);
    expect(ready.phase).toBe("ready");
    expect(ready.thrust).toBe(0);
    expect(ready.wake).toBe(0);
    expect(ready.paid).toBe(false);
    expect(ready.hullOpacity).toBe(1);
  });
});
