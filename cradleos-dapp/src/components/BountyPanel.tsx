/**
 * BountyPanel — Trustless kill bounties with EVE escrow.
 *
 * Uses cradleos::trustless_bounty — fully trustless, verified by on-chain killmail.
 *
 * All wallets:
 *   • View active bounties (queried from BountyPosted events + live object fetch)
 *   • Status badges: OPEN (orange), CLAIMED (green), CANCELLED (grey), DRAINED (yellow)
 *
 * Connected wallet:
 *   • Post a new bounty (4 bounty types, target, EVE pool, expiry)
 *   • Claim a kill by presenting a Killmail object + their Character object
 *   • Top up per-kill bounties (poster only)
 *   • Cancel bounties (poster anytime, anyone after expiry)
 */
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import {
  CRADLEOS_PKG,
  CRADLEOS_ORIGINAL,
  EVE_COIN_TYPE,
  SUI_TESTNET_RPC,
  TRUSTLESS_BOUNTY_BOARD,
  CLOCK,
  CHARACTER_TYPE,
} from "../constants";
import { rpcGetObject, numish } from "../lib";
import { normalizeChainError } from "../utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPEN      = 0;
const STATUS_CLAIMED   = 1;
const STATUS_CANCELLED = 2;
const STATUS_DRAINED   = 3;

const BOUNTY_TYPE_SHIP_SINGLE      = 0;
const BOUNTY_TYPE_STRUCTURE_SINGLE = 1;
const BOUNTY_TYPE_PER_SHIP         = 2;
const BOUNTY_TYPE_PER_STRUCTURE    = 3;

/** EVE uses 9 decimals (same as SUI/MIST). */
const EVE_DECIMALS = 9;

const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
const WORLD_PKG   = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrustlessBountyState = {
  objectId: string;
  poster: string;
  targetCharId: string;
  targetName: string;
  /** Total pool escrowed (in mist) */
  rewardAmount: bigint;
  /** Amount per kill claim (in mist) */
  rewardPerKill: bigint;
  bountyType: number;
  killsClaimed: number;
  totalPaidOut: bigint;
  status: number;
  createdMs: number;
  expiresMs: number;
};

interface OnChainKill {
  objectId: string;
  killerId: string;
  victimId: string;
  lossType: string;
  killTimestamp: number;
  solarSystemId: string;
}

interface CharacterObject {
  objectId: string;
  charId: string;
}

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

function statusLabel(status: number): string {
  if (status === STATUS_OPEN)      return "OPEN";
  if (status === STATUS_CLAIMED)   return "CLAIMED";
  if (status === STATUS_CANCELLED) return "CANCELLED";
  if (status === STATUS_DRAINED)   return "DRAINED";
  return "UNKNOWN";
}

function statusColor(status: number): string {
  if (status === STATUS_OPEN)      return "#FF4700";
  if (status === STATUS_CLAIMED)   return "#00ff96";
  if (status === STATUS_DRAINED)   return "#ffcc00";
  return "#555";
}

function bountyTypeLabel(bt: number): { icon: string; main: string; sub: string } {
  if (bt === BOUNTY_TYPE_SHIP_SINGLE)      return { icon: "🚀", main: "SHIP",      sub: "SINGLE"   };
  if (bt === BOUNTY_TYPE_STRUCTURE_SINGLE) return { icon: "🏗️", main: "STRUCTURE", sub: "SINGLE"   };
  if (bt === BOUNTY_TYPE_PER_SHIP)         return { icon: "🚀", main: "SHIP",      sub: "PER KILL" };
  if (bt === BOUNTY_TYPE_PER_STRUCTURE)    return { icon: "🏗️", main: "STRUCTURE", sub: "PER KILL" };
  return { icon: "❓", main: "UNKNOWN", sub: "" };
}

function isPerKill(bt: number): boolean {
  return bt === BOUNTY_TYPE_PER_SHIP || bt === BOUNTY_TYPE_PER_STRUCTURE;
}

