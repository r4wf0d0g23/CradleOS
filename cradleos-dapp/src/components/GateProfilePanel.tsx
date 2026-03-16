import { normalizeChainError } from "../utils";
/**
 * GateProfilePanel — Tribe gate policy declaration editor + discovery feed.
 *
 * Gate *linking* (physically connecting systems) is CCP-admin-only.
 * This panel is an INTENT + DISPLAY system. Founders publish what they want
 * their gates to do; members and other tribes discover policies on-chain and
 * coordinate manually.
 *
 * Founder:
 *   • Create a GateProfile for the vault (if none exists)
 *   • Set access policy (OPEN / TRIBE ONLY / WHITELIST / CLOSED)
 *   • Set CRDL toll and policy notes
 *   • Manage tribe whitelist (add / remove tribe IDs)
 *
 * All users:
 *   • View own tribe's declared gate profile
 *   • Discover all other tribes' gate profiles in a feed
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG_V8, SUI_TESTNET_RPC, eventType } from "../constants";
import {
  rpcGetObject, numish,
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId,
  type TribeVaultState,
} from "../lib";

// ── Access policy constants (mirror Move) ─────────────────────────────────────

const ACCESS_OPEN       = 0;
const ACCESS_TRIBE_ONLY = 1;
const ACCESS_WHITELIST  = 2;
const ACCESS_CLOSED     = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

type GateProfileState = {
  objectId: string;
  vaultId: string;
  accessPolicy: number;
  tollCrdl: number;
  notes: string;
  whitelist: number[];
  version: number;
  updatedMs: number;
};

type GateProfileFeedEntry = {
  profileId: string;
  vaultId: string;
  founder: string;
  accessPolicy: number;
  tollCrdl: number;
  notes: string;
  version: number;
  coinSymbol?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type PolicyMeta = {
  label: string;
  color: string;
  dimColor: string;
};

const POLICY_META: Record<number, PolicyMeta> = {
  [ACCESS_OPEN]:       { label: "OPEN",       color: "#00ff96", dimColor: "rgba(0,255,150,0.12)"  },
  [ACCESS_TRIBE_ONLY]: { label: "TRIBE ONLY", color: "#ffaa33", dimColor: "rgba(255,170,51,0.12)" },
  [ACCESS_WHITELIST]:  { label: "WHITELIST",  color: "#4ab4ff", dimColor: "rgba(74,180,255,0.12)" },
  [ACCESS_CLOSED]:     { label: "CLOSED",     color: "#ff4444", dimColor: "rgba(255,68,68,0.12)"  },
};

function PolicyBadge({ policy }: { policy: number }) {
  const meta = POLICY_META[policy] ?? POLICY_META[ACCESS_CLOSED];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "2px",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.06em",
      background: meta.dimColor,
      border: `1px solid ${meta.color}40`,
      color: meta.color,
    }}>
      {meta.label}
    </span>
  );
}

/** Fetch GateProfile object state. */
async function fetchGateProfileState(profileId: string): Promise<GateProfileState | null> {
  try {
    const fields = await rpcGetObject(profileId);
    const whitelist = (fields["whitelist"] as unknown[] | undefined) ?? [];
    return {
      objectId: profileId,
      vaultId: String(fields["vault_id"] ?? ""),
      accessPolicy: numish(fields["access_policy"]) ?? ACCESS_OPEN,
      tollCrdl: numish(fields["toll_crdl"]) ?? 0,
      notes: String(fields["notes"] ?? ""),
      whitelist: whitelist.map(v => numish(v) ?? 0),
      version: numish(fields["version"]) ?? 0,
      updatedMs: numish(fields["updated_ms"]) ?? 0,
    };
  } catch { return null; }
}

/** Fetch gate profile ID for a vault from localStorage cache or event query. */
async function fetchProfileIdForVault(vaultId: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(`cradleos:gateprofile:${vaultId}`);
    if (cached) return cached;
  } catch { /* */ }
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("gate_profile", "GateProfileCreated") }, null, 50, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const match = (j.result?.data ?? []).find(e => String(e.parsedJson["vault_id"]) === vaultId);
    if (match) {
      const id = String(match.parsedJson["profile_id"]);
      try { localStorage.setItem(`cradleos:gateprofile:${vaultId}`, id); } catch { /* */ }
      return id;
    }
    return null;
  } catch { return null; }
}

