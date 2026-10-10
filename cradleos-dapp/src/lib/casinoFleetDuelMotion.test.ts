import { describe, it, expect } from "vitest";
import {
  fleetWinner,
  fleetCardPose,
  fleetShipPose,
  fleetDamage,
  fleetShots,
  fleetShotPose,
  fleetFragmentPose,
  FLEET_REVEAL,
  FLEET_IMPACTS,
  FLEET_RESOLVE,
  FLEET_SECONDS,
  type FleetSide,
} from "./casinoFleetDuelMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
import { tableDuration } from "./casinoTableMotion";
import { initialSession, playSession, restoreSession } from "./casinoSessions";
describe("Fleet Duel committed-result choreography", () => {
  it("every rank pairing preserves winner/tie and only destroys the losing wing", () => {
    for (let a = 0; a < 13; a++)
      for (let b = 0; b < 13; b++) {
        const w = fleetWinner(a, b);
        expect(w).toBe(a === b ? null : a > b ? 0 : 1);
        for (const side of [0, 1] as FleetSide[])
          for (let i = 0; i < 3; i++) {
            expect(
              fleetDamage(FLEET_IMPACTS[i] - 1e-6, side, i, w, true).destroyed,
            ).toBe(false);
            const final = fleetDamage(1, side, i, w, true);
            expect(final.destroyed).toBe(w !== null && side !== w);
            expect(final.flash).toBe(0);
            expect(fleetDamage(1, side, i, w, false).destroyed).toBe(false);
          }
        const lethal = fleetShots(w).filter((s) => s.lethal);
        expect(lethal.length).toBe(w === null ? 0 : 3);
        expect(lethal.every((s) => s.side === w)).toBe(true);
      }
  });
  it("reveals both ranks before combat and leaves enough settle time for effects", () => {
    for (const side of [0, 1] as FleetSide[]) {
      expect(fleetCardPose(1, side, false).shown).toBe(false);
      expect(fleetCardPose(FLEET_REVEAL[side] - 1e-6, side, true).shown).toBe(
        false,
      );
      expect(fleetCardPose(FLEET_REVEAL[side], side, true).shown).toBe(true);
      expect(fleetCardPose(1, side, true).angle).toBe(0);
    }
    expect(Math.max(...FLEET_REVEAL)).toBeLessThan(
      Math.min(...fleetShots(0).map((s) => s.fire)),
    );
    expect(
      (FLEET_RESOLVE - Math.max(...FLEET_IMPACTS)) * FLEET_SECONDS,
    ).toBeGreaterThan(0.32);
  });
  it("bolts leave firing hulls and reach actual moving target centers at impact", () => {
    for (const w of [null, 0, 1] as (FleetSide | null)[])
      for (const s of fleetShots(w)) {
        const begin = fleetShotPose(s.fire, s),
          end = fleetShotPose(s.hit, s),
          target = fleetShipPose(s.hit, s.side === 0 ? 1 : 0, s.target);
        expect(begin.x).toBe(begin.from.x);
        expect(begin.y).toBe(begin.from.y);
        expect(end.x).toBeCloseTo(target.x, 10);
        expect(end.y).toBeCloseTo(target.y, 10);
        expect(begin.active).toBe(true);
        expect(end.active).toBe(false);
        for (let i = 1; i < 10; i++) {
          const p = fleetShotPose(s.fire + ((s.hit - s.fire) * i) / 10, s);
          expect((p.x - begin.x) * (s.side === 0 ? 1 : -1)).toBeGreaterThan(0);
        }
      }
  });
  it("reconstructs each fractured hull and preserves inertial separation", () => {
    for (const side of [0, 1] as FleetSide[])
      for (let ship = 0; ship < 3; ship++) {
        const p = fleetShipPose(FLEET_IMPACTS[ship], side, ship),
          later = fleetShipPose(FLEET_IMPACTS[ship] + 0.1, side, ship);
        expect((later.x - p.x) * p.direction).toBeGreaterThan(0);
        expect(p.heading).toBe(side === 0 ? 0 : 180);
        LAI_FRAGMENTS.forEach((f, i) => {
          const zero = fleetFragmentPose(0, i, p.scale),
            a = fleetFragmentPose(0.1, i, p.scale),
            b = fleetFragmentPose(0.2, i, p.scale);
          expect(zero.x).toBe(f.cx * p.scale);
          expect(zero.y).toBe(f.cy * p.scale);
          expect(zero.angle).toBeCloseTo(0, 10);
          expect(b.x - a.x).toBeCloseTo(a.x - zero.x, 10);
          expect(b.y - a.y).toBeCloseTo(a.y - zero.y, 10);
        });
      }
  });
  it("uses the existing owner clock with unchanged committed win/loss/tie settlement", () => {
    for (const [a, b, bps] of [
      [12, 0, 20000],
      [0, 12, 0],
      [7, 7, 5000],
    ]) {
      let i = 0;
      const s = playSession(
        initialSession(),
        "war",
        2500,
        {},
        {},
        () => [a, b][i++],
      );
      const r = s.history[0];
      expect(r.values).toEqual([a, b]);
      expect(r.payout).toBe((r.stake * bps) / 10000);
      expect(restoreSession(JSON.stringify(s))).toEqual(
        JSON.parse(JSON.stringify(s)),
      );
      expect(tableDuration(r)).toBe(4100);
      expect(tableDuration(r) - 100).toBe(FLEET_SECONDS * 1000);
    }
  });
});
