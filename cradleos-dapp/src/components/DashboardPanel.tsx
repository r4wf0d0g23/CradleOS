import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { TribeLeaderboardPanel } from "./TribeLeaderboardPanel";
import { LinksPanel } from "./LinksPanel";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { SERVER_ENV, CRADLEOS_PKG, CRADLEOS_ORIGINAL, CLOCK, SUI_TESTNET_RPC } from "../constants";
import { Transaction } from "@mysten/sui/transactions";
import { useSponsoredTransaction, SponsoredTransactionActions, Assemblies } from "@evefrontier/dapp-kit";
import type { AssemblyType } from "@evefrontier/dapp-kit";
import {
  fetchPlayerStructures,
  buildStructureOnlineTransaction,
  buildStructureOfflineTransaction,
  buildRenameTransaction,
  findCharacterForWallet,
  discoverVaultIdForTribe,
  type PlayerStructure,
  type LocationGroup,
} from "../lib";

// ── EVE Frontier official dApp base
// Stillness = dapps.evefrontier.com, Utopia = uat.dapps.evefrontier.com
const EVE_DAPP_BASE = SERVER_ENV === "stillness"
  ? "https://dapps.evefrontier.com/"
  : "https://uat.dapps.evefrontier.com/";

/* openInDApp removed — structure names now link to embedded iframe */

// ── Styles (consistent with IntelDashboardPanel)
const S = {
  panel: {
    background: "rgba(0,0,0,0.7)",
    color: "#c8c8b4",
    fontFamily: "monospace",
    fontSize: 12,
    padding: 16,
    minHeight: 400,
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  sectionHead: {
    color: "#FF4700",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none" as const,
  } as React.CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexWrap: "wrap" as const,
    background: "rgba(255,255,255,0.015)",
    marginBottom: 2,
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
  statusDot: (status: "online" | "offline" | "anchored"): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    background:
      status === "online" ? "#00ff96"
      : status === "anchored" ? "#ffd700"
      : "#ff4444",
    boxShadow:
      status === "online" ? "0 0 4px #00ff96"
      : status === "anchored" ? "0 0 4px #ffd700"
      : "none",
  }),
  muted: { color: "rgba(180,180,160,0.6)", fontSize: 11 } as React.CSSProperties,
  loading: { color: "rgba(180,180,160,0.5)", padding: 16, textAlign: "center" as const },
  empty: { color: "rgba(180,180,160,0.4)", padding: 24, textAlign: "center" as const },
  btn: (variant: "primary" | "danger" | "ghost"): React.CSSProperties => ({
    background:
      variant === "primary" ? "rgba(255,71,0,0.15)"
      : variant === "danger"  ? "rgba(255,68,68,0.15)"
      : "rgba(255,255,255,0.04)",
    border: `1px solid ${
      variant === "primary" ? "rgba(255,71,0,0.5)"
      : variant === "danger"  ? "rgba(255,68,68,0.5)"
      : "rgba(255,255,255,0.15)"
    }`,
    color:
      variant === "primary" ? "#FF4700"
      : variant === "danger"  ? "#ff4444"
      : "#c8c8b4",
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    padding: "3px 9px",
    cursor: "pointer",
    borderRadius: 0,
  }),
  refreshBtn: {
    background: "rgba(255,71,0,0.1)",
    border: "1px solid rgba(255,71,0,0.3)",
    color: "#FF4700",
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    padding: "4px 12px",
    cursor: "pointer",
    borderRadius: 0,
    marginLeft: "auto",
  } as React.CSSProperties,
  input: {
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,71,0,0.4)",
    color: "#c8c8b4",
    fontFamily: "monospace",
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 0,
    outline: "none",
    width: 200,
  } as React.CSSProperties,
  fuelBar: (_pct: number): React.CSSProperties => ({
    display: "inline-block",
    width: 60,
    height: 5,
    background: "rgba(255,255,255,0.08)",
    verticalAlign: "middle",
    position: "relative" as const,
    overflow: "hidden",
  }),
  err: {
    background: "rgba(255,68,68,0.1)",
    border: "1px solid rgba(255,68,68,0.4)",
    color: "#ff4444",
    padding: "6px 10px",
    fontSize: 11,
    marginTop: 4,
    marginBottom: 4,
  } as React.CSSProperties,
};

function FuelBar({ pct }: { pct: number }) {
  const color = pct >= 50 ? "#00ff96" : pct >= 10 ? "#ffd700" : "#ff4444";
  return (
    <span style={S.fuelBar(pct)}>
      <span
        style={{
          display: "block",
          width: `${Math.min(100, pct)}%`,
          height: "100%",
          background: color,
        }}
      />
    </span>
  );
}

// ── Structure card ────────────────────────────────────────────────────────────

