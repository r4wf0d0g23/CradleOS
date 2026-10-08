import { describe, it, expect } from "vitest";
import {
  initialSession,
  playSession,
  startSpinRun,
  restoreSession,
} from "./casinoSessions";
import { changeCrapsBet, rollCraps } from "./casinoCrapsSession";
import {
  PRACTICE_CATALOG,
  isPracticeTerminal,
} from "./casinoExperienceCatalog";
import { casinoLaunchGame } from "./casinoStationSession";

describe("station game launch boundary", () => {
  it("lists all current practice games once without reopening disabled games", () => {
    expect(PRACTICE_CATALOG).toHaveLength(34);
    expect(new Set(PRACTICE_CATALOG.map((g) => g.key)).size).toBe(34);
    for (const key of ["craps", "slot_eclipse", "blackjack"])
      expect(isPracticeTerminal(key)).toBe(true);
    for (const key of [
      "mines",
      "dragon_tower",
      "video_poker",
      "__proto__",
      "donate",
      "testnet",
    ])
      expect(isPracticeTerminal(key)).toBe(false);
  });
  it("launches an explicit terminal without changing chips or saved state", () => {
    const s = initialSession(),
      before = JSON.stringify(s);
    for (const g of PRACTICE_CATALOG)
      expect(casinoLaunchGame(s, g.key)).toBe(g.key);
    expect(casinoLaunchGame(s, "testnet")).toBe(null);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("prioritizes a saved paid spin across terminal changes and reload", () => {
    const s = startSpinRun(initialSession(), "slots", 100, 5, () => 0);
    const saved = JSON.stringify(s),
      restored = restoreSession(saved);
    expect(casinoLaunchGame(restored, "roulette")).toBe("slots");
    expect(JSON.stringify(restored)).toBe(saved);
  });
  it("returns to an unfinished blackjack hand", () => {
    const s = playSession(
      initialSession(),
      "blackjack",
      100,
      {},
      { seats: 2 },
      () => 0,
    );
    expect(s.table).toBeTruthy();
    expect(casinoLaunchGame(s, "craps")).toBe("blackjack");
  });
  it("permits visiting another table with parked craps bets but never skips a pending roll", () => {
    const s = changeCrapsBet(initialSession(), "pass", 100);
    expect(casinoLaunchGame(s)).toBe("craps");
    expect(casinoLaunchGame(s, "roulette")).toBe("roulette");
    const rolled = rollCraps(s, () => 2),
      saved = JSON.stringify(rolled);
    expect(casinoLaunchGame(restoreSession(saved), "roulette")).toBe("craps");
    expect(JSON.stringify(rolled)).toBe(saved);
  });
});
