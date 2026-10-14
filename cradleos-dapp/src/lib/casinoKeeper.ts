/** Keeper Play Money rules. Pure deterministic replay; no UI or storage access. */
export const KEEPER_KEYS = [
  "keeper_cipher",
  "keeper_archive",
  "keeper_passage",
] as const;
export type KeeperGame = (typeof KEEPER_KEYS)[number];
export const isKeeperGame = (x: unknown): x is KeeperGame =>
  typeof x === "string" && (KEEPER_KEYS as readonly string[]).includes(x);
export const KEEPER_NAMES: Record<KeeperGame, string> = {
  keeper_cipher: "Keeper’s Cipher",
  keeper_archive: "Archive Resonance",
  keeper_passage: "Keeper’s Passage",
};
export const GLYPHS = ["Shard", "Echo", "Orbit", "Pulse", "Veil", "Anchor"];
export const CIPHER_BPS = [180000, 45000, 18000];
export const ARCHIVE_BPS = {
  five: 180000,
  four: 30000,
  full: 12000,
  three: 6000,
  two: 3000,
  none: 0,
};
export const ARCHIVE_LABELS = {
  five: "Five matching",
  four: "Four matching",
  full: "Full house",
  three: "Three matching",
  two: "Two pairs",
  none: "No resonance",
};
export type KeeperData = {
  game: string;
  stake: number;
  draw: number[];
  choice: number[];
  actions: { kind: string; values: number[] }[];
};
export type CipherClue = { guess: number[]; exact: number; misplaced: number };
export type PassageStep = {
  risk: number;
  gate: number;
  safe: number[];
  success: boolean;
};
export type KeeperView = {
  phase: string;
  payout: number;
  label: string;
  clues: CipherClue[];
  symbols: number[];
  held: number[];
  steps: PassageStep[];
  bank: number;
  next: number[];
};
const integer = (x: unknown, lo: number, hi: number): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= lo && x <= hi;
const distinct = (a: number[], n: number, max: number) =>
  a.length === n && a.every((x) => integer(x, 0, max)) && new Set(a).size === n;
