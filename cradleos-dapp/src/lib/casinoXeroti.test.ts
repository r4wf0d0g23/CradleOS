import { describe, it, expect } from "vitest";
import { FLEET, spinFleet, validSlotReceipt } from "./casinoSlotFleet";
import {
  initialSession,
  startSpinRun,
  advanceSpinRun,
  stopSpinRun,
  revealSlot,
  restoreSession,
  pendingSpinRun,
} from "./casinoSessions";
import { STATION_CATALOG, PRACTICE_CATALOG } from "./casinoExperienceCatalog";
import { slotMotionPlan, XEROTI_CLEAR_MS } from "./casinoSlotMotion";
const rng = (seed: number) => (b: number) => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) % b;
};
describe("Xeroti Tidofiza", () => {
  it("matches validated cluster economics without changing legacy machine receipts", () => {
    expect(FLEET.slot_xeroti.scale).toBe(FLEET.slot_feral.scale);
    for (let seed = 1; seed <= 300; seed++) {
      const x = spinFleet("slot_xeroti", 2500, rng(seed)),
        f = spinFleet("slot_feral", 2500, rng(seed));
      expect(x.frames).toEqual(f.frames);
      expect(x.draws).toEqual(f.draws);
      expect(x.payout).toBe(f.payout);
      expect(validSlotReceipt(x)).toBe(true);
    }
  });
  it("caps a fully devoured board at four stages; no free spins or fifth refill", () => {
    const r = spinFleet("slot_xeroti", 1000, () => 0);
    expect(r.frames.map((f) => f.multiplier)).toEqual([1, 2, 3, 4]);
    expect(r.frames.every((f) => f.wins[0].cells.length === 25)).toBe(true);
    expect(r.frames.filter((f) => f.kind === "cascade")).toHaveLength(3);
    expect(FLEET.slot_xeroti.free).toBe(0);
    expect(slotMotionPlan(r.key, r.frames[1], r.frames[0]).reveal).toBe(1940);
    expect(XEROTI_CLEAR_MS).toBe(760);
  });
  it.each([1, 3, 5, 10])(
    "settles %i paid rounds once across every saved-stage reload",
    (count) => {
      const initial = initialSession();
      let s = startSpinRun(initial, "slot_xeroti", 100, count, () => 0);
      for (let paid = 1; paid <= count; paid++) {
        expect(s.spinRun?.paid).toBe(paid);
        while (s.pack!.slot!.cursor < s.pack!.slot!.frames.length) {
          const before = JSON.stringify(s),
            balance = s.balance;
          expect(JSON.stringify(restoreSession(before))).toBe(before);
          s = revealSlot(restoreSession(before));
          expect(s.balance).toBe(balance);
        }
        if (paid < count) s = advanceSpinRun(s, () => 0);
      }
      expect(s.sequence).toBe(count);
      expect(pendingSpinRun(s)).toBe(false);
      expect(s.balance).toBe(
        initial.balance + s.history.reduce((n, r) => n + r.payout - r.stake, 0),
      );
      expect(() => revealSlot(s)).toThrow();
      expect(() => advanceSpinRun(s)).toThrow();
    },
  );
  it("stops future debits without abandoning paid hidden results", () => {
    let s = startSpinRun(initialSession(), "slot_xeroti", 100, 10, () => 0);
    const paid = s.balance;
    s = stopSpinRun(s);
    s = revealSlot(s, true);
    expect(s.balance).toBe(paid);
    expect(s.sequence).toBe(1);
    expect(() => advanceSpinRun(s)).toThrow();
  });
  it("adds one web machine without altering 34 physical terminals", () => {
    expect(STATION_CATALOG).toHaveLength(34);
    expect(STATION_CATALOG.some((g) => g.key === "slot_xeroti")).toBe(false);
    expect(
      PRACTICE_CATALOG.filter((g) => g.key === "slot_xeroti"),
    ).toHaveLength(1);
  });
});
