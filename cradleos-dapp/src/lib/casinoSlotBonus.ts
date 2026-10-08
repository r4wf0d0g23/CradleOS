/** Presentation derived ONLY from a validated receipt's revealed prefix. */
import { FLEET, WILD, type SlotReceipt } from "./casinoSlotFleet";
import { fullInitialVault } from "./casinoSlotIdentity";
export type SlotBonusView = {
  kind: "free" | "respin" | "collect";
  phase: "awarded" | "active" | "complete";
  total: number;
  current: number;
  completed: number;
  remaining: number;
  returnChips: number;
  locked: number;
  reset: boolean;
  boost: number;
};
export function slotBonusView(
  receipt?: SlotReceipt,
  busy = false,
): SlotBonusView | null {
  if (!receipt || receipt.cursor < 1) return null;
  const { frames, cursor, key } = receipt,
    base = frames[0],
    last = frames[cursor - 1];
  if (!base || !last || frames.length < 2) return null;
  const free = FLEET[key].free > 0 && base.remaining > 0;
  const vault =
    key === "slot_vault" && base.coins.filter((n) => n > 0).length >= 6;
  if (!free && !vault) return null;
  const full = fullInitialVault(key, base),
    done = cursor === frames.length && !busy;
  const kind = free ? "free" : full ? "collect" : "respin";
  const completed = free ? (last.kind === "free" ? last.index : 0) : last.index;
  const current = busy ? (frames[cursor]?.index ?? completed) : completed;
  const locked = vault
    ? last.coins.filter((n) => n > 0).length
    : key === "slot_drones" && last.kind === "free"
      ? last.grid.flat().filter((n) => n === WILD).length
      : 0;
  return {
    kind,
    phase: done ? "complete" : cursor === 1 && !busy ? "awarded" : "active",
    total: free ? base.remaining : full ? 0 : 3,
    current,
    completed,
    remaining: free
      ? Math.max(0, base.remaining - completed)
      : full
        ? 0
        : last.remaining,
    returnChips: Math.max(0, last.total - base.total),
    locked,
    reset:
      !busy &&
      vault &&
      last.kind === "hold" &&
      last.remaining > 0 &&
      cursor > 1 &&
      locked > frames[cursor - 2].coins.filter((n) => n > 0).length,
    boost: free ? FLEET[key].boost : 1,
  };
}
export const BONUS_NAMES: Record<string, string> = {
  slot_scrapyard: "SALVAGE OVERDRIVE",
  slot_wreckways: "RECOVERY SWEEP",
  slot_gatecrash: "GATE RUN",
  slot_drones: "PROTOCOL OVERRIDE",
  slot_eclipse: "ORBITAL ALIGNMENT",
  slot_vault: "VAULT BREACH",
};
export function bonusPerk(key: string, view: SlotBonusView): string {
  if (view.kind === "collect") return "All 15 tokens locked · ready to collect";
  if (view.kind === "respin") return "New tokens reset your respins";
  if (key === "slot_drones") return "Wilds lock for the entire feature";
  if (view.boost > 1) return `${view.boost}× wins during free spins`;
  return "Every bonus spin is free";
}
