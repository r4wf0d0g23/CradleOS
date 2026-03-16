import React, { useState, useEffect, useRef, useMemo } from "react";

const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
const WORLD_PKG = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

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

async function fetchAllObjects(type: string, limit = 50): Promise<any[]> {
  const results: any[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext && results.length < 500) {
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

const TABS = ["KILL FEED", "INFRASTRUCTURE", "CHARACTERS", "SECURITY"] as const;
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
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexWrap: "wrap" as const,
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
  loading,
}: {
  kills: any[];
  charMap: Map<string, string>;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<KillFilter>("ALL");

  const filtered = useMemo(() => {
    const sorted = [...kills].sort(
      (a, b) =>
        parseInt(b.kill_timestamp, 10) - parseInt(a.kill_timestamp, 10)
    );
    if (filter === "ALL") return sorted;
    return sorted.filter((k) => k.loss_type?.["@variant"] === filter);
  }, [kills, filter]);

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
      <div style={{ marginBottom: 10 }}>
        {(["ALL", "SHIP", "STRUCTURE"] as KillFilter[]).map((f) => (
          <button
            key={f}
            style={S.pill(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No kills recorded on-chain yet</div>
      ) : (
        <div>
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
                <span style={S.muted}>sys-{sysId}</span>
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

// ── INFRASTRUCTURE TAB ────────────────────────────────────────────────────────

type NodeFilter = "ALL" | "ONLINE" | "OFFLINE" | "LOW FUEL";

function InfraTab({ nodes, loading }: { nodes: any[]; loading: boolean }) {
  const [filter, setFilter] = useState<NodeFilter>("ALL");

  const isOnline = (n: any) => n.status?.status?.["@variant"] === "ONLINE";
  const fuelQty = (n: any) => parseInt(n.fuel?.quantity ?? "0", 10);
  const fuelMax = (n: any) => parseInt(n.fuel?.max_capacity ?? "100000", 10);

  const onlineCount = useMemo(() => nodes.filter(isOnline).length, [nodes]);
  const offlineCount = nodes.length - onlineCount;
  const criticalCount = useMemo(
    () => nodes.filter((n) => fuelMax(n) > 0 && fuelQty(n) / fuelMax(n) < 0.02).length,
    [nodes]
  );

  const filtered = useMemo(() => {
    let list = [...nodes];
    if (filter === "ONLINE") list = list.filter(isOnline);
    else if (filter === "OFFLINE") list = list.filter((n) => !isOnline(n));
    else if (filter === "LOW FUEL") list = list.filter((n) => fuelMax(n) > 0 && fuelQty(n) / fuelMax(n) < 0.05);
    // sort: ONLINE first, then fuel ascending within group
    list.sort((a, b) => {
      const ao = isOnline(a) ? 0 : 1;
      const bo = isOnline(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return fuelQty(a) - fuelQty(b);
    });
    return list;
  }, [nodes, filter]);

  if (loading) return <div style={S.loading}>[ fetching infrastructure... ]</div>;

  return (
    <div>
      {criticalCount > 0 && (
        <div style={S.warn}>
          !! {criticalCount} nodes critically low on fuel
        </div>
      )}
      <div style={S.statRow}>
        <span>
          <span style={{ ...S.statVal, color: "#00ff96" }}>{onlineCount}</span>{" "}
          online
        </span>
        <span>
          <span style={{ ...S.statVal, color: "#ff4444" }}>{offlineCount}</span>{" "}
          offline
        </span>
        <span>
          <span style={S.statVal}>{nodes.length}</span> total nodes
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        {(["ALL", "ONLINE", "OFFLINE", "LOW FUEL"] as NodeFilter[]).map((f) => (
          <button
            key={f}
            style={S.pill(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No nodes match filter</div>
      ) : (
        <div>
          {filtered.map((n) => {
            const online = isOnline(n);
            const qty = fuelQty(n);
            const max = fuelMax(n);
            const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 0;
            const fuelColor =
              pct >= 50 ? "#00ff96" : pct >= 10 ? "#ffd700" : "#ff4444";
            const name =
              n.metadata?.name && n.metadata.name !== ""
                ? n.metadata.name
                : `Node #${n.key?.item_id ?? n.objectId}`;
            const curEnergy = n.energy_source?.current_energy_production ?? "0";
            const maxEnergy = n.energy_source?.max_energy_production ?? "0";
            const connCount = Array.isArray(n.connected_assembly_ids)
              ? n.connected_assembly_ids.length
              : 0;
            return (
              <div key={n.objectId} style={S.row}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: online ? "#00ff96" : "#ff4444",
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span style={{ minWidth: 100, fontWeight: 600 }}>{name}</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    flex: 1,
                    minWidth: 120,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 80,
                        height: 6,
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 0,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: fuelColor,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <span style={{ color: fuelColor, fontSize: 10 }}>
                      {qty}/{max}
                    </span>
                  </div>
                </div>
                {n.fuel?.is_burning && (
                  <span style={S.badge("#FF4700")}>burning</span>
                )}
                <span style={S.muted}>{connCount} connections</span>
                <span style={S.muted}>
                  {curEnergy}/{maxEnergy} EP
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CHARACTERS TAB ────────────────────────────────────────────────────────────

function CharactersTab({
  characters,
  loading,
}: {
  characters: any[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const named: any[] = [];
    const unnamed: any[] = [];
    for (const c of characters) {
      const hasName = c.metadata?.name && c.metadata.name.trim() !== "";
      if (hasName) named.push(c);
      else unnamed.push(c);
    }
    named.sort((a, b) =>
      (a.metadata.name || "").localeCompare(b.metadata.name || "")
    );
    return [...named, ...unnamed];
  }, [characters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (c) =>
        (c.metadata?.name || "").toLowerCase().includes(q) ||
        (c.key?.item_id || "").includes(q)
    );
  }, [sorted, search]);

  if (loading) return <div style={S.loading}>[ fetching riders... ]</div>;

  return (
    <div>
      <div style={S.statRow}>
        <span>
          <span style={S.statVal}>{characters.length}</span> riders indexed
        </span>
      </div>
      <input
        style={S.input}
        placeholder="Search by name or character ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <div style={S.empty}>No characters found</div>
      ) : (
        <div>
          {filtered.map((c) => {
            const charId = c.key?.item_id ?? c.objectId;
            const name =
              c.metadata?.name && c.metadata.name.trim() !== ""
                ? c.metadata.name
                : `Unnamed #${charId}`;
            const tribeId = c.tribe_id ?? "—";
            const wallet = c.character_address ?? "";
            return (
              <div key={c.objectId} style={S.row}>
                <span style={{ fontWeight: 600, minWidth: 120 }}>{name}</span>
                <span style={S.muted}>#{charId}</span>
                <span style={S.badge("rgba(255,71,0,0.5)")}>
                  tribe {tribeId}
                </span>
                <span style={S.muted}>{truncateAddr(wallet, 8, 6)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SECURITY TAB ──────────────────────────────────────────────────────────────

function SecurityTab({
  kills,
  nodes,
  charMap,
  loading,
}: {
  kills: any[];
  nodes: any[];
  charMap: Map<string, string>;
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

  const topSystems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kills) {
      const id = k.solar_system_id?.item_id ?? "";
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [kills]);

  const maxSysCount = topSystems[0]?.[1] ?? 1;

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

      {/* System Activity */}
      <div style={S.sectionHead}>SYSTEM ACTIVITY</div>
      {topSystems.length === 0 ? (
        <div style={S.muted}>No data</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {topSystems.map(([sysId, count]) => (
            <div
              key={sysId}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ minWidth: 110, color: "#c8c8b4" }}>
                sys-{sysId}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 10,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(count / maxSysCount) * 100}%`,
                    height: "100%",
                    background: "#FF4700",
                  }}
                />
              </div>
              <span style={{ ...S.muted, minWidth: 20, textAlign: "right" }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

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

  const [killsLoading, setKillsLoading] = useState(false);
  const [charsLoading, setCharsLoading] = useState(false);
  const [nodesLoading, setNodesLoading] = useState(false);

  const loadedKillFeed = useRef(false);
  const loadedInfra = useRef(false);
  const loadedChars = useRef(false);

  const charMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) {
      const id = c.key?.item_id;
      const name = c.metadata?.name?.trim();
      if (id && name) m.set(id, name);
    }
    return m;
  }, [characters]);

  // Load kill feed + characters together (kill feed needs char names)
  useEffect(() => {
    if (activeTab === "KILL FEED" && !loadedKillFeed.current) {
      loadedKillFeed.current = true;
      setKillsLoading(true);
      setCharsLoading(true);
      Promise.all([
        fetchAllObjects(WORLD_PKG + "::killmail::Killmail"),
        fetchAllObjects(WORLD_PKG + "::character::Character"),
      ]).then(([k, c]) => {
        setKills(k);
        setCharacters(c);
        setKillsLoading(false);
        setCharsLoading(false);
      });
    }
  }, [activeTab]);

  // Load infrastructure nodes
  useEffect(() => {
    if (activeTab === "INFRASTRUCTURE" && !loadedInfra.current) {
      loadedInfra.current = true;
      setNodesLoading(true);
      fetchAllObjects(WORLD_PKG + "::network_node::NetworkNode").then((n) => {
        setNodes(n);
        setNodesLoading(false);
      });
    }
  }, [activeTab]);

  // Load characters tab
  useEffect(() => {
    if (activeTab === "CHARACTERS" && !loadedChars.current) {
      loadedChars.current = true;
      // If we already loaded chars via kill feed, skip refetch
      if (characters.length === 0) {
        setCharsLoading(true);
        fetchAllObjects(WORLD_PKG + "::character::Character").then((c) => {
          setCharacters(c);
          setCharsLoading(false);
        });
      }
    }
  }, [activeTab]);

  // Security tab needs kills + nodes — trigger both if not yet loaded
  useEffect(() => {
    if (activeTab === "SECURITY") {
      if (!loadedKillFeed.current) {
        loadedKillFeed.current = true;
        setKillsLoading(true);
        setCharsLoading(true);
        Promise.all([
          fetchAllObjects(WORLD_PKG + "::killmail::Killmail"),
          fetchAllObjects(WORLD_PKG + "::character::Character"),
        ]).then(([k, c]) => {
          setKills(k);
          setCharacters(c);
          setKillsLoading(false);
          setCharsLoading(false);
        });
      }
      if (!loadedInfra.current) {
        loadedInfra.current = true;
        setNodesLoading(true);
        fetchAllObjects(WORLD_PKG + "::network_node::NetworkNode").then((n) => {
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
          loading={killsLoading}
        />
      )}
      {activeTab === "INFRASTRUCTURE" && (
        <InfraTab nodes={nodes} loading={nodesLoading} />
      )}
      {activeTab === "CHARACTERS" && (
        <CharactersTab characters={characters} loading={charsLoading} />
      )}
      {activeTab === "SECURITY" && (
        <SecurityTab
          kills={kills}
          nodes={nodes}
          charMap={charMap}
          loading={securityLoading}
        />
      )}
    </div>
  );
}
