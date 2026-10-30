import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";
import { EVE_COIN_TYPE, WORLD_PKG, ENERGY_CONFIG } from "../constants";
import { GATE_DEPLOYMENT, type GateDeployment } from "./gateDeployment";
import { storageObject, storageObjects, storageFields, storageId as id, storageRecord as rec,
  storageUint as uint, assertStorageType, assertIdField, idFieldId, storageClient,
  type StorageReadClient, type StorageObject } from "./storageRead";
import { verifyPairHistory } from "./gateHistory";

export const GATE_TYPE = `${WORLD_PKG}::gate::Gate`;
export const GATE_COIN = normalizeStructTag(EVE_COIN_TYPE);
export const GATE_MODES = ["Closed", "Tribe only", "Tribe + allies", "Pilots", "Public"] as const;
export type Gate = { id: string; version: string; name: string; ownerCapId: string; parentId: string | null;
  linkedGateId: string | null; extension: string | null; online: boolean; itemId: number; typeId: number; tenant: string };
export type GateRules = { mode: number; memberTribe: number; allies: number[]; pilots: string[];
  deniedTribes: number[]; deniedPilots: string[]; startsAt: number; endsAt: number; dailyStart: number; dailyEnd: number };
export type GateRates = { toll: string; passPrice: string; passDuration: number; memberDiscountBps: number };
export type GateActivity = { kind: number; character: string; paid: string; timestamp: number; expiresAt: number };
export type GateRoute = { id: string; version: string; name: string; gateA: string; gateB: string; historyVerified?: boolean;
  capA: string; capB: string; active: boolean; locked: boolean; revision: string;
  rules: GateRules; rates: GateRates; passesId: string; proceeds: string; permitsIssued: string;
  passesSold: string; collected: string; claimed: string; activity: GateActivity[] };
export type GatePair = { a: Gate; b: Gate; route: GateRoute | null };
export type GateCharacter = { id: string; address: string; tribe: number; tenant: string };
export const DEFAULT_GATE_RULES: GateRules = { mode: 0, memberTribe: 0, allies: [], pilots: [],
  deniedTribes: [], deniedPilots: [], startsAt: 0, endsAt: 0, dailyStart: 0, dailyEnd: 0 };
