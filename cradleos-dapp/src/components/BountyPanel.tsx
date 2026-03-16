import { normalizeChainError } from "../utils";
/**
 * BountyPanel — Attestor-gated kill bounties with CRDL escrow.
 *
 * All wallets:
 *   • View active bounties (queried from BountyPosted events + live object fetch)
 *   • Status badges: OPEN (orange), CLAIMED (green), CANCELLED (grey)
 *
 * Connected wallet:
 *   • Post a new bounty (target char ID, name, CRDL amount, attestor, expiry days)
 *
 * Attestors:
 *   • Confirm kill on open bounties they are attesting (enter killer address)
 *
 * Posters:
 *   • Cancel their own open bounties (or any expired open bounty)
 */
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG_V8, CRDL_COIN_TYPE, SUI_TESTNET_RPC, BOUNTY_BOARD, CLOCK, eventType } from "../constants";
import { rpcGetObject, numish } from "../lib";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPEN      = 0;
const STATUS_CLAIMED   = 1;
const STATUS_CANCELLED = 2;

/** CRDL uses 9 decimals (same as SUI/MIST). */
const CRDL_DECIMALS = 9;

// ── Types ─────────────────────────────────────────────────────────────────────

type BountyState = {
  objectId: string;
  bountyIndex: number;
  poster: string;
  targetCharId: string;
  targetName: string;
  rewardAmount: bigint;
  attestor: string;
  killer: string | null;
  status: number;
  createdMs: number;
  expiresMs: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatCrdl(mist: bigint): string {
  if (mist === 0n) return "0 CRDL";
  const whole = mist / BigInt(10 ** CRDL_DECIMALS);
  const frac  = mist % BigInt(10 ** CRDL_DECIMALS);
  if (frac === 0n) return `${whole} CRDL`;
  const fracStr = frac.toString().padStart(CRDL_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} CRDL`;
}

function crdlToMist(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** CRDL_DECIMALS));
}

function statusLabel(status: number): string {
  if (status === STATUS_OPEN)      return "OPEN";
  if (status === STATUS_CLAIMED)   return "CLAIMED";
  if (status === STATUS_CANCELLED) return "CANCELLED";
  return "UNKNOWN";
}

function statusColor(status: number): string {
  if (status === STATUS_OPEN)      return "#FF4700";
  if (status === STATUS_CLAIMED)   return "#00ff96";
  return "#555";
}

/** Fetch a Bounty object's live state from RPC. */
async function fetchBountyObject(objectId: string): Promise<BountyState | null> {
  try {
    const fields = await rpcGetObject(objectId);
    const rewardField = fields["reward"] as { fields?: { balance?: string | number } } | undefined;
    const killerField = fields["killer"] as { fields?: { vec?: string[] } } | undefined;
    const killerVec   = killerField?.fields?.vec ?? [];
    return {
      objectId,
      bountyIndex:  numish(fields["bounty_index"]) ?? 0,
      poster:       String(fields["poster"] ?? ""),
      targetCharId: String(fields["target_char_id"] ?? ""),
      targetName:   String(fields["target_name"] ?? ""),
      rewardAmount: BigInt(String(rewardField?.fields?.balance ?? fields["reward"] ?? 0)),
      attestor:     String(fields["attestor"] ?? ""),
      killer:       killerVec.length > 0 ? String(killerVec[0]) : null,
      status:       numish(fields["status"]) ?? 0,
      createdMs:    numish(fields["created_ms"]) ?? 0,
      expiresMs:    numish(fields["expires_ms"]) ?? 0,
    };
  } catch { return null; }
}

/** Fetch all bounties by querying BountyPosted events, then loading live objects. */
async function fetchBounties(): Promise<BountyState[]> {
  if (!BOUNTY_BOARD) return [];
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("bounty_contract", "BountyPosted") }, null, 100, true],
      }),
    });
    const j = await res.json() as {
      result?: { data?: Array<{ parsedJson: Record<string, unknown> }> };
    };
    const events = j.result?.data ?? [];
    const bounties = await Promise.all(
      events.map(e => fetchBountyObject(String(e.parsedJson["bounty_id"] ?? "")))
    );
    return bounties
      .filter((b): b is BountyState => b !== null)
      .sort((a, b) => b.bountyIndex - a.bountyIndex);
  } catch { return []; }
}

// ── On-chain killmail lookup ──────────────────────────────────────────────────

const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
const WORLD_PKG = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

interface OnChainKill {
  objectId: string;
  killerId: string;
  victimId: string;
  lossType: string;
  killTimestamp: number;
  solarSystemId: string;
}

async function fetchKillsForTarget(targetCharId: string): Promise<OnChainKill[]> {
  try {
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          objects(filter: { type: "${WORLD_PKG}::killmail::Killmail" }, first: 200) {
            nodes {
              address
              asMoveObject { contents { json } }
            }
          }
        }`
      }),
    });
    const d = await res.json();
    const nodes = d?.data?.objects?.nodes ?? [];
    return nodes
      .map((n: any) => {
        const j = n.asMoveObject?.contents?.json ?? {};
        return {
          objectId: n.address,
          killerId: j.killer_id?.item_id ?? "",
          victimId: j.victim_id?.item_id ?? "",
          lossType: j.loss_type?.["@variant"] ?? "UNKNOWN",
          killTimestamp: parseInt(j.kill_timestamp ?? "0", 10),
          solarSystemId: j.solar_system_id?.item_id ?? "",
        };
      })
      .filter((k: OnChainKill) => k.victimId === targetCharId);
  } catch {
    return [];
  }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

