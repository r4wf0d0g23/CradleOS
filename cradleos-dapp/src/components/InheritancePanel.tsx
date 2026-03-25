import { normalizeChainError } from "../utils";
/**
 * InheritancePanel — On-chain succession deed manager.
 *
 * Founder view:
 *   • Create a WillDeed (heir, timeout days, notes)
 *   • Check In to reset the inactivity clock
 *   • Update heir
 *   • Revoke deed (with confirmation)
 *   • Countdown to heir's claimable window
 *
 * Heir view:
 *   • Detect deeds that name the connected wallet as heir
 *   • Execute succession once the timeout has elapsed
 *
 * Public registry:
 *   • List all active (non-revoked, non-executed) WillCreated events
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG, SUI_TESTNET_RPC, CLOCK, eventType } from "../constants";
import {
  rpcGetObject, numish,
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId,
  type TribeVaultState,
} from "../lib";

// ── Types ─────────────────────────────────────────────────────────────────────

type WillDeedState = {
  objectId: string;
  vaultId: string;
  founder: string;
  heir: string;
  timeoutMs: number;
  lastCheckinMs: number;
  executed: boolean;
  createdMs: number;
  notes: string;
};

type WillCreatedEvent = {
  deedId: string;
  vaultId: string;
  founder: string;
  heir: string;
  timeoutMs: number;
  /** Approximate from event timestamp */
  timestampMs?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function msToHuman(ms: number): string {
  if (ms <= 0) return "0s";
  const days    = Math.floor(ms / 86_400_000);
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0)    return `${days}d ${hours}h`;
  if (hours > 0)   return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function timeAgo(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 0) return "just now";
  return `${msToHuman(delta)} ago`;
}

// ── RPC fetchers ──────────────────────────────────────────────────────────────

async function fetchWillDeed(deedId: string): Promise<WillDeedState | null> {
  try {
    const fields = await rpcGetObject(deedId);
    if (fields["_deleted"]) return null;
    const vaultIdRaw = fields["vault_id"];
    const vaultId =
      typeof vaultIdRaw === "string"
        ? vaultIdRaw
        : (vaultIdRaw as { id?: string } | null)?.id ??
          String(vaultIdRaw ?? "");
    return {
      objectId: deedId,
      vaultId,
      founder: String(fields["founder"] ?? ""),
      heir: String(fields["heir"] ?? ""),
      timeoutMs: numish(fields["timeout_ms"]) ?? 0,
      lastCheckinMs: numish(fields["last_checkin_ms"]) ?? 0,
      executed: Boolean(fields["executed"]),
      createdMs: numish(fields["created_ms"]) ?? 0,
      notes: String((fields["notes"] as { bytes?: unknown[] } | null)?.bytes
        ? new TextDecoder().decode(new Uint8Array((fields["notes"] as { bytes: number[] }).bytes))
        : (fields["notes"] ?? "")),
    };
  } catch { return null; }
}

/** Query WillCreated events and return all of them. */
async function fetchAllWillCreatedEvents(): Promise<WillCreatedEvent[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("inheritance", "WillCreated") }, null, 100, true],
      }),
    });
    const j = await res.json() as {
      result?: {
        data?: Array<{
          parsedJson: Record<string, unknown>;
          timestampMs?: string | number;
        }>
      }
    };
    return (j.result?.data ?? []).map(e => ({
      deedId:    String(e.parsedJson["deed_id"] ?? ""),
      vaultId:   String(e.parsedJson["vault_id"] ?? ""),
      founder:   String(e.parsedJson["founder"] ?? ""),
      heir:      String(e.parsedJson["heir"] ?? ""),
      timeoutMs: numish(e.parsedJson["timeout_ms"]) ?? 0,
      timestampMs: e.timestampMs ? Number(e.timestampMs) : undefined,
    }));
  } catch { return []; }
}

/** Returns deed IDs that were revoked (WillRevoked events). */
async function fetchRevokedDeedIds(): Promise<Set<string>> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("inheritance", "WillRevoked") }, null, 200, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    return new Set((j.result?.data ?? []).map(e => String(e.parsedJson["deed_id"] ?? "")));
  } catch { return new Set(); }
}

/** localStorage cache key for deed ID per vault */
function willCacheKey(vaultId: string): string {
  return `cradleos:will:${vaultId}`;
}

