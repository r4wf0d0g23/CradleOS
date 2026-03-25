/**
 * RegistryPanel — CharacterRegistry management UI
 *
 * Founder flow:
 *   1. Register Claim — stake tribe_id claim at current epoch
 *   2. Create Vault — gated by active claim
 *
 * Attestor (admin) flow:
 *   • Issue EpochAttestation to a wallet (off-chain proof of earlier join)
 *   • Invalidate a stale claim (character left tribe / fraud)
 *   • Update attestor address
 *
 * Challenge flow (any wallet with an attestation):
 *   • Show owned attestations
 *   • Challenge + take vault atomically
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import {
  fetchCharacterTribeId, fetchTribeClaim, fetchAttestationsForWallet,
  buildRegisterClaimTransaction, buildIssueAttestationTransaction,
  buildInvalidateClaimTransaction, buildChallengeAndTakeVaultTransaction,
  buildSetAttestorTransaction, findCharacterForWallet,
  CHARACTER_REGISTRY_ID, rpcGetObject, discoverVaultIdForTribe,
  type TribeClaim,
} from "../lib";
import { CRADLEOS_PKG } from "../constants";
import { Transaction } from "@mysten/sui/transactions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }

async function fetchRegistryMeta(): Promise<{ attestor: string; admin: string }> {
  try {
    const f = await rpcGetObject(CHARACTER_REGISTRY_ID);
    return { attestor: String(f["trusted_attestor"] ?? ""), admin: String(f["admin"] ?? "") };
  } catch { return { attestor: "", admin: "" }; }
}

// ── Main component ────────────────────────────────────────────────────────────

export function RegistryPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [issueWallet, setIssueWallet] = useState("");
  const [issueTribeId, setIssueTribeId] = useState("");
  const [issueCharId, setIssueCharId] = useState("");
  const [issueEpoch, setIssueEpoch] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueErr, setIssueErr] = useState<string | null>(null);
  const [invalidateTribeId, setInvalidateTribeId] = useState("");
  const [invalidateBusy, setInvalidateBusy] = useState(false);
  const [invalidateErr, setInvalidateErr] = useState<string | null>(null);
  const [newAttestor, setNewAttestor] = useState("");
  const [attestorBusy, setAttestorBusy] = useState(false);
  const [attestorErr, setAttestorErr] = useState<string | null>(null);
  const [challengeVaultId, setChallengeVaultId] = useState("");
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeErr, setChallengeErr] = useState<string | null>(null);

  // ── Launch flow — create vault on the new chain ──────────────────────────
  const [launchName, setLaunchName] = useState("");
  const [launchTicker, setLaunchTicker] = useState("");
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchErr, setLaunchErr] = useState<string | null>(null);
  const [launchStep, setLaunchStep] = useState<"idle" | "vault_done" | "policy_done">("idle");
  const [launchVaultId, setLaunchVaultId] = useState<string | null>(null);

  const invalidate = () => setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ["registryMeta"] });
    queryClient.invalidateQueries({ queryKey: ["tribeClaim"] });
    queryClient.invalidateQueries({ queryKey: ["attestations"] });
  }, 2500);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
  });

  const { data: characterId } = useQuery<string | null>({
    queryKey: ["characterId", account?.address],
    queryFn: async () => {
      if (!account) return null;
      const info = await findCharacterForWallet(account.address);
      return info?.characterId ?? null;
    },
    enabled: !!account?.address,
  });

  const { data: claim } = useQuery<TribeClaim | null>({
    queryKey: ["tribeClaim", tribeId],
    queryFn: () => tribeId != null ? fetchTribeClaim(tribeId) : Promise.resolve(null),
    enabled: tribeId != null,
    staleTime: 15_000,
  });

  // Cross-check vault existence independently of claim.vault_created flag.
  // vault_created is only set via create_vault_with_registry — pre-existing vaults
  // (launched before registry existed) will have the flag false even though a vault exists.
  const { data: existingVaultId } = useQuery<string | null>({
    queryKey: ["vaultForTribe", tribeId],
    queryFn: () => tribeId != null ? discoverVaultIdForTribe(tribeId) : Promise.resolve(null),
    enabled: tribeId != null,
    staleTime: 30_000,
  });
  const vaultExists = !!(existingVaultId || claim?.vaultCreated);

  const { data: registryMeta } = useQuery({
    queryKey: ["registryMeta"],
    queryFn: fetchRegistryMeta,
    staleTime: 60_000,
  });

  const { data: attestations } = useQuery({
    queryKey: ["attestations", account?.address],
    queryFn: () => account ? fetchAttestationsForWallet(account.address) : Promise.resolve([]),
    enabled: !!account?.address,
    staleTime: 30_000,
  });

  if (!account) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      Connect EVE Vault to view registry
    </div>
  );

  const isAttestor = registryMeta?.attestor.toLowerCase() === account.address.toLowerCase();
  const isAdmin = registryMeta?.admin.toLowerCase() === account.address.toLowerCase();
  const myClaimActive = claim?.claimer.toLowerCase() === account.address.toLowerCase();
  const claimExists = !!claim;
  const claimConflict = claimExists && !myClaimActive;

  const handleLaunchVault = async () => {
    if (!tribeId || !launchName.trim() || !launchTicker.trim()) {
      setLaunchErr("Enter a tribe name and ticker."); return;
    }
    setLaunchBusy(true); setLaunchErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      // Step 1: create vault
      const vaultTx = new Transaction();
      vaultTx.moveCall({
        target: `${CRADLEOS_PKG}::tribe_vault::create_vault_entry`,
        arguments: [
          vaultTx.pure.u32(tribeId >>> 0),
          vaultTx.pure.vector("u8", Array.from(new TextEncoder().encode(launchName.trim()))),
          vaultTx.pure.vector("u8", Array.from(new TextEncoder().encode(launchTicker.trim()))),
        ],
      });
      const vaultResult = await signer.signAndExecuteTransaction({ transaction: vaultTx });
      const vaultDigest = (vaultResult as Record<string, unknown>)["digest"] as string | undefined;

      // Extract new vault ID from effects
      let newVaultId: string | null = null;
      if (vaultDigest) {
        try {
          const res = await fetch("https://fullnode.testnet.sui.io:443", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock", params: [vaultDigest, { showEffects: true }] }),
          });
          const j = await res.json() as { result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } } };
          const shared = (j.result?.effects?.created ?? []).filter(c => typeof c.owner === "object" && c.owner !== null && "Shared" in (c.owner as object));
          if (shared.length > 0) newVaultId = shared[0].reference.objectId;
        } catch { /* fall through */ }
      }

      setLaunchVaultId(newVaultId);
      setLaunchStep("vault_done");
      invalidate();

      if (newVaultId) {
        // Brief pause for indexer, then create defense policy
        await new Promise(r => setTimeout(r, 2000));
        const policyTx = new Transaction();
        policyTx.moveCall({
          target: `${CRADLEOS_PKG}::defense_policy::create_policy_entry`,
          arguments: [policyTx.object(newVaultId)],
        });
        await signer.signAndExecuteTransaction({ transaction: policyTx });
        setLaunchStep("policy_done");
        invalidate();
      }
    } catch (e) { setLaunchErr(e instanceof Error ? e.message : String(e)); }
    finally { setLaunchBusy(false); }
  };

  const handleRegisterClaim = async () => {
    if (!tribeId || !characterId) return;
    setClaimBusy(true); setClaimErr(null);
    try {
      const tx = buildRegisterClaimTransaction(tribeId, characterId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setClaimErr(e instanceof Error ? e.message : String(e)); }
    finally { setClaimBusy(false); }
  };

  const handleIssueAttestation = async () => {
    const tid = parseInt(issueTribeId, 10);
    const epoch = parseInt(issueEpoch, 10);
    if (!issueWallet || !issueCharId || !tid || isNaN(epoch)) return;
    setIssueBusy(true); setIssueErr(null);
    try {
      const tx = buildIssueAttestationTransaction(issueWallet, tid, issueCharId, epoch);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setIssueWallet(""); setIssueTribeId(""); setIssueCharId(""); setIssueEpoch("");
      invalidate();
    } catch (e) { setIssueErr(e instanceof Error ? e.message : String(e)); }
    finally { setIssueBusy(false); }
  };

  const handleInvalidate = async () => {
    const tid = parseInt(invalidateTribeId, 10);
    if (!tid) return;
    setInvalidateBusy(true); setInvalidateErr(null);
    try {
      const tx = buildInvalidateClaimTransaction(tid);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setInvalidateTribeId("");
      invalidate();
    } catch (e) { setInvalidateErr(e instanceof Error ? e.message : String(e)); }
    finally { setInvalidateBusy(false); }
  };

  const handleSetAttestor = async () => {
    if (!newAttestor) return;
    setAttestorBusy(true); setAttestorErr(null);
    try {
      const tx = buildSetAttestorTransaction(newAttestor);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setNewAttestor("");
      invalidate();
    } catch (e) { setAttestorErr(e instanceof Error ? e.message : String(e)); }
    finally { setAttestorBusy(false); }
  };

  const handleChallenge = async (attestationId: string) => {
    if (!challengeVaultId) { setChallengeErr("Enter vault ID to challenge"); return; }
    setChallengeBusy(true); setChallengeErr(null);
    try {
      const tx = buildChallengeAndTakeVaultTransaction(challengeVaultId, attestationId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setChallengeErr(e instanceof Error ? e.message : String(e)); }
    finally { setChallengeBusy(false); }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0", color: "#ddd", fontSize: "11px", padding: "5px 8px",
    outline: "none", fontFamily: "monospace",
  };

  // Tribe is fully registered when someone else holds the claim AND a vault already exists.
  // In that case a regular member has nothing to action — just show membership status.
  const corpRegisteredByOther = claimConflict && vaultExists;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── New Chain Launch Banner ── */}
      <div className="card" style={{ border: "1px solid rgba(0,255,150,0.25)", background: "rgba(0,255,150,0.03)" }}>
        <div style={{ color: "#00ff96", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>
          🚀 New CradleOS Chain — March 24, 2026
        </div>
        <p style={{ color: "rgba(200,220,200,0.75)", fontSize: "12px", marginBottom: "14px", lineHeight: 1.6 }}>
          All tribes start fresh on the unified package. Founders: press <strong>Found My Tribe</strong> to create your tribe vault and defense policy on the new chain in a single flow.
        </p>

        {launchStep === "policy_done" ? (
          <div style={{ padding: "10px 14px", background: "rgba(0,255,150,0.08)", border: "1px solid rgba(0,255,150,0.3)", color: "#00ff96", fontSize: "13px", fontWeight: 600, borderRadius: 2 }}>
            ✓ Tribe vault and defense policy created!
            {launchVaultId && (
              <div style={{ fontSize: "11px", fontWeight: 400, color: "rgba(0,255,150,0.7)", marginTop: 4, fontFamily: "monospace" }}>
                Vault: {launchVaultId.slice(0, 14)}…{launchVaultId.slice(-6)}
              </div>
            )}
            <div style={{ fontSize: "11px", fontWeight: 400, marginTop: 4 }}>
              Head to the Tribe Token tab to mint your EVE coin. Defense policy is ready in the Defense tab.
            </div>
          </div>
        ) : launchStep === "vault_done" ? (
          <div style={{ padding: "10px 14px", background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.2)", color: "#00ccff", fontSize: "12px", borderRadius: 2 }}>
            ✓ Vault created{launchVaultId ? ` (${launchVaultId.slice(0, 10)}…)` : ""}. Creating defense policy…
          </div>
        ) : account && tribeId ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em" }}>TRIBE NAME</span>
                <input
                  value={launchName}
                  onChange={e => setLaunchName(e.target.value)}
                  placeholder={`Tribe ${tribeId}`}
                  style={{ ...inputStyle, width: "180px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em" }}>TICKER (3-5 chars)</span>
                <input
                  value={launchTicker}
                  onChange={e => setLaunchTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                  placeholder="EVE"
                  style={{ ...inputStyle, width: "90px", fontFamily: "monospace" }}
                />
              </div>
              <button
                onClick={handleLaunchVault}
                disabled={launchBusy || !launchName.trim() || !launchTicker.trim()}
                style={{
                  background: launchBusy ? "rgba(0,255,150,0.05)" : "rgba(0,255,150,0.12)",
                  border: "1px solid rgba(0,255,150,0.4)",
                  color: launchBusy ? "rgba(0,255,150,0.4)" : "#00ff96",
                  borderRadius: 2, fontSize: "13px", fontWeight: 700,
                  padding: "7px 20px", cursor: launchBusy ? "default" : "pointer",
                  fontFamily: "inherit", letterSpacing: "0.05em",
                }}
              >
                {launchBusy ? "Launching…" : "🚀 Found My Tribe"}
              </button>
            </div>
            {launchErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {launchErr}</div>}
            <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
              Creates vault for Tribe #{tribeId} + a defense policy in two sequential transactions.
            </div>
          </div>
        ) : !account ? (
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px" }}>Connect EVE Vault to launch your tribe.</div>
        ) : (
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px" }}>Loading tribe info…</div>
        )}
      </div>

      {/* ── Membership status (always visible) ── */}
      <div className="card">
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "14px" }}>
          CHARACTER REGISTRY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", width: "110px" }}>Tribe ID</span>
            <span style={{ color: "#FF4700" }}>{tribeId ?? "—"}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", width: "110px" }}>Character</span>
            <span style={{ fontFamily: "monospace", color: "#888" }}>{shortAddr(characterId ?? "")}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", width: "110px" }}>Tribe status</span>
            <span style={{ color: vaultExists ? "#00ff96" : "#888" }}>
              {vaultExists ? `✓ registered${existingVaultId ? ` (${existingVaultId.slice(0,10)}…)` : ""}` : "unregistered"}
            </span>
          </div>
          {claimExists && (
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ color: "rgba(107,107,94,0.55)", width: "110px" }}>Founder</span>
              <span style={{ fontFamily: "monospace", color: myClaimActive ? "#00ff96" : "#888" }}>
                {shortAddr(claim!.claimer)}
                {myClaimActive && <span style={{ color: "#00ff96", marginLeft: "6px" }}>← you</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Claim actions — hidden when tribe is already registered by another wallet ── */}
      {!corpRegisteredByOther && (
        <div className="card">
          <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
            Tribe Claim
          </div>
          {claimExists && (
            <div style={{ fontSize: "12px", marginBottom: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: "rgba(107,107,94,0.55)", width: "100px" }}>Claim epoch</span>
                <span style={{ color: "rgba(107,107,94,0.6)" }}>{claim!.claimEpoch}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: "rgba(107,107,94,0.55)", width: "100px" }}>Vault</span>
                <span style={{ color: vaultExists ? "#00ff96" : "#555" }}>
                  {vaultExists ? `✓ yes${existingVaultId ? ` (${existingVaultId.slice(0,10)}…)` : ""}` : "not yet created"}
                </span>
              </div>
            </div>
          )}
          {!claimExists && tribeId != null && characterId && (
            <>
              <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px", marginBottom: "10px" }}>
                No claim registered for Tribe #{tribeId}. Stake your claim to prevent squatting.
              </div>
              <button className="accent-button" onClick={handleRegisterClaim} disabled={claimBusy}
                style={{ fontSize: "12px", padding: "7px 18px" }}>
                {claimBusy ? "Registering…" : `Register Claim for Tribe #${tribeId}`}
              </button>
              {claimErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {claimErr}</div>}
            </>
          )}
          {myClaimActive && !vaultExists && (
            <div style={{ color: "#00ff96", fontSize: "12px", marginTop: "8px" }}>
              ✓ Claim active — go to Tribe Token tab to create your vault.
            </div>
          )}
          {myClaimActive && vaultExists && (
            <div style={{ color: "#00ff96", fontSize: "12px", marginTop: "8px" }}>
              ✓ Claim active — vault confirmed. Switch to Tribe Token tab to manage it.
            </div>
          )}
          {/* Conflict: someone else claimed, no vault yet — member can challenge */}
          {claimConflict && !vaultExists && (
            <div style={{
              padding: "10px 12px", background: "#161616",
              border: "1px solid rgba(255,71,0,0.25)", borderRadius: "2px", fontSize: "12px",
            }}>
              <div style={{ color: "#ff6432", fontWeight: 600, marginBottom: "4px" }}>
                ⚠ Tribe #{tribeId} claimed by another wallet — no vault created yet
              </div>
              <div style={{ color: "rgba(107,107,94,0.6)" }}>
                If you joined before them, request an epoch attestation from the CradleOS attestor,
                then use the Challenge section below to reclaim.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Attestations / Challenge — only shown when there's an active dispute ── */}
      {!corpRegisteredByOther && (attestations ?? []).length > 0 && (
        <div className="card">
          <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
            ⚔ Challenge Proofs
          </div>
          <div style={{ marginBottom: "10px", display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              value={challengeVaultId}
              onChange={e => setChallengeVaultId(e.target.value.trim())}
              placeholder="Vault ID to challenge (0x…)"
              style={{ ...inputStyle, width: "280px" }}
            />
          </div>
          {(attestations ?? []).map(att => (
            <div key={att.objectId} style={{
              display: "flex", alignItems: "center", gap: "10px", fontSize: "11px",
              padding: "8px 10px", marginBottom: "6px",
              background: "#121212", border: "1px solid rgba(255,71,0,0.15)",
              borderRadius: "2px",
            }}>
              <span style={{ color: "#FF4700", fontWeight: 600 }}>Tribe #{att.tribeId}</span>
              <span style={{ color: "rgba(107,107,94,0.55)" }}>join epoch {att.joinEpoch}</span>
              <span style={{ fontFamily: "monospace", color: "rgba(107,107,94,0.55)" }}>char {shortAddr(att.characterId)}</span>
              <button
                onClick={() => handleChallenge(att.objectId)}
                disabled={challengeBusy || !challengeVaultId}
                style={{
                  marginLeft: "auto",
                  background: "rgba(255,71,0,0.1)", border: "1px solid rgba(255,71,0,0.3)",
                  color: "#ff6432", borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
                }}
              >
                {challengeBusy ? "…" : "Challenge + Take Vault"}
              </button>
            </div>
          ))}
          {challengeErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "4px" }}>⚠ {challengeErr}</div>}
        </div>
      )}

      {/* ── Attestor panel — always last ── */}
      {isAttestor && (
        <div className="card" style={{ border: "1px solid rgba(0,255,150,0.15)" }}>
          <div style={{ color: "#00ff96", fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>
            🔑 Attestor Panel
          </div>

          {/* Issue attestation */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.05em" }}>
              ISSUE EPOCH ATTESTATION
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>BENEFICIARY WALLET</span>
                <input value={issueWallet} onChange={e => setIssueWallet(e.target.value.trim())}
                  placeholder="0x…" style={{ ...inputStyle, width: "180px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>TRIBE ID</span>
                <input value={issueTribeId} onChange={e => setIssueTribeId(e.target.value.replace(/\D/g, ""))}
                  placeholder="98000001" style={{ ...inputStyle, width: "100px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>CHARACTER ID</span>
                <input value={issueCharId} onChange={e => setIssueCharId(e.target.value.trim())}
                  placeholder="0x…" style={{ ...inputStyle, width: "160px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>JOIN EPOCH</span>
                <input value={issueEpoch} onChange={e => setIssueEpoch(e.target.value.replace(/\D/g, ""))}
                  placeholder="epoch #" style={{ ...inputStyle, width: "80px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", justifyContent: "flex-end" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>&nbsp;</span>
                <button onClick={handleIssueAttestation} disabled={issueBusy || !issueWallet || !issueTribeId || !issueCharId || !issueEpoch}
                  style={{
                    background: "rgba(0,255,150,0.08)", border: "1px solid #00ff9640",
                    color: "#00ff96", borderRadius: "0", fontSize: "11px", padding: "5px 14px", cursor: "pointer",
                  }}>
                  {issueBusy ? "…" : "Issue"}
                </button>
              </div>
            </div>
            {issueErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {issueErr}</div>}
          </div>

          {/* Invalidate claim */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.05em" }}>
              INVALIDATE STALE CLAIM
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>TRIBE ID</span>
                <input value={invalidateTribeId} onChange={e => setInvalidateTribeId(e.target.value.replace(/\D/g, ""))}
                  placeholder="tribe_id" style={{ ...inputStyle, width: "120px" }} />
              </div>
              <button onClick={handleInvalidate} disabled={invalidateBusy || !invalidateTribeId}
                style={{
                  background: "#161616", border: "1px solid rgba(255,71,0,0.3)",
                  color: "#ff6432", borderRadius: "0", fontSize: "11px", padding: "5px 14px", cursor: "pointer",
                }}>
                {invalidateBusy ? "…" : "Invalidate"}
              </button>
            </div>
            {invalidateErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "4px" }}>⚠ {invalidateErr}</div>}
          </div>
        </div>
      )}

      {/* ── Admin: set attestor ── */}
      {isAdmin && (
        <div className="card" style={{ border: "1px solid rgba(255,71,0,0.15)" }}>
          <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
            ⚙ Admin: Update Attestor
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px" }}>NEW ATTESTOR WALLET</span>
              <input value={newAttestor} onChange={e => setNewAttestor(e.target.value.trim())}
                placeholder="0x…" style={{ ...inputStyle, width: "280px" }} />
            </div>
            <button onClick={handleSetAttestor} disabled={attestorBusy || !newAttestor}
              style={{
                background: "#161616", border: "1px solid rgba(255,71,0,0.3)",
                color: "#FF4700", borderRadius: "0", fontSize: "11px", padding: "5px 14px", cursor: "pointer",
              }}>
              {attestorBusy ? "…" : "Set Attestor"}
            </button>
          </div>
          {attestorErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "4px" }}>⚠ {attestorErr}</div>}
        </div>
      )}
    </div>
  );
}
