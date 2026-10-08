import { expect, it } from "vitest";
import { casinoMotionProgress } from "./casinoMotion";
it("clamps a preceding RAF timestamp before indexing reel and dice faces", () => {
  expect(casinoMotionProgress(995, 1000, 2240)).toBe(0);
  expect(casinoMotionProgress(1000, 1000, 2240)).toBe(0);
  expect(casinoMotionProgress(2120, 1000, 2240)).toBe(0.5);
  expect(casinoMotionProgress(5000, 1000, 2240)).toBe(1);
  for (let n = -50; n < 5000; n++) {
    const p = casinoMotionProgress(n, 0, 2240);
    expect(Math.floor(p * 28) % 7).toBeGreaterThanOrEqual(0);
    expect((Math.floor(p * 40) % 6) + 1).toBeGreaterThanOrEqual(1);
  }
});
