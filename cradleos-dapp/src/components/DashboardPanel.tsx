import { cycleCacheKey } from "../lib/cycleCache";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { playPowerOn, playPowerOff } from "../lib/sound";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { LinksPanel } from "./LinksPanel";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { SERVER_ENV, CRADLEOS_PKG, CRADLEOS_ORIGINAL, CLOCK, SUI_TESTNET_RPC } from "../constants";
import { Transaction } from "@mysten/sui/transactions";
import { useSponsoredTransaction } from "@evefrontier/dapp-kit";
import { sponsoredGateLink } from "../lib/gateLink";
import { gateOperationLock } from "../lib/gateControl";
import {
  fetchPlayerStructureSnapshot,
  buildStructureOnlineTransaction,
  buildStructureOfflineTransaction,
  buildBatchSequencedTransaction,
  selectFitsBudget,
  buildRenameTransaction,
  buildSetUrlTransaction,
  findCharacterForWallet,
  discoverVaultIdForTribe,
  waitForStructureStatus,
  type PlayerStructure,
  type LocationGroup,
} from "../lib";
import { StructureRow } from "./dashboard/StructureRow";
import { StructureRowHeader } from "./dashboard/StructureRowHeader";
import { NodeHeader } from "./dashboard/NodeHeader";
import { StructureRowList } from "./dashboard/StructureRowList";
import { sortByFamily } from "./dashboard/sortByFamily";
import { baseTitle, baseContents, baseMatches, buildBaseDirectory, structureMatches } from "../lib/baseDirectory";
import "./dashboard/baseDirectory.css";
import { translateTxError } from "../lib/txError";

// Node EP capacity. The on-chain Move object does not expose this as a field
// today (the in-game default is 1000 GJ/h output) so we hard-code it. If CCP
// adds variable-capacity nodes, swap this for a node-derived value.
const NODE_EP_MAX = 1000;

// ── EVE Frontier official dApp base
// Stillness = dapps.evefrontier.com, Utopia = uat.dapps.evefrontier.com
const EVE_DAPP_BASE = SERVER_ENV === "stillness"
  ? "https://dapps.evefrontier.com/"
  : "https://uat.dapps.evefrontier.com/";