export const DEFAULT_GATE_RATES: GateRates = { toll: "0", passPrice: "0", passDuration: 0, memberDiscountBps: 0 };
export const gateOperationLock = { busy: false };
function fail(message = "Gate data unavailable."): never { throw Error(message); }
function bool(value: unknown): boolean { return typeof value === "boolean" ? value : fail(); }
function str(value: unknown): string { return typeof value === "string" ? value : fail(); }
export function gateInt(value: unknown, bits = 64): string {
  if (!/^(0|[1-9]\d*)$/.test(String(value)) || typeof value === "number" && !Number.isSafeInteger(value) ||
      BigInt(String(value)) >= 1n << BigInt(bits)) return fail("Invalid amount.");
  return String(value);
}
export function parseGateAmount(text: string): string {
  if (!/^\d+(?:\.\d{1,9})?$/.test(text)) fail("Invalid amount.");
  const [whole, fraction=""] = text.split(".");
  return gateInt((BigInt(whole)*1000000000n + BigInt(fraction.padEnd(9,"0"))).toString());
}
export function formatGateAmount(amount: string): string {
  const n=BigInt(gateInt(amount,128)), fraction=(n%1000000000n).toString().padStart(9,"0").replace(/0+$/,"");
  return `${n/1000000000n}${fraction?"."+fraction:""}`;
}
const unique = (xs: unknown[]) => { if (xs.length !== new Set(xs).size) fail("Duplicate access entry."); };
export function gateDeployment(d = GATE_DEPLOYMENT): GateDeployment {
  if (!d || id(d.worldId) !== WORLD_PKG) fail("Gate setup unavailable.");
  return { packageId: id(d.packageId), originalId: id(d.originalId), registryId: id(d.registryId), worldId: id(d.worldId) };
}
export function validateGateRules(r: GateRules): GateRules {
  const out = { ...r, allies: r.allies.map(uint), deniedTribes: r.deniedTribes.map(uint),
    pilots: r.pilots.map(id), deniedPilots: r.deniedPilots.map(id) };
  if (!Number.isInteger(r.mode) || r.mode < 0 || r.mode > 4 || uint(r.memberTribe) > 0xffffffff ||
      [1,2].includes(r.mode) && !r.memberTribe || out.allies.length > 32 || out.deniedTribes.length > 32 ||
      out.pilots.length > 128 || out.deniedPilots.length > 128) fail("Invalid access rules.");
  for (const xs of [out.allies, out.deniedTribes]) { unique(xs); if (xs.some(n => !n || n > 0xffffffff)) fail("Invalid tribe ID."); }
  unique(out.pilots); unique(out.deniedPilots);
  for (const n of [r.startsAt, r.endsAt, r.dailyStart, r.dailyEnd]) uint(n);
  if (r.startsAt > 253402214400000 || r.endsAt > 253402214400000 || r.endsAt !== 0 && r.endsAt <= r.startsAt ||
      r.dailyStart >= 1440 || r.dailyEnd >= 1440) fail("Invalid access window.");
  return out;
}
export function validateGateRates(r: GateRates): GateRates {
  const out = { ...r, toll: gateInt(r.toll), passPrice: gateInt(r.passPrice) };
  uint(r.passDuration); uint(r.memberDiscountBps);
  if (r.memberDiscountBps > 10000 || !(r.passDuration === 0 && out.passPrice === "0" ||
      r.passDuration >= 300000 && r.passDuration <= 2592000000)) fail("Invalid pass settings.");
  return out;
}
export function gateWindowEnd(r: GateRules, now: number): number {
  if (now < r.startsAt || r.endsAt && now >= r.endsAt) fail("Outside access window.");
  let end = r.endsAt || Number.MAX_SAFE_INTEGER;
  if (r.dailyStart !== r.dailyEnd) {
    const day = Math.floor(now / 86400000) * 86400000, time = now % 86400000,
      start = r.dailyStart * 60000, stop = r.dailyEnd * 60000;
    if (start < stop) { if (time < start || time >= stop) fail("Outside access window."); end = Math.min(end, day + stop); }
    else { if (time < start && time >= stop) fail("Outside access window."); end = Math.min(end, day + (time >= start ? 86400000 : 0) + stop); }
  }
  return end;
}
export function gateAllows(r: GateRules, character: GateCharacter): boolean {
  const {id: cid, tribe} = character;
  if (!r.mode || r.deniedPilots.includes(cid) || tribe !== 0 && r.deniedTribes.includes(tribe)) return false;
  return r.mode === 4 || r.pilots.includes(cid) || r.mode !== 3 && tribe !== 0 &&
    (tribe === r.memberTribe || r.mode === 2 && r.allies.includes(tribe));
}
export function gatePrice(route: GateRoute, tribe: number, pass: boolean): string {
  const raw = BigInt(pass ? route.rates.passPrice : route.rates.toll);
  const bps = tribe && tribe === route.rules.memberTribe ? route.rates.memberDiscountBps : 0;
  return ((raw * BigInt(10000 - bps) + 9999n) / 10000n).toString();
}
function typeName(value: any): string | null {
  if (value === null) return null;
  const s = str(typeof value === "string" ? value : rec(value).name);
  return normalizeStructTag(s.startsWith("0x") ? s : `0x${s}`);
}
export function decodeGate(o: StorageObject): Gate {
  assertStorageType(o, GATE_TYPE); if (o.owner.kind !== 3) fail();
  const f = o.fields, key = rec(f.key), status = rec(rec(f.status).status)["@variant"];
  if (key.tenant !== "stillness" || !["ONLINE","OFFLINE"].includes(status)) fail("Wrong world or gate state.");
  return { id: o.id, version: o.version, name: f.metadata === null ? "Gate" : str(rec(f.metadata).name) || "Gate",
    ownerCapId: id(f.owner_cap_id), parentId: f.energy_source_id === null ? null : id(f.energy_source_id),
    linkedGateId: f.linked_gate_id === null ? null : id(f.linked_gate_id), extension: typeName(f.extension),
    online: status === "ONLINE", itemId: uint(key.item_id), typeId: uint(f.type_id), tenant: key.tenant };
}
export async function readGate(gateId: string, api = storageClient) { return decodeGate(await storageObject(id(gateId), api)); }
export async function readGateCharacter(characterId: string, api: StorageReadClient = storageClient): Promise<GateCharacter> {
  const o = await storageObject(characterId, api); assertStorageType(o, `${WORLD_PKG}::character::Character`);
  if (o.owner.kind !== 3 || rec(o.fields.key).tenant !== "stillness") fail("Character unavailable.");
  return { id: o.id, address: id(o.fields.character_address), tribe: uint(o.fields.tribe_id), tenant: "stillness" };
}
function decodeRoute(o: StorageObject, d: GateDeployment): GateRoute {
  assertStorageType(o, `${d.originalId}::route::Route<${GATE_COIN}>`); if (o.owner.kind !== 3) fail();
  const f = o.fields, r = rec(f.rules), rates = rec(f.rates);
  const rules = validateGateRules({ mode: uint(r.mode), memberTribe: uint(r.member_tribe), allies: r.allies,
    pilots: r.pilots, deniedTribes: r.denied_tribes, deniedPilots: r.denied_pilots, startsAt: uint(r.starts_at),
    endsAt: uint(r.ends_at), dailyStart: uint(r.daily_start), dailyEnd: uint(r.daily_end) });
  if (!Array.isArray(f.activity) || f.activity.length > 20) fail();
  return { id: o.id, version: o.version, name: str(f.name), gateA: id(f.gate_a), gateB: id(f.gate_b),
    capA: id(f.cap_a), capB: id(f.cap_b), active: bool(f.active), locked: bool(f.locked), revision: gateInt(f.revision), rules,
    rates: validateGateRates({ toll: gateInt(rates.toll), passPrice: gateInt(rates.pass_price),
      passDuration: uint(rates.pass_duration), memberDiscountBps: uint(rates.member_discount_bps) }),
    passesId: id(rec(f.passes).id), proceeds: gateInt(typeof f.proceeds === "object" ? rec(f.proceeds).value : f.proceeds),
    permitsIssued: gateInt(f.permits_issued), passesSold: gateInt(f.passes_sold), collected: gateInt(f.collected,128),
    claimed: gateInt(f.claimed,128), activity: f.activity.map((x: any) => ({kind:uint(x.kind), character:id(x.character),
      paid:gateInt(x.paid), timestamp:uint(x.timestamp_ms), expiresAt:uint(x.expires_at)})) };
}
async function registry(d: GateDeployment, api: StorageReadClient) {
  const o = await storageObject(d.registryId, api); assertStorageType(o, `${d.originalId}::route::Registry`);
  if (o.owner.kind !== 3) fail();
  return { active: id(rec(o.fields.routes).id), history: id(rec(o.fields.history).id) };
}
export async function readGateRoute(routeId: string, d = GATE_DEPLOYMENT, api: StorageReadClient = storageClient) {
  const deployment = gateDeployment(d), tables = await registry(deployment, api);
  const r = decodeRoute(await storageObject(routeId, api), deployment);
  const fields = await storageObjects([idFieldId(tables.history, r.id), idFieldId(tables.active,r.gateA), idFieldId(tables.active,r.gateB)],api);
  if (!fields[0]) fail(); assertIdField(fields[0],tables.history,r.id,"bool"); if (fields[0].fields.value !== true) fail();
  if (r.active) for (const [i, gate] of [r.gateA,r.gateB].entries()) {
    const f = fields[i+1]; if (!f) fail(); assertIdField(f,tables.active,gate,"0x2::object::ID"); if (id(f.fields.value)!==r.id) fail();
  }
  return r;
}
export async function discoverGateRoutes(d = GATE_DEPLOYMENT, api: StorageReadClient = storageClient) {
  const deployment=gateDeployment(d), tables=await registry(deployment,api), fields=await storageFields(tables.history,"bool",api);
  const routes: GateRoute[] = []; let unavailable=0;
  for (const f of fields) { try {
    if (f.fields.value !== true) fail(); const r=await readGateRoute(id(f.fields.name),deployment,api);
    // A route object alone is not proof that older native permits cannot bypass it.
    if (r.active) {
      try { await verifyGatePairHistory(await readGatePair(r.gateA,r),deployment); r.historyVerified=true; }
      catch { r.historyVerified=false; unavailable++; }
    }
    routes.push(r);
  } catch { unavailable++; } }
  return { routes, unavailable };
}
export async function readGatePair(gateId: string, route: GateRoute | null): Promise<GatePair> {
  const a=await readGate(route?.gateA ?? gateId); if (!a.linkedGateId && !route) fail("Link a gate first.");
  const b=await readGate(route?.gateB ?? a.linkedGateId!);
  if (a.id===b.id || a.typeId!==b.typeId) fail("Invalid gate pair.");
  return {a,b,route};
}
export function assertGatePair(pair: GatePair, requireLive: boolean, d = GATE_DEPLOYMENT) {
  const {a,b,route:r}=pair;
  if (a.id===b.id || a.linkedGateId!==b.id || b.linkedGateId!==a.id || a.tenant!==b.tenant || a.typeId!==b.typeId) fail("Gate link changed.");
  if (r) {
    if (r.gateA!==a.id || r.gateB!==b.id || r.capA!==a.ownerCapId || r.capB!==b.ownerCapId) fail("Gate ownership changed.");
    if (requireLive && (!r.active || r.locked || a.extension!==`${gateDeployment(d).originalId}::route::GateAuth` || a.extension!==b.extension)) fail("Route closed.");
  }
  if (requireLive && (!a.online || !b.online)) fail("Gate offline.");
}
export async function verifyGatePairHistory(pair: GatePair, d = GATE_DEPLOYMENT) {
  assertGatePair(pair,false,d);
  const witness=pair.route?`${gateDeployment(d).originalId}::route::GateAuth`:null;
  if (pair.a.extension!==witness || pair.b.extension!==witness) fail("Gate protection changed.");
  await verifyPairHistory(pair.a,pair.b,pair.route,d);
}
export async function readGatePass(route: GateRoute, cid: string, api: StorageReadClient = storageClient): Promise<number> {
  const f=(await storageObjects([idFieldId(route.passesId,cid)],api))[0]; if (!f) return 0;
  assertIdField(f,route.passesId,cid,"u64"); return uint(f.fields.value);
}
export function gatePreviewKey(p: GatePair, action?: GateAction) {
  const r=p.route;
  // Sales/activity do not change a quoted policy; claims quote the available balance.
  return JSON.stringify([p.a,p.b,r&&{id:r.id,gateA:r.gateA,gateB:r.gateB,capA:r.capA,capB:r.capB,
    revision:r.revision,active:r.active,locked:r.locked,name:r.name,rules:r.rules,rates:r.rates,
    ...(action?.kind==="claim"?{proceeds:r.proceeds}:{})}]);
}
export async function assertGateOwner(pair: GatePair, character: GateCharacter, wallet: string, api: StorageReadClient=storageClient) {
  if (character.address!==id(wallet)) fail("Wallet changed.");
  for (const g of [pair.a,pair.b]) {
    const cap=await storageObject(g.ownerCapId,api); assertStorageType(cap,`${WORLD_PKG}::access::OwnerCap<${GATE_TYPE}>`);
    if (![1,2].includes(cap.owner.kind??0) || id(cap.owner.address)!==character.id || id(cap.fields.authorized_object_id)!==g.id) fail("Both gates must be yours.");
  }
}
export type GateAction = { kind:"activate"; name:string } | {kind:"configure"; name:string; rules:GateRules; rates:GateRates} |
  {kind:"lockdown"|"pause"|"resume"|"deactivate"|"claim"|"unlink"} | {kind:"online"; gate:"a"|"b"} |
  {kind:"permit"|"pass"; amount:string};
