import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
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
  type MemberCapInfo,
  type CorpState,
  type TreasuryState,
  type TreasuryActivity,
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
      {sub && <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "10px", marginTop: "2px" }}>{sub}</div>}
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
      <span style={{ color: "rgba(107,107,94,0.6)" }}>{shortAddr(item.actor)}</span>
      <span style={{ marginLeft: "auto", color: "rgba(107,107,94,0.55)" }}>
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
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: "440px" }}>
      <h3 style={{ color: "#FF4700", marginBottom: "8px" }}>FOUND CORPORATION</h3>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
        No tribe found. Initialize your tribe + treasury in one transaction.
      </p>

      {tribeLoading ? (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "16px" }}>
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
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px", marginTop: "3px" }}>tribe_id {tribeId} · read from Character on-chain</div>
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
      setErr(e instanceof Error ? e.message : String(e));
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
          <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px" }}>
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

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatBox label="TREASURY BALANCE" value={`${suiAmount(treasury.balanceMist)} SUI`} sub="available" />
        <StatBox label="TOTAL DEPOSITED" value={`${suiAmount(treasury.totalDepositedMist)} SUI`} />
        <StatBox label="TOTAL WITHDRAWN" value={`${suiAmount(treasury.totalWithdrawnMist)} SUI`} />
      </div>

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
            ▼ Withdraw SUI {!isDirector && <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400 }}>(Director only)</span>}
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
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No transactions yet</div>
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
