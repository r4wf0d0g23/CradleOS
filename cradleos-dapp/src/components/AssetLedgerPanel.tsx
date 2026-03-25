/**
 * AssetLedgerPanel — Full tribe asset picture.
 * Sections: Registered Infrastructure, Tribe Coin Supply, Treasury, DEX Liquidity, Member Balances.
 * Each section loads independently via its own React Query.
 */
import { useQuery } from "@tanstack/react-query";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import type { ReactNode } from "react";
import { SUI_TESTNET_RPC, CRADLEOS_PKG } from "../constants";
import {
  numish,
  fetchCharacterTribeId, getCachedVaultId, fetchTribeVault,
  fetchDexState, fetchOrderFilledEvents, discoverDexIdForVault,
  getCachedDexId, setCachedDexId,
  fetchTreasuryState, fetchTreasuryActivity,
  type TribeVaultState, type DexState, type OrderFilledEvent,
  type TreasuryState, type TreasuryActivity,
} from "../lib";

// ── internal types ────────────────────────────────────────────────────────────

type InfraEntry = {
  structureId: string;
  energyCost: number;
};

type MemberBalance = {
  address: string;
  balance: number;
};

// ── rpc helpers ───────────────────────────────────────────────────────────────

async function fetchInfraEntries(tableId: string): Promise<InfraEntry[]> {
  if (!tableId) return [];
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getDynamicFields",
      params: [tableId, null, 100],
    }),
  });
  const j = await res.json() as {
    result?: { data?: Array<{ name: { value: string }; objectId: string }> };
  };
  const entries = j.result?.data ?? [];
  const results = await Promise.all(
    entries.map(async (entry) => {
      const objRes = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "sui_getObject",
          params: [entry.objectId, { showContent: true }],
        }),
      });
      const obj = await objRes.json() as {
        result?: { data?: { content?: { fields?: Record<string, unknown> } } };
      };
      const f = obj.result?.data?.content?.fields ?? {};
      const energyCost = numish(f["value"]) ?? 0;
      return { structureId: String(entry.name.value), energyCost };
    })
  );
  return results;
}

async function fetchAllMemberBalances(tableId: string): Promise<MemberBalance[]> {
  if (!tableId) return [];
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getDynamicFields",
      params: [tableId, null, 100],
    }),
  });
  const j = await res.json() as {
    result?: { data?: Array<{ name: { value: string }; objectId: string }> };
  };
  const entries = j.result?.data ?? [];
  const results = await Promise.all(
    entries.map(async (entry) => {
      const objRes = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "sui_getObject",
          params: [entry.objectId, { showContent: true }],
        }),
      });
      const obj = await objRes.json() as {
        result?: { data?: { content?: { fields?: Record<string, unknown> } } };
      };
      const f = obj.result?.data?.content?.fields ?? {};
      const balance = numish(f["value"]) ?? 0;
      return { address: String(entry.name.value), balance };
    })
  );
  return results.sort((a, b) => b.balance - a.balance);
}

/** Discover treasury ID for a vault via TreasuryCreated events.
 *  Falls back to localStorage cache. Returns null if not found. */
