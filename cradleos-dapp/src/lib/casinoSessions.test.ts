import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  playSession,
  actSession,
  restoreSession,
  initialSession,
  PROFILES,
  restoreOptions,
  packTotal,
  rouletteBps,
  type Profile,
  type Wager,
} from "./casinoSessions";
import {
  initialPractice,
  playPractice,
  PLINKO_BPS,
  RED,
  MAX_BET,
} from "./casinoPractice";
import { validTable, tableActionAllowed } from "./casinoBlackjackTable";
// Fisher–Yates choices to produce an exact physical shoe; no engine test hooks.
function shoe(prefix: number[]) {
  const target = [
      ...prefix,
      ...Array.from({ length: 52 }, (_, i) => i).filter(
        (n) => !prefix.includes(n),
      ),
    ],
    a = Array.from({ length: 52 }, (_, i) => i),
    choices: number[] = [];
  for (let i = 51; i > 0; i--) {
    const j = a.indexOf(target[i]);
    choices.push(j);
    [a[i], a[j]] = [a[j], a[i]];
  }
  let i = 0;
  return () => choices[i++];
}
const roundtrip = (s: ReturnType<typeof initialSession>) =>
  expect(restoreSession(JSON.stringify(s))).toEqual(s);
const save = (s: ReturnType<typeof initialSession>) =>
  JSON.parse(JSON.stringify(s));
