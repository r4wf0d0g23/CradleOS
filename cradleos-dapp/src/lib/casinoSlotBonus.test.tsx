import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FLEET_KEYS, spinFleet, type FleetKey } from "./casinoSlotFleet";
import { slotBonusView, bonusPerk } from "./casinoSlotBonus";
import {
  SlotBonusRail,
  SlotBonusEntry,
} from "../components/SlotBonusExperience";
import { casinoSoundNotes } from "./casinoSoundDesign";
const rng =
  (seed = 8729) =>
  (b: number) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % b;
  };
function feature(key: FleetKey) {
  const draw = rng();
  for (let i = 0; i < 2000; i++) {
    const r = spinFleet(key, 2500, draw);
    if (r.frames.length > 1 && r.frames[0].remaining > 0) return r;
  }
  throw Error(key);
}
const keys = [
  "slot_scrapyard",
  "slot_wreckways",
  "slot_gatecrash",
  "slot_drones",
  "slot_eclipse",
] as const;
describe("earned bonus presentation", () => {
  it("stays absent before first reveal and for losses or non-free cascade games", () => {
    for (const key of FLEET_KEYS) {
      const r = spinFleet(key, 2500, rng());
      expect(slotBonusView(r)).toBeNull();
      expect(slotBonusView(r, true)).toBeNull();
      if (["slot_reactor", "slot_feral"].includes(key))
        expect(slotBonusView({ ...r, cursor: 1 })).toBeNull();
    }
    const r = feature("slot_scrapyard");
    r.frames[0].remaining = 0;
    r.cursor = 1;
    expect(slotBonusView(r)).toBeNull();
  });
  it("keeps completed pips and bonus return on the revealed prefix during every upcoming spin", () => {
    for (const key of keys) {
      const r = feature(key);
      for (let c = 1; c <= r.frames.length; c++) {
        r.cursor = c;
        const v = slotBonusView(r)!;
        expect(v.phase).toBe(
          c === 1 ? "awarded" : c === r.frames.length ? "complete" : "active",
        );
        expect(v.returnChips).toBe(
          r.frames.slice(1, c).reduce((n, f) => n + f.award, 0),
        );
        expect(v.completed).toBe(c - 1);
        expect(v.remaining).toBe(v.total - v.completed);
        if (c < r.frames.length) {
          const busy = slotBonusView(r, true)!;
          expect(busy.phase).toBe("active");
          expect(busy.current).toBe(c);
          expect(busy.returnChips).toBe(v.returnChips);
          expect(busy.completed).toBe(v.completed);
          expect(busy.locked).toBe(v.locked);
        }
      }
    }
  });
  it("never reads future money/locks/reset and does not carry Drone base wilds into free spins", () => {
    for (const key of [...keys, "slot_vault"] as const) {
      const r = feature(key);
      r.cursor = 1;
      const expected = slotBonusView(r, true);
      for (const f of r.frames.slice(1)) {
        f.total = 999999999;
        f.award = 999999999;
        f.remaining = 999;
        f.grid = f.grid.map((c) => c.map(() => 7));
        f.coins = Array(15).fill(1000);
      }
      expect(slotBonusView(r, true)).toEqual(expected);
      if (key === "slot_drones") expect(expected!.locked).toBe(0);
    }
  });
  it("shows actual respin resets and full initial Vault collection without imaginary spins", () => {
    const r = feature("slot_vault");
    for (let c = 1; c <= r.frames.length; c++) {
      r.cursor = c;
      const v = slotBonusView(r)!;
      expect(v.kind).toBe("respin");
      expect(v.locked).toBe(r.frames[c - 1].coins.filter((n) => n > 0).length);
      if (c < r.frames.length)
        expect(slotBonusView(r, true)!.reset).toBe(false);
    }
    const full = spinFleet("slot_vault", 2500, () => 0);
    full.cursor = 1;
    const v = slotBonusView(full)!;
    expect(v.kind).toBe("collect");
    expect(v.remaining).toBe(0);
    expect(v.total).toBe(0);
    expect(v.locked).toBe(15);
    expect(bonusPerk(full.key, v)).not.toContain("respins");
  });
  it("makes awarded/resumed features unmistakable but does not animate a restored entry or call it a profit", () => {
    for (const key of keys) {
      const r = feature(key);
      r.cursor = 1;
      const view = slotBonusView(r)!;
      const html = renderToStaticMarkup(
        <SlotBonusEntry
          game={key}
          view={view}
          receipt={r}
          run={{ id: 0, started: 0 }}
          reduced={false}
          onContinue={() => {}}
        />,
      );
      expect(html).toContain("BONUS READY");
      expect(html).toContain("START FREE SPINS");
      expect(html).not.toContain("bonus-entry-burst");
      expect(html).not.toContain("JACKPOT");
      const active = renderToStaticMarkup(
        <SlotBonusRail
          game={key}
          view={slotBonusView(r, true)!}
          busy
          run={{ id: 1, started: 1 }}
          reduced={false}
        />,
      );
      expect(active).toContain("1 /");
      expect(active).toContain("SPIN IN PROGRESS");
      expect(active).toContain('class="current"');
      if (["slot_wreckways", "slot_gatecrash", "slot_eclipse"].includes(key))
        expect(html).toContain("2× wins");
    }
  });
  it("offers a stronger bounded fanfare and distinct bonus launch, without modifying stop/loss cues", () => {
    for (const key of keys) {
      const fanfare = casinoSoundNotes("bonus", key);
      expect(fanfare.length).toBe(10);
      expect(casinoSoundNotes("bonus_spin", key)).not.toEqual(
        casinoSoundNotes("spin", key),
      );
      for (const n of [...fanfare, ...casinoSoundNotes("bonus_spin", key)]) {
        expect(n.at + n.duration).toBeLessThan(2);
        expect(n.gain).toBeLessThanOrEqual(0.05);
        expect(n.hz).toBeGreaterThan(20);
        expect(n.hz).toBeLessThan(5000);
      }
      for (let t = 0; t < 2; t += 0.01) {
        expect(
          fanfare
            .filter((n) => t >= n.at && t < n.at + n.duration)
            .reduce((sum, n) => sum + n.gain, 0),
        ).toBeLessThan(0.13);
      }
    }
  });
});