function StructureCard({
  structure,
  characterId,
  onRefresh,
}: {
  structure: PlayerStructure;
  characterId: string;
  onRefresh: () => void;
}) {
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const statusLabel: "online" | "offline" | "anchored" =
    structure.isOnline ? "online" : "offline";

  // itemId handled inline in name click handler

  const handleOnline = async () => {
    setBusy(true); setErr(null);
    try {
      const tx = await buildStructureOnlineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleOffline = async () => {
    setBusy(true); setErr(null);
    try {
      const tx = await buildStructureOfflineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleRename = async () => {
    const name = nameInput.trim();
    if (!name) { setRenaming(false); return; }
    setBusy(true); setErr(null);
    try {
      const tx = buildRenameTransaction(structure, characterId, name);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setRenaming(false);
      setNameInput("");
      setDescInput("");
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={S.row}>
        {/* Status dot */}
        <span style={S.statusDot(statusLabel)} title={statusLabel.toUpperCase()} />

        {/* Name + kind — name opens CCP dApp in popup window */}
        <span
          style={{ fontWeight: 700, minWidth: 140, fontSize: 12, color: "#FF4700", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(255,71,0,0.3)", textUnderlineOffset: "2px" }}
          onClick={() => {
            const id = structure.gameItemId ?? structure.objectId;
            const url = `${EVE_DAPP_BASE}?itemId=${id}&tenant=${SERVER_ENV}`;
            window.open(url, "eve-dapp", "width=800,height=700,menubar=no,toolbar=no,location=no,status=no");
          }}
          title="Open structure controls"
        >
          {structure.displayName}
        </span>
        <span style={S.muted}>{structure.label}</span>

        {/* Status badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: structure.isOnline ? "#00ff96" : "#ff6432",
            border: `1px solid ${structure.isOnline ? "rgba(0,255,150,0.3)" : "rgba(255,100,50,0.3)"}`,
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {structure.isOnline ? "● ONLINE" : "○ OFFLINE"}
        </span>

        {/* Fuel (NetworkNode only) */}
        {structure.fuelLevelPct !== undefined && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FuelBar pct={structure.fuelLevelPct} />
            <span
              style={{
                fontSize: 10,
                color:
                  structure.fuelLevelPct >= 50 ? "#00ff96"
                  : structure.fuelLevelPct >= 10 ? "#ffd700"
                  : "#ff4444",
              }}
            >
              {structure.fuelLevelPct.toFixed(1)}%
            </span>
            {structure.runtimeHoursRemaining !== undefined && (
              <span style={S.muted}>
                ~{Math.round(structure.runtimeHoursRemaining)}h
              </span>
            )}
          </span>
        )}

        {/* Energy cost badge */}
        {structure.energyCost !== undefined && structure.energyCost > 0 && (
          <span style={{ fontSize: 10, color: "rgba(255,180,50,0.8)" }}>
            {structure.energyCost} EP
          </span>
        )}

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Controls */}
        {!busy && (
          <>
            <button
              style={S.btn(structure.isOnline ? "danger" : "primary")}
              onClick={structure.isOnline ? handleOffline : handleOnline}
              title={structure.isOnline ? "Take offline" : "Bring online"}
            >
              {structure.isOnline ? "OFFLINE" : "ONLINE"}
            </button>
            <button
              style={S.btn("ghost")}
              onClick={() => { setRenaming(r => !r); setNameInput(structure.displayName); }}
              title="Edit name/description"
            >
              EDIT
            </button>
            {/* dApp link removed — name is now the link */}
          </>
        )}
        {busy && (
          <span style={{ ...S.muted, fontStyle: "italic" }}>[ tx pending... ]</span>
        )}
      </div>

      {/* Error display */}
      {err && <div style={S.err}>⚠ {err}</div>}

      {/* Rename form */}
      {renaming && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,71,0,0.2)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          <input
            style={S.input}
            placeholder="New name…"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            maxLength={64}
          />
          <input
            style={{ ...S.input, width: 180 }}
            placeholder="Description (optional)…"
            value={descInput}
            onChange={e => setDescInput(e.target.value)}
            maxLength={128}
          />
          <button style={S.btn("primary")} onClick={handleRename} disabled={busy}>
            SAVE
          </button>
          <button
            style={S.btn("ghost")}
            onClick={() => { setRenaming(false); setNameInput(""); setDescInput(""); }}
          >
            CANCEL
          </button>
        </div>
      )}
    </div>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

// @ts-ignore unused
function _StructureGroup({
  label,
  structures,
  characterId,
  onRefresh,
}: {
  label: string;
  structures: PlayerStructure[];
  characterId: string;
  onRefresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const onlineCount = structures.filter(s => s.isOnline).length;

  return (
    <div>
      <div
        style={S.sectionHead}
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setCollapsed(c => !c); }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
          {collapsed ? "▸" : "▾"}
        </span>
        <span>{label.toUpperCase()}</span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 400,
            letterSpacing: 0.5,
          }}
        >
          ({structures.length} · {onlineCount} online)
        </span>
      </div>

      {!collapsed && (
        <div>
          {structures.map(s => (
            <StructureCard
              key={s.objectId}
              structure={s}
              characterId={characterId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary stats bar ─────────────────────────────────────────────────────────

// ── Topology Drill-Down (Bubble Navigation) ──────────────────────────────────
// Level 0: Systems overview (big bubbles per system + hidden/exposed split)
// Level 1: Nodes in selected system
// Level 2: Structures attached to selected node

const KIND_COLORS: Record<string, string> = {
  "Network Node": "#FF4700",
  "Smart Gate": "#00ccff",
  "Smart Turret": "#ff4444",
  "Smart Storage Unit": "#ffd700",
  "Manufacturing": "#88cc44",
  "Refinery": "#cc88ff",
  "Assembly": "#ff8844",
};

const KIND_ICONS: Record<string, string> = {
  "Network Node": "⚡",
  "Smart Gate": "⛩",
  "Smart Turret": "⊕",
  "Smart Storage Unit": "◫",
  "Manufacturing": "⚙",
  "Refinery": "⬡",
  "Assembly": "⊞",
};

type BubbleItem = {
  id: string;
  label: string;
  sublabel?: string;
  count?: number;
  online?: number;
  offline?: number;
  color: string;
  icon?: string;
  fuelPct?: number;
  fuelHours?: number;
  isOnline?: boolean;
  onClick?: () => void;
  onDApp?: () => void;
  typeDots?: Array<{ color: string; online: boolean }>;
};

function BubbleGrid({ items, title, breadcrumb, onBack }: {
  items: BubbleItem[];
  title: string;
  breadcrumb?: string[];
  onBack?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div>
      {/* Navigation header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", marginBottom: 12, borderBottom: "1px solid rgba(255,71,0,0.15)" }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: "none", border: "1px solid rgba(255,71,0,0.3)", color: "#FF4700", padding: "5px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.04em" }}
          >
            ←
          </button>
        )}
        {breadcrumb && breadcrumb.length > 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            {breadcrumb.join(" › ")} ›
          </span>
        )}
        <span style={{ fontSize: 18, fontWeight: 700, color: "#FF4700", letterSpacing: "0.04em" }}>
          {title}
        </span>
      </div>

      {/* Bubble grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", padding: "10px 0" }}>
        {items.map(item => {
          const isHov = hovered === item.id;
          const bubbleSize = Math.max(140, Math.min(200, 120 + (item.count ?? 1) * 6));
          return (
            <div
              key={item.id}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: bubbleSize, minHeight: bubbleSize,
                borderRadius: "50%",
                border: `2.5px solid ${isHov ? item.color : `${item.color}66`}`,
                background: isHov
                  ? `radial-gradient(circle at 40% 40%, ${item.color}18, rgba(5,3,2,0.95))`
                  : "radial-gradient(circle at 40% 40%, rgba(255,71,0,0.04), rgba(5,3,2,0.95))",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: item.onClick ? "pointer" : "default",
                transition: "all 0.2s",
                position: "relative",
                boxShadow: isHov ? `0 0 30px ${item.color}33` : "0 0 10px rgba(255,71,0,0.05)",
                padding: "12px 8px",
              }}
              onClick={item.onClick}
            >
              {/* Icon */}
              {item.icon && (
                <div style={{ fontSize: 24, marginBottom: 4, opacity: 0.8 }}>{item.icon}</div>
              )}

              {/* Label */}
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color, textAlign: "center", lineHeight: 1.2, marginBottom: 4, padding: "0 6px" }}>
                {item.label}
              </div>

              {/* Sublabel */}
              {item.sublabel && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 4 }}>
                  {item.sublabel}
                </div>
              )}

              {/* Count */}
              {item.count !== undefined && (
                <div style={{ fontSize: 28, fontWeight: 700, color: "#ddd" }}>{item.count}</div>
              )}

              {/* Online/offline stats */}
              {(item.online !== undefined || item.offline !== undefined) && (
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {item.online !== undefined && <span style={{ fontSize: 12, color: "#00ff96", fontWeight: 600 }}>{item.online}↑</span>}
                  {item.offline !== undefined && item.offline > 0 && <span style={{ fontSize: 12, color: "#ff4444", fontWeight: 600 }}>{item.offline}↓</span>}
                </div>
              )}

              {/* Fuel bar (for nodes) */}
              {item.fuelPct !== undefined && (
                <div style={{ marginTop: 6, width: "60%", textAlign: "center" }}>
                  <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, item.fuelPct)}%`, height: "100%", background: item.fuelPct > 50 ? "#00ff96" : item.fuelPct > 10 ? "#ffd700" : "#ff4444" }} />
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                    {item.fuelPct.toFixed(0)}% fuel{item.fuelHours !== undefined ? ` · ~${Math.round(item.fuelHours)}h` : ""}
                  </div>
                </div>
              )}

              {/* Status indicator */}
              {item.isOnline !== undefined && (
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.isOnline ? "#00ff96" : "#ff4444", display: "inline-block", boxShadow: `0 0 6px ${item.isOnline ? "#00ff96" : "#ff4444"}` }} />
                </div>
              )}

              {/* Type composition dots (for system bubbles) */}
              {item.typeDots && item.typeDots.length > 0 && (
                <>
                  {item.typeDots.slice(0, 24).map((dot, di) => {
                    const angle = (di / Math.min(24, item.typeDots!.length)) * 2 * Math.PI - Math.PI / 2;
                    const dotR = bubbleSize / 2 - 6;
                    return (
                      <div key={di} style={{
                        position: "absolute",
                        width: 6, height: 6, borderRadius: "50%",
                        background: dot.color,
                        opacity: dot.online ? 0.8 : 0.25,
                        left: bubbleSize / 2 + Math.cos(angle) * dotR - 3,
                        top: bubbleSize / 2 + Math.sin(angle) * dotR - 3,
                        pointerEvents: "none",
                      }} />
                    );
                  })}
                </>
              )}

              {/* dApp link indicator */}
              {item.onDApp && isHov && (
                <div
                  style={{ position: "absolute", bottom: -10, fontSize: 9, color: "rgba(255,71,0,0.6)", background: "rgba(5,3,2,0.9)", padding: "2px 8px", border: "1px solid rgba(255,71,0,0.2)", whiteSpace: "nowrap", pointerEvents: "none" }}
                >
                  click to open controls ↗
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(KIND_COLORS).map(([kind, color]) => (
          <span key={kind} style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", opacity: 0.7 }} />
            {kind.replace("Smart ", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

function TopologyGraph({ groups, characterId, onRefresh, onNavigate }: { groups: LocationGroup[]; characterId: string; onRefresh: () => void; onNavigate?: (tab: string) => void }) {
  const dAppKit = useDAppKit();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const handleOnline = async (s: PlayerStructure) => {
    setActionBusy(s.objectId); setActionErr(null);
    try {
      const tx = await buildStructureOnlineTransaction(s, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  const handleOffline = async (s: PlayerStructure) => {
    setActionBusy(s.objectId); setActionErr(null);
    try {
      const tx = await buildStructureOfflineTransaction(s, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  const handleRename = async (s: PlayerStructure) => {
    const name = prompt("New name:", s.displayName);
    if (!name?.trim()) return;
    setActionBusy(s.objectId); setActionErr(null);
    try {
      const tx = buildRenameTransaction(s, characterId, name.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  // Delegation: assign structure to tribe policy
  const account = useCurrentAccount();
  const [delegationState, setDelegationState] = useState<Map<string, boolean>>(() => {
    // Restore from localStorage
    const m = new Map<string, boolean>();
    const structs = groups.flatMap(g => g.structures);
    for (const s of structs) {
      if (localStorage.getItem(`delegation:${s.objectId}`)) m.set(s.objectId, true);
    }
    return m;
  });

  const handleDelegate = async (s: PlayerStructure, tribeVaultId: string) => {
    setActionBusy(s.objectId); setActionErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::delegate_to_tribe`,
        arguments: [
          tx.pure.address(s.objectId),
          tx.pure.address(tribeVaultId),
          tx.object(CLOCK),
        ],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.setItem(`delegation:${s.objectId}`, tribeVaultId);
      // Cache delegation object ID
      try {
        const ownedRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getOwnedObjects",
            params: [account?.address, { filter: { StructType: `${CRADLEOS_ORIGINAL}::turret_delegation::TurretDelegation` }, options: { showContent: true } }, null, 50] }),
        });
        const ownedJson = await ownedRes.json() as any;
        const match = ownedJson.result?.data?.find((o: any) => o.data?.content?.fields?.structure_id === s.objectId);
        if (match?.data?.objectId) localStorage.setItem(`delegation-obj:${s.objectId}`, match.data.objectId);
      } catch { /* non-critical */ }
      setDelegationState(prev => new Map(prev).set(s.objectId, true));
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  const handleRevoke = async (s: PlayerStructure) => {
    const delegationObjId = localStorage.getItem(`delegation-obj:${s.objectId}`);
    if (!delegationObjId) { setActionErr("Delegation object not found. Re-apply first."); return; }
    setActionBusy(s.objectId); setActionErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::revoke_delegation`,
        arguments: [tx.object(delegationObjId), tx.object(CLOCK)],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.removeItem(`delegation:${s.objectId}`);
      localStorage.removeItem(`delegation-obj:${s.objectId}`);
      setDelegationState(prev => { const m = new Map(prev); m.delete(s.objectId); return m; });
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  const isDelegatable = (s: PlayerStructure) => s.kind === "Turret" || s.kind === "Gate";
  const isDelegated = (s: PlayerStructure) => delegationState.get(s.objectId) ?? false;

  // Gate link/unlink via EVE Vault sponsored transaction
  const { mutateAsync: sendSponsoredTx } = useSponsoredTransaction();
  const [gateActionState, setGateActionState] = useState<{ gateId: string; status: string } | null>(null);

  // Get all owned unlinked gates for destination selection
  const allGates = useMemo(() =>
    groups.flatMap(g => g.structures).filter(s => s.kind === "Gate"),
    [groups]
  );

  const handleLinkGate = async (sourceGate: PlayerStructure, _destinationGateId: string) => {
    if (!account || !sourceGate.gameItemId) return;
    setGateActionState({ gateId: sourceGate.objectId, status: "Requesting link via EVE Vault…" });
    try {
      // Build a fake assembly object for the hook — it reads item_id + type
      const assemblyObj = {
        item_id: Number(sourceGate.gameItemId),
        type: Assemblies.SmartGate,
        // Other fields required by AssemblyType — minimal shape
        id: sourceGate.objectId,
        dappURL: undefined,
        name: sourceGate.displayName,
        state: sourceGate.isOnline ? "online" : "anchored",
        ownerId: account.address,
      } as unknown as AssemblyType<Assemblies.SmartGate>;

      const result = await sendSponsoredTx({
        txAction: SponsoredTransactionActions.LINK_SMART_GATE,
        assembly: assemblyObj,
        chain: `sui:testnet` as `sui:${string}`,
      });
      setGateActionState({ gateId: sourceGate.objectId, status: `✓ Linked (tx: ${result.digest?.slice(0, 10)}…)` });
      setTimeout(() => { setGateActionState(null); onRefresh(); }, 3000);
    } catch (e) {
      setGateActionState({ gateId: sourceGate.objectId, status: `✗ ${e instanceof Error ? e.message : String(e)}` });
      setTimeout(() => setGateActionState(null), 5000);
    }
  };

  const handleUnlinkGate = async (gate: PlayerStructure) => {
    if (!account || !gate.gameItemId) return;
    setGateActionState({ gateId: gate.objectId, status: "Requesting unlink via EVE Vault…" });
    try {
      const assemblyObj = {
        item_id: Number(gate.gameItemId),
        type: Assemblies.SmartGate,
        id: gate.objectId,
        dappURL: undefined,
        name: gate.displayName,
        state: gate.isOnline ? "online" : "anchored",
        ownerId: account.address,
      } as unknown as AssemblyType<Assemblies.SmartGate>;

      const result = await sendSponsoredTx({
        txAction: SponsoredTransactionActions.UNLINK_SMART_GATE,
        assembly: assemblyObj,
        chain: `sui:testnet` as `sui:${string}`,
      });
      setGateActionState({ gateId: gate.objectId, status: `✓ Unlinked (tx: ${result.digest?.slice(0, 10)}…)` });
      setTimeout(() => { setGateActionState(null); onRefresh(); }, 3000);
    } catch (e) {
      setGateActionState({ gateId: gate.objectId, status: `✗ ${e instanceof Error ? e.message : String(e)}` });
      setTimeout(() => setGateActionState(null), 5000);
    }
  };

  // Discover tribe vault ID
  const [tribeVaultId, setTribeVaultId] = useState<string>(() => localStorage.getItem("cradleos_tribe_vault_id") ?? "");
  useEffect(() => {
    if (tribeVaultId || !characterId || !account?.address) return;
    let cancelled = false;
    findCharacterForWallet(account.address).then(info => {
      if (cancelled || !info?.tribeId) return;
      return discoverVaultIdForTribe(info.tribeId);
    }).then(vid => {
      if (cancelled || !vid) return;
      setTribeVaultId(vid);
      localStorage.setItem("cradleos_tribe_vault_id", vid);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [characterId, account?.address, tribeVaultId]);
  const [level, setLevel] = useState<"systems" | "nodes" | "structures">("systems");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focused, setFocused] = useState<PlayerStructure | null>(null);

  const allStructures = useMemo(() => groups.flatMap(g => g.structures), [groups]);
  const totalOnline = allStructures.filter(s => s.isOnline).length;

  const kindColor = (s: PlayerStructure) => KIND_COLORS[s.label] ?? "rgba(255,255,255,0.5)";
  const kindIcon = (s: PlayerStructure) => KIND_ICONS[s.label] ?? "●";

  const openDApp = (s: PlayerStructure) => {
    const id = s.gameItemId ?? s.objectId;
    window.open(`${EVE_DAPP_BASE}?itemId=${id}&tenant=${SERVER_ENV}`, "eve-dapp", "width=800,height=700,menubar=no,toolbar=no,location=no,status=no");
  };

  // Build per-system topology
  const systems = useMemo(() => {
    return groups.map(g => {
      const nodes = g.structures.filter(s => s.kind === "NetworkNode");
      const others = g.structures.filter(s => s.kind !== "NetworkNode");
      const nodeChildren = new Map<string, PlayerStructure[]>();
      const orphans: PlayerStructure[] = [];
      for (const n of nodes) nodeChildren.set(n.objectId, []);
      for (const s of others) {
        if (s.energySourceId && nodeChildren.has(s.energySourceId)) {
          nodeChildren.get(s.energySourceId)!.push(s);
        } else {
          orphans.push(s);
        }
      }
      return { ...g, nodes, nodeChildren, orphans };
    });
  }, [groups]);

  // ── LEVEL 0: Systems ──
  if (level === "systems") {
    // Split into exposed (has location/system) vs hidden (unknown system)
    const exposed = systems.filter(s => s.solarSystemId !== undefined);
    const hidden = systems.filter(s => s.solarSystemId === undefined);
    const hiddenStructures = hidden.flatMap(s => s.structures);

    const items: BubbleItem[] = [];

    // System bubbles
    for (const sys of exposed) {
      const on = sys.structures.filter(s => s.isOnline).length;
      items.push({
        id: sys.key,
        label: sys.tabLabel,
        sublabel: `${sys.nodes.length} node${sys.nodes.length !== 1 ? "s" : ""}`,
        count: sys.structures.length,
        online: on,
        offline: sys.structures.length - on,
        color: "#FF4700",
        icon: "☉",
        onClick: () => { setSelectedSystem(sys.key); setLevel("nodes"); },
        typeDots: sys.structures.map(s => ({ color: kindColor(s), online: s.isOnline })),
      });
    }

    // Hidden structures bubble (if any)
    if (hiddenStructures.length > 0) {
      const on = hiddenStructures.filter(s => s.isOnline).length;
      items.push({
        id: "hidden",
        label: "Hidden",
        sublabel: "system not revealed",
        onClick: () => { setSelectedSystem("hidden"); setLevel("nodes"); },
        count: hiddenStructures.length,
        online: on,
        offline: hiddenStructures.length - on,
        color: "rgba(255,255,255,0.55)",
        icon: "?",
        typeDots: hiddenStructures.map(s => ({ color: kindColor(s), online: s.isOnline })),
      });
    }

    return (
      <div style={{ marginBottom: 12 }}>
        {/* Summary */}
        <div style={{ display: "flex", gap: 20, padding: "10px 14px", marginBottom: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", alignItems: "center" }}>
          <span><span style={{ fontSize: 26, fontWeight: 700, color: "#ddd" }}>{allStructures.length}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}> structures</span></span>
          <span><span style={{ fontSize: 26, fontWeight: 700, color: "#00ff96" }}>{totalOnline}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}> online</span></span>
          <span><span style={{ fontSize: 26, fontWeight: 700, color: "#FF4700" }}>{exposed.length}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}> systems</span></span>
          {hiddenStructures.length > 0 && (
            <span><span style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{hiddenStructures.length}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}> hidden</span></span>
          )}
        </div>
        <BubbleGrid items={items} title="YOUR SYSTEMS" />
      </div>
    );
  }

  // ── LEVEL 1: Nodes in system ──
  if (level === "nodes" && selectedSystem) {
    // For hidden systems, merge all unlocated system groups into one virtual system
    // so the multi-node topology view still works
    const sys = selectedSystem === "hidden"
      ? (() => {
          const hiddenSystems = systems.filter(s => s.solarSystemId === undefined);
          const allStructures = hiddenSystems.flatMap(s => s.structures);
          const nodes = allStructures.filter(s => s.kind === "NetworkNode");
          const others = allStructures.filter(s => s.kind !== "NetworkNode");
          const nodeChildren = new Map<string, PlayerStructure[]>();
          const orphans: PlayerStructure[] = [];
          for (const n of nodes) nodeChildren.set(n.objectId, []);
          for (const s of others) {
            if (s.energySourceId && nodeChildren.has(s.energySourceId)) {
              nodeChildren.get(s.energySourceId)!.push(s);
            } else {
              orphans.push(s);
            }
          }
          return { key: "hidden", tabLabel: "Hidden Structures", structures: allStructures, nodes, nodeChildren, orphans, solarSystemId: undefined };
        })()
      : systems.find(s => s.key === selectedSystem);
    if (!sys) { setLevel("systems"); return null; }

    // ── Multi-node topology view ──
    // Each node is a hub with its child structures displayed around it
    const nodeCount = sys.nodes.length;
    const hasOrphans = sys.orphans.length > 0;

    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", marginBottom: 12, borderBottom: "1px solid rgba(255,71,0,0.15)" }}>
          <button
            onClick={() => { setLevel("systems"); setSelectedSystem(null); setFocused(null); }}
            style={{ background: "none", border: "1px solid rgba(255,71,0,0.3)", color: "#FF4700", padding: "5px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}
          >←</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Systems ›</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#FF4700" }}>{sys.tabLabel}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            {nodeCount} node{nodeCount !== 1 ? "s" : ""} · {sys.structures.length} structures
          </span>
        </div>

        {/* Node clusters — each node with its children */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {sys.nodes.map(node => {
            const children = sys.nodeChildren.get(node.objectId) ?? [];
            const childOnline = children.filter(c => c.isOnline).length;
            const isNodeFocused = focused?.objectId === node.objectId;
            const totalEnergyCost = children.reduce((sum, c) => sum + (c.energyCost ?? 0), 0);
            const onlineEnergyCost = children.filter(c => c.isOnline).reduce((sum, c) => sum + (c.energyCost ?? 0), 0);

            return (
              <div key={node.objectId} style={{
                padding: "16px",
                background: "rgba(255,255,255,0.015)",
                border: `2px solid ${node.isOnline ? (isNodeFocused ? "#00ff96" : "rgba(0,255,150,0.3)") : (isNodeFocused ? "#ff4444" : "rgba(255,68,68,0.3)")}`,
              }}>
                {/* Node header row */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, cursor: "pointer" }}
                  onMouseEnter={() => setFocused(node)}
                  onMouseLeave={() => setFocused(null)}
                  onClick={() => openDApp(node)}
                >
                  {/* status indicated by section border color */}
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#FF4700" }}>⚡ {node.displayName}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{node.typeName ?? "Network Node"}</span>
                  <span style={{ fontSize: 12, color: node.isOnline ? "#00ff96" : "#ff4444", fontWeight: 600 }}>
                    {node.isOnline ? "● ONLINE" : "○ OFFLINE"}
                  </span>
                  {node.fuelLevelPct !== undefined && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 60, height: 5, background: "rgba(255,255,255,0.1)", display: "inline-block", overflow: "hidden" }}>
                        <span style={{ width: `${Math.min(100, node.fuelLevelPct)}%`, height: "100%", background: node.fuelLevelPct > 50 ? "#00ff96" : node.fuelLevelPct > 10 ? "#ffd700" : "#ff4444", display: "block" }} />
                      </span>
                      <span style={{ fontSize: 10, color: node.fuelLevelPct > 50 ? "#00ff96" : node.fuelLevelPct > 10 ? "#ffd700" : "#ff4444" }}>
                        {node.fuelLevelPct.toFixed(0)}%
                        {node.runtimeHoursRemaining !== undefined ? ` (~${Math.round(node.runtimeHoursRemaining)}h)` : ""}
                      </span>
                    </span>
                  )}
                  {/* Energy capacity bar */}
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,180,50,0.8)" }}>⚡</span>
                    <span style={{ width: 60, height: 5, background: "rgba(255,255,255,0.1)", display: "inline-block", overflow: "hidden" }}>
                      <span style={{ width: `${totalEnergyCost > 0 ? Math.min(100, (onlineEnergyCost / 1000) * 100) : 0}%`, height: "100%", background: onlineEnergyCost > 800 ? "#ff4444" : onlineEnergyCost > 500 ? "#ffd700" : "rgba(255,180,50,0.8)", display: "block" }} />
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,180,50,0.8)" }}>{onlineEnergyCost}/1000 GJ</span>
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                    {children.length} structure{children.length !== 1 ? "s" : ""} · {childOnline}↑
                    {children.length - childOnline > 0 ? ` ${children.length - childOnline}↓` : ""}
                  </span>
                  {/* Node action buttons */}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button
                      style={{ background: node.isOnline ? "rgba(255,68,68,0.15)" : "rgba(0,255,150,0.15)", color: node.isOnline ? "#ff4444" : "#00ff96", border: "none", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      onClick={(e) => { e.stopPropagation(); node.isOnline ? handleOffline(node) : handleOnline(node); }}
                    >
                      {node.isOnline ? "OFFLINE" : "ONLINE"}
                    </button>
                    <button
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "none", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      onClick={(e) => { e.stopPropagation(); handleRename(node); }}
                    >
                      EDIT
                    </button>
                    <button
                      style={{ background: "rgba(255,68,68,0.12)", color: "#ff6644", border: "none", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      onClick={(e) => { e.stopPropagation(); onNavigate?.("defense"); }}
                      title="Turret defense policy"
                    >
                      🛡 DEFENSE
                    </button>
                    <button
                      style={{ background: "rgba(0,180,255,0.12)", color: "#00ccff", border: "none", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      onClick={(e) => { e.stopPropagation(); onNavigate?.("gates"); }}
                      title="Gate access policy"
                    >
                      ⛩ GATES
                    </button>
                    {/* Bulk assign buttons */}
                    {tribeVaultId && children.some(c => c.kind === "Turret" && !isDelegated(c)) && (
                      <button
                        style={{ background: "rgba(255,180,50,0.12)", color: "rgba(255,180,50,0.9)", border: "none", padding: "3px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const turrets = children.filter(c => c.kind === "Turret" && !isDelegated(c));
                          for (const t of turrets) await handleDelegate(t, tribeVaultId);
                        }}
                        title="Assign all turrets to tribe policy"
                      >
                        ⚑ ALL TURRETS
                      </button>
                    )}
                    {tribeVaultId && children.some(c => c.kind === "Gate" && !isDelegated(c)) && (
                      <button
                        style={{ background: "rgba(255,180,50,0.12)", color: "rgba(255,180,50,0.9)", border: "none", padding: "3px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const gates = children.filter(c => c.kind === "Gate" && !isDelegated(c));
                          for (const g of gates) await handleDelegate(g, tribeVaultId);
                        }}
                        title="Assign all gates to tribe policy"
                      >
                        ⚑ ALL GATES
                      </button>
                    )}
                  </span>
                </div>

                {/* Connected structures — card grid with action buttons */}
                {children.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingLeft: 8 }}>
                    {[...children].sort((a, b) => {
                      // Online first, then group by typeName/label
                      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
                      const typeA = a.typeName ?? a.label;
                      const typeB = b.typeName ?? b.label;
                      if (typeA !== typeB) return typeA.localeCompare(typeB);
                      return a.displayName.localeCompare(b.displayName);
                    }).map(child => {
                      const isChildFocused = focused?.objectId === child.objectId;
                      const color = kindColor(child);
                      const btnStyle = (bg: string, fg: string): React.CSSProperties => ({
                        background: bg, color: fg, border: "none", padding: "3px 8px",
                        fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        letterSpacing: "0.06em", flex: 1, textAlign: "center",
                      });
                      return (
                        <div
                          key={child.objectId}
                          onMouseEnter={() => setFocused(child)}
                          onMouseLeave={() => setFocused(null)}
                          onClick={() => openDApp(child)}
                          style={{
                            cursor: "pointer",
                            width: 130,
                            display: "flex", flexDirection: "column",
                            border: `2px solid ${child.isOnline ? (isChildFocused ? "#00ff96" : "rgba(0,255,150,0.3)") : (isChildFocused ? "#ff4444" : "rgba(255,68,68,0.3)")}`,
                            background: isChildFocused ? `${color}0a` : "rgba(5,3,2,0.95)",
                            transition: "all 0.15s",
                            opacity: child.isOnline ? 1 : 0.65,
                            overflow: "hidden",
                          }}
                        >
                          {/* Header — flex grow to push buttons down */}
                          <div style={{ padding: "8px 8px 4px", textAlign: "center", flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 15 }}>{kindIcon(child)}</span>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#ddd", marginTop: 2, lineHeight: 1.2 }}>
                              {child.displayName.length > 14 ? child.displayName.slice(0, 14) + "…" : child.displayName}
                            </div>
                            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)" }}>
                              {child.typeName ?? child.label}
                            </div>
                            {child.energyCost !== undefined && child.energyCost > 0 && (
                              <div style={{ fontSize: 9, color: "rgba(255,180,50,0.7)", marginTop: 1 }}>
                                {child.energyCost} EP
                              </div>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 1, marginTop: 4 }}>
                            <button
                              style={btnStyle(child.isOnline ? "rgba(255,68,68,0.15)" : "rgba(0,255,150,0.15)", child.isOnline ? "#ff4444" : "#00ff96")}
                              onClick={(e) => { e.stopPropagation(); child.isOnline ? handleOffline(child) : handleOnline(child); }}
                              title={child.isOnline ? "Take offline" : "Bring online"}
                            >
                              {child.isOnline ? "OFF" : "ON"}
                            </button>
                            <button
                              style={btnStyle("rgba(255,255,255,0.06)", "rgba(255,255,255,0.5)")}
                              onClick={(e) => { e.stopPropagation(); handleRename(child); }}
                              title="Edit name"
                            >
                              EDIT
                            </button>
                            {/* Delegate/Revoke for turrets and gates */}
                            {isDelegatable(child) && (
                              <button
                                style={btnStyle(
                                  isDelegated(child) ? "rgba(255,180,50,0.15)" : "rgba(0,200,255,0.12)",
                                  isDelegated(child) ? "rgba(255,180,50,0.9)" : "#00ccff"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDelegated(child)) handleRevoke(child);
                                  else if (tribeVaultId) handleDelegate(child, tribeVaultId);
                                  else setActionErr("No tribe vault found. Create one in the Tribe Vault tab first.");
                                }}
                                title={isDelegated(child) ? "Revoke tribe policy" : "Apply tribe policy"}
                              >
                                {isDelegated(child) ? "⊘" : "⚑"}
                              </button>
                            )}
                          </div>

                          {/* Gate link/unlink section */}
                          {child.kind === "Gate" && isChildFocused && (() => {
                            const gateStatus = gateActionState?.gateId === child.objectId ? gateActionState.status : null;
                            const isLinked = !!child.linkedGateId;
                            return (
                              <div style={{ padding: "6px 8px", background: "rgba(0,200,255,0.04)", borderTop: "1px solid rgba(0,200,255,0.1)" }}
                                onClick={e => e.stopPropagation()}
                              >
                                {gateStatus ? (
                                  <div style={{ fontSize: 9, color: gateStatus.startsWith("✓") ? "#00ff96" : gateStatus.startsWith("✗") ? "#ff4444" : "#00ccff", fontStyle: "italic" }}>{gateStatus}</div>
                                ) : isLinked ? (
                                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <span style={{ fontSize: 8, color: "#00ff96", flex: 1 }}>⛩ linked</span>
                                    <button
                                      style={{ ...btnStyle("rgba(255,68,68,0.15)", "#ff6644"), fontSize: 8, padding: "2px 6px" }}
                                      onClick={() => handleUnlinkGate(child)}
                                    >UNLINK</button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Link to:</span>
                                    <select
                                      style={{ flex: 1, background: "rgba(0,0,0,0.6)", color: "#ddd", border: "1px solid rgba(0,200,255,0.3)", fontSize: 8, padding: "1px 2px", fontFamily: "inherit" }}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => {
                                        const destId = e.target.value;
                                        if (destId) handleLinkGate(child, destId);
                                        e.target.value = "";
                                      }}
                                      defaultValue=""
                                    >
                                      <option value="" disabled>select gate…</option>
                                      {allGates
                                        .filter(g => g.objectId !== child.objectId && !g.linkedGateId)
                                        .map(g => (
                                          <option key={g.objectId} value={g.objectId}>
                                            {g.displayName} ({g.gameItemId ?? g.objectId.slice(0, 8)})
                                          </option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", paddingLeft: 8, fontStyle: "italic" }}>
                    No structures connected to this node
                  </div>
                )}
              </div>
            );
          })}

          {/* Orphan structures */}
          {hasOrphans && (
            <div style={{
              padding: "16px",
              background: "rgba(255,255,255,0.01)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>⊘ Unlinked Structures</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{sys.orphans.length} structures with no parent node</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingLeft: 8 }}>
                {sys.orphans.map(s => {
                  const color = kindColor(s);
                  const isFoc = focused?.objectId === s.objectId;
                  return (
                    <div
                      key={s.objectId}
                      onMouseEnter={() => setFocused(s)}
                      onMouseLeave={() => setFocused(null)}
                      onClick={() => openDApp(s)}
                      style={{
                        width: 100, minHeight: 100, borderRadius: "50%",
                        border: `2px solid ${isFoc ? color : `${color}33`}`,
                        background: "rgba(5,3,2,0.95)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", opacity: 0.5, padding: "8px 4px",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{kindIcon(s)}</span>
                      <span style={{ fontSize: 10, color, textAlign: "center" }}>
                        {s.displayName.length > 10 ? s.displayName.slice(0, 10) + "…" : s.displayName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action status */}
        {actionBusy && <div style={{ padding: "6px 12px", background: "rgba(255,71,0,0.06)", border: "1px solid rgba(255,71,0,0.15)", fontSize: 11, color: "#FF4700", fontStyle: "italic" }}>⏳ Transaction pending...</div>}
        {actionErr && <div style={{ padding: "6px 12px", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)", fontSize: 11, color: "#ff4444" }}>⚠ {actionErr}</div>}
        {gateActionState && !gateActionState.status.includes("✓") && !gateActionState.status.includes("✗") && (
          <div style={{ padding: "6px 12px", background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.2)", fontSize: 11, color: "#00ccff", fontStyle: "italic" }}>⛩ {gateActionState.status}</div>
        )}

        {/* Hover tooltip */}
        {focused && focused.kind !== "NetworkNode" && (
          <div style={{
            marginTop: 12, padding: "10px 14px",
            background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.2)",
            display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: kindColor(focused) }}>
              {kindIcon(focused)} {focused.displayName}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{focused.typeName ?? focused.label}</span>
            <span style={{ color: focused.isOnline ? "#00ff96" : "#ff4444", fontWeight: 600, fontSize: 12 }}>
              {focused.isOnline ? "● ONLINE" : "○ OFFLINE"}
            </span>
            {focused.energyCost !== undefined && focused.energyCost > 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,180,50,0.8)" }}>{focused.energyCost} EP</span>
            )}
            <span style={{ fontSize: 10, color: "rgba(255,71,0,0.5)", marginLeft: "auto" }}>click bubble to open controls</span>
          </div>
        )}
      </div>
    );

  }

  // ── LEVEL 2: Structures on node ──
  if (level === "structures" && selectedSystem && selectedNode) {
    const sys = systems.find(s => s.key === selectedSystem);
    if (!sys) { setLevel("systems"); return null; }

    const node = sys.nodes.find(n => n.objectId === selectedNode);
    const structures = selectedNode === "orphans"
      ? sys.orphans
      : (node ? (sys.nodeChildren.get(node.objectId) ?? []) : []);

    const nodeName = selectedNode === "orphans" ? "Unlinked Structures" : (node?.displayName ?? "Node");

    const items: BubbleItem[] = structures.map(s => ({
      id: s.objectId,
      label: s.displayName,
      sublabel: s.typeName ?? s.label,
      color: kindColor(s),
      icon: kindIcon(s),
      isOnline: s.isOnline,
      fuelPct: s.fuelLevelPct,
      fuelHours: s.runtimeHoursRemaining,
      onClick: () => openDApp(s),
      onDApp: () => openDApp(s),
    }));

    return (
      <BubbleGrid
        items={items}
        title={nodeName}
        breadcrumb={["Systems", sys.tabLabel]}
        onBack={() => { setLevel("nodes"); setSelectedNode(null); }}
      />
    );
  }

  return null;
}
export function DashboardPanel({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [characterId, setCharacterId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dashTab, setDashTab] = useState<"structures" | "links" | "transfer">("structures");
  const [transferRecipients, setTransferRecipients] = useState<Map<string, string>>(new Map());
  const [transferBusy, setTransferBusy] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<Map<string, string>>(new Map());

  const walletAddress = account?.address ?? null;

  const load = useCallback(
    async (address: string) => {
      setLoading(true);
      setErr(null);
      try {
        const [g, charInfo] = await Promise.all([
          fetchPlayerStructures(address),
          findCharacterForWallet(address),
        ]);
        setGroups(g);
        setCharacterId(charInfo?.characterId ?? "");
        setLoadedFor(address);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-load on wallet connect
  useEffect(() => {
    if (walletAddress && walletAddress !== loadedFor) {
      load(walletAddress);
    }
  }, [walletAddress, loadedFor, load]);

  const handleRefresh = useCallback(() => {
    if (walletAddress) {
      // Refresh data without resetting loadedFor — preserves nav state by avoiding loading screen
      fetchPlayerStructures(walletAddress).then(g => setGroups(g)).catch(() => {});
    }
  }, [walletAddress]);

  // Transfer ownership handler
  const handleTransfer = async (structure: PlayerStructure) => {
    const recipient = transferRecipients.get(structure.objectId)?.trim();
    if (!recipient || !recipient.startsWith("0x") || !characterId || !account) return;
    setTransferBusy(structure.objectId);
    try {
      const { WORLD_PKG } = await import("../constants");
      // Derive the correct type argument from the structure's kind
      // Use structure.typeFull directly — it's already the exact on-chain type string
      const typeArg = structure.typeFull;
      const tx = new Transaction();
      // borrow the OwnerCap from the character
      const [cap, receipt] = tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [typeArg],
        arguments: [tx.object(characterId), tx.object(structure.ownerCapId)],
      }) as unknown as [ReturnType<typeof tx.object>, ReturnType<typeof tx.object>];
      // transfer it to the recipient
      tx.moveCall({
        target: `${WORLD_PKG}::access::transfer_owner_cap_with_receipt`,
        typeArguments: [typeArg],
        arguments: [cap, receipt, tx.pure.address(recipient)],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTransferResult(m => new Map(m).set(structure.objectId, "✓ Transferred"));
      setTransferRecipients(m => { const n = new Map(m); n.delete(structure.objectId); return n; });
    } catch (e) {
      setTransferResult(m => new Map(m).set(structure.objectId, `✗ ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`));
    } finally {
      setTransferBusy(null);
    }
  };

  const allStructures = groups.flatMap(g => g.structures);

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid rgba(255,71,0,0.2)", marginBottom: 12 }}>
        {([["structures", "⬡ STRUCTURES"], ["links", "🔗 LINKS"], ["transfer", "⇄ TRANSFER OWNERSHIP"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setDashTab(tab)} style={{
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            padding: "7px 16px", border: "none", cursor: "pointer",
            background: dashTab === tab ? "rgba(255,71,0,0.12)" : "transparent",
            color: dashTab === tab ? "#FF4700" : "rgba(255,255,255,0.35)",
            borderBottom: dashTab === tab ? "2px solid #FF4700" : "2px solid transparent",
            marginBottom: -2,
          }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={handleRefresh} style={{ background: "none", border: "1px solid rgba(255,71,0,0.3)", color: "#FF4700", padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, marginBottom: 4 }}>
          ↻ REFRESH
        </button>
      </div>

      {/* Header meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {dashTab === "structures" && <span style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.1em" }}>MY STRUCTURES</span>}
        {dashTab === "links" && <span style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.1em" }}>STRUCTURE LINKS</span>}
        {dashTab === "transfer" && <span style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.1em" }}>TRANSFER OWNERSHIP</span>}
        {walletAddress && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>char: {characterId.slice(0, 10)}…</span>}
      </div>

      {/* Connect prompt */}
      {!walletAddress && (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.55)" }}>
          Connect your EVE Vault to view structures
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.55)" }}>Loading structures…</div>}

      {/* Error */}
      {err && <div style={{ padding: "8px 12px", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)", color: "#ff4444", fontSize: 12 }}>⚠ {err}</div>}

      {/* Empty state */}
      {!loading && walletAddress && groups.length === 0 && !err && (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.55)" }}>No structures found for this wallet</div>
      )}

      {/* Topology drill-down view */}
      {dashTab === "structures" && !loading && groups.length > 0 && (
        <TopologyGraph groups={groups} characterId={characterId} onRefresh={handleRefresh} onNavigate={onNavigate} />
      )}

      {/* Transfer Ownership tab */}
      {dashTab === "links" && <LinksPanel />}

      {dashTab === "transfer" && !loading && (
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
            Transfer the OwnerCap for any structure to another pilot. The recipient gains full control — this cannot be undone.
          </p>
          <div style={{ fontSize: 11, padding: "8px 12px", marginBottom: 16, background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.2)", borderRadius: 3, color: "rgba(255,200,0,0.85)" }}>
            ⚠ Enter the recipient's <strong>Character Object ID</strong> — not their wallet address.<br />
            The OwnerCap is owned by the Character object. The recipient must be identified by their Character's Sui object ID so they can use the cap via their character.<br />
            <span style={{ opacity: 0.6, fontSize: 10 }}>Character Object ID: found on the Intel tab → Characters, or ask the recipient to share it (starts with 0x, 66 chars).</span>
          </div>
          {allStructures.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>No structures found</div>
          ) : allStructures.map(s => {
            const result = transferResult.get(s.objectId);
            const busy = transferBusy === s.objectId;
            const recipient = transferRecipients.get(s.objectId) ?? "";
            return (
              <div key={s.objectId} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "8px 10px", marginBottom: 6,
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3,
                background: result?.startsWith("✓") ? "rgba(0,255,150,0.04)" : "rgba(0,0,0,0.2)",
              }}>
                <div style={{ flex: "0 0 180px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#FF4700" }}>{s.displayName || s.objectId.slice(0, 10)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{s.objectId.slice(0, 14)}…</div>
                </div>
                <input
                  value={recipient}
                  onChange={e => setTransferRecipients(m => new Map(m).set(s.objectId, e.target.value))}
                  placeholder="0x… recipient Character Object ID"
                  disabled={busy || !!result?.startsWith("✓")}
                  style={{
                    flex: "1 1 260px", minWidth: 200, padding: "5px 10px", fontSize: 11,
                    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontFamily: "monospace", borderRadius: 2,
                    opacity: busy ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={() => handleTransfer(s)}
                  disabled={busy || !recipient.startsWith("0x") || !!result?.startsWith("✓")}
                  style={{
                    padding: "5px 14px", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                    letterSpacing: "0.08em", border: "1px solid rgba(255,68,68,0.4)",
                    background: "rgba(255,68,68,0.08)", color: "#ff6666", cursor: "pointer",
                    borderRadius: 2, opacity: (busy || !recipient.startsWith("0x")) ? 0.4 : 1,
                  }}
                >
                  {busy ? "TRANSFERRING…" : "TRANSFER ⚠"}
                </button>
                {result && (
                  <div style={{ fontSize: 11, color: result.startsWith("✓") ? "#00ff96" : "#ff6666", flexBasis: "100%", paddingLeft: 190 }}>
                    {result}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LATTICE CONTRIBUTIONS ── */}
      <div style={{ marginTop: 24 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "rgba(0,255,153,0.6)",
          textTransform: "uppercase" as const,
          marginBottom: 4,
          paddingLeft: 2,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{ width: 2, height: 10, background: "rgba(0,255,153,0.5)", display: "inline-block" }} />
          LATTICE CONTRIBUTIONS
        </div>
        <TribeLeaderboardPanel />
      </div>
    </div>
  );
}