describe("finite instant packs", () => {
  it("matches four official Plinko source tables including Classic center", () => {
    const source = readFileSync(
      new URL("../../../cradleos_casino/sources/plinko.move", import.meta.url),
      "utf8",
    );
    for (const [p, table] of Object.entries(PROFILES)) {
      const name =
        p === "Classic"
          ? "BUCKET_BPS"
          : p === "Medium"
            ? "MED_BPS"
            : p.toUpperCase() + "_BPS";
      const match = source.match(
        new RegExp(`const ${name}: vector<u64> = vector\\[([\\s\\S]*?)\\]`),
      );
      expect(match![1].match(/\d+/g)!.map(Number)).toEqual(table);
    }
  });
  it("enumerates 16384 profile/routes with exact rounded returns and save validation", () => {
    for (const profile of Object.keys(PROFILES) as Profile[])
      for (let mask = 0; mask < 4096; mask++) {
        let bit = 0;
        const s = playSession(
          initialSession(),
          "plinko",
          123,
          {},
          { profile },
          () => (mask >> bit++) & 1,
        );
        const r = s.pack!.rounds[0],
          bucket = r.values.reduce((a, b) => a + b, 0);
        expect(r.payout).toBe(
          Math.floor((123 * PROFILES[profile][bucket]) / 10000),
        );
        expect(s.balance).toBe(1000000 - 123 + r.payout);
        roundtrip(s);
      }
  });
  it("settles 10 balls once and cannot borrow winnings for upfront stake", () => {
    const s = playSession(
      initialSession(),
      "plinko",
      MAX_BET,
      {},
      { count: 10, profile: "High" },
      () => 0,
    );
    expect(s.pack!.rounds).toHaveLength(10);
    expect(s.balance).toBe(packTotal(s.pack!, "payout"));
    roundtrip(s);
    expect(() =>
      playSession(
        { ...initialSession(), balance: 299 },
        "plinko",
        100,
        {},
        { count: 3 },
        () => 0,
      ),
    ).toThrow();
  });
  it("all 37 roulette outcomes settle six kinds in one draw, zero loses outside", () => {
    const ws: Wager[] = [
      ...Array.from({ length: 37 }, (_, value) => ({
        kind: "straight" as const,
        value,
        stake: 101,
      })),
      ...(["color", "parity", "range", "dozen", "column"] as const).flatMap(
        (kind) =>
          Array.from(
            { length: kind === "dozen" || kind === "column" ? 3 : 2 },
            (_, value) => ({ kind, value, stake: 101 }),
          ),
      ),
    ];
    for (let n = 0; n < 37; n++) {
      let draws = 0;
      const s = playSession(
        initialSession(),
        "roulette",
        100,
        {},
        { wagers: ws },
        (bound) => {
          expect(bound).toBe(37);
          draws++;
          return n;
        },
      );
      expect(draws).toBe(1);
      expect(s.pack!.rounds).toHaveLength(49);
      expect(rouletteBps(ws[n], n)).toBe(360000);
      for (let i = 37; i < 49; i++) {
        const w = ws[i];
        const match =
          n !== 0 &&
          (w.kind === "color"
            ? (RED.includes(n) ? 0 : 1) === w.value
            : w.kind === "parity"
              ? n % 2 === w.value
              : w.kind === "range"
                ? (n <= 18 ? 0 : 1) === w.value
                : w.kind === "dozen"
                  ? Math.ceil(n / 12) - 1 === w.value
                  : (n - 1) % 3 === w.value);
        expect(s.pack!.rounds[i].payout).toBe(
          match
            ? Math.floor(
                101 * (w.kind === "dozen" || w.kind === "column" ? 3 : 2),
              )
            : 0,
        );
      }
      roundtrip(s);
    }
  });
  it("rejects duplicate/corrupt wagers and oversized packs before drawing", () => {
    const rng = () => {
      throw Error("must not draw");
    };
    for (const wagers of [
      [{ kind: "color" as const, value: 2, stake: 100 }],
      [
        { kind: "color" as const, value: 0, stake: 100 },
        { kind: "color" as const, value: 0, stake: 100 },
      ],
    ])
      expect(() =>
        playSession(initialSession(), "roulette", 100, {}, { wagers }, rng),
      ).not.toThrow("must not draw");
    for (const count of [0, 2, 11, NaN])
      expect(() =>
        playSession(initialSession(), "plinko", 100, {}, { count }, rng),
      ).toThrow();
  });
  it("Keno tickets share one distinct draw with independent stakes and picks", () => {
    const tickets = [
      { picks: [2, 3, 4], stake: 101 },
      { picks: [2], stake: 100 },
      { picks: [39, 40], stake: 1000 },
      { picks: [2, 3, 4, 5, 6, 7], stake: 500 },
    ];
    let calls = 0;
    const s = playSession(
      initialSession(),
      "keno",
      100,
      {},
      { tickets },
      () => {
        calls++;
        return 0;
      },
    );
    expect(calls).toBe(39);
    for (const r of s.pack!.rounds)
      expect(r.values.slice(-10)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(s.pack!.rounds.map((r) => r.payout)).toEqual([2525, 385, 0, 485000]);
    expect(new Set(s.pack!.rounds[0].values.slice(-10)).size).toBe(10);
    roundtrip(s);
  });
  it("scratch packs preserve all symbols/results on reload and do not mutate inputs", () => {
    const s = initialSession(),
      before = JSON.stringify(s);
    const next = playSession(
      s,
      "scratch_cards",
      101,
      {},
      { count: 5 },
      () => 0,
    );
    expect(next.pack!.rounds).toHaveLength(5);
    expect(next.balance).toBe(s.balance - 505);
    roundtrip(next);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects changed pack profiles, draws, receipts, stake and nonfinite balance", () => {
    const original = playSession(
      initialSession(),
      "plinko",
      100,
      {},
      { count: 3 },
      () => 0,
    );
    for (const change of [
      (s: any) => (s.pack.profile = "High"),
      (s: any) => (s.pack.rounds[0].stake = 1),
      (s: any) => (s.history[0].values[0] = 8),
      (s: any) => (s.balance = -1),
      (s: any) => (s.pack.rounds[0].id = 99),
    ]) {
      const corrupt = save(original);
      change(corrupt);
      expect(restoreSession(JSON.stringify(corrupt)).notice).toBeTruthy();
    }
  });
});
describe("blackjack physical shared shoe and escrow", () => {
  it("naturals are deferred until other seats finish and cannot finance a double", () => {
    const s = playSession(
      { ...initialSession(), balance: 200 },
      "blackjack",
      100,
      {},
      { seats: 2 },
      shoe([0, 4, 8, 12, 5, 7]),
    );
    expect(s.table).toBeTruthy();
    expect(s.balance).toBe(0);
    expect(s.history).toHaveLength(0);
    expect(tableActionAllowed(s.table!, "double", s.balance)).toBe(false);
    roundtrip(s);
    const final = actSession(s, "stand");
    expect(final.pack!.rounds[0].payout).toBe(250);
    expect(final.table).toBeNull();
    roundtrip(final);
  });
  it("dealer natural settles immediately with player natural push", () => {
    const s = playSession(
      initialSession(),
      "blackjack",
      101,
      {},
      { seats: 2 },
      shoe([0, 4, 13, 12, 5, 25]),
    );
    expect(s.table).toBeNull();
    expect(s.pack!.rounds.map((r) => r.payout)).toEqual([101, 0]);
    roundtrip(s);
    expect(() => actSession(s, "stand")).toThrow();
  });
  it("splits an exact pair only once, deals from one shoe, settles together", () => {
    let s = playSession(
      initialSession(),
      "blackjack",
      100,
      {},
      { seats: 1 },
      shoe([7, 8, 20, 6, 3, 4, 9, 10]),
    );
    const before = JSON.stringify(s);
    expect(tableActionAllowed(s.table!, "split", s.balance)).toBe(true);
    s = actSession(s, "split");
    expect(s.table!.hands.map((h) => h.cards)).toEqual([
      [7, 3],
      [20, 4],
    ]);
    expect(s.balance).toBe(999800);
    expect(tableActionAllowed(s.table!, "split", s.balance)).toBe(false);
    expect(tableActionAllowed(s.table!, "double", s.balance)).toBe(false);
    roundtrip(s);
    s = actSession(s, "stand");
    expect(s.history).toHaveLength(0);
    roundtrip(s);
    s = actSession(s, "stand");
    expect(s.pack!.rounds).toHaveLength(2);
    roundtrip(s);
    expect(before).not.toEqual(JSON.stringify(s));
  });
  it("split aces get one card each; split 21 pays only 1:1", () => {
    let s = playSession(
      initialSession(),
      "blackjack",
      100,
      {},
      {},
      shoe([0, 8, 13, 7, 12, 25]),
    );
    s = actSession(s, "split");
    expect(s.table).toBeNull();
    expect(
      s.pack!.table!.hands.every((h) => h.cards.length === 2 && h.splitAce),
    ).toBe(true);
    expect(s.pack!.rounds.map((r) => r.payout)).toEqual([200, 200]);
    roundtrip(s);
  });
  it("double escrows additional stake and draws exactly one card", () => {
    let s = playSession(
      initialSession(),
      "blackjack",
      100,
      {},
      {},
      shoe([4, 8, 5, 7, 9]),
    );
    s = actSession(s, "double");
    expect(s.pack!.rounds[0].stake).toBe(200);
    expect(s.pack!.table!.hands[0].cards).toHaveLength(3);
    expect(s.balance).toBe(1000200);
    roundtrip(s);
  });
  it("rejects forged cursor, card order, split lineage, action and duplicated shoe", () => {
    const s = playSession(
      initialSession(),
      "blackjack",
      100,
      {},
      {},
      shoe([7, 8, 20, 6, 3, 4]),
    );
    for (const change of [
      (t: any) => t.cursor++,
      (t: any) => t.hands[0].cards.reverse(),
      (t: any) => (t.hands[0].seat = 2),
      (t: any) => (t.actions = ["stand"]),
      (t: any) => (t.deck[0] = t.deck[1]),
    ]) {
      const corrupt = save(s);
      change(corrupt.table);
      expect(validTable(corrupt.table)).toBe(false);
      expect(restoreSession(JSON.stringify(corrupt)).notice).toBeTruthy();
    }
  });
  it("all active states block new packs; insufficient split never mutates state", () => {
    const s = playSession(
      { ...initialSession(), balance: 100 },
      "blackjack",
      100,
      {},
      {},
      shoe([7, 8, 20, 6]),
    );
    const copy = JSON.stringify(s);
    expect(() => playSession(s, "plinko", 100)).toThrow();
    expect(() => actSession(s, "split")).toThrow();
    expect(JSON.stringify(s)).toBe(copy);
  });
  it("roundtrips 150 complete three-seat shoes and all action states", () => {
    for (let seed = 1; seed <= 150; seed++) {
      let x = seed;
      const rng = (bound: number) => {
        x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
        return x % bound;
      };
      let s = playSession(
          initialSession(),
          "blackjack",
          101,
          {},
          { seats: 3 },
          rng,
        ),
        steps = 0;
      while (s.table) {
        roundtrip(s);
        const t = s.table;
        const action = tableActionAllowed(t, "split", s.balance)
          ? "split"
          : tableActionAllowed(t, "double", s.balance)
            ? "double"
            : t.hands[t.active].cards.length < 3
              ? "hit"
              : "stand";
        s = actSession(s, action);
        expect(++steps).toBeLessThan(53);
      }
      roundtrip(s);
      expect(s.balance).toBe(
        1000000 - packTotal(s.pack!, "stake") + packTotal(s.pack!, "payout"),
      );
    }
  });
});
describe("migration boundaries", () => {
  it("migrates existing balance, history and Low Plinko receipts without reinterpretation", () => {
    const old = playPractice(initialPractice(), "plinko", 123, {}, () => 0);
    const s = restoreSession(null, JSON.stringify(old));
    expect(s.balance).toBe(old.balance);
    expect(s.history).toEqual(old.history);
    expect(s.pack).toBeNull();
    expect(PROFILES.Low).toEqual(PLINKO_BPS);
    roundtrip(s);
  });
  it("preserves and finishes legacy unsplit hands under their original rules", () => {
    const old = playPractice(
      initialPractice(),
      "blackjack",
      100,
      {},
      shoe([7, 8, 6, 5, 9]),
    );
    const s = restoreSession(null, JSON.stringify(old));
    expect(s.hand).toEqual(old.hand);
    expect(s.table).toBeNull();
    expect(() => actSession(s, "split")).toThrow();
    const done = actSession(s, "stand");
    expect(done.hand).toBeNull();
    roundtrip(done);
  });
  it("present corrupt v2 never rolls back to a richer or stale v1", () => {
    const old = { ...initialPractice(), balance: 99999999 };
    const s = restoreSession("{}", JSON.stringify(old));
    expect(s.balance).toBe(1000000);
    expect(s.notice).toBeTruthy();
    expect(
      restoreSession(JSON.stringify(initialSession()), JSON.stringify(old))
        .notice,
    ).toBeUndefined();
  });
});

it("retains validated ticket preferences across unrelated packs without editing receipts", () => {
  const draft = {
    tickets: [
      { picks: [1, 2], stake: 111 },
      { picks: [3, 4, 5, 6], stake: 222 },
    ],
    profile: "High",
    wagers: [],
    count: 5,
    seats: 2,
  };
  const s = playSession(
    initialSession(),
    "plinko",
    100,
    {},
    { count: 3 },
    () => 0,
  );
  const copy = JSON.stringify(s);
  expect(restoreOptions(JSON.stringify(draft), s).tickets).toEqual(
    draft.tickets,
  );
  expect(JSON.stringify(s)).toBe(copy);
  expect(
    restoreOptions('{"tickets":[{"picks":[99],"stake":-1}]}', s).tickets,
  ).toEqual([{ picks: [7, 17, 27], stake: 2500 }]);
});

it("validates scratch symbols against every payout tier and rejects edited returns", () => {
  for (const tier of [0, 7000, 9000, 9700, 9950, 9980]) {
    const s = playSession(
      initialSession(),
      "scratch_cards",
      101,
      {},
      { count: 3 },
      (bound) => (bound === 10000 ? tier : 0),
    );
    roundtrip(s);
    const corrupt = save(s);
    corrupt.pack.rounds[0].payout = 123456;
    corrupt.history[2].payout = 123456;
    expect(restoreSession(JSON.stringify(corrupt)).notice).toBeTruthy();
  }
});
it("keeps empty unfinished Keno drafts, but never lets them play", () => {
  const tickets = [{ picks: [], stake: 100 }];
  expect(
    restoreOptions(JSON.stringify({ tickets }), initialSession()).tickets,
  ).toEqual(tickets);
  expect(() =>
    playSession(initialSession(), "keno", 100, {}, { tickets }),
  ).toThrow();
});
it("rejects out-of-range draws before producing an un-restorable state", () => {
  for (const game of ["plinko", "roulette", "keno", "blackjack"] as const)
    expect(() =>
      playSession(initialSession(), game, 100, {}, {}, () => 99),
    ).toThrow("Invalid random draw");
});

it("normalizes a pending Plinko count when resuming the last Scratch pack", () => {
  const s = playSession(
    initialSession(),
    "scratch_cards",
    100,
    {},
    { count: 3 },
    () => 0,
  );
  expect(restoreOptions('{"count":10}', s).count).toBe(1);
});
