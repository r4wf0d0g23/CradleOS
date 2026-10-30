import { normalizeStructTag } from "@mysten/sui/utils";
import { WORLD_PKG, SUI_GRAPHQL } from "../constants";
import { storageId, storageRecord } from "./storageRead";
import type { GateDeployment } from "./gateDeployment";

type Page = { nodes: any[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
export type HistoryGate = { id: string; version: string; ownerCapId: string };
export type HistoryRoute = { id: string; gateA: string; gateB: string };
export type GraphRead = (query: string, variables: Record<string, unknown>) => Promise<any>;
export const gateGraph: GraphRead = async (query, variables) => {
  for (let attempt=0; attempt<3; attempt++) {
    let res:Response;
    try { res=await fetch(SUI_GRAPHQL, { method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000) }); }
    catch { if(attempt===2)throw Error("Gate history unavailable."); await new Promise(r=>setTimeout(r,250*(attempt+1))); continue; }
    if ([429,502,503,504].includes(res.status)&&attempt<2) { await new Promise(r=>setTimeout(r,250*(attempt+1))); continue; }
    if (!res.ok) throw Error("Gate history unavailable.");
    const json=await res.json().catch(()=>{throw Error("Gate history unavailable.");});
    if(json.errors?.length||!json.data)throw Error("Gate history unavailable.");
    return json.data;
  }
  throw Error("Gate history unavailable.");
};
const eventsSelection = `nodes { contents { type { repr } json } } pageInfo { hasNextPage endCursor }`;
const versionsQuery = `query($gate:SuiAddress!,$after:String) {
  objectVersions(first:10,address:$gate,after:$after) { nodes { version
    previousTransaction { digest effects { events(first:50) { ${eventsSelection} } } }
  } pageInfo { hasNextPage endCursor } }
}`;
const eventsQuery = `query($digest:String!,$after:String) {
  transaction(digest:$digest) { effects { events(first:50,after:$after) { ${eventsSelection} } } }
}`;
function page(p: any): Page {
  if (!p || !Array.isArray(p.nodes) || typeof p.pageInfo?.hasNextPage !== "boolean" ||
      p.pageInfo.hasNextPage && (typeof p.pageInfo.endCursor !== "string" || !p.pageInfo.endCursor))
    throw Error("Gate history unavailable.");
  return p;
}
async function completeEvents(initial: any, digest: string, read: GraphRead) {
  let p = page(initial); const out: any[] = [], cursors = new Set<string>();
  for (let i = 0; i < 100; i++) {
    out.push(...p.nodes);
    if (!p.pageInfo.hasNextPage) return out;
    const after = p.pageInfo.endCursor!;
    if (cursors.has(after)) break;
    cursors.add(after);
    p = page((await read(eventsQuery, { digest, after })).transaction?.effects?.events);
  }
  throw Error("Gate history incomplete.");
}
/** Audit mutations, not merely latest extension or retained global events. The
 * first mutation must prove native creation, the last must match current gRPC
 * version. This also catches authorize+revoke inside one transaction. */
export async function verifyGateHistory(gate: HistoryGate, route: HistoryRoute | null,
  d: GateDeployment | null, read: GraphRead = gateGraph): Promise<string | null> {
  let cursor: string | null = null, last = 0n, created = false, authDigest: string | null = null;
  const seen = new Set<string>(), txSeen = new Set<string>(); let foundAuth = 0;
  for (let i = 0; i < 200; i++) {
    const p = page((await read(versionsQuery, { gate: gate.id, after: cursor })).objectVersions);
    for (const node of p.nodes) {
      if (!/^\d+$/.test(String(node.version))) throw Error("Gate history unavailable.");
      const version = BigInt(node.version);
      if (version <= last || version > BigInt(gate.version)) throw Error("Gate changed. Refresh.");
      const first = last === 0n; last = version;
      const tx = node.previousTransaction;
      if (typeof tx?.digest !== "string" || !tx.digest || txSeen.has(tx.digest)) throw Error("Gate history unavailable.");
      txSeen.add(tx.digest);
      const events = (await completeEvents(tx.effects?.events, tx.digest, read)).map(e => {
        if (typeof e.contents?.type?.repr !== "string") throw Error("Gate history unavailable.");
        return { type: normalizeStructTag(e.contents.type.repr), fields: storageRecord(e.contents.json) };
      });
      if (first) {
        created = events.some(e => e.type === `${WORLD_PKG}::gate::GateCreatedEvent` &&
          storageId(e.fields.assembly_id) === gate.id && storageId(e.fields.owner_cap_id) === gate.ownerCapId);
        if (!created) throw Error("Gate history incomplete.");
      }
      for (const e of events) {
        if (e.type !== `${WORLD_PKG}::gate::ExtensionAuthorizedEvent` || storageId(e.fields.assembly_id) !== gate.id) continue;
        foundAuth++;
        if (!route || !d || foundAuth !== 1) throw Error("Previously programmed gate.");
        const rawType = e.fields.extension_type;
        const name = typeof rawType === "string" ? rawType : rawType?.name;
        if (typeof name !== "string" || normalizeStructTag(name.startsWith("0x") ? name : `0x${name}`) !== `${d.originalId}::route::GateAuth`)
          throw Error("Previously programmed gate.");
        const match = events.some(x => x.type === `${d.originalId}::route::RouteCreated` &&
          storageId(x.fields.route_id) === route.id && storageId(x.fields.gate_a) === route.gateA && storageId(x.fields.gate_b) === route.gateB);
        if (!match) throw Error("Gate setup unverified.");
        authDigest = tx.digest;
      }
    }
    if (!p.pageInfo.hasNextPage) {
      if (!created || last !== BigInt(gate.version) || route && foundAuth !== 1) throw Error("Gate history incomplete.");
      return authDigest;
    }
    cursor = p.pageInfo.endCursor!;
    if (seen.has(cursor)) break;
    seen.add(cursor);
  }
  throw Error("Gate history incomplete.");
}

const cache = new Map<string, Promise<string | null>>();
export async function verifyPairHistory(a: HistoryGate, b: HistoryGate, route: HistoryRoute | null, d: GateDeployment | null) {
  const verify = (g: HistoryGate) => {
    const key = `${g.id}:${g.version}:${g.ownerCapId}:${route?.id ?? "new"}:${d?.originalId ?? "none"}`;
    if (!cache.has(key)) {
      if (cache.size >= 100) cache.clear();
      cache.set(key, verifyGateHistory(g, route, d).catch(e => { cache.delete(key); throw e; }));
    }
    return cache.get(key)!;
  };
  const [left, right] = await Promise.all([verify(a), verify(b)]);
  if (left !== right) throw Error("Gate setup unverified.");
}
