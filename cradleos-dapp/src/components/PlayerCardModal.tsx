import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SERVER_ENV } from "../constants";
import { fetchPlayerStructures, type LocationGroup } from "../lib";
import { type KillRecord } from "./KillCardModal";

// ── Suiscan URL helpers ───────────────────────────────────────────────────────
const SUISCAN_BASE = "https://suiscan.xyz/testnet";
const suiscanObject = (id: string) => `${SUISCAN_BASE}/object/${id}`;
const suiscanAccount = (addr: string) => `${SUISCAN_BASE}/account/${addr}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncate(addr: string, front = 8, back = 6): string {
  if (!addr || addr.length <= front + back + 3) return addr;
  return `${addr.slice(0, front)}…${addr.slice(-back)}`;
}

function formatRelative(secondsAgo: number): string {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const m = Math.floor(secondsAgo / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Color tokens (mirror KillCardModal) ───────────────────────────────────────
// CCP Design System palette — Crude/Neutral/Martian Red/Secondary olive.
const C = {
  bg: "#0B0B0B",
  panel: "rgba(11, 11, 11, 0.96)",
  fg: "#FAFAE5",
  fgDim: "rgba(250, 250, 229, 0.55)",
  fgFaint: "rgba(250, 250, 229, 0.30)",
  accent: "#FF4700",
  accentDim: "rgba(255, 71, 0, 0.65)",
  accentFaint: "rgba(255, 71, 0, 0.30)",
  border: "rgba(107, 107, 94, 0.42)",
  divider: "rgba(107, 107, 94, 0.18)",
  green: "#00ff96",
  red: "#ff4444",
  amber: "rgba(255, 200, 0, 0.85)",
  amberDim: "rgba(255, 200, 0, 0.5)",
  orange: "#FF4700",
  cyan: "rgba(186, 185, 167, 0.95)",
  cyanDim: "rgba(107, 107, 94, 0.85)",
  cyanFaint: "rgba(107, 107, 94, 0.35)",
};

// ── Glyphs ────────────────────────────────────────────────────────────────────
const G = {
  player: "◉",
  tribe: "▣",
  chain: "≣",
  combat: "✦",
  infra: "⬢",
  link: "↗",
  close: "×",
  bullet: "▪",
};

// ── Styled bits ───────────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: C.cyanDim,
  marginBottom: 6,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  color: C.fgFaint,
  textTransform: "uppercase" as const,
};

const monoId: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: 10,
  color: C.fgDim,
  letterSpacing: "0.04em",
};

const linkStyle: React.CSSProperties = {
  color: C.accent,
  textDecoration: "none",
  fontSize: 10,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};

// ── Section wrapper with corner brackets ──────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "10px 12px 12px",
        marginBottom: 8,
        background: "rgba(107, 107, 94, 0.03)",
        border: `1px solid ${C.divider}`,
      }}
    >
      <span style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, borderTop: `1px solid ${C.cyan}`, borderLeft: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, borderTop: `1px solid ${C.cyan}`, borderRight: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", bottom: -1, left: -1, width: 6, height: 6, borderBottom: `1px solid ${C.cyan}`, borderLeft: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", bottom: -1, right: -1, width: 6, height: 6, borderBottom: `1px solid ${C.cyan}`, borderRight: `1px solid ${C.cyan}` }} />
      <div style={sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 90px", minWidth: 80, padding: "6px 8px", background: "rgba(107, 107, 94,0.04)", border: `1px solid ${C.divider}` }}>
      <div style={{ fontSize: 8, letterSpacing: "0.12em", color: C.fgFaint, textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? C.fg }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.fgFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PlayerCardProps {
  /** The on-chain Character item_id (e.g. "2112083686") */
  characterItemId: string;
  /** Map for resolving names of related characters */
  charMap: Map<string, string>;
  sysMap: Map<string, string>;
  charTribeMap?: Map<string, number>;
  tribeInfoMap?: Map<number, { name: string; ticker: string }>;
  /** Full kill list available in the current window — used for kill/loss history */
  allKills: KillRecord[];
  /** Optional pre-resolved Character object id and wallet address.
   *  If not provided, the modal derives the Character object id and reads the
   *  on-chain Character to get character_address. */
  characterObjectId?: string;
  characterWallet?: string;
  onClose: () => void;
  /** Open another player card (for clicking nemeses/targets in this card) */
  onOpenPlayer?: (characterItemId: string) => void;
  /** Open a kill card */
  onOpenKill?: (kill: KillRecord) => void;
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function PlayerCardModal({
  characterItemId,
  charMap,
  sysMap,
  charTribeMap,
  tribeInfoMap,
  allKills,
  characterObjectId: prefetchedObjId,
  characterWallet: prefetchedWallet,
  onClose,
  onOpenPlayer,
  onOpenKill,
}: PlayerCardProps) {
  // ── Escape key + body scroll lock ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // ── Lazy character object + wallet resolution ─────
  const [characterObjectId, setCharacterObjectId] = useState<string | null>(prefetchedObjId ?? null);
  const [walletAddr, setWalletAddr] = useState<string | null>(prefetchedWallet ?? null);
  const [resolvingChar, setResolvingChar] = useState(!prefetchedWallet);

  useEffect(() => {
    if (walletAddr) return;
    let cancelled = false;
    (async () => {
      // Use the GraphQL objects() filter to find this Character by item_id.
      // We don't have the bcs derivation utilities in this file; use a wide
      // GraphQL scan capped at ~5k characters (fast) and filter by item_id.
      // This is a one-time per-player lookup; cached in module scope below.
      const cached = _playerLookupCache.get(characterItemId);
      if (cached) {
        if (!cancelled) {
          setCharacterObjectId(cached.objectId);
          setWalletAddr(cached.wallet);
          setResolvingChar(false);
        }
        return;
      }
      try {
        const wallet = await resolveWalletForCharacterItemId(characterItemId);
        if (cancelled) return;
        if (wallet) {
          setCharacterObjectId(wallet.objectId);
          setWalletAddr(wallet.wallet);
          _playerLookupCache.set(characterItemId, wallet);
        }
      } finally {
        if (!cancelled) setResolvingChar(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterItemId, walletAddr]);

  // ── Lazy structure fetch (only when wallet resolves) ─────
  const [structures, setStructures] = useState<LocationGroup[] | null>(null);
  const [structuresLoading, setStructuresLoading] = useState(false);
  const [structuresError, setStructuresError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddr) return;
    let cancelled = false;
    setStructuresLoading(true);
    setStructuresError(null);
    fetchPlayerStructures(walletAddr)
      .then((groups) => {
        if (cancelled) return;
        setStructures(groups);
      })
      .catch((err) => {
        if (cancelled) return;
        setStructuresError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setStructuresLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddr]);

  // ── Derived values ─────
  const playerName = charMap.get(characterItemId) ?? `Unknown #${characterItemId.slice(-6)}`;
  const tribeId = charTribeMap?.get(characterItemId);
  const tribeInfo = tribeId ? tribeInfoMap?.get(tribeId) : undefined;

  // Combat history derived from the kill list in scope
  const combat = useMemo(() => {
    let killsAsAggressor = 0;
    let lossesAsVictim = 0;
    let reportsFiled = 0;
    let firstKillTs = Infinity;
    let lastKillTs = 0;
    const targetCounts = new Map<string, number>(); // victim_id → count
    const nemesisCounts = new Map<string, number>(); // killer_id → count (killers of this player)
    const systemCounts = new Map<string, number>(); // sys_id → count
    const killsList: KillRecord[] = [];
    const lossesList: KillRecord[] = [];

    for (const k of allKills) {
      const killerId = k.killer_id?.item_id ?? "";
      const victimId = k.victim_id?.item_id ?? "";
      const reporterId = k.reported_by_character_id?.item_id ?? "";
      const sysId = k.solar_system_id?.item_id ?? "";
      const ts = parseInt(k.kill_timestamp ?? "0", 10);

      if (killerId === characterItemId) {
        killsAsAggressor++;
        if (ts < firstKillTs) firstKillTs = ts;
        if (ts > lastKillTs) lastKillTs = ts;
        if (victimId) targetCounts.set(victimId, (targetCounts.get(victimId) ?? 0) + 1);
        if (sysId) systemCounts.set(sysId, (systemCounts.get(sysId) ?? 0) + 1);
        killsList.push(k);
      }
      if (victimId === characterItemId) {
        lossesAsVictim++;
        if (killerId) nemesisCounts.set(killerId, (nemesisCounts.get(killerId) ?? 0) + 1);
        lossesList.push(k);
      }
      if (reporterId === characterItemId && killerId !== characterItemId && victimId !== characterItemId) {
        reportsFiled++;
      }
    }

    const topTargets = [...targetCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topNemeses = [...nemesisCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topSystems = [...systemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const totalEngagements = killsAsAggressor + lossesAsVictim;
    const kdRatio = lossesAsVictim === 0
      ? (killsAsAggressor > 0 ? "∞" : "—")
      : (killsAsAggressor / lossesAsVictim).toFixed(2);

    killsList.sort((a, b) => parseInt(b.kill_timestamp, 10) - parseInt(a.kill_timestamp, 10));
    lossesList.sort((a, b) => parseInt(b.kill_timestamp, 10) - parseInt(a.kill_timestamp, 10));

    return {
      killsAsAggressor,
      lossesAsVictim,
      reportsFiled,
      totalEngagements,
      kdRatio,
      firstKillTs: firstKillTs === Infinity ? null : firstKillTs,
      lastKillTs: lastKillTs || null,
      topTargets,
      topNemeses,
      topSystems,
      killsList,
      lossesList,
    };
  }, [allKills, characterItemId]);

  // Structure aggregation
  const structureSummary = useMemo(() => {
    if (!structures) return null;
    let total = 0;
    let online = 0;
    const byKind = new Map<string, number>();
    const systemSet = new Set<string>();
    for (const group of structures) {
      // LocationGroup.key is the solarSystemId (string) or 'unknown'
      systemSet.add(group.key);
      for (const s of group.structures) {
        total++;
        if (s.isOnline) online++;
        byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1);
      }
    }
    return { total, online, byKind, systemCount: systemSet.size };
  }, [structures]);

  const nowSec = Math.floor(Date.now() / 1000);

  // ── Render ─────
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 6, 12, 0.84)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 9600, // above kill card so chained navigation stacks correctly
        padding: "5vh 16px 16px",
        overflowY: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, 'Menlo', 'Consolas', monospace",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: C.panel,
          border: `1px solid ${C.border}`,
          maxWidth: 600,
          width: "100%",
          color: C.fg,
          boxShadow: `0 0 0 1px rgba(107, 107, 94, 0.18), 0 24px 48px rgba(0, 0, 0, 0.75), 0 0 60px rgba(255, 71, 0, 0.08)`,
        }}
      >
        {/* Frame corner brackets — Martian Red accent */}
        <span style={{ position: "absolute", top: -2, left: -2, width: 12, height: 12, borderTop: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` }} />
        <span style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderTop: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` }} />
        <span style={{ position: "absolute", bottom: -2, left: -2, width: 12, height: 12, borderBottom: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` }} />
        <span style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderBottom: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` }} />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "12px 14px 10px",
            borderBottom: `1px solid ${C.divider}`,
            background: `linear-gradient(180deg, rgba(255, 71, 0, 0.05) 0%, transparent 100%)`,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ color: C.cyan, fontSize: 18, lineHeight: 1 }}>{G.player}</span>
              <span style={{ color: C.fg, fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", textShadow: "0 0 10px rgba(255, 71, 0, 0.35)" }}>
                {playerName}
              </span>
              {tribeInfo && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "2px 6px",
                    background: "rgba(107, 107, 94,0.08)",
                    border: "1px solid rgba(107, 107, 94,0.4)",
                    color: "rgba(107, 107, 94,0.95)",
                  }}
                >
                  {tribeInfo.ticker}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 10, color: C.fgDim, flexWrap: "wrap" }}>
              <span style={{ color: C.amberDim }}>#{characterItemId}</span>
              <span style={{ color: C.cyanDim, letterSpacing: "0.1em" }}>{SERVER_ENV.toUpperCase()}</span>
              {tribeInfo && (
                <span style={{ color: C.cyanDim }}>
                  {G.tribe} {tribeInfo.name}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: `1px solid ${C.cyanFaint}`,
              color: C.cyanDim,
              width: 26,
              height: 26,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            {G.close}
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 14 }}>
          {/* Combat record */}
          <Section label={`${G.combat}  COMBAT RECORD (current window)`}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Stat label="Kills" value={combat.killsAsAggressor} color={C.green} />
              <Stat label="Losses" value={combat.lossesAsVictim} color={C.red} />
              <Stat label="K/D" value={combat.kdRatio} color={C.amber} />
              <Stat label="Reports" value={combat.reportsFiled} color={C.cyan} sub="3rd-party" />
              <Stat label="Engagements" value={combat.totalEngagements} />
            </div>
            {combat.lastKillTs && (
              <div style={{ fontSize: 10, color: C.fgDim, marginTop: 4 }}>
                Last kill {formatRelative(nowSec - combat.lastKillTs)}
                {combat.firstKillTs && combat.firstKillTs !== combat.lastKillTs &&
                  ` · first ${formatRelative(nowSec - combat.firstKillTs)}`}
              </div>
            )}
            {combat.totalEngagements === 0 && (
              <div style={{ fontSize: 11, color: C.fgFaint, fontStyle: "italic" }}>
                No combat activity in current window.
              </div>
            )}
          </Section>

          {/* Top targets / nemeses / systems */}
          {(combat.topTargets.length > 0 || combat.topNemeses.length > 0 || combat.topSystems.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Section label="TOP TARGETS">
                {combat.topTargets.length === 0 ? (
                  <div style={{ fontSize: 10, color: C.fgFaint }}>—</div>
                ) : (
                  combat.topTargets.map(([itemId, count]) => (
                    <PlayerLink
                      key={itemId}
                      itemId={itemId}
                      name={charMap.get(itemId) ?? `#${itemId.slice(-6)}`}
                      count={count}
                      color={C.red}
                      onClick={() => onOpenPlayer?.(itemId)}
                    />
                  ))
                )}
              </Section>
              <Section label="TOP NEMESES">
                {combat.topNemeses.length === 0 ? (
                  <div style={{ fontSize: 10, color: C.fgFaint }}>—</div>
                ) : (
                  combat.topNemeses.map(([itemId, count]) => (
                    <PlayerLink
                      key={itemId}
                      itemId={itemId}
                      name={charMap.get(itemId) ?? `#${itemId.slice(-6)}`}
                      count={count}
                      color={C.green}
                      onClick={() => onOpenPlayer?.(itemId)}
                    />
                  ))
                )}
              </Section>
              <Section label="TOP SYSTEMS">
                {combat.topSystems.length === 0 ? (
                  <div style={{ fontSize: 10, color: C.fgFaint }}>—</div>
                ) : (
                  combat.topSystems.map(([sysId, count]) => (
                    <div key={sysId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: C.cyan, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sysMap.get(sysId) ?? `sys-${sysId}`}
                      </span>
                      <span style={{ fontSize: 9, color: C.fgFaint }}>{count}</span>
                    </div>
                  ))
                )}
              </Section>
            </div>
          )}

          {/* Recent engagements */}
          {(combat.killsList.length > 0 || combat.lossesList.length > 0) && (
            <Section label={`${G.combat}  RECENT ENGAGEMENTS`}>
              <div style={{ maxHeight: 160, overflowY: "auto", fontSize: 11 }}>
                {[...combat.killsList.slice(0, 10), ...combat.lossesList.slice(0, 10)]
                  .sort((a, b) => parseInt(b.kill_timestamp, 10) - parseInt(a.kill_timestamp, 10))
                  .slice(0, 12)
                  .map((k) => {
                    const isKill = k.killer_id?.item_id === characterItemId;
                    const otherId = isKill ? (k.victim_id?.item_id ?? "") : (k.killer_id?.item_id ?? "");
                    const sysId = k.solar_system_id?.item_id ?? "";
                    const ts = parseInt(k.kill_timestamp, 10);
                    return (
                      <div
                        key={k.objectId}
                        onClick={() => onOpenKill?.(k)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto auto",
                          gap: 8,
                          padding: "3px 4px",
                          borderBottom: `1px solid ${C.divider}`,
                          cursor: onOpenKill ? "pointer" : "default",
                          alignItems: "baseline",
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = "rgba(107, 107, 94,0.05)"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = ""}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: isKill ? C.green : C.red, width: 36 }}>
                          {isKill ? "KILL" : "LOSS"}
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isKill ? C.red : C.green }}>
                          {charMap.get(otherId) ?? `#${otherId.slice(-6)}`}
                        </span>
                        <span style={{ fontSize: 10, color: C.cyanDim }}>
                          {sysMap.get(sysId) ?? `sys-${sysId}`}
                        </span>
                        <span style={{ fontSize: 9, color: C.fgFaint }}>
                          {formatRelative(nowSec - ts)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Section>
          )}

          {/* Infrastructure */}
          <Section label={`${G.infra}  INFRASTRUCTURE`}>
            {resolvingChar || !walletAddr ? (
              <div style={{ fontSize: 11, color: C.fgFaint }}>Resolving wallet…</div>
            ) : structuresLoading ? (
              <div style={{ fontSize: 11, color: C.fgFaint }}>Loading on-chain structures…</div>
            ) : structuresError ? (
              <div style={{ fontSize: 11, color: C.red }}>Error: {structuresError}</div>
            ) : !structureSummary || structureSummary.total === 0 ? (
              <div style={{ fontSize: 11, color: C.fgFaint, fontStyle: "italic" }}>
                No on-chain structures owned by this character.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <Stat label="Total" value={structureSummary.total} color={C.cyan} />
                  <Stat label="Online" value={structureSummary.online} color={C.green} />
                  <Stat label="Offline" value={structureSummary.total - structureSummary.online} color={structureSummary.total - structureSummary.online > 0 ? C.red : undefined} />
                  <Stat label="Systems" value={structureSummary.systemCount} color={C.amber} />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 10 }}>
                  {[...structureSummary.byKind.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                    <span key={kind} style={{ padding: "2px 6px", background: "rgba(107, 107, 94,0.05)", border: `1px solid ${C.divider}`, color: C.fgDim, letterSpacing: "0.04em" }}>
                      {count}× {kind}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* Chain provenance */}
          <Section label={`${G.chain}  ON-CHAIN PROVENANCE`}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "4px 12px", alignItems: "baseline" }}>
              <span style={fieldLabel}>Char ID</span>
              <span style={monoId}>#{characterItemId}</span>
              <span style={{ ...monoId, color: C.fgFaint }}>—</span>

              {characterObjectId && (
                <>
                  <span style={fieldLabel}>Char Obj</span>
                  <span style={monoId}>{truncate(characterObjectId, 10, 8)}</span>
                  <a href={suiscanObject(characterObjectId)} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    Suiscan {G.link}
                  </a>
                </>
              )}

              {walletAddr && (
                <>
                  <span style={fieldLabel}>Wallet</span>
                  <span style={monoId}>{truncate(walletAddr, 10, 8)}</span>
                  <a href={suiscanAccount(walletAddr)} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    Suiscan {G.link}
                  </a>
                </>
              )}

              {tribeId && (
                <>
                  <span style={fieldLabel}>Tribe</span>
                  <span style={{ ...monoId, gridColumn: "2 / 4" }}>
                    {tribeInfo ? `[${tribeInfo.ticker}] ${tribeInfo.name}` : `tribe ${tribeId}`}
                    <span style={{ color: C.fgFaint, marginLeft: 6 }}>#{tribeId}</span>
                  </span>
                </>
              )}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: `1px solid ${C.divider}`,
            fontSize: 9,
            color: C.fgFaint,
            letterSpacing: "0.1em",
            textAlign: "center",
            background: "rgba(107, 107, 94,0.02)",
          }}
        >
          ESC OR CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Reusable: clickable player link inside the card (for top-targets / nemeses) ──
