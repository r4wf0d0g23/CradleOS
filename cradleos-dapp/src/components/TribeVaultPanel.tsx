/**
 * TribeVaultPanel — Tribe cryptocurrency management.
 *
 * Flow:
 * 1. No vault found → "Launch Tribe Token" (tribe_id auto-read from character on-chain)
 * 2. Vault ID not cached → "Connect Vault" (paste object ID from launch tx)
 * 3. Vault live → dashboard: token stats, issue token (founder only), activity log
 */
import React, { useState, Component, type ReactNode, type ErrorInfo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { useDevOverrides } from "../contexts/DevModeContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import {
  fetchCharacterTribeId,
  fetchTribeVault,
  fetchMemberBalance,
  fetchRegisteredInfraIds,
  fetchCoinIssuedEvents,
  buildLaunchCoinTransaction,
  buildIssueCoinTransaction,
  buildRegisterStructureTransaction,
  buildDeregisterStructureTransaction,
  buildTransferCoinsTransaction,
  fetchPlayerStructures,
  fetchTribeInfo,
  getCachedVaultId,
  setCachedVaultId,
  fetchCollateralVault,
  buildCreateCollateralVaultTx,
  buildMintWithCollateralTx,
  buildDepositCollateralTx,
  buildDrainCollateralTx,
  buildResetAccountingTx,
  buildMintFromCollateralTx,
  buildBurnCoinTransaction,
  buildRedeemTx,
  buildSetMintRatioTx,
  fetchEveBalance,

  type TribeVaultState,
  type CoinIssuedEvent,
  type PlayerStructure,
  type CollateralVaultState,
} from "../lib";
import { SUI_TESTNET_RPC, CRADLEOS_ORIGINAL } from "../constants";
import { TribeDexPanel } from "./TribeDexPanel";

// ── Error boundary ────────────────────────────────────────────────────────────

class VaultErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
    return { error: msg };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[VaultPanel] render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ border: "1px solid rgba(255,80,50,0.4)", padding: "24px" }}>
          <div style={{ color: "#ff6432", fontWeight: 700, marginBottom: "8px" }}>⚠ Vault Panel Error</div>
          <pre style={{ color: "#aaa", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {this.state.error}
          </pre>
          <button
            className="accent-button"
            style={{ marginTop: "12px" }}
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Fetch the first shared object created by a tx (fallback when wallet omits effects). */
async function fetchCreatedSharedFromDigest(digest: string): Promise<string | null> {
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
    const json = await res.json() as { result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } } };
    const created = json.result?.effects?.created ?? [];
    const shared = created.find(c => c.owner && typeof c.owner === "object" && "Shared" in (c.owner as object));
    return shared?.reference?.objectId ?? null;
  } catch { return null; }
}

