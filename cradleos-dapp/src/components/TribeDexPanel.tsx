/**
 * TribeDexPanel — On-chain order book for TRIBE/EVE trading.
 *
 * Flow:
 * 1. No DEX found → "Create DEX" (one per vault)
 * 2. DEX live → order book + post/fill/cancel controls
 */
import { useState } from "react";

const TOKEN_DECIMALS = 1_000_000_000;
function fmtToken(raw: number): string {
  return (raw / TOKEN_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import {
  fetchDexState,
  fetchOpenOrders,
  fetchOrderFilledEvents,
  fetchMemberBalance,
  fetchEveBalance,
  buildCreateDexTransaction,
  buildPostSellOrderTransaction,
  buildFillSellOrderTransaction,
  buildCancelOrderTransaction,
  getCachedDexId,
  setCachedDexId,
  discoverDexIdForVault,
  type DexState,
  type SellOrder,
  type OrderFilledEvent,
  type TribeVaultState,
} from "../lib";
import { SUI_TESTNET_RPC, EVE_COIN_TYPE } from "../constants";

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function fmtEve(eve: number) {
  if (eve === 0) return "0 EVE";
  return `${eve.toLocaleString()} EVE`;
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "0", padding: "12px 16px", minWidth: "100px",
    }}>
      <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: "18px" }}>{value}</div>
      {sub && <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

/** Fetch the first shared object (TribeDex) created by a tx digest. */
async function fetchCreatedDexFromDigest(digest: string): Promise<string | null> {
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
      result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } };
    };
    const shared = (j.result?.effects?.created ?? []).find(
      c => typeof c.owner === "object" && "Shared" in (c.owner as object)
    );
    return shared?.reference.objectId ?? null;
  } catch { return null; }
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  vault,
  dex,
  myAddress,
  onSuccess,
}: {
  order: SellOrder;
  vault: TribeVaultState;
  dex: DexState;
  myAddress: string | undefined;
  onSuccess: () => void;
}) {
  const dAppKit = useDAppKit();
  const [fillAmt, setFillAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isMine = myAddress?.toLowerCase() === order.seller.toLowerCase();
  const costCrdl = parseInt(fillAmt || "0", 10) * order.pricePerUnit;

  const handleFill = async () => {
    const amt = parseInt(fillAmt, 10);
    if (!amt || amt <= 0 || amt > order.rawRemaining) return;
    setBusy(true); setErr(null);
    try {
      // Look up the buyer's EVE coin object ID
      const { coinId } = myAddress ? await fetchEveBalance(myAddress) : { coinId: null };
      if (!coinId) throw new Error("No EVE in wallet. Register infrastructure to earn EVE first.");
      const tx = buildFillSellOrderTransaction(dex.objectId, vault.objectId, order.orderId, amt, order.pricePerUnit, coinId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setFillAmt("");
      onSuccess();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    setBusy(true); setErr(null);
    try {
      const tx = buildCancelOrderTransaction(dex.objectId, vault.objectId, order.orderId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onSuccess();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
      padding: "10px 14px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "2px", marginBottom: "6px",
    }}>
      {/* Order info */}
      <div style={{ flex: "0 0 50px", color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace" }}>
        #{order.orderId}
      </div>
      <div style={{ flex: "0 0 90px", color: "#FF4700", fontWeight: 600, fontSize: "13px" }}>
        {fmtToken(order.rawRemaining)} {vault.coinSymbol}
      </div>
      <div style={{ flex: "0 0 110px", color: "#aaa", fontSize: "12px" }}>
        @ {fmtEve(order.pricePerUnit)}/{vault.coinSymbol}
      </div>
      <div style={{ flex: 1, color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace" }}>
        {isMine ? (
          <span style={{ color: "#FF4700" }}>● yours</span>
        ) : shortAddr(order.seller)}
      </div>

      {/* Fill controls (non-owner) */}
      {!isMine && myAddress && (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="number"
            value={fillAmt}
            onChange={e => setFillAmt(e.target.value)}
            placeholder="qty"
            min="1"
            max={order.rawRemaining}
            style={{
              width: "70px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "0", color: "#fff", fontSize: "12px", padding: "5px 8px", outline: "none",
            }}
          />
          {fillAmt && parseInt(fillAmt) > 0 && (
            <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", minWidth: "70px" }}>{costCrdl.toLocaleString()} EVE</span>
          )}
          <button
            onClick={handleFill}
            disabled={busy || !fillAmt || parseInt(fillAmt) <= 0 || parseInt(fillAmt) > order.rawRemaining}
            style={{
              background: "rgba(0,255,150,0.10)", border: "1px solid #00ff9640",
              color: "#00ff96", borderRadius: "0", fontSize: "12px", padding: "5px 12px", cursor: "pointer",
            }}
          >
            {busy ? "…" : "Buy"}
          </button>
        </div>
      )}

      {/* Cancel (owner) */}
      {isMine && (
        <button
          onClick={handleCancel}
          disabled={busy}
          style={{
            background: "#161616", border: "1px solid rgba(255,71,0,0.3)",
            color: "#ff8060", borderRadius: "0", fontSize: "11px", padding: "4px 10px", cursor: "pointer",
          }}
        >
          {busy ? "…" : "Cancel"}
        </button>
      )}

      {err && <div style={{ width: "100%", color: "#ff6432", fontSize: "11px", marginTop: "4px" }}>⚠ {err}</div>}
    </div>
  );
}

// ── Fill history row ──────────────────────────────────────────────────────────

function FillRow({ ev, symbol }: { ev: OrderFilledEvent; symbol: string }) {
  return (
    <div style={{
      display: "flex", gap: "10px", padding: "6px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      fontSize: "11px", color: "rgba(107,107,94,0.6)",
    }}>
      <span style={{ minWidth: "40px", color: "rgba(107,107,94,0.55)" }}>#{ev.orderId}</span>
      <span style={{ color: "#00ff96" }}>+{fmtToken(ev.fillAmount)} {symbol}</span>
      <span>@ {fmtEve(ev.pricePerUnit)}</span>
      <span style={{ flex: 1, textAlign: "right", fontFamily: "monospace" }}>
        {shortAddr(ev.buyer)}
      </span>
    </div>
  );
}

// ── DEX dashboard ─────────────────────────────────────────────────────────────

function DexDashboard({
  dex,
  vault,
  onSuccess,
}: {
  dex: DexState;
  vault: TribeVaultState;
  onSuccess: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();

  const [sellAmt, setSellAmt] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [postErr, setPostErr] = useState<string | null>(null);
  const [postBusy, setPostBusy] = useState(false);

  const { data: myBalance } = useQuery<number>({
    queryKey: ["myVaultBalance", vault.balancesTableId, account?.address],
    queryFn: () => account && vault.balancesTableId ? fetchMemberBalance(vault.balancesTableId, account.address) : Promise.resolve(0),
    enabled: !!account?.address && !!vault.balancesTableId,
    staleTime: 15_000,
  });

  const { data: orders } = useQuery<SellOrder[]>({
    queryKey: ["openOrders", dex.sellOrdersTableId],
    queryFn: () => dex.sellOrdersTableId ? fetchOpenOrders(dex.sellOrdersTableId) : Promise.resolve([]),
    staleTime: 10_000,
  });

  const { data: fills } = useQuery<OrderFilledEvent[]>({
    queryKey: ["orderFills", dex.objectId],
    queryFn: () => fetchOrderFilledEvents(dex.objectId),
    staleTime: 30_000,
  });

  const handlePost = async () => {
    const amt = parseInt(sellAmt, 10);
    const price = parseInt(sellPrice, 10);
    if (!account || !amt || !price) return;
    setPostBusy(true); setPostErr(null);
    try {
      const tx = buildPostSellOrderTransaction(dex.objectId, vault.objectId, amt, price);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setSellAmt(""); setSellPrice("");
      onSuccess();
    } catch (e) { setPostErr(e instanceof Error ? e.message : String(e)); }
    finally { setPostBusy(false); }
  };

  const lastPrice = dex.lastPrice > 0 ? dex.lastPrice.toLocaleString() : "—";

  // EVE balance for the connected wallet
  const { data: eveData } = useQuery({
    queryKey: ["eveBalance", account?.address],
    queryFn: () => account ? fetchEveBalance(account.address) : Promise.resolve({ balance: 0, coinId: null }),
    enabled: !!account?.address,
    staleTime: 15_000,
  });
  const eveBalance = eveData?.balance ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "20px" }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "20px" }}>
          {vault.coinSymbol} / EVE
        </div>
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>Order Book</div>
        {dex.lastPrice > 0 && (
          <div style={{
            marginLeft: "auto", color: "#00ff96", fontWeight: 700, fontSize: "14px",
            fontFamily: "monospace",
          }}>
            Last: {lastPrice} EVE
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatBox
          label="LAST PRICE"
          value={lastPrice}
          sub="EVE per token"
        />
        <StatBox
          label="VOL (TRIBE)"
          value={fmtToken(dex.totalVolumeRaw)}
          sub="all-time fills"
        />
        <StatBox
          label="VOL (EVE)"
          value={dex.totalVolumePayment.toLocaleString()}
          sub="all-time"
        />
        <StatBox
          label="YOUR BALANCE"
          value={fmtToken(myBalance ?? 0)}
          sub={vault.coinSymbol}
        />
        <StatBox
          label="YOUR EVE"
          value={eveBalance.toLocaleString()}
          sub="CradleCoin"
        />
      </div>

      {/* EVE token address */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.08)",
        borderRadius: "0", padding: "8px 12px", marginBottom: "16px", flexWrap: "wrap",
      }}>
        <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.08em" }}>EVE TOKEN</span>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#888", flex: 1, wordBreak: "break-all" }}>
          {EVE_COIN_TYPE}
        </span>
        <button
          onClick={() => { try { navigator.clipboard.writeText(EVE_COIN_TYPE); } catch {} }}
          style={{
            background: "none", border: "1px solid rgba(255,71,0,0.3)", borderRadius: "0",
            color: "#FF4700", fontSize: "10px", padding: "2px 8px", cursor: "pointer",
            fontFamily: "monospace", letterSpacing: "0.06em", flexShrink: 0,
          }}
        >
          copy
        </button>
      </div>

      {/* Post sell order */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.12)",
        borderRadius: "0", padding: "14px", marginBottom: "20px",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "10px" }}>
          ↓ Post Sell Order
          <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, fontSize: "11px", marginLeft: "8px" }}>
            your balance: {fmtToken(myBalance ?? 0)} {vault.coinSymbol}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>AMOUNT ({vault.coinSymbol})</span>
            <input
              type="number"
              value={sellAmt}
              onChange={e => setSellAmt(e.target.value)}
              placeholder="0"
              min="1"
              max={myBalance ?? 0}
              style={{
                width: "100px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>PRICE (EVE per {vault.coinSymbol})</span>
            <input
              type="number"
              value={sellPrice}
              onChange={e => setSellPrice(e.target.value)}
              placeholder="10"
              min="1"
              style={{
                width: "130px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
              }}
            />
          </div>
          {sellAmt && sellPrice && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>TOTAL</span>
              <div style={{
                padding: "7px 10px", fontSize: "13px", color: "#FF4700", fontFamily: "monospace",
                background: "#131313", border: "1px solid rgba(255,71,0,0.15)",
                borderRadius: "5px",
              }}>
                {(parseInt(sellAmt) * parseInt(sellPrice)).toLocaleString()} EVE
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              className="accent-button"
              onClick={handlePost}
              disabled={postBusy || !sellAmt || !sellPrice || parseInt(sellAmt) <= 0 || parseInt(sellAmt) > (myBalance ?? 0)}
              style={{
                padding: "7px 20px", fontSize: "13px",
                background: "#181818", borderColor: "#FF470040", color: "#FF4700",
              }}
            >
              {postBusy ? "…" : "List"}
            </button>
          </div>
        </div>
        {postErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {postErr}</div>}
      </div>

      {/* Order book */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "8px" }}>
          OPEN ORDERS ({orders?.length ?? 0})
        </div>
        {!orders?.length ? (
          <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "12px", padding: "12px 0" }}>No open orders</div>
        ) : (
          orders.map(o => (
            <OrderRow
              key={o.orderId}
              order={o}
              vault={vault}
              dex={dex}
              myAddress={account?.address}
              onSuccess={onSuccess}
            />
          ))
        )}
      </div>

      {/* Fill history */}
      {fills && fills.length > 0 && (
        <div>
          <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "8px" }}>
            RECENT FILLS
          </div>
          {fills.slice(0, 10).map((ev, i) => (
            <FillRow key={i} ev={ev} symbol={vault.coinSymbol} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Connect / Create forms ────────────────────────────────────────────────────

function ConnectDexForm({
  vaultId,
  onConnect,
}: {
  vaultId: string;
  onConnect: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "0", padding: "20px",
    }}>
      <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "12px" }}>
        Paste the TribeDex object ID from your create-dex transaction:
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="0x… TribeDex object ID"
          style={{
            flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "5px", color: "#fff", fontSize: "12px", padding: "8px 12px",
            outline: "none", fontFamily: "monospace",
          }}
        />
        <button
          className="accent-button"
          onClick={() => { if (input.trim()) { setCachedDexId(vaultId, input.trim()); onConnect(input.trim()); } }}
          disabled={!input.trim()}
        >
          Connect
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Props = {
  vault: TribeVaultState;
  onTxSuccess?: (digest?: string) => void;
};

export function TribeDexPanel({ vault, onTxSuccess }: Props) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [manualDexId, setManualDexId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const cachedId = getCachedDexId(vault.objectId);
  const dexId = manualDexId ?? cachedId;

  // Auto-discover DEX from chain events if no cached ID
  const { data: discoveredDexId } = useQuery<string | null>({
    queryKey: ["dexDiscover", vault.objectId],
    queryFn: () => discoverDexIdForVault(vault.objectId),
    enabled: !dexId,
    staleTime: 10_000,
  });
  const resolvedDexId = dexId ?? discoveredDexId ?? null;
  // Cache it when auto-discovered
  if (discoveredDexId && !cachedId) setCachedDexId(vault.objectId, discoveredDexId);

  const { data: dex, isLoading } = useQuery<DexState | null>({
    queryKey: ["tribeDex", resolvedDexId],
    queryFn: () => resolvedDexId ? fetchDexState(resolvedDexId) : Promise.resolve(null),
    enabled: !!resolvedDexId,
    staleTime: 15_000,
  });

  const handleCreate = async () => {
    if (!account) return;
    setCreateBusy(true); setCreateErr(null);
    try {
      const tx = buildCreateDexTransaction(vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const digest = (result as { digest?: string }).digest;
      // Try digest-based discovery first (fast path)
      let newDexId = digest ? await fetchCreatedDexFromDigest(digest) : null;
      // If digest lookup raced the indexer, fall back to event query after a short wait
      if (!newDexId) {
        await new Promise(r => setTimeout(r, 2500));
        newDexId = await discoverDexIdForVault(vault.objectId);
      }
      if (newDexId) {
        setCachedDexId(vault.objectId, newDexId);
        setManualDexId(newDexId);
      }
      onTxSuccess?.(digest);
    } catch (e) { setCreateErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreateBusy(false); }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tribeDex"] });
    queryClient.invalidateQueries({ queryKey: ["openOrders"] });
    queryClient.invalidateQueries({ queryKey: ["orderFills"] });
    queryClient.invalidateQueries({ queryKey: ["myVaultBalance"] });
    onTxSuccess?.();
  };

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Connect EVE Vault to access the order book
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ color: "rgba(107,107,94,0.55)", padding: "32px", textAlign: "center" }}>Loading DEX…</div>;
  }

  if (!dex) {
    return (
      <div className="card">
        <div style={{ color: "#aaa", fontWeight: 600, marginBottom: "16px" }}>
          {vault.coinSymbol} / EVE Order Book
        </div>
        <p style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "20px" }}>
          No DEX found for this vault. Create one to enable on-chain price discovery and TRIBE/EVE trading.
        </p>
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            className="accent-button"
            onClick={handleCreate}
            disabled={createBusy}
          >
            {createBusy ? "Creating…" : `Create ${vault.coinSymbol}/EVE DEX`}
          </button>
        </div>
        {createErr && <div style={{ color: "#ff6432", fontSize: "12px", marginBottom: "12px" }}>⚠ {createErr}</div>}
        {!cachedId && (
          <>
            <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px", margin: "12px 0" }}>— or connect existing —</div>
            <ConnectDexForm vaultId={vault.objectId} onConnect={id => setManualDexId(id)} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <DexDashboard dex={dex} vault={vault} onSuccess={handleRefresh} />
    </div>
  );
}
