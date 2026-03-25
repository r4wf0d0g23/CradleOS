import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG, SUI_TESTNET_RPC, eventType } from "../constants";
import { fetchCharacterTribeId, fetchTribeVault, getCachedVaultId, discoverVaultIdForTribe, numish, fetchTribeInfo, type TribeVaultState,
  fetchTribeRoles, buildCreateRolesTx, buildGrantRoleTx, buildRevokeRoleTx, TRIBE_ROLE_NAMES, type TribeRolesState,
  fetchTribeMembersByTribeId, type CharacterMember, fetchTribeClaim,
} from "../lib";
import { fetchTribeMembersEnriched, type TribeMember } from "../graphql";

// Augmented shape — lib.ts may not yet expose all fields; we cast where needed
interface VaultFull extends TribeVaultState {
  memberCount?: number;
  infraCount?: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function short(addr: string, pre = 6, suf = 4): string {
  if (!addr || addr.length <= pre + suf + 2) return addr;
  return `${addr.slice(0, pre)}…${addr.slice(-suf)}`;
}

function timeAgo(tsMs: string | number): string {
  const diff = Date.now() - Number(tsMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{
        background: "none", border: "1px solid rgba(255,71,0,0.3)", borderRadius: 3,
        color: copied ? "#00ff96" : "#FF4700", fontSize: "10px", padding: "1px 6px",
        cursor: "pointer", marginLeft: 6, fontFamily: "monospace",
      }}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

// ─── tx builder ─────────────────────────────────────────────────────────────

function buildTransferFounderTx(vaultId: string, newFounder: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::transfer_founder`,
    arguments: [tx.object(vaultId), tx.pure.address(newFounder)],
  });
  return tx;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface CoinEvent {
  address: string;
  amount: number;
  timestampMs: string;
  vaultId: string;
}

interface InfraEvent {
  structureId: string;
  energyCost: number;
  timestampMs: string;
  vaultId: string;
}

interface InfraEntry {
  structureId: string;
  energyCost: number;
}

interface ActivityItem {
  kind: "CoinIssued" | "CoinBurned" | "InfraRegistered";
  address?: string;
  amount?: number;
  structureId?: string;
  energyCost?: number;
  timestampMs: string;
}

// ─── fetchers ────────────────────────────────────────────────────────────────

async function fetchCoinEvents(
  evtType: "CoinIssued" | "CoinBurned",
  vaultId: string,
): Promise<CoinEvent[]> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
      params: [{ MoveEventType: eventType("tribe_vault", evtType) }, null, 200, true],
    }),
  });
  const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown>; timestampMs?: string }> } };
  return (j.result?.data ?? [])
    .filter(e => String(e.parsedJson.vault_id) === vaultId)
    .map(e => ({
      address: String(e.parsedJson.recipient ?? e.parsedJson.burner ?? e.parsedJson.member ?? ""),
      amount: Number(e.parsedJson.amount ?? 0),
      timestampMs: e.timestampMs ?? "0",
      vaultId: String(e.parsedJson.vault_id ?? ""),
    }));
}

async function fetchInfraEvents(vaultId: string): Promise<InfraEvent[]> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
      params: [{ MoveEventType: eventType("tribe_vault", "InfraRegistered") }, null, 200, true],
    }),
  });
  const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown>; timestampMs?: string }> } };
  return (j.result?.data ?? [])
    .filter(e => String(e.parsedJson.vault_id) === vaultId)
    .map(e => ({
      structureId: String(e.parsedJson.structure_id ?? ""),
      energyCost: Number(e.parsedJson.energy_cost ?? 0),
      timestampMs: e.timestampMs ?? "0",
      vaultId: String(e.parsedJson.vault_id ?? ""),
    }));
}

async function fetchInfraTableId(vaultId: string): Promise<string | null> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "sui_getObject",
      params: [vaultId, { showContent: true }],
    }),
  });
  const j = await res.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
  const fields = j.result?.data?.content?.fields ?? {};
  try {
    const ri = fields.registered_infra as { fields?: { id?: { id?: string } } } | undefined;
    return ri?.fields?.id?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchInfraEntries(tableId: string): Promise<InfraEntry[]> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "suix_getDynamicFields",
      params: [tableId, null, 100],
    }),
  });
  const j = await res.json() as { result?: { data?: Array<{ name: { value: unknown }; objectId: string }> } };
  const entries = j.result?.data ?? [];

  const results: InfraEntry[] = [];
  for (const entry of entries) {
    const objRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "sui_getObject",
        params: [entry.objectId, { showContent: true }],
      }),
    });
    const objJ = await objRes.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
    const f = objJ.result?.data?.content?.fields ?? {};
    results.push({
      structureId: String(entry.name.value ?? ""),
      energyCost: Number(f.energy_cost ?? f.value ?? 0),
    });
  }
  return results;
}

// ─── sub-components ──────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,71,0,0.12)",
  padding: "14px",
  borderRadius: 6,
  marginBottom: 16,
};

const headingStyle: React.CSSProperties = {
  color: "#aaa",
  fontWeight: 700,
  fontSize: "11px",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  color: "rgba(107,107,94,0.6)",
  fontSize: "11px",
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  color: "#e0e0d0",
  fontSize: "13px",
  fontFamily: "monospace",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{children}</div>
    </div>
  );
}

// ─── section: tribe overview ─────────────────────────────────────────────────

function TribeOverviewCard({ vault }: { vault: VaultFull }) {
  const { data: worldInfo } = useQuery({
    queryKey: ["tribeInfo", vault.tribeId],
    queryFn: () => fetchTribeInfo(vault.tribeId),
    staleTime: 300_000,
  });

  const { data: onChainMembers } = useQuery<CharacterMember[]>({
    queryKey: ["tribeMembersByTribeId", vault.tribeId],
    queryFn: () => fetchTribeMembersByTribeId(vault.tribeId),
    staleTime: 60_000,
    enabled: !!vault.tribeId,
  });

  const memberCount = vault.memberCount ?? onChainMembers?.length ?? "—";
  const tribeName = worldInfo?.name || vault.coinName || "Unnamed Tribe";

  return (
    <div style={cardStyle}>
      <div style={headingStyle}>Tribe Overview</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#FF4700", marginBottom: 10 }}>
        {tribeName}
        {worldInfo?.nameShort && <span style={{ fontSize: 12, color: "rgba(107,107,94,0.6)", marginLeft: 8 }}>[{worldInfo.nameShort}]</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 32px" }}>
        <Row label="Coin">
          <span style={{ color: "#FF4700", fontWeight: 700 }}>{vault.coinName || "—"}</span>
          {vault.coinSymbol && <span style={{ color: "rgba(107,107,94,0.6)" }}> [{vault.coinSymbol}]</span>}
        </Row>
        <Row label="Tribe ID">
          <span style={{ fontFamily: "monospace" }}>{vault.tribeId}</span>
        </Row>
        <Row label="Members">{memberCount}</Row>
        <Row label="Infra Registered">{vault.infraCount ?? "—"}</Row>
      </div>
      <Row label="Founder">
        <span style={{ fontFamily: "monospace" }}>{vault.founder}</span>
        <CopyButton value={vault.founder} />
      </Row>
      <Row label="Vault Object">
        <span style={{ fontFamily: "monospace" }}>{short(vault.objectId)}</span>
        <CopyButton value={vault.objectId} />
      </Row>
    </div>
  );
}

// ─── section: member roster ───────────────────────────────────────────────────

function MemberRosterCard({
  vaultId,
  balancesTableId,
  founder,
  tribeId,
}: {
  vaultId: string;
  balancesTableId: string;
  founder: string;
  tribeId: number;
}) {
  type EnrichedMember = TribeMember & { isFounder: boolean };

  const { data: members, isLoading: membersLoading } = useQuery<EnrichedMember[]>({
    queryKey: ["tribeMembersEnriched", balancesTableId, founder, tribeId],
    queryFn: () => fetchTribeMembersEnriched(balancesTableId, founder, tribeId),
    staleTime: 30_000,
    enabled: !!balancesTableId,
  });

  // On-chain Character objects by tribe_id — works even before any tokens are issued
  const { data: onChainMembers, isLoading: onChainLoading } = useQuery<CharacterMember[]>({
    queryKey: ["tribeMembersByTribeId", tribeId],
    queryFn: () => fetchTribeMembersByTribeId(tribeId),
    staleTime: 60_000,
    enabled: !!tribeId,
  });

  // If no balancesTable (vault not yet populated), fall back to coin-event scan
  const { data: issued } = useQuery<CoinEvent[]>({
    queryKey: ["coinIssued", vaultId],
    queryFn: () => fetchCoinEvents("CoinIssued", vaultId),
    staleTime: 15_000,
    enabled: !balancesTableId,
  });

  // Derive fallback roster from events when GraphQL path is unavailable
  const fallbackRoster = (() => {
    if (balancesTableId || !issued) return [];
    const map: Record<string, number> = {};
    for (const e of issued) map[e.address] = (map[e.address] ?? 0) + e.amount;
    return Object.entries(map)
      .map(([addr, bal]) => ({ address: addr, balance: bal, charName: undefined as string | undefined, isFounder: addr.toLowerCase() === founder.toLowerCase() }))
      .sort((a, b) => b.balance - a.balance);
  })();

  // Merge: vault-balance roster takes precedence; augment with on-chain Character members
  const mergedRoster = (() => {
    if (members && members.length > 0) return members;
    if (fallbackRoster.length > 0) return fallbackRoster;
    // Fall back to on-chain character roster (no balance data)
    return (onChainMembers ?? []).map(m => ({
      address: m.characterAddress || m.characterId,
      balance: 0,
      charName: undefined as string | undefined,
      isFounder: (m.characterAddress || m.characterId).toLowerCase() === founder.toLowerCase(),
    }));
  })();

  const isLoading = membersLoading || onChainLoading;
  const roster = mergedRoster;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={headingStyle}>Member Roster</div>
        {roster.length > 0 && (
          <span style={{ fontSize: 10, color: "rgba(107,107,94,0.6)", fontFamily: "monospace" }}>
            {roster.length} member{roster.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {isLoading && <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Loading members via GraphQL…</div>}
      {!isLoading && roster.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>
          No tribe members found on-chain yet.
        </div>
      )}
      {!isLoading && roster.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* header row */}
          <div style={{ display: "flex", gap: 8, fontSize: "10px", color: "rgba(107,107,94,0.6)", paddingBottom: 4, borderBottom: "1px solid rgba(255,71,0,0.08)" }}>
            <span style={{ flex: "0 0 140px" }}>Pilot</span>
            <span style={{ flex: "1 1 auto" }}>Address</span>
            <span style={{ flex: "0 0 90px", textAlign: "right" }}>CRDL Balance</span>
            <span style={{ flex: "0 0 70px", textAlign: "right" }}>Role</span>
          </div>
          {roster.map(m => (
            <div key={m.address} style={{ display: "flex", gap: 8, fontSize: "12px", alignItems: "center" }}>
              <span style={{ flex: "0 0 140px", color: m.isFounder ? "#FF4700" : "#e0e0d0", fontWeight: m.isFounder ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.charName ?? "—"}
              </span>
              <span style={{ flex: "1 1 auto", fontFamily: "monospace", fontSize: 10, color: "rgba(107,107,94,0.6)" }}>
                {short(m.address)}
              </span>
              <span style={{ flex: "0 0 90px", textAlign: "right", color: m.balance > 0 ? "#00ff96" : "rgba(107,107,94,0.3)", fontFamily: "monospace" }}>
                {m.balance > 0 ? m.balance.toLocaleString() : "—"}
              </span>
              <span style={{ flex: "0 0 70px", textAlign: "right" }}>
                {m.isFounder ? (
                  <span style={{ fontSize: 10, color: "#FF4700", fontWeight: 700, letterSpacing: "0.08em" }}>FOUNDER</span>
                ) : (
                  <span style={{ fontSize: 10, color: "rgba(107,107,94,0.5)", letterSpacing: "0.06em" }}>MEMBER</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── section: registered infrastructure ──────────────────────────────────────

function InfraCard({ vaultId }: { vaultId: string }) {
  const { data: tableId, isLoading: loadingTableId } = useQuery<string | null>({
    queryKey: ["infraTableId", vaultId],
    queryFn: () => fetchInfraTableId(vaultId),
    staleTime: 30_000,
  });

  const { data: entries, isLoading: loadingEntries } = useQuery<InfraEntry[]>({
    queryKey: ["infraEntries", tableId],
    queryFn: () => tableId ? fetchInfraEntries(tableId) : Promise.resolve([]),
    enabled: !!tableId,
    staleTime: 30_000,
  });

  const loading = loadingTableId || loadingEntries;
  const totalEnergy = (entries ?? []).reduce((s, e) => s + e.energyCost, 0);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={headingStyle}>Registered Infrastructure</div>
        {(entries ?? []).length > 0 && (
          <div style={{ fontSize: "11px", color: "#aaa" }}>
            Total energy: <span style={{ color: "#FF4700", fontWeight: 700 }}>{numish(totalEnergy)}</span>
          </div>
        )}
      </div>
      {loading && <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Loading infrastructure…</div>}
      {!loading && (!entries || entries.length === 0) && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>No registered infrastructure found.</div>
      )}
      {!loading && entries && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, fontSize: "10px", color: "rgba(107,107,94,0.6)", paddingBottom: 4, borderBottom: "1px solid rgba(255,71,0,0.08)" }}>
            <span style={{ flex: 1 }}>Structure ID</span>
            <span style={{ flex: "0 0 100px", textAlign: "right" }}>Energy Cost</span>
          </div>
          {entries.map(e => (
            <div key={e.structureId} style={{ display: "flex", gap: 8, fontSize: "12px", alignItems: "center" }}>
              <span style={{ flex: 1, fontFamily: "monospace", color: "#e0e0d0" }}>{short(e.structureId, 8, 6)}</span>
              <span style={{ flex: "0 0 100px", textAlign: "right", color: "#FF4700" }}>{numish(e.energyCost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── section: tribe roles ─────────────────────────────────────────────────────

function TribeRolesCard({ vault }: { vault: VaultFull }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [grantAddr, setGrantAddr] = useState("");
  const [grantRole, setGrantRole] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: registryClaim } = useQuery({
    queryKey: ["tribeClaim", vault.tribeId],
    queryFn: () => fetchTribeClaim(vault.tribeId),
    staleTime: 60_000,
  });
  const isAuthorized = !!account && (
    account.address.toLowerCase() === vault.founder.toLowerCase() ||
    (registryClaim?.claimer != null && registryClaim.claimer.toLowerCase() === account.address.toLowerCase())
  );

  const { data: roles, refetch } = useQuery<TribeRolesState | null>({
    queryKey: ["tribeRoles", vault.objectId],
    queryFn: () => fetchTribeRoles(vault.objectId),
    staleTime: 30_000,
  });

  async function exec(tx: ReturnType<typeof buildCreateRolesTx>) {
    if (!account) return;
    setBusy(true); setErr("");
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      await refetch();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={cardStyle}>
      <div style={headingStyle}>Role Delegation</div>
      {!roles ? (
        isAuthorized ? (
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
              No roles contract deployed for this tribe yet.
            </div>
            <button
              onClick={() => exec(buildCreateRolesTx(vault.objectId))}
              disabled={busy}
              style={{ background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.4)", color: "#FF4700", borderRadius: 3, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}
            >
              {busy ? "Deploying…" : "Initialize Role System"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(107,107,94,0.55)" }}>No role system deployed for this tribe.</div>
        )
      ) : (
        <div>
          {/* Current assignments */}
          {roles.assignments.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(107,107,94,0.55)", marginBottom: 10 }}>No roles assigned yet.</div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {roles.assignments.map(a => (
                <div key={a.address} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontFamily: "monospace", color: "#e0e0d0", flex: 1 }}>{a.address.slice(0, 10)}…{a.address.slice(-6)}</span>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {a.roles.map(r => (
                      <span key={r} style={{ background: "rgba(255,71,0,0.12)", border: "1px solid rgba(255,71,0,0.3)", color: "#FF4700", borderRadius: 3, padding: "1px 6px", fontSize: 11 }}>
                        {TRIBE_ROLE_NAMES[r] ?? `Role ${r}`}
                        {isAuthorized && (
                          <button
                            onClick={() => exec(buildRevokeRoleTx(roles.objectId, vault.objectId, a.address, r))}
                            disabled={busy}
                            style={{ background: "none", border: "none", color: "#ff6432", cursor: "pointer", padding: "0 0 0 4px", fontSize: 10, lineHeight: 1 }}
                            title="Revoke"
                          >×</button>
                        )}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Grant role form */}
          {isAuthorized && (
            <div style={{ borderTop: "1px solid rgba(255,71,0,0.15)", paddingTop: 10, marginTop: 4 }}>
              <div style={labelStyle}>Grant Role</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <input
                  value={grantAddr}
                  onChange={e => setGrantAddr(e.target.value.trim())}
                  placeholder="0x address"
                  style={{ flex: 1, minWidth: 180, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,71,0,0.25)", borderRadius: 4, color: "#e0e0d0", fontSize: 12, padding: "5px 8px", fontFamily: "monospace", outline: "none" }}
                />
                <select
                  value={grantRole}
                  onChange={e => setGrantRole(Number(e.target.value))}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,71,0,0.25)", borderRadius: 4, color: "#aaa", fontSize: 12, padding: "5px 8px" }}
                >
                  {Object.entries(TRIBE_ROLE_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (grantAddr) exec(buildGrantRoleTx(roles.objectId, vault.objectId, grantAddr, grantRole)); }}
                  disabled={busy || !grantAddr}
                  style={{ background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.4)", color: "#FF4700", borderRadius: 3, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
                >
                  {busy ? "…" : "Grant"}
                </button>
              </div>
              {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>{err}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── section: founder actions ─────────────────────────────────────────────────

function FounderActionsCard({ vault }: { vault: VaultFull }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const [newFounder, setNewFounder] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  const isFounder = account?.address?.toLowerCase() === vault.founder.toLowerCase();
  if (!isFounder) return null;

  async function handleTransfer() {
    if (!newFounder.trim() || !account) return;
    setStatus("pending");
    setErrMsg("");
    try {
      const tx = buildTransferFounderTx(vault.objectId, newFounder.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setStatus("ok");
      setNewFounder("");
    } catch (e: unknown) {
      setStatus("err");
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={cardStyle}>
      <div style={headingStyle}>Founder Actions</div>
      <Row label="Current Founder">
        <span style={{ fontFamily: "monospace" }}>{short(vault.founder)}</span>
        <CopyButton value={vault.founder} />
      </Row>
      <div style={{ marginTop: 12 }}>
        <div style={labelStyle}>Transfer Founder Role</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            value={newFounder}
            onChange={e => setNewFounder(e.target.value)}
            placeholder="0x new founder address"
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,71,0,0.25)",
              borderRadius: 4, color: "#e0e0d0", fontSize: "12px", padding: "6px 10px",
              fontFamily: "monospace", outline: "none",
            }}
          />
          <button
            onClick={handleTransfer}
            disabled={status === "pending" || !newFounder.trim()}
            style={{
              background: status === "pending" ? "rgba(255,71,0,0.2)" : "#FF4700",
              border: "none", borderRadius: 4, color: "#fff", fontSize: "12px",
              padding: "6px 16px", cursor: status === "pending" ? "not-allowed" : "pointer",
              fontWeight: 700, opacity: !newFounder.trim() ? 0.5 : 1,
            }}
          >
            {status === "pending" ? "Transferring…" : "Transfer"}
          </button>
        </div>
        {status === "ok" && <div style={{ color: "#00ff96", fontSize: "12px", marginTop: 6 }}>Founder transferred successfully.</div>}
        {status === "err" && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: 6 }}>Error: {errMsg}</div>}
      </div>
    </div>
  );
}

// ─── section: activity feed ───────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  CoinIssued: "#00ff96",
  CoinBurned: "#ff6432",
  InfraRegistered: "#4488ff",
};

function ActivityFeedCard({ vaultId }: { vaultId: string }) {
  const { data: issued } = useQuery<CoinEvent[]>({
    queryKey: ["coinIssued", vaultId],
    staleTime: 15_000,
    queryFn: () => fetchCoinEvents("CoinIssued", vaultId),
  });
  const { data: burned } = useQuery<CoinEvent[]>({
    queryKey: ["coinBurned", vaultId],
    staleTime: 15_000,
    queryFn: () => fetchCoinEvents("CoinBurned", vaultId),
  });
  const { data: infraEvts } = useQuery<InfraEvent[]>({
    queryKey: ["infraEvents", vaultId],
    staleTime: 15_000,
    queryFn: () => fetchInfraEvents(vaultId),
  });

  const feed: ActivityItem[] = [
    ...(issued ?? []).map(e => ({ kind: "CoinIssued" as const, address: e.address, amount: e.amount, timestampMs: e.timestampMs })),
    ...(burned ?? []).map(e => ({ kind: "CoinBurned" as const, address: e.address, amount: e.amount, timestampMs: e.timestampMs })),
    ...(infraEvts ?? []).map(e => ({ kind: "InfraRegistered" as const, structureId: e.structureId, energyCost: e.energyCost, timestampMs: e.timestampMs })),
  ]
    .sort((a, b) => Number(b.timestampMs) - Number(a.timestampMs))
    .slice(0, 20);

  return (
    <div style={cardStyle}>
      <div style={headingStyle}>Recent Activity</div>
      {feed.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>No recent activity found.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {feed.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "12px" }}>
            <span style={{
              background: `${BADGE_COLORS[item.kind]}22`,
              border: `1px solid ${BADGE_COLORS[item.kind]}55`,
              color: BADGE_COLORS[item.kind],
              borderRadius: 3, padding: "1px 7px", fontSize: "10px",
              fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}>
              {item.kind}
            </span>
            <span style={{ flex: 1, fontFamily: "monospace", color: "#e0e0d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.kind === "InfraRegistered"
                ? `${short(item.structureId ?? "", 8, 6)} — energy ${numish(item.energyCost ?? 0)}`
                : `${short(item.address ?? "")} — ${numish(item.amount ?? 0)}`
              }
            </span>
            <span style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", whiteSpace: "nowrap" }}>
              {timeAgo(item.timestampMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

// ─── Public tribe explorer (tribeless / no vault) ────────────────────────────

function PublicTribeVaultCard({ vaultId }: { vaultId: string }) {
  const { data: vault, isLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["pubVault", vaultId],
    queryFn: () => fetchTribeVault(vaultId),
    staleTime: 60_000,
  });

  const { data: members } = useQuery({
    queryKey: ["pubMembers", vault?.balancesTableId],
    queryFn: () => vault?.balancesTableId
      ? fetchTribeMembersEnriched(vault.balancesTableId, vault.founder, vault.tribeId)
      : Promise.resolve([]),
    enabled: !!vault?.balancesTableId,
    staleTime: 60_000,
  });

  const { data: worldInfo } = useQuery({
    queryKey: ["pubTribeInfo", vault?.tribeId],
    queryFn: () => vault?.tribeId ? fetchTribeInfo(vault.tribeId) : Promise.resolve(null),
    enabled: !!vault?.tribeId,
    staleTime: 300_000,
  });

  if (isLoading) return <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12, padding: 12 }}>Loading vault…</div>;
  if (!vault) return <div style={{ color: "#ff6432", fontSize: 12, padding: 12 }}>Vault not found or not a TribeVault object.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Overview */}
      <div style={cardStyle}>
        <div style={headingStyle}>Tribe Overview</div>
        {worldInfo?.name && (
          <div style={{ fontSize: 18, fontWeight: 700, color: "#FF4700", marginBottom: 10 }}>{worldInfo.name}
            {worldInfo.nameShort && <span style={{ fontSize: 12, color: "rgba(107,107,94,0.6)", marginLeft: 8 }}>[{worldInfo.nameShort}]</span>}
          </div>
        )}
        {worldInfo?.description && (
          <div style={{ fontSize: 12, color: "rgba(224,224,208,0.7)", marginBottom: 14, lineHeight: 1.6 }}>{worldInfo.description}</div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 32px" }}>
          <Row label="Coin">
            <span style={{ color: "#FF4700", fontWeight: 700 }}>{vault.coinName || "—"}</span>
            {vault.coinSymbol && <span style={{ color: "rgba(107,107,94,0.6)" }}> [{vault.coinSymbol}]</span>}
          </Row>
          <Row label="Tribe ID"><span style={{ fontFamily: "monospace" }}>{vault.tribeId}</span></Row>
          <Row label="Total Supply"><span style={{ fontFamily: "monospace" }}>{vault.totalSupply?.toLocaleString() ?? "—"}</span></Row>
          <Row label="Members"><span style={{ fontFamily: "monospace" }}>{members?.length ?? "—"}</span></Row>
          {worldInfo?.taxRate !== undefined && (
            <Row label="Tax Rate"><span style={{ fontFamily: "monospace" }}>{worldInfo.taxRate}%</span></Row>
          )}
        </div>
        <Row label="Founder">
          <span style={{ fontFamily: "monospace" }}>{short(vault.founder)}</span>
          <CopyButton value={vault.founder} />
        </Row>
        <Row label="Vault Object">
          <span style={{ fontFamily: "monospace" }}>{short(vault.objectId)}</span>
          <CopyButton value={vault.objectId} />
        </Row>
      </div>

      {/* Member roster (public) */}
      {members && members.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={headingStyle}>Members</div>
            <span style={{ fontSize: 10, color: "rgba(107,107,94,0.6)", fontFamily: "monospace" }}>{members.length} on-chain</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, fontSize: "10px", color: "rgba(107,107,94,0.6)", paddingBottom: 4, borderBottom: "1px solid rgba(255,71,0,0.08)" }}>
              <span style={{ flex: "0 0 130px" }}>Pilot</span>
              <span style={{ flex: "1 1 auto" }}>Address</span>
              <span style={{ flex: "0 0 90px", textAlign: "right" }}>Balance</span>
              <span style={{ flex: "0 0 60px", textAlign: "right" }}>Role</span>
            </div>
            {members.map(m => (
              <div key={m.address} style={{ display: "flex", gap: 8, fontSize: "12px", alignItems: "center" }}>
                <span style={{ flex: "0 0 130px", color: m.isFounder ? "#FF4700" : "#e0e0d0", fontWeight: m.isFounder ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.charName ?? "—"}
                </span>
                <span style={{ flex: "1 1 auto", fontFamily: "monospace", fontSize: 10, color: "rgba(107,107,94,0.5)" }}>{short(m.address)}</span>
                <span style={{ flex: "0 0 90px", textAlign: "right", fontFamily: "monospace", color: m.balance > 0 ? "#00ff96" : "rgba(107,107,94,0.4)" }}>{m.balance.toLocaleString()}</span>
                <span style={{ flex: "0 0 60px", textAlign: "right", fontSize: 10, letterSpacing: "0.06em" }}>
                  {m.isFounder
                    ? <span style={{ color: "#FF4700", fontWeight: 700 }}>FOUNDER</span>
                    : <span style={{ color: "rgba(107,107,94,0.5)" }}>MEMBER</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PublicTribeExplorer() {
  const [vaultInput, setVaultInput] = useState("");
  const [lookedUpVaultId, setLookedUpVaultId] = useState<string | null>(null);

  const handleLookup = () => {
    const v = vaultInput.trim();
    if (v.startsWith("0x") && v.length > 10) setLookedUpVaultId(v);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={cardStyle}>
        <div style={headingStyle}>Tribe Explorer</div>
        <div style={{ fontSize: 12, color: "rgba(107,107,94,0.65)", marginBottom: 14 }}>
          Browse any tribe's public on-chain data. Paste a vault object ID to view their roster, coin, and infrastructure.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={vaultInput}
            onChange={e => setVaultInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLookup()}
            placeholder="0x… vault object ID"
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,71,0,0.3)",
              borderRadius: "0", color: "#fff", fontSize: "12px", padding: "7px 10px", outline: "none",
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={handleLookup}
            disabled={!vaultInput.trim().startsWith("0x")}
            style={{
              padding: "7px 18px", background: "rgba(255,71,0,0.12)", border: "1px solid rgba(255,71,0,0.45)",
              color: "#FF4700", fontSize: "12px", cursor: "pointer", fontFamily: "monospace",
              fontWeight: 700, letterSpacing: "0.08em",
            }}
          >
            VIEW
          </button>
        </div>
        <div style={{ fontSize: 10, color: "rgba(107,107,94,0.45)", marginTop: 8 }}>
          Find vault IDs in the Tribe Coin tab or ask a tribe recruiter.
        </div>
      </div>

      {lookedUpVaultId && (
        <PublicTribeVaultCard key={lookedUpVaultId} vaultId={lookedUpVaultId} />
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TribeHierarchyPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;

  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<VaultFull | null>({
    queryKey: ["tribeVault", tribeId],
    queryFn: async () => {
      if (!tribeId) return null;
      const vaultId = getCachedVaultId(tribeId) ?? await discoverVaultIdForTribe(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId,
    staleTime: 15_000,
  });

  if (!account || (!vaultLoading && !vault)) {
    // Tribeless, no wallet, or no vault → public tribe explorer
    return <PublicTribeExplorer />;
  }

  if (vaultLoading) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "14px" }}>
          Loading tribe data…
        </div>
      </div>
    );
  }

  if (!vault) {
    return <PublicTribeExplorer />;
  }

  const vaultFull = vault as VaultFull;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <TribeOverviewCard vault={vaultFull} />
      <MemberRosterCard
        vaultId={vault.objectId}
        balancesTableId={vault.balancesTableId}
        founder={vault.founder}
        tribeId={vault.tribeId}
      />
      <InfraCard vaultId={vault.objectId} />
      <TribeRolesCard vault={vaultFull} />
      <FounderActionsCard vault={vaultFull} />
      <ActivityFeedCard vaultId={vault.objectId} />
    </div>
  );
}