/** Fetch all gate profiles from GateProfileCreated events for the discovery feed. */
async function fetchAllGateProfiles(): Promise<GateProfileFeedEntry[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("gate_profile", "GateProfileCreated") }, null, 100, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const entries = j.result?.data ?? [];

    // Deduplicate by vault_id (newest first wins — descending query)
    const seenVaults = new Set<string>();
    const results: GateProfileFeedEntry[] = [];

    await Promise.all(entries.map(async (e) => {
      const profileId = String(e.parsedJson["profile_id"] ?? "");
      const vaultId   = String(e.parsedJson["vault_id"] ?? "");
      const founder   = String(e.parsedJson["founder"] ?? "");
      if (seenVaults.has(vaultId) || !profileId) return;
      seenVaults.add(vaultId);

      try {
        const state = await fetchGateProfileState(profileId);
        if (!state) return;
        results.push({
          profileId,
          vaultId,
          founder,
          accessPolicy: state.accessPolicy,
          tollCrdl: state.tollCrdl,
          notes: state.notes,
          version: state.version,
        });
      } catch { /* skip malformed profiles */ }
    }));

    return results;
  } catch { return []; }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function buildCreateProfileTransaction(vaultId: string, notes: string, clockId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::gate_profile::create_profile_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(notes))),
      tx.object(clockId),
    ],
  });
  return tx;
}

function buildSetAccessPolicyTransaction(
  profileId: string,
  vaultId: string,
  accessPolicy: number,
  tollCrdl: number,
  notes: string,
  clockId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::gate_profile::set_access_policy_entry`,
    arguments: [
      tx.object(profileId),
      tx.object(vaultId),
      tx.pure.u8(accessPolicy),
      tx.pure.u64(BigInt(tollCrdl)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(notes))),
      tx.object(clockId),
    ],
  });
  return tx;
}

function buildAddToWhitelistTransaction(profileId: string, vaultId: string, tribeId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::gate_profile::add_to_whitelist_entry`,
    arguments: [
      tx.object(profileId),
      tx.object(vaultId),
      tx.pure.u32(tribeId >>> 0),
    ],
  });
  return tx;
}

