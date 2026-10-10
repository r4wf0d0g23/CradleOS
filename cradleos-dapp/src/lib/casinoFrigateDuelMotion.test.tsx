import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CasinoFrigateDuel } from "../components/CasinoFrigateDuel";
import {
  frigateWinner,
  frigatePose,
  frigatePoint,
  frigateShots,
  frigateShotPose,
  frigateDamage,
  frigateFragmentPose,
  frigateCardProgress,
  FRIGATE_REVEAL,
  FRIGATE_IMPACT,
  FRIGATE_RESOLVE,
  FRIGATE_SECONDS,
  type FrigateSide,
} from "./casinoFrigateDuelMotion";
import { LAI_FRAGMENTS } from "./casinoLaiMotion";
import { initialSession, playSession, restoreSession } from "./casinoSessions";
import { tableDuration, STILL_RUN } from "./casinoTableMotion";
const sides = [0, 1] as FrigateSide[];
function session(a: number, b: number, side: number, stake = 2501) {
  const ca = a * 4,
    cb = b * 4 + (a === b ? 1 : 0),
    draws = [ca, cb < ca ? cb : cb - 1];
  let i = 0;
  return playSession(
    initialSession(),
    "dragon_tiger",
    stake,
    { side },
    {},
    () => draws[i++],
  );
}
describe("Frigate Duel committed-result presentation", () => {
  it("all169rank pairs and3bets preserve settlement; only the lower-ranked hull breaks apart", () => {
    for (let a = 0; a < 13; a++)
      for (let b = 0; b < 13; b++)
        for (let bet = 0; bet < 3; bet++) {
          const s = session(a, b, bet),
            r = s.history[0],
            winner = frigateWinner(a, b),
            actual = winner === null ? 2 : winner;
          expect(r.values).toEqual([a, b]);
          expect(r.payout).toBe(
            Math.floor(
              r.stake *
                (actual === bet ? (bet === 2 ? 9 : 2) : actual === 2 ? 0.5 : 0),
            ),
          );
          expect(restoreSession(JSON.stringify(s))).toEqual(
            JSON.parse(JSON.stringify(s)),
          );
          for (const side of sides) {
            expect(
              frigateDamage(FRIGATE_IMPACT - 1e-8, side, winner, true)
                .destroyed,
            ).toBe(false);
            expect(frigateDamage(1, side, winner, true).destroyed).toBe(
              winner !== null && winner !== side,
            );
            expect(frigateDamage(1, side, winner, false).destroyed).toBe(false);
            expect(frigateDamage(1, side, winner, true).flash).toBe(0);
          }
          expect(frigateShots(winner).filter((s) => s.lethal)).toHaveLength(
            winner === null ? 0 : 1,
          );
        }
  });
  it("heading and constant velocity agree; fragments reconstruct the hull and inherit momentum exactly once", () => {
    for (const side of sides) {
      const a = frigatePose(FRIGATE_IMPACT, side),
        b = frigatePose(FRIGATE_IMPACT + 0.1, side),
        heading = (a.heading * Math.PI) / 180;
      expect((b.x - a.x) / (0.1 * FRIGATE_SECONDS)).toBeCloseTo(a.vx, 10);
      expect((b.y - a.y) / (0.1 * FRIGATE_SECONDS)).toBeCloseTo(a.vy, 10);
      expect(Math.atan2(a.vy, a.vx)).toBeCloseTo(heading, 10);
      LAI_FRAGMENTS.forEach((f, i) => {
        const z = frigateFragmentPose(0, i),
          p = frigateFragmentPose(0.1, i),
          q = frigateFragmentPose(0.2, i);
        expect(z.x).toBe(f.cx * a.scale);
        expect(z.y).toBe(f.cy * a.scale);
        expect(z.angle).toBeCloseTo(0, 10);
        expect(q.x - p.x).toBeCloseTo(p.x - z.x, 10);
        expect(q.y - p.y).toBeCloseTo(p.y - z.y, 10);
      });
    }
  });
  it("bolts leave the muzzle and reach the future transformed hull front on a straight path", () => {
    for (const winner of [null, 0, 1] as (FrigateSide | null)[])
      for (const shot of frigateShots(winner)) {
        const a = frigateShotPose(shot.fire, shot),
          b = frigateShotPose(shot.hit, shot),
          target = frigatePoint(shot.hit, shot.side === 0 ? 1 : 0, 32),
          mid = frigateShotPose((shot.hit + shot.fire) / 2, shot);
        expect(a.active).toBe(true);
        expect(b.active).toBe(false);
        expect(a.x).toBe(a.from.x);
        expect(b.x).toBeCloseTo(target.x, 10);
        expect(b.y).toBeCloseTo(target.y, 10);
        expect(mid.x).toBeCloseTo((a.x + b.x) / 2, 10);
        expect(mid.y).toBeCloseTo((a.y + b.y) / 2, 10);
        const ship = frigatePose(shot.fire, shot.side);
        expect((b.x - a.x) * ship.vx + (b.y - a.y) * ship.vy).toBeGreaterThan(
          0,
        );
      }
  });
  it("conceals ranks and result-dependent DOM before reveal; both cards finish flipping before combat", () => {
    const render = (a: number, b: number, t: number) =>
      renderToStaticMarkup(
        <CasinoFrigateDuel
          round={session(a, b, 0).history[0]}
          t={t}
          animated={false}
          run={STILL_RUN}
        />,
      );
    const back = render(0, 12, 0.05);
    for (const [a, b] of [
      [12, 0],
      [7, 7],
      [3, 8],
    ])
      expect(render(a, b, 0.05)).toBe(back);
    expect(back).not.toContain("data-value=");
    expect(back).not.toContain("data-outcome=");
    expect(back).not.toContain("frigate-bolt");
    for (const side of sides) {
      expect(
        frigateCardProgress(FRIGATE_REVEAL[side] - 1e-8, side, true),
      ).toBeLessThan(0.5);
      expect(frigateCardProgress(FRIGATE_REVEAL[side], side, true)).toBe(0.5);
      expect(frigateCardProgress(0.35, side, true)).toBe(1);
    }
    for (const [a, b] of [
      [12, 0],
      [0, 12],
      [7, 7],
    ]) {
      const html = render(a, b, 1);
      for (const effect of [
        'class="frigate-bolt"',
        'class="frigate-shield"',
        'class="frigate-destruction"',
        'class="frigate-muzzle"',
      ])
        expect(html).not.toContain(effect);
      expect(html).toContain(
        a === b ? "STANDOFF" : a > b ? "DRAGON WINS" : "TIGER WINS",
      );
    }
  });
  it("resolves all transient effects before the existing owner unlocks, only extending this game", () => {
    expect(
      (FRIGATE_RESOLVE - FRIGATE_IMPACT) * FRIGATE_SECONDS,
    ).toBeGreaterThan(0.28);
    expect(tableDuration(session(12, 0, 0).history[0])).toBe(
      FRIGATE_SECONDS * 1000 + 100,
    );
    expect(
      tableDuration({ ...session(12, 0, 0).history[0], game: "red_dog" }),
    ).toBe(2000);
    expect(
      tableDuration({ ...session(12, 0, 0).history[0], game: "war" }),
    ).toBe(4100);
  });
});
