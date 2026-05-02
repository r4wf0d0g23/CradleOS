import React, { useState, useEffect, useRef, useMemo } from "react";
import { WORLD_API, SERVER_ENV } from "../constants";
import { bcs } from "@mysten/sui/bcs";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { rpcFetchWithRetry, rpcPMap } from "../lib";

const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
const SUI_RPC = "https://fullnode.testnet.sui.io:443";
const WORLD_PKG = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";
const OBJECT_REGISTRY = "0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c";

// ── Targeted character resolution via address derivation ──────────────────────
// Instead of fetching all 3000+ characters, derive Sui addresses from item_ids
// and batch-fetch only the ones we need.

function deriveCharacterAddress(itemId: string, tenant: string): string {
  const bcsType = bcs.struct("TenantItemId", { id: bcs.u64(), tenant: bcs.string() });
  const key = bcsType.serialize({ id: BigInt(itemId), tenant }).toBytes();
  const typeTag = `0x2::derived_object::DerivedObjectKey<${WORLD_PKG}::in_game_id::TenantItemId>`;
  return deriveDynamicFieldID(OBJECT_REGISTRY, typeTag, key);
}

async function resolveCharactersByItemIds(itemIds: string[], tenant?: string): Promise<Map<string, string>> {
  // Try both tenants if not specified — covers cross-env edge cases
  const tenantToUse = tenant ?? SERVER_ENV;
  const result = new Map<string, string>();
  if (!itemIds.length) return result;

  // Derive Sui addresses
  const idToAddr = new Map<string, string>();
  const addrToId = new Map<string, string>();
  for (const id of itemIds) {
    try {
      const addr = deriveCharacterAddress(id, tenantToUse);
      idToAddr.set(id, addr);
      addrToId.set(addr, id);
    } catch (e) {
      console.warn(`[IntelDashboard] Failed to derive address for ${id}:`, e);
    }
  }

  // Batch fetch in groups of 10 (Sui GraphQL has a 50KB payload limit)
  const addrs = [...idToAddr.values()];
  for (let i = 0; i < addrs.length; i += 10) {
    const batch = addrs.slice(i, i + 10);
    const fragments = batch.map((addr, idx) =>
      `obj${idx}: object(address: "${addr}") { address asMoveObject { contents { json } } }`
    ).join("\n");
    const data = await gql(`{ ${fragments} }`);
    if (!data) { console.warn("[IntelDashboard] Batch query returned null"); continue; }
    for (let j = 0; j < batch.length; j++) {
      const obj = data[`obj${j}`];
      if (!obj?.asMoveObject?.contents?.json) continue;
      const json = obj.asMoveObject.contents.json;
      const itemId = json.key?.item_id;
      const name = json.metadata?.name?.trim();
      if (itemId && name) result.set(itemId, name);
    }
  }

  return result;
}

async function gql(query: string): Promise<any> {
  try {
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const d = await res.json();
    if (d.errors?.length) throw new Error(d.errors[0].message);
    return d.data;
  } catch (e) {
    console.error("GraphQL error:", e);
    return null;
  }
}

async function fetchAllObjects(type: string, limit = 50, maxTotal = 500): Promise<any[]> {
  const results: any[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext && results.length < maxTotal) {
    const afterClause = after ? `, after: "${after}"` : "";
    const data = await gql(`{
      objects(filter: { type: "${type}" }, first: ${limit}${afterClause}) {
        pageInfo { hasNextPage endCursor }
        nodes { address asMoveObject { contents { json } } }
      }
    }`);
    if (!data) break;
    const objs = data.objects;
    results.push(
      ...objs.nodes.map((n: any) => ({
        objectId: n.address,
        ...n.asMoveObject.contents.json,
      }))
    );
    hasNext = objs.pageInfo.hasNextPage;
    after = objs.pageInfo.endCursor;
  }
  return results;
}

// Resolve character names for specific item_ids not in an existing map
/* resolveCharacterNames: kept as reference for targeted resolution if 5000 cap isn't enough */

function formatTimestamp(ts: string): string {
  const ms = parseInt(ts, 10) * 1000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function truncateAddr(addr: string, front = 6, back = 4): string {
  if (!addr || addr.length <= front + back + 2) return addr;
  return `${addr.slice(0, front)}...${addr.slice(-back)}`;
}

// Solar system name cache (shared across component lifetime)
const sysNameCache = new Map<string, string>();

async function resolveSolarSystemNames(sysIds: string[]): Promise<Map<string, string>> {
  const missing = sysIds.filter(id => id && !sysNameCache.has(id));
  // Fetch in parallel, max 20 concurrent
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += 20) {
    batches.push(missing.slice(i, i + 20));
  }
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(id =>
        fetch(`${WORLD_API}/v2/solarsystems/${id}`)
          .then(r => r.json())
          .then((d: { id: number; name?: string }) => ({ id, name: d.name ?? null }))
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.name) {
        sysNameCache.set(r.value.id, r.value.name);
      }
    }
  }
  return sysNameCache;
}

const TABS = ["KILL FEED", "INFRASTRUCTURE", "SECURITY"] as const;
type Tab = (typeof TABS)[number];

const S = {
  panel: {
    background: "rgba(0,0,0,0.7)",
    color: "#c8c8b4",
    fontFamily: "monospace",
    fontSize: 12,
    padding: 16,
    minHeight: 400,
  } as React.CSSProperties,
  tabBar: {
    display: "flex",
    gap: 2,
    marginBottom: 16,
    borderBottom: "1px solid rgba(255,71,0,0.3)",
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    background: active ? "#FF4700" : "rgba(255,71,0,0.1)",
    color: active ? "#000" : "#FF4700",
    border: "1px solid #FF4700",
    borderBottom: active ? "1px solid #FF4700" : "1px solid transparent",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: active ? 700 : 400,
    borderRadius: 0,
    letterSpacing: 1,
  }),
  pill: (active: boolean): React.CSSProperties => ({
    padding: "3px 10px",
    background: active ? "rgba(255,71,0,0.3)" : "transparent",
    color: active ? "#FF4700" : "rgba(180,180,160,0.6)",
    border: `1px solid ${active ? "#FF4700" : "rgba(180,180,160,0.3)"}`,
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 11,
    borderRadius: 0,
    marginRight: 4,
  }),
  statRow: {
    display: "flex",
    gap: 20,
    marginBottom: 12,
    color: "rgba(180,180,160,0.6)",
    fontSize: 11,
  } as React.CSSProperties,
  statVal: { color: "#c8c8b4", fontWeight: 700 } as React.CSSProperties,
  row: {
    display: "grid",
    gridTemplateColumns: "140px 80px minmax(0,1fr) 40px minmax(0,1fr) 90px 100px",
    alignItems: "center",
    gap: "0 8px",
    padding: "5px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    background: color,
    color: "#000",
    padding: "1px 6px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    borderRadius: 0,
    flexShrink: 0,
  }),
  muted: { color: "rgba(180,180,160,0.6)", fontSize: 11 } as React.CSSProperties,
  loading: { color: "rgba(180,180,160,0.5)", padding: 16, textAlign: "center" as const },
  empty: { color: "rgba(180,180,160,0.4)", padding: 24, textAlign: "center" as const },
  warn: {
    background: "rgba(255,71,0,0.15)",
    border: "1px solid #FF4700",
    color: "#FF4700",
    padding: "6px 12px",
    marginBottom: 10,
    fontSize: 11,
  } as React.CSSProperties,
  input: {
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,71,0,0.4)",
    color: "#c8c8b4",
    fontFamily: "monospace",
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 0,
    outline: "none",
    width: "100%",
    marginBottom: 10,
    boxSizing: "border-box" as const,
  },
  sectionHead: {
    color: "#FF4700",
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 12,
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
};

