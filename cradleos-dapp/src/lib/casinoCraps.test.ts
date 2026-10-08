import { describe, it, expect } from "vitest";
import {
  POINTS,
  HARD,
  CRAPS_KEYS,
  crapsEscrow,
  newCraps,
  evaluateCraps,
  validCraps,
  validCrapsBets,
  crapsUnit,
  oddsLimit,
  type CrapsBets,
} from "./casinoCraps";
import {
  changeCrapsBet as bet,
  rollCraps,
  revealCraps,
} from "./casinoCrapsSession";
import {
  initialSession,
  restoreSession,
  playSession,
  actSession,
  activeSession,
  startSpinRun,
  revealClassicSpin,
  stopSpinRun,
  type Session,
} from "./casinoSessions";
import { initialPractice, playPractice } from "./casinoPractice";
const pairs = Array.from(
  { length: 36 },
  (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1] as [number, number],
);
const check = (point: number, bets: CrapsBets, dice: [number, number]) =>
  evaluateCraps({ id: 1, point, bets, dice });
const round = (s: Session, a: number, b: number) => {
  let i = 0;
  return rollCraps(s, () => [a - 1, b - 1][i++]);
};
const reveal = (s: Session) => revealCraps(s, s.craps!.sequence);
const reload = (s: Session) => {
  const r = restoreSession(JSON.stringify(s));
  expect(r.notice).toBeUndefined();
  expect(r).toEqual(s);
  return r;
};
const point = (n: number) => {
  let s = bet(initialSession(), "pass", 1000);
  const p = pairs.find((v) => v[0] + v[1] === n)!;
  return reveal(round(s, ...p));
};
describe("Frontier craps independent rules", () => {
  it("all 36 come-out pairs: Pass, Don’t bar12, Field and OFF place/hardways", () => {
    for (const dice of pairs) {
      const n = dice[0] + dice[1],
        e = check(
          0,
          { pass: 100, dont: 100, field: 100, place6: 600, hard6: 100 },
          dice,
        );
      const payouts = Object.fromEntries(
        e.settled.map((x) => [x.key, x.payout]),
      );
      expect(payouts.pass).toBe(
        [7, 11].includes(n) ? 200 : [2, 3, 12].includes(n) ? 0 : undefined,
      );
      expect(payouts.dont).toBe(
        [2, 3].includes(n)
          ? 200
          : [7, 11].includes(n)
            ? 0
            : n === 12
              ? 100
              : undefined,
      );
      expect(payouts.field).toBe(
        n === 2
          ? 300
          : n === 12
            ? 400
            : [3, 4, 9, 10, 11].includes(n)
              ? 200
              : 0,
      );
      expect(e.bets.place6).toBe(600);
      expect(e.bets.hard6).toBe(100);
      expect(e.point).toBe(POINTS.includes(n as 4) ? n : 0);
    }
  });
  it("all 216 point/pair combinations pay both sides and true odds exactly", () => {
    for (const p of POINTS)
      for (const dice of pairs) {
        const n = dice[0] + dice[1],
          e = check(
            p,
            { pass: 1000, dont: 1000, passOdds: 3000, dontOdds: 6000 },
            dice,
          );
        const resolved = n === 7 || n === p;
        expect(e.settled.length).toBe(resolved ? 4 : 0);
        expect(e.point).toBe(resolved ? 0 : p);
        if (resolved) {
          const po =
              p === 4 || p === 10 ? 6000 : p === 5 || p === 9 ? 4500 : 3600,
            doo = p === 4 || p === 10 ? 3000 : p === 5 || p === 9 ? 4000 : 5000;
          expect(e.payout).toBe(n === p ? 2000 + 3000 + po : 2000 + 6000 + doo);
          expect(e.stake).toBe(11000);
        } else {
          expect(e.bets).toEqual({
            pass: 1000,
            dont: 1000,
            passOdds: 3000,
            dontOdds: 6000,
          });
          expect(e.payout).toBe(0);
        }
      }
  });
  it("all place and hardways numbers resolve before seven; side winners come down", () => {
    for (const num of POINTS)
      for (const dice of pairs) {
        const key = `place${num}`,
          stake = num === 6 || num === 8 ? 600 : 500,
          n = dice[0] + dice[1],
          e = check(8, { [key]: stake }, dice);
        expect(e.payout).toBe(
          n === num ? stake + (num === 4 || num === 10 ? 900 : 700) : 0,
        );
        expect(e.settled.length).toBe(n === num || n === 7 ? 1 : 0);
        expect(e.bets[key]).toBe(n === num || n === 7 ? undefined : stake);
      }
    for (const num of HARD)
      for (const dice of pairs) {
        const n = dice[0] + dice[1],
          e = check(6, { [`hard${num}`]: 100 }, dice);
        expect(e.payout).toBe(
          n === num && dice[0] === dice[1]
            ? num === 6 || num === 8
              ? 1000
              : 800
            : 0,
        );
        expect(e.settled.length).toBe(n === num || n === 7 ? 1 : 0);
      }
  });
  it("mathematical house edges: Pass 7/495, Don’t 3/220, Field 1/36 and true odds zero", () => {
    const probability = new Map<number, number>();
    for (const d of pairs)
      probability.set(d[0] + d[1], (probability.get(d[0] + d[1]) ?? 0) + 1);
    let pass = 0,
      dont = 0,
      field = 0;
    for (const [n, count] of probability) {
      const q = count / 36;
      pass +=
        q *
        ([7, 11].includes(n)
          ? 1
          : [2, 3, 12].includes(n)
            ? -1
            : (count - 6) / (count + 6));
      dont +=
        q *
        ([2, 3].includes(n)
          ? 1
          : [7, 11].includes(n)
            ? -1
            : n === 12
              ? 0
              : (6 - count) / (6 + count));
      field +=
        q *
        (check(0, { field: 100 }, pairs.find((d) => d[0] + d[1] === n)!)
          .payout /
          100 -
          1);
    }
    expect(pass).toBeCloseTo(-7 / 495, 12);
    expect(dont).toBeCloseTo(-3 / 220, 12);
    expect(field).toBeCloseTo(-1 / 36, 12);
    for (const p of POINTS) {
      let net = 0;
      for (const dice of pairs) {
        const e = check(p, { passOdds: 3000 }, dice);
        net += e.payout - e.stake;
      }
      expect(net).toBe(0);
    }
  });
});
describe("craps escrow and persistence", () => {
  it("placement/debit/removal once; no overdraw, invalid increments or line abuse", () => {
    let s = bet(initialSession(), "pass", 500);
    expect(s.balance).toBe(999500);
    s = bet(s, "pass", -500);
    expect(s.balance).toBe(1000000);
    expect(() => bet(s, "place6", 500)).toThrow();
    expect(() => bet(s, "bogus", 100)).toThrow();
    expect(() => bet(s, "pass", NaN)).toThrow();
    expect(() => bet({ ...s, balance: 99 }, "pass", 100)).toThrow();
    expect(() => bet(s, "field", 100100)).toThrow();
    s = point(6);
    for (const k of ["pass", "dont"]) expect(() => bet(s, k, 100)).toThrow();
    expect(() => bet(s, "pass", -1000)).toThrow();
    s = bet(s, "passOdds", 5000);
    expect(() => bet(s, "passOdds", 500)).toThrow();
    s = bet(s, "passOdds", -5000);
    expect(s.balance).toBe(999000);
  });
  it("Don’t can be taken down with its linked odds; cap/increment validation", () => {
    let s = bet(initialSession(), "dont", 500);
    s = reveal(round(s, 2, 3));
    s = bet(s, "dontOdds", 3000);
    expect(() => bet(s, "dontOdds", 300)).toThrow();
    const b = s.balance;
    s = bet(s, "dont", -500);
    expect(s.balance).toBe(b + 3500);
    expect(s.craps!.bets).toEqual({});
    expect(() => bet(s, "dontOdds", 300)).toThrow();
    for (const n of POINTS) {
      expect(oddsLimit("dontOdds", n, { dont: 500 })).toBe(3000);
      expect(crapsUnit("dontOdds", n)).toBe(
        n === 4 || n === 10 ? 200 : n === 5 || n === 9 ? 300 : 600,
      );
    }
  });
  it("multi-roll accounting obeys available+escrow delta=payout-resolved stakes", () => {
    let s = point(6);
    s = bet(s, "passOdds", 5000);
    s = bet(s, "place8", 600);
    s = bet(s, "hard8", 100);
    s = bet(s, "field", 500);
    for (const d of [
      [1, 4],
      [4, 4],
      [3, 3],
    ] as [number, number][]) {
      const before = s.balance + crapsEscrow(s.craps),
        b = s.balance,
        seq = s.sequence;
      s = round(s, ...d);
      const e = evaluateCraps(s.craps!.rolls[0]);
      expect(s.balance - b).toBe(e.payout);
      expect(s.sequence).toBe(seq);
      expect(s.balance + crapsEscrow(s.craps) - before).toBe(
        e.payout - e.stake,
      );
      expect(activeSession(s)).toBe(true);
      reload(s);
      expect(() => rollCraps(s)).toThrow();
      expect(() => bet(s, "field", 100)).toThrow();
      expect(() => playSession(s, "coinflip", 100)).toThrow();
      const paid = s.balance;
      s = reveal(reload(s));
      expect(s.balance).toBe(paid);
      expect(reveal(s)).toBe(s);
      reload(s);
    }
    expect(s.craps!.point).toBe(0);
    expect(crapsEscrow(s.craps)).toBe(0);
  });
  it("parked bets survive other games, pack validators, stopped slot runs and legacy blackjack", () => {
    let s = point(5),
      parked = s.craps;
    expect(activeSession(s)).toBe(false);
    s = playSession(s, "coinflip", 100, { side: 0 }, {}, () => 0);
    expect(s.craps).toEqual(parked);
    reload(s);
    s = startSpinRun(s, "slots", 100, 3, () => 0);
    s = stopSpinRun(s);
    s = revealClassicSpin(s);
    expect(s.craps).toEqual(parked);
    reload(s);
    s = playSession(s, "blackjack", 100, {}, { seats: 1 }, () => 0);
    expect(s.craps).toEqual(parked);
    reload(s);
    while (s.table) s = actSession(s, "stand");
    reload(s);
    expect(s.craps).toEqual(parked);
    const legacy = playPractice(
      initialPractice(),
      "blackjack",
      100,
      {},
      () => 0,
    );
    if (legacy.hand) {
      s = { ...initialSession(), ...legacy, version: 2, craps: parked };
      s = actSession(s, "stand");
      expect(s.craps).toEqual(parked);
      reload(s);
    }
  });
  it("old saves restore unchanged; invalid random cannot debit; zero balance can finish escrow", () => {
    const s = initialSession();
    expect(restoreSession(JSON.stringify(s))).toEqual(s);
    const p = point(4),
      json = JSON.stringify(p);
    for (const n of [-1, 6, NaN, 1.5])
      expect(() => rollCraps(p, () => n)).toThrow();
    expect(JSON.stringify(p)).toBe(json);
    const done = reveal(round({ ...p, balance: 0 }, 2, 2));
    expect(done.balance).toBe(2000);
  });
  it("rejects malformed saves and competing pending activities; no silent old v2 rollback", () => {
    const s = round(point(6), 3, 3);
    const bads: Array<(x: Session) => void> = [
      (x) => {
        x.craps!.point = 8;
      },
      (x) => {
        x.craps!.bets = { pass: 100 };
      },
      (x) => {
        x.craps!.rolls[0].dice = [0, 6];
      },
      (x) => {
        x.craps!.rolls[0].dice = [7, 6];
      },
      (x) => {
        x.craps!.rolls[0].bets = { place6: 500 };
      },
      (x) => {
        x.craps!.sequence++;
      },
      (x) => {
        x.craps!.rolls = [];
      },
      (x) => {
        x.craps!.pending = "true" as unknown as boolean;
      },
      (x) => {
        x.craps!.bets = { x: 100 };
      },
      (x) => {
        x.craps!.rolls[0].id = 0;
      },
    ];
    for (const mutate of bads) {
      const x = JSON.parse(JSON.stringify(s));
      mutate(x);
      const restored = restoreSession(JSON.stringify(x));
      expect(restored.notice).toMatch(/could not be read/);
      expect(restored.craps).toBeUndefined();
    }
    const invalid = {
      ...s,
      hand: playPractice(initialPractice(), "blackjack", 100, {}, () => 0).hand,
    };
    expect(restoreSession(JSON.stringify(invalid)).notice).toBeTruthy();
  });
  it("bounds every key, aggregate stake, integer ratios and sequence-zero point", () => {
    expect(validCraps({ ...newCraps(), point: 6 })).toBe(false);
    expect(validCrapsBets({ pass: 100000, field: 100 }, 0)).toBe(false);
    expect(validCrapsBets({ passOdds: 100 }, 0)).toBe(false);
    expect(validCrapsBets({ dontOdds: 600, dont: 100 }, 6)).toBe(true);
    expect(validCrapsBets({ dontOdds: 1200, dont: 100 }, 6)).toBe(false);
    for (const key of CRAPS_KEYS) {
      expect(validCrapsBets({ [key]: Infinity }, 0)).toBe(false);
    }
  });
});