/** Discover an existing TribeVault for a wallet by querying CoinLaunched events. */
/** Discover the canonical vault for a tribe by tribeId. Prefers vaults with non-empty name. */
async function discoverVaultIdFromChain(tribeId: number): Promise<string | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` },
          null, 50, true,  // descending=true → newest vault first
        ],
      }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: { vault_id?: string; tribe_id?: string | number; coin_name?: string; founder?: string } }> } };
    const events = json.result?.data ?? [];
    // Filter to matching tribe
    const tribeVaults = events.filter(e => Number(e.parsedJson?.tribe_id) === tribeId);
    // Prefer vault with a non-empty coin name (the "real" launch), fall back to first
    const named = tribeVaults.find(e => (e.parsedJson?.coin_name ?? "").length > 0);
    const best = named ?? tribeVaults[0];
    return best?.parsedJson?.vault_id ?? null;
  } catch { return null; }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function extractCreatedShared(result: unknown): string[] {
  try {
    const effects = (result as Record<string, unknown>)["effects"] as Record<string, unknown>;
    const created = (effects?.["created"] ?? (result as Record<string, unknown>)["created"]) as
      Array<{ reference?: { objectId: string }; objectId?: string; owner?: unknown }> | undefined;
    return (created ?? [])
      .filter(c => {
        const o = c.owner;
        return o && typeof o === "object" && "Shared" in (o as object);
      })
      .map(c => c.reference?.objectId ?? c.objectId ?? "")
      .filter(Boolean);
  } catch { return []; }
}

/** Tribe tokens have 9 decimal places — divide raw on-chain value for human display. */
const TOKEN_DECIMALS = 1_000_000_000;
function fmtToken(raw: number): string {
  return (raw / TOKEN_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#131313",
      border: "1px solid rgba(255,71,0,0.18)",
      borderRadius: "0",
      padding: "14px 18px",
      minWidth: "130px",
      flex: 1,
    }}>
      <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#FF4700", fontSize: "20px", fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function EventRow({ ev }: { ev: CoinIssuedEvent }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "12px",
    }}>
      <span style={{ color: "#00ff96", minWidth: "18px" }}>▲</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ color: "#00ff96", fontWeight: 600 }}>+{ev.amount.toLocaleString()}</span>
          <span style={{ color: "#888", fontFamily: "monospace", fontSize: "11px" }}>
            {shortAddr(ev.recipient)}
          </span>
          <span style={{ marginLeft: "auto", color: "rgba(107,107,94,0.55)" }}>
            {new Date(ev.timestampMs).toLocaleTimeString()}
          </span>
        </div>
        {ev.reason && (
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginTop: "2px" }}>
            "{ev.reason}"
          </div>
        )}
      </div>
    </div>
  );
}

// ── Launch form ───────────────────────────────────────────────────────────────

function LaunchCoinForm({ onSuccess }: { onSuccess: () => void }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [coinName, setCoinName] = useState("");
  const [coinSymbol, setCoinSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // After tx is sent: show a paste-vault-ID field in case auto-detect fails
  const [txSent, setTxSent] = useState(false);
  const [pasteId, setPasteId] = useState("");

  const { data: tribeId, isLoading: tribeLoading } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : null,
    enabled: !!account?.address,
  });

  const handleLaunch = async () => {
    if (!account || !tribeId || !coinName.trim() || !coinSymbol.trim()) return;
    setBusy(true); setErr(null);
    try {
      // Direct vault creation — no registry needed on the new chain
      const tx = buildLaunchCoinTransaction(tribeId, coinName.trim(), coinSymbol.trim().toUpperCase());
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Try inline effects first (fast path)
      let vaultId: string | null = null;
      const sharedIds = extractCreatedShared(result);
      if (sharedIds.length > 0) {
        vaultId = sharedIds[0];
      } else {
        // Fallback: fetch full tx block from RPC using the digest
        const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
        if (digest) {
          vaultId = await fetchCreatedSharedFromDigest(digest);
        }
      }

      if (vaultId) {
        setCachedVaultId(tribeId, vaultId);
        // Give the indexer time to catch up before re-fetching
        setTimeout(() => onSuccess(), 4000);
      } else {
        console.warn("[CradleOS] Could not auto-detect vault ID — showing paste prompt");
        // Show paste prompt so user can recover; also retry discovery in background
        setTxSent(true);
        setTimeout(async () => {
          const discovered = await discoverVaultIdFromChain(tribeId);
          if (discovered && tribeId) {
            setCachedVaultId(tribeId, discovered);
            onSuccess();
          }
        }, 6000);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: "#161616",
    border: "1px solid rgba(255,71,0,0.30)",
    borderRadius: "2px",
    color: "#FF4700",
    fontSize: "14px",
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div className="card" style={{ maxWidth: "460px" }}>
      <h3 style={{ color: "#FF4700", marginBottom: "4px" }}>LAUNCH TRIBE TOKEN</h3>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "18px" }}>
        Create an on-chain cryptocurrency for your tribe. Your wallet's in-game character
        determines your tribe — enter a name and symbol, then launch.
      </p>

      {/* Tribe ID display */}
      {tribeLoading ? (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "14px" }}>
          Reading tribe from chain…
        </div>
      ) : tribeId == null ? (
        <div style={{ color: "#ff6432", fontSize: "13px", marginBottom: "14px" }}>
          ⚠ No character found for this wallet.
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "2px",
          padding: "10px 14px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <div>
            <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.06em" }}>TRIBE</div>
            <div style={{ color: "#FF4700", fontWeight: 700, fontFamily: "monospace" }}>{tribeId}</div>
          </div>
          <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "18px" }}>→</div>
          <div style={{ color: "#888", fontSize: "12px" }}>
            Token will be bound to this tribe permanently
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <div style={{ flex: 2 }}>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "4px" }}>TOKEN NAME</div>
          <input
            value={coinName}
            onChange={e => setCoinName(e.target.value)}
            placeholder="e.g. Reapers Token"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "4px" }}>SYMBOL</div>
          <input
            value={coinSymbol}
            onChange={e => setCoinSymbol(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="REAP"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </div>
      </div>

      {/* ── Claim status ── */}
      {tribeId != null && (
        <div style={{
          marginBottom: "14px", padding: "12px 14px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0",
        }}>
          <div style={{ color: "#00ff96", fontSize: "12px" }}>
            ✓ Tribe #{tribeId} detected — ready to launch
          </div>
        </div>
      )}

      <button
        className="accent-button"
        onClick={handleLaunch}
        disabled={busy || txSent || !tribeId || !coinName.trim() || !coinSymbol.trim() || !account}
        style={{ width: "100%", padding: "11px", marginTop: "4px" }}
      >
        {busy ? "Launching…" : `🚀 Launch ${coinSymbol.trim() || "COIN"} for Tribe ${tribeId ?? "…"}`}
      </button>
      {err && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {err}</div>}

      {/* Post-launch: tx sent but vault ID not auto-detected yet */}
      {txSent && (
        <div style={{
          marginTop: "16px", padding: "14px",
          background: "#131313", border: "1px solid rgba(255,71,0,0.25)", borderRadius: "0",
        }}>
          <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
            ✓ Transaction sent — looking up vault…
          </div>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "10px" }}>
            Auto-detecting vault ID. If it doesn't load in ~10 seconds, paste the vault object ID
            from the Sui explorer link in your wallet.
          </div>
          <input
            value={pasteId}
            onChange={e => setPasteId(e.target.value.trim())}
            placeholder="0x… TribeVault object ID"
            style={{
              width: "100%", background: "#161616",
              border: "1px solid rgba(255,71,0,0.30)", borderRadius: "2px",
              color: "#FF4700", fontSize: "12px", padding: "8px 10px",
              outline: "none", boxSizing: "border-box", fontFamily: "monospace",
              marginBottom: "8px",
            }}
          />
          <button
            className="accent-button"
            onClick={() => {
              if (pasteId && tribeId) {
                setCachedVaultId(tribeId, pasteId);
                onSuccess();
              }
            }}
            disabled={!pasteId || !tribeId}
            style={{ padding: "7px 18px", fontSize: "12px" }}
          >
            Connect Vault
          </button>
        </div>
      )}
    </div>
  );
}

// ── Connect vault form ────────────────────────────────────────────────────────

function ConnectVaultForm({ tribeId, onConnect }: { tribeId: number; onConnect: (id: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="card" style={{ maxWidth: "460px" }}>
      <h3 style={{ color: "#FF4700", marginBottom: "8px" }}>Connect Tribe Vault</h3>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "12px" }}>
        Vault launched. Enter the TribeVault object ID (from the launch tx in Sui explorer).
      </p>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="0x… vault object ID"
        style={{
          width: "100%", background: "#161616",
          border: "1px solid rgba(255,71,0,0.30)", borderRadius: "2px",
          color: "#FF4700", fontSize: "12px", padding: "9px 12px",
          outline: "none", marginBottom: "10px", boxSizing: "border-box",
          fontFamily: "monospace",
        }}
      />
      <button
        className="accent-button"
        onClick={() => { if (value.trim()) { setCachedVaultId(tribeId, value.trim()); onConnect(value.trim()); } }}
        disabled={!value.trim()}
        style={{ width: "100%", padding: "9px" }}
      >
        Connect
      </button>
    </div>
  );
}

// ── Issue From Capacity Form ─────────────────────────────────────────────────

function IssueFromCapacityForm({ vault, cv, onTxSuccess }: { vault: TribeVaultState; cv: CollateralVaultState; onTxSuccess: () => void }) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const [amt, setAmt] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const availableRaw = Math.max(0, cv.collateralBalance * cv.mintRatio - vault.totalSupply);

  const handleIssue = async () => {
    if (!account) return;
    setBusy(true); setErr(null);
    try {
      const amtHuman = parseFloat(amt);
      if (!amtHuman || amtHuman <= 0) throw new Error("Invalid amount");
      const amtRaw = BigInt(Math.floor(amtHuman * TOKEN_DECIMALS));
      if (amtRaw > BigInt(Math.floor(availableRaw))) throw new Error(`Exceeds available capacity (${fmtToken(availableRaw)} ${vault.coinSymbol})`);
      const to = recipient.trim() || account.address;
      const tx = buildMintFromCollateralTx(cv.objectId, vault.objectId, amtRaw, to);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setAmt(""); setRecipient("");
      setTimeout(onTxSuccess, 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const iStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "0", color: "#fff", fontSize: "12px", padding: "6px 10px", outline: "none",
    fontFamily: "monospace",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)}
          placeholder={`${vault.coinSymbol} to issue`} min="0"
          style={{ ...iStyle, width: "140px", borderColor: "rgba(0,200,255,0.3)", color: "#00ccff" }} />
        <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)}
          placeholder="Recipient (default: you)"
          style={{ ...iStyle, flex: 1, minWidth: "180px" }} />
        <button className="accent-button" onClick={handleIssue} disabled={busy || !amt}
          style={{ background: "rgba(0,200,255,0.12)", borderColor: "#00ccff40", color: "#00ccff" }}>
          {busy ? "…" : "Issue"}
        </button>
      </div>
      {err && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {err}</div>}
    </div>
  );
}

// ── Collateral Vault Card ─────────────────────────────────────────────────────

function CollateralVaultCard({
  vault,
  onTxSuccess,
}: {
  vault: TribeVaultState;
  onTxSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  // Invalidate all vault-related caches after every tx
  const onTxSuccessWithRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["eveBalance"] });
    queryClient.invalidateQueries({ queryKey: ["collateralVault"] });
    queryClient.invalidateQueries({ queryKey: ["tribeVault"] });
    onTxSuccess();
  };
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const { overrideIsFounder } = useDevOverrides();
  const isFounder = overrideIsFounder(!!(account?.address && vault.founder &&
    account.address.toLowerCase() === vault.founder.toLowerCase()));

  const { data: cv, isLoading: cvLoading } = useQuery<CollateralVaultState | null>({
    queryKey: ["collateralVault", vault.objectId],
    queryFn: () => fetchCollateralVault(vault.objectId),
    staleTime: 5_000,
  });

  const { data: eveBalanceData } = useQuery({
    queryKey: ["eveBalance", account?.address],
    queryFn: () => account ? fetchEveBalance(account.address) : Promise.resolve({ balance: 0, coinId: null, allCoinIds: [] }),
    enabled: !!account?.address,
    staleTime: 5_000,
  });

  // Create vault state
  const [mintRatioInput, setMintRatioInput] = useState("100");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Mint state
  const [mintEveAmt, setMintEveAmt] = useState("");
  const [mintRecipient, setMintRecipient] = useState("");
  const [mintBusy, setMintBusy] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);

  // Deposit state
  const [depositAmt, setDepositAmt] = useState("");
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositErr, setDepositErr] = useState<string | null>(null);

  // Change ratio state
  const [newRatioInput, setNewRatioInput] = useState("");
  const [ratioUpdateBusy, setRatioUpdateBusy] = useState(false);
  const [ratioErr, setRatioErr] = useState<string | null>(null);

  // Redeem state
  const [redeemAmt, setRedeemAmt] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemErr, setRedeemErr] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    background: "#161616",
    border: "1px solid rgba(0,255,150,0.25)",
    borderRadius: "2px",
    color: "#00ff96",
    fontSize: "13px",
    padding: "8px 11px",
    outline: "none",
    boxSizing: "border-box",
  };

  const isFounderForCV = !!(account?.address && vault.founder &&
    account.address.toLowerCase() === vault.founder.toLowerCase());

  const handleCreateVault = async () => {
    if (!account) return;
    if (!isFounderForCV) {
      setCreateErr("Only the vault founder can create the collateral vault. Connected wallet is not the founder.");
      return;
    }
    setCreateBusy(true); setCreateErr(null);
    try {
      const ratio = parseInt(mintRatioInput, 10);
      if (!ratio || ratio < 1) throw new Error("Invalid mint ratio");
      const tx = buildCreateCollateralVaultTx(vault.objectId, ratio);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCreateErr(msg.includes("MoveAbort") ? "Transaction aborted — are you the vault founder?" : msg);
    } finally { setCreateBusy(false); }
  };

  const handleMint = async () => {
    if (!account || !cv) return;
    setMintBusy(true); setMintErr(null);
    try {
      const eveRaw = Math.floor(parseFloat(mintEveAmt) * 1e9);
      if (!eveRaw || eveRaw < 1) throw new Error("Invalid EVE amount");
      if (!mintRecipient.trim()) throw new Error("Recipient required");
      const coinIds = eveBalanceData?.allCoinIds ?? [];
      if (!coinIds.length) throw new Error("No EVE coin objects found in wallet");
      const tx = buildMintWithCollateralTx(cv.objectId, vault.objectId, coinIds, mintRecipient.trim(), BigInt(eveRaw));
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setMintEveAmt(""); setMintRecipient("");
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setMintErr(e instanceof Error ? e.message : String(e));
    } finally { setMintBusy(false); }
  };

  const handleDeposit = async () => {
    if (!account || !cv) return;
    setDepositBusy(true); setDepositErr(null);
    try {
      if (!depositAmt || parseFloat(depositAmt) <= 0) throw new Error("Invalid amount");
      const depositRaw = BigInt(Math.floor(parseFloat(depositAmt) * 1e9));
      const coinIds = eveBalanceData?.allCoinIds ?? [];
      if (!coinIds.length) throw new Error("No EVE coin objects found in wallet");
      const tx = buildDepositCollateralTx(cv.objectId, coinIds, depositRaw);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDepositAmt("");
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setDepositErr(e instanceof Error ? e.message : String(e));
    } finally { setDepositBusy(false); }
  };

  const handleUpdateRatio = async () => {
    if (!account || !cv) return;
    setRatioUpdateBusy(true); setRatioErr(null);
    try {
      const ratio = parseInt(newRatioInput, 10);
      if (!ratio || ratio < 1) throw new Error("Invalid ratio");
      const tx = buildSetMintRatioTx(cv.objectId, vault.objectId, ratio);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setNewRatioInput("");
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setRatioErr(e instanceof Error ? e.message : String(e));
    } finally { setRatioUpdateBusy(false); }
  };

  const handleRedeem = async () => {
    if (!account || !cv) return;
    setRedeemBusy(true); setRedeemErr(null);
    try {
      const amt = parseInt(redeemAmt, 10);
      if (!amt || amt < 1) throw new Error("Invalid amount");
      const tx = buildRedeemTx(cv.objectId, vault.objectId, amt);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setRedeemAmt("");
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setRedeemErr(e instanceof Error ? e.message : String(e));
    } finally { setRedeemBusy(false); }
  };

  const [burnAllBusy, setBurnAllBusy] = useState(false);
  const [burnAllErr, setBurnAllErr] = useState<string | null>(null);
  const handleBurnAll = async () => {
    if (!account || !vault) return;
    setBurnAllBusy(true); setBurnAllErr(null);
    try {
      const supply = Number(vault.totalSupply ?? 0);
      if (!supply) throw new Error("No tokens in circulation");
      // burn_coin_entry: founder burns tokens from a member address
      const tx = buildBurnCoinTransaction(vault.objectId, account.address, supply);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setBurnAllErr(e instanceof Error ? e.message : String(e));
    } finally { setBurnAllBusy(false); }
  };

  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const handleResetAccounting = async () => {
    if (!account || !cv) return;
    setResetBusy(true); setResetErr(null);
    try {
      const tx = buildResetAccountingTx(cv.objectId, vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setResetErr(e instanceof Error ? e.message : String(e));
    } finally { setResetBusy(false); }
  };

  const [drainBusy, setDrainBusy] = useState(false);
  const [drainErr, setDrainErr] = useState<string | null>(null);
  const handleDrain = async () => {
    if (!account || !cv) return;
    setDrainBusy(true); setDrainErr(null);
    try {
      const tx = buildDrainCollateralTx(cv.objectId, vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(onTxSuccessWithRefresh, 3000);
    } catch (e) {
      setDrainErr(e instanceof Error ? e.message : String(e));
    } finally { setDrainBusy(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(0,255,150,0.04)",
    border: "1px solid rgba(0,255,150,0.22)",
    borderRadius: "0",
    padding: "16px",
    marginBottom: "20px",
  };

  if (cvLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ color: "rgba(0,255,150,0.5)", fontSize: "12px" }}>Checking collateral vault…</div>
      </div>
    );
  }

  // No collateral vault yet — show init card (founder only)
  if (!cv) {
    if (!isFounder) return null;
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span style={{
            background: "rgba(0,255,150,0.12)", border: "1px solid rgba(0,255,150,0.3)",
            color: "#00ff96", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
            padding: "3px 10px", borderRadius: "0",
          }}>
            🔒 EVE-COLLATERALIZED
          </span>
          <span style={{ color: "#888", fontSize: "12px" }}>not yet initialized</span>
        </div>
        <div style={{ color: "#00ff96", fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>
          Initialize Collateral Backing
        </div>
        <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "12px", marginBottom: "14px" }}>
          Deposit EVE to back your tribe token with real collateral.
          Members can redeem tokens for EVE at the floor price (1/mint_ratio).
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px" }}>MINT RATIO</div>
          <input
            type="number"
            value={mintRatioInput}
            onChange={e => setMintRatioInput(e.target.value)}
            placeholder="100"
            min="1"
            style={{ ...inputStyle, width: "100px" }}
          />
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
            tokens per 1 EVE &nbsp;·&nbsp; floor: 1 {vault.coinSymbol} = {mintRatioInput ? (1 / parseInt(mintRatioInput || "100")).toFixed(4) : "0.01"} EVE
          </div>
        </div>
        <button
          className="accent-button"
          onClick={handleCreateVault}
          disabled={createBusy || !account}
          style={{ marginTop: "12px", background: "rgba(0,255,150,0.12)", borderColor: "#00ff9640", color: "#00ff96" }}
        >
          {createBusy ? "Creating…" : "🔒 Create Collateral Vault"}
        </button>
        {!isFounderForCV && account && (
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "11px", marginTop: "6px" }}>
            ⚠ Only the vault founder can initialize collateral backing
          </div>
        )}
        {createErr && (
          <div style={{
            color: "#ff6432", fontSize: "12px", marginTop: "8px",
            background: "rgba(255,100,50,0.08)", border: "1px solid rgba(255,100,50,0.25)",
            padding: "8px 12px", borderRadius: "2px",
          }}>
            ⚠ {createErr}
          </div>
        )}
      </div>
    );
  }

  // Collateral vault exists — show stats + actions
  const eveLockedDisplay = (cv.collateralBalance / 1e9).toFixed(4);
  const floorPrice = cv.mintRatio > 0 ? (1 / cv.mintRatio).toFixed(6) : "0";
  const mintEveRaw = parseFloat(mintEveAmt) || 0;
  const mintedTokens = Math.floor(mintEveRaw * cv.mintRatio);
  const redeemAmt_ = parseInt(redeemAmt, 10) || 0;
  // redeemAmt_ is in raw token units (9 decimals). Convert to human units before dividing by mintRatio.
  const redeemAmtHuman = redeemAmt_ / 1e9;
  const redeemEveOut = cv.mintRatio > 0 ? (redeemAmtHuman / cv.mintRatio).toFixed(6) : "0";

  return (
    <div style={cardStyle}>
      {/* Header badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <span style={{
          background: "rgba(0,255,150,0.15)", border: "1px solid rgba(0,255,150,0.4)",
          color: "#00ff96", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
          padding: "3px 10px", borderRadius: "0",
        }}>
          🔒 EVE-COLLATERALIZED
        </span>
        <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace" }}>
          {cv.objectId.slice(0, 10)}…
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>EVE LOCKED</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{eveLockedDisplay}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>EVE</div>
        </div>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>MINT RATIO</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{cv.mintRatio}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>1 EVE = {cv.mintRatio} {vault.coinSymbol}</div>
        </div>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>FLOOR PRICE</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{floorPrice}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>EVE per {vault.coinSymbol}</div>
        </div>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>TOTAL EVER MINTED</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{fmtToken(cv.totalMinted)}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>{vault.coinSymbol}</div>
        </div>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>TOTAL EVER REDEEMED</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{fmtToken(cv.totalRedeemed)}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>{vault.coinSymbol}</div>
        </div>
        <div style={{
          background: "#131313", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: "0", padding: "10px 14px", minWidth: "110px", flex: 1,
        }}>
          <div style={{ color: "#888", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "3px" }}>CAPACITY</div>
          <div style={{ color: "#00ff96", fontSize: "17px", fontWeight: 700 }}>{fmtToken(cv.mintCapacity)}</div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>mintable</div>
        </div>
      </div>

      {/* Founder actions */}
      {isFounder && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "14px" }}>
          {/* Mint with collateral */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,150,0.12)",
            borderRadius: "0", padding: "12px",
          }}>
            <div style={{ color: "#00ff96", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              ▲ Mint Tokens (deposit EVE → mint {vault.coinSymbol})
            </div>
            {mintEveAmt && mintedTokens > 0 && (
              <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "6px" }}>
                Depositing {mintEveAmt} EVE → minting {fmtToken(mintedTokens * TOKEN_DECIMALS)} {vault.coinSymbol} to {mintRecipient ? shortAddr(mintRecipient) : "[recipient]"}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="number"
                value={mintEveAmt}
                onChange={e => setMintEveAmt(e.target.value)}
                placeholder="EVE amount"
                min="0"
                step="0.000000001"
                style={{ ...inputStyle, width: "120px" }}
              />
              <input
                value={mintRecipient}
                onChange={e => setMintRecipient(e.target.value)}
                placeholder="0x… recipient"
                style={{ ...inputStyle, flex: 1, minWidth: "160px", fontFamily: "monospace" }}
              />
              <button
                className="accent-button"
                onClick={handleMint}
                disabled={mintBusy || !mintEveAmt || !mintRecipient.trim()}
                style={{ background: "rgba(0,255,150,0.12)", borderColor: "#00ff9640", color: "#00ff96" }}
              >
                {mintBusy ? "…" : "Mint"}
              </button>
            </div>
            {mintErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {mintErr}</div>}
          </div>

          {/* Deposit EVE (capacity only) */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,150,0.12)",
            borderRadius: "0", padding: "12px",
          }}>
            <div style={{ color: "#00ff96", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              ↓ Deposit EVE (increases capacity, no minting)
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="number"
                value={depositAmt}
                onChange={e => setDepositAmt(e.target.value)}
                placeholder="EVE amount"
                min="0"
                step="0.000000001"
                style={{ ...inputStyle, width: "140px" }}
              />
              <button
                className="accent-button"
                onClick={handleDeposit}
                disabled={depositBusy || !depositAmt}
                style={{ background: "rgba(0,255,150,0.12)", borderColor: "#00ff9640", color: "#00ff96" }}
              >
                {depositBusy ? "…" : "Deposit"}
              </button>
            </div>
            {depositErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {depositErr}</div>}
          </div>

          {/* Issue tokens against existing collateral */}
          {cv && cv.collateralBalance > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,200,255,0.15)",
              borderRadius: "0", padding: "12px",
            }}>
              <div style={{ color: "#00ccff", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                ✦ Issue Against Capacity
              </div>
              <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "8px" }}>
                Mint {vault.coinSymbol} using already-locked EVE collateral (no new deposit needed).
                Available: {fmtToken(Math.max(0, cv.collateralBalance * cv.mintRatio - vault.totalSupply))} {vault.coinSymbol}
              </div>
              <IssueFromCapacityForm vault={vault} cv={cv} onTxSuccess={onTxSuccess} />
            </div>
          )}

          {/* Change mint ratio */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,150,0.12)",
            borderRadius: "0", padding: "12px",
          }}>
            <div style={{ color: "#00ff96", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              ⚙ Change Mint Ratio (affects future mints only)
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                value={newRatioInput}
                onChange={e => setNewRatioInput(e.target.value)}
                placeholder={`Current: ${cv.mintRatio}`}
                min="1"
                style={{ ...inputStyle, width: "160px" }}
              />
              <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "11px" }}>
                {newRatioInput ? `1 EVE = ${newRatioInput} ${vault.coinSymbol}` : "tokens per 1 EVE"}
              </span>
              <button
                className="accent-button"
                onClick={handleUpdateRatio}
                disabled={ratioUpdateBusy || !newRatioInput}
                style={{ background: "rgba(255,71,0,0.12)", borderColor: "#FF470040", color: "#FF4700" }}
              >
                {ratioUpdateBusy ? "…" : "Update"}
              </button>
            </div>
            {ratioErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {ratioErr}</div>}
          </div>
        </div>
      )}

      {/* Redeem (any holder) */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(100,180,255,0.12)",
        borderRadius: "0", padding: "12px",
      }}>
        <div style={{ color: "#64b4ff", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          ↩ Redeem {vault.coinSymbol} → EVE
        </div>
        {redeemAmt_ > 0 && (
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "6px" }}>
            Burning {fmtToken(redeemAmt_)} {vault.coinSymbol} → receiving {redeemEveOut} EVE
          </div>
        )}
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="number"
            value={redeemAmt}
            onChange={e => setRedeemAmt(e.target.value)}
            placeholder={`${vault.coinSymbol} to redeem`}
            min="1"
            style={{
              ...inputStyle,
              width: "160px",
              border: "1px solid rgba(100,180,255,0.25)",
              color: "#64b4ff",
            }}
          />
          <button
            className="accent-button"
            onClick={handleRedeem}
            disabled={redeemBusy || !redeemAmt || parseInt(redeemAmt, 10) < 1}
            style={{ background: "rgba(100,180,255,0.10)", borderColor: "#64b4ff40", color: "#64b4ff" }}
          >
            {redeemBusy ? "…" : "Redeem"}
          </button>
        </div>
        {redeemErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {redeemErr}</div>}
      </div>

      {/* Founder burn all circulating tokens */}
      {isFounder && vault && Number(vault.totalSupply ?? 0) > 0 && (
        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,50,50,0.05)", border: "1px solid rgba(255,50,50,0.2)" }}>
          <div style={{ color: "#ff6432", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>
            🔥 BURN ALL CIRCULATING (FOUNDER ONLY)
          </div>
          <div style={{ color: "rgba(180,180,160,0.6)", fontSize: "11px", marginBottom: "8px" }}>
            Burns all {fmtToken(Number(vault.totalSupply))} {vault.coinSymbol} from your wallet. Irreversible.
          </div>
          <button
            onClick={handleBurnAll}
            disabled={burnAllBusy}
            style={{
              background: "rgba(255,50,50,0.12)", border: "1px solid rgba(255,50,50,0.4)",
              color: "#ff6432", cursor: "pointer", fontSize: "11px", fontWeight: 700,
              padding: "5px 14px", letterSpacing: "0.08em", fontFamily: "inherit",
            }}
          >
            {burnAllBusy ? "Burning…" : `Burn All ${vault.coinSymbol}`}
          </button>
          {burnAllErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {burnAllErr}</div>}
        </div>
      )}

      {/* Founder accounting reset — only when supply is 0 */}
      {isFounder && cv && Number(vault.totalSupply ?? 0) === 0 && (cv.totalMinted > 0 || cv.totalRedeemed > 0) && (
        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,140,0,0.05)", border: "1px solid rgba(255,140,0,0.2)" }}>
          <div style={{ color: "#ffa020", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>
            ↺ RESET ACCOUNTING (FOUNDER ONLY)
          </div>
          <div style={{ color: "rgba(180,180,160,0.6)", fontSize: "11px", marginBottom: "8px" }}>
            Zeroes lifetime minted/redeemed counters. Only available when circulating supply is 0.
          </div>
          <button
            onClick={handleResetAccounting}
            disabled={resetBusy}
            style={{
              background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.4)",
              color: "#ffa020", cursor: "pointer", fontSize: "11px", fontWeight: 700,
              padding: "5px 14px", letterSpacing: "0.08em", fontFamily: "inherit",
            }}
          >
            {resetBusy ? "Resetting…" : "Reset Counters"}
          </button>
          {resetErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {resetErr}</div>}
        </div>
      )}

      {/* Founder emergency drain */}
      {isFounder && cv && cv.collateralBalance > 0 && (
        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,50,50,0.05)", border: "1px solid rgba(255,50,50,0.2)" }}>
          <div style={{ color: "#ff6432", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>
            ⚠ EMERGENCY DRAIN (FOUNDER ONLY)
          </div>
          <div style={{ color: "rgba(180,180,160,0.6)", fontSize: "11px", marginBottom: "8px" }}>
            Withdraws all {(cv.collateralBalance / 1e9).toFixed(4)} locked EVE back to your wallet. Irreversible.
          </div>
          <button
            onClick={handleDrain}
            disabled={drainBusy}
            style={{
              background: "rgba(255,50,50,0.12)", border: "1px solid rgba(255,50,50,0.4)",
              color: "#ff6432", cursor: "pointer", fontSize: "11px", fontWeight: 700,
              padding: "5px 14px", letterSpacing: "0.08em", fontFamily: "inherit",
            }}
          >
            {drainBusy ? "Draining…" : "Drain All EVE"}
          </button>
          {drainErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "6px" }}>⚠ {drainErr}</div>}
        </div>
      )}
    </div>
  );
}

// ── Vault dashboard ───────────────────────────────────────────────────────────

function VaultDashboard({
  vault,
  onTxSuccess,
}: {
  vault: TribeVaultState;
  onTxSuccess: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();

  // Issue token state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [issueErr, setIssueErr] = useState<string | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);

  // Transfer state
  const [xferTo, setXferTo] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferErr, setXferErr] = useState<string | null>(null);
  const [xferBusy, setXferBusy] = useState(false);

  // Infra registration state
  const [infraBusy, setInfraBusy] = useState<string | null>(null); // objectId being acted on
  const [infraErr, setInfraErr] = useState<string | null>(null);

  const { overrideIsFounder } = useDevOverrides();
  const isFounder = overrideIsFounder(!!(account?.address && vault.founder &&
    account.address.toLowerCase() === vault.founder.toLowerCase()));
  const infraCredits = vault.infraCredits ?? 0;

  // World API: resolve tribe name
  const { data: tribeInfo } = useQuery({
    queryKey: ["tribeInfo", vault.tribeId],
    queryFn: () => fetchTribeInfo(vault.tribeId),
    staleTime: 300_000,
  });
  // Both totalSupply and infraCredits are raw (9 decimals) — ratio is still correct when comparing raw to raw
  const cappedPct = infraCredits > 0 ? Math.min(100, (vault.totalSupply / infraCredits) * 100) : 0;
  const issuable = Math.max(0, infraCredits - vault.totalSupply); // raw units, divided by fmtToken at display

  const { data: myBalance } = useQuery<number>({
    queryKey: ["myVaultBalance", vault.objectId, account?.address],
    queryFn: () => account ? fetchMemberBalance(vault.balancesTableId, account.address) : 0,
    enabled: !!account?.address,
    staleTime: 15_000,
  });

  const { data: events } = useQuery<CoinIssuedEvent[]>({
    queryKey: ["coinIssuedEvents", vault.objectId],
    queryFn: () => fetchCoinIssuedEvents(vault.objectId),
    staleTime: 30_000,
  });

  // Load player structures flattened (for infra registration)
  const { data: structures } = useQuery<PlayerStructure[]>({
    queryKey: ["playerStructuresFlat", account?.address],   // different key from StructurePanel's LocationGroup[] cache
    queryFn: async (): Promise<PlayerStructure[]> => {
      if (!account) return [];
      const groups = await fetchPlayerStructures(account.address);
      return groups.flatMap(g => g.structures);
    },
    enabled: !!account && isFounder,
    staleTime: 60_000,
  });

  // Registered structure IDs — filter out already-registered structures from the list
  const { data: registeredIds } = useQuery<Set<string>>({
    queryKey: ["registeredInfra", vault.registeredInfraTableId],
    queryFn: () => vault.registeredInfraTableId
      ? fetchRegisteredInfraIds(vault.registeredInfraTableId)
      : Promise.resolve(new Set<string>()),
    enabled: isFounder && !!vault.registeredInfraTableId,
    staleTime: 20_000,
  });

  const handleIssue = async () => {
    if (!account || !recipient.trim() || !amount) return;
    setIssueBusy(true); setIssueErr(null);
    try {
      const tx = buildIssueCoinTransaction(
        vault.objectId,
        recipient.trim(),
        parseInt(amount, 10),
        reason.trim() || "contribution reward",
      );
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setRecipient(""); setAmount(""); setReason("");
      onTxSuccess();
    } catch (e) {
      setIssueErr(e instanceof Error ? e.message : String(e));
    } finally { setIssueBusy(false); }
  };

  const handleTransfer = async () => {
    if (!account || !xferTo.trim() || !xferAmt) return;
    setXferBusy(true); setXferErr(null);
    try {
      const tx = buildTransferCoinsTransaction(vault.objectId, xferTo.trim(), parseInt(xferAmt, 10));
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setXferTo(""); setXferAmt("");
      onTxSuccess();
    } catch (e) {
      setXferErr(e instanceof Error ? e.message : String(e));
    } finally { setXferBusy(false); }
  };

  const handleRegister = async (s: PlayerStructure) => {
    if (!account || !s.energyCost) return;
    setInfraBusy(s.objectId); setInfraErr(null);
    try {
      const tx = buildRegisterStructureTransaction(vault.objectId, s.objectId, s.energyCost);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onTxSuccess();
    } catch (e) {
      setInfraErr(e instanceof Error ? e.message : String(e));
    } finally { setInfraBusy(null); }
  };

  const handleDeregister = async (s: PlayerStructure) => {
    if (!account) return;
    setInfraBusy(s.objectId); setInfraErr(null);
    try {
      const tx = buildDeregisterStructureTransaction(vault.objectId, s.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onTxSuccess();
    } catch (e) {
      setInfraErr(e instanceof Error ? e.message : String(e));
    } finally { setInfraBusy(null); }
  };

  const nonNodeStructures = (structures ?? []).filter(s => s.kind !== "NetworkNode");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <div>
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "22px", letterSpacing: "0.04em" }}>
            {vault.coinName}
            <span style={{
              marginLeft: "10px", fontSize: "13px", fontFamily: "monospace",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,71,0,0.3)",
              borderRadius: "0", padding: "2px 8px", color: "#FF4700",
            }}>
              {vault.coinSymbol}
            </span>
          </div>
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px", marginTop: "2px" }}>
            {tribeInfo ? (
              <span title={tribeInfo.description || undefined}>
                {tribeInfo.name}
                <span style={{ color: "rgba(107,107,94,0.55)", marginLeft: "6px" }}>({tribeInfo.nameShort})</span>
              </span>
            ) : (
              <span>Tribe {vault.tribeId}</span>
            )}
            {" · "}Founded by {shortAddr(vault.founder)}
            {isFounder && <span style={{ color: "#FF4700", marginLeft: "8px" }}>● You are the founder</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatBox
          label="CIRCULATING"
          value={fmtToken(vault.totalSupply)}
          sub={vault.coinSymbol}
        />
        <StatBox
          label="INFRA CAP"
          value={fmtToken(infraCredits)}
          sub={infraCredits > 0 ? `${cappedPct.toFixed(1)}% used` : "no infra registered"}
        />
        <StatBox
          label="ISSUABLE"
          value={fmtToken(issuable)}
          sub="remaining cap"
        />
        <StatBox
          label="YOUR BALANCE"
          value={fmtToken(myBalance ?? 0)}
          sub={vault.coinSymbol}
        />
      </div>

      {/* Token identifier — vault contract address */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "0", padding: "10px 14px", marginBottom: "16px",
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
      }}>
        <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          TOKEN CONTRACT
        </span>
        <span style={{
          fontFamily: "monospace", fontSize: "11px", color: "#aaa",
          wordBreak: "break-all", flex: 1,
        }}>
          {vault.objectId}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(vault.objectId)}
          title="Copy vault address"
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0", color: "#888", fontSize: "11px",
            padding: "2px 8px", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          Copy
        </button>
        <a
          href={`https://suiscan.xyz/testnet/object/${vault.objectId}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Explorer ↗
        </a>
      </div>

      {/* Infra backing bar */}
      {infraCredits > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            height: "6px", borderRadius: "0",
            background: "rgba(255,255,255,0.07)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${cappedPct}%`,
              background: cappedPct > 90 ? "#ff6432" : cappedPct > 70 ? "#FF4700" : "#00ff96",
              transition: "width 0.4s ease",
              borderRadius: "0",
            }} />
          </div>
          <div style={{ fontSize: "10px", color: "rgba(107,107,94,0.55)", marginTop: "3px" }}>
            {fmtToken(vault.totalSupply)} / {fmtToken(infraCredits)} {vault.coinSymbol} issued
          </div>
        </div>
      )}

      {/* Collateral vault section */}
      <CollateralVaultCard vault={vault} onTxSuccess={onTxSuccess} />

      {/* Infra management (founder only) */}
      {isFounder && nonNodeStructures.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,71,0,0.12)",
          borderRadius: "0", padding: "14px", marginBottom: "20px",
        }}>
          <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "10px" }}>
            🏗 Infra Backing — Register structures to unlock issuable supply
          </div>
          {infraErr && <div style={{ color: "#ff6432", fontSize: "11px", marginBottom: "8px" }}>⚠ {infraErr}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {nonNodeStructures.map(s => {
              const credits = (s.energyCost ?? 0) * 1000;
              const isBusy = infraBusy === s.objectId;
              const isRegistered = registeredIds?.has(s.objectId.toLowerCase()) ?? false;
              return (
                <div key={s.objectId} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "6px 10px",
                  background: isRegistered ? "rgba(0,255,150,0.04)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isRegistered ? "rgba(0,255,150,0.15)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "2px",
                }}>
                  <span style={{ color: "#888", fontSize: "11px", minWidth: "80px" }}>{s.kind}</span>
                  <span style={{ color: "#aaa", fontSize: "11px", fontFamily: "monospace", flex: 1 }}>
                    {s.displayName !== s.label ? s.displayName : `#${s.objectId.slice(-6)}`}
                  </span>
                  {s.energyCost && s.energyCost > 0 && (
                    <span style={{
                      fontSize: "10px", color: "#FF4700",
                      background: "#161616",
                      border: "1px solid rgba(255,71,0,0.2)",
                      borderRadius: "0", padding: "1px 5px",
                    }}>
                      ⚡{s.energyCost} → +{credits.toLocaleString()} {vault.coinSymbol || "EVE"}
                    </span>
                  )}
                  {isRegistered ? (
                    <>
                      <span style={{
                        fontSize: "11px", color: "#00ff96",
                        background: "rgba(0,255,150,0.08)", border: "1px solid rgba(0,255,150,0.2)",
                        borderRadius: "0", padding: "3px 10px",
                      }}>
                        ✓ Registered
                      </span>
                      <button
                        onClick={() => handleDeregister(s)}
                        disabled={isBusy}
                        style={{
                          background: "#161616", border: "1px solid rgba(255,71,0,0.3)",
                          color: "#ff8060", borderRadius: "0",
                          fontSize: "11px", padding: "3px 10px", cursor: "pointer",
                        }}
                      >
                        {isBusy ? "…" : "Remove"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleRegister(s)}
                      disabled={isBusy || !s.energyCost}
                      style={{
                        background: "rgba(0,255,150,0.1)", border: "1px solid #00ff9640",
                        color: "#00ff96", borderRadius: "0",
                        fontSize: "11px", padding: "3px 10px", cursor: "pointer",
                      }}
                    >
                      {isBusy ? "…" : "Register"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issue token (founder only) */}
      {isFounder ? (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(0,255,150,0.15)",
          borderRadius: "0",
          padding: "16px",
          marginBottom: "20px",
        }}>
          <div style={{ color: "#00ff96", fontWeight: 600, marginBottom: "12px", fontSize: "13px" }}>
            ▲ Issue {vault.coinSymbol} to Member
            {infraCredits === 0 && (
              <span style={{ color: "#ff6432", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>
                — register infra first to unlock cap
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <input
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="0x… wallet address"
              style={{
                flex: 3, minWidth: "180px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px", color: "#fff", fontSize: "12px", padding: "7px 10px",
                outline: "none", fontFamily: "monospace",
              }}
            />
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Max: ${fmtToken(issuable)}`}
              min="1"
              max={issuable}
              style={{
                flex: 1, minWidth: "80px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason — e.g. 10x EU-90 fuel deposit"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px", color: "#aaa", fontSize: "12px", padding: "7px 10px", outline: "none",
              }}
            />
            <button
              className="accent-button"
              onClick={handleIssue}
              disabled={issueBusy || !recipient.trim() || !amount || parseInt(amount) <= 0 || parseInt(amount) > issuable}
              style={{
                padding: "7px 18px", fontSize: "13px",
                background: "rgba(0,255,150,0.12)", borderColor: "#00ff9640", color: "#00ff96",
              }}
            >
              {issueBusy ? "…" : "Issue"}
            </button>
          </div>
          {issueErr && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>⚠ {issueErr}</div>}
        </div>
      ) : null}

      {/* Transfer coins (any member) */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(100,180,255,0.12)",
        borderRadius: "0",
        padding: "14px",
        marginBottom: "20px",
      }}>
        <div style={{ color: "#64b4ff", fontWeight: 600, fontSize: "13px", marginBottom: "10px" }}>
          ↗ Transfer {vault.coinSymbol}
          <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, fontSize: "11px", marginLeft: "8px" }}>
            your balance: {fmtToken(myBalance ?? 0)}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            value={xferTo}
            onChange={e => setXferTo(e.target.value)}
            placeholder="0x… recipient address"
            style={{
              flex: 3, minWidth: "180px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "5px", color: "#fff", fontSize: "12px", padding: "7px 10px",
              outline: "none", fontFamily: "monospace",
            }}
          />
          <input
            type="number"
            value={xferAmt}
            onChange={e => setXferAmt(e.target.value)}
            placeholder="Amount"
            min="1"
            max={myBalance ?? 0}
            style={{
              flex: 1, minWidth: "80px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
            }}
          />
          <button
            className="accent-button"
            onClick={handleTransfer}
            disabled={xferBusy || !xferTo.trim() || !xferAmt || parseInt(xferAmt) <= 0 || parseInt(xferAmt) > (myBalance ?? 0)}
            style={{
              padding: "7px 18px", fontSize: "13px",
              background: "rgba(100,180,255,0.10)", borderColor: "#64b4ff40", color: "#64b4ff",
            }}
          >
            {xferBusy ? "…" : "Send"}
          </button>
        </div>
        {xferErr && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>⚠ {xferErr}</div>}
      </div>

      {/* Activity */}
      <div>
        <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "8px" }}>
          ISSUANCE HISTORY
        </div>
        {!events?.length ? (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No coins issued yet</div>
        ) : (
          events.slice(0, 15).map((ev, i) => <EventRow key={i} ev={ev} />)
        )}
      </div>
    </div>
  );
}

// ── Vault + DEX tab wrapper ───────────────────────────────────────────────────

function VaultWithDex({
  vault,
  onTxSuccess,
}: {
  vault: TribeVaultState;
  onTxSuccess: () => void;
}) {
  const [vaultTab, setVaultTab] = useState<"vault" | "dex">("vault");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 18px", fontSize: "12px", cursor: "pointer",
    border: `1px solid ${active ? "#FF4700" : "rgba(255,71,0,0.2)"}`,
    background: active ? "rgba(255,71,0,0.12)" : "transparent",
    color: active ? "#FF4700" : "#666",
    borderRadius: "0", fontWeight: active ? 700 : 400,
    letterSpacing: "0.04em", textTransform: "uppercase" as const,
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(vaultTab === "vault")} onClick={() => setVaultTab("vault")}>
          ⚓ Vault
        </button>
        <button style={tabStyle(vaultTab === "dex")} onClick={() => setVaultTab("dex")}>
          📈 DEX
        </button>
      </div>

      {vaultTab === "vault" && <VaultDashboard vault={vault} onTxSuccess={onTxSuccess} />}
      {vaultTab === "dex"   && <TribeDexPanel  vault={vault} onTxSuccess={onTxSuccess} />}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Props = { onTxSuccess?: (digest?: string) => void };

export function TribeVaultPanel({ onTxSuccess }: Props) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const { overrideAccount, overrideTribeId } = useDevOverrides();
  const account = overrideAccount(_verifiedAcct);
  const queryClient = useQueryClient();
  const [manualVaultId, setManualVaultId] = useState<string | null>(null);

  const { data: _rawTribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : null,
    enabled: !!account?.address,
  });
  const tribeId = overrideTribeId(_rawTribeId ?? null);

  const { data: vault, isLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, manualVaultId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      let vaultId = manualVaultId ?? getCachedVaultId(tribeId);
      // Auto-discover from chain if not cached
      if (!vaultId) {
        vaultId = await discoverVaultIdFromChain(tribeId);
        if (vaultId) setCachedVaultId(tribeId, vaultId);
      }
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 15_000,
  });

  const handleRefresh = (delayMs = 2500) => {
    // Small delay lets the Sui fullnode commit the new state before we re-fetch
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["tribeVault"] });
      queryClient.invalidateQueries({ queryKey: ["myVaultBalance"] });
      queryClient.invalidateQueries({ queryKey: ["coinIssuedEvents"] });
      queryClient.invalidateQueries({ queryKey: ["registeredInfra"] });
      queryClient.invalidateQueries({ queryKey: ["collateralVault"] });
      onTxSuccess?.();
    }, delayMs);
  };

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Connect EVE Vault to manage your tribe token
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Loading tribe vault…
      </div>
    );
  }

  // No vault found yet — show launch form
  if (!vault) {
    if (tribeId && getCachedVaultId(tribeId) && !manualVaultId) {
      // Cached ID exists but fetch failed — show connect form to re-enter
      return (
        <ConnectVaultForm
          tribeId={tribeId}
          onConnect={id => { setManualVaultId(id); handleRefresh(); }}
        />
      );
    }
    if (tribeId && manualVaultId == null && !getCachedVaultId(tribeId)) {
      // No vault at all
      return <LaunchCoinForm onSuccess={handleRefresh} />;
    }
    if (tribeId) {
      return (
        <ConnectVaultForm
          tribeId={tribeId}
          onConnect={id => { setManualVaultId(id); handleRefresh(); }}
        />
      );
    }
    return <LaunchCoinForm onSuccess={handleRefresh} />;
  }

  // Stale vault: type is explicitly from a different package.
  // Only flag if we have a confirmed non-empty type that doesn't match — never block on missing type.
  // Stale check: v3 vaults lack the registered_infra field (registeredInfraTableId = "").
  // Sui upgrade model means all vault types carry the ORIGINAL package ID regardless of
  // which version created them — never use vault._type for version detection.
  const isStaleVault = !vault.registeredInfraTableId;
  if (isStaleVault) {
    return (
      <div className="card" style={{ border: "1px solid rgba(255,71,0,0.4)", padding: "24px" }}>
        <div style={{ color: "#FF4700", fontWeight: 700, marginBottom: "8px" }}>
          ⚠ Vault upgrade required
        </div>
        <div style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
          Your existing vault <span style={{ fontFamily: "monospace", color: "#aaa" }}>
            {vault.coinName} ({vault.coinSymbol})
          </span> was created under an older package version and is not compatible with
          the current on-chain functions (register infra, issue tokens, DEX).
          Launch a new vault under the current package to unlock full functionality.
        </div>
        <button
          className="accent-button"
          onClick={() => {
            if (tribeId) {
              localStorage.removeItem(`cradleos:vault:${tribeId}`);
            }
            handleRefresh();
          }}
        >
          Launch new vault →
        </button>
      </div>
    );
  }

  return (
    <VaultErrorBoundary>
      <VaultWithDex vault={vault} onTxSuccess={handleRefresh} />
    </VaultErrorBoundary>
  );
}