async function discoverTreasuryForVault(vaultId: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(`cradleos:treasury:vault:${vaultId}`);
    if (cached) return cached;
  } catch { /* */ }
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_PKG}::treasury::TreasuryCreated` },
          null, 50, false,
        ],
      }),
    });
    const j = await res.json() as {
      result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> };
    };
    const match = (j.result?.data ?? []).find(
      (e) => e.parsedJson?.vault_id === vaultId || e.parsedJson?.corp_id === vaultId
    );
    if (match) {
      const id = String(match.parsedJson?.treasury_id ?? "");
      if (id) {
        try { localStorage.setItem(`cradleos:treasury:vault:${vaultId}`, id); } catch { /* */ }
        return id;
      }
    }
  } catch { /* */ }
  return null;
}

/** Fetch last filled price from OrderFilled events for this DEX. */
function lastPrice(events: OrderFilledEvent[]): number | null {
  if (!events.length) return null;
  return events[0].pricePerUnit;
}

// ── display helpers ───────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

// ── shared UI primitives ──────────────────────────────────────────────────────

function LoadingRow({ label }: { label: string }) {
  return (
    <div style={{ color: "rgba(107,107,94,0.45)", fontSize: "12px", padding: "6px 0" }}>
      {label}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ color: "rgba(107,107,94,0.45)", fontSize: "12px" }}>{text}</div>
  );
}

function SectionCard({
  title,
  accentColor = "#FF4700",
  children,
}: {
  title: string;
  accentColor?: string;
  children: ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "0",
      padding: "14px 16px",
      marginBottom: "14px",
    }}>
      <div style={{
        color: accentColor,
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        marginBottom: "12px",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KVRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
      <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px" }}>{label}</span>
      <span style={{
        color: "#c8c8b8", fontSize: "12px",
        fontFamily: mono ? "monospace" : undefined,
      }}>{value}</span>
    </div>
  );
}

// ── Registered Infrastructure section ────────────────────────────────────────

function InfraSection({ vault }: { vault: TribeVaultState }) {
  const { data: infra, isLoading } = useQuery<InfraEntry[]>({
    queryKey: ["infraEntries", vault.registeredInfraTableId],
    queryFn: () => fetchInfraEntries(vault.registeredInfraTableId),
    enabled: !!vault.registeredInfraTableId,
    staleTime: 30_000,
  });

  const totalEnergy = (infra ?? []).reduce((sum, e) => sum + e.energyCost, 0);

  return (
    <SectionCard title="Registered Infrastructure" accentColor="#FF4700">
      {isLoading ? (
        <LoadingRow label="Fetching structures…" />
      ) : !infra?.length ? (
        <EmptyRow text="No structures registered to this vault." />
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px",
            gap: "4px 8px",
            marginBottom: "10px",
          }}>
            <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.06em" }}>STRUCTURE ID</span>
            <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.06em", textAlign: "right" }}>ENERGY</span>
            {infra.map((e) => (
              <>
                <span key={e.structureId + "-id"} style={{ fontFamily: "monospace", fontSize: "11px", color: "#888" }}>
                  {shortAddr(e.structureId)}
                </span>
                <span key={e.structureId + "-cost"} style={{ fontSize: "11px", color: "#c8c8b8", textAlign: "right" }}>
                  {fmt(e.energyCost)}
                </span>
              </>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <KVRow label="Structures registered" value={infra.length} />
            <KVRow label="Total energy credit basis" value={fmt(totalEnergy)} />
            <KVRow label="Infra credits (on-chain)" value={fmt(vault.infraCredits)} />
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Tribe Coin Supply section ─────────────────────────────────────────────────

function CoinSupplySection({
  vault,
  dexEvents,
  dexEventsLoading,
}: {
  vault: TribeVaultState;
  dexEvents: OrderFilledEvent[] | undefined;
  dexEventsLoading: boolean;
}) {
  const price = dexEvents ? lastPrice(dexEvents) : null;

  return (
    <SectionCard title="Tribe Coin Supply" accentColor="#00ff96">
      <KVRow label="Name" value={vault.coinName || "—"} />
      <KVRow label="Symbol" value={vault.coinSymbol || "—"} />
      <KVRow label="Total supply (units)" value={fmt(vault.totalSupply)} />
      <KVRow
        label="EVE / coin (DEX last fill)"
        value={
          dexEventsLoading
            ? "Loading…"
            : price !== null
            ? fmt(price)
            : "No trades yet"
        }
      />
    </SectionCard>
  );
}

// ── Treasury section ──────────────────────────────────────────────────────────

function TreasurySection({ vault }: { vault: TribeVaultState }) {
  const { data: treasuryId, isLoading: tidLoading } = useQuery<string | null>({
    queryKey: ["treasuryForVault", vault.objectId],
    queryFn: () => discoverTreasuryForVault(vault.objectId),
    staleTime: 60_000,
  });

  const { data: treasury, isLoading: tLoading } = useQuery<TreasuryState | null>({
    queryKey: ["treasuryState", treasuryId],
    queryFn: () => (treasuryId ? fetchTreasuryState(treasuryId) : Promise.resolve(null)),
    enabled: !!treasuryId,
    staleTime: 20_000,
  });

  const { data: activity, isLoading: actLoading } = useQuery<TreasuryActivity[]>({
    queryKey: ["treasuryActivity", treasuryId],
    queryFn: () => (treasuryId ? fetchTreasuryActivity(treasuryId) : Promise.resolve([])),
    enabled: !!treasuryId,
    staleTime: 30_000,
  });

  const loading = tidLoading || tLoading;

  return (
    <SectionCard title="Treasury" accentColor="#ffcc44">
      {loading ? (
        <LoadingRow label="Discovering treasury…" />
      ) : !treasury ? (
        <EmptyRow text="No treasury linked to this vault." />
      ) : (
        <>
          <KVRow label="Treasury ID" value={shortAddr(treasury.objectId)} mono />
          <KVRow label="Balance (SUI)" value={treasury.balanceSui.toFixed(4)} />
          <KVRow label="Total deposited" value={(Number(treasury.totalDepositedMist) / 1e9).toFixed(4)} />
          <KVRow label="Total withdrawn" value={(Number(treasury.totalWithdrawnMist) / 1e9).toFixed(4)} />

          <div style={{ marginTop: "12px" }}>
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "6px" }}>
              RECENT ACTIVITY
            </div>
            {actLoading ? (
              <LoadingRow label="Loading activity…" />
            ) : !activity?.length ? (
              <EmptyRow text="No transactions recorded." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {activity.slice(0, 10).map((a, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "8px", fontSize: "11px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "4px",
                  }}>
                    <span style={{
                      color: a.kind === "deposit" ? "#00ff96" : "#ff6432",
                      minWidth: "64px", fontWeight: 600, fontSize: "10px",
                    }}>
                      {a.kind === "deposit" ? "DEPOSIT" : "WITHDRAW"}
                    </span>
                    <span style={{ color: "#c8c8b8", flex: 1 }}>{a.amount.toFixed(4)} SUI</span>
                    <span style={{ color: "rgba(107,107,94,0.55)", fontFamily: "monospace" }}>{shortAddr(a.actor)}</span>
                    <span style={{ color: "rgba(107,107,94,0.4)", fontSize: "10px" }}>
                      {a.timestampMs ? new Date(a.timestampMs).toLocaleDateString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── DEX Liquidity section ─────────────────────────────────────────────────────

function DexSection({
  vault,
  dexId,
  dexIdLoading,
}: {
  vault: TribeVaultState;
  dexId: string | null | undefined;
  dexIdLoading: boolean;
}) {
  const { data: dex, isLoading: dexLoading } = useQuery<DexState | null>({
    queryKey: ["dexState", dexId],
    queryFn: () => (dexId ? fetchDexState(dexId) : Promise.resolve(null)),
    enabled: !!dexId,
    staleTime: 20_000,
  });

  const { data: trades, isLoading: tradesLoading } = useQuery<OrderFilledEvent[]>({
    queryKey: ["dexTrades", dexId],
    queryFn: () => (dexId ? fetchOrderFilledEvents(dexId) : Promise.resolve([])),
    enabled: !!dexId,
    staleTime: 30_000,
  });

  const loading = dexIdLoading || dexLoading;

  return (
    <SectionCard title="DEX Liquidity" accentColor="#64b4ff">
      {loading ? (
        <LoadingRow label="Discovering DEX…" />
      ) : !dex ? (
        <EmptyRow text={`No DEX found for this vault. Create one in the ${vault.coinSymbol || "Tribe"} Coin tab.`} />
      ) : (
        <>
          <KVRow label="DEX ID" value={shortAddr(dex.objectId)} mono />
          <KVRow label="Last fill price (EVE/coin)" value={dex.lastPrice > 0 ? fmt(dex.lastPrice) : "—"} />
          <KVRow label="Total volume (coin units)" value={fmt(dex.totalVolumeRaw)} />
          <KVRow label="Total volume (EVE)" value={fmt(dex.totalVolumePayment)} />
          <KVRow label="Open orders" value={dex.nextOrderId > 0 ? `${dex.nextOrderId} created` : "0"} />

          <div style={{ marginTop: "12px" }}>
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "6px" }}>
              RECENT TRADES
            </div>
            {tradesLoading ? (
              <LoadingRow label="Loading trades…" />
            ) : !trades?.length ? (
              <EmptyRow text="No trades filled yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                  {["ORDER", "BUYER", "AMOUNT", "PRICE", "EVE PAID", "TIME"].map((h) => (
                    <span key={h} style={{
                      color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.05em",
                      flex: h === "BUYER" ? 1.5 : 1,
                    }}>{h}</span>
                  ))}
                </div>
                {trades.slice(0, 8).map((t, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "8px", fontSize: "11px", color: "#888",
                    borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "3px",
                  }}>
                    <span style={{ flex: 1, color: "rgba(107,107,94,0.55)" }}>#{t.orderId}</span>
                    <span style={{ flex: 1.5, fontFamily: "monospace" }}>{shortAddr(t.buyer)}</span>
                    <span style={{ flex: 1, color: "#c8c8b8" }}>{fmt(t.fillAmount)}</span>
                    <span style={{ flex: 1 }}>{fmt(t.pricePerUnit)}</span>
                    <span style={{ flex: 1, color: "#64b4ff" }}>{fmt(t.paymentPaid)}</span>
                    <span style={{ flex: 1, color: "rgba(107,107,94,0.4)", fontSize: "10px" }}>
                      {t.timestampMs ? new Date(t.timestampMs).toLocaleDateString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Member Balances section ───────────────────────────────────────────────────

function MemberBalancesSection({ vault }: { vault: TribeVaultState }) {
  const { data: members, isLoading } = useQuery<MemberBalance[]>({
    queryKey: ["memberBalances", vault.balancesTableId],
    queryFn: () => fetchAllMemberBalances(vault.balancesTableId),
    enabled: !!vault.balancesTableId,
    staleTime: 30_000,
  });

  const totalIssued = (members ?? []).reduce((sum, m) => sum + m.balance, 0);

  return (
    <SectionCard title="Member Balances" accentColor="#c88aff">
      {isLoading ? (
        <LoadingRow label="Fetching member balances…" />
      ) : !members?.length ? (
        <EmptyRow text="No members hold this coin yet." />
      ) : (
        <>
          <div style={{ marginBottom: "10px", display: "flex", gap: "16px" }}>
            <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
              {members.length} holder{members.length !== 1 ? "s" : ""}
            </span>
            <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
              {fmt(totalIssued)} {vault.coinSymbol || "units"} in circulation
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
              <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.05em", flex: 3 }}>ADDRESS</span>
              <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.05em", flex: 1, textAlign: "right" }}>BALANCE</span>
              <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", letterSpacing: "0.05em", flex: 1, textAlign: "right" }}>SHARE</span>
            </div>
            {members.slice(0, 20).map((m, i) => {
              const share = totalIssued > 0 ? ((m.balance / totalIssued) * 100).toFixed(1) : "0.0";
              return (
                <div key={i} style={{
                  display: "flex", gap: "8px", fontSize: "11px",
                  background: i === 0 ? "rgba(200,138,255,0.04)" : "transparent",
                  border: i === 0 ? "1px solid rgba(200,138,255,0.08)" : "1px solid transparent",
                  padding: "4px 6px",
                }}>
                  <span style={{ fontFamily: "monospace", color: "#888", flex: 3 }}>
                    {m.address.length > 8 ? shortAddr(m.address) : m.address}
                  </span>
                  <span style={{ color: "#c8c8b8", flex: 1, textAlign: "right" }}>{fmt(m.balance)}</span>
                  <span style={{ color: "rgba(200,138,255,0.8)", flex: 1, textAlign: "right", fontSize: "10px" }}>
                    {share}%
                  </span>
                </div>
              );
            })}
            {members.length > 20 && (
              <div style={{ color: "rgba(107,107,94,0.4)", fontSize: "11px", padding: "4px 0" }}>
                + {members.length - 20} more holders
              </div>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── inner panel (vault resolved) ──────────────────────────────────────────────

function AssetLedgerPanelInner({ vault }: { vault: TribeVaultState }) {
  // Discover DEX ID up-front so both CoinSupply and DEX sections can share it
  const { data: dexId, isLoading: dexIdLoading } = useQuery<string | null>({
    queryKey: ["dexId", vault.objectId],
    queryFn: async () => {
      const cached = getCachedDexId(vault.objectId);
      if (cached) return cached;
      const id = await discoverDexIdForVault(vault.objectId);
      if (id) setCachedDexId(vault.objectId, id);
      return id ?? null;
    },
    staleTime: 60_000,
  });

  // Fetch OrderFilled events once — shared across CoinSupply + DEX sections
  const { data: dexEvents, isLoading: dexEventsLoading } = useQuery<OrderFilledEvent[]>({
    queryKey: ["dexEvents", dexId],
    queryFn: () => (dexId ? fetchOrderFilledEvents(dexId) : Promise.resolve([])),
    enabled: !!dexId,
    staleTime: 30_000,
  });

  return (
    <div>
      {/* Vault summary banner */}
      <div style={{
        background: "rgba(255,71,0,0.05)",
        border: "1px solid rgba(255,71,0,0.15)",
        borderRadius: "0",
        padding: "10px 16px",
        marginBottom: "16px",
        display: "flex",
        gap: "24px",
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <div>
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "15px" }}>
            {vault.coinName || "—"}
            <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, fontSize: "12px", marginLeft: "8px" }}>
              {vault.coinSymbol}
            </span>
          </div>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "11px", fontFamily: "monospace", marginTop: "2px" }}>
            Vault: {shortAddr(vault.objectId)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ color: "#c8c8b8", fontSize: "13px", fontWeight: 600 }}>
            {fmt(vault.totalSupply)} <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, fontSize: "11px" }}>total supply</span>
          </div>
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", marginTop: "2px" }}>
            Tribe #{vault.tribeId}
          </div>
        </div>
      </div>

      <InfraSection vault={vault} />
      <CoinSupplySection vault={vault} dexEvents={dexEvents} dexEventsLoading={dexEventsLoading} />
      <TreasurySection vault={vault} />
      <DexSection vault={vault} dexId={dexId} dexIdLoading={dexIdLoading} />
      <MemberBalancesSection vault={vault} />
    </div>
  );
}

// ── public export ─────────────────────────────────────────────────────────────

export function AssetLedgerPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;

  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => (account ? fetchCharacterTribeId(account.address) : Promise.resolve(null)),
    enabled: !!account?.address,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      const vaultId = getCachedVaultId(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 15_000,
  });

  if (!account) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 32px", color: "#888" }}>
        <div style={{ fontSize: "14px", marginBottom: "8px" }}>Connect wallet to view asset ledger</div>
        <div style={{ fontSize: "11px", color: "rgba(107,107,94,0.4)" }}>
          Requires an in-game character linked to this address
        </div>
      </div>
    );
  }

  if (vaultLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 32px", color: "rgba(107,107,94,0.45)" }}>
        Loading vault data…
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 32px", color: "#888" }}>
        <div style={{ fontSize: "14px", marginBottom: "8px" }}>No tribe vault found</div>
        <div style={{ fontSize: "11px", color: "rgba(107,107,94,0.4)" }}>
          Create a vault in the Tribe Coin tab first.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{
        color: "#aaa",
        fontWeight: 700,
        fontSize: "16px",
        marginBottom: "16px",
        letterSpacing: "0.04em",
      }}>
        Asset Ledger
      </div>
      <AssetLedgerPanelInner vault={vault} />
    </div>
  );
}