async function fetchDeedIdForVault(vaultId: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(willCacheKey(vaultId));
    if (cached) return cached;
  } catch { /* */ }
  try {
    const events = await fetchAllWillCreatedEvents();
    const match = events.find(e => e.vaultId === vaultId);
    if (match) {
      try { localStorage.setItem(willCacheKey(vaultId), match.deedId); } catch { /* */ }
      return match.deedId;
    }
    return null;
  } catch { return null; }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function buildCreateWillTransaction(
  vaultId: string,
  heir: string,
  timeoutDays: number,
  notes: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::inheritance::create_will_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(heir),
      tx.pure.u64(BigInt(timeoutDays)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(notes))),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildCheckInTransaction(deedId: string, vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::inheritance::check_in_entry`,
    arguments: [tx.object(deedId), tx.object(vaultId), tx.object(CLOCK)],
  });
  return tx;
}

function buildUpdateHeirTransaction(
  deedId: string,
  vaultId: string,
  newHeir: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::inheritance::update_heir_entry`,
    arguments: [
      tx.object(deedId),
      tx.object(vaultId),
      tx.pure.address(newHeir),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildRevokeWillTransaction(deedId: string, vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::inheritance::revoke_will_entry`,
    arguments: [tx.object(deedId), tx.object(vaultId), tx.object(CLOCK)],
  });
  return tx;
}

function buildExecuteSuccessionTransaction(deedId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::inheritance::execute_succession_entry`,
    arguments: [tx.object(deedId), tx.object(CLOCK)],
  });
  return tx;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FounderDeedView({
  deed,
  vault,
  onRefresh,
}: {
  deed: WillDeedState;
  vault: TribeVaultState;
  onRefresh: () => void;
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [checkBusy, setCheckBusy]     = useState(false);
  const [checkErr, setCheckErr]       = useState<string | null>(null);
  const [updateHeir, setUpdateHeir]   = useState("");
  const [updateBusy, setUpdateBusy]   = useState(false);
  const [updateErr, setUpdateErr]     = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy]   = useState(false);
  const [revokeErr, setRevokeErr]     = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState(false);

  const invalidate = () => {
    const delays = [2500, 6000, 12000];
    for (const d of delays) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["willDeed"] });
        queryClient.invalidateQueries({ queryKey: ["willDeedId"] });
      }, d);
    }
  };

  const handleCheckIn = useCallback(async () => {
    setCheckBusy(true); setCheckErr(null);
    try {
      const tx = buildCheckInTransaction(deed.objectId, vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
      onRefresh();
    } catch (e) { setCheckErr(normalizeChainError(e)); }
    finally { setCheckBusy(false); }
  }, [deed.objectId, vault.objectId, dAppKit]);

  const handleUpdateHeir = useCallback(async () => {
    if (!updateHeir.trim()) return;
    setUpdateBusy(true); setUpdateErr(null);
    try {
      const tx = buildUpdateHeirTransaction(deed.objectId, vault.objectId, updateHeir.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setUpdateHeir("");
      invalidate();
      onRefresh();
    } catch (e) { setUpdateErr(normalizeChainError(e)); }
    finally { setUpdateBusy(false); }
  }, [deed.objectId, vault.objectId, updateHeir, dAppKit]);

  const handleRevoke = useCallback(async () => {
    setRevokeBusy(true); setRevokeErr(null);
    try {
      const tx = buildRevokeWillTransaction(deed.objectId, vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      try { localStorage.removeItem(willCacheKey(vault.objectId)); } catch { /* */ }
      invalidate();
      onRefresh();
    } catch (e) { setRevokeErr(normalizeChainError(e)); }
    finally { setRevokeBusy(false); setRevokeConfirm(false); }
  }, [deed.objectId, vault.objectId, dAppKit]);

  const nowMs        = Date.now();
  const elapsedMs    = nowMs - deed.lastCheckinMs;
  const remainingMs  = deed.timeoutMs - elapsedMs;
  const isClaimable  = remainingMs <= 0;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,71,0,0.18)",
      borderRadius: "0",
      padding: "16px",
      marginBottom: "20px",
    }}>
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>
        Active Succession Deed
      </div>

      {/* Status rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
        {[
          ["Deed ID",      shortAddr(deed.objectId)],
          ["Heir",         shortAddr(deed.heir)],
          ["Timeout",      `${Math.round(deed.timeoutMs / 86_400_000)} days`],
          ["Last Check-In", timeAgo(deed.lastCheckinMs)],
          ["Created",      new Date(deed.createdMs).toLocaleDateString()],
          ["Executed",     deed.executed ? "Yes" : "No"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
            <span style={{ color: "rgba(107,107,94,0.6)", minWidth: "110px", fontFamily: "monospace" }}>{label}</span>
            <span style={{ color: "#ccc", fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
        {deed.notes && (
          <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
            <span style={{ color: "rgba(107,107,94,0.6)", minWidth: "110px", fontFamily: "monospace" }}>Notes</span>
            <span style={{ color: "#aaa", fontStyle: "italic" }}>{deed.notes}</span>
          </div>
        )}
      </div>

      {/* Countdown */}
      <div style={{
        padding: "10px 14px",
        borderRadius: "0",
        marginBottom: "14px",
        background: isClaimable ? "rgba(255,50,50,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isClaimable ? "rgba(255,50,50,0.4)" : "rgba(255,255,255,0.08)"}`,
      }}>
        {isClaimable ? (
          <span style={{ color: "#ff4444", fontWeight: 700, fontSize: "13px" }}>
            CLAIMABLE NOW — heir may execute succession
          </span>
        ) : (
          <span style={{ color: "#aaa", fontSize: "12px" }}>
            Heir can claim in <strong style={{ color: "#fff" }}>{msToHuman(remainingMs)}</strong>
          </span>
        )}
      </div>

      {/* Check In */}
      {!deed.executed && (
        <div style={{ marginBottom: "12px" }}>
          <button
            onClick={handleCheckIn}
            disabled={checkBusy}
            style={{
              background: "rgba(0,200,255,0.1)",
              border: "1px solid rgba(0,200,255,0.3)",
              color: "#00c8ff",
              borderRadius: "0",
              fontSize: "12px",
              padding: "6px 18px",
              cursor: "pointer",
            }}
          >
            {checkBusy ? "Checking In…" : "Check In"}
          </button>
          {checkErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {checkErr}</div>}
        </div>
      )}

      {/* Update Heir */}
      {!deed.executed && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "6px" }}>
            UPDATE HEIR
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={updateHeir}
              onChange={e => setUpdateHeir(e.target.value)}
              placeholder="0x… new heir address"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0",
                color: "#fff",
                fontSize: "11px",
                padding: "6px 10px",
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={handleUpdateHeir}
              disabled={updateBusy || !updateHeir.trim()}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#aaa",
                borderRadius: "0",
                fontSize: "12px",
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              {updateBusy ? "…" : "Update"}
            </button>
          </div>
          {updateErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {updateErr}</div>}
        </div>
      )}

      {/* Revoke */}
      {!deed.executed && (
        <div>
          {!revokeConfirm ? (
            <button
              onClick={() => setRevokeConfirm(true)}
              style={{
                background: "rgba(255,50,50,0.06)",
                border: "1px solid rgba(255,50,50,0.25)",
                color: "#ff6464",
                borderRadius: "0",
                fontSize: "11px",
                padding: "5px 14px",
                cursor: "pointer",
              }}
            >
              Revoke Testament
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ color: "#ff6464", fontSize: "11px" }}>Confirm revoke?</span>
              <button
                onClick={handleRevoke}
                disabled={revokeBusy}
                style={{
                  background: "rgba(255,50,50,0.15)",
                  border: "1px solid rgba(255,50,50,0.4)",
                  color: "#ff4444",
                  borderRadius: "0",
                  fontSize: "11px",
                  padding: "5px 14px",
                  cursor: "pointer",
                }}
              >
                {revokeBusy ? "Revoking…" : "Yes, Revoke"}
              </button>
              <button
                onClick={() => setRevokeConfirm(false)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#666",
                  borderRadius: "0",
                  fontSize: "11px",
                  padding: "5px 14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {revokeErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {revokeErr}</div>}
        </div>
      )}
    </div>
  );
}

