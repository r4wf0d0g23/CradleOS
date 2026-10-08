import type { CasinoCue } from "./casinoSoundDesign";

/** A paying hit is different from a whole-round victory. No economic decisions. */
export function roundCue({
  payout,
  stake,
}: {
  payout: number;
  stake: number;
}): CasinoCue {
  return payout > stake ? "win" : payout > 0 ? "payout" : "loss";
}
export const PAYOUT_FLASH_MS = 900;
export type PayoutEvent = {
  id: number;
  roundId: number;
  game: string;
  at: number;
};
export function payoutFlashRemaining(at: number, now: number) {
  const age = now - at;
  return Number.isFinite(age) && age >= 0
    ? Math.max(0, PAYOUT_FLASH_MS - age)
    : 0;
}