export function cipherClue(secret: number[], guess: number[]) {
  const exact = secret.filter((x, i) => guess[i] === x).length;
  return {
    exact,
    misplaced: guess.filter((x) => secret.includes(x)).length - exact,
  };
}
export function archiveCategory(symbols: number[]): keyof typeof ARCHIVE_BPS {
  const counts = Array.from(
    { length: 6 },
    (_, i) => symbols.filter((x) => x === i).length,
  ).sort((a, b) => b - a);
  return counts[0] === 5
    ? "five"
    : counts[0] === 4
      ? "four"
      : counts[0] === 3
        ? counts[1] === 2
          ? "full"
          : "three"
        : counts[0] === 2 && counts[1] === 2
          ? "two"
          : "none";
}
/** Integer rational return, one final floor. Never compound rounded UI amounts. */
export function passageReturn(stake: number, risks: number[]): number {
  if (!risks.length) return stake;
  let numerator = BigInt(stake) * 96n,
    denominator = 100n;
  for (const risk of risks) {
    numerator *= 4n;
    denominator *= BigInt(risk === 0 ? 3 : 2);
  }
  return Number(numerator / denominator);
}
export function keeperDraw(
  game: KeeperGame,
  rng: (n: number) => number,
): number[] {
  if (game === "keeper_archive")
    return Array.from({ length: 10 }, () => rng(6));
  const shuffle = (n: number) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = rng(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return game === "keeper_cipher"
    ? shuffle(6).slice(0, 3)
    : Array.from({ length: 5 }, () => shuffle(4)).flat();
}
export function keeperView(r: KeeperData): KeeperView {
  if (
    !isKeeperGame(r.game) ||
    !integer(r.stake, 100, 100000) ||
    !Array.isArray(r.choice) ||
    r.choice.length ||
    !Array.isArray(r.draw) ||
    !Array.isArray(r.actions) ||
    r.actions.length > 6
  )
    throw Error("Invalid Keeper round.");
  if (r.game === "keeper_cipher" && !distinct(r.draw, 3, 5))
    throw Error("Invalid cipher.");
  if (
    r.game === "keeper_archive" &&
    (r.draw.length !== 10 || r.draw.some((n) => !integer(n, 0, 5)))
  )
    throw Error("Invalid archive.");
  if (
    r.game === "keeper_passage" &&
    (r.draw.length !== 20 ||
      Array.from({ length: 5 }, (_, i) => r.draw.slice(i * 4, i * 4 + 4)).some(
        (a) => !distinct(a, 4, 3),
      ))
  )
    throw Error("Invalid passage.");
  const v: KeeperView = {
    phase:
      r.game === "keeper_cipher"
        ? "guess"
        : r.game === "keeper_archive"
          ? "hold"
          : "cross",
    payout: 0,
    label: "",
    clues: [],
    symbols: r.game === "keeper_archive" ? r.draw.slice(0, 5) : [],
    held: [],
    steps: [],
    bank: r.stake,
    next: [passageReturn(r.stake, [0]), passageReturn(r.stake, [1])],
  };
  for (const a of r.actions) {
    if (
      v.phase === "done" ||
      !a ||
      typeof a.kind !== "string" ||
      !Array.isArray(a.values) ||
      a.values.some((x) => !integer(x, 0, 5))
    )
      throw Error("Invalid Keeper action.");
    if (r.game === "keeper_cipher") {
      if (a.kind === "end" && !a.values.length) {
        v.phase = "done";
        v.label = "Trial ended";
        continue;
      }
      if (
        a.kind !== "guess" ||
        !distinct(a.values, 3, 5) ||
        v.clues.some((c) => c.guess.join() === a.values.join())
      )
        throw Error("Choose three different glyphs and a new code.");
      const clue = { guess: [...a.values], ...cipherClue(r.draw, a.values) };
      v.clues.push(clue);
      if (clue.exact === 3) {
        v.phase = "done";
        v.payout = Math.floor(
          (r.stake * CIPHER_BPS[v.clues.length - 1]) / 10000,
        );
        v.label = "Cipher unlocked";
      } else if (v.clues.length === 3) {
        v.phase = "done";
        v.label = "Signal lost";
      }
    } else if (r.game === "keeper_archive") {
      if (
        a.kind !== "draw" ||
        a.values.length > 5 ||
        new Set(a.values).size !== a.values.length ||
        a.values.some((x) => x > 4)
      )
        throw Error("Invalid held glyphs.");
      v.held = [...a.values];
      v.symbols = r.draw
        .slice(0, 5)
        .map((n, i) => (v.held.includes(i) ? n : r.draw[i + 5]));
      const category = archiveCategory(v.symbols);
      v.payout = Math.floor((r.stake * ARCHIVE_BPS[category]) / 10000);
      v.label = ARCHIVE_LABELS[category];
      v.phase = "done";
    } else {
      if (a.kind === "bank" && !a.values.length) {
        v.phase = "done";
        v.payout = v.bank;
        v.label = v.steps.length ? "Passage banked" : "Stake returned";
        continue;
      }
      if (
        a.kind !== "cross" ||
        a.values.length !== 2 ||
        !integer(a.values[0], 0, 1) ||
        !integer(a.values[1], 0, 3)
      )
        throw Error("Choose a route and gate.");
      const [risk, gate] = a.values,
        safe = r.draw.slice(
          v.steps.length * 4,
          v.steps.length * 4 + (risk === 0 ? 3 : 2),
        ),
        success = safe.includes(gate);
      v.steps.push({ risk, gate, safe, success });
      if (!success) {
        v.bank = 0;
        v.phase = "done";
        v.label = "Passage closed";
      } else {
        const risks = v.steps.map((s) => s.risk);
        v.bank = passageReturn(r.stake, risks);
        v.next = [0, 1].map((n) => passageReturn(r.stake, [...risks, n]));
        if (v.steps.length === 5) {
          v.phase = "done";
          v.payout = v.bank;
          v.label = "Passage complete";
        }
      }
    }
  }
  return v;
}
export function validKeeperRound(r: KeeperData): boolean {
  try {
    keeperView(r);
    return true;
  } catch {
    return false;
  }
}