// CradleOS dashboard kiosk URL — set as a Network Node's metadata.url
// to attach the dashboard kiosk display to that node in-game. Mirrors
// the BASE used in LinksPanel.tsx; kept in sync there.
const CRADLEOS_BASE = "https://cradleos.io";
const CRADLEOS_DASHBOARD_URL = `${CRADLEOS_BASE}/#/dashboard`;

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

  // Toggle handlers wait for fullnode consistency before firing onRefresh().
  // signAndExecuteTransaction returns when the wallet has submitted the tx,
  // but the public fullnode RPC pool used by fetchPlayerStructures is
  // eventually consistent — it may take a few seconds to surface the new
  // status. Without the wait, an immediate refetch returns stale data and
  // the toggle visually reverts (sometimes permanently, until manual reload).
  const handleOnline = async () => {
    setBusy(true); setErr(null);
    playPowerOn();
    try {
      const tx = await buildStructureOnlineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      // Poll the fullnode until it reports the new status, then refetch.
      // If it times out we still refetch — stale state is better than no
      // update and the next periodic refetch will catch it.
      await waitForStructureStatus(structure.objectId, true);
      onRefresh();
    } catch (e) {
      setErr(translateTxError(e));
    } finally { setBusy(false); }
  };

  const handleOffline = async () => {
    setBusy(true); setErr(null);
    playPowerOff();
    try {
      const tx = await buildStructureOfflineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      await waitForStructureStatus(structure.objectId, false);
      onRefresh();
    } catch (e) {
      setErr(translateTxError(e));
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
      setErr(translateTxError(e));
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

// Structure icons retained for the existing actionable rows.
const KIND_ICONS: Record<string, string> = {
  "Network Node": "⚡",
  "Gate":         "⛩",
  "Turret":       "⊕",
  "Storage Unit": "▫",
  "Assembly":     "⊞",
};

function TopologyGraph({ groups, characterId, onRefresh }: { groups: LocationGroup[]; characterId: string; onRefresh: () => void }) {
  const dAppKit = useDAppKit();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // Wait for fullnode consistency before refetching — see StructureCard
  // handleOnline/handleOffline for the full rationale.
  const handleOnline = async (s: PlayerStructure) => {
    setActionBusy(s.objectId); setActionErr(null);
    playPowerOn();
    try {
      const tx = await buildStructureOnlineTransaction(s, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      await waitForStructureStatus(s.objectId, true);
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  const handleOffline = async (s: PlayerStructure) => {
    setActionBusy(s.objectId); setActionErr(null);
    playPowerOff();
    try {
      const tx = await buildStructureOfflineTransaction(s, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      await waitForStructureStatus(s.objectId, false);
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  // In-game webview rendering: window.prompt() is BLOCKED in the EVE Vault
  // Mobile / Stillness embedded Chrome. Native browser dialogs (prompt /
  // confirm / alert) all silently no-op in that context. Replace with an
  // in-app modal rendered via React portal so the EDIT flow works both in
  // standalone Chrome AND in-game.
  // (Discovered 2026-04-26 from Raw's screenshot: dApp opens a Chrome
  // dialog out-of-game but does nothing in-game.)
  const [renameTarget, setRenameTarget] = useState<PlayerStructure | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const handleRename = (s: PlayerStructure) => {
    setRenameInput(s.displayName);
    setRenameTarget(s);
  };

  const closeRenameModal = () => {
    setRenameTarget(null);
    setRenameInput("");
  };

  const submitRename = async () => {
    const s = renameTarget;
    if (!s) return;
    const name = renameInput.trim();
    if (!name) return;
    setActionBusy(s.objectId); setActionErr(null);
    closeRenameModal();
    try {
      const tx = buildRenameTransaction(s, characterId, name);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onRefresh();
    } catch (e) { setActionErr(e instanceof Error ? e.message : String(e)); }
    finally { setActionBusy(null); }
  };

  // Install the CradleOS dashboard kiosk on a Network Node by writing
  // CRADLEOS_DASHBOARD_URL to the node's metadata.url field on-chain.
  // The in-game kiosk reads metadata.url to decide what page to render
  // when a player walks up to the node, so this is the canonical way
  // to attach the dashboard. The same pattern is used by LinksPanel
  // for Turret / StorageUnit kiosks.
  const handleInstallCradleOS = async (n: PlayerStructure) => {
    setActionBusy(n.objectId); setActionErr(null);
    try {
      const tx = buildSetUrlTransaction(n, characterId, CRADLEOS_DASHBOARD_URL);
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

  const handleGateLinkAction = async (gate: PlayerStructure, unlink: boolean) => {
    if (!account || gateOperationLock.busy) return;
    const address = account.address;
    const current = () => {
      if (dAppKit.stores.$connection.get().account?.address !== address ||
          dAppKit.stores.$currentNetwork.get() !== "testnet") throw Error("Wallet changed. Refresh.");
    };
    gateOperationLock.busy = true;
    setGateActionState({ gateId: gate.objectId, status: "Opening EVE Vault…" });
    try {
      await sponsoredGateLink(gate.objectId, address, unlink, sendSponsoredTx, current);
      current();
      setGateActionState({ gateId: gate.objectId, status: unlink ? "✓ Unlink confirmed" : "✓ Link confirmed" });
      onRefresh();
    } catch (e) {
      if (dAppKit.stores.$connection.get().account?.address === address)
        setGateActionState({ gateId: gate.objectId, status: `✗ ${e instanceof Error ? e.message : "Unverified. Refresh."}` });
    } finally { gateOperationLock.busy = false; }
  };
  const handleLinkGate = (gate: PlayerStructure) => handleGateLinkAction(gate, false);
  const handleUnlinkGate = (gate: PlayerStructure) => handleGateLinkAction(gate, true);

  // Discover tribe vault ID
  const [tribeVaultId, setTribeVaultId] = useState<string>(() => localStorage.getItem(cycleCacheKey("dashboard-vault")) ?? "");
  useEffect(() => {
    if (tribeVaultId || !characterId || !account?.address) return;
    let cancelled = false;
    findCharacterForWallet(account.address).then(info => {
      if (cancelled || !info?.tribeId) return;
      return discoverVaultIdForTribe(info.tribeId);
    }).then(vid => {
      if (cancelled || !vid) return;
      setTribeVaultId(vid);
      localStorage.setItem(cycleCacheKey("dashboard-vault"), vid);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [characterId, account?.address, tribeVaultId]);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState<PlayerStructure | null>(null);
  // Per-node collapse state. Default is expanded (object not in the set).
  // Persists to localStorage so user choices survive page reloads. Keyed
  // by node objectId.
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem("cradleos.dashboard.collapsedNodes");
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch { return new Set(); }
  });
  const setNodeCollapsed = useCallback((objectId: string, collapsed: boolean) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (collapsed) next.add(objectId);
      else next.delete(objectId);
      try {
        window.localStorage.setItem(
          "cradleos.dashboard.collapsedNodes",
          JSON.stringify(Array.from(next))
        );
      } catch { /* localStorage unavailable */ }
      return next;
    });
  }, []);
  const directory = useMemo(() => buildBaseDirectory(groups), [groups]);
  const allStructures = directory.structures;
  const visibleBases = directory.bases.filter(base => baseMatches(base, search));
  const visibleOthers = directory.others.filter(structure => structureMatches(structure, search));
  const totalOnline = allStructures.filter(s => s.isOnline).length;
  const kindIcon = (s: PlayerStructure) => KIND_ICONS[s.label] ?? "●";

  const openDApp = (s: PlayerStructure) => {
    const id = s.gameItemId ?? s.objectId;
    window.open(`${EVE_DAPP_BASE}?itemId=${id}&tenant=${SERVER_ENV}`, "eve-dapp", "width=800,height=700,menubar=no,toolbar=no,location=no,status=no");
  };

  // Portal-mounted rename modal. Rendered into document.body so it works
  // regardless of which level branch (systems / nodes / structures) is
  // currently mounted, AND survives the in-game webview which blocks
  // window.prompt(). Uses the existing dApp dark/orange visual language
  // so it doesn't feel jarring next to the rest of the UI.
  const renameModal = renameTarget ? createPortal(
    <div
      onClick={closeRenameModal}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d0d0d",
          border: "1px solid rgba(255,71,0,0.4)",
          padding: 20,
          minWidth: 320,
          maxWidth: 460,
          width: "90%",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            color: "#FF4700",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Rename {renameTarget.label}
        </div>
        <div
          style={{
            color: "rgba(175,175,155,0.7)",
            fontSize: 10,
            marginBottom: 14,
            wordBreak: "break-all",
          }}
        >
          #{renameTarget.objectId.slice(-12)}
        </div>
        <input
          autoFocus
          type="text"
          value={renameInput}
          onChange={(e) => setRenameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            else if (e.key === "Escape") closeRenameModal();
          }}
          maxLength={64}
          placeholder="New name"
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,71,0,0.3)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 13,
            padding: "8px 10px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
          <button
            onClick={closeRenameModal}
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: "0.1em",
              background: "transparent",
              border: "1px solid rgba(175,175,155,0.4)",
              color: "rgba(180,180,170,0.85)",
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={submitRename}
            disabled={!renameInput.trim() || renameInput.trim() === renameTarget.displayName}
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: "0.1em",
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.6)",
              color: (!renameInput.trim() || renameInput.trim() === renameTarget.displayName) ? "rgba(255,71,0,0.4)" : "#FF4700",
              padding: "6px 14px",
              cursor: (!renameInput.trim() || renameInput.trim() === renameTarget.displayName) ? "default" : "pointer",
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  const setAllCollapsed = (collapsed: boolean) => {
    const next = new Set(collapsedNodes);
    for (const base of directory.bases) {
      if (collapsed) next.add(base.node.objectId);
      else next.delete(base.node.objectId);
    }
    setCollapsedNodes(next);
    try { localStorage.setItem("cradleos.dashboard.collapsedNodes", JSON.stringify([...next])); } catch { /* unavailable */ }
  };

  return (
      <div className="base-directory">
        <div className="base-directory-summary" role="status">
          <strong>{directory.bases.length} bases</strong>
          <span>{allStructures.length} structures</span>
          <span>{totalOnline} online</span>
          <span>{allStructures.filter(s => s.kind === "Turret").length} turrets</span>
          <span>{allStructures.filter(s => s.kind === "StorageUnit").length} storage</span>
        </div>
        <div className="base-directory-tools">
          <input aria-label="Find base or structure" placeholder="Find base, structure or item ID…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")}>Clear</button>}
          <button onClick={() => setAllCollapsed(false)}>Expand all</button>
          <button onClick={() => setAllCollapsed(true)}>Collapse all</button>
        </div>
        {search.trim() && <div className="base-directory-results">{visibleBases.length} bases · {visibleOthers.length} other structures</div>}
        {!visibleBases.length && !visibleOthers.length && <div className="base-directory-empty">No matches</div>}

        {/* Node clusters — each node with its children */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {visibleBases.map(({ node, children }) => {
            const childOnline = children.filter(c => c.isOnline).length;
            const isNodeFocused = focused?.objectId === node.objectId;
            const onlineEnergyCost = children.filter(c => c.isOnline).reduce((sum, c) => sum + (c.energyCost ?? 0), 0);
            // Live EP budget remaining at this node — used to gate offline
            // structures' power-on toggles when their cost would exceed budget.
            const epAvailable = Math.max(0, NODE_EP_MAX - onlineEnergyCost);
            // Node must be online + have fuel to bring children online (ENotProducing otherwise)
            const nodeCanPowerChildren = node.isOnline && (node.fuelLevelPct ?? 0) > 0;
            // Default expanded — only collapsed when the user has explicitly
            // toggled this node into the persisted collapsedNodes set.
            const isCollapsed = collapsedNodes.has(node.objectId);

            return (
              <div key={node.objectId} className="base-directory-card" data-base-id={node.objectId} style={{
                padding: "16px",
                background: "rgba(255,255,255,0.015)",
                border: `2px solid ${node.isOnline ? (isNodeFocused ? "#00ff96" : "rgba(0,255,150,0.3)") : (isNodeFocused ? "#ff4444" : "rgba(255,68,68,0.3)")}`,
              }}>
                {/* Node header — name, status, fuel/EP bars, power toggle, action chips */}
                <NodeHeader
                  node={node}
                  displayLabel={baseTitle(node)}
                  details={<>
                    {node.hasCustomName && node.gameItemId && <span>Item {node.gameItemId}</span>}
                    <span>{node.solarSystemId === undefined ? "Location unknown" : `System ${node.solarSystemId}`}</span>
                    <span>{baseContents(children)}</span>
                  </>}
                  childCount={children.length}
                  childOnline={childOnline}
                  childOffline={children.length - childOnline}
                  consumedEp={onlineEnergyCost}
                  epMax={NODE_EP_MAX}
                  collapsed={isCollapsed}
                  onToggleCollapsed={() => setNodeCollapsed(node.objectId, !isCollapsed)}
                  onOpenDApp={() => openDApp(node)}
                  onFocus={setFocused}
                  isFocused={isNodeFocused}
                  onTogglePower={() => node.isOnline ? handleOffline(node) : handleOnline(node)}
                  busy={actionBusy === node.objectId}
                  onEdit={() => handleRename(node)}
                  onInstallCradleOS={() => handleInstallCradleOS(node)}
                  cradleOSInstalled={(node.metadataUrl ?? "").startsWith(CRADLEOS_DASHBOARD_URL)}
                />

                {/* Bulk-assign strip — appears when the user has a tribe vault
                    AND there are undelegated turrets or gates to bulk-assign. */}
                {!isCollapsed && tribeVaultId && (
                  children.some(c => c.kind === "Turret" && !isDelegated(c))
                  || children.some(c => c.kind === "Gate" && !isDelegated(c))
                ) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: "6px 18px",
                      background: "rgba(255,180,74,0.05)",
                      borderBottom: "1px solid rgba(250,250,229,0.10)",
                      alignItems: "center",
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                      color: "rgba(255,180,74,0.9)",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      marginRight: 8,
                    }}>BULK ASSIGN ·</span>
                    {children.some(c => c.kind === "Turret" && !isDelegated(c)) && (
                      <button
                        style={{ background: "transparent", border: "1px solid rgba(255,180,74,0.6)", color: "rgba(255,180,74,0.95)", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.10em", textTransform: "uppercase" }}
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
                    {children.some(c => c.kind === "Gate" && !isDelegated(c)) && (
                      <button
                        style={{ background: "transparent", border: "1px solid rgba(255,180,74,0.6)", color: "rgba(255,180,74,0.95)", padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.10em", textTransform: "uppercase" }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const gates = children.filter(c => c.kind === "Gate" && !isDelegated(c));
                          for (const g of gates) await handleDelegate(g, tribeVaultId);
                        }}
                        title="Assign all gates to tribe policy"
                      >
                        ⛑ ALL GATES
                      </button>
                    )}
                  </div>
                )}

                {/* Per-node defensive stance strip — quick toggles to flip this */}
                {/* node's children between defense (turrets up, industry down) and */}
                {/* peacetime (industry up, turrets at rest). Energy-aware: pre-fits */}
                {/* the online side against the budget after offline-side releases. */}
                {!isCollapsed && children.length > 0 && (
                  <NodeStanceStrip
                    node={node}
                    children={children}
                    epMax={NODE_EP_MAX}
                    consumedEp={onlineEnergyCost}
                    nodeCanPowerChildren={nodeCanPowerChildren}
                    characterId={characterId}
                    onRefresh={onRefresh}
                  />
                )}

                {/* Connected structures — dense rows with toggle, status LED, EP gate.
                    Hidden when the node is collapsed; the header above remains visible
                    so the user can still see status and operate the node power. */}
                {!isCollapsed && (
                  children.length > 0 ? (
                    <StructureRowList>
                      <StructureRowHeader />
                      {sortByFamily(children).map((child, i) => (
                        <StructureRow
                          key={child.objectId}
                          structure={child}
                          index={i}
                          epAvailable={epAvailable}
                          fuelBlocked={!nodeCanPowerChildren}
                          onOnline={handleOnline}
                          onOffline={handleOffline}
                          onRename={handleRename}
                          onDelegate={s => {
                            if (tribeVaultId) handleDelegate(s, tribeVaultId);
                            else setActionErr("No tribe vault found. Create one in the Tribe Vault tab first.");
                          }}
                          onRevoke={handleRevoke}
                          onLinkGate={handleLinkGate}
                          onUnlinkGate={handleUnlinkGate}
                          onOpenDApp={openDApp}
                          onFocus={setFocused}
                          isFocused={focused?.objectId === child.objectId}
                          actionBusy={actionBusy}
                          tribeVaultAvailable={!!tribeVaultId}
                          isDelegatable={isDelegatable(child)}
                          isDelegated={isDelegated(child)}
                          availableGateLinkTargets={allGates}
                          gateActionStatus={gateActionState?.gateId === child.objectId ? gateActionState.status : null}
                          kindIcon={kindIcon}
                        />
                      ))}
                    </StructureRowList>
                  ) : (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", paddingLeft: 8, fontStyle: "italic" }}>
                      No structures connected to this node
                    </div>
                  )
                )}
              </div>
            );
          })}

          {/* Orphan structures */}
          {visibleOthers.length > 0 && (
            <div style={{
              padding: "16px",
              background: "rgba(255,255,255,0.01)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div className="base-directory-summary">
                <strong>Other structures</strong><span>{visibleOthers.length}</span><span>No visible network node</span>
              </div>
              {/* Orphan structures: render the same StructureRow table that
                  node-attached children use, so users can rename / online /
                  offline / delegate / openDApp on them just like normal
                  structures. Without this, orphans were limited to a
                  click-to-openDApp circle bubble with no per-row controls.
                  Orphans have no visible parent node (the on-chain location
                  for the parent NetworkNode wasn't exposed), so:
                    epAvailable: 0 — we can't read the missing node's EP
                    fuelBlocked: false — the structure may still be online
                                          on-chain even if we can't see its
                                          parent's fuel; respect that
                  Online/offline transitions for orphans build PTBs that
                  reference s.energySourceId directly, so they still work
                  even when the node isn't in our local view. */}
              <StructureRowList>
                <StructureRowHeader />
                {sortByFamily(visibleOthers).map((s, i) => (
                  <StructureRow
                    key={s.objectId}
                    structure={s}
                    index={i}
                    // EP is UNKNOWN for orphans (parent node's location
                    // isn't exposed on-chain so we can't read its EP
                    // budget). Pass Infinity so the row's EP gate
                    // doesn't pre-block the ON button — the on-chain
                    // online_* call references the missing node
                    // directly via s.energySourceId and the chain will
                    // reject if power is genuinely unavailable, which
                    // surfaces through actionErr. Previous value of 0
                    // mistakenly disabled ON for any orphan with
                    // energyCost > 0 (which is most kinds).
                    epAvailable={Infinity}
                    fuelBlocked={false}
                    onOnline={handleOnline}
                    onOffline={handleOffline}
                    onRename={handleRename}
                    onDelegate={x => {
                      if (tribeVaultId) handleDelegate(x, tribeVaultId);
                      else setActionErr("No tribe vault found. Create one in the Tribe Vault tab first.");
                    }}
                    onRevoke={handleRevoke}
                    onLinkGate={handleLinkGate}
                    onUnlinkGate={handleUnlinkGate}
                    onOpenDApp={openDApp}
                    onFocus={setFocused}
                    isFocused={focused?.objectId === s.objectId}
                    actionBusy={actionBusy}
                    tribeVaultAvailable={!!tribeVaultId}
                    isDelegatable={isDelegatable(s)}
                    isDelegated={isDelegated(s)}
                    availableGateLinkTargets={allGates}
                    gateActionStatus={gateActionState?.gateId === s.objectId ? gateActionState.status : null}
                    kindIcon={kindIcon}
                  />
                ))}
              </StructureRowList>
            </div>
          )}
        </div>

        {/* Action status */}
        {actionBusy && <div style={{ padding: "6px 12px", background: "rgba(255,71,0,0.06)", border: "1px solid rgba(255,71,0,0.15)", fontSize: 11, color: "#FF4700", fontStyle: "italic" }}>⏳ Transaction pending...</div>}
        {actionErr && <div style={{ padding: "6px 12px", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)", fontSize: 11, color: "#ff4444" }}>⚠ {actionErr}</div>}
        {gateActionState && !gateActionState.status.includes("✓") && !gateActionState.status.includes("✗") && (
          <div style={{ padding: "6px 12px", background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.2)", fontSize: 11, color: "#00ccff", fontStyle: "italic" }}>⛩ {gateActionState.status}</div>
        )}

        {/* Hover tooltip removed 2026-05-01 — orphan structures now
            render with full StructureRow tables (same as node-attached
            children), so all the info this tooltip surfaced (name,
            type, online/offline, EP cost) is already visible inline.
            The tooltip also flickered visibly when cursor moved across
            StructureRow child elements because onFocus(s) / onFocus(null)
            fired in rapid succession. Removing the block eliminates the
            flicker and the redundant info. */}
        {renameModal}
      </div>
    );

}
// 2026-05-01: onNavigate prop dropped — was only used by the per-node
// DEFENSE / GATES shortcuts in NodeHeader, which were removed in favor
// of the kiosk nav bar.
export function DashboardPanel() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [dashTab, setDashTab] = useState<"structures" | "links" | "transfer">("structures");
  const [transferRecipients, setTransferRecipients] = useState<Map<string, string>>(new Map());
  const [transferBusy, setTransferBusy] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<Map<string, string>>(new Map());

  const walletAddress = account?.address ?? null;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["playerStructureSnapshot", walletAddress],
    queryFn: ({ signal }) => fetchPlayerStructureSnapshot(walletAddress!, signal),
    enabled: !!walletAddress, staleTime: 30_000, retry: 1,
  });
  const groups = walletAddress && !error ? data?.groups ?? [] : [];
  const characterId = walletAddress && !error ? data?.characterId ?? "" : "";
  const loading = !!walletAddress && isPending;
  const err = walletAddress && error ? "Structures unavailable. Retry." : null;
  const handleRefresh = useCallback(() => { if (walletAddress) void refetch(); }, [walletAddress, refetch]);
  useEffect(() => {
    setTransferRecipients(new Map()); setTransferResult(new Map()); setTransferBusy(null);
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
        {characterId && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>char: {characterId.slice(0, 10)}…</span>}
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

      {/* Base-first structure directory */}
      {dashTab === "structures" && !loading && groups.length > 0 && (
        <TopologyGraph key={walletAddress} groups={groups} characterId={characterId} onRefresh={handleRefresh} />
      )}

      {/* Transfer Ownership tab */}
      {dashTab === "links" && <LinksPanel />}

      {dashTab === "transfer" && walletAddress && !loading && !err && (
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
            Transfer the OwnerCap for any structure to another pilot. The recipient gains full control — this cannot be undone.
          </p>
          <div style={{ fontSize: 11, padding: "8px 12px", marginBottom: 16, background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.2)", borderRadius: 3, color: "rgba(255,200,0,0.85)" }}>
            ⚠ Enter the recipient's <strong>Character Object ID</strong> — not their wallet address.<br />
            The OwnerCap is owned by the Character object. The recipient must be identified by their Character's Sui object ID so they can use the cap via their character.<br />
            <span style={{ opacity: 0.6, fontSize: 10 }}>Character Object ID: search for the recipient by name on the <strong>Chain Query</strong> tab and copy their Character Object ID, or ask them to share it (starts with 0x, 66 chars).</span>
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


    </div>
  );
}

// ── NodeStanceStrip ─ per-node defensive stance toggles ──────────────────────
//
// Lives inside TopologyGraph under each NetworkNode header. Operates ONLY on
// that node's connected children (Gates, Assemblies, Turrets, StorageUnits) —
// not the panel-wide structure list.
//
// Three buttons:
//   1. ⛨ DEFENSIVE STANCE — offline all industry, then online all turrets,
//      in a single sequenced PTB. Energy-aware: turrets are pre-fitted
//      against the budget that will be available AFTER the industry offlines
//      (which is `epMax` since everything else is going offline first).
//   2. ⚙ PEACETIME — offline all turrets first, then online industry up to
//      the energy budget, in a single sequenced PTB.
//   3. ▼ ALL OFF — offline everything connected to this node (turrets +
//      industry). No online phase, no energy bookkeeping needed.
//
// The buttons are disabled when there's nothing to do (the target state
// equals the current state). 'X cannot fit' surfaces in a small note when
// the energy budget excludes some structures.
//
// All three buttons issue ONE signed PTB. Sui executes commands in order
// inside a PTB, so reservations released by earlier offline calls become
// available for later online calls within the same tx — no race condition,
// no two-step UX where the user has to wait for a confirmation.

function NodeStanceStrip({
  children,
  epMax,
  consumedEp,
  nodeCanPowerChildren,
  characterId,
  onRefresh,
}: {
  node: PlayerStructure;  // unused but kept on the prop interface so future
                          // strip extensions (per-node label, kiosk URL) can
                          // reference it without changing call sites.
  children: PlayerStructure[];
  epMax: number;
  consumedEp: number;
  nodeCanPowerChildren: boolean;
  characterId: string;
  onRefresh: () => void;
}) {
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Pre-bucket children by category. Industry = anything that consumes power
  // and isn't a turret. NetworkNode itself is the energy source — never in
  // either bucket (it's the node we're operating under).
  const turrets = children.filter(c => c.kind === "Turret");
  const industry = children.filter(c =>
    c.kind === "Gate" || c.kind === "Assembly" || c.kind === "StorageUnit"
  );

  if (turrets.length === 0 && industry.length === 0) return null;

  const onlineTurrets = turrets.filter(c => c.isOnline);
  const offlineTurrets = turrets.filter(c => !c.isOnline);
  const onlineIndustry = industry.filter(c => c.isOnline);
  const offlineIndustry = industry.filter(c => !c.isOnline);

  // Defensive stance budget: after we offline all industry, the post-offline
  // budget is `epMax` minus whatever turrets are already online. We add the
  // currently-offline turrets up to that. (Online turrets stay online; their
  // EP is already counted in consumedEp pre-tx and remains reserved post-tx.)
  const onlineTurretsEp = onlineTurrets.reduce((s, c) => s + (c.energyCost ?? 0), 0);
  const defenseBudget = epMax - onlineTurretsEp;
  const defenseFit = selectFitsBudget(offlineTurrets, defenseBudget);

  // Peacetime budget: after we offline all turrets, the post-offline budget
  // is `epMax` minus whatever industry is already online. Currently-offline
  // industry fits up to the remaining budget.
  const onlineIndustryEp = onlineIndustry.reduce((s, c) => s + (c.energyCost ?? 0), 0);
  const peacetimeBudget = epMax - onlineIndustryEp;
  const peacetimeFit = selectFitsBudget(offlineIndustry, peacetimeBudget);

  // For the rendered buttons we need to know if there's anything to do.
  const defenseHasWork = onlineIndustry.length > 0 || defenseFit.fits.length > 0;
  const peacetimeHasWork = onlineTurrets.length > 0 || peacetimeFit.fits.length > 0;
  const allOffHasWork = onlineTurrets.length + onlineIndustry.length > 0;

  // Node must be online with fuel to bring any child online. If it's not we
  // still allow ALL OFF (offline doesn't need power) but lock the stance ones.
  const canOnline = nodeCanPowerChildren;

  // Stance batch executor: build a single PTB that flips a set of structures
  // off and another set on, sign+submit, then wait for the public fullnode to
  // surface every flipped structure's new status before refetching. The tail
  // structure(s) in the batch tend to take the longest to propagate; polling
  // each one in parallel until either confirmed or timed out gives the most
  // reliable post-batch refresh.
  async function execute(
    label: string,
    offlineSet: PlayerStructure[],
    onlineSet: PlayerStructure[],
    build: () => Promise<import("@mysten/sui/transactions").Transaction>,
  ) {
    if (!characterId) return;
    setBusy(label); setErr(null); setOkMsg(null);
    try {
      const tx = await build();
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const digest = (result as { digest?: string })?.digest ?? "";
      try {
        // Best-guess sound — defense/peacetime mix on/off, all-off is just off.
        if (label === "all-off") playPowerOff();
        else { playPowerOn(); }
      } catch { /* */ }
      setOkMsg(`✓ ${label} applied${digest ? ` (tx ${digest.slice(0, 10)}…)` : ""}.`);
      // Wait for every affected structure to flip on the public fullnode. We
      // poll in parallel — the longest-propagating one bounds total wait.
      // Use a slightly longer timeout for batches because more objects =
      // more chance one of them lags.
      const waitOpts = { timeoutMs: 18_000 };
      await Promise.all([
        ...offlineSet.map(s => waitForStructureStatus(s.objectId, false, waitOpts)),
        ...onlineSet.map(s => waitForStructureStatus(s.objectId, true, waitOpts)),
      ]);
      onRefresh();
    } catch (e) {
      setErr(translateTxError(e));
    } finally {
      setBusy(null);
    }
  }

  const onDefense = () =>
    execute("defense", onlineIndustry, defenseFit.fits, () =>
      buildBatchSequencedTransaction(onlineIndustry, defenseFit.fits, characterId)
    );

  const onPeacetime = () =>
    execute("peacetime", onlineTurrets, peacetimeFit.fits, () =>
      buildBatchSequencedTransaction(onlineTurrets, peacetimeFit.fits, characterId)
    );

  const onAllOff = () =>
    execute("all-off", [...onlineTurrets, ...onlineIndustry], [], () =>
      buildBatchSequencedTransaction(
        [...onlineTurrets, ...onlineIndustry],
        [],
        characterId,
      )
    );

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      padding: "6px 18px",
      background: "rgba(255,71,0,0.04)",
      borderBottom: "1px solid rgba(255,71,0,0.12)",
    }}>
      <span style={{
        fontSize: 10, color: "#FF4700", letterSpacing: "0.12em", fontWeight: 700, marginRight: 4,
      }}>STANCE ·</span>

      {/* Defense */}
      <button
        onClick={onDefense}
        disabled={!!busy || !defenseHasWork || !canOnline}
        title={
          !canOnline ? "Node must be online with fuel to bring children online"
            : !defenseHasWork ? "Already in defensive stance"
            : `Offline ${onlineIndustry.length} industry · online ${defenseFit.fits.length} turrets${defenseFit.skipped.length ? ` (${defenseFit.skipped.length} skipped: insufficient power)` : ""}`
        }
        style={stanceBtnInline("#ff6432", !!busy || !defenseHasWork || !canOnline)}
      >
        {busy === "defense" ? "Working…" : `⛨ DEFENSE (-${onlineIndustry.length} industry, +${defenseFit.fits.length} turrets)`}
      </button>

      {/* Peacetime */}
      <button
        onClick={onPeacetime}
        disabled={!!busy || !peacetimeHasWork || !canOnline}
        title={
          !canOnline ? "Node must be online with fuel to bring children online"
            : !peacetimeHasWork ? "Already in peacetime stance"
            : `Offline ${onlineTurrets.length} turrets · online ${peacetimeFit.fits.length} industry${peacetimeFit.skipped.length ? ` (${peacetimeFit.skipped.length} skipped: insufficient power)` : ""}`
        }
        style={stanceBtnInline("#64b4ff", !!busy || !peacetimeHasWork || !canOnline)}
      >
        {busy === "peacetime" ? "Working…" : `⚙ PEACETIME (-${onlineTurrets.length} turrets, +${peacetimeFit.fits.length} industry)`}
      </button>

      {/* All Off */}
      <button
        onClick={onAllOff}
        disabled={!!busy || !allOffHasWork}
        title={!allOffHasWork ? "Nothing online to offline" : `Offline all ${onlineTurrets.length + onlineIndustry.length} structures connected to this node`}
        style={stanceBtnInline("#ff4444", !!busy || !allOffHasWork)}
      >
        {busy === "all-off" ? "Working…" : `▼ ALL OFF (${onlineTurrets.length + onlineIndustry.length})`}
      </button>

      {/* EP context */}
      <span style={{ fontSize: 9, color: "rgba(175,175,155,0.55)", marginLeft: "auto" }}>
        EP: {consumedEp} / {epMax}
      </span>

      {okMsg && <div style={{ width: "100%", color: "#00c864", fontSize: 10, marginTop: 4 }}>{okMsg}</div>}
      {err && <div style={{ width: "100%", color: "#ff6432", fontSize: 10, marginTop: 4 }}>⚠ {err}</div>}
    </div>
  );
}

const stanceBtnInline = (fg: string, disabled: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
  padding: "3px 10px",
  background: disabled ? "rgba(100,100,100,0.05)" : `${fg}1a`,
  border: `1px solid ${disabled ? "rgba(100,100,100,0.2)" : `${fg}66`}`,
  color: disabled ? "rgba(180,180,180,0.4)" : fg,
  borderRadius: 2,
  cursor: disabled ? "default" : "pointer",
  fontFamily: "inherit",
});
