import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  actPractice,
  cardTotal,
  initialPractice,
  playPractice,
  practiceBet,
  restorePractice,
  shuffledDeck,
  SLOT_BPS,
  SLOT_STRIP,
  WHEEL_BPS,
  PLINKO_BPS,
  RED,
  type PracticeState,
} from "./casinoPractice";
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++];
};
function hand(
  player: number[],
  dealer: number[],
  rest: number[],
  balance = 999000,
): PracticeState {
  const start = [
    player[0],
    dealer[0],
    player[1],
    dealer[1],
    ...player.slice(2),
  ];
  const used = [...start, ...rest],
    deck = [
      ...used,
      ...Array.from({ length: 52 }, (_, i) => i).filter(
        (i) => !used.includes(i),
      ),
    ];
  return {
    ...initialPractice(),
    balance,
    hand: { deck, cursor: start.length, player, dealer, stake: 1000 },
  };
}
it("validates stakes in hundredths without exponents, negatives or NaN", () => {
  expect(practiceBet("12.34")).toBe(1234);
  expect(practiceBet("1")).toBe(100);
  expect(practiceBet("1000")).toBe(100000);
  for (const input of [
    "",
    "0",
    "-5",
    "1e2",
    "2.345",
    "1000.01",
    "Infinity",
    "NaN",
    "1,000",
  ])
    expect(() => practiceBet(input)).toThrow();
});
it("mirrors the actual Move strip and payout constants, not old comments", () => {
  const sources = (game: string) =>
    readFileSync(
      new URL(`../../../cradleos_casino/sources/${game}.move`, import.meta.url),
      "utf8",
    );
  const read = (source: string, key: string) =>
    source
      .match(
        new RegExp(`const ${key}: vector<u64> = vector\\[([\\s\\S]*?)\\]`),
      )![1]
      .match(/\d+/g)!
      .map(Number);
  expect(read(sources("slots"), "TRIPLE_BPS")).toEqual(SLOT_BPS);
  expect(sources("slots").match(/public fun strip[^\n]+/)![0]).toContain(
    SLOT_STRIP.join(", "),
  );
  expect(read(sources("wheel"), "SEGMENTS")).toEqual(WHEEL_BPS);
  expect(read(sources("plinko"), "LOW_BPS")).toEqual(PLINKO_BPS);
});
it("enumerates all4096 slot outcomes with conserved balance and correct expected return", () => {
  let returns = 0;
  for (let a = 0; a < 16; a++)
    for (let b = 0; b < 16; b++)
      for (let c = 0; c < 16; c++) {
        const s = playPractice(
          initialPractice(),
          "slots",
          10000,
          {},
          seq([a, b, c]),
        );
        const r = s.history[0];
        returns += r.payout;
        expect(s.balance).toBe(1000000 - 10000 + r.payout);
      }
  expect(returns).toBe(39306000); // weighted gross return ~95.96%
});
it("slots distinguish triples, pairs and losses", () => {
  expect(
    playPractice(initialPractice(), "slots", 1000, {}, seq([15, 15, 15]))
      .history[0].payout,
  ).toBe(60000);
  expect(
    playPractice(initialPractice(), "slots", 1000, {}, seq([0, 4, 0]))
      .history[0].payout,
  ).toBe(1800);
  expect(
    playPractice(initialPractice(), "slots", 1000, {}, seq([0, 4, 7]))
      .history[0].payout,
  ).toBe(0);
});
it("coinflip correct call and wrong call; invalid choice never debits", () => {
  const s = initialPractice();
  expect(playPractice(s, "coinflip", 1000, { side: 1 }, () => 1).balance).toBe(
    s.balance + 960,
  );
  expect(playPractice(s, "coinflip", 1000, { side: 0 }, () => 1).balance).toBe(
    s.balance - 1000,
  );
  expect(() =>
    playPractice(s, "coinflip", 1000, { side: 4 }, () => 0),
  ).toThrow();
  expect(s.balance).toBe(1000000);
});
it("roulette zero loses outside bets; colors have18wins each; straight pays36x", () => {
  for (const side of [0, 1]) {
    let wins = 0;
    for (let n = 0; n < 37; n++) {
      const p = playPractice(
        initialPractice(),
        "roulette",
        1000,
        { side },
        () => n,
      ).history[0].payout;
      if (p) wins++;
      if (n === 0) expect(p).toBe(0);
    }
    expect(wins).toBe(18);
  }
  expect(RED).toHaveLength(18);
  expect(
    playPractice(
      initialPractice(),
      "roulette",
      1000,
      { side: 2, target: 0 },
      () => 0,
    ).history[0].payout,
  ).toBe(36000);
  expect(() =>
    playPractice(
      initialPractice(),
      "roulette",
      1000,
      { side: 2, target: 37 },
      () => 0,
    ),
  ).toThrow();
});
it("dice strict boundaries and variable odds match contract vectors", () => {
  for (const [target, over, roll, amount, payout] of [
    [50, true, 51, 100, 196],
    [50, true, 50, 100, 0],
    [50, false, 49, 100, 200],
    [98, true, 99, 100, 4900],
    [97, false, 5, 10000, 10208],
  ] as const) {
    expect(
      playPractice(
        initialPractice(),
        "dice",
        amount,
        { target, over },
        () => roll - 1,
      ).history[0].payout,
    ).toBe(payout);
  }
});
it("wheel visits all20sectors; lower gross returns are not inflated", () => {
  let total = 0;
  for (let n = 0; n < 20; n++)
    total += playPractice(initialPractice(), "wheel", 10000, {}, () => n)
      .history[0].payout;
  expect(total).toBe(192000);
});
it("plinko uses12 independentbounces and binomial bucket counts", () => {
  const counts = Array<number>(13).fill(0);
  for (let path = 0; path < 4096; path++) {
    const s = playPractice(
      initialPractice(),
      "plinko",
      10000,
      {},
      seq(Array.from({ length: 12 }, (_, i) => (path >> i) & 1)),
    );
    const r = s.history[0],
      k = r.values.reduce((a, b) => a + b, 0);
    counts[k]++;
    expect(r.payout).toBe(PLINKO_BPS[k]);
  }
  expect(counts).toEqual([
    1, 12, 66, 220, 495, 792, 924, 792, 495, 220, 66, 12, 1,
  ]);
});
it("war Ace high, two low, ties return half rather than a win", () => {
  expect(
    playPractice(initialPractice(), "war", 1000, {}, seq([12, 0])).history[0]
      .payout,
  ).toBe(2000);
  expect(
    playPractice(initialPractice(), "war", 1000, {}, seq([0, 12])).history[0]
      .payout,
  ).toBe(0);
  expect(
    playPractice(initialPractice(), "war", 1000, {}, seq([6, 6])).history[0]
      .payout,
  ).toBe(500);
});
describe("blackjack ledger", () => {
  it("ace totals and deck remain valid", () => {
    expect(cardTotal([0, 13, 9])).toBe(12);
    expect(cardTotal([0, 9])).toBe(21);
    expect(new Set(shuffledDeck((n) => n - 1)).size).toBe(52);
  });
  it("deals once, reloads same deck then continues without another debit", () => {
    const s = playPractice(
      initialPractice(),
      "blackjack",
      1000,
      {},
      (n) => n - 1,
    );
    expect(s.balance).toBe(999000);
    expect(s.hand?.player).toEqual([0, 2]);
    const restored = restorePractice(JSON.stringify(s));
    expect(restored).toEqual(s);
    const hit = actPractice(restored, "hit");
    expect(hit.balance).toBe(999000);
    expect(hit.hand?.player).toEqual([0, 2, 4]);
    const end = actPractice(hit, "stand");
    expect(end.hand).toBeNull();
    expect(end.history).toHaveLength(1);
    expect(end.balance).toBe(1000000);
    expect(() => actPractice(end, "stand")).toThrow();
  });
  it("double debits another stake once, settles with totalstake", () => {
    const s = hand([4, 5], [9, 6], [22]);
    const end = actPractice(s, "double");
    expect(end.history[0].stake).toBe(2000);
    expect(end.history[0].payout).toBe(4000);
    expect(end.balance).toBe(1002000);
    expect(() => actPractice(end, "double")).toThrow();
  });
  it("rejects unaffordable double and any newbet duringhand", () => {
    const s = hand([4, 5], [9, 6], [8], 999);
    expect(() => actPractice(s, "double")).toThrow();
    expect(s.balance).toBe(999);
    expect(() => playPractice(s, "slots", 100)).toThrow();
  });
  it("bust settles once without paying even if dealer canbust", () => {
    const end = actPractice(hand([9, 8], [6, 7], [5]), "hit");
    expect(end.history[0].label).toBe("Bust");
    expect(end.history[0].payout).toBe(0);
    expect(end.hand).toBeNull();
  });
  it("dealer stands on soft17", () => {
    const end = actPractice(hand([9, 7], [0, 5], [22]), "stand");
    expect(end.history[0].payout).toBe(2000);
    expect(end.history[0].values.slice(-2)).toEqual([0, 5]);
  });
  it("natural cases through shuffled full deck", () => {
    // Construct desired permutation via inverse Fisher-Yates choices.
    function rngFor(prefix: number[]) {
      const target = [
          ...prefix,
          ...Array.from({ length: 52 }, (_, i) => i).filter(
            (i) => !prefix.includes(i),
          ),
        ],
        arr = Array.from({ length: 52 }, (_, i) => i),
        draws = [];
      for (let i = 51; i > 0; i--) {
        const j = arr.indexOf(target[i]);
        draws.push(j);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return seq(draws);
    }
    for (const [prefix, expected] of [
      [[0, 1, 9, 2], 2500],
      [[0, 13, 9, 22], 1000],
      [[1, 0, 2, 9], 0],
    ] as [number[], number][]) {
      const s = playPractice(
        initialPractice(),
        "blackjack",
        1000,
        {},
        rngFor(prefix),
      );
      expect(s.hand).toBeNull();
      expect(s.history[0].payout).toBe(expected);
      expect(s.balance).toBe(999000 + expected);
    }
  });
});
it("rejects badrng and insufficientbalance without mutating input", () => {
  const s = { ...initialPractice(), balance: 100 };
  expect(() => playPractice(s, "slots", 101)).toThrow();
  expect(() => playPractice(s, "slots", 100, {}, () => 16)).toThrow();
  expect(s.balance).toBe(100);
});
it("restores committed rounds but rejects corrupt/foreign/oversized state", () => {
  const good = playPractice(initialPractice(), "slots", 1000, {}, () => 0);
  expect(restorePractice(JSON.stringify(good))).toEqual(good);
  for (const raw of [
    "{",
    "null",
    "{}",
    JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, balance: -1 }),
    JSON.stringify({ ...good, balance: 1e30 }),
    JSON.stringify({ ...good, history: [{ ...good.history[0], payout: -1 }] }),
  ])
    expect(restorePractice(raw)).toEqual(initialPractice());
  const active = playPractice(
    initialPractice(),
    "blackjack",
    1000,
    {},
    (n) => n - 1,
  );
  active.hand!.deck[10] = active.hand!.deck[9];
  expect(restorePractice(JSON.stringify(active))).toEqual(initialPractice());
});
it("history bounded20, repeat results each have one monotonic receipt", () => {
  let s = initialPractice();
  for (let i = 0; i < 25; i++)
    s = playPractice(s, "coinflip", 100, { side: 0 }, () => 0);
  expect(s.history).toHaveLength(20);
  expect(s.sequence).toBe(25);
  expect(new Set(s.history.map((r) => r.id)).size).toBe(20);
});

