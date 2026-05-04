/**
 * GatePolicyPanel — Tribe gate access control.
 *
 * Founder / admins:
 *   - Create TribeGatePolicy (shared, one per vault)
 *   - Set default access level (OPEN / TRIBE ONLY / ALLIES / CLOSED)
 *   - Add per-tribe and per-player overrides (ALLOW / DENY)
 *
 * Members:
 *   - Assign their gate SSU IDs to follow the tribe policy (creates GateDelegation)
 *   - Revoke delegation
 */
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { useDevOverrides } from "../contexts/DevModeContext";
import { useSponsoredTransaction, SponsoredTransactionActions, Assemblies } from "@evefrontier/dapp-kit";
import type { AssemblyType } from "@evefrontier/dapp-kit";
import {
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId, discoverVaultIdForTribe,
  fetchGatePolicy, fetchGateDelegations, fetchTribeClaim,
  buildCreateGatePolicyTx, buildSetGateAccessLevelTx,
  buildSetGateTribeOverrideTx, buildSetGatePlayerOverrideTx,
  buildDelegateGateTx, buildRevokeGateDelegationTx,
  fetchAllRegisteredTribes, fetchPlayerStructures, findCharacterForWallet,
  rpcGetObject,
  GATE_ACCESS_LABELS,
  // v14: character-keyed gate friendly/hostile + extension authorization
  buildSetGateFriendlyCharacterTx, buildSetGateHostileCharacterTx,
  fetchGateFriendlyCharacters, fetchGateHostileCharacters,
  buildAuthorizeGateExtensionTx, buildRequestGatePermitTx,
  fetchGateExtensionStatus, fetchOwnedGates,
  fetchCradleOSAuthorizedGates, fetchAllGatePolicies, previewIsAllowed,
  type GateFriendlyCharacter, type GateHostileCharacter,
  type CradleOSGate, type GatePolicyCandidate,
  type TribeVaultState, type GatePolicyState, type GateDelegationObj, type RegisteredTribe,
  type PlayerStructure,
} from "../lib";
import { CLOCK } from "../constants";
import { translateTxError } from "../lib/txError";
import { CharacterAutocomplete } from "./CharacterAutocomplete";
import { useCharacterDirectory, findCharacterById } from "../lib/characterDirectory";
import { staggeredRefetch } from "../lib/staggeredRefetch";

const ACCESS_LEVELS = [0, 1, 2, 3] as const;
const LEVEL_COLORS: Record<number, string> = {
  0: "#00c864",
  1: "#ffd700",
  2: "#4a9eff",
  3: "#ff4444",
};

function short(addr: string) { return addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : ""; }