// ── KILL FEED TAB ─────────────────────────────────────────────────────────────

type KillFilter = "ALL" | "SHIP" | "STRUCTURE";

function KillFeedTab({
  kills,
  charMap,
  sysMap,
  loading,
}: {
  kills: any[];
  charMap: Map<string, string>;
  sysMap: Map<string, string>;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<KillFilter>("ALL");
  const [nameSearch, setNameSearch] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...kills].sort(
      (a, b) =>
        parseInt(b.kill_timestamp, 10) - parseInt(a.kill_timestamp, 10)
    );
    let list = filter === "ALL" ? sorted : sorted.filter((k) => k.loss_type?.["@variant"] === filter);
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      list = list.filter(k => {
        const killer = (charMap.get(k.killer_id?.item_id ?? "") ?? "").toLowerCase();
        const victim = (charMap.get(k.victim_id?.item_id ?? "") ?? "").toLowerCase();
        const sys = (sysMap.get(k.solar_system_id?.item_id ?? "") ?? "").toLowerCase();
        return killer.includes(q) || victim.includes(q) || sys.includes(q)
          || (k.killer_id?.item_id ?? "").includes(q)
          || (k.victim_id?.item_id ?? "").includes(q);
      });
    }
    return list;
  }, [kills, filter, nameSearch, charMap, sysMap]);

  const shipCount = useMemo(
    () => kills.filter((k) => k.loss_type?.["@variant"] === "SHIP").length,
    [kills]
  );
  const structCount = useMemo(
    () => kills.filter((k) => k.loss_type?.["@variant"] === "STRUCTURE").length,
    [kills]
  );

  const resolveName = (charId: string) =>
    charMap.get(charId) || `char#${charId}`;

  if (loading) return <div style={S.loading}>[ fetching kill feed... ]</div>;

  return (
    <div>
      <div style={S.statRow}>
        <span>
          <span style={S.statVal}>{kills.length}</span> kills
        </span>
        <span>
          <span style={S.statVal}>{shipCount}</span> ship
        </span>
        <span>
          <span style={S.statVal}>{structCount}</span> structure
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        {(["ALL", "SHIP", "STRUCTURE"] as KillFilter[]).map((f) => (
          <button
            key={f}
            style={S.pill(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <input
          style={{ ...S.input, flex: 1, minWidth: 140, marginBottom: 0 }}
          placeholder="Filter by name, system, or ID..."
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No kills recorded on-chain yet</div>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 80px minmax(0,1fr) 40px minmax(0,1fr) 90px 100px", gap: "0 8px", padding: "3px 8px 5px", borderBottom: "1px solid rgba(255,255,255,0.12)", marginBottom: 2 }}>
            {["TIME", "TYPE", "KILLER", "", "VICTIM", "LOCATION", "TX"].map((h, i) => (
              <span key={i} style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: "0.12em", fontWeight: 700 }}>{h}</span>
            ))}
          </div>
          {filtered.map((k) => {
            const killerId = k.killer_id?.item_id ?? "";
            const victimId = k.victim_id?.item_id ?? "";
            const sysId = k.solar_system_id?.item_id ?? "";
            const lossType: string = k.loss_type?.["@variant"] ?? "UNKNOWN";
            const badgeColor = lossType === "SHIP" ? "#FF4700" : "#ff4444";
            return (
              <div key={k.objectId} style={S.row}>
                <span style={S.muted}>{formatTimestamp(k.kill_timestamp)}</span>
                <span style={S.badge(badgeColor)}>{lossType}</span>
                <span style={{ color: "#00ff96" }}>
                  {resolveName(killerId)}
                </span>
                <span style={S.muted}>killed</span>
                <span style={{ color: "#ff4444" }}>
                  {resolveName(victimId)}
                </span>
                <span style={{ color: "rgba(100,180,255,0.7)", fontSize: "12px" }}>{sysMap.get(sysId) || `sys-${sysId}`}</span>
                <span
                  style={{
                    ...S.muted,
                    cursor: "pointer",
                    textDecoration: "underline",
                    marginLeft: "auto",
                  }}
                  title={k.objectId}
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(k.objectId);
                    } catch {}
                  }}
                >
                  {truncateAddr(k.objectId)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── INFRASTRUCTURE TAB (aggregate dashboard) ─────────────────────────────────

// ── Fetch all LocationRevealedEvents — gives us every publicly exposed assembly + system ──────────

interface ExposedAssembly {
  assemblyId: string;   // Sui object ID of the assembly
  solarSystemId: number;
  solarSystemName?: string;
  // Enriched from node list
  nodeData?: any;
  ownerCharId?: string;
  ownerName?: string;
  // Direct on-chain status (resolved during fetch)
  isOnlineChain?: boolean | null;
  assemblyTypeId?: string;
  assemblyItemId?: string;  // key.item_id from the assembly object
  // On-chain metadata.name (works for any structure type — NetworkNode,
  // StorageUnit, Assembly). Previously the panel only read names from
  // the NetworkNode list, so SSUs / mini-SSUs / non-node structures all
  // rendered as 'unnamed' even when they had real on-chain names.
  assemblyName?: string;
  // Move type tag short form (e.g., "StorageUnit", "NetworkNode",
  // "Assembly") for display.
  assemblyKind?: string;
}

async function fetchExposedAssemblies(): Promise<ExposedAssembly[]> {
  // Step 1: collect all LocationRevealedEvents (sequential pagination,
  // one request at a time — cursor depends on previous response).
  const results: ExposedAssembly[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const res = await rpcFetchWithRetry(SUI_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${WORLD_PKG}::location::LocationRevealedEvent` }, cursor, 100, false],
      }),
    });
    const json = await res.json() as {
      result: { data: Array<{ parsedJson: { assembly_id: string; solarsystem: string | number } }>; hasNextPage: boolean; nextCursor: string | null; };
    };
    for (const e of json.result.data) {
      const aId = e.parsedJson.assembly_id;
      const sysId = Number(e.parsedJson.solarsystem);
      if (aId && sysId && !isNaN(sysId) && !seen.has(aId)) {
        seen.add(aId);
        results.push({ assemblyId: aId, solarSystemId: sysId });
      }
    }
    cursor = json.result.hasNextPage ? json.result.nextCursor : null;
  } while (cursor);

  // Step 2: fetch each assembly object individually. Sui RPC doesn't
  // support batch reads, so we have to fan out — but bare `Promise.all`
  // floods the public testnet endpoint and produces silent 429 cascades
  // (the prior version returned mostly empty fields, which is why ~99%
  // of structures rendered as 'unnamed OFF' even though they had real
  // names and statuses on-chain). Use rpcPMap concurrency=3 + retry +
  // 8s timeout per attempt.
  const ownerCapMap = new Map<string, string>(); // assemblyId → owner_cap_id
  let assemblyFailures = 0;
  await rpcPMap(results, async (entry) => {
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [entry.assemblyId, { showContent: true }] }),
      });
      const json = await res.json() as { result: { data?: { type?: string; content?: { fields?: { owner_cap_id?: string; type_id?: string; status?: any; metadata?: any } } } } };
      const data = json?.result?.data;
      const fields = data?.content?.fields as any;
      const capId = fields?.owner_cap_id;
      if (capId) { ownerCapMap.set(entry.assemblyId, capId); }
      if (fields?.type_id) entry.assemblyTypeId = fields.type_id;
      // Get the assembly's own item_id for the dApp link
      const itemId = fields?.key?.fields?.item_id ?? fields?.key?.item_id;
      if (itemId) entry.assemblyItemId = String(itemId);
      // Read on-chain metadata.name. Sui returns metadata as either a
      // direct field or wrapped in `{ fields: { name: ... } }` depending
      // on whether the struct is a Move struct vs a generic object
      // result. Try both shapes.
      const meta = fields?.metadata;
      const metaName: string | undefined =
        (meta && typeof meta === "object" && "fields" in meta && (meta as any).fields?.name) ||
        (meta && typeof meta === "object" && (meta as any).name) ||
        undefined;
      if (metaName && typeof metaName === "string" && metaName.length > 0) {
        entry.assemblyName = metaName;
      }
      // Derive a short kind from the Move type tag for display.
      const t = data?.type ?? "";
      if (t.includes("::storage_unit::StorageUnit")) entry.assemblyKind = "StorageUnit";
      else if (t.includes("::network_node::NetworkNode")) entry.assemblyKind = "NetworkNode";
      else if (t.includes("::assembly::")) entry.assemblyKind = "Assembly";
      else if (t.includes("::turret::")) entry.assemblyKind = "Turret";
      else if (t.includes("::gate::")) entry.assemblyKind = "Gate";
      const sf = fields?.status as any;
      const variant =
        sf?.fields?.status?.variant ??     // StorageUnit/Assembly format
        sf?.status?.["@variant"] ??          // NetworkNode format
        null;
      entry.isOnlineChain = variant !== null ? variant === "ONLINE" : null;
    } catch {
      assemblyFailures++;
    }
  }, 3);
  if (assemblyFailures > 0) {
    console.warn(`[exposed-fetch] ${assemblyFailures}/${results.length} assembly reads failed after retries`);
  }

  // Step 3: fetch each OwnerCap individually to find its owner
  const capIds = [...ownerCapMap.values()];
  const capOwnerMap = new Map<string, string>();
  let capFailures = 0;
  await rpcPMap(capIds, async (capId) => {
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"sui_getObject", params:[capId, {showOwner:true}] }),
      });
      const json = await res.json() as { result: { data?: { owner?: { AddressOwner?: string } } } };
      const owner = json?.result?.data?.owner?.AddressOwner;
      if (owner) capOwnerMap.set(capId, owner);
    } catch {
      capFailures++;
    }
  }, 3);
  if (capFailures > 0) {
    console.warn(`[exposed-fetch] ${capFailures}/${capIds.length} owner-cap reads failed after retries`);
  }

  // Step 4: fetch Character objects individually to get key.item_id
  const charAddresses = [...new Set(capOwnerMap.values())];
  const charItemIdMap = new Map<string, string>();
  let charFailures = 0;
  await rpcPMap(charAddresses, async (addr) => {
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"sui_getObject", params:[addr, {showContent:true}] }),
      });
      const json = await res.json() as { result: { data?: { content?: { fields?: { key?: { fields?: { item_id?: string } } } } } } };
      const itemId = json?.result?.data?.content?.fields?.key?.fields?.item_id;
      if (itemId) charItemIdMap.set(addr, itemId);
    } catch {
      charFailures++;
    }
  }, 3);
  if (charFailures > 0) {
    console.warn(`[exposed-fetch] ${charFailures}/${charAddresses.length} character reads failed after retries`);
  }

  // Enrich results with ownerCharId
  for (const r of results) {
    const capId = ownerCapMap.get(r.assemblyId);
    if (capId) {
      const charAddr = capOwnerMap.get(capId);
      if (charAddr) {
        r.ownerCharId = charItemIdMap.get(charAddr) ?? charAddr;
      }
    }
  }

  return results;
}

type InfraView = "NODES" | "EXPOSED";

const isOnline = (n: any) => n.status?.status?.["@variant"] === "ONLINE";
const fuelQty = (n: any) => parseInt(n.fuel?.quantity ?? "0", 10);
const fuelMax = (n: any) => parseInt(n.fuel?.max_capacity ?? "100000", 10);
const fuelPct = (n: any) => { const m = fuelMax(n); return m > 0 ? fuelQty(n) / m : 0; };
const connCount = (n: any) => Array.isArray(n.connected_assembly_ids) ? n.connected_assembly_ids.length : 0;
const nodeName = (n: any) => (n.metadata?.name && n.metadata.name !== "") ? n.metadata.name : `Node #${n.key?.item_id ?? n.objectId}`;


function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "#ddd", fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── NODES VIEW COMPONENT (with filters) ──────────────────────────────────────

type NodeStatusFilter = "ALL" | "ONLINE" | "OFFLINE";
type NodeFuelFilter   = "ALL" | "HAS_FUEL" | "LOW_FUEL";

function NodesView({ nodes, charMap, sysMap, nodeSystemMap }: {
  nodes: any[];
  charMap: Map<string, string>;
  sysMap: Map<string, string>;
  nodeSystemMap: Map<string, string>;
}) {
  const [statusFilter, setStatusFilter] = useState<NodeStatusFilter>("ALL");
  const [fuelFilter, setFuelFilter]     = useState<NodeFuelFilter>("ALL");
  const [search, setSearch]             = useState("");

  const filtered = useMemo(() => {
    let list = [...nodes];
    if (statusFilter === "ONLINE")  list = list.filter(n => isOnline(n));
    if (statusFilter === "OFFLINE") list = list.filter(n => !isOnline(n));
    if (fuelFilter === "HAS_FUEL")  list = list.filter(n => fuelMax(n) > 0 && fuelPct(n) >= 0.1);
    if (fuelFilter === "LOW_FUEL")  list = list.filter(n => fuelMax(n) > 0 && fuelPct(n) < 0.1);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => {
        const name = nodeName(n).toLowerCase();
        const itemId = String(n.key?.item_id ?? "").toLowerCase();
        const objId = String(n.objectId ?? "").toLowerCase();
        return name.includes(q) || itemId.includes(q) || objId.includes(q);
      });
    }
    return list.sort((a, b) => {
      const aOn = isOnline(a) ? 0 : 1;
      const bOn = isOnline(b) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return fuelPct(a) - fuelPct(b);
    });
  }, [nodes, statusFilter, fuelFilter, search]);

  return (
    <div>
      {/* Filter controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["ALL", "ONLINE", "OFFLINE"] as NodeStatusFilter[]).map(f => (
            <button key={f} style={S.pill(statusFilter === f)} onClick={() => setStatusFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {([["ALL", "ALL FUEL"], ["HAS_FUEL", "HAS FUEL"], ["LOW_FUEL", "LOW FUEL"]] as [NodeFuelFilter, string][]).map(([f, label]) => (
            <button key={f} style={S.pill(fuelFilter === f)} onClick={() => setFuelFilter(f)}>{label}</button>
          ))}
        </div>
        <input
          style={{ ...S.input, flex: 1, minWidth: 140, marginBottom: 0 }}
          placeholder="Search name or node ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
        {filtered.length} / {nodes.length} nodes — {nodes.filter(isOnline).length} online · {nodes.filter(n => !isOnline(n)).length} offline
      </div>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "8px 1fr 120px 90px 70px 80px 60px", gap: "0 8px", padding: "4px 6px", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2 }}>
        <div />
        <div>NAME / ITEM ID</div>
        <div>OWNER</div>
        <div>SYSTEM</div>
        <div>FUEL</div>
        <div>CONNECTED</div>
        <div>STATUS</div>
      </div>
      {filtered.map(n => {
        const pct     = fuelPct(n);
        const online  = isOnline(n);
        const itemId  = n.key?.item_id ?? "";
        const ownerId = n.owner_character_id?.item_id ?? "";
        const ownerName = ownerId ? (charMap.get(ownerId) ?? `#${ownerId}`) : "—";
        const sysItemId = nodeSystemMap.get(itemId) ?? "";
        const sysName   = sysItemId ? (sysMap.get(sysItemId) ?? `sys-${sysItemId}`) : "—";
        const fuelColor = pct === 0 ? "#ff4444" : pct < 0.02 ? "#ff4444" : pct < 0.1 ? "#ffd700" : pct < 0.3 ? "#ffaa00" : "#00ff96";
        const dappUrl = itemId ? `https://${SERVER_ENV === 'stillness' ? 'dapps' : 'uat.dapps'}.evefrontier.com/?itemId=${itemId}&tenant=${SERVER_ENV}` : null;
        return (
          <div key={n.objectId} style={{
            display: "grid", gridTemplateColumns: "8px 1fr 120px 90px 70px 80px 60px",
            gap: "0 8px", padding: "5px 6px", fontSize: 11,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            alignItems: "center",
            background: online ? "transparent" : "rgba(255,68,68,0.02)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#00ff96" : "#ff4444", boxShadow: online ? "0 0 4px #00ff9660" : "none" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.objectId}>
                {nodeName(n)}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                {dappUrl
                  ? <a href={dappUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(100,180,255,0.6)", textDecoration: "none" }}>#{itemId}</a>
                  : `#${itemId}`
                }
              </div>
            </div>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: "rgba(200,200,184,0.8)" }} title={ownerId}>
              {ownerName}
            </div>
            <div style={{ fontSize: 10, color: sysName === "—" ? "rgba(255,255,255,0.2)" : "rgba(100,180,255,0.8)" }}>
              {sysName}
            </div>
            <div style={{ fontSize: 10, color: fuelColor }}>
              {fuelMax(n) > 0 ? `${(pct * 100).toFixed(0)}%` : "—"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              {connCount(n)} structures
            </div>
            <div>
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: online ? "rgba(0,255,150,0.12)" : "rgba(255,68,68,0.12)", color: online ? "#00ff96" : "#ff6666", letterSpacing: "0.06em" }}>
                {online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <div style={S.muted}>No nodes match filters</div>}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
        System location derived from killmail records — nodes never killed show "—"
      </div>
    </div>
  );
}

function InfraTab({ nodes, charMap, kills, sysMap, loading }: { nodes: any[]; charMap: Map<string, string>; kills: any[]; sysMap: Map<string, string>; loading: boolean }) {
  const [exposed, setExposed] = React.useState<ExposedAssembly[]>([]);
  const [exposedLoading, setExposedLoading] = React.useState(false);

  // Build a quick lookup: assemblyId → node data from our node list
  const nodeByObjId = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const n of nodes) m.set(n.objectId, n);
    return m;
  }, [nodes]);
  const [view, setView] = useState<InfraView>("NODES");

  // ── Aggregate stats ──
  // Cross-reference node item_ids against killmail solar_system_ids for location intel
  const nodeSystemMap = useMemo(() => {
    const m = new Map<string, string>(); // item_id → system item_id
    for (const k of kills) {
      const sysId = k.solar_system_id?.item_id ?? "";
      const victimId = k.victim_id?.item_id ?? "";
      if (sysId && victimId) m.set(victimId, sysId);
      // Also check if killer's structure is associated
    }
    return m;
  }, [kills]);

  const stats = useMemo(() => {
    const online = nodes.filter(isOnline).length;
    const offline = nodes.length - online;
    const critical = nodes.filter(n => fuelPct(n) < 0.02 && fuelMax(n) > 0).length;
    const lowFuel = nodes.filter(n => fuelPct(n) < 0.1 && fuelPct(n) >= 0.02 && fuelMax(n) > 0).length;
    const totalFuel = nodes.reduce((s, n) => s + fuelQty(n), 0);
    const totalFuelMax = nodes.reduce((s, n) => s + fuelMax(n), 0);
    const totalConns = nodes.reduce((s, n) => s + connCount(n), 0);
    const totalEnergy = nodes.reduce((s, n) => s + parseInt(n.energy_source?.current_energy_production ?? "0", 10), 0);
    const burning = nodes.filter(n => n.fuel?.is_burning).length;
    // Unique owners
    const owners = new Set(nodes.map(n => n.owner_character_id?.item_id ?? "unknown"));
    return { online, offline, critical, lowFuel, totalFuel, totalFuelMax, totalConns, totalEnergy, burning, ownerCount: owners.size };
  }, [nodes]);

  if (loading) return <div style={S.loading}>[ scanning infrastructure lattice... ]</div>;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ── Main column (NODES / EXPOSED) ── */}
      <div style={{ flex: "1 1 600px", minWidth: 0 }}>
        {/* View tabs */}
        <div style={{ marginBottom: 10 }}>
          {(["NODES", "EXPOSED"] as InfraView[]).map(v => (
            <button key={v} style={S.pill(view === v)} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>

        {view === "NODES" && (
          <NodesView nodes={nodes} charMap={charMap} sysMap={sysMap} nodeSystemMap={nodeSystemMap} />
        )}
      {view === "EXPOSED" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
              Structures that have revealed their location on-chain via LocationRevealedEvent
            </div>
            <button
              onClick={async () => {
                setExposedLoading(true);
                try {
                  const raw = await fetchExposedAssemblies();
                  // Resolve system names + cross-reference with node data
                  const sysIds = [...new Set(raw.map(e => String(e.solarSystemId)))];
                  const sysNames = await resolveSolarSystemNames(sysIds);
                  const enriched = raw.map(e => {
                    // Owner from NetworkNode cross-ref (fast path)
                    const nodeCharId = nodeByObjId.get(e.assemblyId)?.owner_character_id?.item_id;
                    // Owner from assembled chain walk (ownerCharId set during fetchExposedAssemblies)
                    const resolvedCharId = nodeCharId ?? e.ownerCharId ?? null;
                    return {
                      ...e,
                      solarSystemName: sysNames.get(String(e.solarSystemId)) ?? `sys-${e.solarSystemId}`,
                      nodeData: nodeByObjId.get(e.assemblyId),
                      ownerCharId: resolvedCharId ?? undefined,
                      ownerName: resolvedCharId
                        ? (charMap.get(resolvedCharId) ?? `#${resolvedCharId}`)
                        : "—",
                    };
                  });
                  enriched.sort((a, b) => a.solarSystemId - b.solarSystemId);
                  setExposed(enriched);
                } catch { /* silent */ }
                setExposedLoading(false);
              }}
              style={{ padding: "3px 10px", fontSize: 10, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.08em", background: "rgba(100,180,255,0.08)", border: "1px solid rgba(100,180,255,0.25)", color: "rgba(100,180,255,0.8)", cursor: "pointer", borderRadius: 2, whiteSpace: "nowrap" }}
            >
              {exposedLoading ? "LOADING…" : "↻ FETCH EXPOSED"}
            </button>
          </div>

          {exposed.length > 0 && (() => {
            // Group by system
            const bySystem = new Map<string, ExposedAssembly[]>();
            for (const e of exposed) {
              const key = e.solarSystemName ?? `sys-${e.solarSystemId}`;
              if (!bySystem.has(key)) bySystem.set(key, []);
              bySystem.get(key)!.push(e);
            }
            const systems = [...bySystem.entries()].sort((a, b) => b[1].length - a[1].length);
            return (
              <>
                <div style={{ fontSize: 10, color: "rgba(100,180,255,0.6)", marginBottom: 6 }}>
                  {exposed.length} structures across {systems.length} systems
                </div>
                <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
                  {systems.map(([sysName, entries]) => {
                    const onlineCount = entries.filter(e => {
                      const n = e.nodeData;
                      if (n) return n.status?.status?.["@variant"] === "ONLINE";
                      return e.isOnlineChain === true;
                    }).length;
                    return (
                      <div key={sysName} style={{ marginBottom: 10 }}>
                        {/* System header */}
                        <div style={{ padding: "4px 8px", background: "rgba(100,180,255,0.07)", borderLeft: "2px solid rgba(100,180,255,0.4)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(100,180,255,0.9)", letterSpacing: "0.06em" }}>{sysName}</span>
                          <span style={{ fontSize: 10, color: "rgba(100,180,255,0.5)" }}>
                            {entries.length} · <span style={{ color: "#00ff96" }}>{onlineCount} online</span>
                          </span>
                        </div>
                        {entries.map(e => {
                          const n = e.nodeData;
                          // Use nodeData status (NetworkNode) or direct chain status (Assembly/SSU)
                          const online: boolean | null = n
                            ? n.status?.status?.["@variant"] === "ONLINE"
                            : e.isOnlineChain ?? null;
                          // Prefer the assembly's own on-chain metadata.name (works
                          // for SSUs / mini-SSUs / Assemblies / Turrets), fall back
                          // to the NetworkNode list entry's name (legacy path), then
                          // null → 'unnamed'.
                          const name =
                            (e.assemblyName && e.assemblyName !== "" ? e.assemblyName : null) ??
                            (n?.metadata?.name && n.metadata.name !== "" ? n.metadata.name : null);
                          // Use the assembly's own item_id (fetched during EXPOSED load), not the nodeData's key
                          const itemId = e.assemblyItemId ?? n?.key?.item_id;
                          const dappUrl = itemId ? `https://${SERVER_ENV === 'stillness' ? 'dapps' : 'uat.dapps'}.evefrontier.com/?itemId=${itemId}&tenant=${SERVER_ENV}` : null;
                          return (
                            <div key={e.assemblyId} style={{ display: "grid", gridTemplateColumns: "6px minmax(0,1fr) minmax(0,1fr) 58px", gap: "0 6px", padding: "4px 8px 4px 18px", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: online === true ? "#00ff96" : online === false ? "#ff4444" : "rgba(255,255,255,0.15)" }} />
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: name ? 600 : 400, color: name ? "inherit" : "rgba(255,255,255,0.35)" }}>
                                {name ?? "unnamed"}
                                {dappUrl && <a href={dappUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(100,180,255,0.4)", textDecoration: "none", fontSize: 9, marginLeft: 5 }}>#{itemId}</a>}
                              </div>
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: e.ownerName && e.ownerName !== "—" ? "rgba(255,200,0,0.8)" : "rgba(255,255,255,0.2)" }}>
                                {e.ownerName && e.ownerName !== "—" ? e.ownerName : "—"}
                              </div>
                              <div style={{ textAlign: "right" }}>
                                {online !== null && (
                                  <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: online ? "rgba(0,255,150,0.1)" : "rgba(255,68,68,0.1)", color: online ? "#00ff96" : "#ff6666" }}>
                                    {online ? "ON" : "OFF"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
          {!exposedLoading && exposed.length === 0 && (
            <div style={S.muted}>Click FETCH EXPOSED to load on-chain location data</div>
          )}
        </div>
      )}
      </div>

      {/* ── Right rail: OVERVIEW (always visible) ── */}
      <aside style={{ flex: "0 0 220px", minWidth: 220, maxWidth: 260 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(100,180,255,0.7)", marginBottom: 8, padding: "3px 8px", borderLeft: "2px solid rgba(100,180,255,0.4)", background: "rgba(100,180,255,0.04)" }}>
          OVERVIEW
        </div>
        {stats.critical > 0 && <div style={S.warn}>⚠ {stats.critical} nodes critically low on fuel</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          <StatCard label="Online" value={stats.online} color="#00ff96" />
          <StatCard label="Offline" value={stats.offline} color={stats.offline > 0 ? "#ff4444" : "#666"} />
          <StatCard label="Total Nodes" value={nodes.length} />
          <StatCard label="Owners" value={stats.ownerCount} color="rgba(100,180,255,0.8)" />
          <StatCard label="Structures Connected" value={stats.totalConns.toLocaleString()} sub={`across ${nodes.length} nodes`} />
          <StatCard label="Total Energy" value={`${stats.totalEnergy.toLocaleString()} EP`} />
          <StatCard label="Fuel Burning" value={stats.burning} color={stats.burning > 0 ? "#FF4700" : "#666"} />
          <StatCard label="Global Fuel" value={stats.totalFuelMax > 0 ? `${((stats.totalFuel / stats.totalFuelMax) * 100).toFixed(1)}%` : "—"} color={stats.totalFuel / (stats.totalFuelMax || 1) > 0.3 ? "#00ff96" : "#ffd700"} sub={`${stats.totalFuel.toLocaleString()} / ${stats.totalFuelMax.toLocaleString()}`} />
        </div>
      </aside>
    </div>
  );
}

// ── SECURITY TAB ──────────────────────────────────────────────────────────────

function SecurityTab({
  kills,
  nodes,
  charMap,
  sysMap,
  loading,
}: {
  kills: any[];
  nodes: any[];
  charMap: Map<string, string>;
  sysMap: Map<string, string>;
  loading: boolean;
}) {
  const topKillers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kills) {
      const id = k.killer_id?.item_id ?? "";
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [kills]);

  const topVictims = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kills) {
      const id = k.victim_id?.item_id ?? "";
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [kills]);

  // System activity heatmap: top systems × recent days
  const heatmapData = useMemo(() => {
    // Count kills per system
    const sysCounts = new Map<string, number>();
    for (const k of kills) {
      const id = k.solar_system_id?.item_id ?? "";
      if (id) sysCounts.set(id, (sysCounts.get(id) ?? 0) + 1);
    }
    // Top 10 systems
    const topSysIds = [...sysCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);

    // Determine date range from kills
    let minTs = Infinity, maxTs = 0;
    for (const k of kills) {
      const ts = parseInt(k.kill_timestamp, 10);
      if (!isNaN(ts) && ts > 0) {
        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
      }
    }
    // Build day columns — last 14 days or full range, whichever is smaller
    const now = Math.floor(Date.now() / 1000);
    const dayLen = 86400;
    const endDay = Math.floor(now / dayLen);
    const startDay = Math.max(Math.floor(minTs / dayLen), endDay - 29); // max 30 days
    const numDays = endDay - startDay + 1;
    const dayLabels: string[] = [];
    for (let d = startDay; d <= endDay; d++) {
      const date = new Date(d * dayLen * 1000);
      dayLabels.push(`${date.getUTCDate()}`);
    }

    // Build grid: system → dayIndex → count
    const grid = new Map<string, number[]>();
    for (const sysId of topSysIds) {
      grid.set(sysId, new Array(numDays).fill(0));
    }
    for (const k of kills) {
      const sysId = k.solar_system_id?.item_id ?? "";
      const row = grid.get(sysId);
      if (!row) continue;
      const ts = parseInt(k.kill_timestamp, 10);
      if (isNaN(ts)) continue;
      const dayIdx = Math.floor(ts / dayLen) - startDay;
      if (dayIdx >= 0 && dayIdx < numDays) row[dayIdx]++;
    }
    // Find max cell for color scaling
    let maxCell = 1;
    for (const row of grid.values()) {
      for (const v of row) if (v > maxCell) maxCell = v;
    }
    return { topSysIds, grid, maxCell, sysCounts, dayLabels, numDays };
  }, [kills]);

  // 24h heatmap — top systems by hour in last 24 hours
  const heatmap24hData = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const hourLen = 3600;
    const windowStart = now - 24 * hourLen;

    // Filter kills to last 24h
    const recentKills = kills.filter(k => {
      const ts = parseInt(k.kill_timestamp, 10);
      return !isNaN(ts) && ts >= windowStart;
    });

    if (recentKills.length === 0) return null;

    // Count per system in last 24h
    const sysCounts = new Map<string, number>();
    for (const k of recentKills) {
      const id = k.solar_system_id?.item_id ?? "";
      if (id) sysCounts.set(id, (sysCounts.get(id) ?? 0) + 1);
    }
    const topSysIds = [...sysCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);

    // 24 hour columns
    const numHours = 24;
    const startHour = Math.floor(windowStart / hourLen);
    const hourLabels: string[] = [];
    for (let h = 0; h < numHours; h++) {
      const hourOfDay = (startHour + h) % 24;
      hourLabels.push(hourOfDay % 6 === 0 ? `${hourOfDay}` : "");
    }

    // Build grid
    const grid = new Map<string, number[]>();
    for (const sysId of topSysIds) grid.set(sysId, new Array(numHours).fill(0));
    for (const k of recentKills) {
      const sysId = k.solar_system_id?.item_id ?? "";
      const row = grid.get(sysId);
      if (!row) continue;
      const ts = parseInt(k.kill_timestamp, 10);
      if (isNaN(ts)) continue;
      const hourIdx = Math.floor(ts / hourLen) - startHour;
      if (hourIdx >= 0 && hourIdx < numHours) row[hourIdx]++;
    }
    let maxCell = 1;
    for (const row of grid.values()) for (const v of row) if (v > maxCell) maxCell = v;

    return { topSysIds, grid, maxCell, sysCounts, hourLabels, totalKills: recentKills.length };
  }, [kills]);

  const isOnline = (n: any) => n.status?.status?.["@variant"] === "ONLINE";
  const onlinePct =
    nodes.length > 0
      ? Math.round((nodes.filter(isOnline).length / nodes.length) * 100)
      : 0;
  const lowFuelCount = nodes.filter(
    (n) => { const q = parseInt(n.fuel?.quantity ?? "0", 10); const m = parseInt(n.fuel?.max_capacity ?? "100000", 10); return m > 0 && q / m < 0.05; }
  ).length;

  if (loading) return <div style={S.loading}>[ computing security overview... ]</div>;

  const resolveName = (id: string) => charMap.get(id) || `char#${id}`;

  return (
    <div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Top Killers */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={S.sectionHead}>TOP KILLERS</div>
          {topKillers.length === 0 ? (
            <div style={S.muted}>No data</div>
          ) : (
            topKillers.map(([id, count], i) => (
              <div key={id} style={{ ...S.row, padding: "4px 0" }}>
                <span style={{ color: "#FF4700", minWidth: 16 }}>#{i + 1}</span>
                <span style={{ flex: 1 }}>{resolveName(id)}</span>
                <span style={S.badge("#FF4700")}>{count}</span>
              </div>
            ))
          )}
        </div>

        {/* Top Victims */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={S.sectionHead}>TOP VICTIMS</div>
          {topVictims.length === 0 ? (
            <div style={S.muted}>No data</div>
          ) : (
            topVictims.map(([id, count], i) => (
              <div key={id} style={{ ...S.row, padding: "4px 0" }}>
                <span style={{ color: "#ff4444", minWidth: 16 }}>#{i + 1}</span>
                <span style={{ flex: 1 }}>{resolveName(id)}</span>
                <span style={S.badge("#ff4444")}>{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Activity Heatmaps — side by side */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

        {/* 30-day heatmap */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div style={S.sectionHead}>SYSTEM ACTIVITY — 30-DAY</div>
          {heatmapData.topSysIds.length === 0 ? (
            <div style={S.muted}>No data</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", marginLeft: 80, marginBottom: 2 }}>
                {heatmapData.dayLabels.map((label, i) => (
                  <div key={i} style={{ width: 14, fontSize: 8, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{label}</div>
                ))}
                <div style={{ width: 32, fontSize: 9, color: "rgba(255,255,255,0.4)", textAlign: "right", paddingLeft: 4 }}>tot</div>
              </div>
              {heatmapData.topSysIds.map(sysId => {
                const row = heatmapData.grid.get(sysId) ?? [];
                const total = heatmapData.sysCounts.get(sysId) ?? 0;
                const name = sysMap.get(sysId) ?? `sys-${sysId}`;
                return (
                  <div key={sysId} style={{ display: "flex", alignItems: "center", marginBottom: 1 }}>
                    <span style={{ width: 80, fontSize: 10, color: "rgba(100,180,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={`${name} (${sysId})`}>{name}</span>
                    {row.map((count, d) => {
                      const bg = count === 0 ? "rgba(255,255,255,0.03)" : `rgba(255,71,0,${0.15 + (count / heatmapData.maxCell) * 0.85})`;
                      return <div key={d} title={`${name} on ${heatmapData.dayLabels[d]} — ${count} kills`} style={{ width: 14, height: 13, background: bg, border: "1px solid rgba(0,0,0,0.2)" }} />;
                    })}
                    <span style={{ width: 32, fontSize: 10, color: "#FF4700", textAlign: "right", fontWeight: 600, paddingLeft: 4 }}>{total}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginLeft: 80 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>0</span>
                {[0.15, 0.35, 0.55, 0.75, 1.0].map((v, i) => <div key={i} style={{ width: 12, height: 7, background: `rgba(255,71,0,${0.15 + v * 0.85})` }} />)}
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{heatmapData.maxCell}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: 6 }}>kills/day</span>
              </div>
            </div>
          )}
        </div>

        {/* 24h heatmap */}
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={S.sectionHead}>LAST 24H — BY HOUR{heatmap24hData ? ` (${heatmap24hData.totalKills} kills)` : ""}</div>
          {!heatmap24hData ? (
            <div style={S.muted}>No kills in last 24h</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", marginLeft: 80, marginBottom: 2 }}>
                {heatmap24hData.hourLabels.map((label, i) => (
                  <div key={i} style={{ width: 10, fontSize: 7, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{label}</div>
                ))}
                <div style={{ width: 28, fontSize: 9, color: "rgba(255,255,255,0.4)", textAlign: "right", paddingLeft: 4 }}>24h</div>
              </div>
              {heatmap24hData.topSysIds.map(sysId => {
                const row = heatmap24hData.grid.get(sysId) ?? [];
                const total = heatmap24hData.sysCounts.get(sysId) ?? 0;
                const name = sysMap.get(sysId) ?? `sys-${sysId}`;
                return (
                  <div key={sysId} style={{ display: "flex", alignItems: "center", marginBottom: 1 }}>
                    <span style={{ width: 80, fontSize: 10, color: "rgba(100,180,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={`${name} (${sysId})`}>{name}</span>
                    {row.map((count, h) => {
                      const bg = count === 0 ? "rgba(255,255,255,0.03)" : `rgba(0,255,150,${0.15 + (count / heatmap24hData.maxCell) * 0.85})`;
                      return <div key={h} title={`${name} at hour ${h} — ${count} kills`} style={{ width: 10, height: 13, background: bg, border: "1px solid rgba(0,0,0,0.2)" }} />;
                    })}
                    <span style={{ width: 28, fontSize: 10, color: "#00ff96", textAlign: "right", fontWeight: 600, paddingLeft: 4 }}>{total}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginLeft: 80 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>0</span>
                {[0.15, 0.35, 0.55, 0.75, 1.0].map((v, i) => <div key={i} style={{ width: 10, height: 7, background: `rgba(0,255,150,${0.15 + v * 0.85})` }} />)}
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{heatmap24hData.maxCell}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: 6 }}>kills/hr</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Node Health */}
      <div style={S.sectionHead}>NODE HEALTH</div>
      <div style={S.statRow}>
        <span>
          <span style={{ ...S.statVal, color: "#00ff96" }}>{onlinePct}%</span>{" "}
          online
        </span>
        <span>
          <span style={{ ...S.statVal, color: "#ffd700" }}>{lowFuelCount}</span>{" "}
          nodes low fuel
        </span>
        <span>
          <span style={S.statVal}>{nodes.length}</span> total
        </span>
      </div>
      {nodes.length > 0 && (
        <div
          style={{
            height: 14,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${onlinePct}%`,
              height: "100%",
              background: "#00ff96",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── MAIN PANEL ────────────────────────────────────────────────────────────────

export function IntelDashboardPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("KILL FEED");

  const [kills, setKills] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);

  const [sysMap, setSysMap] = useState<Map<string, string>>(new Map());
  const [killsLoading, setKillsLoading] = useState(false);
  const [_charsLoading, setCharsLoading] = useState(false);
  const [nodesLoading, setNodesLoading] = useState(false);

  const loadedKillFeed = useRef(false);
  const loadedInfra = useRef(false);

  const charMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) {
      const id = c.key?.item_id;
      const name = c.metadata?.name?.trim();
      if (id && name) m.set(id, name);
    }
    return m;
  }, [characters]);

  // Load kill feed + resolve character names via targeted derivation
  useEffect(() => {
    if (activeTab === "KILL FEED" && !loadedKillFeed.current) {
      loadedKillFeed.current = true;
      setKillsLoading(true);
      setCharsLoading(true);

      // Phase 1: load kills only (no more brute-force character fetch)
      fetchAllObjects(WORLD_PKG + "::killmail::Killmail").then(async (k) => {
        setKills(k);
        setKillsLoading(false);

        // Phase 2: collect unique character IDs from kills and resolve via address derivation
        const allCharIds = new Set<string>();
        let detectedTenant: string | undefined;
        for (const kill of k) {
          if (kill.killer_id?.item_id) allCharIds.add(kill.killer_id.item_id);
          if (kill.victim_id?.item_id) allCharIds.add(kill.victim_id.item_id);
          if (!detectedTenant && kill.killer_id?.tenant) detectedTenant = kill.killer_id.tenant;
        }

        // Targeted resolution — derive addresses, batch-fetch only needed characters
        let resolvedMap = await resolveCharactersByItemIds([...allCharIds], detectedTenant);

        // Fallback: if targeted resolution fails (0 results), use brute-force fetch
        if (resolvedMap.size === 0 && allCharIds.size > 0) {
          const allChars = await fetchAllObjects(WORLD_PKG + "::character::Character", 50, 5000);
          const fallbackMap = new Map<string, string>();
          for (const c of allChars) {
            const id = c.key?.item_id;
            const name = c.metadata?.name?.trim();
            if (id && name) fallbackMap.set(id, name);
          }
          resolvedMap = fallbackMap;
        }

        // Build character objects for charMap useMemo compatibility
        const charObjects = [...resolvedMap.entries()].map(([itemId, name]) => ({
          key: { item_id: itemId },
          metadata: { name },
        }));
        setCharacters(charObjects);
        setCharsLoading(false);

        // Phase 3: resolve solar system names from World API
        const sysIds = [...new Set(k.map((kill: any) => kill.solar_system_id?.item_id).filter(Boolean))];
        if (sysIds.length > 0) {
          resolveSolarSystemNames(sysIds).then(cache => {
            setSysMap(new Map(cache));
          });
        }
      });
    }
  }, [activeTab]);

  // Load infrastructure nodes
  useEffect(() => {
    if (activeTab === "INFRASTRUCTURE" && !loadedInfra.current) {
      loadedInfra.current = true;
      setNodesLoading(true);
      fetchAllObjects(WORLD_PKG + "::network_node::NetworkNode", 50, 5000).then((n) => {
        setNodes(n);
        setNodesLoading(false);
      });
    }
  }, [activeTab]);

  // Security tab needs kills + nodes — trigger both if not yet loaded
  useEffect(() => {
    if (activeTab === "SECURITY") {
      if (!loadedKillFeed.current) {
        loadedKillFeed.current = true;
        setKillsLoading(true);
        setCharsLoading(true);
        // Fetch kills, then resolve character names via targeted derivation
        fetchAllObjects(WORLD_PKG + "::killmail::Killmail").then(async (k) => {
          setKills(k);
          setKillsLoading(false);
          const allCharIds2 = new Set<string>();
          let detectedTenant2: string | undefined;
          for (const kill of k) {
            if (kill.killer_id?.item_id) allCharIds2.add(kill.killer_id.item_id);
            if (kill.victim_id?.item_id) allCharIds2.add(kill.victim_id.item_id);
            if (!detectedTenant2 && kill.killer_id?.tenant) detectedTenant2 = kill.killer_id.tenant;
          }
          const resolvedMap = await resolveCharactersByItemIds([...allCharIds2], detectedTenant2);
          const charObjects = [...resolvedMap.entries()].map(([itemId, name]) => ({
            key: { item_id: itemId }, metadata: { name },
          }));
          setCharacters(prev => prev.length > 0 ? prev : charObjects);
          setCharsLoading(false);
          const sysIds = [...new Set(k.map((kill: any) => kill.solar_system_id?.item_id).filter(Boolean))];
          if (sysIds.length > 0) resolveSolarSystemNames(sysIds).then(cache => setSysMap(new Map(cache)));
        });
      }
      if (!loadedInfra.current) {
        loadedInfra.current = true;
        setNodesLoading(true);
        fetchAllObjects(WORLD_PKG + "::network_node::NetworkNode", 50, 5000).then((n) => {
          setNodes(n);
          setNodesLoading(false);
        });
      }
    }
  }, [activeTab]);

  const securityLoading = killsLoading || nodesLoading;

  return (
    <div style={S.panel}>
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "KILL FEED" && (
        <KillFeedTab
          kills={kills}
          charMap={charMap}
          sysMap={sysMap}
          loading={killsLoading}
        />
      )}
      {activeTab === "INFRASTRUCTURE" && (
        <InfraTab nodes={nodes} charMap={charMap} kills={kills} sysMap={sysMap} loading={nodesLoading} />
      )}
      {activeTab === "SECURITY" && (
        <SecurityTab
          kills={kills}
          nodes={nodes}
          charMap={charMap}
          sysMap={sysMap}
          loading={securityLoading}
        />
      )}
    </div>
  );
}
