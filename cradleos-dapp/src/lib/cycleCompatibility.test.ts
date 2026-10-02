import { afterEach, describe, expect, it, vi } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { assertCycleCompatible } from "./transactionCompatibility";
import { CurrentAccountSigner } from "./cycleSigner";
import { EVE_COIN_TYPE, WORLD_PKG } from "../constants";
import { CURRENT_EVE_COIN_TYPE, CURRENT_WORLD } from "./cycle";
import { findCurrentCharacters, listOwnedCurrentObjects } from "./currentWorldRead";
import { loadSolarSystemCatalog } from "./solarSystems";
import { getSolarSystem, getSolarSystemDetail } from "./dataClient";
import { readFileSync, readdirSync } from "node:fs";

afterEach(() => vi.unstubAllGlobals());
const OLD_CASINO = "0x5008cde6a70013b68e7290b6780e5a07302818fa7eaea5f3bfe4c52637e507e6";
function tx(target: string, types: string[] = []) { const t=new Transaction();t.moveCall({target,typeArguments:types});return t; }
describe("Cycle 7 clean-wipe boundary", () => {
 it("uses only current-world currency",()=>{expect(WORLD_PKG).toBe(CURRENT_WORLD);expect(EVE_COIN_TYPE).toBe(CURRENT_EVE_COIN_TYPE);});
 it.each(["blackjack_live::deal","blackjack_live::stand","house::withdraw","mines::cashout"])("rejects retired action %s, including recovery", name=>{
  expect(()=>assertCycleCompatible(tx(`${OLD_CASINO}::${name}`))).toThrow(/clean wipe/);
 });
 it("allows current world/framework calls only",()=>{
  expect(()=>assertCycleCompatible(tx(`${CURRENT_WORLD}::gate::jump`))).not.toThrow();
  expect(()=>assertCycleCompatible(tx('0x2::coin::zero',[CURRENT_EVE_COIN_TYPE]))).not.toThrow();
  expect(()=>assertCycleCompatible(tx('0x2::coin::zero',[`${OLD_CASINO}::old::Coin`]))).toThrow(/retired/);
 });
 it("blocks serialized retired transactions before wallet access",async()=>{
  const send=vi.fn();const sign=vi.fn();const signer=new CurrentAccountSigner({signAndExecuteTransaction:send,signTransaction:sign} as any);
  const t=tx(`${OLD_CASINO}::house::withdraw`);
  expect(()=>assertCycleCompatible(t.serialize())).toThrow(/clean wipe/);
  await expect(signer.signAndExecuteTransaction({transaction:t})).rejects.toThrow(/clean wipe/);
  t.setSender('0x1');t.setGasPrice(1);t.setGasBudget(1000);t.setGasPayment([{objectId:'0x2',version:'1',digest:'11111111111111111111111111111111'}]);
  await expect(signer.signTransaction(await t.build())).rejects.toThrow(/clean wipe/);expect(send).not.toHaveBeenCalled();expect(sign).not.toHaveBeenCalled();
 });
 it("all component signers use the current-cycle guard",()=>{
  const root=new URL('../components/',import.meta.url);for(const f of readdirSync(root,{recursive:true}) as string[]) if(f.endsWith('.tsx')) expect(readFileSync(new URL(f,root),'utf8')).not.toMatch(/import\s*\{[^}]*CurrentAccountSigner[^}]*\}\s*from\s*["']@mysten\/dapp-kit-core/);
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

import { resetRetiredCycleState } from './cycleStorage';
import { CYCLE_DEPLOYMENT } from './cycleDeployment';
it('clean wipe clears operational state without deleting Origins reading progress',()=>{
 const map=new Map([['cradleos:vault:123','old-vault'],['casino:hand','old-hand'],['delegation-obj:x','old-policy'],['cradleos_tribe_vault_id','old-vault'],['cradleos.comics.progress.v1','keep'],['theme','keep']]);
 const storage={get length(){return map.size},key:(i:number)=>[...map.keys()][i],getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)} as unknown as Storage;
 resetRetiredCycleState(storage);expect(map.has('cradleos:vault:123')).toBe(false);expect(map.has('casino:hand')).toBe(false);expect(map.has('delegation-obj:x')).toBe(false);expect(map.has('cradleos_tribe_vault_id')).toBe(false);expect(map.get('cradleos.comics.progress.v1')).toBe('keep');
 storage.setItem('cradleos:vault:new','current');resetRetiredCycleState(storage);expect(map.get('cradleos:vault:new')).toBe('current');
});
it('pending fresh deployment never falls back to retired contract IDs',()=>{
 expect(CYCLE_DEPLOYMENT.cycle).toBe(7);for(const id of Object.values(CYCLE_DEPLOYMENT.packages))expect(id).not.toBe(OLD_CASINO);
});