describe("craps restore and balance headroom hardening", () => {
  it("reserves worst gross return so other games cannot strand parked chips at ceiling", () => {
    const s = bet({ ...initialSession(), balance: 1e12 - 700 }, "place6", 600);
    expect(() =>
      playSession(s, "coinflip", 100, { side: 0 }, {}, () => 0),
    ).toThrow(/limit/);
    expect(bet(s, "place6", -600).balance).toBe(1e12 - 700);
    expect(() =>
      bet({ ...initialSession(), balance: 1e12 }, "pass", 100),
    ).toThrow();
    const raw = { ...s, balance: 1e12 - 600 };
    expect(restoreSession(JSON.stringify(raw)).notice).toBeTruthy();
  });
  it("rejects phase discontinuity, unknown fields and negative concealed available balance", () => {
    const s = reveal(round(point(6), 1, 6));
    for (const mutate of [
      (v: Session) => {
        v.craps!.point = 6;
      },
      (v: Session) => {
        Object.assign(v.craps!, { x: 1 });
      },
      (v: Session) => {
        Object.assign(v.craps!.rolls[0], { x: 1 });
      },
      (v: Session) => {
        v.craps!.rolls[0].point = 4;
      },
    ]) {
      const v = JSON.parse(JSON.stringify(s));
      mutate(v);
      expect(restoreSession(JSON.stringify(v)).notice).toBeTruthy();
    }
    const pending = round(point(6), 3, 3);
    expect(
      restoreSession(JSON.stringify({ ...pending, balance: 0 })).notice,
    ).toBeTruthy();
  });
  it("keeps exact integer outcomes and valid saved receipts through 200 sequential rolls", () => {
    let s = initialSession();
    let seed = 21879;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed % 6;
    };
    for (let i = 0; i < 200; i++) {
      if (!s.craps?.point) s = bet(s, "pass", 1000);
      s = bet(s, "field", 100);
      if (!s.craps!.bets.place6) s = bet(s, "place6", 600);
      const before = s.balance + crapsEscrow(s.craps);
      s = rollCraps(s, rng);
      const e = evaluateCraps(s.craps!.rolls[0]);
      expect(s.balance + crapsEscrow(s.craps) - before).toBe(
        e.payout - e.stake,
      );
      reload(s);
      s = reveal(s);
      reload(s);
    }
    expect(s.craps!.rolls).toHaveLength(8);
    expect(s.craps!.sequence).toBe(200);
  });
});