/** Post bounty tx — fetches a CRDL coin from the sender, splits the reward, and submits. */
async function buildPostBountyTx(
  targetCharId: number,
  targetName: string,
  mistAmount: bigint,
  attestor: string,
  expiresMs: number,
  senderAddress: string,
): Promise<Transaction> {
  // Fetch a CRDL coin belonging to the sender
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getCoins",
      params: [senderAddress, CRDL_COIN_TYPE, null, 10],
    }),
  });
  const j = await res.json() as { result?: { data?: Array<{ coinObjectId: string; balance: string }> } };
  const coins = j.result?.data ?? [];
  if (coins.length === 0) throw new Error("No CRDL coins in wallet. Acquire CRDL first.");

  // Sort descending by balance, pick the largest
  coins.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  const sourceCoin = coins[0];

  const tx = new Transaction();
  const [reward] = tx.splitCoins(tx.object(sourceCoin.coinObjectId), [tx.pure.u64(mistAmount)]);

  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::bounty_contract::post_bounty_entry`,
    arguments: [
      tx.object(BOUNTY_BOARD),
      tx.pure.u64(BigInt(targetCharId)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(targetName))),
      reward,
      tx.pure.address(attestor),
      tx.pure.u64(BigInt(expiresMs)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildConfirmKillTx(bountyId: string, killerAddress: string, killmailObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::bounty_contract::confirm_kill_entry`,
    arguments: [
      tx.object(bountyId),
      tx.pure.address(killerAddress),
      tx.object(CLOCK),
      tx.pure.address(killmailObjectId),
    ],
  });
  return tx;
}

function buildCancelBountyTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG_V8}::bounty_contract::cancel_bounty_entry`,
    arguments: [
      tx.object(bountyId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function BountyPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit  = useDAppKit();
  const queryClient = useQueryClient();

  // Post Bounty form state
  const [postTargetCharId, setPostTargetCharId] = useState("");
  const [postTargetName,   setPostTargetName]   = useState("");
  const [postAmount,       setPostAmount]        = useState("");
  const [postAttestor,     setPostAttestor]      = useState("");
  const [postExpiryDays,   setPostExpiryDays]    = useState("7");
  const [postBusy,         setPostBusy]          = useState(false);
  const [postErr,          setPostErr]           = useState<string | null>(null);

  // Confirm Kill state (keyed by bounty objectId)
  const [killerInputs,  setKillerInputs]  = useState<Record<string, string>>({});
  const [confirmBusy,   setConfirmBusy]   = useState<Record<string, boolean>>({});
  const [confirmErr,    setConfirmErr]    = useState<Record<string, string | null>>({});
  const [cancelBusy,    setCancelBusy]    = useState<Record<string, boolean>>({});
  const [cancelErr,     setCancelErr]     = useState<Record<string, string | null>>({});

  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [killEvidence,     setKillEvidence]      = useState<OnChainKill[]>([]);
  const [evidenceLoading,  setEvidenceLoading]   = useState(false);

  const invalidate = useCallback(() => {
    [2500, 6000, 12000].forEach(d =>
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["bounties"] }), d)
    );
  }, [queryClient]);

  const { data: bounties, isLoading } = useQuery<BountyState[]>({
    queryKey: ["bounties"],
    queryFn: fetchBounties,
    enabled: !!BOUNTY_BOARD,
    staleTime: 20_000,
  });

  const selectedBounty = (bounties ?? []).find(b => b.objectId === selectedBountyId) ?? null;

  useEffect(() => {
    if (!selectedBounty?.targetCharId) return;
    setEvidenceLoading(true);
    fetchKillsForTarget(String(selectedBounty.targetCharId))
      .then(kills => { setKillEvidence(kills); setEvidenceLoading(false); });
  }, [selectedBounty?.targetCharId]);

  // ── Not deployed guard ─────────────────────────────────────────────────────

  if (!BOUNTY_BOARD) {
    return (
      <div className="card" style={{
        textAlign: "center", padding: "40px 32px",
        background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.12)",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "10px", fontFamily: "monospace" }}>
          CONTRACT NOT YET DEPLOYED
        </div>
        <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "12px" }}>
          Set <code style={{ color: "#aaa" }}>BOUNTY_BOARD</code> in <code style={{ color: "#aaa" }}>constants.ts</code> after deploying the bounty_contract module.
        </div>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePostBounty = async () => {
    if (!account) return;
    const charId   = parseInt(postTargetCharId, 10);
    const amount   = parseFloat(postAmount);
    const days     = parseFloat(postExpiryDays) || 7;
    const attestor = postAttestor.trim() || account.address;
    if (!charId || !postTargetName.trim() || !amount) {
      setPostErr("Fill in all required fields."); return;
    }
    setPostBusy(true); setPostErr(null);
    try {
      const mistAmount = crdlToMist(amount);
      const expiresMs  = Date.now() + Math.round(days * 24 * 60 * 60 * 1000);
      const tx = await buildPostBountyTx(charId, postTargetName.trim(), mistAmount, attestor, expiresMs, account.address);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setPostTargetCharId(""); setPostTargetName(""); setPostAmount("");
      setPostAttestor(""); setPostExpiryDays("7");
      invalidate();
    } catch (e) { setPostErr(normalizeChainError(e)); }
    finally { setPostBusy(false); }
  };

  const handleConfirmKill = async (bounty: BountyState) => {
    const killerAddress = (killerInputs[bounty.objectId] ?? "").trim();
    if (!killerAddress) {
      setConfirmErr(prev => ({ ...prev, [bounty.objectId]: "Enter killer address." })); return;
    }
    setConfirmBusy(prev => ({ ...prev, [bounty.objectId]: true }));
    setConfirmErr(prev => ({ ...prev, [bounty.objectId]: null }));
    try {
      const killmailObjectId = killEvidence.length > 0
        ? killEvidence[0].objectId
        : "0x0000000000000000000000000000000000000000000000000000000000000000";
      const tx = buildConfirmKillTx(bounty.objectId, killerAddress, killmailObjectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setKillerInputs(prev => ({ ...prev, [bounty.objectId]: "" }));
      invalidate();
    } catch (e) {
      setConfirmErr(prev => ({ ...prev, [bounty.objectId]: normalizeChainError(e) }));
    }
    finally { setConfirmBusy(prev => ({ ...prev, [bounty.objectId]: false })); }
  };

  const handleCancelBounty = async (bounty: BountyState) => {
    setCancelBusy(prev => ({ ...prev, [bounty.objectId]: true }));
    setCancelErr(prev => ({ ...prev, [bounty.objectId]: null }));
    try {
      const tx = buildCancelBountyTx(bounty.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) {
      setCancelErr(prev => ({ ...prev, [bounty.objectId]: normalizeChainError(e) }));
    }
    finally { setCancelBusy(prev => ({ ...prev, [bounty.objectId]: false })); }
  };

  const now = Date.now();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      {/* Header */}
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", marginBottom: "20px", fontFamily: "monospace" }}>
        BOUNTY BOARD
      </div>

      {/* Post Bounty form */}
      {account && (
        <div style={{
          marginBottom: "24px", padding: "16px",
          background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.15)", borderRadius: "0",
        }}>
          <div style={{
            color: "#FF4700", fontWeight: 600, fontSize: "13px",
            marginBottom: "14px", letterSpacing: "0.06em",
          }}>
            POST BOUNTY
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            {/* Target Char ID */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em" }}>TARGET CHAR ID</span>
              <input
                type="number"
                value={postTargetCharId}
                onChange={e => setPostTargetCharId(e.target.value)}
                placeholder="90000001"
                style={inputStyle}
              />
            </div>
            {/* Target Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "140px" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em" }}>TARGET NAME</span>
              <input
                type="text"
                value={postTargetName}
                onChange={e => setPostTargetName(e.target.value)}
                placeholder="Vaultbreaker Rex"
                style={inputStyle}
              />
            </div>
            {/* CRDL Amount */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em" }}>REWARD (CRDL)</span>
              <input
                type="number"
                value={postAmount}
                onChange={e => setPostAmount(e.target.value)}
                placeholder="100"
                min="0"
                style={inputStyle}
              />
            </div>
            {/* Expiry Days */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em" }}>EXPIRY (DAYS)</span>
              <input
                type="number"
                value={postExpiryDays}
                onChange={e => setPostExpiryDays(e.target.value)}
                placeholder="7"
                min="1"
                style={{ ...inputStyle, width: "70px" }}
              />
            </div>
          </div>

          {/* Attestor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
            <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em" }}>
              ATTESTOR ADDRESS <span style={{ color: "rgba(107,107,94,0.45)" }}>(defaults to your address)</span>
            </span>
            <input
              type="text"
              value={postAttestor}
              onChange={e => setPostAttestor(e.target.value)}
              placeholder={account.address}
              style={{ ...inputStyle, width: "100%", maxWidth: "440px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="accent-button"
              onClick={handlePostBounty}
              disabled={postBusy}
              style={{ fontSize: "12px", padding: "7px 20px" }}
            >
              {postBusy ? "Posting…" : "Post Bounty"}
            </button>
            {postErr && <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {postErr}</span>}
          </div>
        </div>
      )}

      {/* Active Bounties */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "0", padding: "14px",
      }}>
        <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "14px", letterSpacing: "0.05em" }}>
          ACTIVE BOUNTIES
        </div>

        {isLoading && (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>Loading bounties…</div>
        )}

        {!isLoading && (bounties ?? []).length === 0 && (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No bounties found.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(bounties ?? []).map(bounty => {
            const isAttestor = !!account && account.address.toLowerCase() === bounty.attestor.toLowerCase();
            const isPoster   = !!account && account.address.toLowerCase() === bounty.poster.toLowerCase();
            const isExpired  = now >= bounty.expiresMs;
            const canCancel  = bounty.status === STATUS_OPEN && (isPoster || isExpired);

            return (
              <div key={bounty.objectId} onClick={() => setSelectedBountyId(id => id === bounty.objectId ? null : bounty.objectId)} style={{
                padding: "14px",
                cursor: "pointer",
                background: bounty.status === STATUS_OPEN
                  ? "rgba(255,71,0,0.04)"
                  : bounty.status === STATUS_CLAIMED
                    ? "rgba(0,255,150,0.03)"
                    : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  bounty.status === STATUS_OPEN    ? "rgba(255,71,0,0.2)"  :
                  bounty.status === STATUS_CLAIMED ? "rgba(0,255,150,0.15)" :
                  "rgba(255,255,255,0.07)"
                }`,
                borderRadius: "0",
              }}>
                {/* Top row: target + status */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px", fontFamily: "monospace" }}>
                    {bounty.targetName}
                  </span>
                  <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", fontFamily: "monospace" }}>
                    #{bounty.targetCharId}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    padding: "2px 10px", borderRadius: "2px",
                    fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
                    color: statusColor(bounty.status),
                    background: bounty.status === STATUS_OPEN
                      ? "rgba(255,71,0,0.12)"
                      : bounty.status === STATUS_CLAIMED
                        ? "rgba(0,255,150,0.1)"
                        : "rgba(255,255,255,0.05)",
                    border: `1px solid ${statusColor(bounty.status)}40`,
                    fontFamily: "monospace",
                  }}>
                    {statusLabel(bounty.status)}
                  </span>
                </div>

                {/* Details row */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <div>
                    <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>REWARD </span>
                    <span style={{ color: "#FF4700", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>
                      {formatCrdl(bounty.rewardAmount)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>POSTED BY </span>
                    <span style={{ color: "#aaa", fontSize: "11px", fontFamily: "monospace" }}>
                      {shortAddr(bounty.poster)}
                      {isPoster && <span style={{ color: "#FF4700", marginLeft: "4px", fontSize: "10px" }}>(you)</span>}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>ATTESTOR </span>
                    <span style={{ color: "#aaa", fontSize: "11px", fontFamily: "monospace" }}>
                      {shortAddr(bounty.attestor)}
                      {isAttestor && <span style={{ color: "#00ff96", marginLeft: "4px", fontSize: "10px" }}>(you)</span>}
                    </span>
                  </div>
                  {bounty.status === STATUS_CLAIMED && bounty.killer && (
                    <div>
                      <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>KILLER </span>
                      <span style={{ color: "#00ff96", fontSize: "11px", fontFamily: "monospace" }}>
                        {shortAddr(bounty.killer)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.05em" }}>EXPIRES </span>
                    <span style={{
                      color: isExpired ? "#ff6432" : "rgba(107,107,94,0.7)",
                      fontSize: "11px", fontFamily: "monospace",
                    }}>
                      {new Date(bounty.expiresMs).toLocaleDateString()}
                      {isExpired && bounty.status === STATUS_OPEN && " (EXPIRED)"}
                    </span>
                  </div>
                </div>

                {/* Kill Evidence */}
                {selectedBountyId === bounty.objectId && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: "#aaa", fontWeight: 700, fontSize: "11px", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Kill Evidence</div>
                    {evidenceLoading ? (
                      <div style={{ color: "rgba(180,180,160,0.6)", fontSize: 11 }}>Searching on-chain killmails...</div>
                    ) : killEvidence.length === 0 ? (
                      <div style={{ color: "rgba(180,180,160,0.6)", fontSize: 11 }}>No on-chain kills found for this target yet.</div>
                    ) : (
                      killEvidence.map(k => (
                        <div key={k.objectId} style={{ background: "rgba(255,71,0,0.06)", border: "1px solid rgba(255,71,0,0.2)", padding: "6px 8px", marginBottom: 4, fontSize: 11 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ color: k.lossType === "SHIP" ? "#FF4700" : "#ff4444", fontWeight: 700 }}>{k.lossType}</span>
                            <span style={{ color: "rgba(180,180,160,0.6)" }}>{new Date(k.killTimestamp * 1000).toUTCString().slice(0, 22)}</span>
                          </div>
                          <div style={{ color: "rgba(180,180,160,0.6)" }}>killer: <span style={{ color: "#00ff96" }}>{k.killerId}</span></div>
                          <div style={{ color: "rgba(180,180,160,0.6)" }}>system: {k.solarSystemId}</div>
                          <div style={{ fontSize: 10, color: "rgba(180,180,160,0.4)", marginTop: 2 }}>
                            obj: {k.objectId.slice(0, 20)}...{" "}
                            <button
                              style={{ background: "transparent", border: "none", color: "#FF4700", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
                              onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(k.objectId); }}
                            >copy</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Attestor: Confirm Kill */}
                {isAttestor && bounty.status === STATUS_OPEN && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" }}>
                    <input
                      type="text"
                      value={killerInputs[bounty.objectId] ?? ""}
                      onChange={e => setKillerInputs(prev => ({ ...prev, [bounty.objectId]: e.target.value }))}
                      placeholder="Killer address (0x...)"
                      style={{ ...inputStyle, width: "280px" }}
                    />
                    <button
                      onClick={() => handleConfirmKill(bounty)}
                      disabled={confirmBusy[bounty.objectId] ?? false}
                      style={{
                        background: "rgba(0,255,150,0.1)", border: "1px solid rgba(0,255,150,0.3)",
                        color: "#00ff96", borderRadius: "0", fontSize: "12px",
                        padding: "5px 16px", cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      {(confirmBusy[bounty.objectId]) ? "Confirming…" : "Confirm Kill"}
                    </button>
                    {confirmErr[bounty.objectId] && (
                      <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {confirmErr[bounty.objectId]}</span>
                    )}
                  </div>
                )}

                {/* Poster: Cancel */}
                {canCancel && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                    <button
                      onClick={() => handleCancelBounty(bounty)}
                      disabled={cancelBusy[bounty.objectId] ?? false}
                      style={{
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                        color: "#888", borderRadius: "0", fontSize: "11px",
                        padding: "4px 14px", cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      {(cancelBusy[bounty.objectId]) ? "Cancelling…" : "Cancel Bounty"}
                    </button>
                    {cancelErr[bounty.objectId] && (
                      <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {cancelErr[bounty.objectId]}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!account && (
        <div style={{ marginTop: "16px", color: "rgba(107,107,94,0.55)", fontSize: "12px", textAlign: "center" }}>
          Connect wallet to post bounties
        </div>
      )}
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
