import { describe, it, expect } from "vitest";
import {
  roundCue,
  payoutFlashRemaining,
  PAYOUT_FLASH_MS,
} from "./casinoResultFeedback";
import { casinoSoundNotes } from "./casinoSoundDesign";
import { FLEET_KEYS } from "./casinoSlotFleet";

describe("paying-hit feedback", () => {
  it("distinguishes zero, below-bet, returned-bet and above-bet aggregate results", () => {
    expect(roundCue({ stake: 2500, payout: 0 })).toBe("loss");
    expect(roundCue({ stake: 2500, payout: 1 })).toBe("payout");
    expect(roundCue({ stake: 2500, payout: 1250 })).toBe("payout");
    expect(roundCue({ stake: 2500, payout: 2500 })).toBe("payout");
    expect(roundCue({ stake: 2500, payout: 2501 })).toBe("win");
    expect(roundCue({ stake: 7500, payout: 6625 })).toBe("payout");
    expect(roundCue({ stake: 10000, payout: 20000 })).toBe("win");
  });
  it("has a finite two-note transfer cue with no inherited echoes, in every voice", () => {
    for (const key of [...FLEET_KEYS, undefined]) {
      const notes = casinoSoundNotes("payout", key);
      expect(notes).toHaveLength(2);
      expect(Math.max(...notes.map((n) => n.at + n.duration))).toBeCloseTo(
        0.225,
      );
      expect(notes[0].hz).toBeLessThan(notes[1].hz);
      expect(
        notes.every((n) => n.gain <= 0.023 && n.gain > 0 && n.wave === "sine"),
      ).toBe(true);
      expect(notes).not.toEqual(casinoSoundNotes("win", key));
      expect(notes).not.toEqual(casinoSoundNotes("loss", key));
      expect(notes).not.toEqual(casinoSoundNotes("bonus", key));
    }
  });
  it("expires a monotonic visual receipt rather than replaying an old or future event", () => {
    expect(payoutFlashRemaining(100, 100)).toBe(PAYOUT_FLASH_MS);
    expect(payoutFlashRemaining(100, 300)).toBe(700);
    expect(payoutFlashRemaining(100, 1000)).toBe(0);
    expect(payoutFlashRemaining(100, 1001)).toBe(0);
    expect(payoutFlashRemaining(100, 99)).toBe(0);
    expect(payoutFlashRemaining(NaN, 100)).toBe(0);
  });
});
