/**
 * SharedAccessSection
 * ───────────────────────────────────────────────────────────────────────────
 * Per-SSU UI for `cradleos::ssu_access` (CradleOS package v10, 2026-04-26).
 *
 * Move module exposes:
 *   - bootstrap_registry(ctx)                          [one-time, deployer]
 *   - init_policy(registry, ssu, cap, ctx)             [owner, per-SSU]
 *   - set_tribe_alliance(policy, cap, tribe_ids[])      [owner]
 *   - set_allowlist(policy, cap, ids[], expiries[],
 *                   deposits[], withdraws[])           [owner]
 *   - set_hybrid(policy, cap, tribe_ids[], deny[],
 *                allow_ids[], allow_expiries[],
 *                allow_deposits[], allow_withdraws[])  [owner]
 *   - clear_policy(policy, cap)                        [owner]
 *   - shared_withdraw_to_character(ssu, policy,
 *                                  char, type_id, qty,
 *                                  clock, ctx)         [member]
 *   - shared_deposit(ssu, policy, char, item,
 *                    clock, ctx)                       [member]
 *
 * Policy discovery: SsuPolicyRegistry (shared object) maps ssu_id → policy_id
 * via a Sui `Table`. This component resolves it on mount and graceful-degrades
 * to "no policy" when the SSU has not been initialized.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import {
  SSU_ACCESS_PKG,
  SSU_ACCESS_AVAILABLE,
  SSU_POLICY_REGISTRY,
} from "../constants";
import {
  type AllowEntry,
  type AccessMode,
  type LoadedPolicy,
  loadPolicyForSsu,
} from "../lib/ssuAccess";

import { fetchTribeInfo } from "../lib";
import { WORLD_API } from "../constants";

// ──────────────────────────────────────────────────────────────────────────
// World-API tribe directory (cache: localStorage TTL + module-global)
//
// Stillness has 407 player+NPC tribes; the full set comes back in one
// `?limit=1000` GET. The world API doesn't expose ETags or diff endpoints,
// so we use a TTL-based localStorage cache: first dropdown open per session
// OR after `TRIBE_DIR_TTL_MS` of staleness triggers a refresh; everything
// in-between is instant and offline-tolerant.
//
// Filtering rules baked in here so every consumer sees the same view:
//   • only player tribes (id >= 98_000_000) — NPC corps (1_000_000–1_999_999)
//     are not joinable and shouldn't pollute the picker
//   • names are NOT unique on Stillness (e.g. 98000004 and 98000425 are both
//     literally "Reapers") so consumers must always render `Name (id)`
//
// Cache key includes WORLD_API host so a Stillness/Utopia switch invalidates
// the cache automatically (we can't trust cross-server data).
// ──────────────────────────────────────────────────────────────────────────

type TribeDirEntry = { id: number; name: string; ticker: string };

/** ID floor for player-created tribes on Stillness/Utopia. NPC corps occupy
 *  the 1_000_000–1_999_999 range and are not joinable; filter them out. */
const PLAYER_TRIBE_ID_FLOOR = 98_000_000;

/** Cache TTL for the tribe directory, in ms. World API has no diff/ETag
 *  endpoint, so we accept up to TRIBE_DIR_TTL_MS of staleness. New player
 *  tribes that show up between refreshes are still hand-addable as raw ids. */
const TRIBE_DIR_TTL_MS = 30 * 60 * 1000; // 30 min

const TRIBE_DIR_CACHE_VERSION = 1;
function tribeDirStorageKey(): string {
  // Bind cache key to WORLD_API host so server switches invalidate.
  return `cradleos.tribeDir.v${TRIBE_DIR_CACHE_VERSION}.${WORLD_API}`;
}

type CachedDir = { ts: number; entries: TribeDirEntry[] };

