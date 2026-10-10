import { it, expect } from "vitest";
import { racePosition } from "./casinoFrontierMotion";
it("ships advance continuously and cross in the committed order", () => {
  for (let place = 0; place < 4; place++)
    for (const profile of [0, 250, 500, 999]) {
      const finish = 4.3 + place * 0.46;
      expect(racePosition(finish, place, profile)).toBeCloseTo(1, 12);
      expect(racePosition(0, place, profile)).toBe(0);
      let previous = 0;
      for (let t = 0; t <= 6.5; t += 0.005) {
        const x = racePosition(t, place, profile);
        expect(x).toBeGreaterThanOrEqual(previous);
        expect(x - previous).toBeLessThan(0.004);
        previous = x;
      }
    }
});
