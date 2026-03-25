/**
 * TribeLeaderboardPanel — Keeper Lattice Contribution Ledger
 *
 * Shows which tribe members have contributed the most data to the Keeper lattice.
 * Fetches from /keeper/novelty-stats endpoint and renders a ranked list with
 * submission counts, first-record counts, and avg novelty scores.
 */

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";

const KEEPER_BASE_URL = "https://keeper.reapers.shop";
const NOVELTY_STATS_URL = `${KEEPER_BASE_URL}/keeper/novelty-stats`;
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContributorStat {
  submitter: string;
  count: number;
  totalNovelty: number;
  firstRecords: number;
  avgNovelty: number;
}

interface NoveltyStatsResponse {
  stats: ContributorStat[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function noveltyColor(avg: number): string {
  if (avg >= 70) return "#00ff99";
  if (avg >= 40) return "#ffaa00";
  return "rgba(180,180,160,0.4)";
}

function noveltyLabel(avg: number): string {
  if (avg >= 70) return "HIGH";
  if (avg >= 40) return "MED";
  return "LOW";
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return "#ffd700";
  if (rank === 2) return "#c0c0c0";
  if (rank === 3) return "#cd7f32";
  return "rgba(180,180,160,0.4)";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: {
    fontFamily: "'IBM Plex Mono', monospace",
    background: "var(--bg-terminal, rgba(0,0,0,0.7))",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "var(--text, #c8c8b4)",
    fontSize: 12,
    marginTop: 16,
  } as React.CSSProperties,

  header: {
    padding: "10px 14px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  title: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#00ff99",
    textTransform: "uppercase" as const,
    flex: 1,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 10,
    color: "var(--text-dim, rgba(180,180,160,0.55))",
    padding: "4px 14px 8px",
    letterSpacing: "0.04em",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  } as React.CSSProperties,

  refreshBtn: {
    background: "rgba(0,255,153,0.08)",
    border: "1px solid rgba(0,255,153,0.25)",
    color: "#00ff99",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    padding: "3px 10px",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  listContainer: {
    padding: "4px 0",
  } as React.CSSProperties,

  row: (isMe: boolean, isTop3: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    background: isMe
      ? "rgba(0,255,153,0.04)"
      : isTop3
        ? "rgba(255,255,255,0.015)"
        : "transparent",
    borderLeft: isMe ? "2px solid rgba(0,255,153,0.4)" : "2px solid transparent",
  }),

  rankBadge: (rank: number): React.CSSProperties => ({
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    color: rankBadgeColor(rank),
    flexShrink: 0,
  }),

  wallet: {
    fontSize: 11,
    color: "var(--text, #c8c8b4)",
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: "0.04em",
    minWidth: 120,
  } as React.CSSProperties,

  stat: (color?: string): React.CSSProperties => ({
    fontSize: 10,
    color: color ?? "var(--text-dim, rgba(180,180,160,0.55))",
    minWidth: 36,
    textAlign: "right" as const,
    flexShrink: 0,
  }),

  statLabel: {
    fontSize: 8,
    color: "rgba(180,180,160,0.35)",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  bar: (_pct: number, _color: string): React.CSSProperties => ({
    width: 60,
    height: 3,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative" as const,
  }),

  barFill: (pct: number, color: string): React.CSSProperties => ({
    width: `${Math.min(100, Math.max(0, pct))}%`,
    height: "100%",
    background: color,
    transition: "width 0.4s ease",
  }),

  myStanding: {
    margin: "0 14px 10px",
    padding: "8px 12px",
    background: "rgba(0,255,153,0.04)",
    border: "1px solid rgba(0,255,153,0.2)",
  } as React.CSSProperties,

  myStandingTitle: {
    fontSize: 9,
    color: "rgba(0,255,153,0.7)",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  } as React.CSSProperties,

  loading: {
    padding: "20px",
    textAlign: "center" as const,
    color: "rgba(180,180,160,0.4)",
    fontSize: 11,
    letterSpacing: "0.08em",
  } as React.CSSProperties,

  error: {
    padding: "10px 14px",
    background: "rgba(255,68,68,0.06)",
    border: "1px solid rgba(255,68,68,0.2)",
    color: "#ff6666",
    fontSize: 11,
    margin: "8px 14px",
  } as React.CSSProperties,

  empty: {
    padding: "16px",
    textAlign: "center" as const,
    color: "rgba(180,180,160,0.3)",
    fontSize: 11,
  } as React.CSSProperties,

  lastUpdated: {
    fontSize: 9,
    color: "rgba(180,180,160,0.3)",
    padding: "4px 14px 8px",
    letterSpacing: "0.06em",
  } as React.CSSProperties,
};

// ── Row component ─────────────────────────────────────────────────────────────

function ContributorRow({
  stat,
  rank,
  maxCount,
  isMe,
}: {
  stat: ContributorStat;
  rank: number;
  maxCount: number;
  isMe: boolean;
}) {
  const pct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
  const nColor = noveltyColor(stat.avgNovelty);
  const isTop3 = rank <= 3;

  return (
    <div style={S.row(isMe, isTop3)}>
      {/* Rank */}
      <div style={S.rankBadge(rank)}>
        {rank <= 3 ? ["◆", "◇", "○"][rank - 1] : rank}
      </div>

      {/* Wallet */}
      <span style={{ ...S.wallet, color: isMe ? "#00ff99" : undefined }}>
        {truncateAddress(stat.submitter)}
        {isMe && <span style={{ fontSize: 8, color: "rgba(0,255,153,0.6)", marginLeft: 4 }}>YOU</span>}
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Contribution bar */}
      <div style={S.bar(pct, nColor)}>
        <div style={S.barFill(pct, nColor)} />
      </div>

      {/* Submission count */}
      <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
        <div style={{ ...S.stat(), color: "#c8c8b4", fontWeight: 600 }}>{stat.count}</div>
        <div style={S.statLabel}>subs</div>
      </div>

      {/* First records */}
      <div style={{ textAlign: "right" as const, flexShrink: 0, minWidth: 32 }}>
        <div style={{ ...S.stat(stat.firstRecords > 0 ? "#ffd700" : undefined) }}>
          {stat.firstRecords > 0 ? `★${stat.firstRecords}` : "—"}
        </div>
        <div style={S.statLabel}>1st</div>
      </div>

      {/* Avg novelty */}
      <div style={{ textAlign: "right" as const, flexShrink: 0, minWidth: 44 }}>
        <div style={{ ...S.stat(nColor), fontWeight: 600 }}>{stat.avgNovelty.toFixed(0)}</div>
        <div style={{ ...S.statLabel, color: nColor, opacity: 0.7 }}>{noveltyLabel(stat.avgNovelty)}</div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TribeLeaderboardPanel({ compact = false }: { compact?: boolean }) {
  const account = useCurrentAccount();
  const myAddress = account?.address;

  const [stats, setStats] = useState<ContributorStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(NOVELTY_STATS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as NoveltyStatsResponse;
      const sorted = [...(data.stats ?? [])].sort((a, b) => b.count - a.count);
      setStats(sorted);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(fetchStats, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchStats]);

  const displayStats = compact ? stats.slice(0, 3) : stats;
  const maxCount = stats.length > 0 ? stats[0].count : 1;
  const myEntry = myAddress ? stats.find(s => s.submitter === myAddress) : null;
  const myRank = myAddress ? stats.findIndex(s => s.submitter === myAddress) + 1 : 0;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>
          {compact ? "TOP CONTRIBUTORS" : "KEEPER LATTICE — CONTRIBUTION LEDGER"}
        </span>
        <button
          style={S.refreshBtn}
          onClick={fetchStats}
          disabled={loading}
          title="Refresh contribution data"
        >
          {loading ? "…" : "↻ REFRESH"}
        </button>
      </div>

      {!compact && (
        <div style={S.subtitle}>
          Pilots who have offered the most knowledge to the lattice
        </div>
      )}

      {/* Loading */}
      {loading && stats.length === 0 && (
        <div style={S.loading}>◆ ◆ ◆ scanning lattice…</div>
      )}

      {/* Error */}
      {error && (
        <div style={S.error}>⚠ {error}</div>
      )}

      {/* Empty */}
      {!loading && !error && stats.length === 0 && (
        <div style={S.empty}>No contributions recorded yet</div>
      )}

      {/* List */}
      {displayStats.length > 0 && (
        <div style={S.listContainer}>
          {/* Column headers */}
          {!compact && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 14px 4px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{ width: 18, flexShrink: 0 }} />
              <span style={{ ...S.statLabel, flex: 1 }}>Pilot</span>
              <span style={{ ...S.statLabel, width: 60, textAlign: "right" as const }}>Rel.</span>
              <span style={{ ...S.statLabel, minWidth: 36, textAlign: "right" as const }}>Subs</span>
              <span style={{ ...S.statLabel, minWidth: 32, textAlign: "right" as const }}>1st Rec</span>
              <span style={{ ...S.statLabel, minWidth: 44, textAlign: "right" as const }}>Avg Nov</span>
            </div>
          )}

          {displayStats.map((stat, i) => (
            <ContributorRow
              key={stat.submitter}
              stat={stat}
              rank={i + 1}
              maxCount={maxCount}
              isMe={stat.submitter === myAddress}
            />
          ))}
        </div>
      )}

      {/* Last updated timestamp */}
      {!compact && lastUpdated && (
        <div style={S.lastUpdated}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* YOUR STANDING — only show in full mode if wallet connected and in list */}
      {!compact && myEntry && myRank > 0 && (
        <div style={S.myStanding}>
          <div style={S.myStandingTitle}>◆ YOUR STANDING</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const, fontSize: 11 }}>
            <span>Rank: <span style={{ color: "#00ff99", fontWeight: 700 }}>#{myRank}</span></span>
            <span>Submissions: <span style={{ color: "#c8c8b4", fontWeight: 600 }}>{myEntry.count}</span></span>
            {myEntry.firstRecords > 0 && (
              <span>First Records: <span style={{ color: "#ffd700", fontWeight: 600 }}>★ {myEntry.firstRecords}</span></span>
            )}
            <span>Avg Novelty: <span style={{ color: noveltyColor(myEntry.avgNovelty), fontWeight: 600 }}>{myEntry.avgNovelty.toFixed(1)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