function CreateWillForm({
  vault,
  onCreated,
}: {
  vault: TribeVaultState;
  onCreated: (deedId: string) => void;
}) {
  const dAppKit = useDAppKit();
  const [heir, setHeir]               = useState("");
  const [timeoutDays, setTimeoutDays] = useState("90");
  const [notes, setNotes]             = useState("");
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  const handleCreate = async () => {
    if (!heir.trim()) return;
    setBusy(true); setErr(null);
    try {
      const tx = buildCreateWillTransaction(vault.objectId, heir.trim(), parseInt(timeoutDays, 10) || 90, notes.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Try to extract deed ID from tx effects
      const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
      let resolvedDeedId: string | null = null;
      if (digest) {
        try {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "sui_getTransactionBlock",
              params: [digest, { showEffects: true }],
            }),
          });
          const j = await res.json() as {
            result?: {
              effects?: {
                created?: Array<{ owner: unknown; reference: { objectId: string } }>
              }
            }
          };
          const sharedCreated = (j.result?.effects?.created ?? [])
            .filter(c => c.owner && typeof c.owner === "object" && "Shared" in (c.owner as object))
            .map(c => c.reference.objectId);
          if (sharedCreated[0]) {
            resolvedDeedId = sharedCreated[0];
            try { localStorage.setItem(willCacheKey(vault.objectId), resolvedDeedId); } catch { /* */ }
          }
        } catch { /* fall through */ }
      }
      onCreated(resolvedDeedId ?? "");
    } catch (e) { setErr(normalizeChainError(e)); }
    finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0",
    color: "#fff",
    fontSize: "11px",
    padding: "6px 10px",
    outline: "none",
    fontFamily: "monospace",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "0",
      padding: "16px",
      marginBottom: "20px",
    }}>
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>
        Create Testament
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "4px" }}>
            HEIR ADDRESS
          </div>
          <input
            value={heir}
            onChange={e => setHeir(e.target.value)}
            placeholder="0x…"
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "4px" }}>
            INACTIVITY TIMEOUT (days)
          </div>
          <input
            type="number"
            min={1}
            value={timeoutDays}
            onChange={e => setTimeoutDays(e.target.value)}
            style={{ ...inputStyle, width: "120px" }}
          />
        </div>
        <div>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "4px" }}>
            NOTES (optional — message to heir and tribe)
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional message…"
            rows={2}
            style={{
              ...inputStyle,
              fontFamily: "sans-serif",
              resize: "vertical",
            }}
          />
        </div>
        <div>
          <button
            className="accent-button"
            onClick={handleCreate}
            disabled={busy || !heir.trim()}
          >
            {busy ? "Creating…" : "Create Testament"}
          </button>
          {err && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {err}</div>}
        </div>
      </div>
    </div>
  );
}