it("rejects contract-invalid dice chances before drawing", () => {
  for (const choice of [
    { target: 2, over: false },
    { target: 98, over: false },
    { target: 2, over: true },
    { target: 3, over: true },
  ])
    expect(() =>
      playPractice(initialPractice(), "dice", 100, choice, () => {
        throw Error("Should not draw");
      }),
    ).toThrow("Win chance");
  for (const [target, over] of [
    [3, false],
    [97, false],
    [4, true],
    [98, true],
  ] as const)
    expect(() =>
      playPractice(initialPractice(), "dice", 100, { target, over }, () => 49),
    ).not.toThrow();
});
it("rejects malformed per-game history before it can crash a game surface", () => {
  const baseline = playPractice(initialPractice(), "slots", 1000, {}, () => 0);
  const cases = {
    slots: [[100, 100, 100], [], [0, 0]],
    coinflip: [[2]],
    dice: [[0], [101]],
    roulette: [[37]],
    wheel: [[20]],
    plinko: [Array(12).fill(2), [0]],
    war: [[13, 0]],
    blackjack: [
      [1, 1, 2, 3],
      [0, -1, 1, 2],
      [0, 1, -1, 2, -1, 3],
      [0, 1, -1, 2, 99],
    ],
  };
  for (const [game, casesForGame] of Object.entries(cases))
    for (const values of casesForGame)
      expect(
        restorePractice(
          JSON.stringify({
            ...baseline,
            history: [{ ...baseline.history[0], game, values }],
          }),
        ),
      ).toEqual(initialPractice());
  for (const game of [
    "slots",
    "coinflip",
    "dice",
    "roulette",
    "wheel",
    "plinko",
    "war",
  ] as const) {
    const state = playPractice(
      initialPractice(),
      game,
      1000,
      { side: 0, target: 50, over: true },
      () => 0,
    );
    expect(restorePractice(JSON.stringify(state))).toEqual(state);
  }
});
