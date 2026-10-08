/** Audited local practice rules. No network, signing, or redeemable balances. */
export const EXPANDED_GAMES = [
  "limbo",
  "crash",
  "diamonds",
  "keno",
  "sicbo",
  "double_dice",
  "baccarat",
  "three_card_poker",
  "dragon_tiger",
  "under_over_7",
  "ore_refine",
  "risk_wheel",
  "money_wheel",
  "andar_bahar",
  "scratch_cards",
  "chuck_a_luck",
  "red_dog",
] as const;
export type ExpandedGame = (typeof EXPANDED_GAMES)[number];
export type ExpandedChoice = {
  side?: number;
  target?: number;
  over?: boolean;
  picks?: number[];
};
type RNG = (bound: number) => number;
export const RISK_TABLES = [
  [
    ...Array(6).fill(0),
    ...Array(9).fill(12000),
    ...Array(4).fill(14000),
    30000,
  ],
  [...Array(12).fill(0), ...Array(5).fill(12000), 16000, 16000, 100000],
  [...Array(14).fill(0), ...Array(4).fill(11000), 13000, 135000],
] as number[][];
export const MONEY_TABLE = [
  ...Array(24).fill(0),
  ...Array(18).fill(11000),
  ...Array(8).fill(12000),
  16000,
  16000,
  16000,
  180000,
] as number[];
export const KENO_TABLE = [
  [0, 38500],
  [0, 5500, 130000],
  [0, 0, 48000, 250000],
  [0, 0, 23000, 92000, 470000],
  [0, 0, 0, 72000, 295000, 2950000],
  [0, 0, 0, 32000, 130000, 970000, 9700000],
];
export const ORE_CUM = [
  [300, 4140, 9500],
  [800, 5367, 9200],
  [1500, 7550, 9000],
  [2500, 8885, 9500],
  [4000, 8929, 9600],
];
export const ORE_BPS = [
  [0, 8000, 10500, 20000],
  [0, 5000, 11000, 40000],
  [0, 3000, 13000, 60000],
  [0, 2000, 15000, 150000],
  [0, 1000, 18000, 200000],
];
export const SCRATCH_BPS = [0, 15000, 30000, 80000, 200000, 1000000];
export const integerIn = (x: unknown, lo: number, hi: number): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= lo && x <= hi;
function check(x: number, lo: number, hi: number, label: string) {
  if (!integerIn(x, lo, hi)) throw Error(`Choose a valid ${label}.`);
  return x;
}
function shuffle(a: number[], rng: RNG) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function threeRank(cards: number[]) {
  const r = cards.map((c) => c % 13).sort((a, b) => a - b),
    flush = cards.every(
      (c) => Math.floor(c / 13) === Math.floor(cards[0] / 13),
    );
  const straight =
    (r[1] === r[0] + 1 && r[2] === r[1] + 1) ||
    (r[0] === 0 && r[1] === 11 && r[2] === 12);
  return flush && straight
    ? 5
    : r[0] === r[2]
      ? 4
      : straight
        ? 3
        : flush
          ? 2
          : new Set(r).size === 2
            ? 1
            : 0;
}
export const threeHigh = (a: number[]) =>
  Math.max(...a.map((c) => (c % 13 === 0 ? 13 : c % 13)));