function buildRemoveFromWhitelistTransaction(profileId: string, vaultId: string, tribeId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::gate_profile::remove_from_whitelist_entry`,
    arguments: [
      tx.object(profileId),
      tx.object(vaultId),
      tx.pure.u32(tribeId >>> 0),
    ],
  });
  return tx;
}

// Clock object ID (well-known on Sui)
const CLOCK_ID = "0x6";

// ── Main exported panel ───────────────────────────────────────────────────────

export function GateProfilePanel() {
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

  if (!account) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      Connect your EVE Vault to view gate profiles
    </div>
  );
  if (vaultLoading) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      Loading vault…
    </div>
  );
  if (!vault) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      No tribe vault found. Create one in the Tribe Token tab first.
    </div>
  );

  return <GateProfilePanelInner vault={vault} />;
}

// ── Inner panel (vault available) ─────────────────────────────────────────────

function GateProfilePanelInner({ vault }: { vault: TribeVaultState }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const isFounder = !!account && vault.founder.toLowerCase() === account.address.toLowerCase();

  // Create flow
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createNotes, setCreateNotes] = useState("");

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<number>(ACCESS_OPEN);
  const [editToll, setEditToll] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Whitelist management
  const [addTribeInput, setAddTribeInput] = useState("");
  const [wlBusy, setWlBusy] = useState(false);
  const [wlErr, setWlErr] = useState<string | null>(null);

  // Discover profile ID
  const { data: profileId, refetch: refetchProfileId } = useQuery<string | null>({
    queryKey: ["gateProfileId", vault.objectId],
    queryFn: () => fetchProfileIdForVault(vault.objectId),
    staleTime: 10_000,
  });

  const { data: profile, refetch: refetchProfile } = useQuery<GateProfileState | null>({
    queryKey: ["gateProfileState", profileId],
    queryFn: () => profileId ? fetchGateProfileState(profileId) : Promise.resolve(null),
    enabled: !!profileId,
    staleTime: 15_000,
  });

  // Discovery feed — all tribes' gate profiles
  const { data: allProfiles } = useQuery<GateProfileFeedEntry[]>({
    queryKey: ["allGateProfiles"],
    queryFn: fetchAllGateProfiles,
    staleTime: 60_000,
  });

  const invalidate = useCallback(() => {
    const delays = [2500, 6000, 12000];
    for (const ms of delays) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["gateProfileId"] });
        queryClient.invalidateQueries({ queryKey: ["gateProfileState"] });
        queryClient.invalidateQueries({ queryKey: ["allGateProfiles"] });
      }, ms);
    }
  }, [queryClient]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!account) return;
    setCreateBusy(true); setCreateErr(null);
    try {
      const tx = buildCreateProfileTransaction(vault.objectId, createNotes, CLOCK_ID);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Try to extract profile ID from tx effects
      const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
      if (digest) {
        try {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "sui_getTransactionBlock",
              params: [digest, { showEffects: true }],
            }),
          });
          const j = await res.json() as {
            result?: {
              effects?: {
                created?: Array<{ owner: unknown; reference: { objectId: string } }>;
              };
            };
          };
          const created = (j.result?.effects?.created ?? [])
            .filter(c => c.owner && typeof c.owner === "object" && "Shared" in (c.owner as object))
            .map(c => c.reference.objectId);
          for (const id of created) {
            const objRes = await fetch(SUI_TESTNET_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
            });
            const od = await objRes.json() as { result?: { data?: { type?: string } } };
            if (od.result?.data?.type?.includes("GateProfile")) {
              try { localStorage.setItem(`cradleos:gateprofile:${vault.objectId}`, id); } catch { /* */ }
            }
          }
        } catch { /* fall through to event discovery */ }
      }

      setCreateNotes("");
      invalidate();
      refetchProfileId();
      setTimeout(() => refetchProfileId(), 4000);
      setTimeout(() => refetchProfileId(), 9000);
    } catch (e) { setCreateErr(normalizeChainError(e)); }
    finally { setCreateBusy(false); }
  };

  const handleSavePolicy = async () => {
    if (!account || !profileId) return;
    setSaveBusy(true); setSaveErr(null);
    try {
      const toll = Math.max(0, parseInt(editToll, 10) || 0);
      const tx = buildSetAccessPolicyTransaction(profileId, vault.objectId, editPolicy, toll, editNotes, CLOCK_ID);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setEditOpen(false);
      invalidate();
      setTimeout(() => refetchProfile(), 2500);
    } catch (e) { setSaveErr(normalizeChainError(e)); }
    finally { setSaveBusy(false); }
  };

  const handleOpenEdit = () => {
    if (profile) {
      setEditPolicy(profile.accessPolicy);
      setEditToll(String(profile.tollCrdl));
      setEditNotes(profile.notes);
    }
    setEditOpen(true);
    setSaveErr(null);
  };

  const handleAddWhitelist = async () => {
    const id = parseInt(addTribeInput, 10);
    if (!id || !profileId) return;
    setWlBusy(true); setWlErr(null);
    try {
      const tx = buildAddToWhitelistTransaction(profileId, vault.objectId, id);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setAddTribeInput("");
      invalidate();
      setTimeout(() => refetchProfile(), 2500);
    } catch (e) { setWlErr(normalizeChainError(e)); }
    finally { setWlBusy(false); }
  };

  const handleRemoveWhitelist = async (tribeId: number) => {
    if (!profileId) return;
    setWlBusy(true); setWlErr(null);
    try {
      const tx = buildRemoveFromWhitelistTransaction(profileId, vault.objectId, tribeId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
      setTimeout(() => refetchProfile(), 2500);
    } catch (e) { setWlErr(normalizeChainError(e)); }
    finally { setWlBusy(false); }
  };

  // ── No profile yet ────────────────────────────────────────────────────────

  if (!profileId) {
    return (
      <div>
        {/* No profile card */}
        <div className="card" style={{ marginBottom: "16px" }}>
          <div style={{ color: "#aaa", fontWeight: 600, marginBottom: "12px", fontSize: "14px" }}>
            Gate Profile
          </div>
          <p style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "20px" }}>
            No gate profile exists for this vault. Create one to declare your tribe's gate stance on-chain.
            Other tribes and pilots can discover this policy to coordinate access.
          </p>
          {isFounder && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <textarea
                value={createNotes}
                onChange={e => setCreateNotes(e.target.value)}
                placeholder="Describe your gate policy (e.g. 'All allied tribes welcome, toll waived for diplomats')"
                rows={2}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#ccc", fontSize: "12px",
                  padding: "8px", outline: "none", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button className="accent-button" onClick={handleCreate} disabled={createBusy}>
                  {createBusy ? "Creating…" : "Create Gate Profile"}
                </button>
                <button
                  onClick={() => {
                    try { localStorage.removeItem(`cradleos:gateprofile:${vault.objectId}`); } catch { /* */ }
                    refetchProfileId();
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(107,107,94,0.6)",
                    borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
                  }}
                >
                  ↻ Refresh
                </button>
              </div>
              {createErr && <div style={{ color: "#ff6432", fontSize: "12px" }}>⚠ {createErr}</div>}
            </div>
          )}
          {!isFounder && (
            <button
              onClick={() => {
                try { localStorage.removeItem(`cradleos:gateprofile:${vault.objectId}`); } catch { /* */ }
                refetchProfileId();
              }}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(107,107,94,0.6)",
                borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
              }}
            >
              ↻ Check for existing profile
            </button>
          )}
        </div>

        {/* Discovery feed still visible even without own profile */}
        <GateProfileFeed allProfiles={allProfiles ?? []} ownVaultId={vault.objectId} />
      </div>
    );
  }

  // ── Profile exists ────────────────────────────────────────────────────────

  return (
    <div>
      {/* Own profile card */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px" }}>Gate Profile</div>
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>v{profile?.version ?? 0}</div>
          {profile && <PolicyBadge policy={profile.accessPolicy} />}
          {isFounder && (
            <button
              onClick={handleOpenEdit}
              style={{
                marginLeft: "auto",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#aaa", borderRadius: "0",
                fontSize: "12px", padding: "5px 14px", cursor: "pointer",
              }}
            >
              Edit Policy
            </button>
          )}
        </div>

        {profile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Toll */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px", minWidth: "80px" }}>TOLL</span>
              <span style={{ color: profile.tollCrdl > 0 ? "#ffaa33" : "#00ff96", fontSize: "13px", fontWeight: 600 }}>
                {profile.tollCrdl > 0 ? `${profile.tollCrdl} CRDL` : "Free passage"}
              </span>
            </div>

            {/* Notes */}
            {profile.notes && (
              <div style={{ display: "flex", gap: "12px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px", minWidth: "80px", paddingTop: "2px" }}>NOTES</span>
                <span style={{ color: "#bbb", fontSize: "12px", lineHeight: "1.5" }}>{profile.notes}</span>
              </div>
            )}

            {/* Last updated */}
            {profile.updatedMs > 0 && (
              <div style={{ display: "flex", gap: "12px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px", minWidth: "80px" }}>UPDATED</span>
                <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
                  {new Date(profile.updatedMs).toLocaleString()}
                </span>
              </div>
            )}

            {/* Whitelist */}
            {profile.accessPolicy === ACCESS_WHITELIST && (
              <div style={{
                marginTop: "8px",
                padding: "12px 14px",
                background: "rgba(74,180,255,0.05)",
                border: "1px solid rgba(74,180,255,0.15)",
                borderRadius: "0",
              }}>
                <div style={{ color: "#4ab4ff", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                  Whitelisted Tribes
                </div>
                {profile.whitelist.length === 0 ? (
                  <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>
                    No tribes whitelisted yet. Add tribe IDs below.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: isFounder ? "10px" : "0" }}>
                    {profile.whitelist.map(tid => (
                      <span key={tid} style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "3px 10px",
                        background: "rgba(74,180,255,0.1)",
                        border: "1px solid rgba(74,180,255,0.25)",
                        borderRadius: "2px", fontSize: "11px", color: "#4ab4ff",
                        fontFamily: "monospace",
                      }}>
                        tribe #{tid}
                        {isFounder && (
                          <button
                            onClick={() => handleRemoveWhitelist(tid)}
                            disabled={wlBusy}
                            style={{
                              background: "transparent", border: "none",
                              color: "rgba(255,68,68,0.7)", cursor: "pointer",
                              fontSize: "13px", lineHeight: 1, padding: "0 2px",
                            }}
                            title="Remove from whitelist"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {isFounder && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                    <input
                      value={addTribeInput}
                      onChange={e => setAddTribeInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="Tribe ID to whitelist"
                      style={{
                        width: "160px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0", color: "#aaa",
                        fontSize: "11px", padding: "5px 8px", outline: "none",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      onClick={handleAddWhitelist}
                      disabled={wlBusy || !addTribeInput}
                      style={{
                        background: "rgba(74,180,255,0.1)",
                        border: "1px solid rgba(74,180,255,0.3)",
                        color: "#4ab4ff", borderRadius: "0",
                        fontSize: "11px", padding: "5px 12px", cursor: "pointer",
                      }}
                    >
                      {wlBusy ? "…" : "+ Add"}
                    </button>
                    {wlErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {wlErr}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit form (founder only) */}
        {editOpen && isFounder && (
          <div style={{
            marginTop: "16px",
            padding: "14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0",
          }}>
            <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "14px" }}>
              Edit Gate Policy
            </div>

            {/* Policy selector */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "6px" }}>
                ACCESS POLICY
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[ACCESS_OPEN, ACCESS_TRIBE_ONLY, ACCESS_WHITELIST, ACCESS_CLOSED].map(policy => {
                  const meta = POLICY_META[policy];
                  const active = editPolicy === policy;
                  return (
                    <button
                      key={policy}
                      onClick={() => setEditPolicy(policy)}
                      style={{
                        padding: "6px 14px", borderRadius: "2px", cursor: "pointer",
                        background: active ? meta.dimColor : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? meta.color + "60" : "rgba(255,255,255,0.08)"}`,
                        color: active ? meta.color : "#666",
                        fontSize: "11px", fontWeight: active ? 700 : 400,
                        letterSpacing: "0.05em", transition: "all 0.15s",
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toll input */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "6px" }}>
                TOLL (CRDL, 0 = free)
              </div>
              <input
                type="number"
                min="0"
                value={editToll}
                onChange={e => setEditToll(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                style={{
                  width: "120px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#ccc",
                  fontSize: "12px", padding: "6px 8px", outline: "none",
                }}
              />
            </div>

            {/* Notes textarea */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.07em", marginBottom: "6px" }}>
                NOTES
              </div>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Describe your gate policy…"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#ccc", fontSize: "12px",
                  padding: "8px", outline: "none", resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="accent-button"
                onClick={handleSavePolicy}
                disabled={saveBusy}
                style={{ fontSize: "12px", padding: "6px 18px" }}
              >
                {saveBusy ? "Saving…" : "Save On-Chain"}
              </button>
              <button
                onClick={() => { setEditOpen(false); setSaveErr(null); }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(107,107,94,0.55)",
                  borderRadius: "0", fontSize: "11px", padding: "5px 12px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {saveErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {saveErr}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Discovery feed */}
      <GateProfileFeed allProfiles={allProfiles ?? []} ownVaultId={vault.objectId} />
    </div>
  );
}

// ── Discovery feed component ──────────────────────────────────────────────────

function GateProfileFeed({
  allProfiles,
  ownVaultId,
}: {
  allProfiles: GateProfileFeedEntry[];
  ownVaultId: string;
}) {
  // Filter out own vault — it's shown above
  const others = allProfiles.filter(p => p.vaultId !== ownVaultId);

  return (
    <div className="card">
      <div style={{ color: "#aaa", fontWeight: 600, fontSize: "14px", marginBottom: "14px" }}>
        All Gate Profiles
      </div>
      <p style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px", marginBottom: "14px" }}>
        Declared gate policies from all tribes. These are intent declarations — physical gate linking is CCP-managed.
      </p>

      {others.length === 0 ? (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>
          No gate profiles discovered on-chain yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {others.map(entry => (
            <div key={entry.profileId} style={{
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "0",
              display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap",
            }}>
              <div style={{ flex: "0 0 auto" }}>
                <PolicyBadge policy={entry.accessPolicy} />
              </div>

              <div style={{ flex: 1, minWidth: "180px" }}>
                <div style={{ color: "#ccc", fontSize: "12px", fontFamily: "monospace", marginBottom: "3px" }}>
                  Vault: {shortAddr(entry.vaultId)}
                </div>
                <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace" }}>
                  Founder: {shortAddr(entry.founder)}
                </div>
                {entry.notes && (
                  <div style={{ color: "#999", fontSize: "11px", marginTop: "5px", lineHeight: "1.4" }}>
                    {entry.notes}
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div style={{
                  color: entry.tollCrdl > 0 ? "#ffaa33" : "#00ff96",
                  fontSize: "12px", fontWeight: 600,
                }}>
                  {entry.tollCrdl > 0 ? `${entry.tollCrdl} CRDL` : "Free"}
                </div>
                <div style={{ color: "rgba(107,107,94,0.45)", fontSize: "10px", marginTop: "2px" }}>
                  v{entry.version}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
