import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { translateTxError } from "../lib/txError";
import {
  fetchMemberCap,
  fetchCorpState,
  fetchTreasuryState,
  fetchTreasuryActivity,
  fetchCharacterTribeId,
  buildInitializeCorpTransaction,
  buildDepositTransaction,
  buildWithdrawTransaction,
  getCachedTreasuryId,
  setCachedTreasuryId,
  // For tribe-token telemetrics parity with TribeVaultPanel
  fetchTribeVault,
  fetchCollateralVault,
  fetchMemberBalance,
  getCachedVaultId,
  setCachedVaultId,
  discoverVaultIdForTribe,
  type MemberCapInfo,
  type CorpState,
  type TreasuryState,
  type TreasuryActivity,
  type TribeVaultState,
  type CollateralVaultState,
} from "../lib";

// ── helpers ──────────────────────────────────────────────────────────────────

function readDigest(result: unknown): string | undefined {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    return (r["digest"] ?? r["txDigest"] ?? r["transactionDigest"]) as string | undefined;
  }
}

function extractCreatedIds(result: unknown): string[] {
  try {
    const r = result as Record<string, unknown>;
    const effects = r["effects"] as Record<string, unknown> | undefined;
    const created = (effects?.["created"] ?? r["created"]) as Array<{ reference?: { objectId: string }; objectId?: string }> | undefined;
    return (created ?? []).map(c => c.reference?.objectId ?? c.objectId ?? "").filter(Boolean);
  } catch { return []; }
}

function suiAmount(mist: bigint): string {
  const sui = Number(mist) / 1e9;
  return sui.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function roleLabel(role: number): string {
  return role >= 2 ? "Director" : role === 1 ? "Officer" : "Member";
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
      minWidth: "140px",
      flex: 1,
    }}>
      <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#FF4700", fontSize: "22px", fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: "rgba(175,175,155,0.6)", fontSize: "10px", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function ActivityRow({ item }: { item: TreasuryActivity }) {
  const isDeposit = item.kind === "deposit";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      fontSize: "12px",
    }}>
      <span style={{ color: isDeposit ? "#00ff96" : "#ff9632", minWidth: "18px" }}>
        {isDeposit ? "▲" : "▼"}
      </span>
      <span style={{ color: isDeposit ? "#00ff96" : "#ff9632", fontWeight: 600, minWidth: "80px" }}>
        {isDeposit ? "+" : "−"}{item.amount.toFixed(4)} SUI
      </span>
      <span style={{ color: "rgba(175,175,155,0.6)" }}>{shortAddr(item.actor)}</span>
      <span style={{ marginLeft: "auto", color: "rgba(175,175,155,0.55)" }}>
        {new Date(item.timestampMs).toLocaleTimeString()}
      </span>
    </div>
  );
}

// ── Setup flow ────────────────────────────────────────────────────────────────

