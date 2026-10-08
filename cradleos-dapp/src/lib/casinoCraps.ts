/** Pure, integer-hundredths practice craps. No wallet or network dependencies. */
export const POINTS = [4, 5, 6, 8, 9, 10] as const;
export const HARD = [4, 6, 8, 10] as const;
export const CRAPS_KEYS = [
  "pass",
  "dont",
  "passOdds",
  "dontOdds",
  "field",
  ...POINTS.map((n) => `place${n}`),
  ...HARD.map((n) => `hard${n}`),
] as const;
export type CrapsKey = (typeof CRAPS_KEYS)[number];
export type CrapsBets = Partial<Record<CrapsKey, number>>;
export type CrapsReceipt = {
  id: number;
  point: number;
  bets: CrapsBets;
  dice: [number, number];
};
export type CrapsTable = {
  point: number;
  bets: CrapsBets;
  rolls: CrapsReceipt[];
  sequence: number;
  pending: boolean;
};
export type CrapsSettlement = { key: CrapsKey; stake: number; payout: number };
export const CRAPS_LIMIT = 100_000;
const int = (n: unknown, min = 0, max = 1e12): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export const isPoint = (n: unknown): n is number =>
  POINTS.includes(n as (typeof POINTS)[number]);
export const newCraps = (): CrapsTable => ({
  point: 0,
  bets: {},
  rolls: [],
  sequence: 0,
  pending: false,
});
export const crapsEscrow = (t?: Pick<CrapsTable, "bets">) =>
  Object.values(t?.bets ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);
