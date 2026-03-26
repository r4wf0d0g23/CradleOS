/**
 * LineageWarPanel.tsx
 * Real-time Lineage War interface — tick countdown, active systems, control scores, structure requirements.
 * Data source: https://lineagewar.xyz/verifier/latest.json (polled every 30s)
 */

import { useEffect, useState, useRef, useCallback } from "react";

// Proxied through keeper.reapers.shop to avoid CORS block on lineagewar.xyz
const VERIFIER_URL = "https://keeper.reapers.shop/war/latest";
// Lineage War is Stillness-only — always use Stillness World API regardless of server env
const WORLD_API = "https://world-api-stillness.live.tech.evefrontier.com";
const POLL_INTERVAL_MS = 30_000;


// ── Types ────────────────────────────────────────────────────────────────────

interface TickPlanEntry {
  tickTimestampMs: number;
  systemId: number;
}

interface Commitment {
  state: "CONTROLLED" | "NEUTRAL" | "CONTESTED";
  warId: number;
  systemId: number;
  snapshotHash: string;
  pointsAwarded: number;
  tickTimestampMs: number;
  controllerTribeId: number | null;
}

interface PresenceRow {
  tribeId: number;
  presenceScore: number;
}

interface Snapshot {
  state: "CONTROLLED" | "NEUTRAL" | "CONTESTED";
  warId: number;
  systemId: number;
  resolution: {
    topScore: number;
    topTribeId: number | null;
    secondScore: number;
    secondTribeId: number | null;
    requiredMargin: number;
  };
  explanation: {
    holdMargin: number;
    takeMargin: number;
    pointsPerTick: number;
    allowedAssemblyTypeIds: number[];
    requiredItemTypeIds: number[];
  };
  presenceRows: PresenceRow[];
}

interface Scoreboard {
  warName?: string;
  lastTickMs: number | null;
  tickRateMinutes?: number;
  tribeScores: Array<{ id: number; name: string; points: number; color: string }>;
  systems: unknown[];
}

interface VerifierConfig {
  source: string;
  warId: number;
  tickStartMs: number;
  tickCount: number;
  phaseStatusWithheld: boolean;
  tickStatus?: string | null;
  degradedReason?: string | null;
}

interface VerifierData {
  config: VerifierConfig;
  tickPlan: TickPlanEntry[];
  commitments: Commitment[];
  snapshots: Snapshot[];
  scoreboard?: Scoreboard;
}

interface SystemInfo {
  id: number;
  name: string;
  regionId: number;
  constellationId: number;
  regionName?: string;
  constellationName?: string;
}

interface TypeInfo {
  id: number;
  name: string;
  description: string;
  iconUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function msToCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false, timeZoneName: "short",
  });
}

function stateColor(state: string): string {
  if (state === "CONTROLLED") return "#00ff99";
  if (state === "CONTESTED") return "#ff9900";
  return "#556b66";
}