export function buildGateAction(pair: GatePair, action: GateAction, character: GateCharacter, wallet: string, d=GATE_DEPLOYMENT): Transaction {
  const dep=gateDeployment(d), {a,b,route:r}=pair, buyer=action.kind==="permit"||action.kind==="pass";
  if (id(wallet)!==character.address || character.tenant!=="stillness") fail("Wallet changed.");
  if (action.kind!=="claim" && action.kind!=="deactivate") assertGatePair(pair,buyer,d);
  if (action.kind==="activate" && (r || a.extension || b.extension)) fail("Use unprogrammed gates.");
  if (!["activate","unlink","online"].includes(action.kind) && !r) fail("Route unavailable.");
  const tx=new Transaction(); tx.setSender(wallet);
  const target=(name:string)=>`${dep.packageId}::route::${name}` as `${string}::${string}::${string}`;
  const c=tx.object(character.id), ga=tx.object(a.id), gb=tx.object(b.id), rr=r?tx.object(r.id):undefined;
  const [ca,ra]=!buyer?tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[GATE_TYPE],arguments:[c,tx.object(a.ownerCapId)]}):[];
  const [cb,rb]=!buyer?tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[GATE_TYPE],arguments:[c,tx.object(b.ownerCapId)]}):[];
  if (action.kind==="activate") {
    const [route]=tx.moveCall({target:target("create"),typeArguments:[GATE_COIN],arguments:[tx.object(dep.registryId),ga,gb,ca,cb,tx.pure.string(action.name)]});
    tx.moveCall({target:target("share"),typeArguments:[GATE_COIN],arguments:[route]});
  } else if (action.kind==="configure") {
    const rules=validateGateRules(action.rules), rates=validateGateRates(action.rates);
    const [ru]=tx.moveCall({target:target("rules"),arguments:[tx.pure.u8(rules.mode),tx.pure.u32(rules.memberTribe),
      tx.pure.vector("u32",rules.allies),tx.pure.vector("address",rules.pilots),tx.pure.vector("u32",rules.deniedTribes),
      tx.pure.vector("address",rules.deniedPilots),tx.pure.u64(rules.startsAt),tx.pure.u64(rules.endsAt),tx.pure.u64(rules.dailyStart),tx.pure.u64(rules.dailyEnd)]});
    const [rt]=tx.moveCall({target:target("rates"),arguments:[tx.pure.u64(rates.toll),tx.pure.u64(rates.passPrice),tx.pure.u64(rates.passDuration),tx.pure.u64(rates.memberDiscountBps)]});
    tx.moveCall({target:target("configure"),typeArguments:[GATE_COIN],arguments:[rr!,ca,cb,tx.pure.u64(r!.revision),tx.pure.string(action.name),ru,rt]});
  } else if (buyer) {
    const amount=gateInt(action.amount);
    tx.moveCall({target:target(action.kind==="permit"?"request_permit":"buy_pass"),typeArguments:[GATE_COIN],arguments:[tx.object(dep.registryId),rr!,ga,gb,c,
      tx.pure.u64(r!.revision),coinWithBalance({type:GATE_COIN,balance:BigInt(amount),useGasCoin:false}),tx.object("0x6")]});
  } else if (action.kind==="lockdown") {
    if (!a.parentId) fail("Gate power source unavailable.");
    tx.moveCall({target:target("lockdown"),typeArguments:[GATE_COIN],arguments:[rr!,ga,gb,ca,cb,tx.object(a.parentId),tx.object(ENERGY_CONFIG),tx.pure.u64(r!.revision)]});
  } else if (action.kind==="pause"||action.kind==="resume") {
    tx.moveCall({target:target("set_locked"),typeArguments:[GATE_COIN],arguments:[rr!,ca,cb,tx.pure.u64(r!.revision),tx.pure.bool(action.kind==="pause")]});
  } else if (action.kind==="deactivate") {
    const witness=`${dep.originalId}::route::GateAuth`;
    if ([a.extension,b.extension].some(e=>e!==null&&e!==witness)) fail("Another gate policy is active.");
    tx.moveCall({target:target("deactivate"),typeArguments:[GATE_COIN],arguments:[tx.object(dep.registryId),rr!,ga,gb,ca,cb,tx.pure.u64(r!.revision)]});
  } else if (action.kind==="claim") {
    tx.moveCall({target:target("claim"),typeArguments:[GATE_COIN],arguments:[rr!,ca,cb]});
  } else if (action.kind==="unlink") {
    if (r?.active) fail("Deactivate route before unlinking.");
    tx.moveCall({target:`${WORLD_PKG}::gate::unlink_gates`,arguments:[ga,gb,ca,cb]});
  } else if (action.kind==="online") {
    const g=action.gate==="a"?a:b; if (!g.parentId) fail("Gate power source unavailable.");
    tx.moveCall({target:`${WORLD_PKG}::gate::online`,arguments:[action.gate==="a"?ga:gb,tx.object(g.parentId),tx.object(ENERGY_CONFIG),action.gate==="a"?ca:cb]});
  }
  if (!buyer) { tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[GATE_TYPE],arguments:[c,ca,ra]});
    tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[GATE_TYPE],arguments:[c,cb,rb]}); }
  return tx;
}
