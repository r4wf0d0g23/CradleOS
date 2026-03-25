import { normalizeChainError } from "../utils";
/**
 * SRPPanel — Ship Reimbursement Plans and Combat Insurance
 *
 * Section 1: Active Policies (all wallets)
 * Section 2: Submit a Claim (connected wallets)
 * Section 3: My Claims (connected — filter by claimant)
 * Section 4: Sponsor Controls (connected — filter by sponsor)
 * Section 5: Create New Policy (connected wallets)
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG, CRADLEOS_ORIGINAL, EVE_COIN_TYPE, SUI_TESTNET_RPC, CLOCK } from "../constants";
import { numish } from "../lib";

// ── Constants ─────────────────────────────────────────────────────────────────

const EVE_DECIMALS = 9;

const CLAIM_PENDING   = 0;
const CLAIM_PAID      = 1;
const CLAIM_DISPUTED  = 2;

const POLICY_ACTIVE   = 0;
// const POLICY_DRAINED  = 1;

const SRP_POLICY_TYPE = `${CRADLEOS_ORIGINAL}::ship_reimbursement::SRPPolicy`;
const SRP_CLAIM_TYPE  = `${CRADLEOS_ORIGINAL}::ship_reimbursement::SRPClaim`;

// ── Types ─────────────────────────────────────────────────────────────────────

type SRPPolicyState = {
  objectId: string;
  sponsor: string;
  description: string;
  payoutPerLoss: bigint;
  maxClaims: bigint;
  claimsPaid: bigint;
  fundBalance: bigint;
  validFromMs: number;
  validUntilMs: number;
  disputeWindowMs: number;
  status: number;
};

type SRPClaimState = {
  objectId: string;
  policyId: string;
  claimant: string;
  killmailObjectId: string;
  claimSubmittedMs: number;
  status: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatEve(mist: bigint): string {
  if (mist === 0n) return "0 EVE";
  const whole = mist / BigInt(10 ** EVE_DECIMALS);
  const frac  = mist % BigInt(10 ** EVE_DECIMALS);
  if (frac === 0n) return `${whole} EVE`;
  const fracStr = frac.toString().padStart(EVE_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} EVE`;
}

function eveToMist(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** EVE_DECIMALS));
}

function fmtDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDatetime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function claimStatusLabel(s: number): string {
  if (s === CLAIM_PENDING)  return "PENDING";
  if (s === CLAIM_PAID)     return "PAID";
  if (s === CLAIM_DISPUTED) return "DISPUTED";
  return "UNKNOWN";
}

function claimStatusColor(s: number): string {
  if (s === CLAIM_PENDING)  return "#FF4700";
  if (s === CLAIM_PAID)     return "#00ff96";
  if (s === CLAIM_DISPUTED) return "#888";
  return "#555";
}

function policyStatusLabel(s: number): string {
  return s === POLICY_ACTIVE ? "ACTIVE" : "DRAINED";
}
function policyStatusColor(s: number): string {
  return s === POLICY_ACTIVE ? "#00ff96" : "#888";
}

// ── RPC fetchers ──────────────────────────────────────────────────────────────

async function fetchObjectsOfType(structType: string): Promise<Array<{ objectId: string; fields: Record<string, unknown> }>> {
  const results: Array<{ objectId: string; fields: Record<string, unknown> }> = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryObjects",
        params: [
          { StructType: structType },
          cursor,
          50,
          false,
        ],
      }),
    });
    const j = await res.json() as {
      result?: {
        data?: Array<{ data?: { objectId?: string; content?: { fields?: Record<string, unknown> } } }>;
        nextCursor?: string | null;
        hasNextPage?: boolean;
      };
    };
    const data = j.result?.data ?? [];
    for (const item of data) {
      const objectId = item.data?.objectId;
      const fields = item.data?.content?.fields;
      if (objectId && fields) {
        results.push({ objectId, fields });
      }
    }
    if (!j.result?.hasNextPage) break;
    cursor = j.result?.nextCursor ?? null;
    if (!cursor) break;
  }
  return results;
}

async function fetchPolicies(): Promise<SRPPolicyState[]> {
  const items = await fetchObjectsOfType(SRP_POLICY_TYPE);
  return items.map(({ objectId, fields }) => {
    const fundField = fields["fund"] as { fields?: { balance?: string | number } } | undefined;
    const fundBalance = BigInt(String(fundField?.fields?.balance ?? 0));
    return {
      objectId,
      sponsor:        String(fields["sponsor"] ?? ""),
      description:    String(fields["description"] ?? ""),
      payoutPerLoss:  BigInt(String(numish(fields["payout_per_loss"]) ?? 0)),
      maxClaims:      BigInt(String(numish(fields["max_claims"]) ?? 0)),
      claimsPaid:     BigInt(String(numish(fields["claims_paid"]) ?? 0)),
      fundBalance,
      validFromMs:    numish(fields["valid_from_ms"]) ?? 0,
      validUntilMs:   numish(fields["valid_until_ms"]) ?? 0,
      disputeWindowMs: numish(fields["dispute_window_ms"]) ?? 86_400_000,
      status:         numish(fields["status"]) ?? 0,
    };
  });
}

async function fetchClaims(): Promise<SRPClaimState[]> {
  const items = await fetchObjectsOfType(SRP_CLAIM_TYPE);
  return items.map(({ objectId, fields }) => {
    const policyIdField = fields["policy_id"] as { id?: string } | string | undefined;
    const policyId = typeof policyIdField === "string" ? policyIdField
      : (policyIdField as { id?: string })?.id ?? String(policyIdField ?? "");
    return {
      objectId,
      policyId,
      claimant:        String(fields["claimant"] ?? ""),
      killmailObjectId: String(fields["killmail_object_id"] ?? ""),
      claimSubmittedMs: numish(fields["claim_submitted_ms"]) ?? 0,
      status:           numish(fields["status"]) ?? 0,
    };
  });
}

// ── EVE coin helper ──────────────────────────────────────────────────────────

async function fetchLargestEveCoin(address: string): Promise<string> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getCoins",
      params: [address, EVE_COIN_TYPE, null, 10],
    }),
  });
  const j = await res.json() as { result?: { data?: Array<{ coinObjectId: string; balance: string }> } };
  const coins = j.result?.data ?? [];
  if (coins.length === 0) throw new Error("No EVE coins in wallet. Acquire EVE first.");
  coins.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  return coins[0].coinObjectId;
}

// ── Tx builders ───────────────────────────────────────────────────────────────

async function buildCreatePolicyTx(
  description: string,
  payoutPerLoss: bigint,
  maxClaims: bigint,
  validFromMs: number,
  validUntilMs: number,
  disputeWindowMs: bigint,
  initialFund: bigint,
  senderAddress: string,
): Promise<Transaction> {
  const sourceCoinId = await fetchLargestEveCoin(senderAddress);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(sourceCoinId), [tx.pure.u64(initialFund)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::create_policy_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(description))),
      tx.pure.u64(payoutPerLoss),
      tx.pure.u64(maxClaims),
      tx.pure.u64(BigInt(validFromMs)),
      tx.pure.u64(BigInt(validUntilMs)),
      tx.pure.u64(disputeWindowMs),
      coin,
      tx.object(CLOCK),
    ],
  });
  return tx;
}

async function buildTopUpTx(policyId: string, amount: bigint, senderAddress: string): Promise<Transaction> {
  const sourceCoinId = await fetchLargestEveCoin(senderAddress);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(sourceCoinId), [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::top_up_policy_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(policyId),
      coin,
    ],
  });
  return tx;
}

function buildSubmitClaimTx(policyId: string, killmailObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::submit_claim_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(policyId),
      tx.pure.address(killmailObjectId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildDisputeClaimTx(claimId: string, policyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::dispute_claim_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(claimId),
      tx.object(policyId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildFinalizeClaimTx(claimId: string, policyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::finalize_claim_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(claimId),
      tx.object(policyId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildDrainPolicyTx(policyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::ship_reimbursement::drain_policy_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(policyId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SRPPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit  = useDAppKit();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    [2500, 6000, 12000].forEach(d =>
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["srp-policies"] });
        queryClient.invalidateQueries({ queryKey: ["srp-claims"] });
      }, d)
    );
  }, [queryClient]);

  const { data: policies, isLoading: policiesLoading } = useQuery<SRPPolicyState[]>({
    queryKey: ["srp-policies"],
    queryFn: fetchPolicies,
    staleTime: 30_000,
  });

  const { data: claims, isLoading: claimsLoading } = useQuery<SRPClaimState[]>({
    queryKey: ["srp-claims"],
    queryFn: fetchClaims,
    staleTime: 30_000,
  });

  // ── Section 2: Submit Claim ────────────────────────────────────────────────
  const [claimPolicyId, setClaimPolicyId]       = useState("");
  const [killmailInput, setKillmailInput]       = useState("");
  const [claimBusy,     setClaimBusy]           = useState(false);
  const [claimErr,      setClaimErr]            = useState<string | null>(null);

  // ── Section 4: Sponsor Controls ───────────────────────────────────────────
  const [topUpAmounts,  setTopUpAmounts]  = useState<Record<string, string>>({});
  const [topUpBusy,     setTopUpBusy]    = useState<Record<string, boolean>>({});
  const [topUpErr,      setTopUpErr]     = useState<Record<string, string | null>>({});
  const [drainBusy,     setDrainBusy]    = useState<Record<string, boolean>>({});
  const [drainErr,      setDrainErr]     = useState<Record<string, string | null>>({});
  const [disputeBusy,   setDisputeBusy]  = useState<Record<string, boolean>>({});
  const [disputeErr,    setDisputeErr]   = useState<Record<string, string | null>>({});
  const [finalizeBusy,  setFinalizeBusy] = useState<Record<string, boolean>>({});
  const [finalizeErr,   setFinalizeErr]  = useState<Record<string, string | null>>({});

  // ── Section 5: Create Policy ───────────────────────────────────────────────
  const [createDesc,      setCreateDesc]      = useState("");
  const [createPayout,    setCreatePayout]    = useState("");
  const [createMaxClaims, setCreateMaxClaims] = useState("0");
  const [createValidFrom, setCreateValidFrom] = useState("");
  const [createValidUntil,setCreateValidUntil]= useState("");
  const [createDisputeH,  setCreateDisputeH]  = useState("24");
  const [createFund,      setCreateFund]      = useState("");
  const [createEligibleClaimants, setCreateEligibleClaimants] = useState<"tribe_members" | "manual_approval">("tribe_members");
  const [createBusy,      setCreateBusy]      = useState(false);
  const [createErr,       setCreateErr]       = useState<string | null>(null);

  const now = Date.now();

  const activePolicies = (policies ?? []).filter(p => p.status === POLICY_ACTIVE);
  const myClaims = account
    ? (claims ?? []).filter(c => c.claimant.toLowerCase() === account.address.toLowerCase())
    : [];
  const myPolicies = account
    ? (policies ?? []).filter(p => p.sponsor.toLowerCase() === account.address.toLowerCase())
    : [];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmitClaim = async () => {
    if (!account) return;
    if (!claimPolicyId || !killmailInput.trim()) {
      setClaimErr("Select a policy and enter a Killmail Object ID."); return;
    }
    setClaimBusy(true); setClaimErr(null);
    try {
      const tx = buildSubmitClaimTx(claimPolicyId, killmailInput.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setClaimPolicyId(""); setKillmailInput("");
      invalidate();
    } catch (e) { setClaimErr(normalizeChainError(e)); }
    finally { setClaimBusy(false); }
  };

  const handleTopUp = async (policyId: string) => {
    if (!account) return;
    const amountStr = topUpAmounts[policyId] ?? "";
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      setTopUpErr(p => ({ ...p, [policyId]: "Enter a valid EVE amount." })); return;
    }
    setTopUpBusy(p => ({ ...p, [policyId]: true }));
    setTopUpErr(p => ({ ...p, [policyId]: null }));
    try {
      const tx = await buildTopUpTx(policyId, eveToMist(amount), account.address);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTopUpAmounts(p => ({ ...p, [policyId]: "" }));
      invalidate();
    } catch (e) { setTopUpErr(p => ({ ...p, [policyId]: normalizeChainError(e) })); }
    finally { setTopUpBusy(p => ({ ...p, [policyId]: false })); }
  };

  const handleDrain = async (policyId: string) => {
    setDrainBusy(p => ({ ...p, [policyId]: true }));
    setDrainErr(p => ({ ...p, [policyId]: null }));
    try {
      const tx = buildDrainPolicyTx(policyId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setDrainErr(p => ({ ...p, [policyId]: normalizeChainError(e) })); }
    finally { setDrainBusy(p => ({ ...p, [policyId]: false })); }
  };

  const handleDispute = async (claimId: string, policyId: string) => {
    setDisputeBusy(p => ({ ...p, [claimId]: true }));
    setDisputeErr(p => ({ ...p, [claimId]: null }));
    try {
      const tx = buildDisputeClaimTx(claimId, policyId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setDisputeErr(p => ({ ...p, [claimId]: normalizeChainError(e) })); }
    finally { setDisputeBusy(p => ({ ...p, [claimId]: false })); }
  };

  const handleFinalize = async (claim: SRPClaimState) => {
    setFinalizeBusy(p => ({ ...p, [claim.objectId]: true }));
    setFinalizeErr(p => ({ ...p, [claim.objectId]: null }));
    try {
      const tx = buildFinalizeClaimTx(claim.objectId, claim.policyId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setFinalizeErr(p => ({ ...p, [claim.objectId]: normalizeChainError(e) })); }
    finally { setFinalizeBusy(p => ({ ...p, [claim.objectId]: false })); }
  };

  const handleCreatePolicy = async () => {
    if (!account) return;
    if (!createDesc.trim() || !createPayout || !createFund || !createValidFrom || !createValidUntil) {
      setCreateErr("Fill in all required fields."); return;
    }
    setCreateBusy(true); setCreateErr(null);
    try {
      const validFromMs  = new Date(createValidFrom).getTime();
      const validUntilMs = new Date(createValidUntil).getTime();
      const disputeWindowMs = BigInt(Math.round((parseFloat(createDisputeH) || 24) * 3_600_000));
      const payoutPerLoss   = eveToMist(parseFloat(createPayout));
      const maxClaims       = BigInt(parseInt(createMaxClaims) || 0);
      const initialFund     = eveToMist(parseFloat(createFund));
      // Embed eligible claimants restriction note in description
      const eligibleLabel = createEligibleClaimants === "tribe_members" ? "Tribe Members Only" : "Manual Approval Required";
      const descWithRestriction = `${createDesc.trim()} [Eligible: ${eligibleLabel}]`;
      const tx = await buildCreatePolicyTx(
        descWithRestriction, payoutPerLoss, maxClaims,
        validFromMs, validUntilMs, disputeWindowMs, initialFund, account.address,
      );
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setCreateDesc(""); setCreatePayout(""); setCreateMaxClaims("0");
      setCreateValidFrom(""); setCreateValidUntil(""); setCreateDisputeH("24"); setCreateFund("");
      setCreateEligibleClaimants("tribe_members");
      invalidate();
    } catch (e) { setCreateErr(normalizeChainError(e)); }
    finally { setCreateBusy(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      {/* Header */}
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", marginBottom: "20px", fontFamily: "monospace" }}>
        SHIP REIMBURSEMENT PLANS
      </div>

      {/* ── Section 1: Active Policies ─────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionTitle}>ACTIVE POLICIES</div>
        {policiesLoading && <div style={muted}>Loading policies…</div>}
        {!policiesLoading && activePolicies.length === 0 && (
          <div style={muted}>No active policies found.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {activePolicies.map(p => {
            // Extract eligible claimants from description note
            const eligibleMatch = p.description.match(/\[Eligible: ([^\]]+)\]/);
            const eligibleLabel = eligibleMatch ? eligibleMatch[1] : null;
            const cleanDesc = p.description.replace(/\s*\[Eligible:[^\]]*\]/, "").trim();
            return (
            <div key={p.objectId} style={policyCard}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{cleanDesc || "(no description)"}</span>
                <span style={statusBadge(policyStatusColor(p.status))}>{policyStatusLabel(p.status)}</span>
                {eligibleLabel && (
                  <span style={{ fontSize: "10px", padding: "2px 8px", fontFamily: "monospace", color: "rgba(100,180,255,0.8)", background: "rgba(100,180,255,0.08)", border: "1px solid rgba(100,180,255,0.2)", letterSpacing: "0.04em" }}>
                    {eligibleLabel.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <InfoCell label="PAYOUT / LOSS">{formatEve(p.payoutPerLoss)}</InfoCell>
                <InfoCell label="FUND BALANCE">{formatEve(p.fundBalance)}</InfoCell>
                <InfoCell label="CLAIMS">
                  {String(p.claimsPaid)} / {p.maxClaims === 0n ? "∞" : String(p.maxClaims)}
                </InfoCell>
                <InfoCell label="VALID FROM">{fmtDate(p.validFromMs)}</InfoCell>
                <InfoCell label="VALID UNTIL">{fmtDate(p.validUntilMs)}</InfoCell>
                <InfoCell label="DISPUTE WINDOW">{Math.round(p.disputeWindowMs / 3_600_000)}h</InfoCell>
                <InfoCell label="SPONSOR">{shortAddr(p.sponsor)}</InfoCell>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Submit a Claim ─────────────────────────────────────── */}
      {account && (
        <div style={sectionBox}>
          <div style={sectionTitle}>SUBMIT A CLAIM</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>SELECT POLICY</span>
              <select
                value={claimPolicyId}
                onChange={e => setClaimPolicyId(e.target.value)}
                style={{ ...inputStyle, width: "320px" }}
              >
                <option value="">— select a policy —</option>
                {activePolicies.map(p => (
                  <option key={p.objectId} value={p.objectId}>
                    {p.description || shortAddr(p.objectId)} ({formatEve(p.payoutPerLoss)} payout)
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>KILLMAIL OBJECT ID — paste the on-chain object ID of your ship loss</span>
              <input
                type="text"
                value={killmailInput}
                onChange={e => setKillmailInput(e.target.value)}
                placeholder="0x..."
                style={{ ...inputStyle, width: "440px" }}
              />
              <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>
                Find it on suiscan.xyz/testnet or from your killmail notification
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button className="accent-button" onClick={handleSubmitClaim} disabled={claimBusy} style={{ fontSize: "12px", padding: "7px 20px" }}>
                {claimBusy ? "Submitting…" : "Submit Claim"}
              </button>
              {claimErr && <span style={errStyle}>⚠ {claimErr}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 3: My Claims ──────────────────────────────────────────── */}
      {account && (
        <div style={sectionBox}>
          <div style={sectionTitle}>MY CLAIMS</div>
          {claimsLoading && <div style={muted}>Loading claims…</div>}
          {!claimsLoading && myClaims.length === 0 && <div style={muted}>No claims found for your address.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myClaims.map(claim => {
              const policy = (policies ?? []).find(p => p.objectId === claim.policyId);
              const disputeExpiry = claim.claimSubmittedMs + (policy?.disputeWindowMs ?? 86_400_000);
              const windowOpen = now < disputeExpiry;
              const canFinalize = claim.status === CLAIM_PENDING && !windowOpen;
              const timeRemainingMs = disputeExpiry - now;
              const timeRemainingH = Math.max(0, Math.floor(timeRemainingMs / 3_600_000));
              const timeRemainingMin = Math.max(0, Math.floor((timeRemainingMs % 3_600_000) / 60_000));

              return (
                <div key={claim.objectId} style={claimCard(claim.status)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "13px" }}>
                      {policy?.description || shortAddr(claim.policyId)}
                    </span>
                    <span style={statusBadge(claimStatusColor(claim.status))}>{claimStatusLabel(claim.status)}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "8px" }}>
                    <InfoCell label="KILLMAIL">
                      <a href={`https://suiscan.xyz/testnet/object/${claim.killmailObjectId}`} target="_blank" rel="noreferrer"
                        style={{ color: "#FF4700", fontFamily: "monospace", fontSize: "11px" }}>
                        {shortAddr(claim.killmailObjectId)}↗
                      </a>
                    </InfoCell>
                    <InfoCell label="SUBMITTED">{fmtDatetime(claim.claimSubmittedMs)}</InfoCell>
                    {claim.status === CLAIM_PENDING && windowOpen && (
                      <InfoCell label="DISPUTE WINDOW">
                        <span style={{ color: "#FF4700" }}>{timeRemainingH}h {timeRemainingMin}m remaining</span>
                      </InfoCell>
                    )}
                    {policy && (
                      <InfoCell label="PAYOUT">{formatEve(policy.payoutPerLoss)}</InfoCell>
                    )}
                  </div>
                  {canFinalize && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => handleFinalize(claim)}
                        disabled={finalizeBusy[claim.objectId] ?? false}
                        style={greenBtn}
                      >
                        {(finalizeBusy[claim.objectId]) ? "Finalizing…" : "Finalize Claim"}
                      </button>
                      {finalizeErr[claim.objectId] && <span style={errStyle}>⚠ {finalizeErr[claim.objectId]}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 4: Sponsor Controls ──────────────────────────────────── */}
      {account && myPolicies.length > 0 && (
        <div style={sectionBox}>
          <div style={sectionTitle}>SPONSOR CONTROLS</div>
          {myPolicies.map(policy => {
            const policyClaims = (claims ?? []).filter(c => c.policyId === policy.objectId && c.status === CLAIM_PENDING);
            return (
              <div key={policy.objectId} style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid rgba(255,71,0,0.1)" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>
                  {policy.description || shortAddr(policy.objectId)}
                  <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginLeft: "8px" }}>
                    Fund: {formatEve(policy.fundBalance)}
                  </span>
                </div>
                {/* Top Up */}
                {policy.status === POLICY_ACTIVE && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                    <input
                      type="number"
                      value={topUpAmounts[policy.objectId] ?? ""}
                      onChange={e => setTopUpAmounts(p => ({ ...p, [policy.objectId]: e.target.value }))}
                      placeholder="EVE amount"
                      style={{ ...inputStyle, width: "120px" }}
                    />
                    <button
                      onClick={() => handleTopUp(policy.objectId)}
                      disabled={topUpBusy[policy.objectId] ?? false}
                      style={greenBtn}
                    >
                      {(topUpBusy[policy.objectId]) ? "Topping up…" : "Top Up"}
                    </button>
                    <button
                      onClick={() => handleDrain(policy.objectId)}
                      disabled={drainBusy[policy.objectId] ?? false}
                      style={greyBtn}
                    >
                      {(drainBusy[policy.objectId]) ? "Draining…" : "Drain Policy"}
                    </button>
                    {topUpErr[policy.objectId] && <span style={errStyle}>⚠ {topUpErr[policy.objectId]}</span>}
                    {drainErr[policy.objectId] && <span style={errStyle}>⚠ {drainErr[policy.objectId]}</span>}
                  </div>
                )}
                {/* Pending claims against this policy */}
                {policyClaims.length > 0 && (
                  <div>
                    <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "6px" }}>
                      PENDING CLAIMS ({policyClaims.length})
                    </div>
                    {policyClaims.map(claim => {
                      const disputeExpiry = claim.claimSubmittedMs + policy.disputeWindowMs;
                      const withinWindow  = now < disputeExpiry;
                      return (
                        <div key={claim.objectId} style={{ padding: "10px", background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.12)", marginBottom: "6px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "6px" }}>
                            <InfoCell label="CLAIMANT">{shortAddr(claim.claimant)}</InfoCell>
                            <InfoCell label="SUBMITTED">{fmtDatetime(claim.claimSubmittedMs)}</InfoCell>
                            <InfoCell label="KILLMAIL">
                              <a href={`https://suiscan.xyz/testnet/object/${claim.killmailObjectId}`} target="_blank" rel="noreferrer"
                                style={{ color: "#FF4700", fontFamily: "monospace", fontSize: "11px" }}>
                                {shortAddr(claim.killmailObjectId)}↗
                              </a>
                            </InfoCell>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {withinWindow && (
                              <button
                                onClick={() => handleDispute(claim.objectId, policy.objectId)}
                                disabled={disputeBusy[claim.objectId] ?? false}
                                style={greyBtn}
                              >
                                {(disputeBusy[claim.objectId]) ? "Disputing…" : "Dispute Claim"}
                              </button>
                            )}
                            {!withinWindow && (
                              <span style={{ color: "#00ff96", fontSize: "11px" }}>Window closed — ready to finalize</span>
                            )}
                            {disputeErr[claim.objectId] && <span style={errStyle}>⚠ {disputeErr[claim.objectId]}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {policyClaims.length === 0 && <div style={muted}>No pending claims.</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section 5: Create New Policy ─────────────────────────────────── */}
      {account && (
        <div style={sectionBox}>
          <div style={sectionTitle}>CREATE SRP POLICY</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            <FormField label="DESCRIPTION" flex>
              <input type="text" value={createDesc} onChange={e => setCreateDesc(e.target.value)}
                placeholder="Reapers Doctrine SRP — March op" style={{ ...inputStyle, width: "280px" }} />
            </FormField>
            <FormField label="PAYOUT / LOSS (EVE)">
              <input type="number" value={createPayout} onChange={e => setCreatePayout(e.target.value)}
                placeholder="100" min="0" style={inputStyle} />
            </FormField>
            <FormField label="MAX CLAIMS (0 = unlimited)">
              <input type="number" value={createMaxClaims} onChange={e => setCreateMaxClaims(e.target.value)}
                placeholder="0" min="0" style={{ ...inputStyle, width: "80px" }} />
            </FormField>
            <FormField label="DISPUTE WINDOW (HOURS)">
              <input type="number" value={createDisputeH} onChange={e => setCreateDisputeH(e.target.value)}
                placeholder="24" min="1" style={{ ...inputStyle, width: "80px" }} />
            </FormField>
            <FormField label="ELIGIBLE CLAIMANTS">
              <select
                value={createEligibleClaimants}
                onChange={e => setCreateEligibleClaimants(e.target.value as "tribe_members" | "manual_approval")}
                style={{ ...inputStyle, width: "200px" }}
              >
                <option value="tribe_members">Tribe Members Only</option>
                <option value="manual_approval">Manual Approval Required</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            <FormField label="VALID FROM">
              <input type="datetime-local" value={createValidFrom} onChange={e => setCreateValidFrom(e.target.value)}
                style={inputStyle} />
            </FormField>
            <FormField label="VALID UNTIL">
              <input type="datetime-local" value={createValidUntil} onChange={e => setCreateValidUntil(e.target.value)}
                style={inputStyle} />
            </FormField>
            <FormField label="INITIAL FUND (EVE)">
              <input type="number" value={createFund} onChange={e => setCreateFund(e.target.value)}
                placeholder="500" min="0" style={inputStyle} />
            </FormField>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="accent-button" onClick={handleCreatePolicy} disabled={createBusy}
              style={{ fontSize: "12px", padding: "7px 20px" }}>
              {createBusy ? "Creating…" : "Create SRP Policy"}
            </button>
            {createErr && <span style={errStyle}>⚠ {createErr}</span>}
          </div>
        </div>
      )}

      {!account && (
        <div style={{ marginTop: "16px", color: "rgba(107,107,94,0.55)", fontSize: "12px", textAlign: "center" }}>
          Connect wallet to submit claims or create policies
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>{label} </span>
      <span style={{ color: "#ddd", fontSize: "12px", fontFamily: "monospace" }}>{children}</span>
    </div>
  );
}

function FormField({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: flex ? 1 : undefined, minWidth: flex ? "200px" : undefined }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0",
  color: "#fff",
  fontSize: "12px",
  padding: "6px 9px",
  outline: "none",
  fontFamily: "monospace",
  width: "150px",
};

const labelStyle: React.CSSProperties = {
  color: "rgba(107,107,94,0.7)",
  fontSize: "10px",
  letterSpacing: "0.05em",
};

const muted: React.CSSProperties = {
  color: "rgba(107,107,94,0.55)",
  fontSize: "12px",
};

const errStyle: React.CSSProperties = {
  color: "#ff6432",
  fontSize: "11px",
};

const sectionBox: React.CSSProperties = {
  marginBottom: "24px",
  padding: "16px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const sectionTitle: React.CSSProperties = {
  color: "#FF4700",
  fontWeight: 600,
  fontSize: "13px",
  marginBottom: "14px",
  letterSpacing: "0.06em",
};

const policyCard: React.CSSProperties = {
  padding: "14px",
  background: "rgba(0,255,150,0.03)",
  border: "1px solid rgba(0,255,150,0.12)",
};

function claimCard(status: number): React.CSSProperties {
  return {
    padding: "12px",
    background: status === CLAIM_PENDING ? "rgba(255,71,0,0.04)"
      : status === CLAIM_PAID ? "rgba(0,255,150,0.03)"
      : "rgba(255,255,255,0.02)",
    border: `1px solid ${
      status === CLAIM_PENDING ? "rgba(255,71,0,0.2)"
        : status === CLAIM_PAID ? "rgba(0,255,150,0.15)"
        : "rgba(255,255,255,0.07)"
    }`,
  };
}

function statusBadge(color: string): React.CSSProperties {
  return {
    padding: "2px 10px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color,
    background: `${color}18`,
    border: `1px solid ${color}40`,
    fontFamily: "monospace",
  };
}

const greenBtn: React.CSSProperties = {
  background: "rgba(0,255,150,0.1)",
  border: "1px solid rgba(0,255,150,0.3)",
  color: "#00ff96",
  borderRadius: "0",
  fontSize: "12px",
  padding: "5px 16px",
  cursor: "pointer",
  fontFamily: "monospace",
};

const greyBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#888",
  borderRadius: "0",
  fontSize: "11px",
  padding: "4px 14px",
  cursor: "pointer",
  fontFamily: "monospace",
};