function CorpSetupForm({ onSuccess }: { onSuccess: () => void }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-fetch tribe_id from the character on-chain
  const { data: tribeId, isLoading: tribeLoading } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : null,
    enabled: !!account?.address,
  });

  // Corp name is derived from the tribe_id — no user input needed
  const corpName = tribeId != null ? String(tribeId) : null;

  const handleInit = async () => {
    if (!account || !corpName) return;
    setBusy(true); setErr(null);
    try {
      const tx = buildInitializeCorpTransaction(corpName, account.address);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const ids = extractCreatedIds(result);
      if (ids.length >= 3) {
        setCachedTreasuryId("pending", ids[ids.length - 1]);
      }
      readDigest(result);
      onSuccess();
    } catch (e) {
      setErr(translateTxError(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: "440px" }}>
      <h3 style={{ color: "#FF4700", marginBottom: "8px" }}>FOUND CORPORATION</h3>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
        No tribe found. Initialize your tribe + treasury in one transaction.
      </p>

      {tribeLoading ? (
        <div style={{ color: "rgba(175,175,155,0.6)", fontSize: "13px", marginBottom: "16px" }}>
          Reading character tribe from chain…
        </div>
      ) : tribeId == null ? (
        <div style={{ color: "#ff6432", fontSize: "13px", marginBottom: "16px" }}>
          ⚠ No character found for this wallet. Make sure EVE Vault is connected.
        </div>
      ) : (
        <div style={{
          background: "#161616",
          border: "1px solid rgba(255,71,0,0.25)",
          borderRadius: "2px",
          padding: "10px 14px",
          marginBottom: "14px",
        }}>
          <div style={{ color: "#888", fontSize: "11px", marginBottom: "2px" }}>TRIBE NAME (FROM TRIBE ID)</div>
          <div style={{ color: "#FF4700", fontSize: "16px", fontWeight: 700, fontFamily: "monospace" }}>
            {corpName}
          </div>
          <div style={{ color: "rgba(175,175,155,0.55)", fontSize: "10px", marginTop: "3px" }}>tribe_id {tribeId} · read from Character on-chain</div>
        </div>
      )}

      <button
        className="accent-button"
        onClick={handleInit}
        disabled={busy || !corpName || !account}
        style={{ width: "100%", padding: "10px" }}
      >
        {busy ? "Initializing…" : "Found Tribe + Create Treasury"}
      </button>
      {err && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {err}</div>}
    </div>
  );
}

// ── Treasury connect (if ID not cached) ──────────────────────────────────────

function TreasuryConnectForm({ corpId, onConnect }: { corpId: string; onConnect: (id: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="card" style={{ maxWidth: "440px" }}>
      <h3 style={{ color: "#FF4700", marginBottom: "8px" }}>Connect Treasury</h3>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "12px" }}>
        Tribe found. Enter the Treasury object ID (from init tx effects).
      </p>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="0x… treasury object ID"
        style={{
          width: "100%",
          background: "#161616",
          border: "1px solid rgba(255,71,0,0.35)",
          borderRadius: "2px",
          color: "#FF4700",
          fontSize: "12px",
          padding: "9px 12px",
          outline: "none",
          marginBottom: "10px",
          boxSizing: "border-box",
          fontFamily: "monospace",
        }}
      />
      <button
        className="accent-button"
        onClick={() => { if (value.trim()) { setCachedTreasuryId(corpId, value.trim()); onConnect(value.trim()); } }}
        disabled={!value.trim()}
        style={{ width: "100%", padding: "9px" }}
      >
        Connect
      </button>
    </div>
  );
}

// ── Main treasury dashboard ───────────────────────────────────────────────────