/** This contract variant breaks same-category ties by highest card only. */
export function threeBps(p: number[], d: number[]) {
  const pr = threeRank(p),
    dr = threeRank(d),
    diff = pr - dr || threeHigh(p) - threeHigh(d);
  return diff < 0
    ? 0
    : diff === 0
      ? 10000
      : dr === 0 && threeHigh(d) < 11
        ? 17500
        : [20000, 20000, 20000, 30000, 50000, 60000][pr];
}
export function redDogBps(a: number, b: number, c: number) {
  const diff = Math.abs(a - b);
  return diff === 0
    ? c === a
      ? 120000
      : 10000
    : diff === 1
      ? 10000
      : c > Math.min(a, b) && c < Math.max(a, b)
        ? ([0, 60000, 50000, 40000, 30000][diff - 1] ?? 20000)
        : 0;
}
/** Standard tableau: when Player stands, Banker draws on 0–5. */
export function bankerDraws(score: number, third: number | null) {
  return third === null
    ? score <= 5
    : score <= 2 ||
        (score === 3 && third !== 8) ||
        (score === 4 && third >= 2 && third <= 7) ||
        (score === 5 && third >= 4 && third <= 7) ||
        (score === 6 && (third === 6 || third === 7));
}
export const baccaratScore = (a: number[]) =>
  a.reduce((s, c) => s + (c % 13 >= 9 ? 0 : (c % 13) + 1), 0) % 10;