function PlayerLink({
  itemId,
  name,
  count,
  color,
  onClick,
}: {
  itemId: string;
  name: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "2px 0",
        cursor: "pointer",
        gap: 4,
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "0.7"}
      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
      title={`Open ${name} (#${itemId})`}
    >
      <span style={{ fontSize: 11, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: "rgba(255, 71, 0, 0.45)", textUnderlineOffset: 2 }}>
        {name}
      </span>
      <span style={{ fontSize: 9, color: C.fgFaint }}>×{count}</span>
    </div>
  );
}

// ── Cache + char-by-item-id lookup ────────────────────────────────────────────
const _playerLookupCache = new Map<string, { objectId: string; wallet: string }>();

/** Resolve a character's Sui object id and wallet (character_address) by item_id.
 *  Uses the GraphQL objects() filter — same path used for kill-feed character
 *  resolution. Cached for the process lifetime since identities don't move. */
async function resolveWalletForCharacterItemId(
  itemId: string,
): Promise<{ objectId: string; wallet: string } | null> {
  // We don't have the package id imported here. Read it from the DOM build constant
  // by importing from constants — but we'd cause a circular dep. Instead, use an
  // env-derived value: SERVER_ENV stillness vs utopia. The real WORLD_PKG is
  // set in constants. Import directly:
  const { WORLD_PKG } = await import("../constants");
  const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";

  // Page through Character objects (capped) — small enough since we're only
  // looking for one. Most characters resolve in the first 1-2 pages because
  // GraphQL ordering tends to surface recent ones.
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const after = cursor ? `, after: "${cursor}"` : "";
    const q = `{
      objects(filter: { type: "${WORLD_PKG}::character::Character" }, first: 50${after}) {
        pageInfo { hasNextPage endCursor }
        nodes { address asMoveObject { contents { json } } }
      }
    }`;
    let res: Response;
    try {
      res = await fetch(SUI_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
    } catch {
      return null;
    }
    const j = (await res.json()) as {
      data?: {
        objects: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: Array<{ address: string; asMoveObject: { contents: { json: any } } }>;
        };
      };
    };
    const objs = j.data?.objects;
    if (!objs) return null;
    for (const n of objs.nodes) {
      const json = n.asMoveObject?.contents?.json;
      if (json?.key?.item_id === itemId) {
        return {
          objectId: n.address,
          wallet: json.character_address,
        };
      }
    }
    if (!objs.pageInfo.hasNextPage) return null;
    cursor = objs.pageInfo.endCursor;
  }
  return null;
}
