import { useState, useRef, useEffect } from "react";
import { StructureKindIcon } from "./StructureIcon";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useSponsoredTransaction, SponsoredTransactionActions } from "@evefrontier/dapp-kit";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { useDevOverrides } from "../contexts/DevModeContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { WORLD_PKG, CRADLEOS_PKG, CRADLEOS_ORIGINAL, CLOCK, SUI_TESTNET_RPC, SERVER_ENV } from "../constants";

// ── Preset dApp URLs per structure type ──────────────────────────────────────
const DAPP_BASE = SERVER_ENV === "stillness"
  ? "https://r4wf0d0g23.github.io/CradleOS"
  : "https://r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026";
const DAPP_OTHER_BASE = SERVER_ENV === "stillness"
  ? "https://r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026"
  : "https://r4wf0d0g23.github.io/CradleOS";
/** True if the structure's metadata URL points to the wrong server's dApp. */
const isWrongServerUrl = (url?: string) =>
  !!url && url.includes(DAPP_OTHER_BASE);

const DAPP_PRESETS: Record<string, Array<{ label: string; url: string; desc: string }>> = {
  Turret: [
    { label: "⚔ Defense", url: `${DAPP_BASE}/#/defense`, desc: "Tribe defense policy + passage intel" },
  ],
  Gate: [
    { label: "🔀 Gates",  url: `${DAPP_BASE}/#/gates`,   desc: "Gate policy + tribe access rules" },
    { label: "⚔ Defense", url: `${DAPP_BASE}/#/defense`, desc: "Tribe defense policy" },
  ],
  StorageUnit: [
    { label: "📦 Inventory", url: `${DAPP_BASE}/#/inventory`, desc: "SSU inventory viewer" },
    { label: "📊 Assets",    url: `${DAPP_BASE}/#/assets`,    desc: "Tribe asset ledger" },
    { label: "💱 Bounties",  url: `${DAPP_BASE}/#/bounties`,  desc: "Kill bounty board" },
  ],
  NetworkNode: [
    { label: "🏗 Structures", url: `${DAPP_BASE}/#/structures`, desc: "Structure manager" },
    { label: "📊 Assets",     url: `${DAPP_BASE}/#/assets`,     desc: "Tribe asset ledger" },
  ],
  Assembly: [
    { label: "📦 Inventory", url: `${DAPP_BASE}/#/inventory`, desc: "SSU inventory viewer" },
    { label: "📊 Assets",    url: `${DAPP_BASE}/#/assets`,     desc: "Tribe asset ledger" },
  ],
};
import {
  fetchPlayerStructures,
  parseAvailableEnergy,
  rpcGetObject,
  buildStructureOnlineTransaction,
  buildStructureOfflineTransaction,
  buildBatchOnlineTransaction,
  buildBatchOfflineTransaction,
  buildRenameTransaction, buildSetUrlTransaction,
  type LocationGroup,
  type PlayerStructure,
} from "../lib";

function readDigest(result: unknown): string | undefined {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    return (r["digest"] ?? r["txDigest"] ?? r["transactionDigest"]) as string | undefined;
  }
  return undefined;
}


/**
 * Derive structure tier label from on-chain energy cost + kind.
 * Confirmed energy costs per kind:
 *
 *   Turret:       Heavy=40  Standard=20  Mini=10
 *   StorageUnit:  Heavy≥400 Standard≥60  Mini<60  (approximate — confirm when available)
 *   Assembly:     same thresholds as StorageUnit until confirmed
 */
function structureTier(energyCost?: number, kind?: string): string {
  if (energyCost == null || energyCost === 0) return "";
  if (kind === "Turret") {
    if (energyCost >= 35) return "Heavy";
    if (energyCost >= 15) return "Standard";
    return "Mini";
  }
  // StorageUnit, Assembly — confirmed: Heavy=500, Standard=100, Mini=50
  if (energyCost >= 300) return "Heavy";
  if (energyCost >= 75)  return "Standard";
  return "Mini";
}

