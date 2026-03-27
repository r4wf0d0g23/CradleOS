/**
 * TurretPolicyPanel — Tribe defense policy editor + passage intel log.
 *
 * Founder:
 *   • Create the TribeDefensePolicy + PassageLog for the vault
 *   • Toggle each known tribe as Friendly / Hostile
 *   • Batch-save relation changes in one tx
 *   • Toggle Enforce Policy (members apply policy to their turrets)
 *
 * Members:
 *   • View current policy (read-only)
 *   • Log a passage event from one of their turrets
 *
 * Intel Feed:
 *   • Shows all PassageLogged events for this vault (newest first)
 */
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { useDevOverrides } from "../contexts/DevModeContext";
import { CRADLEOS_PKG, CRADLEOS_ORIGINAL, CLOCK, SUI_TESTNET_RPC, WELL_KNOWN_TRIBES, WORLD_PKG, eventType } from "../constants";

// defense_policy was NEW in v5 — its events index under CRADLEOS_PKG (v5), not CRADLEOS_PKG (v4)
// tribe_vault events (CoinLaunched) remain under CRADLEOS_PKG (original v4)
import {
  rpcGetObject, numish,
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId, discoverVaultIdForTribe, fetchTribeClaim,
  fetchSecurityConfig, buildSetSecurityLevelTransaction, buildSetAggressionModeTransaction,
  fetchPlayerStructures,
  SEC_GREEN, SEC_YELLOW, SEC_RED,
  type TribeVaultState, type SecurityConfig, type PlayerStructure,
  fetchPlayerRelations, buildSetPlayerRelationTx, buildRemovePlayerRelationTx, type PlayerRelation,
  fetchHostileCharacters, buildSetHostileCharacterTx, type HostileCharacter,
  fetchPersonalVaultForWallet, fetchDefensePolicyForVault, fetchGatePolicyForVault,
  buildCreatePersonalVaultTx, buildCreatePersonalDefensePolicyTx, buildCreatePersonalGatePolicyTx,
  buildSetGateAccessLevelTx,
  GATE_ACCESS_LABELS,
  fetchOwnerCapsForWallet,
} from "../lib";

// ── Types ─────────────────────────────────────────────────────────────────────

type PolicyState = {
  objectId: string;
  vaultId: string;
  enforce: boolean;
  version: number;
  relationsTableId: string;
};

type KnownTribe = {
  tribeId: number;
  coinSymbol: string;
  vaultId: string;
};

type PassageEvent = {
  logId: string;
  entryIndex: number;
  turretId: string;
  reporter: string;
  entityId: string;
  note: string;
  timestampMs: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Fetch TribeDefensePolicy state. */
async function fetchPolicyState(policyId: string): Promise<PolicyState | null> {
  try {
    const fields = await rpcGetObject(policyId);
    const relField = fields["relations"] as { fields?: { id?: { id?: string } } } | undefined;
    return {
      objectId: policyId,
      vaultId: String(fields["vault_id"] ?? ""),
      enforce: Boolean(fields["enforce"]),
      version: numish(fields["version"]) ?? 0,
      relationsTableId: relField?.fields?.id?.id ?? "",
    };
  } catch { return null; }
}

/** Fetch current relations from the policy's relations Table. */
async function fetchRelations(relationsTableId: string): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  if (!relationsTableId) return map;
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getDynamicFields", params: [relationsTableId, null, 100] }),
    });
    const j = await res.json() as { result?: { data?: Array<{ name: { value: string | number }; objectId: string }> } };
    const entries = j.result?.data ?? [];
    await Promise.all(entries.map(async (entry) => {
      const obj = await fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [entry.objectId, { showContent: true }] }),
      });
      const od = await obj.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
      const f = od.result?.data?.content?.fields ?? {};
      const val = (f["value"] as { fields?: Record<string, unknown> })?.fields ?? (f["value"] as Record<string, unknown>) ?? {};
      const tribeId = numish(entry.name.value) ?? 0;
      const relation = numish(val["value"] ?? f["value"]) ?? 0;
      map.set(tribeId, relation === 1);
    }));
  } catch { /* */ }
  return map;
}

/** Fetch all known tribes by querying CoinLaunched events.
 *  Deduplicates by tribeId — keeps the most recent vault per tribe (descending order). */
async function fetchKnownTribes(): Promise<KnownTribe[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        // descending=true → newest first; first occurrence of each tribeId wins
        params: [{ MoveEventType: eventType("tribe_vault", "CoinLaunched") }, null, 200, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const seen = new Set<number>();
    const result: KnownTribe[] = [];
    for (const e of (j.result?.data ?? [])) {
      const tribeId = numish(e.parsedJson["tribe_id"]) ?? 0;
      if (seen.has(tribeId)) continue;
      seen.add(tribeId);
      result.push({
        tribeId,
        coinSymbol: String(e.parsedJson["coin_symbol"] ?? "?"),
        vaultId: String(e.parsedJson["vault_id"] ?? ""),
      });
    }
    return result;
  } catch { return []; }
}

/** Fetch policy object ID for a vault — query the unified package's PolicyCreated events. */
async function fetchPolicyIdForVault(vaultId: string): Promise<string | null> {
  // Check localStorage cache first
  try {
    const cached = localStorage.getItem(`cradleos:policy:${vaultId}`);
    if (cached) return cached;
  } catch { /* */ }

  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("defense_policy", "PolicyCreated") }, null, 50, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const match = (j.result?.data ?? []).find(e => String(e.parsedJson["vault_id"]) === vaultId);
    if (match) {
      const id = String(match.parsedJson["policy_id"]);
      try { localStorage.setItem(`cradleos:policy:${vaultId}`, id); } catch { /* */ }
      return id;
    }
  } catch { /* */ }

  return null;
}

/** Fetch PassageLog object ID for a vault (cached in localStorage). */
function getPassageLogId(vaultId: string): string | null {
  try { return localStorage.getItem(`cradleos:passagelog:${vaultId}`); } catch { return null; }
}
export function setPassageLogId(vaultId: string, logId: string): void {
  try { localStorage.setItem(`cradleos:passagelog:${vaultId}`, logId); } catch { /* */ }
}

/** Fetch recent PassageLogged events for a vault. */
async function fetchPassageEvents(vaultId: string): Promise<PassageEvent[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("defense_policy", "PassageLogged") }, null, 50, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown>; timestampMs?: string }> } };
    return (j.result?.data ?? [])
      .filter(e => String(e.parsedJson["vault_id"]) === vaultId)
      .map(e => ({
        logId: String(e.parsedJson["log_id"] ?? ""),
        entryIndex: numish(e.parsedJson["entry_index"]) ?? 0,
        turretId: String(e.parsedJson["turret_id"] ?? ""),
        reporter: String(e.parsedJson["reporter"] ?? ""),
        entityId: String(e.parsedJson["entity_id"] ?? ""),
        note: String(e.parsedJson["note"] ?? ""),
        timestampMs: numish(e.parsedJson["timestamp_ms"]) ?? 0,
      }));
  } catch { return []; }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function buildCreatePolicyTransaction(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::create_policy_entry`,
    arguments: [tx.object(vaultId)],
  });
  return tx;
}


function buildSetRelationsBatchTransaction(
  policyId: string,
  vaultId: string,
  tribeIds: number[],
  friendlies: boolean[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_relations_batch_entry`,
    arguments: [
      tx.object(policyId),
      tx.object(vaultId),
      tx.pure.vector("u32", tribeIds.map(n => n >>> 0)),
      tx.pure.vector("bool", friendlies),
    ],
  });
  return tx;
}

function buildSetEnforceTransaction(policyId: string, vaultId: string, enforce: boolean): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_enforce_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.bool(enforce)],
  });
  return tx;
}

