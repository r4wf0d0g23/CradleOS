import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  BASE_POINTS,
  FLEET,
  FLEET_KEYS,
  GATE_WEIGHTS,
  LINE_WEIGHTS,
  WAY_WEIGHTS,
  CLUSTER_WEIGHTS,
  COIN_POINTS,
  COIN_THRESHOLDS,
  LINES,
  WILD,
  SCATTER,
  lineWins,
  wayWins,
  groupWins,
  collapse,
  spinFleet,
  validSlotReceipt,
  type FleetKey,
  type SlotReceipt,
} from "./casinoSlotFleet";
import {
  initialSession,
  playSession,
  revealSlot,
  pendingSlot,
  activeSession,
  restoreSession,
} from "./casinoSessions";
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function rng(seed = 719) {
  let x = seed;
  return (b: number) => {
    let n: number;
    const cap = Math.floor(4294967296 / b) * b;
    do {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      n = x >>> 0;
    } while (n >= cap);
    return n % b;
  };
}
function tape(values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw Error("test tape exhausted");
    return values[i++];
  };
}
const full = (n: number, rows = 3) =>
  Array.from({ length: 5 }, () => Array(rows).fill(n));
function feature(key: FleetKey) {
  const draw = rng(829);
  for (let i = 0; i < 1000; i++) {
    const r = spinFleet(key, 2500, draw);
    if (r.frames.length > 1) return r;
  }
  throw Error("No feature fixture");
}
function session(r: SlotReceipt) {
  return playSession(initialSession(), r.key, r.stake, {}, {}, tape(r.draws));
}
describe("slot fleet evaluated mechanics", () => {
  it("freezes v1 rules and replay strings with a deterministic golden fingerprint", () => {
    const data = [
      FLEET,
      BASE_POINTS,
      LINE_WEIGHTS,
      WAY_WEIGHTS,
      CLUSTER_WEIGHTS,
      GATE_WEIGHTS,
      COIN_POINTS,
      COIN_THRESHOLDS,
      LINES,
      FLEET_KEYS.map((k) => spinFleet(k, 2500, rng(18828))),
    ];
    expect(
      createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    ).toBe("23cc3d2f394ca1480549faf5d1cf7d8745090fc90952ea2aad0a3d1e84de355c");
  });
  it("pays highest longest single interpretation per line; wilds never double-pay", () => {
    const wins = lineWins(full(WILD));
    expect(wins).toHaveLength(10);
    expect(wins.every((w) => w.symbol === 6 && w.points === 1600)).toBe(true);
    const board = full(8);
    board[0][1] = 0;
    board[1][1] = WILD;
    board[2][1] = 0;
    board[3][1] = 1;
    const line = lineWins(board);
    expect(line).toHaveLength(1);
    expect(line[0]).toMatchObject({ count: 3, points: 8, cells: [1, 6, 11] });
  });
  it("evaluates actual combinations on variable-height ways and stops at gaps", () => {
    const b = [
      [0, 0],
      [0, 0, 1],
      [0, 0, 0, 2],
      [0, 3],
      [0, 0, 0, 0, 4],
    ];
    expect(wayWins(b)).toEqual([
      {
        symbol: 0,
        count: 5,
        ways: 48,
        cells: [0, 1, 5, 6, 10, 11, 12, 15, 20, 21, 22, 23],
        points: 3840,
      },
    ]);
    b[2] = [1, 1];
    expect(wayWins(b).find((w) => w.symbol === 0)).toBeUndefined();
  });
  it("does not connect diagonals or wrap edges; anywhere counts disconnected symbols", () => {
    const diagonal = full(8, 5);
    for (let i = 0; i < 5; i++) diagonal[i][i] = 0;
    expect(groupWins(diagonal, true)).toEqual([]);
    const b = full(8, 5);
    b[0][0] = b[0][1] = b[0][2] = b[1][2] = b[2][2] = 0;
    expect(groupWins(b, true)[0]).toMatchObject({ count: 5, points: 8 });
    for (const [c, r] of [
      [3, 0],
      [3, 4],
      [4, 1],
    ])
      b[c][r] = 0;
    expect(groupWins(b, false)[0]).toMatchObject({ count: 8, points: 8 });
    expect(groupWins(b, true)[0].count).toBe(5);
  });
  it("gravity retains survivors, refills only removed cells and caps cascade length", () => {
    let draws = 0;
    expect(
      collapse(
        [
          [0, 1, 2],
          [3, 4, 5],
        ],
        new Set([0, 2, 6]),
        () => {
          draws++;
          return 6;
        },
      ),
    ).toEqual([
      [6, 6, 1],
      [6, 3, 5],
    ]);
    expect(draws).toBe(3);
    for (const [key, n] of [
      ["slot_reactor", 6],
      ["slot_feral", 4],
    ] as const) {
      const r = spinFleet(key, 100, () => 0);
      expect(r.frames).toHaveLength(n);
      expect(r.draws).toHaveLength(n * (key === "slot_reactor" ? 20 : 25));
      expect(r.frames.map((f) => f.multiplier)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
    }
  });
  it("records scatter evidence before expansion, and never retriggers free spins", () => {
    // Each of first three columns includes a scatter and a wild: visible scatters disappear.
    const r = spinFleet(
      "slot_gatecrash",
      100,
      tape([
        ...Array(3).fill([99, 93, 0]).flat(),
        ...Array(6).fill(0),
        ...Array(75).fill(99),
      ]),
    );
    expect(r.frames).toHaveLength(6);
    expect(r.frames[0].scatters).toBe(3);
    expect(r.frames[0].grid.flat().filter((n) => n === SCATTER)).toHaveLength(
      0,
    );
    expect(
      r.frames[0].original.flat().filter((n) => n === SCATTER),
    ).toHaveLength(3);
    expect(r.frames.slice(1).every((f) => f.scatters === 15)).toBe(true);
    expect(validSlotReceipt(r)).toBe(true);
  });
  it("locks wilds only inside drone free spins, and carries every acquired position", () => {
    const draws = [
      ...Array(3).fill(99),
      ...Array(12).fill(91),
      91,
      ...Array(14).fill(0),
      ...Array(105).fill(0),
    ];
    const r = spinFleet("slot_drones", 123, tape(draws));
    expect(r.frames).toHaveLength(9);
    expect(r.frames[0].grid.flat().filter((n) => n === WILD)).toHaveLength(12);
    expect(r.frames[1].grid.flat().filter((n) => n === WILD)).toHaveLength(1);
    expect(r.frames.slice(1).every((f) => f.grid[0][0] === WILD)).toBe(true);
  });
  it("holds values, resets on new coin, pays once on timeout", () => {
    const initial = [...Array(6).fill([0, 0]).flat(), ...Array(9).fill(99)];
    const r = spinFleet(
      "slot_vault",
      100,
      tape([...initial, 0, 9999, ...Array(8).fill(99), ...Array(24).fill(99)]),
    );
    expect(r.frames.map((f) => f.remaining)).toEqual([3, 3, 2, 1, 0]);
    expect(r.frames[r.frames.length - 1].coins.slice(0, 7)).toEqual([
      1, 1, 1, 1, 1, 1, 500,
    ]);
    expect(r.frames.slice(0, -1).every((f) => f.award === 0)).toBe(true);
    expect(r.payout).toBe(
      Number((100n * 506n * BigInt(FLEET.slot_vault.scale)) / 100000000n),
    );
  });
  it("fewer than 6 coins pays nothing, full-grid adds exactly one fixed bonus, cap holds", () => {
    const loss = spinFleet(
      "slot_vault",
      100,
      tape([...Array(5).fill([0, 9999]).flat(), ...Array(10).fill(99)]),
    );
    expect(loss.payout).toBe(0);
    expect(loss.frames).toHaveLength(1);
    const full = spinFleet(
      "slot_vault",
      100,
      tape(Array(15).fill([0, 0]).flat()),
    );
    expect(full.frames).toHaveLength(2);
    expect(full.frames[1].points).toBe(115);
    const high = spinFleet(
      "slot_vault",
      100,
      tape(Array(15).fill([0, 9999]).flat()),
    );
    expect(high.payout).toBe(250000);
    expect(high.capReached).toBe(true);
    expect(high.frames.reduce((a, f) => a + f.award, 0)).toBe(high.payout);
  });
  it("supports the extremal 27-respin path without spending beyond its bounded tape", () => {
    const draws = [...Array(6).fill([0, 0]).flat(), ...Array(9).fill(99)];
    for (let empty = 9; empty >= 1; empty--)
      draws.push(
        ...Array(empty * 2).fill(99),
        0,
        0,
        ...Array(empty - 1).fill(99),
      );
    const r = spinFleet("slot_vault", 100, tape(draws));
    expect(r.frames).toHaveLength(28);
    expect(r.frames[r.frames.length - 1].coins.every((n) => n > 0)).toBe(true);
    expect(validSlotReceipt(r)).toBe(true);
  });
  it("payouts telescope with cumulative fractional carry and immutable whole-round cap", () => {
    for (const key of FLEET_KEYS)
      for (const stake of [100, 2500, 100000]) {
        const r = spinFleet(key, stake, rng(102));
        let points = 0,
          total = 0;
        for (const f of r.frames) {
          points += f.points;
          const next = Math.min(
            stake * 2500,
            Number(
              (BigInt(stake) * BigInt(points) * BigInt(FLEET[key].scale)) /
                100000000n,
            ),
          );
          expect(f.total).toBe(next);
          expect(f.award).toBe(next - total);
          expect(f.award).toBeGreaterThanOrEqual(0);
          total = next;
        }
        expect(r.payout).toBe(total);
        expect(validSlotReceipt(r)).toBe(true);
      }
  });
});
describe("slot feature ledger and restore", () => {
  it.each(FLEET_KEYS)(
    "%s debits once, resumes every cursor without RNG or economic mutation",
    (key) => {
      const r = feature(key);
      let s = session(r);
      const economic = JSON.stringify([s.balance, s.history, s.sequence]);
      expect(s.balance).toBe(1000000 - r.stake + r.payout);
      expect(s.history).toHaveLength(1);
      expect(activeSession(s)).toBe(true);
      for (let i = 0; i < r.frames.length; i++) {
        expect(s.pack!.slot!.cursor).toBe(i);
        expect(restoreSession(JSON.stringify(s))).toEqual(s);
        s = revealSlot(s);
        expect(JSON.stringify([s.balance, s.history, s.sequence])).toBe(
          economic,
        );
      }
      expect(pendingSlot(s)).toBe(false);
      expect(() => revealSlot(s)).toThrow();
      expect(restoreSession(JSON.stringify(s))).toEqual(s);
    },
  );
  it("reveal all only changes cursor; locked feature blocks other games; BJ blocks slots", () => {
    const s = session(feature("slot_vault"));
    const done = revealSlot(s, true);
    expect(done.balance).toBe(s.balance);
    expect(done.sequence).toBe(s.sequence);
    expect(done.history).toEqual(s.history);
    expect(pendingSlot(done)).toBe(false);
    expect(() => playSession(s, "slots", 100)).toThrow(/Finish/);
    let bj = playSession(initialSession(), "blackjack", 100, {}, {}, rng());
    expect(bj.table).not.toBeNull();
    expect(() => playSession(bj, "slot_vault", 100)).toThrow(/Finish/);
  });
  it("affordability is checked before any random draw and failed RNG does not mutate", () => {
    const s = { ...initialSession(), balance: 99 };
    let count = 0;
    expect(() =>
      playSession(s, "slot_vault", 100, {}, {}, (b) => {
        count++;
        return b;
      }),
    ).toThrow();
    expect(count).toBe(0);
    expect(s.balance).toBe(99);
    const t = initialSession(),
      before = JSON.stringify(t);
    expect(() =>
      playSession(t, "slot_drones", 100, {}, {}, () => 999),
    ).toThrow();
    expect(JSON.stringify(t)).toBe(before);
  });
  it("rejects altered tape/awards/shape/cursor/version and never falls back to stale v1", () => {
    const s = session(feature("slot_drones"));
    const edits = [
      (r: SlotReceipt) => r.draws.push(0),
      (r: SlotReceipt) => r.draws.pop(),
      (r: SlotReceipt) => (r.draws[0] = NaN),
      (r: SlotReceipt) => (r.frames[0].grid[0][0] = 10),
      (r: SlotReceipt) => r.frames[0].award++,
      (r: SlotReceipt) => r.frames[0].points++,
      (r: SlotReceipt) => r.payout++,
      (r: SlotReceipt) => (r.cursor = -1),
      (r: SlotReceipt) => (r.cursor = 100),
      (r: SlotReceipt) => ((r as any).version = 2),
      (r: SlotReceipt) => (r.frames[0].coins = Array(1000).fill(1)),
    ];
    for (const edit of edits) {
      const t = clone(s);
      edit(t.pack!.slot!);
      expect(validSlotReceipt(t.pack!.slot)).toBe(false);
      expect(
        restoreSession(JSON.stringify(t), JSON.stringify({ ...t, version: 1 }))
          .notice,
      ).toMatch(/could not/);
    }
    expect(restoreSession(" ".repeat(300001)).notice).toMatch(/could not/);
  });
  it("old v2 packs and active hands continue restoring without a slot field", () => {
    for (const game of ["slots", "blackjack", "roulette"] as const) {
      const s = playSession(
        initialSession(),
        game,
        100,
        {},
        game === "roulette"
          ? { wagers: [{ kind: "straight", value: 0, stake: 100 }] }
          : {},
        rng(),
      );
      expect(restoreSession(JSON.stringify(s))).toEqual(s);
    }
  });
});
