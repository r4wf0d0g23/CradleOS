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
  fetchAllRegisteredTribes, fetchPlayerStructures,
  GATE_ACCESS_LABELS,
  type TribeVaultState, type GatePolicyState, type GateDelegationObj, type RegisteredTribe,
  type PlayerStructure,
} from "../lib";
import { CLOCK } from "../constants";

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

      {/* Member delegation */}
      <DelegationCard
        vault={vault}
        delegations={delegations ?? []}
      />

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
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
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
        {!isFounder && <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>read-only</span>}
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
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: 12 }}>No gate policy deployed for this tribe.</div>
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

          <div style={{ fontSize: 10, color: "rgba(107,107,94,0.4)", marginTop: 12 }}>
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
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: 18 }}>
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>My Gate Delegations</div>

      {myDelegations.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(107,107,94,0.55)", marginBottom: 14 }}>No gates delegated to this tribe policy.</div>
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
