import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SERVER_ENV } from "../constants";

// ── Suiscan URL helper ────────────────────────────────────────────────────────
const SUISCAN_BASE = "https://suiscan.xyz/testnet";
const suiscanObject = (id: string) => `${SUISCAN_BASE}/object/${id}`;
const suiscanTx = (digest: string) => `${SUISCAN_BASE}/tx/${digest}`;

// ── Time formatting ───────────────────────────────────────────────────────────
function formatRelative(secondsAgo: number): string {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const m = Math.floor(secondsAgo / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatAbsoluteUTC(ts: string): string {
  const ms = parseInt(ts, 10) * 1000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function truncate(addr: string, front = 8, back = 6): string {
  if (!addr || addr.length <= front + back + 3) return addr;
  return `${addr.slice(0, front)}…${addr.slice(-back)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface KillRecord {
  objectId: string;
  kill_timestamp: string;
  killer_id?: { item_id: string };
  victim_id?: { item_id: string };
  solar_system_id?: { item_id: string };
  loss_type?: { ["@variant"]: string };
  reported_by_character_id?: { item_id: string };
  key?: { item_id: string };
  /** populated lazily: tx digest from sui_getObject previousTransaction */
  _txDigest?: string;
}

interface KillCardModalProps {
  kill: KillRecord;
  charMap: Map<string, string>;
  sysMap: Map<string, string>;
  /** Character item_id → tribe_id. Empty / missing = no tribe affiliation. */
  charTribeMap?: Map<string, number>;
  /** tribe_id → { name, ticker }. Empty until tribe metadata resolves. */
  tribeInfoMap?: Map<number, { name: string; ticker: string }>;
  /** All recent kills, used for context intel (recent-system, killer-streak, victim-losses) */
  allKills: KillRecord[];
  /** When provided, killer/victim/reporter names become clickable and open a PlayerCard. */
  onOpenPlayer?: (characterItemId: string) => void;
  onClose: () => void;
}

// ── Color tokens (EVE Frontier-esque) ─────────────────────────────────────────
// CCP Design System palette — Crude/Neutral/Martian Red/Secondary olive.
// Legacy slot names (cyan/cyanDim/cyanFaint) now route to the Secondary
// olive-gray tokens so existing references render as informational chrome.
// Use C.accent for Martian Red highlights.
const C = {
  bg: "#0B0B0B",                              // Crude
  panel: "rgba(11, 11, 11, 0.96)",            // Crude 96%
  fg: "#FAFAE5",                              // Neutral
  fgDim: "rgba(250, 250, 229, 0.55)",
  fgFaint: "rgba(250, 250, 229, 0.30)",
  accent: "#FF4700",                          // Martian Red
  accentDim: "rgba(255, 71, 0, 0.65)",
  accentFaint: "rgba(255, 71, 0, 0.30)",
  border: "rgba(107, 107, 94, 0.42)",         // Secondary 42%
  borderHot: "rgba(255, 71, 0, 0.55)",
  divider: "rgba(107, 107, 94, 0.18)",        // Secondary 18%
  green: "#00ff96",                           // KILL / online
  red: "#ff4444",                             // LOSS / offline
  amber: "rgba(255, 200, 0, 0.85)",           // self-report / warning
  amberDim: "rgba(255, 200, 0, 0.5)",
  orange: "#FF4700",                          // SHIP loss — same as accent
  // Secondary olive-gray (informational chrome)
  cyan: "rgba(186, 185, 167, 0.95)",          // brighter Secondary tint
  cyanDim: "rgba(107, 107, 94, 0.85)",        // Secondary primary
  cyanFaint: "rgba(107, 107, 94, 0.35)",      // Secondary subtle
};

// ── Glyphs (monospace-safe, per TOOLS.md) ─────────────────────────────────────
const G = {
  killmail: "⊕",
  aggressor: "▶",
  victim: "◀",
  reporter: "▷",
  location: "◆",
  chain: "≣",
  intel: "✦",
  link: "↗",
  close: "×",
  divider: "─",
  bullet: "▪",
  corner_tl: "⌜",
  corner_tr: "⌝",
  corner_bl: "⌞",
  corner_br: "⌟",
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

// ── Section wrapper with EVE-esque corner brackets ────────────────────────────
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
      {/* corner accents */}
      <span style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, borderTop: `1px solid ${C.cyan}`, borderLeft: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, borderTop: `1px solid ${C.cyan}`, borderRight: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", bottom: -1, left: -1, width: 6, height: 6, borderBottom: `1px solid ${C.cyan}`, borderLeft: `1px solid ${C.cyan}` }} />
      <span style={{ position: "absolute", bottom: -1, right: -1, width: 6, height: 6, borderBottom: `1px solid ${C.cyan}`, borderRight: `1px solid ${C.cyan}` }} />
      <div style={sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

// ── Combatant (killer/victim) block ───────────────────────────────────────────
function Combatant({
  role,
  glyph,
  name,
  itemId,
  highlight,
  tribeInfo,
  onClick,
}: {
  role: string;
  glyph: string;
  name: string;
  itemId: string;
  highlight: string;
  tribeInfo?: { name: string; ticker: string };
  onClick?: () => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...fieldLabel, marginBottom: 4 }}>{role}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
        <span style={{ color: highlight, fontSize: 14, fontWeight: 700 }}>{glyph}</span>
        <span
          onClick={onClick}
          title={onClick ? `Open ${name} player card` : undefined}
          style={{
            color: highlight,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: `0 0 8px ${highlight === C.green ? "rgba(0,255,150,0.4)" : "rgba(255,68,68,0.4)"}`,
            cursor: onClick ? "pointer" : "default",
            textDecoration: onClick ? "underline" : "none",
            textDecorationColor: "rgba(255, 71, 0, 0.55)",
            textUnderlineOffset: 3,
          }}
        >
          {name}
        </span>
      </div>
      {tribeInfo && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "1px 5px",
              background: "rgba(107, 107, 94,0.08)",
              border: "1px solid rgba(107, 107, 94,0.35)",
              color: "rgba(107, 107, 94,0.95)",
            }}
          >
            {tribeInfo.ticker}
          </span>
          <span style={{ fontSize: 10, color: "rgba(107, 107, 94,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tribeInfo.name}
          </span>
        </div>
      )}
      <div style={{ ...monoId, color: C.fgFaint }}>#{itemId}</div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function KillCardModal({ kill, charMap, sysMap, charTribeMap, tribeInfoMap, allKills, onOpenPlayer, onClose }: KillCardModalProps) {
  // ── Escape key + body scroll lock ─────────
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

  // ── Lazy-fetch tx digest from previousTransaction ─────────
  // Event-sourced kills already carry _txDigest (free from the event
  // payload), so this only fires for legacy GraphQL-sourced kills that
  // have a real Sui object id but no tx digest yet.
  const [txDigest, setTxDigest] = useState<string | null>(kill._txDigest ?? null);
  useEffect(() => {
    if (txDigest) return;
    if (!kill.objectId || kill.objectId.startsWith("evt:")) return; // synthetic id, can't fetch
    let cancelled = false;
    fetch("https://fullnode.testnet.sui.io:443", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [kill.objectId, { showPreviousTransaction: true }],
      }),
    })
      .then((r) => r.json())
      .then((j: { result?: { data?: { previousTransaction?: string } } }) => {
        if (cancelled) return;
        const tx = j?.result?.data?.previousTransaction;
        if (tx) setTxDigest(tx);
      })
      .catch(() => {
        /* silent — tx digest is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [kill.objectId, txDigest]);

  // ── Derived display values ─────────
  const killerId = kill.killer_id?.item_id ?? "";
  const victimId = kill.victim_id?.item_id ?? "";
  const sysId = kill.solar_system_id?.item_id ?? "";
  const reporterId = kill.reported_by_character_id?.item_id ?? "";
  const killmailItemId = kill.key?.item_id ?? "";
  const lossType = kill.loss_type?.["@variant"] ?? "UNKNOWN";

  const killerName = charMap.get(killerId) ?? `Unknown #${killerId.slice(-6)}`;
  const victimName = charMap.get(victimId) ?? `Unknown #${victimId.slice(-6)}`;
  const reporterName = charMap.get(reporterId) ?? `Unknown #${reporterId.slice(-6)}`;
  const systemName = sysMap.get(sysId) ?? `sys-${sysId}`;

  // Tribe enrichment (optional; both maps may be empty/undefined)
  const killerTribeId = charTribeMap?.get(killerId);
  const victimTribeId = charTribeMap?.get(victimId);
  const reporterTribeId = charTribeMap?.get(reporterId);
  const killerTribeInfo = killerTribeId ? tribeInfoMap?.get(killerTribeId) : undefined;
  const victimTribeInfo = victimTribeId ? tribeInfoMap?.get(victimTribeId) : undefined;
  const reporterTribeInfo = reporterTribeId ? tribeInfoMap?.get(reporterTribeId) : undefined;

  // Tribe-on-tribe classification (only when both sides have a tribe)
  let tribeRelation: { label: string; color: string } | null = null;
  if (killerTribeId && victimTribeId) {
    if (killerTribeId === victimTribeId) {
      tribeRelation = { label: "INTRA-TRIBE", color: C.amber };
    } else {
      tribeRelation = { label: "INTER-TRIBE", color: C.cyan };
    }
  }

  // Reporter classification
  let reporterTag = "third-party";
  let reporterTagColor = C.cyanDim;
  if (reporterId && reporterId === victimId) {
    reporterTag = "self-report";
    reporterTagColor = C.amber;
  } else if (reporterId && reporterId === killerId) {
    reporterTag = "killer-claim";
    reporterTagColor = C.orange;
  }

  // Time
  const killTs = parseInt(kill.kill_timestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  const secondsAgo = Math.max(0, nowSec - killTs);

  // ── Context intel ─────────
  const intel = useMemo(() => {
    const dayAgoSec = nowSec - 86400;
    const hourAgoSec = nowSec - 3600;

    const recent24h = allKills.filter((k) => parseInt(k.kill_timestamp, 10) >= dayAgoSec);

    const sameSystem24h = recent24h.filter(
      (k) => k.solar_system_id?.item_id === sysId && k.objectId !== kill.objectId,
    ).length;
    const sameSystem1h = recent24h.filter(
      (k) =>
        k.solar_system_id?.item_id === sysId &&
        k.objectId !== kill.objectId &&
        parseInt(k.kill_timestamp, 10) >= hourAgoSec,
    ).length;

    const killerKills24h = recent24h.filter(
      (k) => k.killer_id?.item_id === killerId && k.objectId !== kill.objectId,
    ).length;

    const victimLosses24h = recent24h.filter(
      (k) => k.victim_id?.item_id === victimId && k.objectId !== kill.objectId,
    ).length;

    // Has the killer killed this victim before?
    const repeatTarget = recent24h.filter(
      (k) =>
        k.killer_id?.item_id === killerId &&
        k.victim_id?.item_id === victimId &&
        k.objectId !== kill.objectId,
    ).length;

    return { sameSystem24h, sameSystem1h, killerKills24h, victimLosses24h, repeatTarget };
  }, [allKills, sysId, killerId, victimId, kill.objectId, nowSec]);

  // ── Render via portal ─────────
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
        zIndex: 9500,
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
          maxWidth: 540,
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

        {/* ── Header ── */}
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
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ color: lossType === "SHIP" ? C.orange : C.red, fontSize: 18, lineHeight: 1 }}>{G.killmail}</span>
              <span style={{ color: C.fg, fontSize: 14, fontWeight: 700, letterSpacing: "0.06em" }}>
                KILLMAIL
              </span>
              {killmailItemId && (
                <span style={{ color: C.cyanDim, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>#{killmailItemId}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 10, color: C.fgDim, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "2px 7px",
                  border: `1px solid ${lossType === "SHIP" ? "rgba(255,71,0,0.4)" : "rgba(255,68,68,0.4)"}`,
                  color: lossType === "SHIP" ? C.orange : C.red,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                }}
              >
                {lossType} LOSS
              </span>
              <span style={{ color: C.cyanDim, letterSpacing: "0.1em" }}>
                {SERVER_ENV.toUpperCase()}
              </span>
              <span style={{ color: C.amberDim, letterSpacing: "0.06em" }}>
                {formatRelative(secondsAgo)}
              </span>
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
            }}
          >
            {G.close}
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 14 }}>
          {/* Combatants */}
          <Section label={`${G.aggressor}  COMBATANTS${tribeRelation ? `  —  ${tribeRelation.label}` : ""}`}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <Combatant
                role="AGGRESSOR"
                glyph={G.aggressor}
                name={killerName}
                itemId={killerId}
                highlight={C.green}
                tribeInfo={killerTribeInfo}
                onClick={onOpenPlayer && killerId ? () => onOpenPlayer(killerId) : undefined}
              />
              <div
                style={{
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 14,
                  gap: 4,
                }}
              >
                <span style={{ color: C.cyanFaint, fontSize: 22, lineHeight: 1 }}>⟶</span>
                {tribeRelation && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: tribeRelation.color,
                      padding: "1px 4px",
                      border: `1px solid ${tribeRelation.color}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tribeRelation.label}
                  </span>
                )}
              </div>
              <Combatant
                role="VICTIM"
                glyph={G.victim}
                name={victimName}
                itemId={victimId}
                highlight={C.red}
                tribeInfo={victimTribeInfo}
                onClick={onOpenPlayer && victimId ? () => onOpenPlayer(victimId) : undefined}
              />
            </div>
          </Section>

          {/* Location + reporter (side by side) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Section label={`${G.location}  LOCATION`}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: C.cyan, fontSize: 13, fontWeight: 700 }}>{systemName}</span>
              </div>
              <div style={{ ...monoId, marginTop: 3 }}>sys-{sysId}</div>
            </Section>

            <Section label={`${G.reporter}  REPORTED BY`}>
              <div
                onClick={onOpenPlayer && reporterId ? () => onOpenPlayer(reporterId) : undefined}
                title={onOpenPlayer && reporterId ? `Open ${reporterName} player card` : undefined}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.fg,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: onOpenPlayer && reporterId ? "pointer" : "default",
                  textDecoration: onOpenPlayer && reporterId ? "underline" : "none",
                  textDecorationColor: "rgba(255, 71, 0, 0.45)",
                  textUnderlineOffset: 3,
                }}
              >
                {reporterName}
              </div>
              {reporterTribeInfo && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      padding: "1px 5px",
                      background: "rgba(107, 107, 94,0.08)",
                      border: "1px solid rgba(107, 107, 94,0.35)",
                      color: "rgba(107, 107, 94,0.95)",
                    }}
                  >
                    {reporterTribeInfo.ticker}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(107, 107, 94,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {reporterTribeInfo.name}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span
                  style={{
                    fontSize: 8,
                    padding: "1px 5px",
                    border: `1px solid ${reporterTagColor}`,
                    color: reporterTagColor,
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                  }}
                >
                  {reporterTag}
                </span>
                <span style={{ ...monoId, color: C.fgFaint }}>#{reporterId}</span>
              </div>
            </Section>
          </div>

          {/* Chain provenance */}
          <Section label={`${G.chain}  ON-CHAIN PROVENANCE`}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "4px 12px", alignItems: "baseline" }}>
              {/* Killmail object id row — only render when we have a real Sui
                  object id (event-sourced kills carry a synthetic 'evt:...'
                  id that isn't valid for Suiscan). */}
              {!kill.objectId.startsWith("evt:") && (
                <>
                  <span style={fieldLabel}>Killmail</span>
                  <span style={monoId}>{truncate(kill.objectId, 10, 8)}</span>
                  <a
                    href={suiscanObject(kill.objectId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                  >
                    Suiscan {G.link}
                  </a>
                </>
              )}

              <span style={fieldLabel}>Tx</span>
              <span style={monoId}>{txDigest ? truncate(txDigest, 10, 8) : "loading…"}</span>
              {txDigest ? (
                <a
                  href={suiscanTx(txDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Suiscan {G.link}
                </a>
              ) : (
                <span style={{ ...monoId, color: C.fgFaint }}>—</span>
              )}

              <span style={fieldLabel}>Block time</span>
              <span style={{ ...monoId, gridColumn: "2 / 4" }}>{formatAbsoluteUTC(kill.kill_timestamp)}</span>
            </div>
          </Section>

          {/* Context intel */}
          <Section label={`${G.intel}  CONTEXT INTEL`}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 11, lineHeight: 1.6 }}>
              {intel.sameSystem1h > 0 && (
                <IntelLine
                  glyph={G.intel}
                  color={C.orange}
                  text={`${intel.sameSystem1h} other kill${intel.sameSystem1h !== 1 ? "s" : ""} in ${systemName} in last hour — active engagement`}
                />
              )}
              {intel.sameSystem24h > 0 && intel.sameSystem1h !== intel.sameSystem24h && (
                <IntelLine
                  glyph={G.intel}
                  color={C.amber}
                  text={`${intel.sameSystem24h} kill${intel.sameSystem24h !== 1 ? "s" : ""} in ${systemName} in last 24h`}
                />
              )}
              {intel.killerKills24h > 0 && (
                <IntelLine
                  glyph={G.intel}
                  color={C.green}
                  text={`Aggressor has ${intel.killerKills24h + 1} kill${intel.killerKills24h + 1 !== 1 ? "s" : ""} in last 24h${intel.killerKills24h + 1 >= 5 ? " — active hunter" : ""}`}
                />
              )}
              {intel.victimLosses24h > 0 && (
                <IntelLine
                  glyph={G.intel}
                  color={C.red}
                  text={`Victim has lost ${intel.victimLosses24h + 1} ship${intel.victimLosses24h + 1 !== 1 ? "s" : ""} in last 24h${intel.victimLosses24h + 1 >= 3 ? " — being farmed" : ""}`}
                />
              )}
              {intel.repeatTarget > 0 && (
                <IntelLine
                  glyph={G.intel}
                  color={C.orange}
                  text={`Aggressor has killed this victim ${intel.repeatTarget + 1}× in last 24h — grudge / serial target`}
                />
              )}
              {intel.sameSystem24h === 0 &&
                intel.killerKills24h === 0 &&
                intel.victimLosses24h === 0 && (
                  <IntelLine
                    glyph={G.bullet}
                    color={C.fgFaint}
                    text="No correlated activity in last 24h. Isolated engagement."
                  />
                )}
            </ul>
          </Section>
        </div>

        {/* ── Footer ── */}
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

function IntelLine({ glyph, color, text }: { glyph: string; color: string; text: string }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 6, color: C.fg }}>
      <span style={{ color, flexShrink: 0, lineHeight: 1.6 }}>{glyph}</span>
      <span style={{ color: C.fg }}>{text}</span>
    </li>
  );
}