export function crapsName(k: string) {
  return (
    (
      {
        pass: "Pass line",
        dont: "Don't pass",
        passOdds: "Pass odds",
        dontOdds: "Don't odds",
        field: "Field",
      } as Record<string, string>
    )[k] ?? k.replace("place", "Place ").replace("hard", "Hard ")
  );
}
export function crapsUnit(k: CrapsKey, point: number) {
  if (/^place[68]$/.test(k)) return 600;
  if (k.startsWith("place")) return 500;
  if (k === "passOdds")
    return point === 5 || point === 9
      ? 200
      : point === 6 || point === 8
        ? 500
        : 100;
  if (k === "dontOdds")
    return point === 4 || point === 10
      ? 200
      : point === 5 || point === 9
        ? 300
        : 600;
  return 100;
}
export function oddsLimit(k: CrapsKey, point: number, bets: CrapsBets) {
  return k === "dontOdds"
    ? (bets.dont ?? 0) * 6
    : (bets.pass ?? 0) *
        (point === 4 || point === 10 ? 3 : point === 5 || point === 9 ? 4 : 5);
}
export function validCrapsBets(b: unknown, point: number): b is CrapsBets {
  if (
    !b ||
    typeof b !== "object" ||
    Array.isArray(b) ||
    (point !== 0 && !isPoint(point))
  )
    return false;
  const bets = b as CrapsBets;
  if (
    Object.entries(bets).some(
      ([k, v]) =>
        !CRAPS_KEYS.includes(k) ||
        !int(v, 100, CRAPS_LIMIT) ||
        v % crapsUnit(k, point) !== 0,
    )
  )
    return false;
  if (crapsEscrow({ bets }) > CRAPS_LIMIT) return false;
  return (["passOdds", "dontOdds"] as const).every(
    (k) => !bets[k] || (point !== 0 && bets[k]! <= oddsLimit(k, point, bets)),
  );
}
/** Gross returns include returned stake. Winning side bets come down, never rebet. */
export function evaluateCraps(r: CrapsReceipt) {
  const total = r.dice[0] + r.dice[1],
    before = r.point;
  const afterPoint = before
    ? total === 7 || total === before
      ? 0
      : before
    : isPoint(total)
      ? total
      : 0;
  const bets = { ...r.bets },
    settled: CrapsSettlement[] = [];
  const finish = (key: CrapsKey, profit: number | null) => {
    const stake = bets[key];
    if (!stake) return;
    const payout = profit === null ? 0 : stake + profit;
    if (!int(payout)) throw Error("Invalid fractional craps payout.");
    settled.push({ key, stake, payout });
    delete bets[key];
  };
  for (const key of ["pass", "dont"] as const) {
    const stake = bets[key] ?? 0;
    if (!before) {
      if (total === 7 || total === 11)
        finish(key, key === "pass" ? stake : null);
      if (total === 2 || total === 3)
        finish(key, key === "dont" ? stake : null);
      if (total === 12) finish(key, key === "dont" ? 0 : null);
    } else if (total === 7 || total === before)
      finish(key, (key === "pass") === (total === before) ? stake : null);
  }
  if (before && (total === 7 || total === before)) {
    const ratio =
      before === 4 || before === 10
        ? [2, 1]
        : before === 5 || before === 9
          ? [3, 2]
          : [6, 5];
    finish(
      "passOdds",
      total === before ? ((bets.passOdds ?? 0) * ratio[0]) / ratio[1] : null,
    );
    finish(
      "dontOdds",
      total === 7 ? ((bets.dontOdds ?? 0) * ratio[1]) / ratio[0] : null,
    );
  }
  finish(
    "field",
    total === 2
      ? (bets.field ?? 0) * 2
      : total === 12
        ? (bets.field ?? 0) * 3
        : [3, 4, 9, 10, 11].includes(total)
          ? (bets.field ?? 0)
          : null,
  );
  if (before) {
    for (const n of POINTS) {
      const k = `place${n}`;
      if (total === 7) finish(k, null);
      else if (total === n)
        finish(
          k,
          ((bets[k] ?? 0) * (n === 4 || n === 10 ? 9 : 7)) /
            (n === 6 || n === 8 ? 6 : 5),
        );
    }
    for (const n of HARD) {
      const k = `hard${n}`;
      if (total === 7 || total === n)
        finish(
          k,
          total === n && r.dice[0] === r.dice[1]
            ? (bets[k] ?? 0) * (n === 6 || n === 8 ? 9 : 7)
            : null,
        );
    }
  }
  return {
    point: afterPoint,
    bets,
    total,
    settled,
    payout: settled.reduce((a, b) => a + b.payout, 0),
    stake: settled.reduce((a, b) => a + b.stake, 0),
    label: before
      ? total === 7
        ? "Seven out"
        : total === before
          ? "Point made"
          : `Point ${before} stays`
      : isPoint(total)
        ? `Point ${total} established`
        : total === 7 || total === 11
          ? "Natural"
          : "Craps",
  };
}
export function validCrapsReceipt(r: unknown): r is CrapsReceipt {
  if (!r || typeof r !== "object") return false;
  const v = r as CrapsReceipt;
  if (Object.keys(v).some((k) => !["id", "point", "bets", "dice"].includes(k)))
    return false;
  return (
    int(v.id, 1) &&
    validCrapsBets(v.bets, v.point) &&
    (crapsEscrow(v) > 0 || v.point !== 0) &&
    Array.isArray(v.dice) &&
    v.dice.length === 2 &&
    v.dice.every((n) => int(n, 1, 6))
  );
}
export function validCraps(t: unknown): t is CrapsTable {
  try {
    if (!t || typeof t !== "object") return false;
    const v = t as CrapsTable;
    if (
      Object.keys(v).some(
        (k) => !["point", "bets", "rolls", "sequence", "pending"].includes(k),
      )
    )
      return false;
    if (
      !validCrapsBets(v.bets, v.point) ||
      !int(v.sequence) ||
      typeof v.pending !== "boolean" ||
      !Array.isArray(v.rolls) ||
      v.rolls.length > 8 ||
      v.rolls.length !== Math.min(v.sequence, 8)
    )
      return false;
    if (v.sequence === 0 && v.point !== 0) return false;
    if (
      !v.rolls.every((r, i) => validCrapsReceipt(r) && r.id === v.sequence - i)
    )
      return false;
    if (v.rolls.length && v.point !== evaluateCraps(v.rolls[0]).point)
      return false;
    if (
      v.rolls.some(
        (r, i) =>
          i + 1 < v.rolls.length &&
          r.point !== evaluateCraps(v.rolls[i + 1]).point,
      )
    )
      return false;
    if (v.pending) {
      if (!v.rolls.length) return false;
      const e = evaluateCraps(v.rolls[0]);
      if (
        v.point !== e.point ||
        CRAPS_KEYS.some((k) => (v.bets[k] ?? 0) !== (e.bets[k] ?? 0))
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Reserve the largest gross return of each parked wager, not only its stake.
 * This keeps even an astronomical practice balance able to finish/refund bets. */
export function crapsReserve(t?: Pick<CrapsTable, "bets" | "point">): number {
  if (!t) return 0;
  return Object.entries(t.bets).reduce((total, [key, amount]) => {
    const stake = amount ?? 0,
      n = Number(key.replace(/^(place|hard)/, ""));
    let profit = stake;
    if (key === "field") profit = stake * 3;
    if (key.startsWith("hard")) profit = stake * (n === 6 || n === 8 ? 9 : 7);
    if (key.startsWith("place"))
      profit =
        (stake * (n === 4 || n === 10 ? 9 : 7)) / (n === 6 || n === 8 ? 6 : 5);
    if (key === "passOdds")
      profit =
        (stake *
          (t.point === 4 || t.point === 10
            ? 2
            : t.point === 5 || t.point === 9
              ? 3
              : 6)) /
        (t.point === 4 || t.point === 10
          ? 1
          : t.point === 5 || t.point === 9
            ? 2
            : 5);
    if (key === "dontOdds")
      profit =
        (stake *
          (t.point === 4 || t.point === 10
            ? 1
            : t.point === 5 || t.point === 9
              ? 2
              : 5)) /
        (t.point === 4 || t.point === 10
          ? 2
          : t.point === 5 || t.point === 9
            ? 3
            : 6);
    return total + stake + profit;
  }, 0);
}
