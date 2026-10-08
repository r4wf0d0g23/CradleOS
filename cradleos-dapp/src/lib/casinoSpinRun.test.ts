import { describe, it, expect } from "vitest";
import {
  revealClassicSpin,
  initialSession,
  startSpinRun,
  advanceSpinRun,
  stopSpinRun,
  pendingSpinRun,
  pendingSlot,
  revealSlot,
  restoreSession,
  spinRunTotals,
  playSession,
  revealScratch,
  pendingScratch,
  scratchRevealed,
} from "./casinoSessions";
import { FLEET_KEYS } from "./casinoSlotFleet";
const rng = () => 0;
describe("finite per-spin charging", () => {
  it("charges one spin at a time across all nine engines, round-trips and stops without future debit", () => {
    for (const game of ["slots", ...FLEET_KEYS] as const) {
      let s = startSpinRun(initialSession(), game, 2500, 3, rng);
      expect(s.sequence).toBe(1);
      expect(s.balance).toBe(1000000 - 2500 + s.history[0].payout);
      expect(restoreSession(JSON.stringify(s))).toEqual(s);
      if (pendingSlot(s)) {
        expect(() => advanceSpinRun(s, rng)).toThrow();
        s = revealSlot(s, true);
      } else {
        s = revealClassicSpin(s);
      }
      const before = s.balance;
      s = advanceSpinRun(s, rng);
      expect(s.sequence).toBe(2);
      expect(s.balance).toBe(before - 2500 + s.history[0].payout);
      const stopped = stopSpinRun(s);
      expect(pendingSpinRun(stopped)).toBe(false);
      expect(stopped.balance).toBe(s.balance);
      expect(() => advanceSpinRun(stopped, rng)).toThrow();
      expect(spinRunTotals(s).stake).toBe(2500);
    }
  });
  it("resumes exactly, finishes ten, validates metadata and blocks changing game/refill through play", () => {
    let s = startSpinRun(initialSession(), "slots", 100, 10, rng);
    expect(() => playSession(s, "coinflip", 100)).toThrow();
    for (let i = 1; i < 10; i++)
      s = advanceSpinRun(
        revealClassicSpin(restoreSession(JSON.stringify(s))),
        rng,
      );
    s = revealClassicSpin(s);
    expect(s.sequence).toBe(10);
    expect(pendingSpinRun(s)).toBe(false);
    expect(spinRunTotals(s).stake).toBe(1000);
    expect(() => advanceSpinRun(s, rng)).toThrow();
    for (const patch of [
      { planned: 100 },
      { paid: 0 },
      { stake: 101 },
      { startSequence: 10 },
      { game: "coinflip" },
      { stopped: 1 },
    ])
      expect(
        restoreSession(
          JSON.stringify({ ...s, spinRun: { ...s.spinRun, ...patch } }),
        ).notice,
      ).toBeTruthy();
  });
  it("checks whole maximum budget before RNG and accepts old v2 snapshots", () => {
    let draws = 0;
    expect(() =>
      startSpinRun(
        { ...initialSession(), balance: 2500 },
        "slots",
        2500,
        3,
        () => {
          draws++;
          return 0;
        },
      ),
    ).toThrow();
    expect(draws).toBe(0);
    expect(restoreSession(JSON.stringify(initialSession()))).toEqual(
      initialSession(),
    );
  });
});
describe("durable cosmetic scratch progress", () => {
  it("reveals idempotently without changing settled ledger; legacy packs stay open", () => {
    let s = playSession(
      initialSession(),
      "scratch_cards",
      100,
      {},
      { count: 3 },
      rng,
    );
    const balances = [s.balance, s.sequence, JSON.stringify(s.history)];
    expect(pendingScratch(s)).toBe(true);
    s = revealScratch(s, 1);
    s = revealScratch(s, 1);
    expect(scratchRevealed(restoreSession(JSON.stringify(s)))).toEqual([1]);
    expect([s.balance, s.sequence, JSON.stringify(s.history)]).toEqual(
      balances,
    );
    s = revealScratch(s);
    expect(pendingScratch(s)).toBe(false);
    expect(restoreSession(JSON.stringify(s))).toEqual(s);
    delete s.pack!.revealed;
    expect(pendingScratch(restoreSession(JSON.stringify(s)))).toBe(false);
  });
  it("rejects forged progress, unrelated-game progress and new purchases before reveal", () => {
    const s = playSession(
      initialSession(),
      "scratch_cards",
      100,
      {},
      { count: 3 },
      rng,
    );
    expect(() => playSession(s, "slots", 100)).toThrow();
    for (const revealed of [[-1], [3], [1, 1], ["0"]])
      expect(
        restoreSession(JSON.stringify({ ...s, pack: { ...s.pack, revealed } }))
          .notice,
      ).toBeTruthy();
  });
});
