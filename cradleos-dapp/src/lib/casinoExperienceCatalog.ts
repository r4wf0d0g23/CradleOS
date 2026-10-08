/** Shared presentation catalog. No RNG, wallet, or balance operations. */
import { CASINO_CATALOG, type GameEntry } from "./casinoCatalog";
import { FLEET, FLEET_KEYS } from "./casinoSlotFleet";
import { PRACTICE_GAMES, type PracticeGame } from "./casinoPractice";
export const FLEET_CATALOG: GameEntry[] = FLEET_KEYS.map((key) => ({
  key,
  name: FLEET[key].name,
  category: "slots",
  variance: "H",
  buildClass: "I",
  glyph: "◇",
  hook: FLEET[key].feature,
  status: "live",
}));
export const CRAPS_CATALOG: GameEntry = {
  key: "craps",
  name: "CRAPS",
  category: "dice",
  variance: "M-H",
  buildClass: "S",
  glyph: "◇",
  hook: "Two dice. One point. Hold the line.",
  status: "live",
};

export const PRACTICE_CATALOG: GameEntry[] = [
  ...CASINO_CATALOG,
  ...FLEET_CATALOG,
  CRAPS_CATALOG,
].filter(
  (g) =>
    !g.disabled &&
    (g.key === "craps" || PRACTICE_GAMES.includes(g.key as PracticeGame)),
);
export const isPracticeTerminal = (key: unknown): key is string =>
  typeof key === "string" && PRACTICE_CATALOG.some((g) => g.key === key);
