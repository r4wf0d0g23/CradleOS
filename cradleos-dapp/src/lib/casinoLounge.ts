import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
import { CURRENT_EVE_COIN_TYPE } from "./cycle";
import { queryChain } from "./currentWorldRead";
export const CASINO_SYMBOLS = [
  { id: 78423, name: "Water Ice" },
  { id: 88335, name: "D1 Fuel" },
  { id: 84180, name: "Circuits" },
  { id: 72244, name: "Feral Data" },
  { id: 82425, name: "Lai" },
  { id: 87848, name: "Reiver" },
  { id: 81611, name: "Chumaq" },
];
export const LOUNGE_NAMES: Record<
  string,
  { title: string; tag: string; icon: number }
> = {
  craps: { title: "Frontier Craps", tag: "DICE DECK", icon: 87848 },
  slots: { title: "Salvage Reels", tag: "SLOTS", icon: 72244 },
  blackjack: { title: "Command Deck", tag: "BLACKJACK", icon: 82425 },
  roulette: { title: "Orbital Roulette", tag: "ROULETTE", icon: 84955 },
  coinflip: { title: "Signal Flip", tag: "COINFLIP", icon: 84180 },
  dice: { title: "Probability Drive", tag: "DICE", icon: 88335 },
  wheel: { title: "Reactor Wheel", tag: "WHEEL", icon: 91209 },
  plinko: { title: "Debris Drop", tag: "PLINKO", icon: 78423 },
  war: { title: "Fleet Duel", tag: "WAR", icon: 87848 },
  limbo: { title: "Jump Threshold", tag: "LIMBO", icon: 84955 },
  crash: { title: "Warp Run", tag: "CRASH", icon: 82425 },
  diamonds: { title: "Signal Clusters", tag: "DIAMONDS", icon: 72244 },
  keno: { title: "Deep Scan", tag: "KENO", icon: 84180 },
  sicbo: { title: "Reactor Dice", tag: "SIC BO", icon: 91209 },
  double_dice: { title: "Twin Reactors", tag: "DOUBLE DICE", icon: 88335 },
  baccarat: { title: "Command Baccarat", tag: "BACCARAT", icon: 81611 },
  three_card_poker: {
    title: "Three-Card Sortie",
    tag: "THREE CARD",
    icon: 87848,
  },
  dragon_tiger: { title: "Frigate Duel", tag: "DRAGON TIGER", icon: 82425 },
  under_over_7: {
    title: "Seven Threshold",
    tag: "UNDER / OVER 7",
    icon: 84180,
  },
  ore_refine: { title: "Volatile Refinery", tag: "ORE REFINE", icon: 78423 },
  risk_wheel: { title: "Overdrive Wheel", tag: "RISK WHEEL", icon: 91209 },
  money_wheel: { title: "Salvage Wheel", tag: "MONEY WHEEL", icon: 81611 },
  andar_bahar: { title: "Signal Chase", tag: "ANDAR BAHAR", icon: 72244 },
  scratch_cards: { title: "Sealed Salvage", tag: "SCRATCH CARDS", icon: 78423 },
  chuck_a_luck: { title: "Triple Resonance", tag: "CHUCK-A-LUCK", icon: 88335 },
  red_dog: { title: "Transit Window", tag: "RED DOG", icon: 84955 },
};
export type LoungeHouse = {
  bank: string;
  minBet: string;
  maxBet: string;
  paused: boolean;
  version: number;
};
export async function fetchLoungeHouse(): Promise<LoungeHouse> {
  const data = await queryChain<{
    object: {
      version: number;
      asMoveObject: {
        contents: { type: { repr: string }; json: Record<string, unknown> };
      };
    } | null;
  }>(
    `query($id:SuiAddress!){object(address:$id){version asMoveObject{contents{type{repr} json}}}}`,
    { id: CYCLE_DEPLOYMENT.objects.casinoHouse },
  );
  const c = data.object?.asMoveObject?.contents;
  if (
    !c ||
    c.type.repr !==
      `${CYCLE_DEPLOYMENT.packages.casino}::house::House<${CURRENT_EVE_COIN_TYPE}>`
  )
    throw Error("Current testnet house could not be verified.");
  const f = c.json;
  for (const k of ["bank", "min_bet", "max_bet"])
    if (typeof f[k] !== "string" || !/^\d+$/.test(f[k] as string))
      throw Error("House balance or limits are unavailable.");
  if (typeof f.paused !== "boolean")
    throw Error("House status is unavailable.");
  return {
    bank: f.bank as string,
    minBet: f.min_bet as string,
    maxBet: f.max_bet as string,
    paused: f.paused,
    version: data.object!.version,
  };
}
export function testnetHouseReady(h: LoungeHouse | undefined): boolean {
  return (
    !!h &&
    CYCLE_DEPLOYMENT.casinoFunded &&
    !h.paused &&
    BigInt(h.bank) > 0n &&
    BigInt(h.minBet) > 0n &&
    BigInt(h.maxBet) >= BigInt(h.minBet)
  );
}