function HeirView({ address }: { address: string }) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const { data: allEvents } = useQuery<WillCreatedEvent[]>({
    queryKey: ["allWillCreated"],
    queryFn: fetchAllWillCreatedEvents,
    staleTime: 30_000,
  });

  // Find deeds that name this address as heir
  const heirDeeds = (allEvents ?? []).filter(
    e => e.heir.toLowerCase() === address.toLowerCase()
  );

  const [execBusy, setExecBusy] = useState<Record<string, boolean>>({});
  const [execErr,  setExecErr]  = useState<Record<string, string>>({});

  const { data: deedStates } = useQuery<Record<string, WillDeedState | null>>({
    queryKey: ["heirDeedStates", address],
    queryFn: async () => {
      const result: Record<string, WillDeedState | null> = {};
      await Promise.all(heirDeeds.map(async e => {
        result[e.deedId] = await fetchWillDeed(e.deedId);
      }));
      return result;
    },
    enabled: heirDeeds.length > 0,
    staleTime: 30_000,
  });

  const handleExecute = async (deedId: string) => {
    setExecBusy(prev => ({ ...prev, [deedId]: true }));
    setExecErr(prev => ({ ...prev, [deedId]: "" }));
    try {
      const tx = buildExecuteSuccessionTransaction(deedId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["heirDeedStates"] });
      }, 3000);
    } catch (e) {
      setExecErr(prev => ({ ...prev, [deedId]: normalizeChainError(e) }));
    } finally {
      setExecBusy(prev => ({ ...prev, [deedId]: false }));
    }
  };

  if (heirDeeds.length === 0) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "0",
        padding: "14px 16px",
        marginBottom: "20px",
        color: "rgba(107,107,94,0.55)",
        fontSize: "12px",
      }}>
        No active testaments name your address as heir.
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(0,180,255,0.03)",
      border: "1px solid rgba(0,180,255,0.15)",
      borderRadius: "0",
      padding: "16px",
      marginBottom: "20px",
    }}>
      <div style={{ color: "#00c8ff", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>
        Designated Heir
      </div>
      {heirDeeds.map(e => {
        const deed = deedStates?.[e.deedId];
        if (!deed) return null;
        const nowMs       = Date.now();
        const elapsedMs   = nowMs - deed.lastCheckinMs;
        const remainingMs = deed.timeoutMs - elapsedMs;
        const claimable   = remainingMs <= 0 && !deed.executed;
        return (
          <div key={e.deedId} style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${claimable ? "rgba(255,50,50,0.35)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "0",
            padding: "12px",
            marginBottom: "10px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "10px" }}>
              {[
                ["Vault",      shortAddr(deed.vaultId)],
                ["Founder",    shortAddr(deed.founder)],
                ["Last Active", timeAgo(deed.lastCheckinMs)],
                ["Status",     deed.executed ? "Executed" : claimable ? "CLAIMABLE" : `Claimable in ${msToHuman(remainingMs)}`],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                  <span style={{ color: "rgba(107,107,94,0.6)", minWidth: "90px", fontFamily: "monospace" }}>{lbl}</span>
                  <span style={{
                    fontFamily: "monospace",
                    color: lbl === "Status" && claimable ? "#ff4444" : "#ccc",
                    fontWeight: lbl === "Status" && claimable ? 700 : 400,
                  }}>{val}</span>
                </div>
              ))}
              {deed.notes && (
                <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                  <span style={{ color: "rgba(107,107,94,0.6)", minWidth: "90px" }}>Notes</span>
                  <span style={{ color: "#aaa", fontStyle: "italic" }}>{deed.notes}</span>
                </div>
              )}
            </div>
            {claimable && (
              <>
                <button
                  onClick={() => handleExecute(deed.objectId)}
                  disabled={execBusy[deed.objectId]}
                  style={{
                    background: "rgba(255,50,50,0.12)",
                    border: "1px solid rgba(255,50,50,0.4)",
                    color: "#ff4444",
                    borderRadius: "0",
                    fontSize: "12px",
                    padding: "6px 18px",
                    cursor: "pointer",
                    marginBottom: "6px",
                  }}
                >
                  {execBusy[deed.objectId] ? "Executing…" : "Execute Succession"}
                </button>
                <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px" }}>
                  This marks the deed as executed on-chain. Coordinate with tribe members
                  to complete the vault transfer using the deed as proof of founder intent.
                </div>
                {execErr[deed.objectId] && (
                  <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "4px" }}>
                    ⚠ {execErr[deed.objectId]}
                  </div>
                )}
              </>
            )}
            {deed.executed && (
              <div style={{
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#888",
                fontSize: "11px",
              }}>
                Succession executed. Coordinate with tribe members to complete vault transfer.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PublicRegistry() {
  const { data: allEvents, isLoading } = useQuery<WillCreatedEvent[]>({
    queryKey: ["allWillCreated"],
    queryFn: fetchAllWillCreatedEvents,
    staleTime: 60_000,
  });

  const { data: revokedIds } = useQuery<Set<string>>({
    queryKey: ["revokedDeedIds"],
    queryFn: fetchRevokedDeedIds,
    staleTime: 60_000,
  });

  // Fetch live state for displayed deeds to filter executed ones
  const visibleEvents = (allEvents ?? []).filter(e => !(revokedIds ?? new Set()).has(e.deedId));

  const { data: deedStates } = useQuery<Record<string, WillDeedState | null>>({
    queryKey: ["registryDeedStates", visibleEvents.map(e => e.deedId).join(",")],
    queryFn: async () => {
      const result: Record<string, WillDeedState | null> = {};
      await Promise.all(visibleEvents.slice(0, 20).map(async e => {
        result[e.deedId] = await fetchWillDeed(e.deedId);
      }));
      return result;
    },
    enabled: visibleEvents.length > 0,
    staleTime: 60_000,
  });

  const activeEvents = visibleEvents.filter(e => {
    const state = deedStates?.[e.deedId];
    // If we have state, filter executed; if not yet loaded, show tentatively
    if (state === null) return false; // deleted/revoked
    if (state?.executed) return false;
    return true;
  });

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "0",
      padding: "14px 16px",
    }}>
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>
        Succession Deed Registry
      </div>
      {isLoading && (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>Loading…</div>
      )}
      {!isLoading && activeEvents.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>
          No active testaments found on-chain.
        </div>
      )}
      {activeEvents.length > 0 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 80px",
            gap: "8px",
            padding: "4px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "6px",
          }}>
            {["VAULT", "FOUNDER", "HEIR", "TIMEOUT"].map(h => (
              <span key={h} style={{
                color: "rgba(107,107,94,0.6)",
                fontSize: "10px",
                letterSpacing: "0.06em",
              }}>{h}</span>
            ))}
          </div>
          {activeEvents.map(e => (
            <div key={e.deedId} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 80px",
              gap: "8px",
              padding: "5px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              fontSize: "11px",
            }}>
              <span style={{ fontFamily: "monospace", color: "#888" }}>{shortAddr(e.vaultId)}</span>
              <span style={{ fontFamily: "monospace", color: "#888" }}>{shortAddr(e.founder)}</span>
              <span style={{ fontFamily: "monospace", color: "#888" }}>{shortAddr(e.heir)}</span>
              <span style={{ color: "rgba(107,107,94,0.55)" }}>{Math.round(e.timeoutMs / 86_400_000)}d</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function InheritancePanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;

  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      const vaultId = getCachedVaultId(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 15_000,
  });

  const { data: deedId, refetch: refetchDeedId } = useQuery<string | null>({
    queryKey: ["willDeedId", vault?.objectId],
    queryFn: () => vault?.objectId ? fetchDeedIdForVault(vault.objectId) : Promise.resolve(null),
    enabled: !!vault?.objectId,
    staleTime: 15_000,
  });

  const { data: deed } = useQuery<WillDeedState | null>({
    queryKey: ["willDeed", deedId],
    queryFn: () => deedId ? fetchWillDeed(deedId) : Promise.resolve(null),
    enabled: !!deedId,
    staleTime: 15_000,
  });

  const isFounder = !!account && !!vault &&
    vault.founder.toLowerCase() === account.address.toLowerCase();

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Connect EVE Vault to manage succession planning
      </div>
    );
  }

  if (vaultLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Loading vault…
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", marginBottom: "4px" }}>
        Succession Planning
      </div>
      <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", marginBottom: "20px" }}>
        On-chain testament system. Declare an heir and an inactivity timeout.
        If the founder goes silent, the heir may execute the deed as trustless proof of intent.
      </div>

      {/* ── Founder section ─────────────────────────────────────────────── */}
      {vault && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            color: "rgba(107,107,94,0.7)",
            fontSize: "11px",
            letterSpacing: "0.08em",
            fontWeight: 700,
            marginBottom: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            paddingBottom: "6px",
          }}>
            {isFounder ? "YOUR SUCCESSION DEED" : "SUCCESSION DEED"}
          </div>
          {deed && !deed.executed && (
            <FounderDeedView
              deed={deed}
              vault={vault}
              onRefresh={() => {
                try { localStorage.removeItem(willCacheKey(vault.objectId)); } catch { /* */ }
                refetchDeedId();
              }}
            />
          )}
          {deed?.executed && (
            <div style={{
              padding: "12px 16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0",
              color: "#888",
              fontSize: "12px",
              marginBottom: "16px",
            }}>
              Testament executed. The deed remains on-chain as a permanent record.
              {isFounder && " Create a new testament to designate a successor."}
            </div>
          )}
          {isFounder && (!deed || deed.executed) && (
            <CreateWillForm
              vault={vault}
              onCreated={(id) => {
                if (id) {
                  try { localStorage.setItem(willCacheKey(vault.objectId), id); } catch { /* */ }
                }
                refetchDeedId();
              }}
            />
          )}
          {!isFounder && !deed && (
            <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px", marginBottom: "16px" }}>
              No active testament for this vault.
            </div>
          )}
        </div>
      )}

      {!vault && !vaultLoading && (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px", marginBottom: "20px" }}>
          No tribe vault found. Create one in the Tribe Vault tab first.
        </div>
      )}

      {/* ── Heir section ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{
          color: "rgba(107,107,94,0.7)",
          fontSize: "11px",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "6px",
        }}>
          NAMED AS HEIR
        </div>
        <HeirView address={account.address} />
      </div>

      {/* ── Public registry ─────────────────────────────────────────────── */}
      <div>
        <div style={{
          color: "rgba(107,107,94,0.7)",
          fontSize: "11px",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "6px",
        }}>
          PUBLIC SUCCESSION DEED REGISTRY
        </div>
        <PublicRegistry />
      </div>
    </div>
  );
}