export function expandedOutcome(
  game: ExpandedGame,
  choice: ExpandedChoice,
  source: RNG,
) {
  const rng: RNG = (n) => check(source(n), 0, n - 1, "random draw"),
    side = choice.side ?? 0,
    target = choice.target ?? 2;
  let values: number[] = [],
    bps = 0,
    label = "";
  const dice = (n: number) => Array.from({ length: n }, () => rng(6) + 1);
  const deck = () =>
    shuffle(
      Array.from({ length: 52 }, (_, i) => i),
      rng,
    );
  switch (game) {
    case "limbo":
    case "crash": {
      // Two unbiased base-1000 draws support a million outcomes without modulo bias.
      check(target, 101, 100000, "target from 1.01× to 1,000×");
      const roll = rng(1000) * 1000 + rng(1000) + 1,
        crash = Math.min(10000000, Math.floor(9800000000 / roll)),
        goal = target * 100;
      values = [crash, goal];
      bps = crash >= goal ? goal : 0;
      label = `${(crash / 10000).toFixed(2)}× limit · ${(goal / 10000).toFixed(2)}× target`;
      break;
    }
    case "diamonds": {
      values = Array.from({ length: 5 }, () => rng(7));
      const best = Math.max(
        ...Array.from(
          { length: 7 },
          (_, i) => values.filter((v) => v === i).length,
        ),
      );
      bps = best === 5 ? 5000000 : best === 4 ? 300000 : best === 3 ? 25500 : 0;
      label = `${best} matching signals`;
      break;
    }
    case "keno": {
      const picks = choice.picks ?? [];
      if (
        picks.length < 1 ||
        picks.length > 6 ||
        new Set(picks).size !== picks.length ||
        picks.some((n) => !integerIn(n, 1, 40))
      )
        throw Error("Select 1–6 distinct numbers.");
      const drawn = shuffle(
          Array.from({ length: 40 }, (_, i) => i + 1),
          rng,
        ).slice(0, 10),
        hits = picks.filter((n) => drawn.includes(n)).length;
      values = [picks.length, ...picks, ...drawn];
      bps = KENO_TABLE[picks.length - 1][hits];
      label = `${hits} of ${picks.length} matched`;
      break;
    }
    case "sicbo": {
      check(side, 0, 4, "bet type");
      if (side === 2 || side === 3) check(target, 1, 6, "die face");
      values = dice(3);
      const sum = values.reduce((a, b) => a + b, 0),
        trip = new Set(values).size === 1,
        hits = values.filter((v) => v === target).length;
      bps =
        side === 0
          ? !trip && sum <= 10
            ? 20000
            : 0
          : side === 1
            ? !trip && sum >= 11
              ? 20000
              : 0
            : side === 2
              ? hits
                ? (hits + 1) * 10000
                : 0
              : side === 3
                ? trip && hits === 3
                  ? 1800000
                  : 0
                : trip
                  ? 300000
                  : 0;
      label = `${values.join(" + ")} = ${sum}`;
      break;
    }
    case "double_dice":
    case "under_over_7": {
      check(side, 0, game === "double_dice" ? 4 : 2, "bet type");
      if (side === 4) check(target, 2, 12, "sum");
      values = dice(2);
      const sum = values[0] + values[1];
      bps =
        game === "under_over_7"
          ? (side === 0 && sum < 7) || (side === 2 && sum > 7)
            ? 23200
            : side === 1 && sum === 7
              ? 57000
              : 0
          : (side === 0 && sum < 7) || (side === 1 && sum > 7)
            ? 23000
            : (side === 2 && sum === 7) ||
                (side === 3 && values[0] === values[1])
              ? 55000
              : side === 4 && sum === target
                ? Math.floor(342000 / (target <= 7 ? target - 1 : 13 - target))
                : 0;
      label = `${values.join(" + ")} = ${sum}`;
      break;
    }
    case "chuck_a_luck": {
      check(target, 1, 6, "die face");
      values = dice(3);
      const n = values.filter((v) => v === target).length;
      bps = [0, 19000, 37000, 120000][n];
      label = `${n} matched · ${values.join(" / ")}`;
      break;
    }
    case "baccarat": {
      check(side, 0, 2, "bet side");
      const d = deck(),
        p = [d[0], d[2]],
        b = [d[1], d[3]];
      let cursor = 4,
        third: number | null = null;
      if (baccaratScore(p) < 8 && baccaratScore(b) < 8) {
        if (baccaratScore(p) <= 5) {
          const c = d[cursor++];
          p.push(c);
          third = c % 13 >= 9 ? 0 : (c % 13) + 1;
        }
        if (bankerDraws(baccaratScore(b), third)) b.push(d[cursor]);
      }
      const ps = baccaratScore(p),
        bs = baccaratScore(b),
        winner = ps === bs ? 2 : ps > bs ? 0 : 1;
      bps =
        winner === side
          ? [20000, 19500, 90000][side]
          : winner === 2 && side !== 2
            ? 10000
            : 0;
      values = [...p, -1, ...b];
      label = `Player ${ps} · Banker ${bs}`;
      break;
    }
    case "three_card_poker": {
      const d = deck(),
        p = [d[0], d[2], d[4]],
        b = [d[1], d[3], d[5]];
      values = [...p, -1, ...b];
      bps = threeBps(p, b);
      label = `${["High card", "Pair", "Flush", "Straight", "Three of a kind", "Straight flush"][threeRank(p)]} · ${bps === 10000 ? "push" : bps ? "wins" : "dealer wins"}`;
      break;
    }
    case "dragon_tiger": {
      check(side, 0, 2, "bet side");
      const a = rng(52),
        offset = rng(51),
        b = offset < a ? offset : offset + 1;
      values = [Math.floor(a / 4), Math.floor(b / 4)];
      const winner =
        values[0] === values[1] ? 2 : values[0] > values[1] ? 0 : 1;
      bps =
        winner === side
          ? side === 2
            ? 90000
            : 20000
          : winner === 2
            ? 5000
            : 0;
      label =
        winner === 2
          ? "Tie · side bets return half"
          : winner === 0
            ? "Dragon wins"
            : "Tiger wins";
      break;
    }
    case "red_dog": {
      values = Array.from({ length: 3 }, () => rng(13) + 1);
      bps = redDogBps(values[0], values[1], values[2]);
      label =
        bps === 10000
          ? "Push"
          : bps
            ? "Inside the spread"
            : "Outside the spread";
      break;
    }
    case "risk_wheel": {
      check(side, 0, 2, "risk profile");
      const segment = rng(20);
      values = [segment, side];
      bps = RISK_TABLES[side][segment];
      label = `${bps / 10000}× sector`;
      break;
    }
    case "money_wheel": {
      values = [rng(54)];
      bps = MONEY_TABLE[values[0]];
      label = `${bps / 10000}× sector`;
      break;
    }
    case "ore_refine": {
      check(side, 0, 4, "intensity");
      const n = rng(10000),
        i = ORE_CUM[side].findIndex((t) => n < t),
        outcome = i < 0 ? 3 : i;
      values = [outcome, side];
      bps = ORE_BPS[side][outcome];
      label = `${["Slag", "Partial recovery", "Refined yield", "Bonus yield"][outcome]} · ${bps / 10000}×`;
      break;
    }
    case "andar_bahar": {
      check(side, 0, 1, "side");
      const joker = rng(13),
        log: number[] = [];
      let winner = 0;
      for (let i = 0; i < 52; i++) {
        const c = rng(13);
        log.push(c);
        if (c === joker) {
          winner = i % 2;
          break;
        }
      }
      values = [joker, ...log];
      bps = side === winner ? [18800, 20000][side] : 0;
      label = `${winner === 0 ? "Andar" : "Bahar"} · ${log[log.length - 1] === joker ? `${log.length} cards` : "52-card limit"}`;
      break;
    }
    case "scratch_cards": {
      const n = rng(10000),
        tier = [7000, 9000, 9700, 9950, 9980, 10000].findIndex((t) => n < t);
      bps = SCRATCH_BPS[tier];
      let grid = [0, 0, 1, 1, 2, 2, 3, 4, 5];
      if (tier > 0) {
        const symbol = tier - 1,
          other = [0, 1, 2, 3, 4, 5].filter((n) => n !== symbol);
        grid = [symbol, symbol, symbol, ...other, other[0]];
      }
      values = shuffle(grid, rng);
      label = tier ? `Three matching symbols · ${bps / 10000}×` : "No triple";
      break;
    }
    default:
      throw Error("Unknown practice game.");
  }
  return { values, bps, label };
}
/** Bounds checks before rendering any persisted outcome. */
export function validExpandedValues(game: string, v: unknown): v is number[] {
  if (!Array.isArray(v)) return false;
  const shape = (n: number, min: number, max: number) =>
    v.length === n && v.every((x) => integerIn(x, min, max));
  switch (game) {
    case "limbo":
    case "crash":
      return (
        v.length === 2 &&
        integerIn(v[0], 9800, 10000000) &&
        integerIn(v[1], 10100, 10000000)
      );
    case "diamonds":
      return shape(5, 0, 6);
    case "scratch_cards":
      return shape(9, 0, 5);
    case "sicbo":
    case "chuck_a_luck":
      return shape(3, 1, 6);
    case "double_dice":
    case "under_over_7":
      return shape(2, 1, 6);
    case "dragon_tiger":
      return shape(2, 0, 12);
    case "red_dog":
      return shape(3, 1, 13);
    case "risk_wheel":
      return v.length === 2 && integerIn(v[0], 0, 19) && integerIn(v[1], 0, 2);
    case "money_wheel":
      return shape(1, 0, 53);
    case "ore_refine":
      return v.length === 2 && integerIn(v[0], 0, 3) && integerIn(v[1], 0, 4);
    case "andar_bahar":
      return (
        v.length >= 2 &&
        v.length <= 53 &&
        v.every((x) => integerIn(x, 0, 12)) &&
        !v.slice(1, -1).includes(v[0])
      );
    case "keno": {
      const n = v[0],
        p = v.slice(1, 1 + n),
        d = v.slice(1 + n);
      return (
        integerIn(n, 1, 6) &&
        v.length === n + 11 &&
        v.slice(1).every((x) => integerIn(x, 1, 40)) &&
        new Set(p).size === n &&
        new Set(d).size === 10
      );
    }
    case "baccarat":
    case "three_card_poker": {
      const i = v.indexOf(-1),
        c = v.filter((x) => x !== -1);
      return (
        (game === "three_card_poker"
          ? v.length === 7 && i === 3
          : (i === 2 || i === 3) &&
            (v.length - i - 1 === 2 || v.length - i - 1 === 3)) &&
        c.length === v.length - 1 &&
        c.every((x) => integerIn(x, 0, 51)) &&
        new Set(c).size === c.length
      );
    }
    default:
      return false;
  }
}