function buildLogPassageTransaction(
  logId: string,
  turretId: string,
  entityId: string,
  note: string,
  timestampMs: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::log_passage_entry`,
    arguments: [
      tx.object(logId),
      tx.pure.address(turretId),
      tx.pure.address(entityId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(note))),
      tx.pure.u64(BigInt(timestampMs)),
    ],
  });
  return tx;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TurretPolicyPanel() {
  const { account: _account0 } = useVerifiedAccountContext();
  const { overrideAccount, overrideTribeId } = useDevOverrides();
  const account0 = overrideAccount(_account0);
  // Vault discovery (same as TribeVaultPanel)
  const { data: _rawTribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account0?.address],
    queryFn: () => account0 ? fetchCharacterTribeId(account0.address) : Promise.resolve(null),
    enabled: !!account0?.address,
  });
  const tribeId = overrideTribeId(_rawTribeId ?? null);
  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account0?.address],
    queryFn: async () => {
      if (!tribeId || !account0) return null;
      const vaultId = getCachedVaultId(tribeId) ?? await discoverVaultIdForTribe(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account0,
    staleTime: 15_000,
  });
  // Registry claim — must be called unconditionally (Rules of Hooks)
  const { data: registryClaim, isLoading: claimLoading } = useQuery({
    queryKey: ["tribeClaim", tribeId],
    queryFn: () => tribeId ? fetchTribeClaim(tribeId) : Promise.resolve(null),
    enabled: !!tribeId,
    staleTime: 60_000,
  });

  if (!account0) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      Connect EVE Vault to manage defense policy
    </div>
  );
  if (vaultLoading || (tribeId && claimLoading) || !vault) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      {vaultLoading || claimLoading ? "Loading vault…" : "No tribe vault found. Create one in the Tribe Token tab first."}
    </div>
  );
  return <TurretPolicyPanelInner vault={vault} registryClaimer={registryClaim?.claimer ?? null} />;
}

function TurretPolicyPanelInner({ vault, registryClaimer }: { vault: TribeVaultState; registryClaimer: string | null }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const { overrideAccount, overrideIsFounder } = useDevOverrides();
  const account = overrideAccount(_verifiedAcct);
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  // Founder check: match vault.founder OR registry claimer (claimer may differ if vault was created by a different wallet)
  const isFounder = overrideIsFounder(!!account && (
    vault.founder.toLowerCase() === account.address.toLowerCase() ||
    (registryClaimer != null && registryClaimer.toLowerCase() === account.address.toLowerCase())
  ));

  // Personal vault discovery — for passing to MemberDelegationSection
  const { data: personalVaultData } = useQuery<{ objectId: string; tribeId: number } | null>({
    queryKey: ["personalVault", account?.address],
    queryFn: () => account ? fetchPersonalVaultForWallet(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
    staleTime: 60_000,
  });
  const personalVaultId = personalVaultData?.objectId ?? null;

  // Main tab: tribe policy vs personal policy
  const [policyTab, setPolicyTab] = useState<"tribe" | "personal">("tribe");

  // Draft relation changes (tribeId → friendly bool) — only committed on save
  const [draft, setDraft] = useState<Map<number, boolean>>(new Map());
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [logErr, setLogErr] = useState<string | null>(null);
  const [logTurret, setLogTurret] = useState("");
  const [logEntity, setLogEntity] = useState("");
  const [logNote, setLogNote] = useState("");
  // Manually added tribes (IDs without vaults)
  const [manualTribes, setManualTribes] = useState<KnownTribe[]>([]);
  const [addTribeInput, setAddTribeInput] = useState("");

  // Discover policy object ID
  const { data: policyId, refetch: refetchPolicyId } = useQuery<string | null>({
    queryKey: ["policyId", vault.objectId],
    queryFn: () => fetchPolicyIdForVault(vault.objectId),
    staleTime: 10_000,
  });

  const { data: policy } = useQuery<PolicyState | null>({
    queryKey: ["policyState", policyId],
    queryFn: () => policyId ? fetchPolicyState(policyId) : Promise.resolve(null),
    enabled: !!policyId,
    staleTime: 15_000,
  });

  const { data: relations } = useQuery<Map<number, boolean>>({
    queryKey: ["policyRelations", policy?.relationsTableId],
    queryFn: () => policy?.relationsTableId ? fetchRelations(policy.relationsTableId) : Promise.resolve(new Map()),
    enabled: !!policy?.relationsTableId,
    staleTime: 15_000,
  });

  const { data: tribes } = useQuery<KnownTribe[]>({
    queryKey: ["knownTribes"],
    queryFn: fetchKnownTribes,
    staleTime: 120_000,
  });

  const { data: passages } = useQuery<PassageEvent[]>({
    queryKey: ["passageEvents", vault.objectId],
    queryFn: () => fetchPassageEvents(vault.objectId),
    staleTime: 30_000,
  });

  const logId = getPassageLogId(vault.objectId);

  // Security config
  const [secBusy, setSecBusy] = useState(false);
  const [secErr, setSecErr] = useState<string | null>(null);
  const { data: secConfig, refetch: refetchSec } = useQuery<SecurityConfig>({
    queryKey: ["securityConfig", policyId],
    queryFn: () => policyId ? fetchSecurityConfig(policyId) : Promise.resolve({ level: SEC_GREEN, aggressionMode: false }),
    enabled: !!policyId,
    staleTime: 15_000,
  });

  const handleSetLevel = useCallback(async (level: number) => {
    if (!policyId || !vault.objectId) return;
    setSecBusy(true); setSecErr(null);
    try {
      const tx = await buildSetSecurityLevelTransaction(policyId, vault.objectId, level);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => refetchSec(), 2500);
    } catch (e) { setSecErr(e instanceof Error ? e.message : String(e)); }
    finally { setSecBusy(false); }
  }, [policyId, vault.objectId, dAppKit, refetchSec]);

  const handleToggleAggression = useCallback(async () => {
    if (!policyId || !vault.objectId || !secConfig) return;
    setSecBusy(true); setSecErr(null);
    try {
      const tx = await buildSetAggressionModeTransaction(policyId, vault.objectId, !secConfig.aggressionMode);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => refetchSec(), 2500);
    } catch (e) { setSecErr(e instanceof Error ? e.message : String(e)); }
    finally { setSecBusy(false); }
  }, [policyId, vault.objectId, secConfig, dAppKit, refetchSec]);

  // Invalidate after any tx
  const invalidate = () => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["policyId"] });
      queryClient.invalidateQueries({ queryKey: ["policyState"] });
      queryClient.invalidateQueries({ queryKey: ["policyRelations"] });
      queryClient.invalidateQueries({ queryKey: ["passageEvents"] });
    }, 2500);
    // Extra invalidation passes to handle indexer lag
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["policyId"] });
      queryClient.invalidateQueries({ queryKey: ["policyState"] });
      queryClient.invalidateQueries({ queryKey: ["policyRelations"] });
    }, 6000);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["policyId"] });
      queryClient.invalidateQueries({ queryKey: ["policyState"] });
      queryClient.invalidateQueries({ queryKey: ["policyRelations"] });
    }, 12000);
  };

  const handleCreate = async () => {
    if (!account) return;
    setCreateBusy(true); setCreateErr(null);
    try {
      const tx = buildCreatePolicyTransaction(vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Extract created shared object IDs from effects and identify by type
      const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
      if (digest) {
        try {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "sui_getTransactionBlock",
              params: [digest, { showEffects: true }],
            }),
          });
          const j = await res.json() as { result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } } };
          const created = (j.result?.effects?.created ?? [])
            .filter(c => c.owner && typeof c.owner === "object" && "Shared" in (c.owner as object))
            .map(c => c.reference.objectId);
          // Identify TribeDefensePolicy vs PassageLog by fetching type
          for (const id of created) {
            const objRes = await fetch(SUI_TESTNET_RPC, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
            });
            const od = await objRes.json() as { result?: { data?: { type?: string } } };
            const t = od.result?.data?.type ?? "";
            if (t.includes("TribeDefensePolicy")) {
              try { localStorage.setItem(`cradleos:policy:${vault.objectId}`, id); } catch { /* */ }
            } else if (t.includes("PassageLog")) {
              setPassageLogId(vault.objectId, id);
            }
          }
        } catch { /* fall through to event discovery */ }
      }
      invalidate();
      // Retry refetch at staggered intervals to handle indexer lag
      refetchPolicyId();
      const retryDelays = [3000, 7000, 14000];
      for (const delay of retryDelays) {
        setTimeout(async () => {
          const r = await refetchPolicyId();
          if (!r.data) {
            // Also force-clear any stale null from localStorage
            try { localStorage.removeItem(`cradleos:policy:${vault.objectId}`); } catch { /* */ }
          }
        }, delay);
      }
    } catch (e) { setCreateErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreateBusy(false); }
  };

  const handleSaveRelations = async () => {
    if (!account || !policyId || draft.size === 0) return;
    setSaveBusy(true); setSaveErr(null);
    try {
      const ids = Array.from(draft.keys());
      const friendly = ids.map(id => draft.get(id)!);
      const tx = buildSetRelationsBatchTransaction(policyId, vault.objectId, ids, friendly);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDraft(new Map());
      invalidate();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaveBusy(false); }
  };

  const handleToggleEnforce = async () => {
    if (!account || !policyId || !policy) return;
    try {
      const tx = buildSetEnforceTransaction(policyId, vault.objectId, !policy.enforce);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
  };

  const handleLogPassage = async () => {
    if (!account || !logId || !logTurret || !logEntity) return;
    setLogBusy(true); setLogErr(null);
    try {
      const tx = buildLogPassageTransaction(logId, logTurret, logEntity, logNote, Date.now());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setLogTurret(""); setLogEntity(""); setLogNote("");
      invalidate();
    } catch (e) { setLogErr(e instanceof Error ? e.message : String(e)); }
    finally { setLogBusy(false); }
  };

  const toggleDraft = (tribeId: number) => {
    const current = draft.has(tribeId) ? draft.get(tribeId)! : (relations?.get(tribeId) ?? false);
    setDraft(prev => new Map(prev).set(tribeId, !current));
  };

  const effectiveRelation = (tribeId: number): boolean => {
    if (draft.has(tribeId)) return draft.get(tribeId)!;
    return relations?.get(tribeId) ?? false;
  };

  // Filter out own tribe by both vault ID and tribe ID
  // Merge: on-chain tribes + well-known tribes + manually added tribes
  // Deduplicate by tribeId; filter out own tribe
  const ownTribeId = String(vault.tribeId);
  const mergedTribes: KnownTribe[] = [];
  const seenIds = new Set<string>();
  for (const t of [...(tribes ?? []), ...WELL_KNOWN_TRIBES.map(w => ({ ...w, vaultId: "" })), ...manualTribes]) {
    const key = String(t.tribeId);
    if (seenIds.has(key) || key === ownTribeId) continue;
    seenIds.add(key);
    mergedTribes.push(t);
  }
  const otherTribes = mergedTribes;

  // ── No policy yet ───────────────────────────────────────────────────────

  if (!policyId) {
    return (
      <div className="card">
        <div style={{ color: "#aaa", fontWeight: 600, marginBottom: "16px" }}>
          🛡 Tribe Defense Policy
        </div>
        <p style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "20px" }}>
          No defense policy exists for this vault. Create one to manage tribe
          diplomatic relations and turret intel logging.
        </p>
        {isFounder && (
          <>
            <button className="accent-button" onClick={handleCreate} disabled={createBusy}>
              {createBusy ? "Creating…" : "Create Defense Policy"}
            </button>
            {createErr && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>⚠ {createErr}</div>}
          </>
        )}
        <button
          onClick={() => {
            try { localStorage.removeItem(`cradleos:policy:${vault.objectId}`); } catch { /* */ }
            refetchPolicyId();
          }}
          style={{
            marginTop: "12px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", color: "rgba(107,107,94,0.6)",
            borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
          }}
        >
          ↻ Refresh (check for existing policy)
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Policy type tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid rgba(255,71,0,0.15)", marginBottom: 16 }}>
        {([["tribe", "🛡 TRIBE POLICY"], ["personal", "👤 PERSONAL POLICY"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setPolicyTab(tab)} style={{
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            padding: "6px 16px", border: "none", cursor: "pointer",
            background: policyTab === tab ? "rgba(255,71,0,0.1)" : "transparent",
            color: policyTab === tab ? "#FF4700" : "rgba(255,255,255,0.3)",
            borderBottom: policyTab === tab ? "2px solid #FF4700" : "2px solid transparent",
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {policyTab === "personal" && (
        <PersonalPolicySection account={account} characterTribeId={vault.tribeId} />
      )}

      {policyTab === "tribe" && <>
      {/* Header + enforce toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px" }}>🛡 Defense Policy</div>
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>v{policy?.version ?? 0}</div>
        {isFounder && policy && (
          <button
            onClick={handleToggleEnforce}
            style={{
              marginLeft: "auto",
              background: policy.enforce ? "rgba(0,255,150,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${policy.enforce ? "#00ff9640" : "rgba(255,255,255,0.1)"}`,
              color: policy.enforce ? "#00ff96" : "#666",
              borderRadius: "2px", fontSize: "12px", padding: "5px 14px", cursor: "pointer",
            }}
          >
            {policy.enforce ? "⚡ Enforce: ON" : "○ Enforce: OFF"}
          </button>
        )}
        {!isFounder && policy && (
          <div style={{
            marginLeft: "auto",
            padding: "4px 12px", borderRadius: "2px", fontSize: "12px",
            background: policy.enforce ? "rgba(255,71,0,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${policy.enforce ? "rgba(255,71,0,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: policy.enforce ? "#FF4700" : "#555",
          }}>
            {policy.enforce ? "⚡ Policy Enforced" : "○ Advisory Only"}
          </div>
        )}
      </div>

      {/* ── Security Protocol ─────────────────────────────────────────────── */}
      {policy && (
        <div style={{
          marginBottom: "20px", padding: "14px 16px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0",
        }}>
          <div style={{ color: "#aaa", fontSize: "11px", letterSpacing: "0.07em", marginBottom: "12px", fontWeight: 700 }}>
            SECURITY PROTOCOL
          </div>

          {/* Level selector */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            {([
              { level: SEC_GREEN,  label: "● GREEN",  desc: "Arm on aggression only (tribe safe)",    color: "#00ff96", dimColor: "#1a4d2e" },
              { level: SEC_YELLOW, label: "● YELLOW", desc: "Arm against hostile on approach",       color: "#ffcc00", dimColor: "#4d3d00" },
              { level: SEC_RED,    label: "● RED",    desc: "Arm against all non-tribe (tribe safe)", color: "#ff4444", dimColor: "#4d1111" },
            ] as const).map(({ level, label, desc, color, dimColor }) => {
              const active = (secConfig?.level ?? SEC_GREEN) === level;
              return (
                <button
                  key={level}
                  onClick={() => isFounder && handleSetLevel(level)}
                  disabled={secBusy || !isFounder}
                  title={desc}
                  style={{
                    flex: 1, minWidth: "110px",
                    padding: "8px 10px", borderRadius: "2px", cursor: isFounder ? "pointer" : "default",
                    background: active ? `${dimColor}80` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
                    color: active ? color : "#555",
                    fontSize: "11px", fontWeight: active ? 700 : 400, letterSpacing: "0.05em",
                    transition: "all 0.15s",
                  }}
                >
                  <div>{label}</div>
                  <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px", fontWeight: 400 }}>{desc}</div>
                </button>
              );
            })}
          </div>

          {/* Aggression-only toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => isFounder && handleToggleAggression()}
              disabled={secBusy || !isFounder}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "0", cursor: isFounder ? "pointer" : "default",
                background: secConfig?.aggressionMode ? "rgba(255,71,0,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${secConfig?.aggressionMode ? "rgba(255,71,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: secConfig?.aggressionMode ? "#FF4700" : "#555",
                fontSize: "11px", fontWeight: 600,
              }}
            >
              <span style={{ fontSize: "14px" }}>{secConfig?.aggressionMode ? "⚡" : "○"}</span>
              AGGRESSION DETECT
            </button>
            <span style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px" }}>
              {secConfig?.aggressionMode
                ? "Turrets observe first — arm only after hostile contact logged"
                : "Turrets arm immediately based on security level"}
            </span>
          </div>
          {secErr && <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {secErr}</div>}
        </div>
      )}

      {/* Tribe relations grid */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.12)",
        borderRadius: "0", padding: "14px", marginBottom: "20px",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
          Tribe Relations
          {!isFounder && <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>read-only</span>}
        </div>

        {otherTribes.length === 0 ? (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No other tribes found on-chain yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {otherTribes.map(tribe => {
              const isFriendly = effectiveRelation(tribe.tribeId);
              const hasDraftChange = draft.has(tribe.tribeId);
              return (
                <div key={tribe.tribeId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px",
                  background: isFriendly ? "rgba(0,255,150,0.04)" : "rgba(255,71,0,0.04)",
                  border: `1px solid ${isFriendly ? "rgba(0,255,150,0.15)" : "rgba(255,71,0,0.15)"}`,
                  borderRadius: "2px",
                }}>
                  <span style={{
                    fontSize: "12px", fontWeight: 700,
                    color: isFriendly ? "#00ff96" : "#ff6432",
                    minWidth: "60px", fontFamily: "monospace",
                  }}>
                    {tribe.coinSymbol}
                  </span>
                  <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace", flex: 1 }}>
                    tribe #{tribe.tribeId}
                    {WELL_KNOWN_TRIBES.find(w => w.tribeId === tribe.tribeId)?.label && (
                      <span style={{ color: "rgba(107,107,94,0.7)", marginLeft: "6px", fontFamily: "sans-serif" }}>
                        ({WELL_KNOWN_TRIBES.find(w => w.tribeId === tribe.tribeId)!.label})
                      </span>
                    )}
                  </span>
                  <span style={{
                    fontSize: "11px", fontWeight: 600,
                    color: isFriendly ? "#00ff96" : "#ff6432",
                  }}>
                    {isFriendly ? "● FRIENDLY" : "● HOSTILE"}
                  </span>
                  {hasDraftChange && (
                    <span style={{ fontSize: "10px", color: "#FF4700" }}>unsaved</span>
                  )}
                  {isFounder && (
                    <button
                      onClick={() => toggleDraft(tribe.tribeId)}
                      style={{
                        background: isFriendly ? "rgba(255,71,0,0.1)" : "rgba(0,255,150,0.1)",
                        border: `1px solid ${isFriendly ? "rgba(255,71,0,0.3)" : "#00ff9640"}`,
                        color: isFriendly ? "#ff6432" : "#00ff96",
                        borderRadius: "0", fontSize: "11px", padding: "3px 10px", cursor: "pointer",
                      }}
                    >
                      {isFriendly ? "Set Hostile" : "Set Friendly"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isFounder && draft.size > 0 && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="accent-button"
              onClick={handleSaveRelations}
              disabled={saveBusy}
              style={{ padding: "6px 18px", fontSize: "12px" }}
            >
              {saveBusy ? "Saving…" : `Save ${draft.size} Change${draft.size > 1 ? "s" : ""} On-Chain`}
            </button>
            <button
              onClick={() => setDraft(new Map())}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(107,107,94,0.55)", borderRadius: "0", fontSize: "11px", padding: "5px 12px", cursor: "pointer",
              }}
            >
              Discard
            </button>
            {saveErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {saveErr}</div>}
          </div>
        )}

        {/* Add tribe — dropdown of all known tribes not yet shown, plus manual ID fallback */}
        {isFounder && (
          <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Dropdown: all on-chain + well-known tribes not already in the list */}
            {(() => {
              const options = [
                ...(tribes ?? []).map(t => ({ tribeId: t.tribeId, label: `Tribe ${t.tribeId} (${t.coinSymbol})` })),
                ...WELL_KNOWN_TRIBES.map(w => ({ tribeId: w.tribeId, label: `Tribe ${w.tribeId} — ${w.label}` })),
              ].filter((o, i, arr) =>
                !seenIds.has(String(o.tribeId)) &&
                arr.findIndex(x => x.tribeId === o.tribeId) === i
              );
              if (options.length === 0) return null;
              return (
                <select
                  value={addTribeInput}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) return;
                    const id = parseInt(val, 10);
                    if (!id || seenIds.has(String(id))) return;
                    setManualTribes(prev => [...prev, { tribeId: id, coinSymbol: options.find(o => o.tribeId === id)?.label.match(/\(([^)]+)\)/)?.[1] ?? "?", vaultId: "" }]);
                    setAddTribeInput("");
                    e.target.value = "";
                  }}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0", color: "#aaa", fontSize: "11px", padding: "5px 8px", cursor: "pointer",
                  }}
                >
                  <option value="">+ Add tribe from list…</option>
                  {options.map(o => (
                    <option key={o.tribeId} value={o.tribeId}>{o.label}</option>
                  ))}
                </select>
              );
            })()}
            {/* Manual ID input for tribes not on-chain yet */}
            <input
              value={addTribeInput}
              onChange={e => setAddTribeInput(e.target.value.replace(/\D/g, ""))}
              placeholder="Or enter tribe ID manually"
              style={{
                width: "180px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0",
                color: "#aaa", fontSize: "11px", padding: "5px 8px", outline: "none",
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={() => {
                const id = parseInt(addTribeInput, 10);
                if (!id || seenIds.has(String(id))) { setAddTribeInput(""); return; }
                setManualTribes(prev => [...prev, { tribeId: id, coinSymbol: "?", vaultId: "" }]);
                setAddTribeInput("");
              }}
              disabled={!addTribeInput}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#888", borderRadius: "0", fontSize: "11px", padding: "5px 12px", cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Player Relations — per-address hostile/friendly overrides */}
      <PlayerRelationsSection vault={vault} policyId={policyId ?? null} isFounder={isFounder} />

      {/* Hostile Characters — same-tribe targeting overrides by character ID */}
      <HostileCharactersSection vault={vault} policyId={policyId ?? null} isFounder={isFounder} />

      {/* Policy members — who has delegated to this policy */}
      <PolicyMembersSection vault={vault} />

      {/* Passage intel log */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "0", padding: "14px", marginBottom: "20px",
      }}>
        <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
          📡 Passage Intel Log
        </div>

        {/* Log entry form */}
        {logId && (
          <div style={{ marginBottom: "14px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>TURRET ID</span>
              <input
                value={logTurret}
                onChange={e => setLogTurret(e.target.value)}
                placeholder="0x..."
                style={{
                  width: "140px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#fff", fontSize: "11px", padding: "5px 8px", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>ENTITY ID (observed)</span>
              <input
                value={logEntity}
                onChange={e => setLogEntity(e.target.value)}
                placeholder="0x..."
                style={{
                  width: "140px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#fff", fontSize: "11px", padding: "5px 8px", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "10px" }}>NOTE</span>
              <input
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                placeholder="hostile capital..."
                style={{
                  width: "160px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0", color: "#fff", fontSize: "11px", padding: "5px 8px", outline: "none",
                }}
              />
            </div>
            <button
              onClick={handleLogPassage}
              disabled={logBusy || !logTurret || !logEntity}
              style={{
                background: "rgba(100,180,255,0.1)", border: "1px solid rgba(100,180,255,0.3)",
                color: "#64b4ff", borderRadius: "0", fontSize: "12px", padding: "5px 14px", cursor: "pointer",
              }}
            >
              {logBusy ? "…" : "Log Entry"}
            </button>
            {logErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {logErr}</div>}
          </div>
        )}

        {/* Intel feed */}
        {(passages ?? []).length === 0 ? (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No passage events logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", gap: "8px", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "4px" }}>
              {["#", "TURRET", "ENTITY", "NOTE", "REPORTER", "TIME"].map(h => (
                <span key={h} style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em", flex: h === "NOTE" ? 2 : 1 }}>{h}</span>
              ))}
            </div>
            {(passages ?? []).map(ev => (
              <div key={ev.entryIndex} style={{
                display: "flex", gap: "8px", fontSize: "11px", color: "#888",
                padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <span style={{ flex: 1, color: "rgba(107,107,94,0.55)" }}>#{ev.entryIndex}</span>
                <span style={{ flex: 1, fontFamily: "monospace" }}>{shortAddr(ev.turretId)}</span>
                <span style={{ flex: 1, fontFamily: "monospace", color: "#FF4700" }}>{shortAddr(ev.entityId)}</span>
                <span style={{ flex: 2, color: "#aaa" }}>{ev.note || "—"}</span>
                <span style={{ flex: 1, fontFamily: "monospace" }}>{shortAddr(ev.reporter)}</span>
                <span style={{ flex: 1, color: "rgba(107,107,94,0.55)" }}>
                  {ev.timestampMs ? new Date(ev.timestampMs).toLocaleTimeString() : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

            </>}{/* end tribe tab */}

      {/* Member: Apply tribe policy to own structures — always visible */}
      {account && (
        <MemberDelegationSection vault={vault} account={account} personalVaultId={personalVaultId} policyId={policyId ?? null} />
      )}
    </div>
  );
}

// ── Member: Apply Tribe Policy to your turrets ────────────────────────────────

function PlayerRelationsSection({ vault, policyId, isFounder }: {
  vault: TribeVaultState;
  policyId: string | null;
  isFounder: boolean;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [playerInput, setPlayerInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // On the unified chain, all policies have player relation support from birth.

  const { data: playerRelations } = useQuery<PlayerRelation[]>({
    queryKey: ["playerRelations", vault.objectId],
    queryFn: () => fetchPlayerRelations(vault.objectId),
    staleTime: 30_000,
  });

  async function execTx(txPromise: ReturnType<typeof buildSetPlayerRelationTx>) {
    if (!account || !policyId) return;
    setBusy(true); setErr("");
    try {
      const tx = await txPromise;
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      queryClient.invalidateQueries({ queryKey: ["playerRelations"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setPlayerInput(""); }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.12)", borderRadius: "0", padding: "14px", marginBottom: "20px" }}>
      <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
        Player Relations
        {!isFounder && <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>read-only</span>}
      </div>

      {(playerRelations ?? []).length === 0 ? (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px", marginBottom: isFounder ? 12 : 0 }}>No individual player overrides set.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: 12 }}>
          {(playerRelations ?? []).map(pr => (
            <div key={pr.player} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
              <span style={{ flex: 1, fontFamily: "monospace", color: "#e0e0d0" }}>{pr.player.slice(0, 10)}…{pr.player.slice(-6)}</span>
              <span style={{ padding: "2px 8px", borderRadius: "2px", fontSize: "11px", fontWeight: 600,
                background: pr.value === 1 ? "rgba(0,200,100,0.12)" : "rgba(255,68,68,0.12)",
                border: `1px solid ${pr.value === 1 ? "rgba(0,200,100,0.3)" : "rgba(255,68,68,0.3)"}`,
                color: pr.value === 1 ? "#00c864" : "#ff4444" }}>
                {pr.value === 1 ? "FRIENDLY" : "HOSTILE"}
              </span>
              {isFounder && policyId && (
                <button
                  onClick={() => execTx(buildRemovePlayerRelationTx(policyId, vault.objectId, pr.player))}
                  disabled={busy}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#666", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}
                >Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {isFounder && policyId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={playerInput}
            onChange={e => setPlayerInput(e.target.value.trim())}
            placeholder="0x player wallet address"
            style={{ flex: 1, minWidth: 240, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0", color: "#aaa", fontSize: "11px", padding: "5px 8px", outline: "none", fontFamily: "monospace" }}
          />
          <button
            onClick={() => { if (playerInput) execTx(buildSetPlayerRelationTx(policyId, vault.objectId, playerInput, 1)); }}
            disabled={busy || !playerInput}
            style={{ background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: "2px", fontSize: "11px", padding: "5px 12px", cursor: "pointer" }}
          >+ Friendly</button>
          <button
            onClick={() => { if (playerInput) execTx(buildSetPlayerRelationTx(policyId, vault.objectId, playerInput, 0)); }}
            disabled={busy || !playerInput}
            style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: "2px", fontSize: "11px", padding: "5px 12px", cursor: "pointer" }}
          >+ Hostile</button>
        </div>
      )}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

// ── Hostile Characters — same-tribe targeting override by character ID ────────

function HostileCharactersSection({ vault, policyId, isFounder }: {
  vault: TribeVaultState;
  policyId: string | null;
  isFounder: boolean;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [charInput, setCharInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: hostileChars } = useQuery<HostileCharacter[]>({
    queryKey: ["hostileCharacters", vault.objectId],
    queryFn: () => fetchHostileCharacters(vault.objectId),
    staleTime: 30_000,
  });

  const handleAdd = async () => {
    const charId = parseInt(charInput, 10);
    if (!account || !policyId || !charId || isNaN(charId)) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetHostileCharacterTx(policyId, vault.objectId, charId, true);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setCharInput("");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["hostileCharacters"] }), 2500);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["hostileCharacters"] }), 6000);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const handleRemove = async (charId: number) => {
    if (!account || !policyId) return;
    setBusy(true); setErr("");
    try {
      const tx = buildSetHostileCharacterTx(policyId, vault.objectId, charId, false);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["hostileCharacters"] }), 2500);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["hostileCharacters"] }), 6000);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.12)",
      borderRadius: "0", padding: "14px", marginBottom: "20px",
    }}>
      <div style={{ color: "#ff4444", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
        Hostile Characters (Same-Tribe Override)
        {!isFounder && <span style={{ color: "rgba(107,107,94,0.55)", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>read-only</span>}
      </div>
      <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px", marginBottom: "12px", lineHeight: 1.5 }}>
        Tribe turrets will <strong style={{ color: "#ff4444" }}>never fire on same-tribe members</strong> unless
        their character ID is listed here. Use this for KOS (kill-on-sight) characters
        who are in your tribe but should be treated as hostile.
      </div>

      {(hostileChars ?? []).length === 0 ? (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px", marginBottom: isFounder ? 12 : 0 }}>
          No hostile characters listed. All tribe members are protected from turret fire.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: 12 }}>
          {(hostileChars ?? []).map(hc => (
            <div key={hc.characterId} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
              <span style={{ flex: 1, fontFamily: "monospace", color: "#ff4444" }}>
                Character #{hc.characterId}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: "2px", fontSize: "11px", fontWeight: 600,
                background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444",
              }}>
                KOS
              </span>
              {isFounder && policyId && (
                <button
                  onClick={() => handleRemove(hc.characterId)}
                  disabled={busy}
                  style={{
                    background: "none", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#666", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer",
                  }}
                >Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {isFounder && policyId && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={charInput}
            onChange={e => setCharInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Character ID (number)"
            style={{
              flex: 1, minWidth: 180, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0",
              color: "#aaa", fontSize: "11px", padding: "5px 8px", outline: "none",
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={busy || !charInput}
            style={{
              background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)",
              color: "#ff4444", borderRadius: "2px", fontSize: "11px", padding: "5px 12px", cursor: "pointer",
            }}
          >
            {busy ? "..." : "+ Add Hostile"}
          </button>
        </div>
      )}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

function MemberDelegationSection({
  vault,
  account,
  personalVaultId,
  policyId,
}: {
  vault: TribeVaultState;
  account: { address: string };
  personalVaultId: string | null;
  policyId: string | null;
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const { data: groups, isLoading } = useQuery({
    queryKey: ["playerStructures", account.address],
    queryFn: () => fetchPlayerStructures(account.address),
    staleTime: 30_000,
  });

  // Flatten to turrets + gates only
  const defensiveStructures: PlayerStructure[] = (groups ?? [])
    .flatMap(g => g.structures)
    .filter(s => s.kind === "Turret" || s.kind === "Gate");

  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applyAllBusy, setApplyAllBusy] = useState(false);
  const [applyAllErr, setApplyAllErr] = useState<string | null>(null);

  // Fetch real on-chain delegation state by querying TurretDelegation objects
  const { data: onChainDelegations } = useQuery<Record<string, { vaultId: string; delegationObjId: string }>>({
    queryKey: ["turretDelegations", account.address],
    queryFn: async () => {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getOwnedObjects",
          params: [account.address, { filter: { StructType: `${CRADLEOS_ORIGINAL}::turret_delegation::TurretDelegation` }, options: { showContent: true } }, null, 50] }),
      });
      const j = await res.json() as { result: { data: Array<{ data: { objectId: string; content: { fields: { structure_id: string; tribe_vault_id: string; active: boolean } } } }> } };
      const map: Record<string, { vaultId: string; delegationObjId: string }> = {};
      for (const o of j.result?.data ?? []) {
        const f = o.data?.content?.fields;
        if (f?.active && f.structure_id) {
          map[f.structure_id] = { vaultId: f.tribe_vault_id, delegationObjId: o.data.objectId };
        }
      }
      return map;
    },
    staleTime: 15_000,
  });

  // Fetch OwnerCaps for this wallet's character — needed for authorize extension
  const { data: ownerCaps } = useQuery<{ capId: string; turretId: string; characterId: string }[]>({
    queryKey: ["turretOwnerCaps", account.address],
    queryFn: () => fetchOwnerCapsForWallet(account.address),
    staleTime: 60_000,
  });

  // Fetch extension status for each turret: check content.fields.extension field
  const turretIds = defensiveStructures.filter(s => s.kind === "Turret").map(s => s.objectId);
  const { data: extensionStatus, refetch: refetchExtension } = useQuery<Record<string, boolean>>({
    queryKey: ["turretExtensionStatus", turretIds.join(",")],
    queryFn: async () => {
      const result: Record<string, boolean> = {};
      await Promise.all(
        turretIds.map(async (id) => {
          try {
            const fields = await rpcGetObject(id);
            // extension field is Option<TypeName> — None = null/undefined, Some = object
            const ext = fields["extension"];
            // None variant: null, undefined, or { None: {} } / { variant: "None" }
            // Some variant: non-null object with a wrapped TypeName
            const isActive = ext !== null && ext !== undefined &&
              typeof ext === "object" &&
              !("None" in (ext as Record<string, unknown>)) &&
              (("Some" in (ext as Record<string, unknown>)) || ("fields" in (ext as Record<string, unknown>)));
            result[id] = isActive;
          } catch {
            result[id] = false;
          }
        })
      );
      return result;
    },
    enabled: turretIds.length > 0,
    staleTime: 30_000,
  });

  // Merge on-chain state with localStorage fallback: structure_id → delegated vaultId or null
  const [delegated, setDelegated] = useState<Record<string, string | null>>(() => {
    const state: Record<string, string | null> = {};
    for (const s of defensiveStructures) {
      state[s.objectId] = localStorage.getItem(`delegation:${s.objectId}`) ?? null;
    }
    return state;
  });

  // Sync on-chain delegations into state when loaded
  useEffect(() => {
    if (!onChainDelegations) return;
    setDelegated(prev => {
      const next = { ...prev };
      for (const s of defensiveStructures) {
        const entry = onChainDelegations[s.objectId];
        if (entry) {
          next[s.objectId] = entry.vaultId;
          localStorage.setItem(`delegation:${s.objectId}`, entry.vaultId);
          localStorage.setItem(`delegation-obj:${s.objectId}`, entry.delegationObjId);
        } else {
          next[s.objectId] = null;
          localStorage.removeItem(`delegation:${s.objectId}`);
        }
      }
      return next;
    });
  }, [onChainDelegations]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelegate = async (s: PlayerStructure, targetVaultId: string) => {
    setBusy(s.objectId);
    setErrors(prev => ({ ...prev, [s.objectId]: "" }));
    try {
      const tx = new Transaction();
      // Step 1: CradleOS delegation record
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::delegate_to_tribe`,
        arguments: [
          tx.pure.address(s.objectId),      // structure_id
          tx.pure.address(targetVaultId),    // tribe_vault_id (tribe or personal)
          tx.object(CLOCK),
        ],
      });

      // Step 2: For turrets, also authorize the CradleOS extension if not already active
      const isAlreadyExt = extensionStatus?.[s.objectId] === true;
      const cap = s.kind === "Turret" ? (ownerCaps ?? []).find(c => c.turretId === s.objectId) : null;
      if (s.kind === "Turret" && cap && policyId && !isAlreadyExt) {
        // Create TurretConfig
        tx.moveCall({
          target: `${CRADLEOS_PKG}::turret_ext::create_config_entry`,
          arguments: [
            tx.pure.address(s.objectId),
            tx.pure.address(policyId),
            tx.pure.u8(0), // AUTOCANNON default
          ],
        });
        // Borrow OwnerCap from character
        const turretType = `${WORLD_PKG}::turret::Turret`;
        const [borrowedCap, receipt] = tx.moveCall({
          target: `${WORLD_PKG}::character::borrow_owner_cap`,
          typeArguments: [turretType],
          arguments: [tx.object(cap.characterId), tx.object(cap.capId)],
        });
        // Authorize extension
        tx.moveCall({
          target: `${WORLD_PKG}::turret::authorize_extension`,
          typeArguments: [`${CRADLEOS_PKG}::turret_ext::TurretAuth`],
          arguments: [tx.object(s.objectId), borrowedCap],
        });
        // Return OwnerCap
        tx.moveCall({
          target: `${WORLD_PKG}::character::return_owner_cap`,
          typeArguments: [turretType],
          arguments: [tx.object(cap.characterId), borrowedCap, receipt],
        });
      }

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.setItem(`delegation:${s.objectId}`, targetVaultId);
      // Cache delegation object ID for future revoke
      try {
        const ownedRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getOwnedObjects",
            params: [account.address, { filter: { StructType: `${CRADLEOS_ORIGINAL}::turret_delegation::TurretDelegation` }, options: { showContent: true } }, null, 50] }),
        });
        const ownedJson = await ownedRes.json() as { result: { data: Array<{ data: { objectId: string; content: { fields: { structure_id: string } } } }> } };
        const match = ownedJson.result?.data?.find(o => o.data?.content?.fields?.structure_id === s.objectId);
        if (match?.data?.objectId) localStorage.setItem(`delegation-obj:${s.objectId}`, match.data.objectId);
      } catch { /* non-critical */ }
      setDelegated(prev => ({ ...prev, [s.objectId]: targetVaultId }));
      // Refresh extension status
      if (s.kind === "Turret" && cap && !isAlreadyExt) {
        setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["turretExtensionStatus"] }); refetchExtension(); }, 2500);
        setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["turretExtensionStatus"] }); refetchExtension(); }, 6000);
      }
    } catch (e) {
      setErrors(prev => ({ ...prev, [s.objectId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (s: PlayerStructure) => {
    const delegationObjId = localStorage.getItem(`delegation-obj:${s.objectId}`);
    if (!delegationObjId) {
      setErrors(prev => ({ ...prev, [s.objectId]: "Delegation object ID not found. Re-apply the policy first." }));
      return;
    }
    setBusy(s.objectId);
    setErrors(prev => ({ ...prev, [s.objectId]: "" }));
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CRADLEOS_PKG}::turret_delegation::revoke_delegation`,
        arguments: [
          tx.object(delegationObjId),  // owned TurretDelegation object
          tx.object(CLOCK),
        ],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      localStorage.removeItem(`delegation:${s.objectId}`);
      localStorage.removeItem(`delegation-obj:${s.objectId}`);
      setDelegated(prev => ({ ...prev, [s.objectId]: null }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [s.objectId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  // Unassigned structures for "Apply All" button
  const unassignedStructures = defensiveStructures.filter(s => !delegated[s.objectId]);

  const handleApplyAll = async (targetVaultId: string) => {
    setApplyAllBusy(true); setApplyAllErr(null);
    let succeeded = 0;
    for (const s of unassignedStructures) {
      try {
        await handleDelegate(s, targetVaultId);
        succeeded++;
      } catch { /* individual errors shown per-row */ }
    }
    setApplyAllBusy(false);
    if (succeeded < unassignedStructures.length) {
      setApplyAllErr(`${succeeded}/${unassignedStructures.length} succeeded`);
    }
  };

  const kindIcon: Record<string, string> = { Turret: "🔫", Gate: "🔀" };

  return (
    <div style={{
      margin: "0", padding: "20px 24px",
      borderTop: "1px solid rgba(255,71,0,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "4px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#FF4700",
        }}>
          Apply Policy to My Structures
        </div>
        {defensiveStructures.length > 0 && (
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(0,255,150,0.7)" }}>
            {Object.values(delegated).filter(v => v !== null).length}/{defensiveStructures.length} assigned
          </span>
        )}
      </div>
      <div style={{ fontSize: "11px", color: "rgba(107,107,94,0.7)", marginBottom: "14px" }}>
        Delegate your turrets and gates to follow a defense policy. Assigned structures show their active policy type.
      </div>

      {isLoading && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Scanning your structures…</div>
      )}

      {!isLoading && defensiveStructures.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.5)", fontSize: 12 }}>
          No turrets or gates found for this wallet.
        </div>
      )}

      {!isLoading && defensiveStructures.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Apply All buttons — only show when 2+ structures unassigned */}
          {unassignedStructures.length >= 2 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => handleApplyAll(vault.objectId)}
                disabled={applyAllBusy}
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace",
                  color: "#FF4700", border: "1px solid rgba(255,71,0,0.5)", padding: "5px 14px",
                  background: "rgba(255,71,0,0.08)", cursor: applyAllBusy ? "default" : "pointer",
                }}
              >
                {applyAllBusy ? "APPLYING…" : `APPLY TRIBE POLICY TO ALL (${unassignedStructures.length})`}
              </button>
              {personalVaultId && (
                <button
                  onClick={() => handleApplyAll(personalVaultId)}
                  disabled={applyAllBusy}
                  style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace",
                    color: "#c87fff", border: "1px solid rgba(160,80,255,0.4)", padding: "5px 14px",
                    background: "rgba(160,80,255,0.06)", cursor: applyAllBusy ? "default" : "pointer",
                  }}
                >
                  {applyAllBusy ? "APPLYING…" : `APPLY PERSONAL TO ALL (${unassignedStructures.length})`}
                </button>
              )}
              {applyAllErr && <span style={{ fontSize: 10, color: "#ff6432" }}>⚠ {applyAllErr}</span>}
            </div>
          )}
          {defensiveStructures.map(s => {
            const delegatedTo = delegated[s.objectId] ?? null;
            const isTribeDelegated = delegatedTo === vault.objectId;
            const isPersonalDelegated = !!personalVaultId && delegatedTo === personalVaultId;
            const isAssigned = isTribeDelegated || isPersonalDelegated;
            const isBusy = busy === s.objectId;
            const err = errors[s.objectId];
            // Extension status — only relevant for turrets
            const isExtActive = s.kind === "Turret" ? (extensionStatus?.[s.objectId] ?? false) : null;
            return (
              <div key={s.objectId} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${isTribeDelegated ? "rgba(0,255,150,0.2)" : isPersonalDelegated ? "rgba(160,80,255,0.25)" : "rgba(255,71,0,0.12)"}`,
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 15 }}>{kindIcon[s.kind] ?? "⚙️"}</span>
                <span style={{ flex: 1, fontSize: 12, color: "#e0e0d0", fontWeight: 600 }}>
                  {s.displayName}
                </span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(107,107,94,0.5)" }}>
                  #{s.objectId.slice(-6)}
                </span>
                {isTribeDelegated && (
                  <span style={{ fontSize: 10, color: "#00ff96", border: "1px solid rgba(0,255,150,0.25)", padding: "2px 8px", fontFamily: "monospace" }}>
                    ✓ TRIBE POLICY
                  </span>
                )}
                {isPersonalDelegated && (
                  <span style={{ fontSize: 10, color: "#c87fff", border: "1px solid rgba(160,80,255,0.35)", padding: "2px 8px", fontFamily: "monospace" }}>
                    ✓ PERSONAL POLICY
                  </span>
                )}
                {/* Extension status badge — turrets only */}
                {s.kind === "Turret" && isExtActive && (
                  <span style={{
                    fontSize: 10, color: "#00ff96",
                    border: "1px solid rgba(0,255,150,0.3)",
                    padding: "2px 8px", fontFamily: "monospace",
                    background: "rgba(0,255,150,0.06)",
                  }}>
                    ✓ EXTENSION
                  </span>
                )}
                {isAssigned ? (
                  <button
                    onClick={() => handleRevoke(s)}
                    disabled={isBusy}
                    style={{ fontSize: 10, color: "#ff6b6b", border: "1px solid rgba(255,107,107,0.3)", padding: "3px 10px", background: "transparent", cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.08em" }}
                  >
                    {isBusy ? "…" : "REVOKE"}
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleDelegate(s, vault.objectId)}
                      disabled={isBusy}
                      style={{ fontSize: 10, color: "#FF4700", border: "1px solid rgba(255,71,0,0.4)", padding: "3px 12px", background: "rgba(255,71,0,0.06)", cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.08em", fontWeight: 700 }}
                    >
                      {isBusy ? "…" : "APPLY TRIBE POLICY"}
                    </button>
                    {personalVaultId && (
                      <button
                        onClick={() => handleDelegate(s, personalVaultId)}
                        disabled={isBusy}
                        style={{ fontSize: 10, color: "#c87fff", border: "1px solid rgba(160,80,255,0.4)", padding: "3px 12px", background: "rgba(160,80,255,0.06)", cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.08em", fontWeight: 700 }}
                      >
                        {isBusy ? "…" : "APPLY PERSONAL POLICY"}
                      </button>
                    )}
                  </div>
                )}
                {err && (
                  <div style={{ width: "100%", fontSize: 10, color: "#ff6432", fontFamily: "monospace", marginTop: 2 }}>
                    ⚠ {err.slice(0, 120)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Policy Members — who has delegated to this policy ─────────────────────────

interface DelegationEntry {
  owner: string;
  structures: string[]; // structure_id list
}

async function fetchPolicyDelegations(vaultId: string): Promise<DelegationEntry[]> {
  // Fetch both DelegationCreated and DelegationRevoked events in parallel.
  // Net out revoked structure_ids per owner to get the live active set.
  try {
    const rpc = (id: number, eventType: string) =>
      fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id,
          method: "suix_queryEvents",
          params: [{ MoveEventType: eventType }, null, 200, false],
        }),
      }).then(r => r.json()) as Promise<{
        result: { data: Array<{ parsedJson: Record<string, string> }> }
      }>;

    const [created, revoked] = await Promise.all([
      rpc(1, `${CRADLEOS_ORIGINAL}::turret_delegation::DelegationCreated`),
      rpc(2, `${CRADLEOS_ORIGINAL}::turret_delegation::DelegationRevoked`),
    ]);

    // Filter created events to this vault
    const createdEvents = (created.result?.data ?? []).filter(
      e => e.parsedJson?.tribe_vault_id?.toLowerCase() === vaultId.toLowerCase()
    );

    // Build revoked set keyed by structure_id (vault-agnostic — a revoke removes the delegation)
    const revokedStructures = new Set(
      (revoked.result?.data ?? []).map(e => e.parsedJson?.structure_id?.toLowerCase())
    );

    // Group active (non-revoked) delegations by owner
    const map = new Map<string, Set<string>>();
    for (const e of createdEvents) {
      const { owner, structure_id } = e.parsedJson;
      if (revokedStructures.has(structure_id?.toLowerCase())) continue; // skip revoked
      if (!map.has(owner)) map.set(owner, new Set());
      map.get(owner)!.add(structure_id);
    }

    return Array.from(map.entries())
      .map(([owner, structs]) => ({ owner, structures: Array.from(structs) }))
      .filter(d => d.structures.length > 0); // drop owners with all-revoked turrets
  } catch {
    return [];
  }
}

function PolicyMembersSection({ vault }: { vault: TribeVaultState }) {
  const { data: delegations, isLoading } = useQuery<DelegationEntry[]>({
    queryKey: ["policyDelegations", vault.objectId],
    queryFn: () => fetchPolicyDelegations(vault.objectId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: "14px", borderTop: "1px solid rgba(255,71,0,0.12)" }}>
        <div style={{ color: "rgba(107,107,94,0.5)", fontSize: 12 }}>Loading delegated members…</div>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,71,0,0.15)",
      padding: "14px", marginBottom: "20px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
        color: "#FF4700", fontWeight: 600, fontSize: "13px",
      }}>
        Policy Members
        {delegations && delegations.length > 0 && (
          <span style={{ fontSize: 10, color: "rgba(107,107,94,0.6)", fontWeight: 400, fontFamily: "monospace" }}>
            {delegations.length} member{delegations.length !== 1 ? "s" : ""} · {delegations.reduce((s, d) => s + d.structures.length, 0)} turret{delegations.reduce((s, d) => s + d.structures.length, 0) !== 1 ? "s" : ""} delegated
          </span>
        )}
      </div>

      {(!delegations || delegations.length === 0) ? (
        <div style={{ color: "rgba(107,107,94,0.5)", fontSize: 12 }}>
          No members have delegated their turrets to this policy yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, fontSize: "10px", color: "rgba(107,107,94,0.55)", paddingBottom: 4, borderBottom: "1px solid rgba(255,71,0,0.08)" }}>
            <span style={{ flex: "1 1 auto" }}>Member</span>
            <span style={{ flex: "0 0 80px", textAlign: "right" }}>Turrets</span>
          </div>
          {delegations.map(d => (
            <div key={d.owner} style={{ display: "flex", gap: 8, fontSize: "12px", alignItems: "center" }}>
              <span style={{ flex: "1 1 auto", fontFamily: "monospace", fontSize: 11, color: "#e0e0d0" }}>
                {d.owner.slice(0, 6)}…{d.owner.slice(-4)}
              </span>
              <span style={{ flex: "0 0 80px", textAlign: "right", fontFamily: "monospace", color: "#00ff96", fontWeight: 700 }}>
                {d.structures.length}
              </span>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}

// ── Personal Policy Section ────────────────────────────────────────────────────

function PersonalPolicySection({
  account,
  characterTribeId,
}: {
  account: { address: string } | null;
  characterTribeId: number;
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [secBusy, setSecBusy] = useState(false);
  const [secErr, setSecErr] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState<string | null>(null);

  // Step 1: find personal vault
  const { data: personalVaultData, refetch: refetchVault } = useQuery<{ objectId: string; tribeId: number } | null>({
    queryKey: ["personalVault", account?.address],
    queryFn: () => account ? fetchPersonalVaultForWallet(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
    staleTime: 30_000,
  });

  // Step 2: find defense policy for personal vault
  const { data: personalPolicyId, refetch: refetchPolicy } = useQuery<string | null>({
    queryKey: ["personalDefensePolicy", personalVaultData?.objectId],
    queryFn: () => personalVaultData ? fetchDefensePolicyForVault(personalVaultData.objectId) : Promise.resolve(null),
    enabled: !!personalVaultData?.objectId,
    staleTime: 30_000,
  });

  // Step 3: find gate policy for personal vault
  const { data: personalGatePolicyId, refetch: refetchGatePolicy } = useQuery<string | null>({
    queryKey: ["personalGatePolicy", personalVaultData?.objectId],
    queryFn: () => personalVaultData ? fetchGatePolicyForVault(personalVaultData.objectId) : Promise.resolve(null),
    enabled: !!personalVaultData?.objectId,
    staleTime: 30_000,
  });

  // Security config for personal policy
  const { data: secConfig, refetch: refetchSec } = useQuery<SecurityConfig>({
    queryKey: ["securityConfig", personalPolicyId],
    queryFn: () => personalPolicyId ? fetchSecurityConfig(personalPolicyId) : Promise.resolve({ level: SEC_GREEN, aggressionMode: false }),
    enabled: !!personalPolicyId,
    staleTime: 15_000,
  });

  const step = !personalVaultData
    ? "no-vault"
    : !personalPolicyId
      ? "no-policy"
      : "ready";

  // Loading: vault query not yet resolved
  const loading = !account || (account && personalVaultData === undefined);

  const invalidateAll = () => {
    setTimeout(() => {
      refetchVault();
      refetchPolicy();
      refetchGatePolicy();
      queryClient.invalidateQueries({ queryKey: ["personalVault"] });
      queryClient.invalidateQueries({ queryKey: ["personalDefensePolicy"] });
      queryClient.invalidateQueries({ queryKey: ["personalGatePolicy"] });
    }, 2500);
    setTimeout(() => {
      refetchVault();
      refetchPolicy();
      refetchGatePolicy();
    }, 6000);
    setTimeout(() => {
      refetchVault();
      refetchPolicy();
      refetchGatePolicy();
    }, 13000);
  };

  const extractCreatedPolicyId = async (digest: string, vaultId: string): Promise<string | null> => {
    try {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock", params: [digest, { showEffects: true }] }),
      });
      const j = await res.json() as { result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } } };
      const created = (j.result?.effects?.created ?? []).filter(c => typeof c.owner === "object" && c.owner !== null && "Shared" in (c.owner as object)).map(c => c.reference.objectId);
      for (const id of created) {
        const objRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
        });
        const od = await objRes.json() as { result?: { data?: { type?: string } } };
        const t = od.result?.data?.type ?? "";
        if (t.includes("TribeDefensePolicy")) {
          try { localStorage.setItem(`cradleos:policy:${vaultId}`, id); } catch { /* */ }
          return id;
        }
      }
    } catch { /* */ }
    return null;
  };

  // Handle "Set up my defense policy" — creates vault then auto-creates policy
  const handleSetup = async () => {
    if (!account) return;
    setBusy(true); setErr(null);
    const signer = new CurrentAccountSigner(dAppKit);
    try {
      // Step A: create personal vault
      const tidToUse = characterTribeId || 1;
      const vaultTx = buildCreatePersonalVaultTx(tidToUse);
      const vaultResult = await signer.signAndExecuteTransaction({ transaction: vaultTx });
      const vaultDigest = (vaultResult as Record<string, unknown>)["digest"] as string | undefined;

      // Find the vault ID from effects
      let newVaultId: string | null = null;
      if (vaultDigest) {
        try {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock", params: [vaultDigest, { showEffects: true }] }),
          });
          const j = await res.json() as { result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } } };
          const shared = (j.result?.effects?.created ?? []).filter(c => typeof c.owner === "object" && c.owner !== null && "Shared" in (c.owner as object));
          if (shared.length > 0) newVaultId = shared[0].reference.objectId;
        } catch { /* */ }
      }

      // Wait briefly then create defense policy
      await new Promise(r => setTimeout(r, 2000));

      // Try to use the discovered vault, fallback to re-discovery
      if (!newVaultId) {
        const discovered = await fetchPersonalVaultForWallet(account.address);
        newVaultId = discovered?.objectId ?? null;
      }

      if (newVaultId) {
        const policyTx = await buildCreatePersonalDefensePolicyTx(newVaultId);
        const policyResult = await signer.signAndExecuteTransaction({ transaction: policyTx });
        const policyDigest = (policyResult as Record<string, unknown>)["digest"] as string | undefined;
        if (policyDigest) await extractCreatedPolicyId(policyDigest, newVaultId);
      }

      invalidateAll();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  // Handle "Create defense policy" (vault exists, no policy)
  const handleCreatePolicy = async () => {
    if (!account || !personalVaultData) return;
    setBusy(true); setErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      const tx = await buildCreatePersonalDefensePolicyTx(personalVaultData.objectId);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
      if (digest) await extractCreatedPolicyId(digest, personalVaultData.objectId);
      invalidateAll();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  // Handle security level change
  const handleSetLevel = async (level: number) => {
    if (!personalPolicyId || !personalVaultData) return;
    setSecBusy(true); setSecErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      const tx = await buildSetSecurityLevelTransaction(personalPolicyId, personalVaultData.objectId, level);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => refetchSec(), 2500);
    } catch (e) { setSecErr(e instanceof Error ? e.message : String(e)); }
    finally { setSecBusy(false); }
  };

  // Handle create gate policy
  const handleCreateGatePolicy = async () => {
    if (!account || !personalVaultData) return;
    setGateBusy(true); setGateErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      const tx = await buildCreatePersonalGatePolicyTx(personalVaultData.objectId);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidateAll();
    } catch (e) { setGateErr(e instanceof Error ? e.message : String(e)); }
    finally { setGateBusy(false); }
  };

  // Handle set gate access level
  const handleSetGateLevel = async (level: number) => {
    if (!personalGatePolicyId) return;
    setGateBusy(true); setGateErr(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      const tx = buildSetGateAccessLevelTx(personalGatePolicyId, personalVaultData!.objectId, level);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTimeout(() => refetchGatePolicy(), 2500);
    } catch (e) { setGateErr(e instanceof Error ? e.message : String(e)); }
    finally { setGateBusy(false); }
  };

  if (!account) return <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Connect wallet to manage your defense configuration.</div>;

  if (loading) return <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Loading your defense configuration…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ fontSize: 16, fontWeight: 700, color: "#c87fff", marginBottom: 6 }}>🛡 MY DEFENSE POLICY</div>
      <p style={{ fontSize: 12, color: "rgba(200,200,184,0.65)", marginBottom: 16, lineHeight: 1.6 }}>
        Control how your turrets and gates behave — your own rules, independent of any tribe.
      </p>

      {/* ── No personal setup yet ── */}
      {step === "no-vault" && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(107,107,94,0.6)", marginBottom: 14, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2 }}>
            No personal policy configured.
          </div>
          <button
            onClick={handleSetup}
            disabled={busy}
            style={{
              display: "block", width: "100%", padding: "10px 0", cursor: busy ? "default" : "pointer",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "inherit",
              background: busy ? "rgba(160,80,255,0.05)" : "rgba(160,80,255,0.12)",
              border: "1px solid rgba(160,80,255,0.35)", color: busy ? "rgba(160,80,255,0.4)" : "#c87fff",
              borderRadius: 2, transition: "all 0.15s",
            }}
          >
            {busy ? "Setting up…" : "⚡ SET UP MY DEFENSE POLICY"}
          </button>
          <div style={{ fontSize: 10, color: "rgba(107,107,94,0.5)", marginTop: 8, textAlign: "center" }}>
            Creates a private targeting policy linked only to your wallet.
          </div>
          {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
        </div>
      )}

      {/* ── Vault exists but no policy ── */}
      {step === "no-policy" && (
        <div>
          <div style={{ fontSize: 11, color: "rgba(107,107,94,0.6)", marginBottom: 10 }}>
            Personal setup found — <span style={{ fontFamily: "monospace", color: "#aaa" }}>{personalVaultData?.objectId.slice(0, 10)}…</span>
          </div>
          <button
            onClick={handleCreatePolicy}
            disabled={busy}
            style={{
              padding: "8px 20px", cursor: busy ? "default" : "pointer",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "inherit",
              background: busy ? "rgba(160,80,255,0.05)" : "rgba(160,80,255,0.12)",
              border: "1px solid rgba(160,80,255,0.35)", color: busy ? "rgba(160,80,255,0.4)" : "#c87fff",
              borderRadius: 2,
            }}
          >
            {busy ? "Creating…" : "⚡ CREATE DEFENSE POLICY"}
          </button>
          {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
        </div>
      )}

      {/* ── Ready: show controls ── */}
      {step === "ready" && personalPolicyId && personalVaultData && (
        <div>
          <div style={{ fontSize: 11, color: "#00ff96", marginBottom: 14 }}>
            ✓ Personal defense policy active
            <span style={{ fontFamily: "monospace", color: "rgba(107,107,94,0.5)", marginLeft: 8 }}>
              #{personalPolicyId.slice(-6)}
            </span>
          </div>

          {/* Security level */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(160,80,255,0.15)", borderRadius: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#aaa", marginBottom: 10 }}>
              SECURITY LEVEL
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([
                { level: SEC_GREEN,  label: "● GREEN",  color: "#00ff96", dimColor: "#1a4d2e", desc: "Arm on aggression only" },
                { level: SEC_YELLOW, label: "● YELLOW", color: "#ffcc00", dimColor: "#4d3d00", desc: "Arm on approach (blacklisted)" },
                { level: SEC_RED,    label: "● RED",    color: "#ff4444", dimColor: "#4d1111", desc: "Arm against all non-tribe" },
              ] as const).map(({ level, label, color, dimColor, desc }) => {
                const active = (secConfig?.level ?? SEC_GREEN) === level;
                return (
                  <button
                    key={level}
                    onClick={() => handleSetLevel(level)}
                    disabled={secBusy}
                    title={desc}
                    style={{
                      flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 2, cursor: secBusy ? "default" : "pointer",
                      background: active ? `${dimColor}80` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
                      color: active ? color : "#555",
                      fontSize: 11, fontWeight: active ? 700 : 400, letterSpacing: "0.05em",
                    }}
                  >
                    <div>{label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 400 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
            {secErr && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {secErr}</div>}
          </div>

          {/* Gate Policy sub-section */}
          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(160,80,255,0.15)", borderRadius: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#aaa", marginBottom: 10 }}>
              GATE POLICY
            </div>
            {personalGatePolicyId ? (
              <div>
                <div style={{ fontSize: 11, color: "#00ff96", marginBottom: 10 }}>
                  ✓ Gate policy active
                  <span style={{ fontFamily: "monospace", color: "rgba(107,107,94,0.5)", marginLeft: 8 }}>#{personalGatePolicyId.slice(-6)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(GATE_ACCESS_LABELS).map(([lvl, label]) => (
                    <button
                      key={lvl}
                      onClick={() => handleSetGateLevel(Number(lvl))}
                      disabled={gateBusy}
                      style={{
                        padding: "5px 14px", fontSize: 11, fontWeight: 600, borderRadius: 2,
                        cursor: gateBusy ? "default" : "pointer",
                        background: "rgba(160,80,255,0.08)", border: "1px solid rgba(160,80,255,0.25)",
                        color: "#c87fff",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: "rgba(107,107,94,0.6)", marginBottom: 10 }}>
                  No gate policy configured. Create one to control who can pass through your gates.
                </div>
                <button
                  onClick={handleCreateGatePolicy}
                  disabled={gateBusy}
                  style={{
                    padding: "6px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "inherit",
                    background: gateBusy ? "rgba(160,80,255,0.04)" : "rgba(160,80,255,0.1)",
                    border: "1px solid rgba(160,80,255,0.3)", color: "#c87fff",
                    borderRadius: 2, cursor: gateBusy ? "default" : "pointer",
                  }}
                >
                  {gateBusy ? "Creating…" : "⚡ CREATE GATE POLICY"}
                </button>
              </div>
            )}
            {gateErr && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 8 }}>⚠ {gateErr}</div>}
          </div>

          {/* Tribe Relations */}
          <TribeRelationsPersonal policyId={personalPolicyId} vaultId={personalVaultData.objectId} />

          {/* Player Relations */}
          <PersonalPlayerRelations policyId={personalPolicyId} vaultId={personalVaultData.objectId} />
        </div>
      )}
    </div>
  );
}

// ── Player Relations for personal policy ─────────────────────────────────────

function PersonalPlayerRelations({ policyId, vaultId }: { policyId: string; vaultId: string }) {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const queryClient = useQueryClient();
  const [playerInput, setPlayerInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: playerRelations } = useQuery<PlayerRelation[]>({
    queryKey: ["personalPlayerRelations", vaultId],
    queryFn: () => fetchPlayerRelations(vaultId),
    staleTime: 30_000,
  });

  const execTx = async (txPromise: ReturnType<typeof buildSetPlayerRelationTx>) => {
    if (!account) return;
    setBusy(true); setErr("");
    try {
      const tx = await txPromise;
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      queryClient.invalidateQueries({ queryKey: ["personalPlayerRelations", vaultId] });
    } catch (e) { setErr(e instanceof Error ? e.message.slice(0, 100) : String(e)); }
    finally { setBusy(false); setPlayerInput(""); }
  };

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(160,80,255,0.12)", borderRadius: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#aaa", marginBottom: 10 }}>PLAYER RELATIONS</div>
      {(playerRelations ?? []).length === 0
        ? <div style={{ fontSize: 11, color: "rgba(107,107,94,0.6)", marginBottom: 10 }}>No per-player overrides set.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {(playerRelations ?? []).map(pr => (
              <div key={pr.player} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ flex: 1, fontFamily: "monospace", color: pr.value === 1 ? "#00c864" : "#ff4444" }}>
                  {pr.player.slice(0, 10)}…{pr.player.slice(-6)} — {pr.value === 1 ? "Friendly" : "Hostile"}
                </span>
                <button onClick={() => execTx(buildRemovePlayerRelationTx(policyId, vaultId, pr.player))} disabled={busy}
                  style={{ fontSize: 9, padding: "1px 8px", cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#888", borderRadius: 2 }}>
                  remove
                </button>
              </div>
            ))}
          </div>
      }
      {account && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input value={playerInput} onChange={e => setPlayerInput(e.target.value)} placeholder="0x wallet address"
            style={{ flex: 1, minWidth: 180, padding: "4px 8px", fontSize: 11, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "monospace", borderRadius: 2 }} />
          <button onClick={() => { if (playerInput) execTx(buildSetPlayerRelationTx(policyId, vaultId, playerInput, 1)); }} disabled={busy || !playerInput}
            style={{ padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: 2 }}>
            + Friendly
          </button>
          <button onClick={() => { if (playerInput) execTx(buildSetPlayerRelationTx(policyId, vaultId, playerInput, 0)); }} disabled={busy || !playerInput}
            style={{ padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: 2 }}>
            + Hostile
          </button>
        </div>
      )}
      {err && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

// ── Tribe Relations for personal policy ──────────────────────────────────────

function TribeRelationsPersonal({ policyId, vaultId }: { policyId: string; vaultId: string }) {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Map<number, boolean>>(new Map());

  const { data: policy } = useQuery({
    queryKey: ["personalPolicyState", policyId],
    queryFn: () => fetchPolicyState(policyId),
    staleTime: 30_000,
  });

  const { data: relations } = useQuery({
    queryKey: ["personalRelations", policy?.relationsTableId],
    queryFn: () => policy?.relationsTableId ? fetchRelations(policy.relationsTableId) : Promise.resolve(new Map<number, boolean>()),
    enabled: !!policy?.relationsTableId,
    staleTime: 30_000,
  });

  const merged = new Map(relations ?? []);
  for (const [id, val] of draft) merged.set(id, val);

  const handleSave = async () => {
    if (!account || draft.size === 0) return;
    setSaveBusy(true); setSaveErr(null);
    try {
      const entries = [...draft.entries()];
      const tx = buildSetRelationsBatchTransaction(policyId, vaultId, entries.map(e => e[0]), entries.map(e => e[1]));
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDraft(new Map());
    } catch (e) { setSaveErr(e instanceof Error ? e.message.slice(0, 100) : String(e)); }
    finally { setSaveBusy(false); }
  };

  const WELL_KNOWN = WELL_KNOWN_TRIBES.filter(t => t.tribeId !== 0);
  const [manualTribeId, setManualTribeId] = useState("");
  const [selectedTribeId, setSelectedTribeId] = useState<number | "manual">("manual");

  // All tribes to show: well-known + any in draft/relations not in well-known
  const extraIds = [...new Set([...merged.keys(), ...draft.keys()])].filter(id => !WELL_KNOWN.find(t => t.tribeId === id));
  const allEntries: Array<{ tribeId: number; label: string }> = [
    ...WELL_KNOWN.map(t => ({ tribeId: t.tribeId, label: t.label })),
    ...extraIds.map(id => ({ tribeId: id, label: `Tribe #${id}` })),
  ];

  const addTribe = (tribeId: number, friendly: boolean) => {
    if (!tribeId || isNaN(tribeId)) return;
    setDraft(d => { const n = new Map(d); n.set(tribeId, friendly); return n; });
  };

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(160,80,255,0.12)", borderRadius: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#aaa", marginBottom: 10 }}>TRIBE RELATIONS</div>

      {/* Add tribe row — dropdown + manual entry + buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 2 }}>
        <select
          value={selectedTribeId === "manual" ? "manual" : String(selectedTribeId)}
          onChange={e => setSelectedTribeId(e.target.value === "manual" ? "manual" : Number(e.target.value))}
          style={{ flex: "0 0 160px", padding: "4px 8px", fontSize: 11, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", color: "#e0e0d0", borderRadius: 2 }}
        >
          <option value="manual">Enter tribe ID…</option>
          {WELL_KNOWN.map(t => <option key={t.tribeId} value={t.tribeId}>{t.label}</option>)}
        </select>
        {selectedTribeId === "manual" && (
          <input
            value={manualTribeId}
            onChange={e => setManualTribeId(e.target.value.replace(/\D/g, ""))}
            placeholder="Tribe ID (number)"
            style={{ flex: 1, minWidth: 100, padding: "4px 8px", fontSize: 11, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 2 }}
          />
        )}
        <button
          onClick={() => addTribe(selectedTribeId === "manual" ? Number(manualTribeId) : selectedTribeId, true)}
          disabled={selectedTribeId === "manual" ? !manualTribeId : false}
          style={{ padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", color: "#00c864", borderRadius: 2 }}>
          + Friendly
        </button>
        <button
          onClick={() => addTribe(selectedTribeId === "manual" ? Number(manualTribeId) : selectedTribeId, false)}
          disabled={selectedTribeId === "manual" ? !manualTribeId : false}
          style={{ padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", borderRadius: 2 }}>
          + Hostile
        </button>
      </div>

      {/* Current relations list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        {allEntries.filter(t => merged.has(t.tribeId) || draft.has(t.tribeId)).map(t => {
          const val = merged.get(t.tribeId);
          const draftVal = draft.get(t.tribeId);
          const current = draftVal ?? val;
          return (
            <div key={t.tribeId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <span style={{ flex: 1, color: "#e0e0d0" }}>{t.label}</span>
              <button onClick={() => setDraft(d => { const n = new Map(d); n.set(t.tribeId, true); return n; })}
                style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 2, cursor: "pointer",
                  background: current === true ? "rgba(0,200,100,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${current === true ? "#00c864" : "rgba(255,255,255,0.08)"}`,
                  color: current === true ? "#00c864" : "#555" }}>
                Friendly
              </button>
              <button onClick={() => setDraft(d => { const n = new Map(d); n.set(t.tribeId, false); return n; })}
                style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 2, cursor: "pointer",
                  background: current === false ? "rgba(255,68,68,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${current === false ? "#ff4444" : "rgba(255,255,255,0.08)"}`,
                  color: current === false ? "#ff4444" : "#555" }}>
                Hostile
              </button>
              {draftVal !== undefined && (
                <button onClick={() => setDraft(d => { const n = new Map(d); n.delete(t.tribeId); return n; })}
                  style={{ fontSize: 9, padding: "1px 6px", cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#555", borderRadius: 2 }}>
                  ↩
                </button>
              )}
            </div>
          );
        })}
        {allEntries.filter(t => merged.has(t.tribeId) || draft.has(t.tribeId)).length === 0 && (
          <div style={{ fontSize: 11, color: "rgba(107,107,94,0.5)" }}>No tribe relations set — add from dropdown above.</div>
        )}
      </div>
      {draft.size > 0 && (
        <button onClick={handleSave} disabled={saveBusy}
          style={{ padding: "4px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "inherit",
            background: "rgba(160,80,255,0.1)", border: "1px solid rgba(160,80,255,0.3)", color: "#c87fff",
            borderRadius: 2, cursor: saveBusy ? "default" : "pointer" }}>
          {saveBusy ? "Saving…" : `💾 SAVE (${draft.size} change${draft.size !== 1 ? "s" : ""})`}
        </button>
      )}
      {saveErr && <div style={{ color: "#ff6432", fontSize: 11, marginTop: 6 }}>⚠ {saveErr}</div>}
    </div>
  );
}
