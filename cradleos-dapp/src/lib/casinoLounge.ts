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
  slots: { title: "Salvage Reels", tag: "SLOTS", icon: 72244 },
  blackjack: { title: "Command Deck", tag: "BLACKJACK", icon: 82425 },
  roulette: { title: "Orbital Roulette", tag: "ROULETTE", icon: 84955 },
  coinflip: { title: "Signal Flip", tag: "COINFLIP", icon: 84180 },
  dice: { title: "Probability Drive", tag: "DICE", icon: 88335 },
  wheel: { title: "Reactor Wheel", tag: "WHEEL", icon: 91209 },
  plinko: { title: "Debris Drop", tag: "PLINKO", icon: 78423 },
  war: { title: "Fleet Duel", tag: "WAR", icon: 87848 },
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