function readDirFromStorage(): CachedDir | null {
  try {
    const raw = localStorage.getItem(tribeDirStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDir;
    if (!parsed || typeof parsed.ts !== "number" || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch { return null; }
}

function writeDirToStorage(entries: TribeDirEntry[]): void {
  try {
    const payload: CachedDir = { ts: Date.now(), entries };
    localStorage.setItem(tribeDirStorageKey(), JSON.stringify(payload));
  } catch { /* quota/private-mode — fine to fail silently */ }
}

// Module-level RAM cache, primed lazily from localStorage.
let __tribeDirCache: TribeDirEntry[] | null = null;
let __tribeDirCacheTs = 0;
let __tribeDirInflight: Promise<TribeDirEntry[]> | null = null;

async function fetchAndStoreTribeDirectory(): Promise<TribeDirEntry[]> {
  try {
    const res = await fetch(`${WORLD_API}/v2/tribes?limit=1000`);
    const json = await res.json() as {
      data?: Array<{ id: number; name: string; nameShort: string }>;
    };
    const list: TribeDirEntry[] = (json.data ?? [])
      .filter(t => t.id >= PLAYER_TRIBE_ID_FLOOR)
      .map(t => ({ id: t.id, name: t.name, ticker: t.nameShort }));
    __tribeDirCache = list;
    __tribeDirCacheTs = Date.now();
    writeDirToStorage(list);
    return list;
  } catch {
    // Fall back to a stale cached copy if available.
    if (__tribeDirCache) return __tribeDirCache;
    const stale = readDirFromStorage();
    if (stale) {
      __tribeDirCache = stale.entries;
      __tribeDirCacheTs = stale.ts;
      return stale.entries;
    }
    __tribeDirCache = [];
    return [];
  }
}

async function loadTribeDirectory(): Promise<TribeDirEntry[]> {
  // RAM hit (fresh)
  if (__tribeDirCache && (Date.now() - __tribeDirCacheTs) < TRIBE_DIR_TTL_MS) {
    return __tribeDirCache;
  }
  // In-flight de-dup
  if (__tribeDirInflight) return __tribeDirInflight;
  // Try priming RAM from localStorage if cold
  if (!__tribeDirCache) {
    const stored = readDirFromStorage();
    if (stored) {
      __tribeDirCache = stored.entries;
      __tribeDirCacheTs = stored.ts;
      // Fresh enough? return immediately.
      if ((Date.now() - stored.ts) < TRIBE_DIR_TTL_MS) {
        return stored.entries;
      }
    }
  }
  // Need to refresh.
  __tribeDirInflight = (async () => {
    try { return await fetchAndStoreTribeDirectory(); }
    finally { __tribeDirInflight = null; }
  })();
  return __tribeDirInflight;
}

function useTribeDirectory(): TribeDirEntry[] {
  const [list, setList] = useState<TribeDirEntry[]>(() => __tribeDirCache ?? []);
  useEffect(() => {
    let cancelled = false;
    loadTribeDirectory().then(l => { if (!cancelled) setList(l); });
    return () => { cancelled = true; };
  }, []);
  return list;
}

// Types/decoders/chain-readers for ssu_access live in src/lib/ssuAccess.ts
// (imported above). Keeping them out of this file lets InventoryPanel and
// any future panel reuse the same logic without diverging.

type SharedAccessSectionProps = {
  ssuObjectId: string;
  /** Full struct type tag of the SSU as it exists on-chain (already package-swapped
   *  to whichever world package version the OwnerCap was minted against). Required
   *  for typeArguments on borrow_owner_cap / return_owner_cap — the dApp's WORLD_PKG
   *  constant tracks the latest world package, but type identity in Move resolves
   *  to the package that *first* defined the struct. Use the live object's typeFull,
   *  not a literal. */
  ssuTypeFull: string;
  ownerCapId: string | undefined;
  characterId: string | null;
  walletAddress: string | undefined;
  ssuTribeId?: number;
};

/** Extract the world package address that owns the SSU's defining module. */
function worldPkgFromTypeFull(typeFull: string): string {
  const m = typeFull.match(/^(0x[0-9a-fA-F]+)::/);
  return m ? m[1] : "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Tx builders
// ──────────────────────────────────────────────────────────────────────────────

function txWithBorrowedCap(
  characterId: string,
  ownerCapId: string,
  ssuTypeFull: string,
  fn: (tx: Transaction, cap: any) => void,
): Transaction {
  const tx = new Transaction();
  // Type identity for `OwnerCap<T>` resolves to the package that originally
  // defined `storage_unit::StorageUnit`. Always use the live object's typeFull,
  // never a literal built from WORLD_PKG. The moveCall *target* package can
  // remain the latest — only typeArguments are identity-sensitive.
  const wpkg = worldPkgFromTypeFull(ssuTypeFull);
  const [cap, receipt] = tx.moveCall({
    target: `${wpkg}::character::borrow_owner_cap`,
    typeArguments: [ssuTypeFull],
    arguments: [tx.object(characterId), tx.object(ownerCapId)],
  });
  fn(tx, cap);
  tx.moveCall({
    target: `${wpkg}::character::return_owner_cap`,
    typeArguments: [ssuTypeFull],
    arguments: [tx.object(characterId), cap, receipt],
  });
  return tx;
}

/**
 * Combined authorize + init in a single PTB / single signature.
 *
 * Both calls require `&OwnerCap<StorageUnit>` so we borrow once, run both
 * moveCalls back-to-back inside the borrow window, and return the cap. This
 * is atomic: either both succeed or both revert.
 *
 * Order matters: `authorize_extension` must come BEFORE `init_policy` because
 * `init_policy` reads from the SSU's extension config to verify the auth is
 * present (defensive check; init_policy itself does not require it on-chain,
 * but pairing them in one tx ensures the SSU is always in a usable state
 * after a successful enable).
 */
function buildEnableSharedAccessTx(
  ssuObjectId: string,
  ssuTypeFull: string,
  ownerCapId: string,
  characterId: string,
): Transaction {
  const wpkg = worldPkgFromTypeFull(ssuTypeFull);
  return txWithBorrowedCap(characterId, ownerCapId, ssuTypeFull, (tx, cap) => {
    // Step 1: authorize the cradleos::ssu_access extension on the SSU
    tx.moveCall({
      target: `${wpkg}::storage_unit::authorize_extension`,
      typeArguments: [`${SSU_ACCESS_PKG}::ssu_access::SsuAuth`],
      arguments: [tx.object(ssuObjectId), cap],
    });
    // Step 2: create the SsuPolicy shared object and register it
    tx.moveCall({
      target: `${SSU_ACCESS_PKG}::ssu_access::init_policy`,
      arguments: [
        tx.object(SSU_POLICY_REGISTRY),
        tx.object(ssuObjectId),
        cap,
      ],
    });
  });
}

function buildSetPolicyTx(
  policyId: string,
  ssuTypeFull: string,
  ownerCapId: string,
  characterId: string,
  mode: AccessMode,
): Transaction {
  return txWithBorrowedCap(characterId, ownerCapId, ssuTypeFull, (tx, cap) => {
    switch (mode.kind) {
      case "tribe_alliance":
        tx.moveCall({
          target: `${SSU_ACCESS_PKG}::ssu_access::set_tribe_alliance`,
          arguments: [
            tx.object(policyId),
            cap,
            tx.pure.vector("u32", mode.tribeIds),
          ],
        });
        break;
      case "allowlist": {
        const ids = mode.entries.map(e => e.characterId);
        const exps = mode.entries.map(e => String(e.expiresAt));
        const deps = mode.entries.map(e => e.canDeposit);
        const wds  = mode.entries.map(e => e.canWithdraw);
        tx.moveCall({
          target: `${SSU_ACCESS_PKG}::ssu_access::set_allowlist`,
          arguments: [
            tx.object(policyId),
            cap,
            tx.pure.vector("id", ids),
            tx.pure.vector("u64", exps),
            tx.pure.vector("bool", deps),
            tx.pure.vector("bool", wds),
          ],
        });
        break;
      }
      case "hybrid": {
        const ids = mode.allow.map(e => e.characterId);
        const exps = mode.allow.map(e => String(e.expiresAt));
        const deps = mode.allow.map(e => e.canDeposit);
        const wds  = mode.allow.map(e => e.canWithdraw);
        tx.moveCall({
          target: `${SSU_ACCESS_PKG}::ssu_access::set_hybrid`,
          arguments: [
            tx.object(policyId),
            cap,
            tx.pure.vector("u32", mode.tribeIds),
            tx.pure.vector("id", mode.deny),
            tx.pure.vector("id", ids),
            tx.pure.vector("u64", exps),
            tx.pure.vector("bool", deps),
            tx.pure.vector("bool", wds),
          ],
        });
        break;
      }
      case "none":
        tx.moveCall({
          target: `${SSU_ACCESS_PKG}::ssu_access::clear_policy`,
          arguments: [tx.object(policyId), cap],
        });
        break;
      case "public":
        tx.moveCall({
          target: `${SSU_ACCESS_PKG}::ssu_access::set_public`,
          arguments: [tx.object(policyId), cap],
        });
        break;
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function SharedAccessSection({
  ssuObjectId,
  ssuTypeFull,
  ownerCapId,
  characterId,
  walletAddress,
  ssuTribeId,
}: SharedAccessSectionProps) {
  // Feature is only available on servers where ssu_access is published. The
  // module is hard-linked to a specific world package lineage at publish time;
  // see constants.ts for the per-server architecture rationale.
  if (!SSU_ACCESS_AVAILABLE) return null;

  const dAppKit = useDAppKit();
  const [loaded, setLoaded] = useState<LoadedPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccessMode>({ kind: "none" });
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = !!ownerCapId;

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await loadPolicyForSsu(ssuObjectId);
    setLoaded(r);
    setDraft(r.mode);
    setLoading(false);
  }, [ssuObjectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // ── Tx handlers ────────────────────────────────────────────────────────────

  const runTx = async (label: string, tx: Transaction) => {
    if (!walletAddress) return;
    setTxError(null);
    setTxStatus(null);
    setBusy(true);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTxStatus(`${label} ✓`);
      await refresh();
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const onEnableSharedAccess = () => {
    if (!characterId || !ownerCapId) return;
    void runTx(
      "Shared access enabled",
      buildEnableSharedAccessTx(ssuObjectId, ssuTypeFull, ownerCapId, characterId),
    );
  };

  const onSubmitPolicy = () => {
    if (!characterId || !ownerCapId || !loaded?.policyId) return;
    void runTx("Policy applied", buildSetPolicyTx(loaded.policyId, ssuTypeFull, ownerCapId, characterId, draft));
    setEditing(false);
  };

  const policy = loaded?.mode ?? { kind: "none" as const };
  const policyExists = !!loaded?.policyId;

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,71,0,0.08)",
        background: "rgba(255,71,0,0.015)",
        padding: "8px 14px 12px",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "rgba(255,71,0,0.7)",
            textTransform: "uppercase",
          }}
        >
          SHARED ACCESS
        </span>
        <PolicyBadge policy={policy} loading={loading} exists={policyExists} />
        {isOwner && policyExists && !editing && (
          <button onClick={() => setEditing(true)} style={editButtonStyle} disabled={busy}>
            CONFIGURE
          </button>
        )}
        {isOwner && !policyExists && !loading && (
          <button
            onClick={onEnableSharedAccess}
            style={editButtonStyle}
            disabled={busy}
            title="Authorize the cradleos::ssu_access extension and create the SsuPolicy object — single transaction"
          >
            {busy ? "…" : "ENABLE SHARED ACCESS"}
          </button>
        )}
      </div>

      {/* Tx banner */}
      {(txStatus || txError) && (
        <div
          style={{
            padding: "4px 8px",
            fontFamily: "monospace",
            fontSize: 10,
            marginBottom: 6,
            color: txError ? "#ff6b6b" : "#00ff96",
            background: txError ? "rgba(255,107,107,0.05)" : "rgba(0,255,150,0.04)",
            borderLeft: txError ? "2px solid #ff6b6b" : "2px solid rgba(0,255,150,0.5)",
          }}
        >
          {txError ? `ERR: ${txError}` : txStatus}
        </div>
      )}

      {/* Read view */}
      {!editing && (
        <>
          {!policyExists && !loading && (
            <div style={readTextStyle}>
              {isOwner
                ? "No policy installed. Authorize the extension and initialize a policy to allow tribemates or named characters to use this SSU's open inventory."
                : "Owner-only access. The owner has not configured shared access."}
            </div>
          )}
          {policyExists && <PolicyReadView policy={policy} ssuTribeId={ssuTribeId} />}
        </>
      )}

      {/* Edit view */}
      {editing && policyExists && loaded?.policyId && (
        <PolicyEditor
          draft={draft}
          setDraft={setDraft}
          ssuTribeId={ssuTribeId}
          busy={busy}
          onCancel={() => {
            setEditing(false);
            setDraft(policy);
            setTxError(null);
            setTxStatus(null);
          }}
          onSubmit={onSubmitPolicy}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function PolicyBadge({
  policy,
  loading,
  exists,
}: {
  policy: AccessMode;
  loading: boolean;
  exists: boolean;
}) {
  if (loading) return <span style={badgeStyle("rgba(107,107,94,0.4)")}>loading…</span>;
  if (!exists) return <span style={badgeStyle("rgba(107,107,94,0.5)")}>OWNER ONLY</span>;
  if (policy.kind === "none") return <span style={badgeStyle("rgba(107,107,94,0.5)")}>OWNER ONLY</span>;
  if (policy.kind === "tribe_alliance") {
    const n = policy.tribeIds.length;
    return <span style={badgeStyle("#00ff96")}>{n <= 1 ? "TRIBE" : `ALLIANCE · ${n}`}</span>;
  }
  if (policy.kind === "allowlist") return <span style={badgeStyle("#00cfff")}>ALLOWLIST · {policy.entries.length}</span>;
  if (policy.kind === "public") return <span style={badgeStyle("#ff44aa")}>PUBLIC</span>;
  return <span style={badgeStyle("#ffaa00")}>HYBRID</span>;
}

function PolicyReadView({ policy, ssuTribeId }: { policy: AccessMode; ssuTribeId?: number }) {
  if (policy.kind === "none") {
    return <div style={readTextStyle}>Policy initialized but inactive (owner-only). Click CONFIGURE to enable shared access.</div>;
  }
  if (policy.kind === "public") {
    return (
      <div style={readTextStyle}>
        <div style={{ color: "#ff77c0", marginBottom: 2 }}>⚠ Public access — anyone on the chain may deposit and withdraw.</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>
          No tribe gating, no allowlist, no rate limit. Use only for donation boxes,
          freeport gas depots, or other intentionally-open storage.
        </div>
      </div>
    );
  }
  if (policy.kind === "tribe_alliance") {
    return (
      <div style={readTextStyle}>
        <div style={{ marginBottom: 4 }}>
          {policy.tribeIds.length === 0
            ? "Tribe-alliance policy active but empty (admits nobody). Configure to add tribes."
            : policy.tribeIds.length === 1
              ? "Members of this tribe can deposit and withdraw via the open inventory:"
              : `Alliance of ${policy.tribeIds.length} tribes can deposit and withdraw:`}
        </div>
        <TribeChipReadList tribeIds={policy.tribeIds} ssuTribeId={ssuTribeId} />
      </div>
    );
  }
  if (policy.kind === "allowlist") {
    return (
      <div style={readTextStyle}>
        <div style={{ marginBottom: 4 }}>
          Allowlist · {policy.entries.length} character{policy.entries.length === 1 ? "" : "s"}:
        </div>
        <EntryList entries={policy.entries} />
      </div>
    );
  }
  return (
    <div style={readTextStyle}>
      <div style={{ marginBottom: 4 }}>
        {policy.tribeIds.length <= 1 ? "Tribe + named entries:" : `Alliance of ${policy.tribeIds.length} tribes + named entries:`}
      </div>
      <TribeChipReadList tribeIds={policy.tribeIds} ssuTribeId={ssuTribeId} />
      {policy.deny.length > 0 && (
        <div style={{ marginTop: 4 }}>
          Excluded: {policy.deny.length} character{policy.deny.length === 1 ? "" : "s"}
        </div>
      )}
      {policy.allow.length > 0 && (
        <>
          <div style={{ marginTop: 4 }}>Additional allow:</div>
          <EntryList entries={policy.allow} />
        </>
      )}
    </div>
  );
}

function EntryList({ entries }: { entries: AllowEntry[] }) {
  const now = Date.now();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {entries.map((e, i) => {
        const expired = e.expiresAt > 0 && e.expiresAt < now;
        return (
          <div
            key={i}
            style={{
              display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace",
              color: expired ? "rgba(107,107,94,0.4)" : "#c8c8b8",
              textDecoration: expired ? "line-through" : "none",
            }}
          >
            <span style={{ color: "rgba(107,107,94,0.55)" }}>{short(e.characterId)}</span>
            <span style={{ color: "rgba(107,107,94,0.4)" }}>
              {e.canDeposit ? "↓" : "·"}{e.canWithdraw ? "↑" : "·"}
            </span>
            {e.expiresAt > 0 && (
              <span style={{ color: "rgba(107,107,94,0.4)" }}>ttl: {fmtExpiry(e.expiresAt)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PolicyEditor({
  draft, setDraft, ssuTribeId, busy, onCancel, onSubmit,
}: {
  draft: AccessMode;
  setDraft: (m: AccessMode) => void;
  ssuTribeId?: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 8,
        padding: "6px 8px", background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,71,0,0.15)",
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {(
          [
            { kind: "none", label: "OWNER" },
            { kind: "tribe_alliance", label: "TRIBE" },
            { kind: "allowlist", label: "ALLOWLIST" },
            { kind: "hybrid", label: "HYBRID" },
            { kind: "public", label: "PUBLIC" },
          ] as const
        ).map(opt => {
          const active = draft.kind === opt.kind;
          return (
            <button
              key={opt.kind}
              onClick={() => setDraft(switchMode(opt.kind, draft, ssuTribeId))}
              style={modeTabStyle(active)}
              disabled={busy}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {draft.kind === "none" && (
        <div style={hintStyle}>Owner-only access. Existing shared policy will be cleared.</div>
      )}

      {draft.kind === "public" && (
        <div style={{
          padding: "8px 10px",
          background: "rgba(255,68,170,0.08)",
          border: "1px solid rgba(255,68,170,0.4)",
          color: "#ffb0d8",
          fontSize: 11,
          lineHeight: 1.4,
        }}>
          <div style={{ color: "#ff77c0", fontWeight: "bold", marginBottom: 4 }}>
            ⚠ PUBLIC ACCESS — read carefully
          </div>
          Anyone on the chain (any character, any tribe) will be able to deposit
          AND withdraw items from this SSU. There is no rate limit and no per-character
          cap. This is appropriate for donation boxes or freeport gas depots, but
          NOT for storing anything you care about. Use ALLOWLIST with finite expiries
          for time-limited public access instead.
        </div>
      )}

      {draft.kind === "tribe_alliance" && (
        <TribeChipEditor
          tribeIds={draft.tribeIds}
          ssuTribeId={ssuTribeId}
          onChange={next => setDraft({ kind: "tribe_alliance", tribeIds: next })}
        />
      )}

      {(draft.kind === "allowlist" || draft.kind === "hybrid") && (
        <AllowlistEditor
          entries={draft.kind === "allowlist" ? draft.entries : draft.allow}
          onChange={next => {
            if (draft.kind === "allowlist") setDraft({ kind: "allowlist", entries: next });
            else setDraft({ ...draft, allow: next });
          }}
        />
      )}

      {draft.kind === "hybrid" && (
        <>
          <TribeChipEditor
            tribeIds={draft.tribeIds}
            ssuTribeId={ssuTribeId}
            onChange={next => setDraft({ ...draft, tribeIds: next })}
          />
          <DenyListEditor
            deny={draft.deny}
            onChange={next => setDraft({ ...draft, deny: next })}
          />
        </>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={onSubmit} style={primaryButtonStyle} disabled={busy}>
          {busy ? "…" : "APPLY POLICY"}
        </button>
        <button onClick={onCancel} style={ghostButtonStyle} disabled={busy}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AllowEntryRow — one character's permissions: id + deposit/withdraw + expiry
//
// expires_at is u64 epoch ms (matches `clock::timestamp_ms` in ssu_access.move).
// 0 = no expiry. UX exposes a friendly datetime picker + quick-set chips so
// nobody has to type epoch milliseconds by hand.
// ──────────────────────────────────────────────────────────────────────────
function AllowEntryRow({
  entry, onChange, onRemove,
}: {
  entry: AllowEntry;
  onChange: (patch: Partial<AllowEntry>) => void;
  onRemove: () => void;
}) {
  // Convert ms↔"YYYY-MM-DDTHH:mm" (datetime-local input format, in user's TZ).
  const dtLocalValue = entry.expiresAt > 0 ? msToLocalInput(entry.expiresAt) : "";
  const setExpiry = (ms: number) => onChange({ expiresAt: ms });
  const now = Date.now();

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "6px 8px",
      background: "rgba(255,71,0,0.04)",
      border: "1px solid rgba(255,71,0,0.18)",
    }}>
      {/* Row 1: character id + remove */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          placeholder="0x… character object id"
          value={entry.characterId}
          onChange={ev => onChange({ characterId: ev.target.value })}
          style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 11 }}
        />
        <button onClick={onRemove} style={removeButtonStyle} title="remove this character">✕</button>
      </div>

      {/* Row 2: permission checkboxes + expiry */}
      <div style={{
        display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
        fontSize: 11,
      }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={entry.canDeposit}
            onChange={ev => onChange({ canDeposit: ev.target.checked })}
          />
          <span style={{ color: entry.canDeposit ? "#00ff96" : "#666" }}>can deposit</span>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={entry.canWithdraw}
            onChange={ev => onChange({ canWithdraw: ev.target.checked })}
          />
          <span style={{ color: entry.canWithdraw ? "#00ff96" : "#666" }}>can withdraw</span>
        </label>

        <span style={{ flex: 1 }} />

        {/* Expiry block */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ opacity: 0.7, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            access expires:
          </span>
          <input
            type="datetime-local"
            value={dtLocalValue}
            onChange={ev => {
              const v = ev.target.value;
              if (!v) { setExpiry(0); return; }
              const ms = localInputToMs(v);
              setExpiry(Number.isFinite(ms) ? ms : 0);
            }}
            style={{ ...inputStyle, width: 180, fontSize: 11 }}
          />
          {entry.expiresAt > 0 && (
            <button
              onClick={() => setExpiry(0)}
              style={{ ...smallButtonStyle, fontSize: 10, padding: "2px 6px" }}
              title="remove expiry"
            >clear</button>
          )}
        </span>
      </div>

      {/* Row 3: quick-set chips + status */}
      <div style={{
        display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
        fontSize: 10, opacity: 0.85,
      }}>
        <span style={{ opacity: 0.6 }}>quick set:</span>
        <button onClick={() => setExpiry(now + 60 * 60 * 1000)} style={chipButtonStyle}>+1h</button>
        <button onClick={() => setExpiry(now + 24 * 60 * 60 * 1000)} style={chipButtonStyle}>+1d</button>
        <button onClick={() => setExpiry(now + 7 * 24 * 60 * 60 * 1000)} style={chipButtonStyle}>+1w</button>
        <button onClick={() => setExpiry(now + 30 * 24 * 60 * 60 * 1000)} style={chipButtonStyle}>+30d</button>
        <button onClick={() => setExpiry(0)} style={{ ...chipButtonStyle, color: "#00ff96" }}>never</button>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 10,
          color: entry.expiresAt === 0 ? "#00ff96"
            : entry.expiresAt < now ? "#ff4444"
            : "#aaa",
        }}>
          {entry.expiresAt === 0
            ? "∞ never expires"
            : entry.expiresAt < now
              ? "⚠ already expired"
              : `expires in ${humanizeDuration(entry.expiresAt - now)}`}
        </span>
      </div>
    </div>
  );
}

/** Convert epoch ms to `YYYY-MM-DDTHH:mm` in the user's local timezone
 *  (the format `<input type="datetime-local">` requires). */
function msToLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of `msToLocalInput` — parses a datetime-local value into epoch ms. */
function localInputToMs(v: string): number {
  // datetime-local has no TZ suffix — Date(...) parses it as local time.
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Render a positive ms duration as a compact human string ("5d 3h", "2h 14m", "45s"). */
function humanizeDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  if (hrs > 0)  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return `${sec}s`;
}

function AllowlistEditor({
  entries, onChange,
}: {
  entries: AllowEntry[];
  onChange: (next: AllowEntry[]) => void;
}) {
  const update = (i: number, patch: Partial<AllowEntry>) => {
    const next = [...entries];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...entries,
      { characterId: "", expiresAt: 0, canDeposit: true, canWithdraw: true },
    ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>allow (per-character permissions):</label>
      {entries.map((e, i) => (
        <AllowEntryRow
          key={i}
          entry={e}
          onChange={patch => update(i, patch)}
          onRemove={() => remove(i)}
        />
      ))}
      <button onClick={add} style={smallButtonStyle}>+ add character</button>
    </div>
  );
}

function DenyListEditor({
  deny, onChange,
}: {
  deny: string[];
  onChange: (next: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...deny];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(deny.filter((_, idx) => idx !== i));
  const add = () => onChange([...deny, ""]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>deny (overrides tribe):</label>
      {deny.map((id, i) => (
        <div key={i} style={{ display: "flex", gap: 4 }}>
          <input
            placeholder="0x… character object id"
            value={id}
            onChange={ev => update(i, ev.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button onClick={() => remove(i)} style={removeButtonStyle}>✕</button>
        </div>
      ))}
      <button onClick={add} style={smallButtonStyle}>+ deny character</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tribe chip editor / reader (multi-tribe alliance support)
//
// Shows tribe entries as chips with the in-game name resolved from the world
// API (cached in-component, fire-and-forget; falls back to numeric id while
// loading or on error). Pre-populates with the user's current tribe id when
// available and the list is empty.
// ──────────────────────────────────────────────────────────────────────────────

function useTribeNames(tribeIds: number[]): Map<number, string> {
  const [names, setNames] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const missing = tribeIds.filter(id => Number.isFinite(id) && id > 0 && !names.has(id));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async id => {
        const info = await fetchTribeInfo(id).catch(() => null);
        return [id, info?.name ?? ""] as const;
      }),
    ).then(results => {
      if (cancelled) return;
      setNames(prev => {
        const next = new Map(prev);
        for (const [id, name] of results) next.set(id, name);
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tribeIds.join(",")]);

  return names;
}

function TribeChipReadList({
  tribeIds,
  ssuTribeId,
}: {
  tribeIds: number[];
  ssuTribeId?: number;
}) {
  const names = useTribeNames(tribeIds);
  if (tribeIds.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tribeIds.map(id => {
        const name = names.get(id);
        const isMine = ssuTribeId === id;
        return (
          <span
            key={id}
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              padding: "2px 6px",
              border: `1px solid ${isMine ? "rgba(0,255,150,0.6)" : "rgba(255,71,0,0.3)"}`,
              background: isMine ? "rgba(0,255,150,0.05)" : "rgba(255,71,0,0.04)",
              color: isMine ? "#00ff96" : "#ff8c4a",
            }}
            title={isMine ? "Your tribe" : `tribe_id ${id}`}
          >
            {name ? `${name} (${id})` : `#${id}`}
            {isMine && <span style={{ marginLeft: 4, opacity: 0.7 }}>★</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Searchable tribe dropdown. Mirrors QueryPanel's tribe-search UX: type to
 * filter the world-API tribe directory by name / ticker / numeric id, then
 * click a result (or press Enter on the highlighted row) to add. Hides the
 * tribes already in `excludeIds` and visually marks the user's own tribe.
 */
function TribePicker({
  excludeIds,
  ssuTribeId,
  onPick,
}: {
  excludeIds: number[];
  ssuTribeId?: number;
  onPick: (tribeId: number) => void;
}) {
  const directory = useTribeDirectory();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  // Position state for the portaled dropdown panel. We render to document.body
  // so it always stacks above sibling SSU cards regardless of their internal
  // overflow/transform/z-index. Coords are recomputed on open + scroll + resize.
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const recomputePanelRect = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setPanelRect({ top: r.bottom + 2, left: r.left, width: r.width });
  }, []);

  // Re-position on open + on every scroll/resize while open. We use
  // window-level listeners with capture so nested scrollable parents trigger
  // the recompute too — the input could be inside a panel that scrolls
  // independently of the document.
  useEffect(() => {
    if (!open) { setPanelRect(null); return; }
    recomputePanelRect();
    const onMove = () => recomputePanelRect();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, recomputePanelRect]);

  // Close dropdown on outside click. Treat clicks inside the input wrapper OR
  // the portaled dropdown as inside.
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const excluded = new Set(excludeIds);
  const q = query.trim().toLowerCase();
  const isNumQuery = /^\d+$/.test(q);

  // Filter + rank: exact id match first, then prefix-name matches, then
  // contains-name, then ticker, capped at 50 results to keep the list snappy.
  const filtered = (() => {
    if (!directory.length) return [];
    const candidates = directory.filter(t => !excluded.has(t.id));
    if (!q) {
      // Empty query: show user's own tribe first if available, then alpha by name (limit 50).
      const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));
      if (ssuTribeId !== undefined) {
        const mineIdx = sorted.findIndex(t => t.id === ssuTribeId);
        if (mineIdx > 0) {
          const [mine] = sorted.splice(mineIdx, 1);
          sorted.unshift(mine);
        }
      }
      return sorted.slice(0, 50);
    }
    const exactId: TribeDirEntry[] = [];
    const prefixName: TribeDirEntry[] = [];
    const containsName: TribeDirEntry[] = [];
    const ticker: TribeDirEntry[] = [];
    for (const t of candidates) {
      const name = t.name.toLowerCase();
      const tk = t.ticker.toLowerCase();
      if (isNumQuery && String(t.id) === q) exactId.push(t);
      else if (name.startsWith(q)) prefixName.push(t);
      else if (name.includes(q)) containsName.push(t);
      else if (tk.includes(q)) ticker.push(t);
    }
    return [...exactId, ...prefixName, ...containsName, ...ticker].slice(0, 50);
  })();

  const commit = (entry: TribeDirEntry | undefined) => {
    if (!entry) return;
    onPick(entry.id);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  };

  const onKey = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
      setOpen(true);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      // If user typed a numeric id that isn't in the directory (e.g. obscure
      // tribe), still allow adding it raw.
      if (filtered[highlight]) {
        commit(filtered[highlight]);
      } else if (isNumQuery) {
        const id = Number(q);
        if (id > 0 && !excluded.has(id)) {
          onPick(id);
          setQuery("");
          setOpen(false);
          setHighlight(0);
        }
      }
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  };

  // Build the portaled panel. We position with `position: fixed` so the panel
  // is anchored to the input regardless of any parent's overflow/transform.
  const panel = (open && panelRect && (filtered.length > 0 || q)) ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: panelRect.top, left: panelRect.left, width: panelRect.width,
        zIndex: 9999,
        maxHeight: 280,
        overflowY: "auto",
        background: "#0c0c0e",
        border: filtered.length > 0
          ? "1px solid rgba(255,71,0,0.4)"
          : "1px solid rgba(255,71,0,0.3)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
      }}
    >
      {filtered.length > 0 ? (
        <>
          {filtered.map((t, i) => {
            const isMine = ssuTribeId === t.id;
            const isHL = i === highlight;
            return (
              <div
                key={t.id}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={ev => { ev.preventDefault(); commit(t); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px",
                  cursor: "pointer",
                  background: isHL ? "rgba(255,71,0,0.15)" : "transparent",
                  borderLeft: isMine ? "3px solid #00ff96" : "3px solid transparent",
                  fontSize: 12,
                }}
              >
                <span style={{ color: isMine ? "#00ff96" : "#eee" }}>
                  {isMine && <span style={{ marginRight: 6, opacity: 0.8 }}>★</span>}
                  {t.name}
                  <span style={{ marginLeft: 6, opacity: 0.55, fontFamily: "monospace", fontSize: 11 }}>
                    ({t.id})
                  </span>
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.7, color: "#ff8c4a" }}>
                  {t.ticker}
                </span>
              </div>
            );
          })}
          {filtered.length === 50 && (
            <div style={{ padding: "4px 10px", fontSize: 10, opacity: 0.5, fontStyle: "italic" }}>
              showing first 50 — refine search to narrow
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: "6px 10px", fontSize: 11, opacity: 0.7 }}>
          {isNumQuery
            ? `no tribe match — press Enter to add raw id ${q}`
            : "no matching tribes — try a different search"}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={directory.length ? "search tribes by name, ticker, or id…" : "loading tribes…"}
        value={query}
        onChange={ev => { setQuery(ev.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        style={{ ...inputStyle, width: "100%" }}
      />
      {panel && createPortal(panel, document.body)}
    </div>
  );
}

function TribeChipEditor({
  tribeIds,
  ssuTribeId,
  onChange,
}: {
  tribeIds: number[];
  ssuTribeId?: number;
  onChange: (next: number[]) => void;
}) {
  const names = useTribeNames(tribeIds);
  const myTribeNames = useTribeNames(ssuTribeId !== undefined ? [ssuTribeId] : []);
  const myTribeName = ssuTribeId !== undefined ? myTribeNames.get(ssuTribeId) : undefined;
  // Track whether we've already auto-defaulted so a deliberate user-initiated
  // empty list ("clear all tribes") isn't fought by the effect re-firing.
  const autoDefaultedRef = useRef(false);

  // Auto-pre-populate with the user's current tribe when the list is empty
  // and ssuTribeId becomes available. ssuTribeId is async-resolved from the
  // chain (Character object) so it may be undefined on first render and
  // populate later — depend on it so the effect re-fires once it lands.
  useEffect(() => {
    if (autoDefaultedRef.current) return;
    if (tribeIds.length === 0 && ssuTribeId !== undefined && ssuTribeId > 0) {
      autoDefaultedRef.current = true;
      onChange([ssuTribeId]);
    }
  }, [ssuTribeId, tribeIds, onChange]);
  const removeAt = (i: number) => onChange(tribeIds.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>
        tribes (alliance — any member of any listed tribe is admitted):
      </label>

      {/* Chip strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 22 }}>
        {tribeIds.length === 0 && (
          <span style={{ ...hintStyle, fontStyle: "italic" }}>no tribes — admits nobody</span>
        )}
        {tribeIds.map((id, i) => {
          const name = names.get(id);
          const isMine = ssuTribeId === id;
          return (
            <span
              key={id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: "monospace", fontSize: 11,
                padding: "2px 4px 2px 6px",
                border: `1px solid ${isMine ? "rgba(0,255,150,0.6)" : "rgba(255,71,0,0.4)"}`,
                background: isMine ? "rgba(0,255,150,0.05)" : "rgba(255,71,0,0.05)",
                color: isMine ? "#00ff96" : "#ff8c4a",
              }}
              title={isMine ? "Your tribe" : `tribe_id ${id}`}
            >
              {name ? `${name} (${id})` : `#${id}`}
              {isMine && <span style={{ opacity: 0.7 }}>★</span>}
              <button
                onClick={() => removeAt(i)}
                style={{
                  ...removeButtonStyle,
                  padding: "0 4px", fontSize: 10, marginLeft: 2,
                }}
                title="remove tribe"
              >✕</button>
            </span>
          );
        })}
      </div>

      {/* Searchable dropdown picker (matches QueryPanel UX). Type to filter
          by name, ticker, or numeric id; click a result or press Enter to add. */}
      <TribePicker
        excludeIds={tribeIds}
        ssuTribeId={ssuTribeId}
        onPick={(id) => {
          if (!tribeIds.includes(id)) onChange([...tribeIds, id]);
        }}
      />
      {ssuTribeId !== undefined && ssuTribeId > 0 && !tribeIds.includes(ssuTribeId) && (
        <div>
          <button
            onClick={() => onChange([...tribeIds, ssuTribeId])}
            style={smallButtonStyle}
            title={`Add your tribe (#${ssuTribeId})`}
          >
            + my tribe ({myTribeName ? `${myTribeName} (${ssuTribeId})` : `#${ssuTribeId}`})
          </button>
        </div>
      )}

      {tribeIds.length >= 32 && (
        <div style={{ ...hintStyle, color: "#ffaa55" }}>Soft cap: 32 tribes max (gas).</div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function switchMode(
  kind: AccessMode["kind"],
  current: AccessMode,
  ssuTribeId?: number,
): AccessMode {
  if (kind === "none") return { kind: "none" };
  if (kind === "public") return { kind: "public" };
  if (kind === "tribe_alliance") {
    return {
      kind: "tribe_alliance",
      tribeIds:
        current.kind === "tribe_alliance" ? current.tribeIds
        : current.kind === "hybrid" ? current.tribeIds
        : ssuTribeId !== undefined ? [ssuTribeId]
        : [],
    };
  }
  if (kind === "allowlist") {
    return {
      kind: "allowlist",
      entries:
        current.kind === "allowlist" ? current.entries
        : current.kind === "hybrid" ? current.allow
        : [],
    };
  }
  return {
    kind: "hybrid",
    tribeIds:
      current.kind === "tribe_alliance" ? current.tribeIds
      : current.kind === "hybrid" ? current.tribeIds
      : ssuTribeId !== undefined ? [ssuTribeId]
      : [],
    deny: current.kind === "hybrid" ? current.deny : [],
    allow:
      current.kind === "hybrid" ? current.allow
      : current.kind === "allowlist" ? current.entries
      : [],
  };
}

function short(addr: string): string {
  if (!addr) return "—";
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function fmtExpiry(ms: number): string {
  const delta = ms - Date.now();
  if (delta <= 0) return "expired";
  const h = Math.floor(delta / 3_600_000);
  if (h < 1) return `${Math.floor(delta / 60_000)}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────

const readTextStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: "monospace",
  color: "rgba(200,200,184,0.7)", lineHeight: 1.4,
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: "monospace",
  color: "rgba(107,107,94,0.7)", letterSpacing: "0.05em",
};
const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,71,0,0.2)",
  color: "#c8c8b8", fontFamily: "monospace", fontSize: 11,
  padding: "3px 6px", outline: "none",
};
const hintStyle: React.CSSProperties = { ...readTextStyle, fontStyle: "italic", padding: "2px 4px" };

function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: 9, fontFamily: "monospace", fontWeight: 700,
    letterSpacing: "0.1em", color,
    border: `1px solid ${color}`,
    padding: "1px 5px", borderRadius: 0,
    background: "rgba(0,0,0,0.3)",
  };
}

const editButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,71,0,0.3)",
  color: "#FF4700", fontFamily: "monospace",
  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
  padding: "2px 8px", cursor: "pointer", borderRadius: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  background: "#FF4700", border: "1px solid #FF4700", color: "#000",
  fontFamily: "monospace", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.1em", padding: "4px 10px", cursor: "pointer", borderRadius: 0,
};
const ghostButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(107,107,94,0.4)",
  color: "rgba(200,200,184,0.7)",
  fontFamily: "monospace", fontSize: 10, fontWeight: 600,
  letterSpacing: "0.1em", padding: "4px 10px", cursor: "pointer", borderRadius: 0,
};
const smallButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,71,0,0.25)",
  color: "rgba(255,71,0,0.8)",
  fontFamily: "monospace", fontSize: 9, letterSpacing: "0.08em",
  padding: "2px 6px", cursor: "pointer", borderRadius: 0,
};
const chipButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,71,0,0.35)",
  color: "#ff8c4a",
  fontFamily: "monospace", fontSize: 10,
  padding: "2px 8px", cursor: "pointer", borderRadius: 0,
  letterSpacing: "0.04em",
};
const removeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,107,107,0.3)",
  color: "#ff6b6b", fontFamily: "monospace",
  fontSize: 10, padding: "2px 6px", cursor: "pointer", borderRadius: 0,
};

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(255,71,0,0.15)" : "transparent",
    border: `1px solid ${active ? "#FF4700" : "rgba(255,71,0,0.2)"}`,
    color: active ? "#FF4700" : "rgba(200,200,184,0.6)",
    fontFamily: "monospace", fontSize: 9, fontWeight: 700,
    letterSpacing: "0.1em", padding: "3px 8px", cursor: "pointer", borderRadius: 0,
  };
}