/** Pool remaining for per-kill bounties */
function poolRemaining(b: TrustlessBountyState): bigint {
  if (!isPerKill(b.bountyType)) return b.rewardAmount;
  const paid = b.totalPaidOut;
  return b.rewardAmount > paid ? b.rewardAmount - paid : 0n;
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

async function fetchTrustlessBountyObject(objectId: string): Promise<TrustlessBountyState | null> {
  try {
    const fields = await rpcGetObject(objectId);
    const rewardField = fields["reward"] as { fields?: { balance?: string | number } } | undefined;
    return {
      objectId,
      poster:        String(fields["poster"] ?? ""),
      targetCharId:  String(fields["target_char_id"] ?? ""),
      targetName:    String(fields["target_name"] ?? ""),
      rewardAmount:  BigInt(String(rewardField?.fields?.balance ?? fields["reward"] ?? 0)),
      rewardPerKill: BigInt(String(fields["reward_per_kill"] ?? 0)),
      bountyType:    numish(fields["bounty_type"]) ?? 0,
      killsClaimed:  numish(fields["kills_claimed"]) ?? 0,
      totalPaidOut:  BigInt(String(fields["total_paid_out"] ?? 0)),
      status:        numish(fields["status"]) ?? 0,
      createdMs:     numish(fields["created_ms"]) ?? 0,
      expiresMs:     numish(fields["expires_ms"]) ?? 0,
    };
  } catch { return null; }
}

async function fetchTrustlessBounties(): Promise<TrustlessBountyState[]> {
  if (!TRUSTLESS_BOUNTY_BOARD) return [];
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::trustless_bounty::BountyPosted` },
          null, 100, true,
        ],
      }),
    });
    const j = await res.json() as {
      result?: { data?: Array<{ parsedJson: Record<string, unknown> }> };
    };
    const events = j.result?.data ?? [];
    const bounties = await Promise.all(
      events.map(e => fetchTrustlessBountyObject(String(e.parsedJson["bounty_id"] ?? "")))
    );
    return bounties
      .filter((b): b is TrustlessBountyState => b !== null)
      .sort((a, b) => b.createdMs - a.createdMs);
  } catch { return []; }
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
      .map((n: { address: string; asMoveObject?: { contents?: { json?: Record<string, unknown> } } }) => {
        const j = (n.asMoveObject?.contents?.json ?? {}) as Record<string, unknown>;
        const killerId = (j.killer_id as { item_id?: string } | undefined)?.item_id ?? "";
        const victimId = (j.victim_id as { item_id?: string } | undefined)?.item_id ?? "";
        const lossType = (j.loss_type as { "@variant"?: string } | undefined)?.["@variant"] ?? "UNKNOWN";
        return {
          objectId: n.address,
          killerId,
          victimId,
          lossType,
          killTimestamp: parseInt(String(j.kill_timestamp ?? "0"), 10),
          solarSystemId: (j.solar_system_id as { item_id?: string } | undefined)?.item_id ?? "",
        };
      })
      .filter((k: OnChainKill) => k.victimId === targetCharId);
  } catch { return []; }
}

/** Fetch the connected wallet's Character objects. */
async function fetchWalletCharacters(walletAddress: string): Promise<CharacterObject[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getOwnedObjects",
        params: [
          walletAddress,
          {
            filter: { StructType: CHARACTER_TYPE },
            options: { showContent: true },
          },
          null, 10,
        ],
      }),
    });
    const j = await res.json() as {
      result?: {
        data?: Array<{
          data?: {
            objectId?: string;
            content?: { fields?: Record<string, unknown> };
          };
        }>;
      };
    };
    const items = j.result?.data ?? [];
    return items
      .map(item => {
        const d = item.data;
        if (!d?.objectId) return null;
        const fields = d.content?.fields ?? {};
        return {
          objectId: d.objectId,
          charId: String(fields["char_id"] ?? fields["id"] ?? ""),
        };
      })
      .filter((c): c is CharacterObject => c !== null);
  } catch { return []; }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

async function buildPostBountyTx(params: {
  targetCharId: number;
  targetName: string;
  mistAmount: bigint;
  bountyType: number;
  rewardPerKill: bigint;
  expiresMs: number;
  senderAddress: string;
}): Promise<Transaction> {
  const { targetCharId, targetName, mistAmount, bountyType, rewardPerKill, expiresMs, senderAddress } = params;

  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getCoins",
      params: [senderAddress, EVE_COIN_TYPE, null, 10],
    }),
  });
  const j = await res.json() as {
    result?: { data?: Array<{ coinObjectId: string; balance: string }> };
  };
  const coins = j.result?.data ?? [];
  if (coins.length === 0) throw new Error("No EVE coins in wallet. Acquire EVE first.");
  coins.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  const sourceCoin = coins[0];

  const tx = new Transaction();
  const [reward] = tx.splitCoins(tx.object(sourceCoin.coinObjectId), [tx.pure.u64(mistAmount)]);

  tx.moveCall({
    target: `${CRADLEOS_PKG}::trustless_bounty::post_bounty_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(TRUSTLESS_BOUNTY_BOARD),
      tx.pure.u64(BigInt(targetCharId)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(targetName))),
      reward,
      tx.pure.u8(bountyType),
      tx.pure.u64(rewardPerKill),
      tx.pure.u64(BigInt(expiresMs)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildClaimKillTx(bountyId: string, killmailObjectId: string, killerCharObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::trustless_bounty::claim_kill_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(bountyId),
      tx.object(killmailObjectId),
      tx.object(killerCharObjectId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

async function buildTopUpTx(bountyId: string, mistAmount: bigint, senderAddress: string): Promise<Transaction> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getCoins",
      params: [senderAddress, EVE_COIN_TYPE, null, 10],
    }),
  });
  const j = await res.json() as {
    result?: { data?: Array<{ coinObjectId: string; balance: string }> };
  };
  const coins = j.result?.data ?? [];
  if (coins.length === 0) throw new Error("No EVE coins in wallet.");
  coins.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  const sourceCoin = coins[0];

  const tx = new Transaction();
  const [topUp] = tx.splitCoins(tx.object(sourceCoin.coinObjectId), [tx.pure.u64(mistAmount)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::trustless_bounty::top_up_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(bountyId), topUp],
  });
  return tx;
}

function buildCancelBountyTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::trustless_bounty::cancel_bounty_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(bountyId), tx.object(CLOCK)],
  });
  return tx;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function BountyPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  // ── Post Bounty form state ────────────────────────────────────────────────
  const [postTargetCharId,  setPostTargetCharId]  = useState("");
  const [postTargetName,    setPostTargetName]    = useState("");
  const [postAmount,        setPostAmount]        = useState("");
  const [postRewardPerKill, setPostRewardPerKill] = useState("");
  const [postBountyType,    setPostBountyType]    = useState<number>(BOUNTY_TYPE_SHIP_SINGLE);
  const [postExpiryDays,    setPostExpiryDays]    = useState("7");
  const [postBusy,          setPostBusy]          = useState(false);
  const [postErr,           setPostErr]           = useState<string | null>(null);

  // ── Claim Kill state ──────────────────────────────────────────────────────
  const [claimBusy, setClaimBusy] = useState<Record<string, boolean>>({});
  const [claimErr,  setClaimErr]  = useState<Record<string, string | null>>({});

  // ── Top Up state ──────────────────────────────────────────────────────────
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({});
  const [topUpBusy,    setTopUpBusy]    = useState<Record<string, boolean>>({});
  const [topUpErr,     setTopUpErr]     = useState<Record<string, string | null>>({});

  // ── Cancel state ──────────────────────────────────────────────────────────
  const [cancelBusy, setCancelBusy] = useState<Record<string, boolean>>({});
  const [cancelErr,  setCancelErr]  = useState<Record<string, string | null>>({});

  // ── Kill evidence ─────────────────────────────────────────────────────────
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [killEvidence,     setKillEvidence]      = useState<OnChainKill[]>([]);
  const [evidenceLoading,  setEvidenceLoading]   = useState(false);

  // ── Wallet characters ─────────────────────────────────────────────────────
  const [walletChars, setWalletChars] = useState<CharacterObject[]>([]);

  const invalidate = useCallback(() => {
    [2500, 6000, 12000].forEach(d =>
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["trustless-bounties"] }), d)
    );
  }, [queryClient]);

  const { data: bounties, isLoading } = useQuery<TrustlessBountyState[]>({
    queryKey: ["trustless-bounties"],
    queryFn: fetchTrustlessBounties,
    enabled: !!TRUSTLESS_BOUNTY_BOARD,
    staleTime: 20_000,
  });

  const selectedBounty = (bounties ?? []).find(b => b.objectId === selectedBountyId) ?? null;

  // Load kill evidence when a bounty is selected
  useEffect(() => {
    if (!selectedBounty?.targetCharId) return;
    setEvidenceLoading(true);
    fetchKillsForTarget(String(selectedBounty.targetCharId))
      .then(kills => { setKillEvidence(kills); setEvidenceLoading(false); });
  }, [selectedBounty?.targetCharId]);

  // Load wallet characters when connected
  useEffect(() => {
    if (!account?.address) { setWalletChars([]); return; }
    fetchWalletCharacters(account.address).then(setWalletChars);
  }, [account?.address]);

  // ── Not deployed guard ─────────────────────────────────────────────────────

  if (!TRUSTLESS_BOUNTY_BOARD) {
    return (
      <div className="card" style={{
        textAlign: "center", padding: "40px 32px",
        background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.12)",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "10px", fontFamily: "monospace" }}>
          CONTRACT NOT YET DEPLOYED
        </div>
        <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "12px" }}>
          Set <code style={{ color: "#aaa" }}>TRUSTLESS_BOUNTY_BOARD</code> in{" "}
          <code style={{ color: "#aaa" }}>constants.ts</code> after deploying the trustless_bounty module.
        </div>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePostBounty = async () => {
    if (!account) return;
    const charId  = parseInt(postTargetCharId, 10);
    const amount  = parseFloat(postAmount);
    const days    = parseFloat(postExpiryDays) || 7;
    if (!charId || !postTargetName.trim() || !amount) {
      setPostErr("Fill in all required fields."); return;
    }
    const perKill = isPerKill(postBountyType);
    const rewardPerKillAmt = perKill ? parseFloat(postRewardPerKill) : amount;
    if (perKill && (!postRewardPerKill || rewardPerKillAmt <= 0)) {
      setPostErr("Enter a reward per kill amount for per-kill bounties."); return;
    }
    setPostBusy(true); setPostErr(null);
    try {
      const mistAmount     = eveToMist(amount);
      const mistPerKill    = eveToMist(rewardPerKillAmt);
      const expiresMs      = Date.now() + Math.round(days * 24 * 60 * 60 * 1000);
      const tx = await buildPostBountyTx({
        targetCharId: charId,
        targetName: postTargetName.trim(),
        mistAmount,
        bountyType: postBountyType,
        rewardPerKill: mistPerKill,
        expiresMs,
        senderAddress: account.address,
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setPostTargetCharId(""); setPostTargetName(""); setPostAmount("");
      setPostRewardPerKill(""); setPostExpiryDays("7");
      invalidate();
    } catch (e) { setPostErr(normalizeChainError(e)); }
    finally { setPostBusy(false); }
  };

  const handleClaimKill = async (bounty: TrustlessBountyState, killmail: OnChainKill) => {
    if (!account) return;
    const key = `${bounty.objectId}:${killmail.objectId}`;
    if (walletChars.length === 0) {
      setClaimErr(prev => ({ ...prev, [key]: "No Character found in your wallet." })); return;
    }
    const killerChar = walletChars[0];
    setClaimBusy(prev => ({ ...prev, [key]: true }));
    setClaimErr(prev => ({ ...prev, [key]: null }));
    try {
      const tx = buildClaimKillTx(bounty.objectId, killmail.objectId, killerChar.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) {
      setClaimErr(prev => ({ ...prev, [key]: normalizeChainError(e) }));
    } finally {
      setClaimBusy(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleTopUp = async (bounty: TrustlessBountyState) => {
    if (!account) return;
    const amount = parseFloat(topUpAmounts[bounty.objectId] ?? "");
    if (!amount || amount <= 0) {
      setTopUpErr(prev => ({ ...prev, [bounty.objectId]: "Enter top-up amount." })); return;
    }
    setTopUpBusy(prev => ({ ...prev, [bounty.objectId]: true }));
    setTopUpErr(prev => ({ ...prev, [bounty.objectId]: null }));
    try {
      const tx = await buildTopUpTx(bounty.objectId, eveToMist(amount), account.address);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTopUpAmounts(prev => ({ ...prev, [bounty.objectId]: "" }));
      invalidate();
    } catch (e) {
      setTopUpErr(prev => ({ ...prev, [bounty.objectId]: normalizeChainError(e) }));
    } finally {
      setTopUpBusy(prev => ({ ...prev, [bounty.objectId]: false }));
    }
  };

  const handleCancelBounty = async (bounty: TrustlessBountyState) => {
    setCancelBusy(prev => ({ ...prev, [bounty.objectId]: true }));
    setCancelErr(prev => ({ ...prev, [bounty.objectId]: null }));
    try {
      const tx = buildCancelBountyTx(bounty.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) {
      setCancelErr(prev => ({ ...prev, [bounty.objectId]: normalizeChainError(e) }));
    } finally {
      setCancelBusy(prev => ({ ...prev, [bounty.objectId]: false }));
    }
  };

  const now = Date.now();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", fontFamily: "monospace" }}>
          TRUSTLESS BOUNTY BOARD
        </div>
      </div>
      <div style={{
        color: "#00ff96", fontSize: "11px", fontFamily: "monospace",
        letterSpacing: "0.07em", marginBottom: "20px", opacity: 0.85,
      }}>
        ✓ TRUSTLESS — verified by on-chain killmail
      </div>

      {/* Post Bounty form */}
      {account && (
        <div style={{
          marginBottom: "24px", padding: "16px",
          background: "rgba(255,71,0,0.04)", border: "1px solid rgba(255,71,0,0.15)", borderRadius: "0",
        }}>
          <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "14px", letterSpacing: "0.06em" }}>
            POST BOUNTY
          </div>

          {/* Bounty Type Picker */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.05em", marginBottom: "8px" }}>
              BOUNTY TYPE
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                { type: BOUNTY_TYPE_SHIP_SINGLE,      label: "🚀 Ship (Single)"     },
                { type: BOUNTY_TYPE_STRUCTURE_SINGLE, label: "🏗️ Structure (Single)" },
                { type: BOUNTY_TYPE_PER_SHIP,         label: "🚀 Per Ship Kill"      },
                { type: BOUNTY_TYPE_PER_STRUCTURE,    label: "🏗️ Per Structure Kill" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setPostBountyType(type)}
                  style={{
                    background: postBountyType === type ? "rgba(255,71,0,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${postBountyType === type ? "#FF4700" : "rgba(255,255,255,0.1)"}`,
                    color: postBountyType === type ? "#FF4700" : "#999",
                    borderRadius: "0", fontSize: "11px", padding: "5px 12px",
                    cursor: "pointer", fontFamily: "monospace", fontWeight: postBountyType === type ? 700 : 400,
                    transition: "all 0.1s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target fields */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>TARGET CHAR ID</span>
              <input
                type="number"
                value={postTargetCharId}
                onChange={e => setPostTargetCharId(e.target.value)}
                placeholder="90000001"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "140px" }}>
              <span style={labelStyle}>TARGET NAME</span>
              <input
                type="text"
                value={postTargetName}
                onChange={e => setPostTargetName(e.target.value)}
                placeholder="Vaultbreaker Rex"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>REWARD POOL (EVE)</span>
              <input
                type="number"
                value={postAmount}
                onChange={e => setPostAmount(e.target.value)}
                placeholder="100"
                min="0"
                style={inputStyle}
              />
            </div>
            {isPerKill(postBountyType) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={labelStyle}>REWARD PER KILL (EVE)</span>
                <input
                  type="number"
                  value={postRewardPerKill}
                  onChange={e => setPostRewardPerKill(e.target.value)}
                  placeholder="10"
                  min="0"
                  style={inputStyle}
                />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>EXPIRY (DAYS)</span>
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

      {/* Bounty List */}
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
            const isPoster  = !!account && account.address.toLowerCase() === bounty.poster.toLowerCase();
            const isExpired = now >= bounty.expiresMs;
            const canCancel = bounty.status === STATUS_OPEN && (isPoster || isExpired);
            const canTopUp  = isPerKill(bounty.bountyType) &&
                              (bounty.status === STATUS_OPEN || bounty.status === STATUS_DRAINED) &&
                              isPoster;
            const isSelected = selectedBountyId === bounty.objectId;
            const typeInfo = bountyTypeLabel(bounty.bountyType);
            const remaining = poolRemaining(bounty);

            return (
              <div
                key={bounty.objectId}
                onClick={() => setSelectedBountyId(id => id === bounty.objectId ? null : bounty.objectId)}
                style={{
                  padding: "14px",
                  cursor: "pointer",
                  background: bounty.status === STATUS_OPEN
                    ? "rgba(255,71,0,0.04)"
                    : bounty.status === STATUS_CLAIMED
                      ? "rgba(0,255,150,0.03)"
                      : bounty.status === STATUS_DRAINED
                        ? "rgba(255,204,0,0.03)"
                        : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    bounty.status === STATUS_OPEN      ? "rgba(255,71,0,0.2)"    :
                    bounty.status === STATUS_CLAIMED   ? "rgba(0,255,150,0.15)"  :
                    bounty.status === STATUS_DRAINED   ? "rgba(255,204,0,0.2)"   :
                    "rgba(255,255,255,0.07)"
                  }`,
                  borderRadius: "0",
                }}
              >
                {/* Top row: type badge + target + status */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {/* Bounty type badge */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    background: "rgba(255,71,0,0.1)", border: "1px solid rgba(255,71,0,0.25)",
                    padding: "3px 8px", borderRadius: "0", lineHeight: 1.2,
                  }}>
                    <span style={{ fontSize: "14px" }}>{typeInfo.icon}</span>
                    <span style={{ color: "#FF4700", fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em", fontFamily: "monospace" }}>
                      {typeInfo.main}
                    </span>
                    <span style={{ color: "rgba(255,71,0,0.6)", fontSize: "8px", fontFamily: "monospace" }}>
                      {typeInfo.sub}
                    </span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px", fontFamily: "monospace" }}>
                      {bounty.targetName}
                    </span>
                    <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", fontFamily: "monospace", marginLeft: "8px" }}>
                      #{bounty.targetCharId}
                    </span>
                  </div>

                  <span style={{
                    padding: "2px 10px", borderRadius: "2px",
                    fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
                    color: statusColor(bounty.status),
                    background: bounty.status === STATUS_OPEN
                      ? "rgba(255,71,0,0.12)"
                      : bounty.status === STATUS_CLAIMED
                        ? "rgba(0,255,150,0.1)"
                        : bounty.status === STATUS_DRAINED
                          ? "rgba(255,204,0,0.1)"
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
                    <span style={detailLabelStyle}>POOL </span>
                    <span style={{ color: "#FF4700", fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>
                      {formatEve(bounty.rewardAmount)}
                    </span>
                  </div>
                  {isPerKill(bounty.bountyType) && (
                    <>
                      <div>
                        <span style={detailLabelStyle}>PER KILL </span>
                        <span style={{ color: "#ffcc00", fontSize: "12px", fontWeight: 700, fontFamily: "monospace" }}>
                          {formatEve(bounty.rewardPerKill)}
                        </span>
                      </div>
                      <div>
                        <span style={detailLabelStyle}>KILLS </span>
                        <span style={{ color: "#aaa", fontSize: "12px", fontFamily: "monospace" }}>
                          {bounty.killsClaimed} claimed
                        </span>
                      </div>
                      <div>
                        <span style={detailLabelStyle}>REMAINING </span>
                        <span style={{ color: remaining > 0n ? "#00ff96" : "#ff6432", fontSize: "12px", fontFamily: "monospace" }}>
                          {formatEve(remaining)}
                        </span>
                      </div>
                    </>
                  )}
                  <div>
                    <span style={detailLabelStyle}>POSTED BY </span>
                    <span style={{ color: "#aaa", fontSize: "11px", fontFamily: "monospace" }}>
                      {shortAddr(bounty.poster)}
                      {isPoster && <span style={{ color: "#FF4700", marginLeft: "4px", fontSize: "10px" }}>(you)</span>}
                    </span>
                  </div>
                  <div>
                    <span style={detailLabelStyle}>EXPIRES </span>
                    <span style={{
                      color: isExpired ? "#ff6432" : "rgba(107,107,94,0.7)",
                      fontSize: "11px", fontFamily: "monospace",
                    }}>
                      {new Date(bounty.expiresMs).toLocaleDateString()}
                      {isExpired && bounty.status === STATUS_OPEN && " (EXPIRED)"}
                    </span>
                  </div>
                </div>

                {/* Kill Evidence — shown when selected */}
                {isSelected && (
                  <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    <div style={{
                      color: "#aaa", fontWeight: 700, fontSize: "11px",
                      letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6,
                    }}>
                      Kill Evidence
                    </div>
                    {evidenceLoading ? (
                      <div style={{ color: "rgba(180,180,160,0.6)", fontSize: 11 }}>Searching on-chain killmails…</div>
                    ) : killEvidence.length === 0 ? (
                      <div style={{ color: "rgba(180,180,160,0.6)", fontSize: 11 }}>No on-chain kills found for this target yet.</div>
                    ) : (
                      killEvidence.map(k => {
                        const claimKey = `${bounty.objectId}:${k.objectId}`;
                        const canClaimThisKill = account &&
                          bounty.status === STATUS_OPEN &&
                          (isPerKill(bounty.bountyType) ||
                           (bounty.bountyType === BOUNTY_TYPE_SHIP_SINGLE && k.lossType === "SHIP") ||
                           (bounty.bountyType === BOUNTY_TYPE_STRUCTURE_SINGLE && k.lossType !== "SHIP"));
                        return (
                          <div key={k.objectId} style={{
                            background: "rgba(255,71,0,0.06)", border: "1px solid rgba(255,71,0,0.2)",
                            padding: "8px 10px", marginBottom: 6, fontSize: 11,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                              <span style={{ color: k.lossType === "SHIP" ? "#FF4700" : "#ff4444", fontWeight: 700, fontSize: 12 }}>
                                {k.lossType === "SHIP" ? "🚀" : "🏗️"} {k.lossType}
                              </span>
                              <span style={{ color: "rgba(180,180,160,0.6)" }}>
                                {new Date(k.killTimestamp * 1000).toUTCString().slice(0, 22)}
                              </span>
                            </div>
                            <div style={{ color: "rgba(180,180,160,0.6)", marginBottom: 2 }}>
                              killer: <span style={{ color: "#00ff96", fontFamily: "monospace" }}>{k.killerId}</span>
                            </div>
                            <div style={{ color: "rgba(180,180,160,0.6)", marginBottom: 4 }}>
                              system: {k.solarSystemId}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 10, color: "rgba(180,180,160,0.4)", fontFamily: "monospace" }}>
                                {k.objectId.slice(0, 20)}…
                              </span>
                              <button
                                style={{ background: "transparent", border: "none", color: "#FF4700", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
                                onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(k.objectId); }}
                              >copy</button>
                            </div>
                            {canClaimThisKill && (
                              <div style={{ marginTop: 8 }}>
                                {walletChars.length === 0 ? (
                                  <span style={{ color: "rgba(107,107,94,0.6)", fontSize: 10 }}>
                                    No Character found in your wallet to claim.
                                  </span>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button
                                      onClick={() => handleClaimKill(bounty, k)}
                                      disabled={claimBusy[claimKey] ?? false}
                                      style={{
                                        background: "rgba(0,255,150,0.1)",
                                        border: "1px solid rgba(0,255,150,0.3)",
                                        color: "#00ff96", borderRadius: "0",
                                        fontSize: "11px", padding: "5px 14px",
                                        cursor: "pointer", fontFamily: "monospace",
                                      }}
                                    >
                                      {claimBusy[claimKey] ? "Claiming…" : "Claim Bounty"}
                                    </button>
                                    <span style={{ color: "rgba(107,107,94,0.6)", fontSize: 10, fontFamily: "monospace" }}>
                                      using char {shortAddr(walletChars[0].objectId)}
                                    </span>
                                  </div>
                                )}
                                {claimErr[claimKey] && (
                                  <div style={{ color: "#ff6432", fontSize: 10, marginTop: 4 }}>⚠ {claimErr[claimKey]}</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Top Up (per-kill bounties, poster only) */}
                {canTopUp && (
                  <div
                    style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "10px" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", fontFamily: "monospace" }}>TOP UP:</span>
                    <input
                      type="number"
                      value={topUpAmounts[bounty.objectId] ?? ""}
                      onChange={e => setTopUpAmounts(prev => ({ ...prev, [bounty.objectId]: e.target.value }))}
                      placeholder="EVE amount"
                      style={{ ...inputStyle, width: "110px" }}
                    />
                    <button
                      onClick={() => handleTopUp(bounty)}
                      disabled={topUpBusy[bounty.objectId] ?? false}
                      style={{
                        background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.3)",
                        color: "#ffcc00", borderRadius: "0", fontSize: "11px",
                        padding: "5px 14px", cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      {topUpBusy[bounty.objectId] ? "Topping up…" : "Top Up"}
                    </button>
                    {topUpErr[bounty.objectId] && (
                      <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {topUpErr[bounty.objectId]}</span>
                    )}
                  </div>
                )}

                {/* Cancel */}
                {canCancel && (
                  <div
                    style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleCancelBounty(bounty)}
                      disabled={cancelBusy[bounty.objectId] ?? false}
                      style={{
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                        color: "#888", borderRadius: "0", fontSize: "11px",
                        padding: "4px 14px", cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      {cancelBusy[bounty.objectId] ? "Cancelling…" : "Cancel Bounty"}
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
          Connect wallet to post bounties or claim kills
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

const labelStyle: React.CSSProperties = {
  color: "rgba(107,107,94,0.7)",
  fontSize: "10px",
  letterSpacing: "0.05em",
};

const detailLabelStyle: React.CSSProperties = {
  color: "rgba(107,107,94,0.55)",
  fontSize: "10px",
  letterSpacing: "0.05em",
};