function stateLabel(state: string): string {
  if (state === "CONTROLLED") return "CONTROLLED";
  if (state === "CONTESTED") return "CONTESTED";
  return "NEUTRAL";
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useVerifierData() {
  const [data, setData] = useState<VerifierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    try {
      const r = await fetch(VERIFIER_URL + `?_=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setLastFetch(Date.now());
      setError(null);
    } catch (e) {
      setError(String(e));
      // Retry quickly on transient failure instead of waiting full poll interval
      retryRef.current = setTimeout(fetchData, 5_000);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => { clearInterval(id); if (retryRef.current) clearTimeout(retryRef.current); };
  }, [fetchData]);

  return { data, error, lastFetch, refresh: fetchData };
}

function useSystemInfos(systemIds: number[]) {
  const [infos, setInfos] = useState<Map<number, SystemInfo>>(new Map());
  const fetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const toFetch = systemIds.filter(id => !fetchedRef.current.has(id));
    if (toFetch.length === 0) return;

    toFetch.forEach(id => fetchedRef.current.add(id));

    Promise.all(
      toFetch.map(id =>
        fetch(`${WORLD_API}/v2/solarsystems/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      setInfos(prev => {
        const next = new Map(prev);
        results.forEach((sys, i) => {
          if (sys) {
            next.set(toFetch[i], {
              id: toFetch[i],
              name: sys.name ?? `System ${toFetch[i]}`,
              regionId: sys.regionId,
              constellationId: sys.constellationId,
            });
          }
        });
        return next;
      });
    });
  }, [systemIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return infos;
}

function useTypeInfos(typeIds: number[]) {
  const [types, setTypes] = useState<Map<number, TypeInfo>>(new Map());
  const fetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const toFetch = typeIds.filter(id => id > 0 && !fetchedRef.current.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach(id => fetchedRef.current.add(id));

    Promise.all(
      toFetch.map(id =>
        fetch(`${WORLD_API}/v2/types/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      setTypes(prev => {
        const next = new Map(prev);
        results.forEach((t, i) => {
          if (t) next.set(toFetch[i], { id: toFetch[i], name: t.name, description: t.description, iconUrl: t.iconUrl });
        });
        return next;
      });
    });
  }, [typeIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return types;
}

// ── Countdown ────────────────────────────────────────────────────────────────

function TickCountdown({ nextTickMs, tickRateMs }: { nextTickMs: number; tickRateMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = nextTickMs - now;
  const pct = Math.max(0, Math.min(100, (1 - remaining / tickRateMs) * 100));
  const urgent = remaining < 3 * 60 * 1000;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--text-dim)" }}>
          NEXT TICK
        </span>
        <span style={{
          fontFamily: "IBM Plex Mono",
          fontSize: "1.8rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: urgent ? "#ff4444" : "#00ff99",
          textShadow: urgent ? "0 0 12px #ff444480" : "0 0 12px #00ff9940",
          fontVariantNumeric: "tabular-nums",
        }}>
          {remaining > 0 ? msToCountdown(remaining) : "TICKING…"}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: urgent ? "#ff4444" : "#00ff99",
          transition: "width 1s linear",
          boxShadow: `0 0 6px ${urgent ? "#ff444480" : "#00ff9940"}`,
        }} />
      </div>
      <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", textAlign: "right" }}>
        {formatTs(nextTickMs)}
      </div>
    </div>
  );
}

// ── System Card ──────────────────────────────────────────────────────────────

function SystemCard({
  systemId,
  tickMs,
  snapshot,
  systemInfo,
  typeInfos,
  streak,
  tribeNames,
}: {
  systemId: number;
  tickMs: number;
  snapshot: Snapshot | null;
  systemInfo: SystemInfo | null;
  typeInfos: Map<number, TypeInfo>;
  streak: number;
  tribeNames: Map<number, string>;
}) {
  // If snapshot shows NEUTRAL but there's an active controlled streak, use the last resolved state
  const snapshotState = snapshot?.state ?? "NEUTRAL";
  const state = (snapshotState === "NEUTRAL" && streak > 0) ? "CONTROLLED" : snapshotState;
  const color = stateColor(state);
  const allowedTypes = snapshot?.explanation?.allowedAssemblyTypeIds ?? [];
  const controller = snapshot?.resolution?.topTribeId ?? null;
  const controllerName = controller ? (tribeNames.get(controller) ?? `Tribe ${controller}`) : null;
  const topScore = snapshot?.resolution?.topScore ?? 0;
  const secondScore = snapshot?.resolution?.secondScore ?? 0;
  const margin = snapshot?.resolution?.requiredMargin ?? 1;
  const name = systemInfo?.name ?? `System ${systemId}`;

  return (
    <div style={{
      border: `1px solid ${color}`,
      borderRadius: 4,
      background: "rgba(0,0,0,0.3)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.6rem 0.85rem",
        background: `${color}12`,
        borderBottom: `1px solid ${color}40`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        <div>
          <div style={{ fontFamily: "IBM Plex Mono", fontSize: "1rem", fontWeight: 700, color, letterSpacing: "0.06em" }}>
            {name}
          </div>
          <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.62rem", color: "var(--text-dim)", marginTop: 2 }}>
            SYSTEM {systemId} · {formatTs(tickMs)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "IBM Plex Mono", fontSize: "0.65rem", fontWeight: 600,
            letterSpacing: "0.12em", color,
          }}>
            {stateLabel(state)}
          </div>
          {streak > 1 && (
            <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", marginTop: 2 }}>
              ×{streak} streak
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0.75rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {/* Controller */}
        {controllerName && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", color: "var(--text-dim)", letterSpacing: "0.1em" }}>CONTROLLING TRIBE</span>
            <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.72rem", color: "#00ff99", fontWeight: 600 }}>{controllerName}</span>
          </div>
        )}

        {/* Scores */}
        {snapshot && (
          <div style={{ display: "flex", gap: "1px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
            {snapshot.presenceRows
              .slice()
              .sort((a, b) => b.presenceScore - a.presenceScore)
              .map(row => (
                <div key={row.tribeId} style={{
                  flex: 1, padding: "0.4rem 0.6rem",
                  background: "rgba(0,0,0,0.3)",
                }}>
                  <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", marginBottom: 2 }}>
                    {tribeNames.get(row.tribeId) ?? `Tribe ${row.tribeId}`}
                  </div>
                  <div style={{ fontFamily: "IBM Plex Mono", fontSize: "1.1rem", fontWeight: 700, color: row.presenceScore > 0 ? "#00ff99" : "var(--text-dim)" }}>
                    {row.presenceScore}
                  </div>
                  <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.55rem", color: "var(--text-dim)" }}>presence</div>
                </div>
              ))
            }
            <div style={{ flex: 1, padding: "0.4rem 0.6rem", background: "rgba(0,0,0,0.3)" }}>
              <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", marginBottom: 2 }}>margin req.</div>
              <div style={{ fontFamily: "IBM Plex Mono", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-dim)" }}>{margin}</div>
              <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.55rem", color: "var(--text-dim)" }}>to flip</div>
            </div>
          </div>
        )}

        {/* Scores bar */}
        {topScore > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", marginBottom: 4 }}>
              <span>CONTROL POINTS (top vs 2nd)</span>
              <span>{topScore} / {secondScore}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: secondScore > 0 && topScore > 0 ? `${Math.max(8, Math.round((topScore / (topScore + secondScore)) * 100))}%` : "100%",
                background: "#00ff99",
                boxShadow: "0 0 6px #00ff9940",
              }} />
            </div>
          </div>
        )}

        {/* Required structures */}
        {allowedTypes.length > 0 && (
          <div>
            <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.62rem", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
              QUALIFYING STRUCTURES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {allowedTypes.map(typeId => {
                const t = typeInfos.get(typeId);
                return (
                  <div key={typeId} style={{
                    display: "flex", alignItems: "center", gap: "0.6rem",
                    padding: "0.35rem 0.5rem",
                    background: "rgba(0,255,153,0.06)",
                    border: "1px solid rgba(0,255,153,0.15)",
                    borderRadius: 3,
                  }}>
                    {t?.iconUrl && (
                      <img src={t.iconUrl} alt="" width={24} height={24} style={{ opacity: 0.8 }} />
                    )}
                    <div>
                      <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.72rem", color: "#00ff99", fontWeight: 600 }}>
                        {t?.name ?? `Type ${typeId}`}
                      </div>
                      {t?.description && (
                        <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)", marginTop: 1, maxWidth: 340 }}>
                          {t.description.slice(0, 120).replace(/\r\n/g, " ")}
                          {t.description.length > 120 ? "…" : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono", fontSize: "0.6rem", color: "var(--text-dim)" }}>
                      #{typeId}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score Board ───────────────────────────────────────────────────────────────

function Scoreboard({ data, tribeNames }: { data: VerifierData; tribeNames: Map<number, string> }) {
  // Tally points per tribe from commitments
  const pointsMap = new Map<number, number>();
  for (const c of data.commitments) {
    if (c.controllerTribeId != null && c.pointsAwarded > 0) {
      pointsMap.set(c.controllerTribeId, (pointsMap.get(c.controllerTribeId) ?? 0) + c.pointsAwarded);
    }
  }
  const entries = Array.from(pointsMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxPts = entries[0]?.[1] ?? 1;
  const totalTicks = data.config.tickCount;
  const elapsed = data.commitments.length > 0
    ? new Set(data.commitments.map(c => c.tickTimestampMs)).size
    : 0;

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 4,
      background: "rgba(0,0,0,0.3)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "0.5rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "IBM Plex Mono", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--text-dim)" }}>
        WAR {data.config.warId} SCOREBOARD · {elapsed}/{totalTicks} TICKS
      </div>
      <div style={{ padding: "0.75rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {entries.length === 0 ? (
          <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", color: "var(--text-dim)" }}>No points recorded yet.</div>
        ) : entries.map(([tribeId, pts], i) => {
          const name = tribeNames.get(tribeId) ?? `Tribe ${tribeId}`;
          const pct = Math.round((pts / maxPts) * 100);
          const leading = i === 0;
          return (
            <div key={tribeId}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.7rem", color: leading ? "#00ff99" : "var(--text)", fontWeight: leading ? 700 : 400 }}>
                  {leading ? "▲ " : "▼ "}{name}
                </span>
                <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.7rem", color: leading ? "#00ff99" : "var(--text-dim)", fontWeight: 700 }}>
                  {pts} pts
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: leading ? "#00ff99" : "rgba(255,255,255,0.15)",
                  boxShadow: leading ? "0 0 8px #00ff9940" : "none",
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.58rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
          {data.config.source === "live-chain" ? "● LIVE CHAIN" : `SOURCE: ${data.config.source}`}
          {data.config.phaseStatusWithheld && " · PHASE WITHHELD"}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function LineageWarPanel() {
  const { data, error, lastFetch, refresh } = useVerifierData();
  const [tribeNames, setTribeNames] = useState<Map<number, string>>(new Map());

  // Unique system IDs across tick plan
  const allSystemIds = data
    ? Array.from(new Set(data.tickPlan.map(t => t.systemId)))
    : [];

  const systemInfos = useSystemInfos(allSystemIds);

  // Unique type IDs across snapshots
  const allTypeIds = data
    ? Array.from(new Set(
        data.snapshots.flatMap(s => s.explanation?.allowedAssemblyTypeIds ?? [])
      ))
    : [];
  const typeInfos = useTypeInfos(allTypeIds);

  // Fetch tribe names once
  useEffect(() => {
    fetch(`${WORLD_API}/v2/tribes?limit=100`)
      .then(r => r.json())
      .then((json: { data: Array<{ id: number; name: string }> }) => {
        const m = new Map<number, string>();
        (json.data ?? []).forEach(t => m.set(t.id, t.name));
        setTribeNames(m);
      })
      .catch(() => {});
  }, []);

  // Compute streaks per system
  const streakMap = new Map<number, number>();
  if (data) {
    for (const sid of allSystemIds) {
      const bySystem = data.commitments
        .filter(c => c.systemId === sid)
        .sort((a, b) => a.tickTimestampMs - b.tickTimestampMs);
      // Find the most recent RESOLVED commitment (one that has a controller)
      const resolved = bySystem.filter(c => c.controllerTribeId != null);
      const last = resolved[resolved.length - 1];
      if (!last || last.controllerTribeId == null) { streakMap.set(sid, 0); continue; }
      let count = 0;
      for (let i = resolved.length - 1; i >= 0; i--) {
        if (resolved[i].controllerTribeId === last.controllerTribeId) count++;
        else break;
      }
      streakMap.set(sid, count);
    }
  }

  // Derive tick rate and extrapolate upcoming ticks if tick plan is all in the past
  const now = Date.now();
  const tickRateMs = (data?.scoreboard?.tickRateMinutes ?? 60) * 60 * 1000;

  // Build upcoming ticks — from plan first, then extrapolate from last known tick
  let upcomingTicks = (data?.tickPlan ?? [])
    .filter(t => t.tickTimestampMs > now)
    .sort((a, b) => a.tickTimestampMs - b.tickTimestampMs);

  // If no upcoming ticks in plan, extrapolate from last commitment or last tick plan entry
  if (upcomingTicks.length === 0 && data) {
    const allTicks = [...(data.tickPlan ?? [])].sort((a, b) => a.tickTimestampMs - b.tickTimestampMs);
    const lastKnown = allTicks[allTicks.length - 1];
    if (lastKnown) {
      // Project next 5 ticks forward from the last known tick
      const extrapolated: TickPlanEntry[] = [];
      for (let i = 1; i <= 5; i++) {
        extrapolated.push({
          tickTimestampMs: lastKnown.tickTimestampMs + i * tickRateMs,
          systemId: lastKnown.systemId,
        });
      }
      upcomingTicks = extrapolated.filter(t => t.tickTimestampMs > now);
    }
  }

  const nextTick = upcomingTicks[0] ?? null;

  // Active systems — use all unique systems from tick plan (past ticks are still contested)
  const activeSystems: { systemId: number; tickMs: number }[] = [];
  const seen = new Set<number>();
  const allPlanTicks = [...(data?.tickPlan ?? [])].sort((a, b) => a.tickTimestampMs - b.tickTimestampMs);
  for (const t of allPlanTicks) {
    if (!seen.has(t.systemId)) {
      // Use the next upcoming tick for this system, or last known if all past
      const nextForSystem = upcomingTicks.find(u => u.systemId === t.systemId);
      activeSystems.push({ systemId: t.systemId, tickMs: nextForSystem?.tickTimestampMs ?? t.tickTimestampMs });
      seen.add(t.systemId);
    }
  }

  return (
    <div style={{
      background: "var(--bg-terminal, #030d07)",
      minHeight: "100%",
      color: "var(--text, #c8e8d8)",
      fontFamily: "IBM Plex Mono, monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.65rem 1.25rem",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(6,17,12,0.9)",
        backdropFilter: "blur(2px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <h1 style={{ fontFamily: "IBM Plex Mono", fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.14em", margin: 0, color: "#00ff99" }}>
            <span style={{ color: "var(--text-dim)" }}>// </span>LINEAGE WAR
          </h1>
          <span style={{ fontSize: "0.6rem", color: "#44aaff", letterSpacing: "0.1em", border: "1px solid #44aaff44", borderRadius: 3, padding: "0.1rem 0.4rem" }}>
            STILLNESS
          </span>
          {data && (
            <>
              <span style={{ fontSize: "0.6rem", color: "#00ff99", letterSpacing: "0.08em", fontWeight: 600 }}>
                {data.scoreboard?.warName ?? `WAR ${data.config.warId}`}
              </span>
              <span style={{ fontSize: "0.6rem", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                {(data.scoreboard?.tickRateMinutes ?? 60)}min ticks
              </span>
              {data.config.degradedReason && (
                <span style={{ fontSize: "0.6rem", color: "#ff4444", letterSpacing: "0.08em" }}>
                  ⚠ {data.config.degradedReason}
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {lastFetch > 0 && (
            <span style={{ fontSize: "0.58rem", color: "var(--text-dim)" }}>
              updated {Math.round((Date.now() - lastFetch) / 1000)}s ago
            </span>
          )}
          <button
            onClick={refresh}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3,
              color: "var(--text-dim)", fontFamily: "IBM Plex Mono", fontSize: "0.6rem",
              letterSpacing: "0.1em", padding: "0.2rem 0.5rem", cursor: "pointer",
            }}
          >
            ↻ REFRESH
          </button>
          {data && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.65rem", letterSpacing: "0.12em", color: "#00ff99" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00ff99", boxShadow: "0 0 6px #00ff9940", animation: "pulse 2s ease-in-out infinite" }} />
              LIVE
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {error && (
        <div style={{ padding: "0.75rem 1.25rem", background: "rgba(255,50,50,0.08)", borderBottom: "1px solid rgba(255,50,50,0.2)", fontSize: "0.65rem", color: "#ff6666" }}>
          ⚠ Failed to load verifier data: {error} — retrying in {Math.round(POLL_INTERVAL_MS / 1000)}s
        </div>
      )}

      {!data && !error && (
        <div style={{ padding: "2rem 1.25rem", fontSize: "0.65rem", color: "var(--text-dim)" }}>
          Loading war data…
        </div>
      )}

      {data && (
        <div style={{ padding: "1rem 1.25rem", display: "grid", gap: "1rem" }}>
          {/* Countdown + Scoreboard row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1rem" }}>
            {/* Countdown card */}
            <div style={{
              border: "1px solid rgba(0,255,153,0.2)",
              borderRadius: 4,
              background: "rgba(0,0,0,0.3)",
              padding: "0.85rem 1rem",
            }}>
              {nextTick ? (
                <TickCountdown nextTickMs={nextTick.tickTimestampMs} tickRateMs={(data.scoreboard?.tickRateMinutes ?? 60) * 60 * 1000} />
              ) : (
                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>No upcoming ticks scheduled.</div>
              )}

            </div>

            {/* Scoreboard */}
            <Scoreboard data={data} tribeNames={tribeNames} />
          </div>

          {/* The Orchestrator — Prediction Market + $SUFFER */}
          <div style={{
            border: "1px solid rgba(255,140,0,0.25)",
            borderRadius: 4,
            background: "rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "0.5rem 0.85rem",
              borderBottom: "1px solid rgba(255,140,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(255,140,0,0.8)" }}>
                THE ORCHESTRATOR
              </span>
              <span style={{ fontFamily: "IBM Plex Mono", fontSize: "0.55rem", color: "var(--text-dim)" }}>
                PREDICTION MARKET · $SUFFER
              </span>
            </div>
            <div style={{ padding: "0.75rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", color: "var(--text)", lineHeight: 1.6 }}>
                On-chain prediction market for Frontier war outcomes. Trade shares via constant-product AMM, stake $SUFFER (SFR) as collateral, and resolve disputes through decentralized voting.
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <a
                  href="https://orchestrator.lineagewar.xyz/markets"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "IBM Plex Mono", fontSize: "0.62rem", letterSpacing: "0.08em",
                    color: "#ff9900", border: "1px solid rgba(255,153,0,0.4)",
                    padding: "0.35rem 0.7rem", borderRadius: 3, textDecoration: "none",
                    background: "rgba(255,153,0,0.08)", cursor: "pointer",
                  }}
                >
                  PREDICTION MARKETS →
                </a>
                <a
                  href="https://orchestrator.lineagewar.xyz/airdrop"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "IBM Plex Mono", fontSize: "0.62rem", letterSpacing: "0.08em",
                    color: "#ff4444", border: "1px solid rgba(255,68,68,0.4)",
                    padding: "0.35rem 0.7rem", borderRadius: 3, textDecoration: "none",
                    background: "rgba(255,68,68,0.08)", cursor: "pointer",
                  }}
                >
                  CLAIM $SUFFER AIRDROP →
                </a>
                <a
                  href="https://github.com/saemihemma/predictionmarket-OSS"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "IBM Plex Mono", fontSize: "0.62rem", letterSpacing: "0.08em",
                    color: "var(--text-dim)", border: "1px solid rgba(255,255,255,0.12)",
                    padding: "0.35rem 0.7rem", borderRadius: 3, textDecoration: "none",
                    background: "rgba(255,255,255,0.03)", cursor: "pointer",
                  }}
                >
                  SOURCE (OSS) →
                </a>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontFamily: "IBM Plex Mono", fontSize: "0.58rem", color: "var(--text-dim)" }}>
                <span>STARTER: 100,000 SFR</span>
                <span>DAILY: 10,000 SFR</span>
                <span>GAS: SPONSORED</span>
                <span>NETWORK: TESTNET</span>
              </div>
            </div>
          </div>

          {/* Active Systems */}
          <div>
            <div style={{ fontFamily: "IBM Plex Mono", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: "0.6rem" }}>
              ACTIVE SYSTEMS ({activeSystems.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.85rem" }}>
              {activeSystems.map(({ systemId, tickMs }) => {
                const snap = data.snapshots.find(s => s.systemId === systemId) ?? null;
                return (
                  <SystemCard
                    key={systemId}
                    systemId={systemId}
                    tickMs={tickMs}
                    snapshot={snap}
                    systemInfo={systemInfos.get(systemId) ?? null}
                    typeInfos={typeInfos}
                    streak={streakMap.get(systemId) ?? 0}
                    tribeNames={tribeNames}
                  />
                );
              })}
            </div>
          </div>

          {/* Recent commitments ledger */}
          <div style={{
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4,
            background: "rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "0.5rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--text-dim)" }}>
              COMMITMENT LEDGER — LAST {Math.min(10, data.commitments.length)} OF {data.commitments.length}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.62rem", fontFamily: "IBM Plex Mono" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-dim)" }}>
                    {["TICK TIME", "SYSTEM", "STATE", "CONTROLLER", "POINTS", "HASH"].map(h => (
                      <th key={h} style={{ padding: "0.35rem 0.75rem", textAlign: "left", fontWeight: 400, letterSpacing: "0.1em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.commitments.slice().reverse().slice(0, 10).map((c, i) => {
                    const sysName = systemInfos.get(c.systemId)?.name ?? `System ${c.systemId}`;
                    const tribeName = c.controllerTribeId ? (tribeNames.get(c.controllerTribeId) ?? `Tribe ${c.controllerTribeId}`) : "—";
                    const stateCol = stateColor(c.state);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", color: "var(--text)" }}>
                        <td style={{ padding: "0.35rem 0.75rem", color: "var(--text-dim)" }}>{formatTs(c.tickTimestampMs)}</td>
                        <td style={{ padding: "0.35rem 0.75rem", color: "#00ff99", fontWeight: 600 }}>{sysName}</td>
                        <td style={{ padding: "0.35rem 0.75rem", color: stateCol }}>{c.state}</td>
                        <td style={{ padding: "0.35rem 0.75rem" }}>{tribeName}</td>
                        <td style={{ padding: "0.35rem 0.75rem", color: c.pointsAwarded > 0 ? "#00ff99" : "var(--text-dim)" }}>+{c.pointsAwarded}</td>
                        <td style={{ padding: "0.35rem 0.75rem", color: "var(--text-dim)", fontFamily: "monospace", fontSize: "0.55rem" }}>
                          {c.snapshotHash.slice(0, 10)}…
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
