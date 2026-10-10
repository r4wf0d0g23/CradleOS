import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  salvageMotion,
  salvageRestAngle,
  salvageTravel,
  salvagePocket,
  salvagePointer,
  SALVAGE_STEP,
} from "./casinoSalvageWheel";
import { MONEY_TABLE } from "./casinoExpanded";
import { initialSession, playSession, restoreSession } from "./casinoSessions";
import { tableDuration, STILL_RUN } from "./casinoTableMotion";
import { CasinoSalvageWheel } from "../components/CasinoSalvageWheel";
describe("salvage winch presentation", () => {
  it("preserves all 54 equiprobable outcomes, engine payouts and restored receipt", () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 54; i++) {
      const s = playSession(
          initialSession(),
          "money_wheel",
          2500,
          {},
          {},
          () => i,
        ),
        r = s.history[0];
      counts.set(r.payout, (counts.get(r.payout) || 0) + 1);
      expect(r.values).toEqual([i]);
      expect(r.payout).toBe(Math.floor((2500 * MONEY_TABLE[i]) / 10000));
      expect(restoreSession(JSON.stringify(s))).toEqual(s);
    }
    expect([...counts.entries()]).toEqual([
      [0, 24],
      [2750, 18],
      [3000, 8],
      [4000, 3],
      [45000, 1],
    ]);
  });
  it("keeps every 54→54 transition continuous and lands the exact indexed sector without reverse motion", () => {
    for (let previous = 0; previous < 54; previous++)
      for (let next = 0; next < 54; next++) {
        const m = salvageMotion(next, previous);
        expect(m.start).toBe(salvageRestAngle(previous));
        expect(salvagePocket(m.start + m.travel)).toBe(next);
        expect(salvagePocket(m.start)).toBe(previous);
        expect(m.travel).toBeGreaterThanOrEqual(1440);
        expect(m.travel).toBeLessThan(1800);
        expect(Math.abs(m.travel * (1 - salvageTravel(0.99999)))).toBeLessThan(
          0.00001,
        );
      }
  });
  it("starts and finishes at rest, with monotonic angle and decaying coast speed", () => {
    const speed = (t: number) =>
      (salvageTravel(t + 1e-6) - salvageTravel(t)) / 1e-6;
    expect(speed(0)).toBeLessThan(0.0001);
    expect(speed(0.99999)).toBeLessThan(0.00001);
    let last = -1;
    for (let k = 0; k <= 1000; k++) {
      const a = salvageTravel(k / 1000);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(speed(0.04)).toBeLessThan(speed(0.1));
    expect(speed(0.25)).toBeGreaterThan(speed(0.5));
    expect(speed(0.5)).toBeGreaterThan(speed(0.8));
  });
  it("times every detent to the actual half-boundary crossing and finishes with a settled spring", () => {
    for (let i = 0; i < 54; i++) {
      const m = salvageMotion(i, 17);
      for (const t of m.contacts) {
        const angle = m.start + m.travel * salvageTravel(t);
        expect(
          angle / SALVAGE_STEP - 0.5 - Math.round(angle / SALVAGE_STEP - 0.5),
        ).toBeCloseTo(0, 6);
      }
      for (let k = 0; k <= 100; k++)
        expect(
          Math.abs(salvagePointer(k / 100, 4400, m.contacts)),
        ).toBeLessThanOrEqual(23);
      expect(salvagePointer(1, 4400, m.contacts)).toBe(0);
    }
  });
  it("does not style or announce the committed sector before landing; inspection is not a wager control", () => {
    const r = playSession(
      initialSession(),
      "money_wheel",
      2500,
      {},
      {},
      () => 53,
    ).history[0];
    const run = {
      id: 1,
      started: 0,
      duration: 4500,
      previous: initialSession(),
    };
    const early = renderToStaticMarkup(
      <CasinoSalvageWheel
        round={r}
        t={0.1}
        animated
        run={run}
        busy
        onSpin={() => {}}
        stake="25"
      />,
    );
    expect(early).not.toContain("data-landed=");
    expect(early).not.toContain("salvage-sector-highlight");
    expect(early).not.toContain("wheel: 18× sector");
    expect(early).toContain("Inspect payout sectors");
    expect(early).toContain("PASSING");
    const end = renderToStaticMarkup(
      <CasinoSalvageWheel
        round={r}
        t={1}
        animated={false}
        run={STILL_RUN}
        busy={false}
      />,
    );
    expect(end).toContain('data-landed="53"');
    expect(end).toContain("wheel: 18× sector");
    expect(end.match(/class="salvage-peg"/g)?.length).toBe(54);
    expect(end).toContain("salvage-sector-highlight");
  });
  it("extends only Salvage Wheel timing, keeping the other wheel durations", () => {
    for (const [game, ms] of [
      ["money_wheel", 4500],
      ["wheel", 2800],
      ["risk_wheel", 2800],
      ["roulette", 3300],
    ] as const) {
      const r = playSession(initialSession(), game, 2500, {}, {}, () => 0)
        .history[0];
      expect(tableDuration(r)).toBe(ms);
    }
  });
});
