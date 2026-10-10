import { describe, it, expect } from "vitest";
import {
  diePose,
  dieLight,
  tokenPose,
  DIE_CONTACTS,
  bearingBall,
} from "./casinoObjectMotion";
describe("committed physical objects", () => {
  it("all six dice finish facing the camera, grounded, with no endpoint jump", () => {
    const target = [
      [0, 0],
      [0, -90],
      [90, 0],
      [-90, 0],
      [0, 90],
      [0, 180],
    ];
    for (let face = 1; face <= 6; face++)
      for (let index = 0; index < 3; index++) {
        const end = diePose(1, face, index),
          near = diePose(0.99999, face, index);
        expect(end.x).toBe(0);
        expect(end.height).toBe(0);
        expect(end.rx).toBe(720 + target[face - 1][0]);
        expect(end.ry).toBe(1080 + target[face - 1][1]);
        expect(end.rz).toBeCloseTo(0);
        expect(Math.abs(near.rx - end.rx)).toBeLessThan(0.001);
        expect(dieLight(face - 1, end.rx, end.ry)).toBeGreaterThan(0.9);
        for (const contact of DIE_CONTACTS)
          expect(diePose(contact, face, index).height).toBeCloseTo(0);
      }
  });
  it("trajectories remain finite, above the contact plane, and cast lighter shadows aloft", () => {
    for (let k = 0; k <= 1000; k++)
      for (let index = 0; index < 3; index++) {
        const p = diePose(k / 1000, 6, index);
        expect(Object.values(p).every(Number.isFinite)).toBe(true);
        expect(p.height).toBeGreaterThanOrEqual(-1e-9);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(34);
      }
    expect(diePose(0.1, 1, 0).shadow).toBeLessThan(diePose(1, 1, 0).shadow);
  });
  it("both token faces land before a diminishing wobble and finish on the exact committed side", () => {
    for (const face of [0, 1]) {
      const end = tokenPose(1, face),
        near = tokenPose(0.99999, face);
      expect(end.angle % 360).toBe(face * 180);
      expect(end.lift).toBe(0);
      expect(end.tilt).toBeCloseTo(0);
      expect(end.depthTilt).toBeCloseTo(60);
      expect(tokenPose(0.76, face).lift).toBeCloseTo(0);
      expect(tokenPose(0.81, face).lift).toBeGreaterThan(0);
      expect(Math.abs(near.tilt)).toBeLessThan(0.001);
    }
  });
});

import { wheelAngle } from "./casinoTableMotion";
it("roulette capture locks to the committed pocket throughout the final co-rotation", () => {
  for (let i = 0; i < 37; i++) {
    const end = wheelAngle(1, i, 37);
    for (const t of [0.86, 0.9, 0.95, 1]) {
      const rotor = wheelAngle(t, i, 37),
        p = bearingBall(t, rotor, end),
        theta = ((-90 + rotor - end) * Math.PI) / 180;
      expect(p.x).toBeCloseTo(160 + Math.cos(theta) * 109, 6);
      expect(p.y).toBeCloseTo(160 + Math.sin(theta) * 109, 6);
    }
    const almost = bearingBall(0.99999, wheelAngle(0.99999, i, 37), end),
      last = bearingBall(1, end, end);
    expect(Math.hypot(almost.x - last.x, almost.y - last.y)).toBeLessThan(
      0.001,
    );
  }
});