/** Short location hash for display — last 8 hex chars. */

function StatusBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span style={{
      padding: "2px 10px",
      borderRadius: "0",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      background: isOnline ? "rgba(0,255,150,0.12)" : "rgba(255,71,0,0.12)",
      color: isOnline ? "#00ff96" : "#ff6432",
      border: `1px solid ${isOnline ? "#00ff9640" : "#ff643240"}`,
    }}>
      {isOnline ? "● ONLINE" : "○ OFFLINE"}
    </span>
  );
}

function StructureRow({
  structure,
  characterId,
  tribeVaultId,
  onTxSuccess,
}: {
  structure: PlayerStructure;
  characterId: string;
  tribeVaultId?: string;
  onTxSuccess?: (digest?: string) => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const { overrideAccount } = useDevOverrides();
  const account = overrideAccount(_verifiedAcct);
  const dAppKit = useDAppKit();

  // Delegation state (Turrets + Gates only)
  const [delegationBusy, setDelegationBusy] = useState(false);
  const [delegationErr, setDelegationErr] = useState<string | null>(null);
  // Track if this structure has been delegated this session
  const [delegated, setDelegated] = useState(
    () => !!localStorage.getItem(`delegation:${structure.objectId}`)
  );

  const handleDelegateToTribe = async () => {
    if (!account || !tribeVaultId) return;
    setDelegationBusy(true); setDelegationErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::delegate_to_tribe`,
        arguments: [
          tx.pure.address(structure.objectId),  // structure_id
          tx.pure.address(tribeVaultId),         // tribe_vault_id
          tx.object(CLOCK),                      // clock
        ],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.setItem(`delegation:${structure.objectId}`, tribeVaultId);
      // Cache the delegation object ID for revoke (query owned objects after tx)
      try {
        const ownedRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getOwnedObjects",
            params: [account.address, { filter: { StructType: `${CRADLEOS_ORIGINAL}::turret_delegation::TurretDelegation` }, options: { showContent: true } }, null, 50] }),
        });
        const ownedJson = await ownedRes.json() as { result: { data: Array<{ data: { objectId: string; content: { fields: { structure_id: string } } } }> } };
        const match = ownedJson.result?.data?.find(o => o.data?.content?.fields?.structure_id === structure.objectId);
        if (match?.data?.objectId) localStorage.setItem(`delegation-obj:${structure.objectId}`, match.data.objectId);
      } catch { /* non-critical */ }
      setDelegated(true);
      onTxSuccess?.(readDigest(result));
    } catch (e) {
      setDelegationErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDelegationBusy(false);
    }
  };

  const handleRevokeDelegation = async () => {
    if (!account) return;
    const delegationObjId = localStorage.getItem(`delegation-obj:${structure.objectId}`);
    if (!delegationObjId) {
      setDelegationErr("Delegation object ID not found. Re-apply the policy first.");
      return;
    }
    setDelegationBusy(true); setDelegationErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::revoke_delegation`,
        arguments: [
          tx.object(delegationObjId),  // delegation object (owned)
          tx.object(CLOCK),
        ],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.removeItem(`delegation:${structure.objectId}`);
      localStorage.removeItem(`delegation-obj:${structure.objectId}`);
      setDelegated(false);
    } catch (e) {
      setDelegationErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDelegationBusy(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(structure.displayName === structure.label ? "" : structure.displayName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [settingUrl, setSettingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);
  useEffect(() => { if (settingUrl) urlInputRef.current?.focus(); }, [settingUrl]);

  const { mutateAsync: sendSponsoredTx } = useSponsoredTransaction();

  const handleSetUrl = async () => {
    const url = urlInput.trim();
    if (!url) { setSettingUrl(false); return; }
    setBusy(true); setErr(null);
    try {
      // Try sponsored transaction first (zero gas, EVE Vault only)
      // Pass minimal assembly shape — hook only needs item_id
      await sendSponsoredTx({
        txAction: SponsoredTransactionActions.UPDATE_METADATA,
        assembly: { item_id: structure.typeId ?? 0 } as any,
        metadata: { url },
      });
      setSettingUrl(false);
      setUrlInput("");
    } catch (e) {
      // Fall through to regular gas tx on any sponsored tx failure
      // (WalletSponsoredTransactionNotSupportedError, network errors, fetch failures, etc.)
      try {
        const tx = buildSetUrlTransaction(structure, characterId, url);
        const signer = new CurrentAccountSigner(dAppKit);
        const result = await signer.signAndExecuteTransaction({ transaction: tx });
        setSettingUrl(false);
        setUrlInput("");
        onTxSuccess?.(readDigest(result));
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : String(e2));
      }
    } finally { setBusy(false); }
  };

  // 2-step in-place confirmation, replacing window.confirm() which is
  // BLOCKED in the EVE Vault Mobile / Stillness embedded Chrome webview.
  // First click arms confirmRemoveUrl=true and the button changes label
  // to "CONFIRM REMOVE". Second click executes. Auto-disarms after 4s
  // so a stale armed state doesn't fire on a much-later click.
  // (Discovered 2026-04-26 from Raw's screenshot: dApp opens a Chrome
  // dialog out-of-game but does nothing in-game.)
  const [confirmRemoveUrl, setConfirmRemoveUrl] = useState(false);
  const confirmRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
    };
  }, []);

  const handleRemoveUrl = async () => {
    if (!confirmRemoveUrl) {
      setConfirmRemoveUrl(true);
      if (confirmRemoveTimerRef.current) clearTimeout(confirmRemoveTimerRef.current);
      confirmRemoveTimerRef.current = setTimeout(() => setConfirmRemoveUrl(false), 4000);
      return;
    }
    if (confirmRemoveTimerRef.current) {
      clearTimeout(confirmRemoveTimerRef.current);
      confirmRemoveTimerRef.current = null;
    }
    setConfirmRemoveUrl(false);
    setBusy(true); setErr(null);
    try {
      const tx = buildSetUrlTransaction(structure, characterId, "");
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      setSettingUrl(false);
      setUrlInput("");
      onTxSuccess?.(readDigest(result));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleOnline = async () => {
    setBusy(true); setErr(null);
    try {
      const tx = await buildStructureOnlineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      onTxSuccess?.(readDigest(result));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleOffline = async () => {
    setBusy(true); setErr(null);
    try {
      const tx = await buildStructureOfflineTransaction(structure, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      onTxSuccess?.(readDigest(result));
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
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      setRenaming(false);
      onTxSuccess?.(readDigest(result));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const canOnline = !!account && !busy && !structure.isOnline;
  const canOffline = !!account && !busy && structure.isOnline;
  // All 5 structure kinds expose update_metadata_name in the world contract
  const canRename = !!account && !busy;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,71,0,0.15)",
      borderRadius: "2px",
      padding: "12px 16px",
      marginBottom: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

        {/* Name / inline rename */}
        {renaming ? (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
              placeholder={structure.label}
              style={{
                background: "#161616",
                border: "1px solid rgba(255,71,0,0.4)",
                borderRadius: "0",
                color: "#FF4700",
                fontSize: "13px",
                fontWeight: 600,
                padding: "3px 8px",
                outline: "none",
                width: "160px",
              }}
            />
            <button className="accent-button" onClick={handleRename} disabled={busy} style={{ padding: "3px 10px", fontSize: "12px" }}>
              {busy ? "…" : "Save"}
            </button>
            <button className="ghost-button" onClick={() => setRenaming(false)} style={{ padding: "3px 10px", fontSize: "12px" }}>
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StructureKindIcon kind={structure.kind} size={16} opacity={0.65} />
            <span style={{ color: "#FF4700", fontWeight: 600, minWidth: "110px" }}>{structure.displayName}</span>
            {/* Object ID chip — always unique, links to chain explorer */}
            <a
              href={`https://suiscan.xyz/testnet/object/${structure.objectId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Object ID: ${structure.objectId}`}
              style={{
                display: "inline-block",
                fontFamily: "monospace",
                fontSize: "10px",
                color: "rgba(107,107,94,0.7)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "0",
                padding: "1px 5px",
                letterSpacing: "0.04em",
                textDecoration: "none",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#888")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              #{structure.objectId.slice(-6)}
            </a>
            {canRename && (
              <button
                onClick={() => setRenaming(true)}
                title="Rename"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(107,107,94,0.55)",
                  fontSize: "13px",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
              >
                ✎
              </button>
            )}
            {/* Set dApp URL button */}
            {canRename && (
              <button
                onClick={() => setSettingUrl(true)}
                title="Set dApp URL (in-game browser)"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(107,107,94,0.55)", fontSize: "11px",
                  padding: "0 2px", lineHeight: 1,
                }}
              >
                🔗
              </button>
            )}
          </div>
        )}

        {/* Wrong-server URL warning */}
        {!settingUrl && canRename && isWrongServerUrl(structure.metadataUrl) && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.35)" }}>
            <span style={{ fontSize: 10, color: "#ffa020", letterSpacing: "0.08em" }}>⚠ URL points to wrong server</span>
            <button
              disabled={busy}
              onClick={async () => {
                const fixedUrl = structure.metadataUrl!.replace(DAPP_OTHER_BASE, DAPP_BASE);
                setBusy(true); setErr(null);
                try {
                  const charInfo = await (await import("../lib")).findCharacterForWallet(account!.address);
                  if (!charInfo) { setErr("Character not found"); return; }
                  const tx = buildSetUrlTransaction(structure, charInfo.characterId, fixedUrl);
                  const signer = new CurrentAccountSigner(dAppKit);
                  const result = await signer.signAndExecuteTransaction({ transaction: tx });
                  onTxSuccess?.(readDigest(result));
                } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
                finally { setBusy(false); }
              }}
              style={{
                background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.5)",
                color: "#ffa020", fontSize: 10, fontWeight: 700, padding: "2px 10px",
                cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit",
              }}
            >FIX URL</button>
          </div>
        )}

        {/* Inline URL setter */}
        {settingUrl && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Preset quick-assign buttons */}
            {(DAPP_PRESETS[structure.kind] ?? []).length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(107,107,94,0.5)", letterSpacing: "0.06em", minWidth: 50 }}>QUICK</span>
                {(DAPP_PRESETS[structure.kind] ?? []).map(preset => (
                  <button
                    key={preset.url}
                    title={preset.desc}
                    onClick={() => {
                      setUrlInput(preset.url);
                      // auto-submit after setting
                      setTimeout(() => {
                        // use the value directly since state may not have updated yet
                        const url = preset.url;
                        setBusy(true); setErr(null);
                        (async () => {
                          try {
                            const tx = buildSetUrlTransaction(structure, characterId, url);
                            const signer = new CurrentAccountSigner(dAppKit);
                            const result = await signer.signAndExecuteTransaction({ transaction: tx });
                            setSettingUrl(false);
                            setUrlInput("");
                            onTxSuccess?.(readDigest(result));
                          } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
                          finally { setBusy(false); }
                        })();
                      }, 0);
                    }}
                    disabled={busy}
                    style={{
                      background: "rgba(255,71,0,0.1)", border: "1px solid rgba(255,71,0,0.35)",
                      color: "#FF4700", borderRadius: "0", fontSize: "11px", fontWeight: 600,
                      padding: "3px 10px", cursor: "pointer", letterSpacing: "0.04em",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            {/* Manual input */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={urlInputRef}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSetUrl(); if (e.key === "Escape") setSettingUrl(false); }}
                placeholder={`${DAPP_BASE}/#/defense`}
                style={{
                  flex: 1, minWidth: 240, background: "#161616",
                  border: "1px solid rgba(255,71,0,0.4)", borderRadius: "0",
                  color: "#FF4700", fontSize: "11px", padding: "3px 8px",
                  outline: "none", fontFamily: "monospace",
                }}
              />
              <button className="accent-button" onClick={handleSetUrl} disabled={busy} style={{ padding: "3px 10px", fontSize: "12px" }}>Set URL</button>
              <button className="ghost-button" onClick={() => setSettingUrl(false)} style={{ padding: "3px 10px", fontSize: "12px" }}>Cancel</button>
              <button
                onClick={handleRemoveUrl}
                disabled={busy}
                title={confirmRemoveUrl
                  ? "Click again within 4s to confirm. This clears the metadata URL on-chain."
                  : "Remove dApp / clear protocol URL from this structure"}
                style={{
                  background: confirmRemoveUrl ? "rgba(255,50,50,0.25)" : "rgba(255,50,50,0.08)",
                  border: `1px solid ${confirmRemoveUrl ? "#ff5555" : "rgba(255,50,50,0.3)"}`,
                  color: confirmRemoveUrl ? "#fff" : "#ff5555", borderRadius: "0",
                  fontSize: "11px", fontWeight: 600,
                  padding: "3px 10px", cursor: "pointer", letterSpacing: "0.04em",
                }}
              >
                {confirmRemoveUrl ? "CONFIRM REMOVE" : "✕ Remove dApp"}
              </button>
            </div>
          </div>
        )}

        {/* Size badge — StorageUnit, Assembly, Turret */}
        {(structure.kind === "StorageUnit" || structure.kind === "Assembly" || structure.kind === "Turret") && structureTier(structure.energyCost, structure.kind) && (
          <span style={{
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em",
            padding: "2px 7px", borderRadius: "0",
            background: "#181818", border: "1px solid rgba(255,71,0,0.22)",
            color: "#cc8020", flexShrink: 0,
          }}>
            {structureTier(structure.energyCost, structure.kind).toUpperCase()}
          </span>
        )}

        <StatusBadge isOnline={structure.isOnline} />

        {structure.kind === "NetworkNode" && structure.fuelLevelPct !== undefined && (
          <span style={{ fontSize: "12px", color: "#FAFAE5", fontWeight: 700, marginLeft: "4px", letterSpacing: "0.04em" }}>
            ⛽ {structure.fuelLevelPct.toFixed(1)}% · ⏱ {structure.runtimeHoursRemaining?.toFixed(0)}h
          </span>
        )}

        {/* Energy cost badge (non-NetworkNode structures) */}
        {structure.kind !== "NetworkNode" && structure.energyCost !== undefined && structure.energyCost > 0 && (
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#FF4700",
            background: "transparent",
            border: "none",
            borderRadius: "0",
            padding: "0 4px",
            letterSpacing: "0.04em",
          }}>
            ⚡{structure.energyCost}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          <button
            className="accent-button"
            onClick={handleOnline}
            disabled={!canOnline}
            style={{ padding: "4px 12px", fontSize: "12px" }}
          >
            {busy ? "…" : "On"}
          </button>
          <button
            className="ghost-button"
            onClick={handleOffline}
            disabled={!canOffline}
            style={{ padding: "4px 12px", fontSize: "12px" }}
          >
            {busy ? "…" : "Off"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>
          ⚠ {err}
        </div>
      )}

      {/* Tribe policy delegation — Turrets and Gates only */}
      {(structure.kind === "Turret" || structure.kind === "Gate") && account && (
        <div style={{
          marginTop: "10px",
          borderTop: "1px solid rgba(255,71,0,0.1)",
          paddingTop: "10px",
          display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "10px", color: "rgba(107,107,94,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Defense Policy
          </span>
          {delegated ? (
            <>
              <span style={{ fontSize: "10px", color: "#00ff96", fontFamily: "monospace", border: "1px solid rgba(0,255,150,0.25)", padding: "2px 8px", background: "rgba(0,255,150,0.05)" }}>
                ✓ TRIBE POLICY ACTIVE
              </span>
              <button
                onClick={handleRevokeDelegation}
                disabled={delegationBusy}
                style={{ fontSize: "10px", color: "#ff6b6b", fontFamily: "monospace", border: "1px solid rgba(255,107,107,0.3)", padding: "2px 8px", background: "transparent", cursor: "pointer", letterSpacing: "0.08em" }}
              >
                {delegationBusy ? "…" : "REVOKE"}
              </button>
            </>
          ) : tribeVaultId ? (
            <button
              onClick={handleDelegateToTribe}
              disabled={delegationBusy}
              style={{ fontSize: "10px", color: "#FF4700", fontFamily: "monospace", border: "1px solid rgba(255,71,0,0.4)", padding: "2px 10px", background: "rgba(255,71,0,0.06)", cursor: "pointer", letterSpacing: "0.08em", fontWeight: 700 }}
            >
              {delegationBusy ? "…" : "APPLY TRIBE POLICY"}
            </button>
          ) : (
            <span style={{ fontSize: "10px", color: "rgba(107,107,94,0.5)", fontFamily: "monospace" }}>
              No tribe — join a tribe to delegate
            </span>
          )}
          {delegationErr && (
            <div style={{ fontSize: "10px", color: "#ff6432", fontFamily: "monospace", width: "100%", marginTop: "4px" }}>
              ⚠ {delegationErr}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Batch Online / Offline controls ─────────────────────────────────────────

function GroupBatchControls({
  structures,
  characterId,
  nodeId,
  onAllDone,
}: {
  structures: PlayerStructure[];
  characterId: string;
  nodeId?: string;
  onAllDone: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState<"online" | "offline" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [availableEnergy, setAvailableEnergy] = useState<number | null>(null);

  // Fetch available energy from the NetworkNode
  useEffect(() => {
    if (!nodeId) return;
    rpcGetObject(nodeId).then((fields: Record<string, unknown>) => {
      setAvailableEnergy(parseAvailableEnergy(fields));
    }).catch(() => {});
  }, [nodeId, structures]);

  const offlineStructures = structures.filter(s => !s.isOnline && s.kind !== "NetworkNode");
  const onlineStructures  = structures.filter(s => s.isOnline && s.kind !== "NetworkNode");

  // Category definitions
  const DEFENSE_KINDS   = new Set(["Turret", "Gate"]);
  const INDUSTRIAL_KINDS = new Set(["Assembly", "StorageUnit"]);
  const defenseOnline   = structures.filter(s => DEFENSE_KINDS.has(s.kind) && s.isOnline);
  const defenseOffline  = offlineStructures.filter(s => DEFENSE_KINDS.has(s.kind));
  const industrialOnline  = structures.filter(s => INDUSTRIAL_KINDS.has(s.kind) && s.isOnline);
  const industrialOffline = offlineStructures.filter(s => INDUSTRIAL_KINDS.has(s.kind));

  // Compute which offline structures can actually be brought online within energy budget
  const affordableOffline = (() => {
    if (availableEnergy === null) return offlineStructures; // unknown — try all
    let budget = availableEnergy;
    const result: PlayerStructure[] = [];
    for (const s of offlineStructures.slice().sort((a, b) => (a.energyCost ?? 0) - (b.energyCost ?? 0))) {
      const cost = s.energyCost ?? 0;
      if (cost === 0 || budget >= cost) {
        result.push(s);
        budget -= cost;
      }
    }
    return result;
  })();

  // Energy that would be consumed by bringing all affordable offline structures online
  const pendingCost = affordableOffline.reduce((sum, s) => sum + (s.energyCost ?? 0), 0);

  const runBatch = async (targets: PlayerStructure[], action: "online" | "offline") => {
    if (!account || !targets.length) return;
    setBusy(action); setErr(null);
    try {
      const tx = action === "online"
        ? buildBatchOnlineTransaction(targets, characterId)
        : await buildBatchOfflineTransaction(targets, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onAllDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (structures.length <= 1) return null;

  const skipped = offlineStructures.length - affordableOffline.length;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px",
      padding: "8px 12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,71,0,0.10)",
      borderRadius: "0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", letterSpacing: "0.06em" }}>BATCH</span>

        <button
          className="accent-button"
          onClick={() => runBatch(affordableOffline, "online")}
          disabled={!!busy || !account || affordableOffline.length === 0}
          style={{ padding: "4px 14px", fontSize: "12px" }}
        >
          {busy === "online" ? "…" : `⚡ On (${affordableOffline.length})`}
        </button>

        <button
          className="ghost-button"
          onClick={() => runBatch(onlineStructures, "offline")}
          disabled={!!busy || !account || onlineStructures.length === 0}
          style={{ padding: "4px 14px", fontSize: "12px" }}
        >
          {busy === "offline" ? "…" : `○ Off All (${onlineStructures.length})`}
        </button>

        {/* Energy tally */}
        {availableEnergy !== null && (
          <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: availableEnergy < 50 ? "#ff3838" : "#FAFAE5", letterSpacing: "0.04em" }}>
            ⚡ {availableEnergy - (busy === "online" ? pendingCost : 0)} / {availableEnergy + onlineStructures.reduce((s, x) => s + (x.energyCost ?? 0), 0)} available
          </span>
        )}
      </div>

      {/* Defense batch row */}
      {(defenseOnline.length > 0 || defenseOffline.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ color: "#ff4444", fontSize: "11px", letterSpacing: "0.06em", minWidth: 60 }}>DEFENSE</span>
          <button
            className="accent-button"
            onClick={() => runBatch(defenseOffline, "online")}
            disabled={!!busy || !account || defenseOffline.length === 0}
            style={{ padding: "4px 12px", fontSize: "11px", background: "rgba(255,68,68,0.15)", borderColor: "rgba(255,68,68,0.4)" }}
          >
            {busy === "online" ? "…" : `⚡ On Defense (${defenseOffline.length})`}
          </button>
          <button
            className="ghost-button"
            onClick={() => runBatch(defenseOnline, "offline")}
            disabled={!!busy || !account || defenseOnline.length === 0}
            style={{ padding: "4px 12px", fontSize: "11px" }}
          >
            {busy === "offline" ? "…" : `○ Off Defense (${defenseOnline.length})`}
          </button>
        </div>
      )}

      {/* Industrial batch row */}
      {(industrialOnline.length > 0 || industrialOffline.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ color: "#ffd700", fontSize: "11px", letterSpacing: "0.06em", minWidth: 60 }}>INDUSTRIAL</span>
          <button
            className="ghost-button"
            onClick={() => runBatch(industrialOnline, "offline")}
            disabled={!!busy || !account || industrialOnline.length === 0}
            style={{ padding: "4px 12px", fontSize: "11px" }}
          >
            {busy === "offline" ? "…" : `○ Off Industrials (${industrialOnline.length})`}
          </button>
          <button
            className="accent-button"
            onClick={() => runBatch(industrialOffline, "online")}
            disabled={!!busy || !account || industrialOffline.length === 0}
            style={{ padding: "4px 12px", fontSize: "11px", background: "rgba(255,215,0,0.1)", borderColor: "rgba(255,215,0,0.4)" }}
          >
            {busy === "online" ? "…" : `⚡ On Industrials (${industrialOffline.length})`}
          </button>
        </div>
      )}

      {skipped > 0 && (
        <div style={{ fontSize: "10px", color: "#ff6432" }}>
          ⚠ {skipped} structure{skipped > 1 ? "s" : ""} skipped — insufficient node energy
          {offlineStructures.filter(s => !affordableOffline.includes(s)).map(s =>
            ` · ${s.displayName} (⚡${s.energyCost ?? "?"})`
          ).join("")}
        </div>
      )}

      {err && (
        <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {err}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  onTxSuccess?: (digest?: string) => void;
};

export function StructurePanel({ onTxSuccess }: Props) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const { overrideAccount } = useDevOverrides();
  const account = overrideAccount(_verifiedAcct);
  const [activeTab, setActiveTab] = useState(0);
  const [characterId, setCharacterId] = useState<string | null>(null);

  // Read cached tribe vault ID so delegation can reference it
  const tribeVaultId = (() => {
    try {
      const keys = Object.keys(localStorage);
      const k = keys.find(k => k.startsWith("cradleos:vault:"));
      return k ? localStorage.getItem(k) ?? undefined : undefined;
    } catch { return undefined; }
  })();

  const { data: groups, isLoading, error, refetch } = useQuery<LocationGroup[]>({
    queryKey: ["playerStructures", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      const groups = await fetchPlayerStructures(account.address);
      // Extract character ID from the first structure's ownerCap chain (via lib internals),
      // but since fetchPlayerStructures resolves it internally, query CharacterCreatedEvent here too.
      // Resolve character ID via owned PlayerProfile object (exact, no pagination issues)
      const profileRes = await fetch("https://fullnode.testnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "suix_getOwnedObjects",
          params: [account.address, { filter: { StructType: `${WORLD_PKG}::character::PlayerProfile` }, options: { showContent: true } }, null, 5],
        }),
      });
      const pj = await profileRes.json() as { result?: { data?: Array<{ data?: { content?: { fields?: { character_id?: string } } } }> } };
      const charId = pj.result?.data?.[0]?.data?.content?.fields?.character_id ?? null;
      setCharacterId(charId);
      return groups;
    },
    enabled: !!account?.address,
    staleTime: 30_000,
  });

  const handleTxSuccess = (digest?: string) => {
    onTxSuccess?.(digest);
    setTimeout(() => refetch(), 2000);
  };

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Connect EVE Vault to view your structures
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Scanning structures…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ color: "#ff6432", padding: "16px" }}>
        Failed to load structures: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        No structures found for this wallet.
      </div>
    );
  }

  const activeGroup = groups[activeTab] ?? groups[0];

  return (
    <div style={{ background: "var(--ccp-bg)" }}>
      {/* Location Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>
        {groups.map((group, idx) => (
          <button
            key={group.key}
            onClick={() => setActiveTab(idx)}
            style={{
              padding: "6px 16px",
              borderRadius: "0",
              border: `1px solid ${idx === activeTab ? "#FF4700" : "rgba(255,71,0,0.25)"}`,
              background: idx === activeTab ? "#1e1e1e" : "transparent",
              color: idx === activeTab ? "#FF4700" : "#888",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: idx === activeTab ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {group.tabLabel}
            <span style={{ marginLeft: "6px", fontSize: "11px", opacity: 0.7 }}>
              ({group.structures.length})
            </span>
          </button>
        ))}
      </div>

      {/* Batch controls */}
      {characterId && (
        <GroupBatchControls
          structures={activeGroup.structures}
          characterId={characterId ?? ""}
          nodeId={activeGroup.structures.find(s => s.kind === "NetworkNode")?.objectId}
          onAllDone={() => setTimeout(() => refetch(), 2000)}
        />
      )}

      {/* Structure List */}
      <div>
        {!characterId && (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", padding: "8px 0", fontFamily: "monospace" }}>
            Resolving character… structure actions will be available shortly.
          </div>
        )}
        {activeGroup.structures.map((s) => (
          <StructureRow
            key={s.objectId}
            structure={s}
            characterId={characterId ?? ""}
            tribeVaultId={tribeVaultId ?? undefined}
            onTxSuccess={handleTxSuccess}
          />
        ))}
      </div>
    </div>
  );
}
