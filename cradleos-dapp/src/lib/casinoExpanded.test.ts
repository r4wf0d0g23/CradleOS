import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EXPANDED_GAMES,
  expandedOutcome,
  validExpandedValues,
  RISK_TABLES,
  MONEY_TABLE,
  KENO_TABLE,
  ORE_CUM,
  ORE_BPS,
  bankerDraws,
  threeBps,
  redDogBps,
  type ExpandedChoice,
  type ExpandedGame,
} from "./casinoExpanded";
import {
  initialPractice,
  playPractice,
  restorePractice,
  PRACTICE_GAMES,
} from "./casinoPractice";
import { TESTNET_QUARANTINE } from "./casinoExpansionRules";
const sequence = (a: number[]) => {
  let i = 0;
  return () => a[i++];
};
const outcome = (g: ExpandedGame, c: ExpandedChoice, a: number[]) =>
  expandedOutcome(g, c, sequence(a));
const source = (name: string) =>
  readFileSync(
    new URL(`../../../cradleos_casino/sources/${name}.move`, import.meta.url),
    "utf8",
  );
function values(name: string, key: string) {
  const text = source(name)
    .match(
      new RegExp(`const ${key}:\\s*vector<u64> = vector\\[([\\s\\S]*?)\\]`),
    )![1]
    .replace(/\/\/[^\n]*/g, "");
  return text.match(/\d[\d_]*/g)!.map((n) => Number(n.replace(/_/g, "")));
}
it("retains source wheel/refinery tables without trusting stale edge comments", () => {
  expect(values("money_wheel", "SEGMENTS")).toEqual(MONEY_TABLE);
  ["LOW", "MED", "HIGH"].forEach((s, i) =>
    expect(values("risk_wheel", `SEGMENTS_${s}`)).toEqual(RISK_TABLES[i]),
  );
  ["SLAG_CUM", "PARTIAL_CUM", "YIELD_CUM"].forEach((key, i) =>
    expect(values("ore_refine", key)).toEqual(ORE_CUM.map((a) => a[i])),
  );
  ["PARTIAL_BPS", "YIELD_BPS", "BONUS_BPS"].forEach((key, i) =>
    expect(values("ore_refine", key)).toEqual(ORE_BPS.map((a) => a[i + 1])),
  );
});
it("quarantines new known defects without reviving pre-drawn games", () => {
  expect([...TESTNET_QUARANTINE]).toEqual([
    "hilo",
    "baccarat",
    "scratch_cards",
  ]);
  for (const g of ["mines", "dragon_tower", "video_poker"]) {
    expect(PRACTICE_GAMES).not.toContain(g);
    expect(source(g)).toMatch(/assert!\(false, EGameDisabled\)/);
  }
  expect(PRACTICE_GAMES).not.toContain("hilo");
  expect(PRACTICE_GAMES.filter(g=>!g.startsWith("slot_"))).toHaveLength(25);
  // Freeze dangerous current-chain state as an activation regression guard.
  expect(
    readFileSync(new URL("./cycleDeployment.ts", import.meta.url), "utf8"),
  ).toMatch(/casinoFunded:\s*false/);
});
it("demonstrates Hi-Lo push overpayment independently for every visible base/feasible direction", () => {
  for (let base = 0; base < 13; base++)
    for (const higher of [false, true]) {
      const winners = higher ? 12 - base : base;
      if (!winners) continue;
      let old = 0,
        fixed = 0;
      for (let d = 0; d < 13; d++) {
        if (d === base) {
          old += 1;
          fixed += 1;
        } else if (higher ? d > base : d < base) {
          old += 127400 / winners / 10000;
          fixed += 117400 / winners / 10000;
        }
      }
      expect(old / 13).toBeCloseTo(1.0569230769, 9);
      expect(fixed / 13).toBeCloseTo(0.98, 12);
    }
});
it("standard Baccarat stand sentinel draws banker4/5; third-card tableau covers all decisions", () => {
  for (let b = 0; b < 10; b++) expect(bankerDraws(b, null)).toBe(b <= 5);
  for (let b = 0; b < 8; b++)
    for (let p = 0; p < 10; p++) {
      const allowed = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 1, 2, 3, 4, 5, 6, 7, 9],
        [2, 3, 4, 5, 6, 7],
        [4, 5, 6, 7],
        [6, 7],
        [],
      ][b];
      expect(bankerDraws(b, p)).toBe(allowed.includes(p));
    }
});
it("retains corrected three-card payout and openly nonstandard tiebreak", () => {
  expect(threeBps([8, 22, 37], [1, 17, 33])).toBe(17500);
  expect(threeBps([1, 14, 0], [12, 25, 3])).toBe(20000);
  expect(threeBps([0, 1, 2], [10, 11, 12])).toBe(60000);
  expect(threeBps([8, 9, 11], [21, 22, 24])).toBe(10000);
  expect(threeBps([1, 17, 33], [8, 22, 37])).toBe(0);
});
it("enumerates all 2197 Red Dog triples and all 16807 Diamonds draws", () => {
  let red = 0;
  for (let a = 1; a <= 13; a++)
    for (let b = 1; b <= 13; b++)
      for (let c = 1; c <= 13; c++) red += redDogBps(a, b, c);
  expect(red / 10000).toBe(2148);
  let diamond = 0;
  for (let i = 0; i < 16807; i++) {
    let n = i;
    const a = [];
    for (let j = 0; j < 5; j++) {
      a.push(n % 7);
      n = Math.floor(n / 7);
    }
    diamond += outcome("diamonds", {}, a).bps;
  }
  expect(diamond).toBe(162260000); // 2520 triples +210 quads +7 quints
});
it("exhausts all dice outcomes, including triples excluded from Small/Big", () => {
  const sic = Array(5).fill(0),
    chuck = { sum: 0 },
    under = Array(3).fill(0),
    double = Array(5).fill(0);
  for (let a = 0; a < 6; a++)
    for (let b = 0; b < 6; b++)
      for (let c = 0; c < 6; c++) {
        for (let side = 0; side < 5; side++)
          sic[side] += outcome("sicbo", { side, target: 2 }, [a, b, c]).bps;
        chuck.sum += outcome("chuck_a_luck", { target: 2 }, [a, b, c]).bps;
      }
  expect(sic).toEqual([2100000, 2100000, 1990000, 1800000, 1800000]);
  expect(chuck.sum / 216).toBeCloseTo(9722.222222);
  for (let a = 0; a < 6; a++)
    for (let b = 0; b < 6; b++) {
      for (let side = 0; side < 3; side++)
        under[side] += outcome("under_over_7", { side }, [a, b]).bps;
      for (let side = 0; side < 5; side++)
        double[side] += outcome("double_dice", { side, target: 2 }, [a, b]).bps;
    }
  expect(under).toEqual([348000, 342000, 348000]);
  expect(double).toEqual([345000, 345000, 330000, 330000, 342000]);
});
it("exhausts all10000 scratch tiers:97% unbiased return and correct visible triples", () => {
  let sum = 0;
  for (let n = 0; n < 10000; n++) {
    let first = true;
    const o = expandedOutcome("scratch_cards", {}, (bound) => {
      if (first) {
        first = false;
        return n;
      }
      return bound - 1;
    });
    sum += o.bps;
    const best = Math.max(
      ...Array.from(
        { length: 6 },
        (_, i) => o.values.filter((x) => x === i).length,
      ),
    );
    expect(best).toBe(o.bps ? 3 : 2);
  }
  expect(sum / 10000).toBe(9700);
  expect((0.97 * 60000) / 65536).toBeCloseTo(0.8880615234375, 12);
});
it("exhausts every refinery threshold and wheel sector", () => {
  for (let side = 0; side < 5; side++) {
    let total = 0;
    for (let n = 0; n < 10000; n++) {
      const o = outcome("ore_refine", { side }, [n]);
      total += o.bps;
      expect(o.bps).toBe(ORE_BPS[side][o.values[0]]);
    }
    expect(total / 1e8).toBeGreaterThan(0.969);
    expect(total / 1e8).toBeLessThan(0.971);
  }
  expect(RISK_TABLES.map((a) => a.reduce((x, y) => x + y, 0) / 20)).toEqual([
    9700, 9600, 9600,
  ]);
  expect(MONEY_TABLE.reduce((a, b) => a + b, 0) / 54).toBeCloseTo(9666.6666667);
});
it("samples Dragon Tiger without replacement and exposes half-return rank ties", () => {
  let side = 0,
    tie = 0;
  for (let a = 0; a < 52; a++)
    for (let b = 0; b < 51; b++) {
      side += outcome("dragon_tiger", { side: 0 }, [a, b]).bps;
      tie += outcome("dragon_tiger", { side: 2 }, [a, b]).bps;
    }
  expect(side / 2652 / 10000).toBeCloseTo(0.9705882353);
  expect(tie / 2652 / 10000).toBeCloseTo(0.5294117647);
});
it("Keno all-match values and hypergeometric expectations use unique samples", () => {
  const choose = (n: number, k: number) => {
    let v = 1;
    for (let i = 1; i <= k; i++) v = (v * (n - i + 1)) / i;
    return v;
  };
  for (let n = 1; n <= 6; n++) {
    const o = expandedOutcome(
      "keno",
      { picks: Array.from({ length: n }, (_, i) => i + 1) },
      (bound) => bound - 1,
    );
    expect(o.bps).toBe(KENO_TABLE[n - 1][n]);
    expect(new Set(o.values.slice(n + 1)).size).toBe(10);
    let rtp = 0;
    for (let hits = 0; hits <= n; hits++)
      rtp +=
        (((choose(10, hits) * choose(30, n - hits)) / choose(40, n)) *
          KENO_TABLE[n - 1][hits]) /
        10000;
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1);
  }
});
it("Andar stop matches correctly; full52-card miss takes explicit Andar fallback", () => {
  expect(outcome("andar_bahar", { side: 1 }, [0, 1, 0]).bps).toBe(20000);
  const a = outcome("andar_bahar", { side: 0 }, [0, ...Array(52).fill(1)]);
  expect(a.values).toHaveLength(53);
  expect(a.bps).toBe(18800);
  expect(a.label).toContain("limit");
});
it("flight targets use integer-bps endpoints and independently counted98% expectation", () => {
  expect(outcome("crash", { target: 200 }, [0, 0])).toMatchObject({
    values: [10000000, 20000],
    bps: 20000,
  });
  expect(outcome("limbo", { target: 101 }, [999, 999])).toMatchObject({
    values: [9800, 10100],
    bps: 0,
  });
  for (const target of [101, 200, 1000, 100000]) {
    let wins = 0;
    for (let n = 1; n <= 1000000; n++) {
      const limit = Math.min(10000000, Math.floor(9800000000 / n));
      if (limit >= target * 100) wins++;
    }
    expect(((wins / 1e6) * target) / 100).toBeLessThanOrEqual(0.98000000001);
    expect(((wins / 1e6) * target) / 100).toBeGreaterThan(0.979);
  }
});
describe("all expanded games: atomic ledger, valid outcomes and reload", () => {
  for (const game of EXPANDED_GAMES)
    it(game, () => {
      let seed = 1981;
      const rng = (bound: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % bound;
      };
      for (let i = 0; i < 60; i++) {
        const before = initialPractice(),
          choice = {
            side: 0,
            target: game === "crash" || game === "limbo" ? 200 : 2,
            picks: [7, 17, 27],
          };
        const s = playPractice(before, game, 2500, choice, rng),
          r = s.history[0];
        expect(s.balance).toBe(before.balance - 2500 + r.payout);
        expect(before.history).toHaveLength(0);
        expect(s.sequence).toBe(1);
        expect(validExpandedValues(game, r.values)).toBe(true);
        expect(restorePractice(JSON.stringify(s))).toEqual(s);
      }
    });
});
it("invalid picks, options, RNG and persisted shapes fail before taking chips", () => {
  const state = initialPractice();
  for (const picks of [[], [1, 1], [0], [41], [1, 2, 3, 4, 5, 6, 7]])
    expect(() =>
      playPractice(state, "keno", 100, { picks }, () => 0),
    ).toThrow();
  for (const target of [NaN, 100, 100001, 201.5])
    expect(() =>
      playPractice(state, "crash", 100, { target }, () => 0),
    ).toThrow();
  for (const side of [-1, 3, NaN, Infinity])
    expect(() =>
      playPractice(state, "risk_wheel", 100, { side }, () => 0),
    ).toThrow();
  for (const v of [-1, 100, NaN, 1.5])
    expect(() => playPractice(state, "diamonds", 100, {}, () => v)).toThrow();
  expect(state).toEqual(initialPractice());
  for (const game of EXPANDED_GAMES) {
    const s = playPractice(
      state,
      game,
      100,
      { target: game === "crash" || game === "limbo" ? 200 : 2, picks: [1] },
      () => 0,
    );
    s.history[0].values = [Infinity];
    expect(restorePractice(JSON.stringify(s))).toEqual(initialPractice());
  }
});