function TreasuryDashboard({
  treasury,
  corp,
  cap,
  onTxSuccess,
}: {
  treasury: TreasuryState;
  corp: CorpState;
  cap: MemberCapInfo;
  onTxSuccess: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirector = cap.role >= 2;

  const { data: activity } = useQuery<TreasuryActivity[]>({
    queryKey: ["treasuryActivity", treasury.objectId],
    queryFn: () => fetchTreasuryActivity(treasury.objectId),
    staleTime: 30_000,
  });

  const exec = async (tx: ReturnType<typeof buildDepositTransaction>) => {
    setBusy(true); setErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      onTxSuccess();
    } catch (e) {
      setErr(translateTxError(e));
    } finally { setBusy(false); }
  };

  const handleDeposit = () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0 || !account) return;
    exec(buildDepositTransaction(treasury.objectId, corp.corpId, amt));
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0 || !account) return;
    exec(buildWithdrawTransaction(treasury.objectId, corp.corpId, cap.objectId, amt, account.address));
  };

  return (
    <div>
      {/* Tribe header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <div>
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px" }}>
            {corp.name}
          </div>
          <div style={{ color: "rgba(175,175,155,0.6)", fontSize: "12px" }}>
            {corp.memberCount} member{corp.memberCount !== 1 ? "s" : ""} · Founder: {shortAddr(corp.founder)} · Role: <span style={{ color: "#FF4700" }}>{roleLabel(cap.role)}</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{
            padding: "3px 10px", borderRadius: "0", fontSize: "11px", fontWeight: 700,
            background: corp.active ? "rgba(0,255,150,0.1)" : "rgba(255,71,0,0.1)",
            color: corp.active ? "#00ff96" : "#ff6432",
            border: `1px solid ${corp.active ? "#00ff9640" : "#ff643240"}`,
          }}>
            {corp.active ? "● ACTIVE" : "○ INACTIVE"}
          </span>
        </div>
      </div>

      {/* Stats — SUI treasury balance */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatBox label="TREASURY BALANCE" value={`${suiAmount(treasury.balanceMist)} SUI`} sub="available" />
        <StatBox label="TOTAL DEPOSITED" value={`${suiAmount(treasury.totalDepositedMist)} SUI`} />
        <StatBox label="TOTAL WITHDRAWN" value={`${suiAmount(treasury.totalWithdrawnMist)} SUI`} />
      </div>

      {/* Tribe-token telemetrics — same view TribeVaultPanel renders, surfaced */}
      {/* here so treasurers see the minted-token state alongside SUI balance.    */}
      <TokenTelemetricsRow corpName={corp.name} />

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* Deposit */}
        <div style={{
          flex: 1, minWidth: "200px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(0,255,150,0.15)",
          borderRadius: "0",
          padding: "14px",
        }}>
          <div style={{ color: "#00ff96", fontWeight: 600, marginBottom: "10px", fontSize: "13px" }}>▲ Deposit SUI</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="number"
              value={depositAmt}
              onChange={e => setDepositAmt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleDeposit()}
              placeholder="Amount (SUI)"
              min="0"
              style={{
                flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
              }}
            />
            <button className="accent-button" onClick={handleDeposit}
              disabled={busy || !depositAmt || parseFloat(depositAmt) <= 0}
              style={{ padding: "7px 14px", fontSize: "13px", background: "rgba(0,255,150,0.15)", borderColor: "#00ff9640", color: "#00ff96" }}>
              {busy ? "…" : "Deposit"}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div style={{
          flex: 1, minWidth: "200px",
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${isDirector ? "rgba(255,150,50,0.2)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: "0",
          padding: "14px",
          opacity: isDirector ? 1 : 0.4,
        }}>
          <div style={{ color: "#ff9632", fontWeight: 600, marginBottom: "10px", fontSize: "13px" }}>
            ▼ Withdraw SUI {!isDirector && <span style={{ color: "rgba(175,175,155,0.55)", fontWeight: 400 }}>(Director only)</span>}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="number"
              value={withdrawAmt}
              onChange={e => setWithdrawAmt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && isDirector && handleWithdraw()}
              placeholder="Amount (SUI)"
              min="0"
              disabled={!isDirector}
              style={{
                flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px", color: "#fff", fontSize: "13px", padding: "7px 10px", outline: "none",
              }}
            />
            <button className="ghost-button" onClick={handleWithdraw}
              disabled={busy || !isDirector || !withdrawAmt || parseFloat(withdrawAmt) <= 0}
              style={{ padding: "7px 14px", fontSize: "13px" }}>
              {busy ? "…" : "Withdraw"}
            </button>
          </div>
        </div>
      </div>

      {err && <div style={{ color: "#ff6432", fontSize: "12px", marginBottom: "12px" }}>⚠ {err}</div>}

      {/* Activity log */}
      <div>
        <div style={{ color: "#888", fontSize: "11px", letterSpacing: "0.06em", marginBottom: "8px" }}>
          RECENT ACTIVITY
        </div>
        {!activity?.length ? (
          <div style={{ color: "rgba(175,175,155,0.55)", fontSize: "12px" }}>No transactions yet</div>
        ) : (
          activity.slice(0, 10).map((item, i) => <ActivityRow key={i} item={item} />)
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Props = { onTxSuccess?: (digest?: string) => void };

export function TreasuryPanel({ onTxSuccess }: Props) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const queryClient = useQueryClient();
  const [manualTreasuryId, setManualTreasuryId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{
    cap: MemberCapInfo | null;
    corp: CorpState | null;
    treasury: TreasuryState | null;
  }>({
    queryKey: ["corpTreasury", account?.address, manualTreasuryId],
    queryFn: async () => {
      if (!account?.address) return { cap: null, corp: null, treasury: null };
      const cap = await fetchMemberCap(account.address);
      if (!cap) return { cap: null, corp: null, treasury: null };
      const [corp, cachedTreasuryId] = await Promise.all([
        fetchCorpState(cap.corpId),
        Promise.resolve(manualTreasuryId ?? getCachedTreasuryId(cap.corpId)),
      ]);
      const treasury = cachedTreasuryId ? await fetchTreasuryState(cachedTreasuryId) : null;
      return { cap, corp, treasury };
    },
    enabled: !!account?.address,
    staleTime: 15_000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["corpTreasury"] });
    refetch();
    onTxSuccess?.();
  };

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Connect EVE Vault to manage your tribe treasury
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
        Loading tribe state…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ color: "#ff6432", padding: "16px" }}>
        Failed to load: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  // No MemberCap → no tribe → show setup
  if (!data?.cap) {
    return <CorpSetupForm onSuccess={handleRefresh} />;
  }

  // Tribe found but no Treasury ID yet
  if (!data?.treasury) {
    return (
      <TreasuryConnectForm
        corpId={data.cap.corpId}
        onConnect={(id) => { setManualTreasuryId(id); refetch(); }}
      />
    );
  }

  return (
    <TreasuryDashboard
      treasury={data.treasury}
      corp={data.corp!}
      cap={data.cap}
      onTxSuccess={handleRefresh}
    />
  );
}

// ── Tribe token telemetrics (parity with TribeVaultPanel) ────────────────────
//
// Surfaces the same numbers TribeVaultPanel shows in its STAT row + the EVE
// collateral box: Circulating, Infra Cap, Issuable, Your Balance, Mint Ratio,
// Floor Price. Treasurers reading this panel see SUI balance AT THE TOP and
// the minted-token economy DIRECTLY BELOW so the two related-but-distinct
// pools are obvious.
//
// Discovery: corp.name carries the tribeId (set during initialize_corp), so we
// resolve TribeVault via the same cached → discoverVaultIdFromChain path
// TribeVaultPanel uses. If a tribe never launched a coin (no vault) the row
// renders a one-line "no token launched yet" notice and stays out of the way.

function fmtToken(raw: number): string {
  if (raw <= 0) return "0";
  const n = raw / 1e9; // tribe tokens use 9 decimals like SUI
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "k";
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function TokenTelemetricsRow({ corpName }: { corpName: string }) {
  const { account } = useVerifiedAccountContext();

  // corp.name is the stringified tribe_id (set at corp init). Bail early if
  // we somehow ended up with a non-numeric name.
  const tribeId = /^\d+$/.test(corpName) ? parseInt(corpName, 10) : null;

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", "treasury", tribeId],
    queryFn: async () => {
      if (!tribeId) return null;
      let vaultId = getCachedVaultId(tribeId);
      if (!vaultId) {
        vaultId = await discoverVaultIdForTribe(tribeId);
        if (vaultId) setCachedVaultId(tribeId, vaultId);
      }
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId,
    staleTime: 15_000,
  });

  const { data: cv } = useQuery<CollateralVaultState | null>({
    queryKey: ["collateralVault", vault?.objectId],
    queryFn: () => vault ? fetchCollateralVault(vault.objectId) : Promise.resolve(null),
    enabled: !!vault?.objectId,
    staleTime: 30_000,
  });

  const { data: myBalance } = useQuery<number>({
    queryKey: ["myVaultBalance", "treasury", vault?.objectId, account?.address],
    queryFn: () => (vault && account) ? fetchMemberBalance(vault.balancesTableId, account.address) : 0,
    enabled: !!vault?.balancesTableId && !!account?.address,
    staleTime: 15_000,
  });

  if (vaultLoading) {
    return (
      <div style={teleSectionWrap}>
        <div style={teleHeader}>Tribe Token</div>
        <div style={teleSub}>Loading…</div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div style={teleSectionWrap}>
        <div style={teleHeader}>Tribe Token</div>
        <div style={teleSub}>
          No token launched for this tribe yet. Initialize one in the <strong>Tribe Token</strong> tab to
          unlock minting, infra-backed issuance, and EVE-collateralized supply.
        </div>
      </div>
    );
  }

  const infraCredits = vault.infraCredits ?? 0;
  const issuable = Math.max(0, infraCredits - vault.totalSupply);
  const cappedPct = infraCredits > 0 ? Math.min(100, (vault.totalSupply / infraCredits) * 100) : 0;

  return (
    <div style={teleSectionWrap}>
      <div style={teleHeader}>Tribe Token — {vault.coinSymbol}</div>

      <div style={{ display: "flex", gap: "10px", marginBottom: cv ? "12px" : "0", flexWrap: "wrap" }}>
        <StatBox label="CIRCULATING" value={fmtToken(vault.totalSupply)} sub={vault.coinSymbol} />
        <StatBox
          label="INFRA CAP"
          value={fmtToken(infraCredits)}
          sub={infraCredits > 0 ? `${cappedPct.toFixed(1)}% used` : "no infra registered"}
        />
        <StatBox label="ISSUABLE" value={fmtToken(issuable)} sub="remaining cap" />
        <StatBox label="YOUR BALANCE" value={fmtToken(myBalance ?? 0)} sub={vault.coinSymbol} />
      </div>

      {cv && (
        <div style={{
          display: "flex", gap: 14, padding: "10px 14px",
          background: "rgba(0,255,150,0.04)", border: "1px solid rgba(0,255,150,0.18)",
          borderRadius: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={teleMiniLabel}>EVE-COLLATERALIZED</div>
            <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
              <div>
                <div style={{ color: "#00ff96", fontSize: 16, fontWeight: 700 }}>{cv.mintRatio}</div>
                <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 10 }}>
                  Mint Ratio · 1 EVE = {cv.mintRatio} {vault.coinSymbol}
                </div>
              </div>
              <div>
                <div style={{ color: "#00ff96", fontSize: 16, fontWeight: 700 }}>
                  {cv.mintRatio > 0 ? (1 / cv.mintRatio).toFixed(6) : "—"}
                </div>
                <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 10 }}>
                  Floor Price · EVE per {vault.coinSymbol}
                </div>
              </div>
              <div>
                <div style={{ color: "#00ff96", fontSize: 16, fontWeight: 700 }}>{fmtToken(cv.totalMinted)}</div>
                <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 10 }}>Total Minted</div>
              </div>
              <div>
                <div style={{ color: "#00ff96", fontSize: 16, fontWeight: 700 }}>{fmtToken(cv.totalRedeemed)}</div>
                <div style={{ color: "rgba(175,175,155,0.55)", fontSize: 10 }}>Total Redeemed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: "rgba(175,175,155,0.45)" }}>
        Token actions (mint / redeem / issue infra-backed) live in the <strong>Tribe Token</strong> tab.
      </div>
    </div>
  );
}

const teleSectionWrap: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,71,0,0.12)",
  borderRadius: 0, padding: "14px 16px", marginBottom: "20px",
};
const teleHeader: React.CSSProperties = {
  color: "#FF4700", fontWeight: 600, fontSize: 13, marginBottom: 12,
};
const teleSub: React.CSSProperties = {
  color: "rgba(175,175,155,0.55)", fontSize: 12, lineHeight: 1.5,
};
const teleMiniLabel: React.CSSProperties = {
  fontSize: 10, color: "rgba(180,180,160,0.6)", letterSpacing: 0.5, textTransform: "uppercase",
};
