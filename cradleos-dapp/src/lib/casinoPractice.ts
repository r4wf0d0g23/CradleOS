import { FLEET_KEYS, isFleet } from "./casinoSlotFleet";
import {
  EXPANDED_GAMES,
  expandedOutcome,
  validExpandedValues,
  type ExpandedChoice,
  type ExpandedGame,
} from "./casinoExpanded";
/** Local, non-redeemable practice chips. No chain, wallet or network imports. */
export const PRACTICE_GAMES = [
  "slots",
  "blackjack",
  "roulette",
  "coinflip",
  "dice",
  "wheel",
  "plinko",
  "war",
  ...EXPANDED_GAMES,
  ...FLEET_KEYS,
] as const;
export type PracticeGame = (typeof PRACTICE_GAMES)[number];
export const PRACTICE_KEY = "cradleos:casino:practice:v1";
export const START_CHIPS = 1_000_000; // hundredths: 10,000 chips
export const MAX_BET = 100_000;
export const SLOT_STRIP = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6];
export const SLOT_BPS = [36000, 50000, 60000, 120000, 180000, 360000, 600000];
export const WHEEL_BPS = [
  ...Array<number>(12).fill(0),
  ...Array<number>(5).fill(12000),
  16000,
  16000,
  100000,
];
export const PLINKO_BPS = [
  50000, 20000, 15000, 12000, 10000, 8500, 9000, 8500, 10000, 12000, 15000,
  20000, 50000,
];
export const RED = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];
export type Round = {
  id: number;
  game: PracticeGame;
  stake: number;
  payout: number;
  values: number[];
  label: string;
};
export type Hand = {
  deck: number[];
  cursor: number;
  player: number[];
  dealer: number[];
  stake: number;
};
export type PracticeState = {
  version: 1;
  balance: number;
  sequence: number;
  history: Round[];
  hand: Hand | null;
};
export type Choice = ExpandedChoice;
export type RandomInt = (bound: number) => number;
const integer = (n: unknown, min = 0, max = 1e12): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export function initialPractice(): PracticeState {
  return {
    version: 1,
    balance: START_CHIPS,
    sequence: 0,
    history: [],
    hand: null,
  };
}
export function chipLabel(n: number): string {
  return (n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export function practiceBet(text: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw Error("Enter a stake from 1 to 1,000 chips.");
  const [whole, fraction = ""] = text.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!integer(n, 100, MAX_BET))
    throw Error("Enter a stake from 1 to 1,000 chips.");
  return n;
}
/** Unbiased bounded Web Crypto draws, never Math.random or payout-dependent rolls. */
export const randomInt: RandomInt = (bound) => {
  if (!integer(bound, 1, 65536)) throw Error("Invalid random range.");
  const ceiling = Math.floor(0x100000000 / bound) * bound;
  const a = new Uint32Array(1);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= ceiling);
  return a[0] % bound;
};
function draw(rng: RandomInt, bound: number) {
  const n = rng(bound);
  if (!integer(n, 0, bound - 1)) throw Error("Invalid random draw.");
  return n;
}
export function cardTotal(cards: number[]): number {
  let aces = 0,
    total = 0;
  for (const c of cards) {
    const r = c % 13;
    total += r === 0 ? 11 : Math.min(r + 1, 10);
    if (r === 0) aces++;
  }
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}
export function shuffledDeck(rng: RandomInt = randomInt) {
  const a = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = draw(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function money(stake: number, bps: number) {
  return Math.floor((stake * bps) / 10000);
}
function settle(
  s: PracticeState,
  game: PracticeGame,
  stake: number,
  payout: number,
  values: number[],
  label: string,
): PracticeState {
  const balance = s.balance + payout;
  if (!integer(balance) || !integer(payout))
    throw Error("Practice balance limit reached. Reset your practice session.");
  const sequence = s.sequence + 1;
  return {
    ...s,
    balance,
    sequence,
    hand: null,
    history: [
      { id: sequence, game, stake, payout, values, label },
      ...s.history,
    ].slice(0, 20),
  };
}
/** Stake is debited and outcome committed in one state update, before animation. */
export function playPractice(
  s: PracticeState,
  game: PracticeGame,
  stake: number,
  choice: Choice = {},
  rng: RandomInt = randomInt,
): PracticeState {
  if (s.hand) throw Error("Finish your blackjack hand first.");
  if (isFleet(game))
    throw Error("Fleet slots require the saved-feature session engine.");
  if (!PRACTICE_GAMES.includes(game) || !integer(stake, 100, MAX_BET))
    throw Error("Invalid practice stake or game.");
  if (stake > s.balance)
    throw Error("Not enough play chips. Refill from the lobby.");
  const next = { ...s, balance: s.balance - stake };
  let values: number[] = [],
    bps = 0,
    label = "";
  if ((EXPANDED_GAMES as readonly string[]).includes(game)) {
    const outcome = expandedOutcome(game as ExpandedGame, choice, rng);
    return settle(
      next,
      game,
      stake,
      money(stake, outcome.bps),
      outcome.values,
      outcome.label,
    );
  }
  switch (game) {
    case "blackjack": {
      const deck = shuffledDeck(rng);
      const hand = {
        deck,
        cursor: 4,
        player: [deck[0], deck[2]],
        dealer: [deck[1], deck[3]],
        stake,
      };
      const p = cardTotal(hand.player),
        d = cardTotal(hand.dealer);
      if (p === 21 || d === 21)
        return settle(
          next,
          game,
          stake,
          p === 21 ? (d === 21 ? stake : money(stake, 25000)) : 0,
          [...hand.player, ...hand.dealer],
          p === d ? "Push" : p === 21 ? "Blackjack" : "Dealer blackjack",
        );
      return { ...next, hand };
    }
    case "slots":
      values = Array.from({ length: 3 }, () => SLOT_STRIP[draw(rng, 16)]);
      bps = values.every((v) => v === values[0])
        ? SLOT_BPS[values[0]]
        : new Set(values).size === 2
          ? 18000
          : 0;
      label = bps ? "Reel match" : "No match";
      break;
    case "coinflip": {
      if (choice.side !== 0 && choice.side !== 1)
        throw Error("Choose heads or tails.");
      values = [draw(rng, 2)];
      bps = values[0] === choice.side ? 19600 : 0;
      label = values[0] === 0 ? "Heads" : "Tails";
      break;
    }
    case "dice": {
      const target = choice.target ?? 50,
        over = choice.over ?? true;
      if (!integer(target, 2, 98)) throw Error("Target must be 2–98.");
      const chance = over ? 100 - target : target - 1;
      if (chance < 2 || chance > 96) throw Error("Win chance must be 2–96%.");
      values = [draw(rng, 100) + 1];
      const win = over ? values[0] > target : values[0] < target;
      const payout = win ? Math.floor((stake * 98) / chance) : 0;
      return settle(next, game, stake, payout, values, `Rolled ${values[0]}`);
    }
    case "roulette": {
      const side = choice.side ?? 0;
      if (
        !integer(side, 0, 2) ||
        (side === 2 && !integer(choice.target, 0, 36))
      )
        throw Error("Choose a color or number.");
      values = [draw(rng, 37)];
      const n = values[0];
      bps =
        side === 2
          ? n === choice.target
            ? 360000
            : 0
          : n !== 0 && (RED.includes(n) ? 0 : 1) === side
            ? 20000
            : 0;
      label = `${n} · ${n === 0 ? "Zero" : RED.includes(n) ? "Red" : "Black"}`;
      break;
    }
    case "wheel":
      values = [draw(rng, 20)];
      bps = WHEEL_BPS[values[0]];
      label = `${bps / 10000}× sector`;
      break;
    case "plinko":
      values = Array.from({ length: 12 }, () => draw(rng, 2));
      bps = PLINKO_BPS[values.reduce((a, b) => a + b, 0)];
      label = `${bps / 10000}× landing`;
      break;
    case "war":
      values = [draw(rng, 13), draw(rng, 13)];
      bps = values[0] > values[1] ? 20000 : values[0] === values[1] ? 5000 : 0;
      label =
        values[0] > values[1]
          ? "Your card wins"
          : values[0] === values[1]
            ? "Tie · half returned"
            : "Dealer wins";
      break;
  }
  return settle(next, game, stake, money(stake, bps), values, label);
}
export function actPractice(
  s: PracticeState,
  action: "hit" | "stand" | "double",
): PracticeState {
  if (!s.hand) throw Error("No active hand.");
  if (!["hit", "stand", "double"].includes(action))
    throw Error("Invalid hand action.");
  const h = {
    ...s.hand,
    player: [...s.hand.player],
    dealer: [...s.hand.dealer],
  };
  let next = { ...s };
  const take = () => {
    if (h.cursor >= 52) throw Error("Deck exhausted.");
    return h.deck[h.cursor++];
  };
  if (action === "double") {
    if (h.player.length !== 2 || s.balance < h.stake)
      throw Error("Double requires two cards and another stake.");
    next.balance -= h.stake;
    h.stake *= 2;
  }
  if (action === "hit" || action === "double") h.player.push(take());
  const p = cardTotal(h.player);
  if (p > 21)
    return settle(
      next,
      "blackjack",
      h.stake,
      0,
      [...h.player, -1, ...h.dealer],
      "Bust",
    );
  if (action === "hit" && p < 21) return { ...next, hand: h };
  while (cardTotal(h.dealer) < 17) h.dealer.push(take());
  const d = cardTotal(h.dealer),
    win = d > 21 || p > d;
  return settle(
    next,
    "blackjack",
    h.stake,
    win ? h.stake * 2 : p === d ? h.stake : 0,
    [...h.player, -1, ...h.dealer],
    win ? "Hand won" : p === d ? "Push" : "Dealer wins",
  );
}
function validValues(game: PracticeGame, values: unknown): values is number[] {
  if (!Array.isArray(values)) return false;
  const shape = (length: number, min: number, max: number) =>
    values.length === length && values.every((v) => integer(v, min, max));
  if (isFleet(game))
    return values.length === 2 && values[0] === 1 && integer(values[1], 1, 32);
  switch (game) {
    case "slots":
      return shape(3, 0, 6);
    case "coinflip":
      return shape(1, 0, 1);
    case "dice":
      return shape(1, 1, 100);
    case "roulette":
      return shape(1, 0, 36);
    case "wheel":
      return shape(1, 0, 19);
    case "plinko":
      return shape(12, 0, 1);
    case "war":
      return shape(2, 0, 12);
    case "blackjack": {
      const separator = values.indexOf(-1);
      if (separator < 0) return shape(4, 0, 51) && new Set(values).size === 4;
      const cards = values.filter((v) => v !== -1);
      return (
        values.length <= 53 &&
        separator >= 2 &&
        separator <= values.length - 3 &&
        cards.length === values.length - 1 &&
        new Set(cards).size === cards.length &&
        cards.every((v) => integer(v, 0, 51))
      );
    }
    default:
      return validExpandedValues(game, values);
  }
}
/** Reject corrupt/foreign saves. Local chips have no redemption path. */
export function restorePractice(raw: string | null): PracticeState {
  if (!raw) return initialPractice();
  try {
    const s = JSON.parse(raw) as PracticeState;
    if (
      s.version !== 1 ||
      !integer(s.balance) ||
      !integer(s.sequence) ||
      !Array.isArray(s.history) ||
      s.history.length > 20
    )
      throw Error();
    for (const r of s.history)
      if (
        !integer(r.id, 1, s.sequence) ||
        !PRACTICE_GAMES.includes(r.game) ||
        !integer(r.stake, 100, MAX_BET * 2) ||
        !integer(r.payout) ||
        !validValues(r.game, r.values) ||
        typeof r.label !== "string" ||
        r.label.length > 90
      )
        throw Error();
    if (s.hand !== null) {
      const h = s.hand;
      if (
        !h ||
        !Array.isArray(h.deck) ||
        h.deck.length !== 52 ||
        new Set(h.deck).size !== 52 ||
        h.deck.some((c) => !integer(c, 0, 51)) ||
        !integer(h.cursor, 4, 51) ||
        !integer(h.stake, 100, MAX_BET)
      )
        throw Error();
      if (
        !Array.isArray(h.player) ||
        !Array.isArray(h.dealer) ||
        h.player.length < 2 ||
        h.dealer.length !== 2 ||
        h.player.length + h.dealer.length !== h.cursor ||
        cardTotal(h.player) >= 21 ||
        cardTotal(h.dealer) >= 21
      )
        throw Error();
      if (
        h.player[0] !== h.deck[0] ||
        h.player[1] !== h.deck[2] ||
        h.dealer[0] !== h.deck[1] ||
        h.dealer[1] !== h.deck[3] ||
        h.player.slice(2).some((v, i) => v !== h.deck[i + 4])
      )
        throw Error();
    }
    return s;
  } catch {
    return initialPractice();
  }
}