export function GatePolicyPanel() {
  const { account: _acct } = useVerifiedAccountContext();
  const { overrideAccount, overrideTribeId } = useDevOverrides();
  const account = overrideAccount(_acct);
  const rawAccount = useCurrentAccount();

  // ── Gate Linking ───────────────────────────────────────────────────────────
  const { mutateAsync: sendSponsoredTx } = useSponsoredTransaction();
  const [myGates, setMyGates] = useState<PlayerStructure[]>([]);
  const [gateActionState, setGateActionState] = useState<{ gateId: string; status: string } | null>(null);

  useEffect(() => {
    const addr = rawAccount?.address;
    if (!addr) return;
    fetchPlayerStructures(addr).then(groups => {
      const gates = groups.flatMap(g => g.structures).filter(s => s.kind === "Gate");
      setMyGates(gates);
      setGateActionState(null); // clear any stale error on refresh
    }).catch(() => {});
  }, [rawAccount?.address]);

  const sponsoredGateAction = async (gate: PlayerStructure, action: SponsoredTransactionActions.LINK_SMART_GATE | SponsoredTransactionActions.UNLINK_SMART_GATE) => {
    if (!gate.gameItemId) { setGateActionState({ gateId: gate.objectId, status: "✗ No game item ID" }); return; }
    const isLink = action === SponsoredTransactionActions.LINK_SMART_GATE;
    setGateActionState({ gateId: gate.objectId, status: `${isLink ? "Linking" : "Unlinking"} via EVE Vault…` });

    const makeAssembly = () => ({
      item_id: Number(gate.gameItemId),
      type: Assemblies.SmartGate, id: gate.objectId, dappURL: undefined,
      name: gate.displayName, state: gate.isOnline ? "online" : "anchored",
      ownerId: rawAccount?.address ?? "",
      gate: { linked: !!gate.linkedGateId, destinationId: gate.linkedGateId, inRange: [], isParentNodeOnline: gate.isOnline },
    } as unknown as AssemblyType<Assemblies.SmartGate>);

    const onSuccess = (digest?: string) => {
      setGateActionState({ gateId: gate.objectId, status: `✓ Done${digest ? ` — tx: ${digest.slice(0, 12)}…` : ""}` });
      setTimeout(() => {
        setGateActionState(null);
        fetchPlayerStructures(rawAccount?.address ?? "").then(gs => setMyGates(gs.flatMap(g => g.structures).filter(s => s.kind === "Gate")));
      }, 3000);
    };

    const onError = (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[GateLink] Error:", msg, e);
      setGateActionState({ gateId: gate.objectId, status: `✗ ${msg.slice(0, 120)}` });
      setTimeout(() => setGateActionState(null), 10000);
    };

    try {
      // Try to get EVE Vault JWT from sessionStorage for direct API call
      // EVE Vault's txb endpoint has CORS restrictions — must go through extension background.js
      // The useSponsoredTransaction hook routes through EVE Vault's message passing system

      // Fallback: EVE Vault hook handles everything
      // Note: requires wallet to be fully connected (not just installed) on this page
      const result = await sendSponsoredTx({ txAction: action, assembly: makeAssembly(), tenant: "utopia" });
      onSuccess(result.digest);
    } catch (e) {
      onError(e);
    }
  };

  const { data: _rawTribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
  });
  const tribeId = overrideTribeId(_rawTribeId ?? null);

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      const vaultId = getCachedVaultId(tribeId) ?? await discoverVaultIdForTribe(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 15_000,
  });

  const { data: gatePolicy } = useQuery<GatePolicyState | null>({
    queryKey: ["gatePolicy", vault?.objectId],
    queryFn: () => vault ? fetchGatePolicy(vault.objectId) : Promise.resolve(null),
    enabled: !!vault?.objectId,
    staleTime: 30_000,
  });

  const { data: delegations } = useQuery<GateDelegationObj[]>({
    queryKey: ["gateDelegations", account?.address],
    queryFn: () => account ? fetchGateDelegations(account.address) : Promise.resolve([]),
    enabled: !!account?.address,
    staleTime: 30_000,
  });

  const { data: allTribes } = useQuery<RegisteredTribe[]>({
    queryKey: ["registeredTribes"],
    queryFn: fetchAllRegisteredTribes,
    staleTime: 120_000,
  });

  // Registry claimer check — vault.founder may differ from claimer (same fix as defense panel)
  const { data: registryClaim, isLoading: claimLoading } = useQuery({
    queryKey: ["tribeClaim", tribeId],
    queryFn: () => tribeId ? fetchTribeClaim(tribeId) : Promise.resolve(null),
    enabled: !!tribeId,
    staleTime: 60_000,
  });

  if (!account) return (
    <div className="card" style={{ textAlign: "center", padding: 32, color: "#888" }}>
      Connect EVE Vault to manage gate access policy
    </div>
  );

  if (vaultLoading || (tribeId && claimLoading) || !vault) return (
    <div className="card" style={{ textAlign: "center", padding: 32, color: "#888" }}>
      {vaultLoading || claimLoading ? "Loading…" : "No tribe vault found. Create one in the Tribe Token tab first."}
    </div>
  );

  const isFounder = account.address.toLowerCase() === vault.founder.toLowerCase() ||
    (registryClaim?.claimer != null && registryClaim.claimer.toLowerCase() === account.address.toLowerCase());

  const unlinkedGates = myGates.filter(g => !g.linkedGateId);
  const linkedGates = myGates.filter(g => !!g.linkedGateId);

  return (
    <div style={{ padding: "20px", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Gate Linking Section ── */}
      {myGates.length > 0 && (
        <div style={{ border: "1px solid rgba(0,200,255,0.2)", background: "rgba(0,200,255,0.03)", padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#00ccff", letterSpacing: "0.08em", marginBottom: 12 }}>⛩ GATE LINKING</div>

          {/* Linked pairs */}
          {linkedGates.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: 6 }}>LINKED</div>
              {linkedGates.map(g => {
                const gState = gateActionState?.gateId === g.objectId ? gateActionState.status : null;
                return (
                  <div key={g.objectId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", marginBottom: 4, background: "rgba(0,255,150,0.04)", border: "1px solid rgba(0,255,150,0.15)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.isOnline ? "#00ff96" : "#ff4444", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#ddd", flex: 1 }}>{g.displayName}</span>
                    <span style={{ fontSize: 10, color: "#00ff96" }}>⛩ linked</span>
                    {gState ? (
                      <span style={{ fontSize: 10, color: gState.startsWith("✓") ? "#00ff96" : gState.startsWith("✗") ? "#ff4444" : "#00ccff", fontStyle: "italic" }}>{gState}</span>
                    ) : (
                      <button
                        onClick={() => sponsoredGateAction(g, SponsoredTransactionActions.UNLINK_SMART_GATE)}
                        style={{ background: "rgba(255,68,68,0.12)", color: "#ff6644", border: "none", padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        UNLINK
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Unlinked gates — link pairing UI */}
          {unlinkedGates.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: 6 }}>UNLINKED — SELECT PAIR TO LINK</div>
              {unlinkedGates.map(g => {
                const gState = gateActionState?.gateId === g.objectId ? gateActionState.status : null;
                return (
                  <div key={g.objectId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", marginBottom: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.isOnline ? "#00ff96" : "#ff4444", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#ddd", minWidth: 120 }}>{g.displayName}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>#{g.gameItemId}</span>
                    <span style={{ flex: 1 }} />
                    {gState ? (
                      <span style={{ fontSize: 10, color: gState.startsWith("✓") ? "#00ff96" : gState.startsWith("✗") ? "#ff4444" : "#00ccff", fontStyle: "italic" }}>{gState}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>link to:</span>
                        <select
                          style={{ background: "rgba(0,0,0,0.5)", color: "#ddd", border: "1px solid rgba(0,200,255,0.3)", padding: "3px 6px", fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
                          defaultValue=""
                          onChange={e => {
                            const destId = e.target.value;
                            if (destId) sponsoredGateAction(g, SponsoredTransactionActions.LINK_SMART_GATE);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>select gate…</option>
                          {unlinkedGates
                            .filter(dest => dest.objectId !== g.objectId)
                            .map(dest => (
                              <option key={dest.objectId} value={dest.objectId}>
                                {dest.displayName} (#{dest.gameItemId})
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {myGates.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontStyle: "italic" }}>No gates found on this account.</div>
          )}

          <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
            Linking submits a sponsored transaction via EVE Vault — both gates must be in range and owned by you.
          </div>
        </div>
      )}

      {/* Policy overview */}
      <PolicyCard
        vault={vault}
        policy={gatePolicy ?? null}
        isFounder={isFounder}
        allTribes={allTribes ?? []}
      />

      {/* v14: character-keyed friendly + hostile (mirrors defense_policy UX). */}
      {/* Hidden when no policy exists yet — founder must create policy first. */}
      {gatePolicy && (
        <>
          <GateFriendlyCharactersSection
            vault={vault}
            policyId={gatePolicy.objectId}
            isFounder={isFounder}
          />
          <GateHostileCharactersSection
            vault={vault}
            policyId={gatePolicy.objectId}
            isFounder={isFounder}
          />
        </>
      )}

      {/* v14: per-gate extension authorization — owner authorizes CradleOSAuth */}
      {/* on each gate they want enforced. Single PTB. Status badge per gate. */}
      <OwnedGatesCard tribePolicyId={gatePolicy?.objectId ?? null} />

      {/* v14: pilot transit — lists every CradleOS-enforced gate, runs a */}
      {/* preflight is_allowed check, and lets the pilot mint a JumpPermit. */}
      {/* Independent of which tribe vault is rendered — pilot uses gates anywhere. */}
      <TransitCard pilotTribeId={vault.tribeId} />

      {/* Member delegation */}
      <DelegationCard
        vault={vault}
        delegations={delegations ?? []}
      />

    </div>
  );
}

// ── v14: Gate Friendly Characters ───────────────────────────────────────────────
function GateFriendlyCharactersSection({ vault, policyId, isFounder }: {
  vault: TribeVaultState;
  policyId: string;
  isFounder: boolean;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: friendly } = useQuery<GateFriendlyCharacter[]>({
    queryKey: ["gateFriendlyCharacters", vault.objectId],
    queryFn: () => fetchGateFriendlyCharacters(vault.objectId),
    staleTime: 5_000,
  });
  const { data: directory } = useCharacterDirectory();

  const handleAdd = async (characterId: number) => {
    if (!account || !characterId) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetGateFriendlyCharacterTx(policyId, vault.objectId, characterId, true);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const key = ["gateFriendlyCharacters", vault.objectId];
      queryClient.setQueryData<GateFriendlyCharacter[]>(key, prev => {
        const existing = prev ?? [];
        if (existing.some(c => c.characterId === characterId)) return existing;
        return [...existing, { characterId, friendly: true }];
      });
      staggeredRefetch<GateFriendlyCharacter[]>({
        queryClient,
        queryKeys: [key],
        predicate: data => !!data?.some(c => c.characterId === characterId),
      });
    } catch (e) { setErr(translateTxError(e)); throw e; }
    finally { setBusy(false); }
  };

  const handleRemove = async (characterId: number) => {
    if (!account) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetGateFriendlyCharacterTx(policyId, vault.objectId, characterId, false);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const key = ["gateFriendlyCharacters", vault.objectId];
      queryClient.setQueryData<GateFriendlyCharacter[]>(key, prev =>
        (prev ?? []).filter(c => c.characterId !== characterId),
      );
      staggeredRefetch<GateFriendlyCharacter[]>({
        queryClient,
        queryKeys: [key],
        predicate: data => !data?.some(c => c.characterId === characterId),
      });
    } catch (e) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: "rgba(0,255,150,0.03)", border: "1px solid rgba(0,200,100,0.18)", borderRadius: 0, padding: 14, marginTop: 14 }}>
      <div style={{ color: "#00c864", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        Gate Friendly Characters
        {!isFounder && <span style={{ color: "rgba(175,175,155,0.55)", fontWeight: 400, marginLeft: 8, fontSize: 11 }}>read-only</span>}
      </div>
      <div style={{ color: "rgba(175,175,155,0.6)", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        Mark specific in-game characters as <strong style={{ color: "#00c864" }}>FRIENDLY</strong> for gate transit.
        Allowed regardless of their tribe or your default access level. Use this for cross-tribe allies who should always be able to use your gates.
      </div>

      {(friendly ?? []).length === 0 ? (
        <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 12, marginBottom: isFounder ? 12 : 0 }}>
          No friendly characters listed.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {(friendly ?? []).map(fc => {
            const known = findCharacterById(directory, fc.characterId);
            return (
              <div key={fc.characterId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ flex: 1, color: "#00c864" }}>
                  {known?.name ? (
                    <>
                      <span style={{ fontWeight: 600 }}>{known.name}</span>
                      <span style={{ color: "rgba(175,175,155,0.55)", fontFamily: "monospace", marginLeft: 6 }}>
                        · #{fc.characterId} · tribe {known.tribeId}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: "monospace" }}>Character #{fc.characterId}</span>
                  )}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600,
                  background: "rgba(0,200,100,0.12)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864" }}>
                  FRIENDLY
                </span>
                {isFounder && (
                  <button onClick={() => handleRemove(fc.characterId)} disabled={busy}
                    style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#666", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isFounder && (
        <CharacterAutocomplete
          onSelect={c => handleAdd(c.characterId)}
          accentColor="#00c864"
          buttonLabel="+ Add Friendly"
          placeholder="Search by name (or paste a character ID)…"
          busy={busy}
        />
      )}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

// ── v14: Gate Hostile Characters ───────────────────────────────────────────────
function GateHostileCharactersSection({ vault, policyId, isFounder }: {
  vault: TribeVaultState;
  policyId: string;
  isFounder: boolean;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: hostile } = useQuery<GateHostileCharacter[]>({
    queryKey: ["gateHostileCharacters", vault.objectId],
    queryFn: () => fetchGateHostileCharacters(vault.objectId),
    staleTime: 5_000,
  });
  const { data: directory } = useCharacterDirectory();

  const handleAdd = async (characterId: number) => {
    if (!account || !characterId) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetGateHostileCharacterTx(policyId, vault.objectId, characterId, true);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const key = ["gateHostileCharacters", vault.objectId];
      queryClient.setQueryData<GateHostileCharacter[]>(key, prev => {
        const existing = prev ?? [];
        if (existing.some(c => c.characterId === characterId)) return existing;
        return [...existing, { characterId, hostile: true }];
      });
      staggeredRefetch<GateHostileCharacter[]>({
        queryClient,
        queryKeys: [key],
        predicate: data => !!data?.some(c => c.characterId === characterId),
      });
    } catch (e) { setErr(translateTxError(e)); throw e; }
    finally { setBusy(false); }
  };

  const handleRemove = async (characterId: number) => {
    if (!account) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetGateHostileCharacterTx(policyId, vault.objectId, characterId, false);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const key = ["gateHostileCharacters", vault.objectId];
      queryClient.setQueryData<GateHostileCharacter[]>(key, prev =>
        (prev ?? []).filter(c => c.characterId !== characterId),
      );
      staggeredRefetch<GateHostileCharacter[]>({
        queryClient,
        queryKeys: [key],
        predicate: data => !data?.some(c => c.characterId === characterId),
      });
    } catch (e) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.12)", borderRadius: 0, padding: 14, marginTop: 14 }}>
      <div style={{ color: "#ff4444", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        Gate Hostile Characters
        {!isFounder && <span style={{ color: "rgba(175,175,155,0.55)", fontWeight: 400, marginLeft: 8, fontSize: 11 }}>read-only</span>}
      </div>
      <div style={{ color: "rgba(175,175,155,0.6)", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        Mark specific in-game characters as <strong style={{ color: "#ff4444" }}>BLOCKED</strong> from gate transit.
        Denied regardless of their tribe — overrides everything else, including same-tribe membership and friendly tribes. Use this for KOS targets that must never be allowed to transit.
      </div>

      {(hostile ?? []).length === 0 ? (
        <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 12, marginBottom: isFounder ? 12 : 0 }}>
          No hostile characters listed.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {(hostile ?? []).map(hc => {
            const known = findCharacterById(directory, hc.characterId);
            return (
              <div key={hc.characterId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ flex: 1, color: "#ff4444" }}>
                  {known?.name ? (
                    <>
                      <span style={{ fontWeight: 600 }}>{known.name}</span>
                      <span style={{ color: "rgba(175,175,155,0.55)", fontFamily: "monospace", marginLeft: 6 }}>
                        · #{hc.characterId} · tribe {known.tribeId}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: "monospace" }}>Character #{hc.characterId}</span>
                  )}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600,
                  background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444" }}>
                  BLOCKED
                </span>
                {isFounder && (
                  <button onClick={() => handleRemove(hc.characterId)} disabled={busy}
                    style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#666", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isFounder && (
        <CharacterAutocomplete
          onSelect={c => handleAdd(c.characterId)}
          accentColor="#ff4444"
          buttonLabel="+ Block Character"
          placeholder="Search by name (or paste a character ID)…"
          busy={busy}
        />
      )}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

// ── v14: OwnedGatesCard ─ per-gate extension authorization + status badge ──────────────────
function OwnedGatesCard({ tribePolicyId }: { tribePolicyId: string | null }) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  // The character object id is needed for the borrow_owner_cap PTB. It's
  // returned by findCharacterForWallet (the same source fetchPlayerStructures
  // uses internally) so we resolve it once and cache via React Query.
  const { data: charInfo } = useQuery({
    queryKey: ["characterInfo", account?.address],
    queryFn: () => account ? findCharacterForWallet(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
    staleTime: 60_000,
  });
  const characterObjectId = charInfo?.characterId ?? null;

  // Discover gates the wallet owns via fetchOwnedGates (filters PlayerStructures).
  const { data: gates } = useQuery({
    queryKey: ["ownedGates", account?.address],
    queryFn: () => account ? fetchOwnedGates(account.address) : Promise.resolve([]),
    enabled: !!account?.address,
    staleTime: 30_000,
  });

  // Per-gate extension status (separate query keyed by gate id).
  const gateIds = (gates ?? []).map(g => g.objectId).join(",");
  const { data: extensionStatuses } = useQuery({
    queryKey: ["gateExtensionStatuses", gateIds],
    queryFn: async () => {
      const list = gates ?? [];
      const statuses = await Promise.all(
        list.map(async g => ({
          gateId: g.objectId,
          status: await fetchGateExtensionStatus(g.objectId),
        })),
      );
      return new Map(statuses.map(s => [s.gateId, s.status]));
    },
    enabled: (gates ?? []).length > 0,
    staleTime: 5_000,
  });

  if (!account) return null;
  if ((gates ?? []).length === 0) {
    return (
      <div style={{ background: "rgba(100,180,255,0.04)", border: "1px solid rgba(100,180,255,0.18)", borderRadius: 0, padding: 14, marginTop: 14 }}>
        <div style={{ color: "#64b4ff", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
          Your Gates
        </div>
        <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 12 }}>
          You don't own any Smart Gates yet. Authorize CradleOS on a gate to enforce this policy.
        </div>
      </div>
    );
  }

  const handleAuthorize = async (gateId: string, ownerCapId: string) => {
    if (!characterObjectId) {
      setErr(prev => ({ ...prev, [gateId]: "Character not found — reload the dApp." }));
      return;
    }
    setBusy(gateId); setErr(prev => ({ ...prev, [gateId]: "" }));
    try {
      const tx = buildAuthorizeGateExtensionTx(gateId, ownerCapId, characterObjectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      // Optimistic flip on extensionStatuses cache.
      queryClient.setQueryData<Map<string, { authorized: boolean; extensionType: string | null } | null>>(
        ["gateExtensionStatuses", gateIds],
        prev => {
          const next = new Map(prev ?? []);
          next.set(gateId, { authorized: true, extensionType: "cradleos" });
          return next;
        },
      );
      staggeredRefetch({
        queryClient,
        queryKeys: [["gateExtensionStatuses", gateIds]],
      });
    } catch (e) {
      setErr(prev => ({ ...prev, [gateId]: translateTxError(e) }));
    } finally { setBusy(null); }
  };

  return (
    <div style={{ background: "rgba(100,180,255,0.04)", border: "1px solid rgba(100,180,255,0.18)", borderRadius: 0, padding: 14, marginTop: 14 }}>
      <div style={{ color: "#64b4ff", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        Your Gates — CradleOS Enforcement
      </div>
      <div style={{ color: "rgba(175,175,155,0.65)", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        Click <strong>Authorize</strong> on any gate to enforce {tribePolicyId ? "this tribe's" : "a CradleOS"} policy on transits through it. Once authorized, default jumps are blocked and pilots must request transit through CradleOS (which checks the Friendly/Hostile/Tribe rules above before issuing a permit).
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(gates ?? []).map(g => {
          const status = extensionStatuses?.get(g.objectId);
          const isAuthorized = status?.authorized === true;
          const isUnknown = status === null;
          const myErr = err[g.objectId];
          const myBusy = busy === g.objectId;
          return (
            <div key={g.objectId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 10px",
              background: isAuthorized ? "rgba(0,200,100,0.04)" : "rgba(255,200,0,0.04)",
              border: `1px solid ${isAuthorized ? "rgba(0,200,100,0.2)" : "rgba(255,200,0,0.2)"}`,
              borderRadius: 2 }}>
              <span style={{ flex: 1, color: "#e0e0d0", fontWeight: 600 }}>{g.label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(175,175,155,0.5)" }}>
                #{g.objectId.slice(-6)}
              </span>
              <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 2,
                background: isAuthorized ? "rgba(0,200,100,0.15)" : isUnknown ? "rgba(175,175,155,0.1)" : "rgba(255,200,0,0.15)",
                border: `1px solid ${isAuthorized ? "rgba(0,200,100,0.4)" : isUnknown ? "rgba(175,175,155,0.2)" : "rgba(255,200,0,0.4)"}`,
                color: isAuthorized ? "#00c864" : isUnknown ? "rgba(175,175,155,0.5)" : "#ffcc00" }}>
                {isAuthorized ? "✓ ENFORCED" : isUnknown ? "…" : "⚠ OPEN"}
              </span>
              {!isAuthorized && (
                <button
                  onClick={() => handleAuthorize(g.objectId, g.ownerCapId)}
                  disabled={myBusy || isUnknown}
                  style={{ background: "rgba(100,180,255,0.12)", border: "1px solid rgba(100,180,255,0.4)", color: "#64b4ff",
                    borderRadius: 2, fontSize: 10, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}
                >
                  {myBusy ? "Authorizing…" : "Authorize CradleOS"}
                </button>
              )}
              {myErr && <span style={{ color: "#ff6432", fontSize: 10, marginLeft: 4 }}>⚠ {myErr}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Policy card (founder controls) ───────────────────────────────────────────

function PolicyCard({ vault, policy, isFounder, allTribes }: {
  vault: TribeVaultState;
  policy: GatePolicyState | null;
  isFounder: boolean;
  allTribes: RegisteredTribe[];
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [tribeInput, setTribeInput] = useState("");

  async function exec(tx: ReturnType<typeof buildCreateGatePolicyTx>) {
    setBusy(true); setErr("");
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      queryClient.invalidateQueries({ queryKey: ["gatePolicy"] });
    } catch (e: unknown) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  }

  const cardStyle = {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.2)",
    borderRadius: 4, padding: 18,
  };

  return (
    <div style={cardStyle}>
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
        Gate Access Policy
        {!isFounder && <span style={{ color: "rgba(175,175,155,0.55)", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>read-only</span>}
      </div>

      {!policy ? (
        isFounder ? (
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>
              No gate policy deployed for this tribe yet.
            </div>
            <button
              onClick={() => exec(buildCreateGatePolicyTx(vault.objectId))}
              disabled={busy}
              style={{ background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.4)", color: "#FF4700", borderRadius: 3, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}
            >
              {busy ? "Deploying…" : "Initialize Gate Policy"}
            </button>
          </div>
        ) : (
          <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 12 }}>No gate policy deployed for this tribe.</div>
        )
      ) : (
        <div>
          {/* Default access level */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(180,180,160,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Default Access Level</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ACCESS_LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => isFounder && exec(buildSetGateAccessLevelTx(policy.objectId, vault.objectId, level))}
                  disabled={busy || !isFounder}
                  style={{
                    padding: "6px 14px", borderRadius: 3, fontSize: 12, fontWeight: 600,
                    cursor: isFounder ? "pointer" : "default",
                    background: policy.accessLevel === level ? `${LEVEL_COLORS[level]}22` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${policy.accessLevel === level ? LEVEL_COLORS[level] : "rgba(255,255,255,0.1)"}`,
                    color: policy.accessLevel === level ? LEVEL_COLORS[level] : "#666",
                  }}
                >
                  {GATE_ACCESS_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Tribe overrides */}
          {isFounder && (
            <div style={{ marginBottom: 16, borderTop: "1px solid rgba(255,71,0,0.1)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(180,180,160,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Tribe Overrides</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={tribeInput}
                  onChange={e => setTribeInput(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", fontSize: 11, padding: "5px 8px", borderRadius: 3 }}
                >
                  <option value="">Select tribe…</option>
                  {allTribes.filter(t => t.tribeId !== vault.tribeId).map(t => (
                    <option key={t.tribeId} value={t.tribeId}>Tribe {t.tribeId} ({t.coinSymbol})</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (tribeInput) exec(buildSetGateTribeOverrideTx(policy.objectId, vault.objectId, parseInt(tribeInput), 1)); setTribeInput(""); }}
                  disabled={busy || !tribeInput}
                  style={{ background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: 2, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
                >Allow</button>
                <button
                  onClick={() => { if (tribeInput) exec(buildSetGateTribeOverrideTx(policy.objectId, vault.objectId, parseInt(tribeInput), 0)); setTribeInput(""); }}
                  disabled={busy || !tribeInput}
                  style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: 2, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
                >Deny</button>
              </div>
            </div>
          )}

          {/* Player overrides */}
          {isFounder && (
            <div style={{ borderTop: "1px solid rgba(255,71,0,0.1)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(180,180,160,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Player Overrides</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={playerInput}
                  onChange={e => setPlayerInput(e.target.value.trim())}
                  placeholder="0x player wallet address"
                  style={{ flex: 1, minWidth: 240, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "#aaa", fontSize: 11, padding: "5px 8px", fontFamily: "monospace", outline: "none" }}
                />
                <button
                  onClick={() => { if (playerInput) { exec(buildSetGatePlayerOverrideTx(policy.objectId, vault.objectId, playerInput, 1)); setPlayerInput(""); } }}
                  disabled={busy || !playerInput}
                  style={{ background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: 2, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
                >Allow</button>
                <button
                  onClick={() => { if (playerInput) { exec(buildSetGatePlayerOverrideTx(policy.objectId, vault.objectId, playerInput, 0)); setPlayerInput(""); } }}
                  disabled={busy || !playerInput}
                  style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: 2, fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
                >Deny</button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, color: "rgba(175,175,155,0.4)", marginTop: 12 }}>
            Policy v{policy.version} · {short(policy.objectId)}
          </div>
        </div>
      )}

      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
    </div>
  );
}

// ── Member delegation card ────────────────────────────────────────────────────

function DelegationCard({ vault, delegations }: {
  vault: TribeVaultState;
  delegations: GateDelegationObj[];
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [gateInput, setGateInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const myDelegations = delegations.filter(d => d.vaultId === vault.objectId);

  async function exec(tx: ReturnType<typeof buildDelegateGateTx>) {
    setBusy(true); setErr("");
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      queryClient.invalidateQueries({ queryKey: ["gateDelegations"] });
      setGateInput("");
    } catch (e: unknown) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: 18 }}>
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>My Gate Delegations</div>

      {myDelegations.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(175,175,155,0.55)", marginBottom: 14 }}>No gates delegated to this tribe policy.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {myDelegations.map(d => (
            <div key={d.objectId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ fontFamily: "monospace", color: "#e0e0d0", flex: 1 }}>Gate: {short(d.gateId)}</span>
              <button
                onClick={() => exec(buildRevokeGateDelegationTx(d.objectId))}
                disabled={busy}
                style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: 2, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
              >Revoke</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={gateInput}
          onChange={e => setGateInput(e.target.value.trim())}
          placeholder="Gate / SSU object ID (0x…)"
          style={{ flex: 1, minWidth: 260, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "#aaa", fontSize: 11, padding: "5px 8px", fontFamily: "monospace", outline: "none" }}
        />
        <button
          onClick={() => { if (gateInput) exec(buildDelegateGateTx(gateInput, vault.objectId, CLOCK)); }}
          disabled={busy || !gateInput}
          style={{ background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.4)", color: "#FF4700", borderRadius: 3, fontSize: 12, padding: "6px 14px", cursor: "pointer" }}
        >
          {busy ? "…" : "Delegate Gate"}
        </button>
      </div>
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
    </div>
  );
}

// ── v14: TransitCard ─ pilot transit UI for CradleOS-enforced gates ──────────────────
//
// Two stages:
//   1. Discover every gate currently authorized to use CradleOSAuth (across all
//      tribes, not just this one — pilot might transit anywhere).
//   2. For each gate, let the pilot pick a TribeGatePolicy (the gate owner's
//      policy is the natural choice; gates don't carry the binding on chain so
//      we surface a dropdown of all known policies + a manual entry box).
//   3. Pre-flight is_allowed check before signing → green/red badge.
//   4. "Request Jump Permit" button calls request_jump_permit_entry. On success
//      the permit lands in the pilot's character_address; they then jump
//      in-game using world::gate::jump_with_permit (the game client handles
//      the actual jump tx, this UI's job ends at permit issuance).
//
// The card only renders when there's at least one CradleOSAuth-authorized gate;
// otherwise it stays hidden so unaffected players don't see clutter.
function TransitCard({ pilotTribeId }: { pilotTribeId: number }) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null); // gateId currently being processed
  const [err, setErr] = useState<Record<string, string>>({});
  const [okMsg, setOkMsg] = useState<Record<string, string>>({});
  const [policySel, setPolicySel] = useState<Record<string, string>>({}); // gateId -> policyId

  // Discover the pilot's character info (id + tribe) for the preflight check.
  const { data: charInfo } = useQuery({
    queryKey: ["characterInfo", account?.address],
    queryFn: () => account ? findCharacterForWallet(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
    staleTime: 60_000,
  });

  // Discover all gates with CradleOSAuth currently authorized.
  const { data: gates } = useQuery<CradleOSGate[]>({
    queryKey: ["cradleosAuthorizedGates"],
    queryFn: fetchCradleOSAuthorizedGates,
    staleTime: 30_000,
  });

  // Discover all known TribeGatePolicy objects. Pilot picks one per gate.
  const { data: policies } = useQuery<GatePolicyCandidate[]>({
    queryKey: ["allGatePolicies"],
    queryFn: fetchAllGatePolicies,
    staleTime: 60_000,
  });

  // Per-gate preflight is_allowed result, keyed by `${gateId}:${policyId}`.
  // We rerun whenever the pilot picks a different policy. React Query keeps
  // a separate cache per key so swaps are instant after first compute.
  const previewKey = (gateId: string, policyId: string) => ["transitPreview", gateId, policyId, charInfo?.tribeId ?? -1];
  const usePreview = (gateId: string, policyId: string | null) => {
    return useQuery({
      queryKey: previewKey(gateId, policyId ?? ""),
      queryFn: async () => {
        if (!policyId || !charInfo) return null;
        // We need the pilot's character_id (u32 in-game id) for the preflight.
        // findCharacterForWallet returns the Sui object id; we need the item_id.
        // Read it from the Character object content.
        const charFields = await rpcGetObject(charInfo.characterId);
        const keyField = charFields["key"] as { fields?: { item_id?: string | number } } | undefined;
        const itemId = Number(keyField?.fields?.item_id ?? 0);
        if (!itemId) return null;
        return previewIsAllowed(policyId, itemId, charInfo.tribeId);
      },
      enabled: !!policyId && !!charInfo,
      staleTime: 15_000,
    });
  };
  // We can't call the hook in a loop from a parent → render-time, so instead we
  // compute previews via a small child renderer per row.

  if (!account) return null;
  if (!charInfo) {
    return (
      <div style={cardWrap}>
        <div style={cardHeader}>Gate Transit</div>
        <div style={cardSub}>Connect a verified character to request transit through CradleOS-enforced gates.</div>
      </div>
    );
  }
  if (!gates || gates.length === 0) {
    return null; // Hide entirely when nothing's authorized
  }

  const handleRequest = async (gate: CradleOSGate, policyId: string) => {
    if (!charInfo || !gate.linkedGateId) return;
    setBusy(gate.objectId);
    setErr(prev => ({ ...prev, [gate.objectId]: "" }));
    setOkMsg(prev => ({ ...prev, [gate.objectId]: "" }));
    try {
      const tx = buildRequestGatePermitTx(policyId, gate.objectId, gate.linkedGateId, charInfo.characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const digest = (result as { digest?: string })?.digest ?? "";
      setOkMsg(prev => ({ ...prev, [gate.objectId]: `✓ Permit issued. You can now jump in-game.${digest ? ` (tx ${digest.slice(0, 10)}…)` : ""}` }));
      // Invalidate gate state in case we want to refresh anything.
      queryClient.invalidateQueries({ queryKey: ["cradleosAuthorizedGates"] });
    } catch (e) {
      setErr(prev => ({ ...prev, [gate.objectId]: translateTxError(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={cardWrap}>
      <div style={cardHeader}>
        🚪 Gate Transit (CradleOS-enforced gates)
      </div>
      <div style={{ ...cardSub, marginBottom: 8 }}>
        These gates require a CradleOS-issued <strong>JumpPermit</strong> before you can transit.
        Click <strong>Request Jump Permit</strong> to mint one — the contract checks the gate's
        access policy before issuing. <strong>You must request a permit BEFORE jumping in-game</strong>;
        without a valid permit your in-game jump command will be rejected by the gate.
      </div>
      <div style={{ ...cardSub, color: "rgba(255,200,0,0.8)", marginBottom: 14 }}>
        ⓘ A permit is good for one round-trip (source ↔ destination) and expires after 24 hours.
        If you don't transit in that window, just request a fresh one — there's no cost beyond gas.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {gates.map(g => {
          const selectedPolicy = policySel[g.objectId] ?? "";
          const myErr = err[g.objectId];
          const myOk = okMsg[g.objectId];
          const myBusy = busy === g.objectId;
          return (
            <TransitRow
              key={g.objectId}
              gate={g}
              policies={policies ?? []}
              policyId={selectedPolicy}
              setPolicyId={pid => setPolicySel(prev => ({ ...prev, [g.objectId]: pid }))}
              charInfo={charInfo}
              pilotTribeId={pilotTribeId}
              onRequest={() => handleRequest(g, selectedPolicy)}
              busy={myBusy}
              err={myErr}
              ok={myOk}
              usePreview={usePreview}
            />
          );
        })}
      </div>
    </div>
  );
}

// Per-row renderer so we can use the preview hook (hooks can't run in a parent loop).
function TransitRow({
  gate, policies, policyId, setPolicyId, charInfo, pilotTribeId, onRequest, busy, err, ok, usePreview,
}: {
  gate: CradleOSGate;
  policies: GatePolicyCandidate[];
  policyId: string;
  setPolicyId: (pid: string) => void;
  charInfo: { characterId: string; tribeId: number };
  pilotTribeId: number;
  onRequest: () => void;
  busy: boolean;
  err: string | undefined;
  ok: string | undefined;
  usePreview: (gateId: string, policyId: string | null) => { data: { allowed: boolean; error: string | null } | null | undefined; isLoading: boolean };
}) {
  const preview = usePreview(gate.objectId, policyId || null);
  const allowedBadge = !policyId
    ? null
    : preview.isLoading
      ? <span style={badgeStyle("rgba(175,175,155,0.5)", "rgba(175,175,155,0.1)")}>Checking…</span>
      : preview.data?.allowed === true
        ? <span style={badgeStyle("#00c864", "rgba(0,200,100,0.15)")}>✓ ALLOWED</span>
        : preview.data?.allowed === false
          ? <span style={badgeStyle("#ff4444", "rgba(255,68,68,0.15)")}>✗ DENIED</span>
          : <span style={badgeStyle("rgba(175,175,155,0.5)", "rgba(175,175,155,0.1)")}>?</span>;

  // Auto-prefer the policy whose tribe matches the pilot's own tribe (best heuristic).
  useEffect(() => {
    if (policyId) return;
    const pilotTribePolicy = policies.find(p => p.tribeId === pilotTribeId);
    if (pilotTribePolicy) setPolicyId(pilotTribePolicy.policyId);
    else if (policies.length > 0) setPolicyId(policies[0].policyId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies.length, gate.objectId]);
  void charInfo;

  // Human-readable origin and destination owner names. Falls back to a hex
  // short id when the cap chain doesn't resolve to a Character (e.g. legacy
  // gates owned by a non-Character object).
  const ownerLabel = gate.ownerName ?? `Gate #${gate.objectId.slice(-6)}`;
  const destLabel = gate.linkedGateId
    ? (gate.linkedGateOwnerName ?? `Gate #${gate.linkedGateId.slice(-6)}`)
    : "(unlinked)";

  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: "#e0e0d0", fontWeight: 600, fontSize: 12 }}>
            {ownerLabel}'s gate
            <span style={{ color: "rgba(175,175,155,0.55)", fontWeight: 400, marginLeft: 6 }}>
              → {destLabel}{gate.linkedGateOwnerName ? "'s gate" : ""}
            </span>
          </span>
          <span style={{ color: "rgba(175,175,155,0.45)", fontFamily: "monospace", fontSize: 10 }}>
            #{gate.objectId.slice(-6)}
            {gate.linkedGateId ? <> → #{gate.linkedGateId.slice(-6)}</> : null}
          </span>
        </div>
        <span style={badgeStyle("#64b4ff", "rgba(100,180,255,0.15)")}>✓ ENFORCED</span>
        {allowedBadge}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: "rgba(175,175,155,0.55)", letterSpacing: 0.5, textTransform: "uppercase" }}>Policy</span>
        <select
          value={policyId}
          onChange={e => setPolicyId(e.target.value)}
          disabled={busy}
          style={{
            flex: 1, fontSize: 11, padding: "3px 6px", background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", borderRadius: 2, fontFamily: "monospace",
          }}
        >
          <option value="">— Select gate policy —</option>
          {policies.map(p => (
            <option key={p.policyId} value={p.policyId}>
              Tribe {p.tribeId} · policy #{p.policyId.slice(-6)}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onRequest}
        disabled={busy || !policyId || !gate.linkedGateId || preview.data?.allowed === false}
        style={{
          width: "100%",
          padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.05,
          background: busy ? "rgba(100,180,255,0.05)" : preview.data?.allowed === false ? "rgba(100,100,100,0.1)" : "rgba(100,180,255,0.12)",
          border: `1px solid ${preview.data?.allowed === false ? "rgba(100,100,100,0.3)" : "rgba(100,180,255,0.4)"}`,
          color: busy ? "rgba(100,180,255,0.5)" : preview.data?.allowed === false ? "#666" : "#64b4ff",
          borderRadius: 2,
          cursor: busy || !policyId || preview.data?.allowed === false ? "default" : "pointer",
        }}
      >
        {busy
          ? "Requesting permit…"
          : preview.data?.allowed === false
            ? "Access denied — cannot request permit"
            : !gate.linkedGateId
              ? "Gate has no linked destination"
              : "Request Jump Permit"}
      </button>
      {ok && <div style={{ color: "#00c864", fontSize: 11, marginTop: 6 }}>{ok}</div>}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

const cardWrap: React.CSSProperties = {
  background: "rgba(100,180,255,0.04)",
  border: "1px solid rgba(100,180,255,0.18)",
  borderRadius: 0, padding: 14, marginTop: 14,
};
const cardHeader: React.CSSProperties = {
  color: "#64b4ff", fontWeight: 600, fontSize: 13, marginBottom: 6,
};
const cardSub: React.CSSProperties = {
  color: "rgba(175,175,155,0.7)", fontSize: 11, lineHeight: 1.5,
};
const rowStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 2, padding: 10,
};
const badgeStyle = (fg: string, bg: string): React.CSSProperties => ({
  padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 2,
  background: bg, border: `1px solid ${fg}40`, color: fg,
});
