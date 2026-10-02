import { afterEach, describe, expect, it, vi } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { assertCycleCompatible } from "./transactionCompatibility";
import { CurrentAccountSigner } from "./cycleSigner";
import { CASINO_PKG, CRADLEOS_PKG, EVE_COIN_TYPE, WORLD_PKG } from "../constants";
import { CURRENT_EVE_COIN_TYPE, CURRENT_WORLD, LEGACY_EVE_COIN_TYPE } from "./cycle";
import { findCurrentCharacters, listOwnedCurrentObjects } from "./currentWorldRead";
import { loadSolarSystemCatalog } from "./solarSystems";
import { getSolarSystem, getSolarSystemDetail } from "./dataClient";
import { readFileSync, readdirSync } from "node:fs";

afterEach(() => vi.unstubAllGlobals());
function tx(target: string, types = [LEGACY_EVE_COIN_TYPE]) {
  const t = new Transaction(); t.moveCall({ target, typeArguments: types }); return t;
}
describe("Cycle 7 transaction boundary", () => {
  it("separates current character origin from the existing house's token", () => {
    expect(WORLD_PKG).toBe(CURRENT_WORLD);
    expect(EVE_COIN_TYPE).toBe(LEGACY_EVE_COIN_TYPE);
    expect(EVE_COIN_TYPE).not.toBe(CURRENT_EVE_COIN_TYPE);
  });
  it.each(["blackjack_live::deal", "blackjack_live::double", "blackjack_live::split", "house::deposit", "coinflip::play"])("blocks new legacy action %s", name => {
    expect(() => assertCycleCompatible(tx(`${CASINO_PKG}::${name}`))).toThrow(/migration pending/);
  });
  it.each(["blackjack_live::stand", "blackjack_live::hit", "blackjack_live::split_hit", "blackjack_live::split_stand", "hilo::settle", "mines::reveal", "mines::cashout", "dragon_tower::pick", "dragon_tower::cashout", "video_poker::draw", "house::withdraw"])("preserves existing recovery %s", name => {
    expect(() => assertCycleCompatible(tx(`${CASINO_PKG}::${name}`))).not.toThrow();
  });
  it("rejects a new-currency recovery and a mixed permitted/prohibited PTB", () => {
    expect(() => assertCycleCompatible(tx(`${CASINO_PKG}::blackjack_live::stand`, [CURRENT_EVE_COIN_TYPE]))).toThrow(/original asset/);
    const t = tx(`${CASINO_PKG}::blackjack_live::stand`);
    t.moveCall({ target: `${CRADLEOS_PKG}::tribe_vault::create_vault` });
    expect(() => assertCycleCompatible(t)).toThrow(/migration pending/);
  });
  it("checks serialized transactions before invoking the wallet", async () => {
    const send = vi.fn(); const sign = vi.fn();
    const signer = new CurrentAccountSigner({ signAndExecuteTransaction: send, signTransaction: sign } as any);
    const t = tx(`${CASINO_PKG}::coinflip::play`);
    expect(() => assertCycleCompatible(t.serialize())).toThrow(/migration pending/);
    await expect(signer.signAndExecuteTransaction({ transaction: t })).rejects.toThrow(/migration pending/);
    t.setSender("0x1"); t.setGasPrice(1); t.setGasBudget(1000); t.setGasPayment([{ objectId: "0x2", version: "1", digest: "11111111111111111111111111111111" }]);
    const bytes = await t.build();
    await expect(signer.signTransaction(bytes)).rejects.toThrow(/migration pending/);
    expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled();
  });
  it("routes all component signer imports through the guard", () => {
    const root = new URL("../components/", import.meta.url);
    for (const f of readdirSync(root, { recursive: true }) as string[]) {
      if (!f.endsWith(".tsx")) continue;
      expect(readFileSync(new URL(f, root), "utf8")).not.toMatch(/import\s*\{[^}]*CurrentAccountSigner[^}]*\}\s*from\s*["']@mysten\/dapp-kit-core/);
    }
  });
});
describe("Current-world read integrity", () => {
  it("retires old map caches and APIs without fetching them", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await loadSolarSystemCatalog()).size).toBe(0);
    expect(await getSolarSystem(123)).toBeNull();
    expect(await getSolarSystemDetail(123)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not call failed transport an empty character list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(findCurrentCharacters("0x1")).rejects.toThrow(/not an empty/);
  });
  it("follows owned-object pages and rejects a repeated cursor", async () => {
    const reply = (endCursor: string) => new Response(JSON.stringify({ data: { objects: { nodes: [], pageInfo: { hasNextPage: true, endCursor } } } }));
    const fetcher = vi.fn().mockResolvedValueOnce(reply("same")).mockResolvedValueOnce(reply("same"));
    vi.stubGlobal("fetch", fetcher);
    await expect(listOwnedCurrentObjects("0x1", `${CURRENT_WORLD}::character::PlayerProfile`)).rejects.toThrow(/stalled/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects GraphQL errors even on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({errors:[{message:"index unavailable"}]}))));
    await expect(findCurrentCharacters("0x1")).rejects.toThrow(/index unavailable/);
  });
});

import { CASINO_V28 } from '../constants';
import { fetchOpenHiLoGame } from './casinoGames';
import { fetchActiveMinesGame } from './casinoMines';
import { fetchActiveTowerGame } from './casinoDragonTower';
import { fetchActiveVideoPokerHand } from './casinoVideoPoker';
describe('Legacy game discovery uses the type origin, not latest published-at', () => {
  it.each([fetchOpenHiLoGame, fetchActiveMinesGame, fetchActiveTowerGame, fetchActiveVideoPokerHand])('%s preserves discovery and exposes failed reads', async find => {
    const calls: any[]=[];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {calls.push(JSON.parse(options.body)); return {ok:true,json:async()=>({result:{data:[]}})};}));
    expect(await find('0x1')).toBeNull();
    expect(calls[0].params[1].filter.StructType).toMatch(new RegExp(`^${CASINO_V28}::`));
    vi.stubGlobal('fetch', vi.fn(async()=>({ok:true,json:async()=>({error:{message:'read unavailable'}})})));
    await expect(find('0x1')).rejects.toThrow();
  });
});
