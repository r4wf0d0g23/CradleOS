/** Standard 52-card ranking. Ace is encoded as rank zero, matching the casino deck. */
export type PokerRank = { category: number; kickers: number[]; name: string };
const names = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
export const cardRank = (c: number) => (c % 13 === 0 ? 14 : (c % 13) + 1);
export function comparePoker(a: PokerRank, b: PokerRank): number {
  if (a.category !== b.category) return Math.sign(a.category - b.category);
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
export function rankPoker(cards: number[]): PokerRank {
  if (
    ![2, 5].includes(cards.length) ||
    new Set(cards).size !== cards.length ||
    cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51)
  )
    throw Error("Invalid poker hand.");
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const groups = [...new Set(ranks)]
    .map((r) => ({ r, n: ranks.filter((v) => v === r).length }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  const flush =
    cards.length === 5 &&
    cards.every((c) => Math.floor(c / 13) === Math.floor(cards[0] / 13));
  const straight =
    cards.length === 5 && groups.length === 5
      ? ranks[0] - ranks[4] === 4
        ? ranks[0]
        : ranks.join(",") === "14,5,4,3,2"
          ? 5
          : 0
      : 0;
  let category = 0,
    kickers = ranks;
  if (flush && straight) {
    category = 8;
    kickers = [straight];
  } else if (groups[0].n === 4) {
    category = 7;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 3 && groups[1]?.n === 2) {
    category = 6;
    kickers = groups.map((g) => g.r);
  } else if (flush) category = 5;
  else if (straight) {
    category = 4;
    kickers = [straight];
  } else if (groups[0].n === 3) {
    category = 3;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 2 && groups[1]?.n === 2) {
    category = 2;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 2) {
    category = 1;
    kickers = groups.map((g) => g.r);
  }
  return {
    category,
    kickers,
    name: category === 8 && kickers[0] === 14 ? "Royal flush" : names[category],
  };
}
export function bestPoker(cards: number[]): PokerRank {
  if (cards.length !== 7 || new Set(cards).size !== 7)
    throw Error("Invalid seven-card hand.");
  let best: PokerRank | undefined;
  for (let a = 0; a < 6; a++)
    for (let b = a + 1; b < 7; b++) {
      const rank = rankPoker(cards.filter((_, i) => i !== a && i !== b));
      if (!best || comparePoker(rank, best) > 0) best = rank;
    }
  return best!;
}
export function splitWing(cards: number[], escort: number[]) {
  if (
    cards.length !== 7 ||
    escort.length !== 2 ||
    new Set(escort).size !== 2 ||
    escort.some((i) => !Number.isInteger(i) || i < 0 || i > 6)
  )
    throw Error("Select two escort cards.");
  const main = cards.filter((_, i) => !escort.includes(i)),
    low = escort.map((i) => cards[i]);
  const mainRank = rankPoker(main),
    escortRank = rankPoker(low);
  return {
    main,
    escort: low,
    mainRank,
    escortRank,
    legal: comparePoker(mainRank, escortRank) >= 0,
  };
}
/** Fixed dealer strategy, independent of the player's assignment. */
export function houseWing(cards: number[]): number[] {
  let best: number[] | undefined;
  for (let a = 0; a < 6; a++)
    for (let b = a + 1; b < 7; b++) {
      const next = splitWing(cards, [a, b]);
      if (!next.legal) continue;
      const old = best ? splitWing(cards, best) : null;
      if (
        !old ||
        comparePoker(next.escortRank, old.escortRank) > 0 ||
        (comparePoker(next.escortRank, old.escortRank) === 0 &&
          comparePoker(next.mainRank, old.mainRank) > 0)
      )
        best = [a, b];
    }
  return best!;
}
