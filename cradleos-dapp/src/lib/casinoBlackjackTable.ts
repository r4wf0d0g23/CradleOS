import {
  cardTotal,
  MAX_BET,
  randomInt,
  shuffledDeck,
  type RandomInt,
} from "./casinoPractice";
export type SeatHand = {
  seat: number;
  cards: number[];
  stake: number;
  split: boolean;
  splitAce: boolean;
  done: boolean;
};
export type BlackjackTable = {
  deck: number[];
  cursor: number;
  dealer: number[];
  hands: SeatHand[];
  active: number;
  complete: boolean;
  seats: number;
  baseStake: number;
  actions: TableAction[];
};
export type TableAction = "hit" | "stand" | "double" | "split";
export const natural = (h: SeatHand) =>
  !h.split && h.cards.length === 2 && cardTotal(h.cards) === 21;
const integer = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const take = (t: BlackjackTable) => {
  if (t.cursor >= 52) throw Error("Practice shoe exhausted.");
  return t.deck[t.cursor++];
};
function advance(t: BlackjackTable): BlackjackTable {
  const active = t.hands.findIndex((h) => !h.done);
  if (active >= 0) {
    t.active = active;
    return t;
  }
  if (t.hands.some((h) => !natural(h) && cardTotal(h.cards) <= 21))
    while (cardTotal(t.dealer) < 17) t.dealer.push(take(t));
  t.active = -1;
  t.complete = true;
  return t;
}
export function dealTable(
  seats: number,
  stake: number,
  balance: number,
  rng: RandomInt = randomInt,
): { table: BlackjackTable; debit: number } {
  if (!integer(seats, 1, 3) || !integer(stake, 100, MAX_BET))
    throw Error("Choose 1–3 seats and a valid per-seat stake.");
  const debit = seats * stake;
  if (balance < debit) throw Error("Not enough chips for all seats.");
  return { table: startTable(shuffledDeck(rng), seats, stake), debit };
}
function startTable(
  deck: number[],
  seats: number,
  stake: number,
): BlackjackTable {
  const t: BlackjackTable = {
    deck,
    seats,
    baseStake: stake,
    actions: [],
    cursor: 0,
    dealer: [],
    hands: Array.from({ length: seats }, (_, seat) => ({
      seat,
      cards: [],
      stake,
      split: false,
      splitAce: false,
      done: false,
    })),
    active: 0,
    complete: false,
  };
  for (let card = 0; card < 2; card++) {
    for (const h of t.hands) h.cards.push(take(t));
    t.dealer.push(take(t));
  }
  for (const h of t.hands) h.done = natural(h);
  if (cardTotal(t.dealer) === 21) {
    t.hands.forEach((h) => (h.done = true));
    t.active = -1;
    t.complete = true;
  } else advance(t);
  return t;
}
export function tableActionAllowed(
  t: BlackjackTable,
  action: TableAction,
  balance: number,
): boolean {
  const h = t.hands[t.active];
  if (t.complete || !h || h.done) return false;
  if (action === "hit" || action === "stand") return true;
  if (h.cards.length !== 2 || h.split || balance < h.stake) return false;
  return (
    action === "double" ||
    (action === "split" && h.cards[0] % 13 === h.cards[1] % 13)
  );
}
export function actTable(
  original: BlackjackTable,
  action: TableAction,
  balance: number,
): { table: BlackjackTable; debit: number } {
  if (
    !["hit", "stand", "double", "split"].includes(action) ||
    !tableActionAllowed(original, action, balance)
  )
    throw Error("That action is unavailable for this hand.");
  const t: BlackjackTable = {
    ...original,
    deck: [...original.deck],
    actions: [...original.actions, action],
    dealer: [...original.dealer],
    hands: original.hands.map((h) => ({ ...h, cards: [...h.cards] })),
  };
  const h = t.hands[t.active];
  let debit = 0;
  if (action === "split") {
    debit = h.stake;
    const ace = h.cards[0] % 13 === 0;
    const a: SeatHand = {
      ...h,
      cards: [h.cards[0], take(t)],
      split: true,
      splitAce: ace,
      done: ace,
    };
    const b: SeatHand = {
      ...h,
      cards: [h.cards[1], take(t)],
      split: true,
      splitAce: ace,
      done: ace,
    };
    a.done ||= cardTotal(a.cards) === 21;
    b.done ||= cardTotal(b.cards) === 21;
    t.hands.splice(t.active, 1, a, b);
  } else {
    if (action === "double") {
      debit = h.stake;
      h.stake *= 2;
    }
    if (action === "hit" || action === "double") h.cards.push(take(t));
    h.done = action !== "hit" || cardTotal(h.cards) >= 21;
  }
  return { table: advance(t), debit };
}
export function tableReturns(t: BlackjackTable): number[] {
  if (!t.complete) throw Error("Finish every hand first.");
  const dealer = cardTotal(t.dealer),
    dealerNatural = t.dealer.length === 2 && dealer === 21;
  return t.hands.map((h) => {
    const p = cardTotal(h.cards);
    if (natural(h)) return dealerNatural ? h.stake : Math.floor(h.stake * 2.5);
    if (p > 21 || dealerNatural) return 0;
    return dealer > 21 || p > dealer ? h.stake * 2 : p === dealer ? h.stake : 0;
  });
}
/** Replay the bounded action log against the exact shoe. Reject forged card order,
 * duplicated cards, impossible splits/cursors, and inconsistent settled states. */
export function validTable(value: unknown): value is BlackjackTable {
  try {
    const t = value as BlackjackTable;
    if (
      !t ||
      !Array.isArray(t.deck) ||
      t.deck.length !== 52 ||
      new Set(t.deck).size !== 52 ||
      t.deck.some((c) => !integer(c, 0, 51)) ||
      !integer(t.seats, 1, 3) ||
      !integer(t.baseStake, 100, MAX_BET) ||
      !Array.isArray(t.actions) ||
      t.actions.length > 52
    )
      return false;
    let replay = startTable([...t.deck], t.seats, t.baseStake);
    for (const action of t.actions)
      replay = actTable(replay, action, 1e12).table;
    return JSON.stringify(replay) === JSON.stringify(t);
  } catch {
    return false;
  }
}
