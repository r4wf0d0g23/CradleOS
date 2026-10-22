import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { BOOK_DEPLOYMENT } from "./bookDeployment";
import {
  queryChain,
  listOwnedCurrentObjects,
  findCurrentCharacters,
} from "./currentWorldRead";
export {
  donationAmount as parseEve,
  formatDonation as formatEve,
} from "./casinoDonations";

export type BookConfig = typeof BOOK_DEPLOYMENT;
export const U64 = (1n << 64n) - 1n;
export const PRICE_FEEDS = {
  1: { label: "BTC/USD", feed: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  2: { label: "ETH/USD", feed: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
} as const;
export type Market = {
  id: string; bookId: string; creator: string; asset: 1 | 2;
  starts: number; ends: number; proofDeadline: number;
  priceFeed: string; priceExponent: number; strike: bigint; price: bigint; priceTime: number;
  poolA: bigint; poolB: bigint; escrow: bigint; result: 0 | 1 | 2 | 3;
  remainingWinningStake: bigint; claimCount: bigint; claimsId: string;
};
export type Ticket = {
  id: string; marketId: string; bettor: string; side: 1 | 2; stake: bigint;
  entitlementId: string; paid: boolean; payout: bigint;
};
export type Delivery = {
  id: string; bookId: string; title: string; sponsor: string; sponsorCharacter: string;
  origin: string; itemType: bigint; quantity: bigint; deadline: number;
  reward: bigint; rewardAmount: bigint; status: 0 | 1 | 2;
  fulfilledBy: string; fulfilledAt: number;
};
export type DeliveryItem = { id: string; origin: string; itemType: bigint; quantity: bigint };
type Node = {
  address: string;
  owner?: { __typename: string };
  asMoveObject?: {
    contents: { type: { repr: string }; json: Record<string, unknown> };
  };
};
export function objectId(x: unknown): string {
  if (typeof x !== "string" || !/^0x[\da-fA-F]{1,64}$/.test(x))
    throw Error("Invalid object ID.");
  return normalizeSuiAddress(x);
}
function raw(x: unknown): bigint {
  if (typeof x !== "string" || !/^\d+$/.test(x) || BigInt(x) > U64)
    throw Error("Incomplete book data.");
  return BigInt(x);
}
function seconds(x: unknown): number {
  const n = raw(x);
  if (n > 8_640_000_000_000n) throw Error("Invalid event time.");
  return Number(n);
}
function small(x: unknown): number {
  if (typeof x !== "number" && !(typeof x === "string" && /^\d+$/.test(x)))
    throw Error("Invalid numeric state.");
  const n = Number(x);
  if (!Number.isInteger(n) || n < 0 || n > 255)
    throw Error("Invalid numeric state.");
  return n;
}
function bytesHex(x: unknown): string {
  if (typeof x !== "string") throw Error("Invalid oracle feed.");
  try { return Array.from(atob(x), c => c.charCodeAt(0).toString(16).padStart(2, "0")).join(""); }
  catch { throw Error("Invalid oracle feed."); }
}
export function priceLabel(n: bigint): string {
  const whole = n / 100_000_000n, fraction = (n % 100_000_000n).toString().padStart(8,"0").replace(/0+$/,"");
  return "$" + whole.toString() + (fraction ? "." + fraction : "");
}
export function parsePrice(s: string): bigint {
  if (!/^\d+(?:\.\d{1,8})?$/.test(s)) throw Error("Enter a positive USD price with at most 8 decimals.");
  const [w,f=""] = s.split("."); const n = BigInt(w)*100_000_000n + BigInt(f.padEnd(8,"0"));
  if (n <= 0n || n > U64) throw Error("Price out of range."); return n;
}
export function configured(cfg: BookConfig = BOOK_DEPLOYMENT) {
  return !!cfg.packageId && !!cfg.bookId;
}
function requireConfig(cfg: BookConfig) {
  if (!configured(cfg)) throw Error("Betting book setup pending.");
  objectId(cfg.packageId);
  objectId(cfg.bookId);
}
export function parseMarket(n: Node, cfg = BOOK_DEPLOYMENT): Market {
  const c = n.asMoveObject?.contents,
    f = c?.json;
  if (
    n.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::book::Market<${cfg.coinType}>` ||
    !f ||
    raw(f.version) !== 1n ||
    objectId(f.book_id) !== cfg.bookId ||
    f.tenant !== cfg.tenant
  )
    throw Error("Market could not be verified.");
  const m: Market = {
    id: objectId(n.address),
    bookId: objectId(f.book_id),
    creator: objectId(f.creator), asset: small(f.asset) as 1 | 2,
    starts: seconds(f.starts), ends: seconds(f.ends), proofDeadline: seconds(f.proof_deadline),
    priceFeed: bytesHex(f.price_feed), priceExponent: small(f.price_exponent),
    strike: raw(f.price_strike), price: raw(f.price_value), priceTime: seconds(f.price_time),
    claimCount: raw(f.claim_count), claimsId: objectId((f.claims as {id?: unknown})?.id),
    poolA: raw(f.pool_a),
    poolB: raw(f.pool_b),
    escrow: raw(f.escrow),
    result: small(f.result) as Market["result"],
    remainingWinningStake: raw(f.remaining_winning_stake),
  };
  if (
    ![1, 2].includes(m.asset) ||
    m.priceFeed !== PRICE_FEEDS[m.asset]?.feed || m.priceExponent !== 8 || m.strike === 0n ||
    m.claimCount > 10000n ||
    (m.priceTime !== 0 && (m.priceTime < m.ends || m.priceTime > m.ends + 60 || m.price === 0n)) ||
    ![0, 1, 2, 3].includes(m.result) ||
    m.starts >= m.ends ||
    m.proofDeadline !== m.ends + 3600 ||
    m.poolA + m.poolB > U64 ||
    m.escrow > m.poolA + m.poolB ||
    m.remainingWinningStake >
      (m.result === 1 ? m.poolA : m.result === 2 ? m.poolB : 0n)
  )
    throw Error("Invalid market state.");
  return m;
}
const fields =
  "address owner{__typename} asMoveObject{contents{type{repr} json}}";
export async function fetchMarket(
  id: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<Market> {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node | null }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: objectId(id) },
  );
  if (!r.object) throw Error("Market unavailable.");
  return parseMarket(r.object, cfg);
}
export async function fetchBook(
  cfg = BOOK_DEPLOYMENT,
): Promise<{ paused: boolean; marketIds: string[]; deliveryIds: string[] }> {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node | null }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: cfg.bookId },
  );
  const n = r.object,
    c = n?.asMoveObject?.contents,
    f = c?.json;
  if (
    n?.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::book::Book<${cfg.coinType}>` ||
    !f ||
    raw(f.version) !== 1n ||
    f.tenant !== cfg.tenant ||
    typeof f.paused !== "boolean" ||
    !Array.isArray(f.markets) || !Array.isArray(f.deliveries)
  )
    throw Error("Book could not be verified.");
  const marketIds = f.markets.map(objectId);
  if (new Set(marketIds).size !== marketIds.length)
    throw Error("Invalid market list.");
  return { paused: f.paused, marketIds, deliveryIds: (f.deliveries as unknown[]).map(objectId) };
}
export async function fetchTickets(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<Ticket[]> {
  requireConfig(cfg);
  const address = objectId(owner),
    nodes = await listOwnedCurrentObjects(
      address,
      `${cfg.packageId}::book::Ticket<${cfg.coinType}>`,
    );
  const receipts = nodes.map((n) => {
    const f = n.asMoveObject?.contents.json;
    if (
      !f ||
      objectId(f.bettor) !== address ||
      ![1, 2].includes(small(f.side)) ||
      raw(f.stake) === 0n
    )
      throw Error("Ticket could not be verified.");
    return {
      id: objectId(n.address),
      marketId: objectId(f.market_id),
      bettor: address,
      side: small(f.side) as 1 | 2,
      stake: raw(f.stake), entitlementId: objectId(f.entitlement_id),
    };
  });
  const result: Ticket[] = [];
  for (let i = 0; i < receipts.length; i += 25) {
    const batch = receipts.slice(i,i+25);
    const query = "query{" + batch.map((r,j) => `e${j}:object(address:"${r.entitlementId}"){${fields}}`).join(" ") + "}";
    const data = await queryChain<Record<string,Node | null>>(query);
    batch.forEach((r,j) => {
      const n = data[`e${j}`], c = n?.asMoveObject?.contents, f = c?.json;
      if (!n || n.owner?.__typename !== "Shared" || objectId(n.address) !== r.entitlementId ||
          c?.type.repr !== `${cfg.packageId}::book::Entitlement<${cfg.coinType}>` || !f ||
          objectId(f.market_id) !== r.marketId || objectId(f.bettor) !== r.bettor ||
          small(f.side) !== r.side || raw(f.stake) !== r.stake || typeof f.paid !== "boolean")
        throw Error("Payment status unavailable.");
      result.push({...r, paid: f.paid, payout: raw(f.payout)});
    });
  }
  return result;
}
export async function fetchBookAdmin(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<string | null> {
  requireConfig(cfg);
  const nodes = await listOwnedCurrentObjects(
    objectId(owner),
    `${cfg.packageId}::book::AdminCap`,
  );
  return (
    nodes.find((n) => n.asMoveObject?.contents.json.book_id === cfg.bookId)
      ?.address ?? null
  );
}
export async function findBookCharacter(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<string> {
  const address = objectId(owner),
    candidates = await findCurrentCharacters(address);
  for (const candidate of candidates) {
    const r = await queryChain<{ object: Node | null }>(
      `query($id:SuiAddress!){object(address:$id){${fields}}}`,
      { id: candidate.characterId },
    );
    const c = r.object?.asMoveObject?.contents,
      f = c?.json;
    if (
      c?.type.repr === `${cfg.world}::character::Character` &&
      f &&
      f.character_address === address &&
      (f.key as { tenant?: string })?.tenant === cfg.tenant
    )
      return objectId(candidate.characterId);
  }
  throw Error(
    "A current Frontier character linked to this wallet is required.",
  );
}
export function marketPhase(m: Market, now = Math.floor(Date.now() / 1000)) {
  if (m.result === 3) return "Refund";
  if (m.result) return "Settled";
  return now < m.starts
    ? "Open"
    : now < m.ends
      ? "Live"
      : now < m.proofDeadline
        ? "Proofs"
        : "Ready to settle";
}
export function estimatedReturn(m: Market, side: 1 | 2, stake: bigint): bigint {
  if (stake <= 0n || stake > U64 || m.poolA + m.poolB + stake > U64)
    throw Error("Stake exceeds market capacity.");
  const own = side === 1 ? m.poolA : m.poolB;
  return (stake * (m.poolA + m.poolB + stake)) / (own + stake);
}
export function ticketReturn(m: Market, t: Ticket): bigint | null {
  if (t.marketId !== m.id) throw Error("Ticket belongs to another market.");
  if (t.paid) return t.payout;
  if (!m.result) return null;
  if (m.result === 3) return t.stake;
  if (m.result !== t.side) return 0n;
  const pool = t.side === 1 ? m.poolA : m.poolB,
    claimed = pool - m.remainingWinningStake,
    total = m.poolA + m.poolB;
  if (pool === 0n || t.stake > m.remainingWinningStake)
    throw Error("Invalid claim state.");
  return ((claimed + t.stake) * total) / pool - (claimed * total) / pool;
}
function call(
  tx: Transaction,
  fn: string,
  args: Parameters<Transaction["moveCall"]>[0]["arguments"],
  cfg: BookConfig,
) {
  requireConfig(cfg);
  tx.moveCall({
    target: `${cfg.packageId}::${fn.includes("::") ? fn : "book::"+fn}`,
    typeArguments: [cfg.coinType],
    arguments: args,
  });
  return tx;
}
function splitFunds(tx: Transaction, amount: bigint, coins: {id:string;balance:bigint}[]) {
  if(amount<=0n || amount>U64) throw Error("Invalid EVE amount.");
  const seen = new Set<string>();
  let remaining = amount;
  const parts = [];
  for (const c of coins) {
    const id = objectId(c.id);
    if (seen.has(id) || c.balance < 0n || c.balance > U64)
      throw Error("Invalid coin list.");
    seen.add(id);
  }
  for (const c of coins) {
    if (!remaining) break;
    const take = c.balance < remaining ? c.balance : remaining;
    if (!take) continue;
    if (parts.length === 64) throw Error("Consolidate EVE coins first.");
    parts.push(tx.splitCoins(tx.object(c.id), [tx.pure.u64(take)])[0]);
    remaining -= take;
  }
  if (remaining) throw Error("Insufficient EVE.");
  if (parts.length > 1) tx.mergeCoins(parts[0], parts.slice(1));
  return parts[0];
}
/** Split exact portions before merging; total wallet holdings may exceed u64. */
export function buildBet(
  m: Market,
  character: string,
  side: 1 | 2,
  amount: bigint,
  coins: { id: string; balance: bigint }[],
  cfg = BOOK_DEPLOYMENT,
): Transaction {
  if (!cfg.wageringEnabled) throw Error("New bets paused.");
  if (
    ![1, 2].includes(side) ||
    m.bookId !== cfg.bookId ||
    marketPhase(m) !== "Open"
  )
    throw Error("Betting closed.");
  estimatedReturn(m, side, amount);
  const tx = new Transaction();
  const funds = splitFunds(tx,amount,coins);
  return call(
    tx,
    "place_bet",
    [
      tx.object(cfg.bookId),
      tx.object(m.id),
      tx.object(objectId(character)),
      tx.pure.u8(side),
      funds,
      tx.object("0x6"),
    ],
    cfg,
  );
}
export function buildPriceProof(market: string, data: Uint8Array, cfg = BOOK_DEPLOYMENT) {
  if (!data.length || data.length > 16384) throw Error("Invalid signed price update.");
  const tx = new Transaction();
  return call(tx,"price::submit",[tx.object(objectId(market)),tx.object(cfg.pythState),tx.object(cfg.wormholeState),tx.pure.vector("u8",data),tx.object("0x6")],cfg);
}
export function buildFinalize(market: string, cfg = BOOK_DEPLOYMENT) {
  const tx = new Transaction();
  return call(
    tx,
    "finalize",
    [tx.object(objectId(market)), tx.object("0x6")],
    cfg,
  );
}
export function buildClaim(
  market: string,
  entitlement: string,
  cfg = BOOK_DEPLOYMENT,
) {
  const tx = new Transaction();
  return call(
    tx,
    "claim_for",
    [tx.object(objectId(market)), tx.object(objectId(entitlement))],
    cfg,
  );
}
export type CreateMarket = { asset: 1 | 2; strike: bigint; starts: number; ends: number };
export function buildCreate(cap: string, p: CreateMarket, cfg = BOOK_DEPLOYMENT) {
  const now = Math.floor(Date.now()/1000);
  if (!cfg.wageringEnabled) throw Error("New markets paused.");
  if (![1,2].includes(p.asset) || p.strike <= 0n || p.strike > U64 ||
      ![p.starts,p.ends].every(n => Number.isSafeInteger(n) && n > 0) ||
      p.starts < now+300 || p.starts > now+2592000 || p.ends < p.starts+60 || p.ends > p.starts+604800)
    throw Error("Invalid market terms.");
  const tx = new Transaction();
  return call(tx,"price::create",[tx.object(cfg.bookId),tx.object(objectId(cap)),tx.pure.u8(p.asset),tx.pure.u64(p.strike),tx.pure.u64(p.starts),tx.pure.u64(p.ends),tx.object("0x6")],cfg);
}
export function parseDelivery(n: Node, cfg = BOOK_DEPLOYMENT): Delivery {
  const c=n.asMoveObject?.contents,f=c?.json;
  if (n.owner?.__typename !== "Shared" || c?.type.repr !== `${cfg.packageId}::delivery::Delivery<${cfg.coinType}>` ||
      !f || objectId(f.book_id) !== cfg.bookId || f.tenant !== cfg.tenant || typeof f.title !== "string") throw Error("Reward unavailable.");
  const d: Delivery = {id:objectId(n.address),bookId:objectId(f.book_id),title:f.title,sponsor:objectId(f.sponsor),sponsorCharacter:objectId(f.sponsor_character),
    origin:objectId(f.origin),itemType:raw(f.item_type),quantity:raw(f.quantity),deadline:seconds(f.deadline),reward:raw(f.reward),rewardAmount:raw(f.reward_amount),
    status:small(f.status) as 0|1|2,fulfilledBy:objectId(f.fulfilled_by),fulfilledAt:seconds(f.fulfilled_at)};
  if (![0,1,2].includes(d.status) || d.quantity===0n || d.quantity>4294967295n || d.rewardAmount===0n || d.reward!==(d.status===0?d.rewardAmount:0n)) throw Error("Invalid reward state.");
  return d;
}
export async function fetchDelivery(id: string, cfg = BOOK_DEPLOYMENT) {
  requireConfig(cfg); const r=await queryChain<{object:Node|null}>(`query($id:SuiAddress!){object(address:$id){${fields}}}`,{id:objectId(id)});
  if (!r.object) throw Error("Reward unavailable."); return parseDelivery(r.object,cfg);
}
export async function fetchDeliveryItems(owner: string, cfg = BOOK_DEPLOYMENT): Promise<DeliveryItem[]> {
  const nodes=await listOwnedCurrentObjects(objectId(owner),`${cfg.world}::inventory::Item`);
  return nodes.flatMap(n => {const f=n.asMoveObject?.contents.json; if (!f || f.tenant!==cfg.tenant) return [];
    return [{id:objectId(n.address),origin:objectId(f.parent_id),itemType:raw(f.type_id),quantity:raw(String(f.quantity))}];});
}
export function buildFulfill(d: Delivery, character: string, items: DeliveryItem[], cfg=BOOK_DEPLOYMENT) {
  if(d.bookId!==cfg.bookId || d.status!==0 || Math.floor(Date.now()/1000)>=d.deadline || !items.length || items.length>32 ||
    new Set(items.map(i=>objectId(i.id))).size!==items.length || items.some(i=>i.origin!==d.origin || i.itemType!==d.itemType || i.quantity<=0n) ||
    items.reduce((n,i)=>n+i.quantity,0n)!==d.quantity) throw Error("Select the exact required items.");
  const tx=new Transaction();return call(tx,"delivery::fulfill",[tx.object(d.id),tx.object(objectId(character)),tx.object(d.origin),tx.makeMoveVec({type:`${cfg.world}::inventory::Item`,elements:items.map(i=>tx.object(i.id))}),tx.object("0x6")],cfg);
}
export function buildDeliveryRefund(id: string,cfg=BOOK_DEPLOYMENT) {
  const tx=new Transaction();return call(tx,"delivery::refund",[tx.object(objectId(id)),tx.object("0x6")],cfg);
}
export type CreateDelivery = {title:string; origin:string; itemType:bigint; quantity:bigint; deadline:number; reward:bigint};
export function buildDelivery(character:string,p:CreateDelivery,coins:{id:string;balance:bigint}[],cfg=BOOK_DEPLOYMENT) {
  if(!cfg.rewardsEnabled) throw Error("New rewards paused.");
  const now=Math.floor(Date.now()/1000);
  if(!p.title.trim() || new TextEncoder().encode(p.title).length>96 || p.itemType<=0n || p.itemType>U64 || p.quantity<=0n || p.quantity>4294967295n ||
    !Number.isSafeInteger(p.deadline) || p.deadline<now+300 || p.deadline>now+2592000) throw Error("Invalid reward terms.");
  const tx=new Transaction();const funds=splitFunds(tx,p.reward,coins);
  return call(tx,"delivery::create",[tx.object(cfg.bookId),tx.object(objectId(character)),tx.object(objectId(p.origin)),tx.pure.string(p.title),tx.pure.u64(p.itemType),tx.pure.u64(p.quantity),tx.pure.u64(p.deadline),funds,tx.object("0x6")],cfg);
}
export function bookReceipt(result: unknown): string {
  const r = result as {
    $kind?: string;
    Transaction?: { digest?: string; status?: { success?: boolean } };
    FailedTransaction?: unknown;
  };
  if (r?.$kind === "FailedTransaction") throw Error("Transaction failed.");
  if (
    r?.$kind !== "Transaction" ||
    r.Transaction?.status?.success !== true ||
    !r.Transaction.digest
  )
    throw Error("Outcome unconfirmed. Check wallet activity.");
  return r.Transaction.digest;
}
