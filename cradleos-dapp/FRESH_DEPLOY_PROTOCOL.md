# FRESH_DEPLOY_PROTOCOL.md — CradleOS fresh-publish deployment protocol

**Status:** v0.2 (2026-07-27) — post-Fable-audit revision
**Audit history:** v0.1 audited by `FABLE_AUDIT_2026-07-27.md` (fable-deploy-audit
subagent). v0.2 incorporates all CRITICAL/HIGH fixes: C-1 (I2 rewrite), C-2 (S-1
replaces the `cat Published.toml` check), C-3 (build-artifact purge + S-6), C-4
(testable custody procedure), H-1 (B0 commit+tag provenance), H-3 (C6 adopter
migration), H-4 (deploy-both.sh E3 hard gate), M-2 (per-read-class HA model),
M-4/§5 (Phase D expansion), plus static checks S-0..S-7.
**Scope:** Any *fresh publish* (new package lineage) of a CradleOS Move package,
and any world-package rotation (CCP wipe day, world contract upgrade).
**Not for:** in-place `sui client upgrade` on a lineage we still hold the UpgradeCap for.

---

## 0. Why this document exists

Every fresh launch has broken **user-discovery data pathing**. Verified instances:

| Date | Package | Failure | Root cause |
|---|---|---|---|
| 2026-07-19 | `cradleos_casino` v27 | Every hand aborted `CommandArgumentError arg_idx 2 TypeMismatch` | Built against stale world `0x920e577e`; live world was `0x8b8a46ed` |
| 2026-07-27 | `cradleos_ssu_access` v5 | Non-owner SSU config errors; **zero** policies ever created | `init_policy`/`shared_deposit` hard-bound to dead world `0x920e577e` |
| 2026-07-27 | `cradleos_ssu_access` v5 | `promote_ephemeral_to_shared` missing → "DEPOSIT ALL" aborts | Republish silently dropped a v4 function |
| 2026-06-25 | Stillness wipe | 15,212 stale Character rows surfaced in search | `character-index` not purged/rebackfilled |
| 2026-05-07 | dApp | Power user's 64 Assemblies showed 50 | `suix_getOwnedObjects` single-page (50 cap) |

**The invariant that keeps breaking:** a package publishes successfully, CI is green,
the bundle deploys — and *then* users cannot be found, or their objects cannot be
read, because a **type identity** or a **discovery index** still points at a dead lineage.

**Design principle:** publish success is not deploy success. The gate is
*"a real wallet resolves to a live character and gets solid returns on every panel."*

---

## 1. Hard invariants (violating any = stop)

**I1 — Reference-typed Move params hard-link a lineage.**
Any Move function taking `&T` / `&mut T` / `OwnerCap<T>` where `T` is defined in the
world package is **permanently bound to that world lineage at publish time**. It
cannot be fixed by upgrade. Rotation ⇒ fresh publish, always.

**I2 — The unit of lineage-binding is the PACKAGE, not the module.**
Sui links, publishes, and type-identifies at *package* granularity. **Any package
containing ≥1 function with a world reference-typed param is world-bound in its
entirety** — including every "clean" module that happens to live in the same
package. There is NO hand-maintained list of "immune modules" in this document,
because such a list rots: v0.1 of this protocol listed `gate_policy` and
`turret_ext` as lineage-immune, and both in fact take `&Gate`/`&Character`/
`&Turret` params (`gate_policy.move:694,717,738-740`; `gate_control.move:123-124,
140-142`; `turret_ext.move:199-201`; also `bounty_contract.move:210-211`,
`trustless_bounty.move:223-224`, and a stale ssu_access twin at
`cradleos/sources/ssu_access.move:163-164`). Had that list been followed on the
next world rotation, the main `cradleos` package would have been skipped and gate
binding, jump permits, turret targeting, and both bounty claim paths would have
aborted `TypeMismatch` — a repeat of Casino v27.

**The only authority on which packages are world-bound is static check S-2**
(§ "Static checks", below): mechanically inventory world reference-typed params
per package. Run S-2 in Phase A on every rotation; **every package S-2 lists
requires a fresh publish.**

> **Design guideline (kept separate from the binding rule above):** modules keyed
> on `u32` tribe ids / raw `address` are *cheaper to migrate* — their stored state
> and call sites don't reference world types, so they survive a rotation as long
> as their *containing package* is republished. `keeper_seal` deliberately avoids
> importing `world::character::Character` for this reason. When designing new
> modules, avoid world reference params unless functionally required — but never
> conclude from this that a package can skip republish. That conclusion belongs
> to S-2 alone.

**I3 — Dual-ID discipline.**
`published-at` for moveCall targets + type args. `original-id` for event/type
queries. Modules introduced in later upgrades index under the version that
introduced them ⇒ use `fetchEventAcrossPackages` by default.

**I4 — Source of truth for world ids is `lib/tenantConfig.ts`.** Never a literal.

**I5 — Paginate every `suix_*` call.** 50/page cap is enforced server-side
regardless of requested limit. Loop `nextCursor` with a runaway guard.

**I6 — Never republish while users hold items in shared/ethereal SSU inventory.**
The game client does not render shared-inventory items; the dApp is the only
retrieval UI. Republish ⇒ items unreachable. Check inventory occupancy first.

**I7 — UpgradeCap custody is recorded before the tx is considered done.**
Three lineages were *believed* orphaned by lost keys (`0x61f4dab5`, `0xc3c2381f`,
`0x177583b2`). **CORRECTION (2026-08-02): no key was ever lost.** The deploy
wallet `0xc80fe7d6` lived on DGX2 — the actual deploy host — so the DGX1 reformat
never touched it, and the house bankroll was recovered. The real defect was a
negative search on the wrong host being promoted to durable fact; custody
verification must therefore establish *which host performed the deploy* first.
Custody is a **testable procedure**, not a written intention — see §8.

---

## 2. Static checks (mandatory gates)

These are mechanical, exit-code-bearing checks. They are the authority; prose
phases reference them. All commands are runnable from the package dir (e.g.
`frontier/cradleos_ssu_access/`). `LIVE`/dead ids are pulled from tenantConfig,
never typed by hand. **S-1 + S-3 together make the Casino-v27/ssu_access-v5
failure class structurally impossible to ship.**

**S-0. Setup (shared by all checks):**
```bash
TCFG=/home/rawdata/.openclaw-captain/workspace/frontier/cradleos-dapp/src/lib/tenantConfig.ts
LIVE=$(awk '/\[TenantId.STILLNESS\]/,/datahubHost/' "$TCFG" | grep -oE '0x[0-9a-f]{64}' | head -1)
DEAD_IDS="920e577e1bf078bad19385aaa82e7332ef92b4973dcf8534797b129f9814d631
28b497559d180bbf2f0b23b1711407653b1b3a4b0f13cbdc25327af171ff8dbb"   # extend as worlds die
```

**S-1. Dep-pin assertion (closes C-2; catches v27 & v5 at the manifest layer).**
`Move.toml [environments]`, `Move.lock use_environment`, the active `sui client
env`, and `Published.toml` section names form a resolution chain. The v5 publish
declared only `testnet_stillness` in Move.toml yet resolved the `[published.testnet]`
section of the world `Published.toml` — which held the dead world. This check
resolves the env *the toolchain will actually use* (from Move.lock) and asserts
that section's `published-at` equals the live world:
```bash
ENV=$(awk -F'"' '/^\[pinned\./{split($0,a,"."); e=a[2]} /use_environment/{print $2; exit}' Move.lock)
WPUB=$(awk -v env="[published.$ENV]" '$0==env{f=1} f&&/^published-at/{gsub(/"/,"",$3); print $3; exit}' \
      ../world-contracts/contracts/world/Published.toml)
[ "$WPUB" = "$LIVE" ] || { echo "FATAL: world dep for env '$ENV' = $WPUB != live $LIVE"; exit 1; }
```
On 2026-07-18 this exits 1 for both casino v27 and ssu_access v5
(`[published.testnet]` held `0x920e577e`). One env name per package; if `ENV`
resolves to something other than the env declared in Move.toml `[environments]`,
treat that as a failure too — fix the pin before proceeding.

**S-2. World-ref inventory (the authority behind I2; mechanical I1/I2 classification):**
```bash
for pkg in cradleos cradleos_casino cradleos_ssu_access cradleos_voting; do
  W=$(awk '/use world::/{f=1} f{printf "%s ", $0; if (/;/){f=0; print ""}}' \
      ../$pkg/sources/*.move 2>/dev/null \
      | grep -oE '\b[A-Z][A-Za-z]+' | grep -v '^Self$' | sort -u)
  for t in $W; do
    grep -HnE "&(mut )?$t\b|OwnerCap<$t>" ../$pkg/sources/*.move
  done | sed "s/^/[WORLD-BOUND $pkg] /"
done
```
> **Fixed 2026-07-27 vs the audit's original:** the audit version grepped only the
> first line of `use world::…`, missing **multi-line brace imports** (e.g.
> `cradleos_ssu_access/sources/ssu_access.move:50` spreads `use world::{ … }`
> across 6 lines) — which silently exempted the exact package being republished.
> The awk joiner slurps each `use world::` statement to its `;`. Also `-H` so
> single-file packages still print filenames, and `Self` is excluded.

Non-empty output for a package ⇒ that package is lineage-bound and MUST be
fresh-published on rotation. Today this correctly flags `cradleos` (gate_policy
:694-740, gate_control:123-142, turret_ext:199-201, bounty_contract:210-211,
trustless_bounty:223-224, ssu_access:163+), `cradleos_casino` (every game's
`&Character` gate), and `cradleos_ssu_access` (verified: 28+ hits incl.
`&StorageUnit`/`OwnerCap<StorageUnit>`/`&Character`).

**S-3. Post-build bytecode address assertion (the decisive gate; VERIFIED against the real v5 artifact):**
```bash
rm -rf build && sui move build 2>/dev/null || exit 1
MV=build/*/bytecode_modules/*.mv
HEX=$(cat $MV | xxd -p | tr -d '\n')
echo "$HEX" | grep -q "${LIVE#0x}" \
  || { echo "FATAL: compiled bytecode does not reference live world $LIVE"; exit 1; }
for d in $DEAD_IDS; do
  echo "$HEX" | grep -q "$d" && { echo "FATAL: dead world 0x$d baked into bytecode"; exit 1; }
done
echo OK
```
Evidence it works: run against the stale 2026-07-18 v5 build dir it reports
1 hit of `920e577e…` and 0 hits of `8b8a46ed…`.
Run this after `sui move build` and again on the *exact* artifacts `sui client
publish` reports (digest match), then publish. This single check makes the
v27/v5 class structurally impossible to ship.

**S-4. Full-signature ABI parity (replaces the v0.1 name-only A3/A4 grep):**
```bash
RPC=http://127.0.0.1:9000   # DGX2 local node — event/object reads are complete
abi() { curl -s --max-time 10 "$RPC" -H 'Content-Type: application/json' -d "{
  \"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"sui_getNormalizedMoveModule\",
  \"params\":[\"$1\",\"$2\"]}" \
  | jq -S '.result.exposedFunctions | to_entries
           | map({name:.key, params:.value.parameters, ret:.value.return, ta:.value.typeParameters})'; }
abi 0xeb814b97c4789a0acdac143618d811b7fc3477259f4f1599ddaa9e07808919e1 ssu_access > /tmp/abi-old.json
# … after publish:
abi <NEW_PKG> ssu_access > /tmp/abi-new.json
diff /tmp/abi-old.json /tmp/abi-new.json   # every hunk must be an *intended* restore/addition
```
Store both files as the ABI manifest (`deploy/abi-<pkg>-<date>.json`). This
catches drops (`promote_ephemeral_to_shared` absent = a deletion hunk) **and**
signature drift, which a name grep cannot. A name grep would pass a republish
that keeps a function's name but changes its arity/types — breaking every
caller (e.g. `src/lib/ssuAccess.ts:1093-1104` passes exactly 7 args + Clock).

**S-5. devInspect type-identity smoke (post-publish, pre-cutover; no gas, no signature):**
```js
// scripts/devinspect-smoke.mjs  (node, @mysten/sui) — run BEFORE editing constants.ts
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
const c = new SuiClient({ url: "https://keeper.reapers.shop/sui?nocache=1" });
const PKG = process.argv[2], SSU = "<live StorageUnit id>", CHAR = "<Raw live Character id>";
const tx = new Transaction();
tx.moveCall({ target: `${PKG}::ssu_access::init_policy`,
  arguments: [tx.object("<new registry id>"), tx.object(SSU), tx.object("<Raw OwnerCap<StorageUnit>>")] });
const r = await c.devInspectTransactionBlock({ sender: "<Raw wallet>", transactionBlock: tx });
const err = r.effects.status.error ?? "";
if (/TypeMismatch|CommandArgumentError|FunctionNotFound/.test(err)) {
  console.error("FATAL type-identity/ABI failure:", err); process.exit(1);
}
console.log("OK (status:", r.effects.status.status, err, ")");
```
Repeat for `shared_deposit`, `shared_withdraw_to_owned`,
`promote_ephemeral_to_shared` (expected outcomes: success or a *module abort
code* like EAccessDenied/ENotAuthorized — both prove the world types bind).
Against v5 this fails instantly with `CommandArgumentError … TypeMismatch`;
against a re-dropped promote it fails with `FunctionNotFound`. `FunctionNotFound`
is the signature of a silent re-drop; it is in the assert list explicitly.

**S-6. Repo-wide dead-id sweep (extends the old DEPLOY.md step 2 beyond src/ and beyond two ancient ids):**
```bash
cd frontier/cradleos-dapp
for d in $DEAD_IDS 61f4dab5 c3c2381f 874f10e0; do
  grep -rln "$d" src/ public/ scripts/ --exclude-dir=node_modules \
    | grep -vE '\.(md)$' | grep -v tenantConfig
done
# Expected: empty, or hits ONLY inside comments explicitly marked ARCHIVED/RETIRED.
# Today this flags src/upgrade-bytecode.json (binary payload — not a comment). Delete it.
```
Dead ids don't only leak back through source rebases — they leak through
**derived artifacts**: `build/` dirs, `upgrade-bytecode.json`, Move.lock env
pins, `Published.toml` backups. S-6 covers artifacts; S-3 covers bytecode.

**S-7. Shared-object wiring assertion (makes Phase C C1/C2 mechanical):**
```bash
curl -s "$RPC" -H 'Content-Type: application/json' -d '{
 "jsonrpc":"2.0","id":1,"method":"sui_getObject",
 "params":["<SSU_POLICY_REGISTRY>",{"showType":true,"showContent":true}]}' \
| jq -e --arg pkg "<NEW_PKG>" '
   (.result.data.type | startswith($pkg)) and
   (.result.data.content.fields.policies.fields.size != null)'
```
Asserts the registry constant points at an object *typed under the new
package* (catches registry/pkg cross-wiring) and exposes the Table size for
the Phase C record + the §7.E6 zero-adoption canary baseline.

---

## 3. Phase A — Pre-publish gate

**A1. Confirm live world id.**
```bash
grep -A3 'TenantId.STILLNESS' src/lib/tenantConfig.ts   # canonical
```
Verify against chain — the world package object must exist and be `Immutable`.

**A2. Run S-1 (env-resolved dep-pin assertion).**
Must print nothing and exit 0 — the world dep for the env *actually pinned in
Move.lock* must equal the live world id. Do NOT substitute a `cat Published.toml`
eyeball: `Published.toml` contains multiple env sections with different ids, and
an operator can read the correct section while the toolchain resolves a
different one (this is the exact v5/v27 mechanism).

**A2b. Run S-2 (world-ref inventory).**
Every package listed in S-2 output is world-bound in its entirety and requires
a fresh publish on rotation (I2). On a world rotation, this output IS the
republish worklist — no memory, no hand list. Store the output as
`deploy/world-bound-<date>.txt` and diff against the previous run; new entries
mean a package acquired a world binding since last deploy.

**A3. Identify the authoritative source tree + run S-4 (pre side).**
Multiple copies of a module may exist (e.g. `cradleos/sources/ssu_access.move`
had `set_tribe_only`; standalone `cradleos_ssu_access/` had `set_tribe_alliance`
matching live). Capture the live package's normalized ABI now
(`abi <live-pkg> <module> > /tmp/abi-old.json` per S-4). Then compare against the
candidate source: any function present live but absent in source = **regression
risk**. Any present in source but absent live = intentional restore (document it).
For load-bearing cross-package calls, also assert the pinned world dep source
still declares the expected shape (e.g. `withdraw_by_owner<T: key>` 6-param at
`world-contracts/.../storage_unit.move:448-455` for ssu_access promote).

**A4. ABI-parity manifest.**
Store the S-4 pre-publish JSON as `deploy/abi-<pkg>-<date>.json`. This is the
artifact that catches silent drops like `promote_ephemeral_to_shared` —
full signatures, not just names.

**A4b. Run S-6 (repo-wide dead-id sweep).** Expected empty (or ARCHIVED-marked
comments only). Any artifact hit (JSON payloads, build dirs) must be deleted or
regenerated before proceeding.

**A5. Player-state audit.** Enumerate non-Raw senders for affected modules via
`suix_queryEvents`. If any exist, present inventory to Raw and **stop** (I6).
Even when the result is trivially zero (e.g. a registry with table size 0),
record that evidence explicitly in the daily log — do not waive the step
silently.

**A6. Publish wallet custody — run the §8 pre-publish procedure.**
Not "a plan is written" — the §8 acceptance tests must PASS: signing proof from
backup material, ≥2 off-host backups, custody destination for the new
UpgradeCap written down before the publish tx is signed.

---

## 4. Phase B — Publish

**B0. Commit + tag the exact sources before publish (provenance anchor).**
```bash
git add <the exact .move sources being published>   # never git add -A
git commit -m "<pkg>: <what changed> (pre-publish snapshot)"
git tag publish/<pkg>-<YYYY-MM-DD>
```
Generate the A4 ABI manifest from this commit, not from a dirty tree. The v5
silent function drop was undiagnosable for a week because nobody could diff
"what was published" against "what was in git." The commit hash is recorded
alongside the pkg id in B3.

**B1.** RPC preflight: the endpoint must answer `sui_getChainIdentifier` = `4c78adac`.
`fullnode.testnet.sui.io` JSON-RPC is **dead** (404 since 2026-07-08). BlockVision
rate-limits (429) — prefer local fullnode or `rpc-testnet.suiscan.xyz`.

**B2. Purge stale artifacts, build clean, run S-3, publish.**
```bash
rm -rf build/          # MANDATORY before every publish build — stale build/
                       # dirs have contained dead-world bytecode (2026-07-18)
sui move build
# → run S-3 (bytecode address assertion) — must print OK
sui client publish --gas-budget 500000000
```
Capture: pkg id, UpgradeCap id, tx digest, publisher address. If any artifact
is reused between build and publish (`--dump-bytecode-as-base64` workflows),
re-run S-3 against the exact artifacts being published.

**B3.** **Immediately** record all of: pkg id, UpgradeCap id, tx digest,
publisher address, **and the B0 commit hash + tag** in `constants.ts` comments +
TOOLS.md. Not "after testing". The orphan pattern happens in this gap. While in
`constants.ts`, also move any comments describing dead lineages to the ARCHIVED
section — stale narrative comments in the wiring block are how the wrong id gets
"confirmed" during a 2 a.m. cutover.

**B4. Post-publish gates: S-4 (post side) + S-5 + S-7 — BEFORE constants cutover.**
- S-4: `abi <NEW_PKG> <module> > /tmp/abi-new.json; diff` vs the A4 manifest.
  Zero unexplained deltas; every hunk must be an intended restore/addition.
- S-5: devInspect each entry fn against live object ids. Any
  `TypeMismatch` / `CommandArgumentError` / `FunctionNotFound` = the publish is
  bad; do NOT cut constants over, do NOT announce.
- S-7: registry/shared-object wiring assertion; record the Table size as the
  zero-adoption canary baseline (§7 E6).
Pre-write these three gates *before* publishing so they run in the minutes
after publish, not the days after.

**B5. Post-publish custody transfer — run the §8 post-publish procedure.**
Transfer the new UpgradeCap (and admin-cap-class objects) to the custody
address in the same session as B3.

---

## 5. Phase C — Data-path rewiring (where launches actually break)

Fresh package id ⇒ every discovery surface must be re-pointed and re-verified.

**C1. Constants.** `*_PKG`, `*_ORIGINAL`, `*_REGISTRY`. Confirm registry object's
`type` field names the **new** package — mechanically, via S-7.

**C2. Shared-object bootstrap.** Registries auto-created at publish must be
located and their `Table` sizes confirmed (a size-0 table on a supposedly
migrated feature = nothing works — this is how ssu_access was caught). S-7
outputs the size; record it.

**C3. Character/user discovery — THE recurring break.**
- Wallet→Character resolution must go through the canonical resolver
  (`findLatestCharacterForWallet`: paginate PlayerProfile across world pkgs,
  deref, sort by object `version` desc, take `[0]`). Newest = live; older =
  destroyed identities that must NOT be surfaced.
- `character-index` must be **purged and re-backfilled** on world rotation
  (15,212 stale rows in the 2026-06-25 wipe). Exact commands (DGX2):
  ```bash
  # 1. update TENANTS pkg ids in ~/character-index/indexer.js (same drift rule
  #    applies to cradleos-dapp/src/lib/tenantConfig.ts — keep them in sync)
  # 2. purge + re-backfill:
  cd ~/character-index && node indexer.js --backfill --stillness
  # 3. parity spot-check: index resolver result == RPC PlayerProfile-scan
  #    result for 3 known wallets (live-only, rerolled, zero-state)
  ```
  The dApp's wallet→character resolver is **index-first** (`src/lib.ts:939-945`),
  so a stale index doesn't just pollute search — it feeds the canonical identity
  path. After a rotation with un-updated `TENANTS` the index will confidently
  serve dead-lineage characters (its `stale:true` flag only helps when the index
  *knows* it's stale).
- Owned-objects index must filter `OwnerCap` by **inner generic**.

**C4. HA standard for reads — PER READ CLASS, not a single global ordering.**
There is no single "L1 authoritative" layer. The correct ordering depends on the
read class, because the DGX2 local fullnode's account-state indexes are
**incomplete** while its event/object-by-id reads are complete:

| Read class | Order | Notes |
|---|---|---|
| Events / `getObject` / `multiGetObjects` / dynamic fields | **local fullnode → proxy rotation** | Local event queries are complete; ground truth, no rate limit |
| Owned-object enumeration (`suix_getOwnedObjects`) | **index service FIRST → public/proxy RPC → local fullnode LAST OR NEVER** | Local owned-objects index known-incomplete since 2026-07-08 audit; benched from sui-proxy rotation until reindex + parity verification |
| Wallet→character resolution | **index (`/resolve-character`) → RPC PlayerProfile scan via proxy** | NEVER local-node `suix_getOwnedObjects` |

**⚠ The defect class is "account-state reads", broader than owned-objects.**
Verified 2026-07-27: the DGX2 local fullnode also returns **false empty** results
for `suix_getAllBalances`. Proof: house wallet
`0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a` returns `[]`
on the local node (127.0.0.1:9000) but **6676203928 MIST (~6.68 SUI)** via
`https://rpc-testnet.suiscan.xyz:443`, at effectively the same checkpoint
(364939796 vs 364939797). Assume any `suix_*` account-state read
(`getOwnedObjects`, `getAllBalances`, `getBalance`, `getAllCoins`, …) on the
local node may be silently incomplete.

**False-NEGATIVE reads are the dangerous failure mode:** they don't error — they
render as "user has nothing" (no balance, no objects, no character), which the UI
happily displays as a valid empty state. Any account-state read served from the
local node MUST be cross-checked against a public/proxy RPC before being
believed, until the node is reindexed and parity-verified.

Layer inventory (unchanged): local fullnode `127.0.0.1:9000` (health-gate before
any sweep; if unhealthy, skip the sweep — do not serialize hanging calls);
`character-index` :8004 / `/index/*` via Cloudflare (sub-50ms substring search;
must transparently fall back to on-chain walk on non-2xx); public RPC rotation
via caching proxy (coalescing, TTL, circuit breaker). Every layer needs an
explicit fallback; no single point of failure.

**Open verification item (from audit M-2):** document what feeds the
owned-objects index service (`OWNED_INDEX_BASE`). If it is fed from the local
node's incomplete `suix_getOwnedObjects`, the index layer is poisoned by the
same defect and needs its own parity gate before being trusted.

**C5. Cross-package event queries.** Use `fetchEventAcrossPackages` (dedup by
`(txDigest, eventSeq)`, newest-first).

**C6. Adopter migration (extension packages — mandatory on every fresh publish).**
A fresh publish of an extension package (ssu_access-class) mints a new auth
witness type and a new, **empty** registry. Every object that participated under
the old lineage must re-authorize and re-init (for ssu_access: re-run
`world::storage_unit::authorize_extension<newPkg::SsuAuth>` + `init_policy` +
re-set mode — the dApp does this in one PTB, `SharedAccessSection.tsx:243-258`).
Protocol steps:
1. **Enumerate old-lineage adopters:** event scan on the old original-id
   (init/policy events). Record the list.
2. **Publish a migration notice** to adopters (Discord/in-dApp) — "your old
   policy is gone; re-enable sharing."
3. **Verify the re-enable UX path** on at least one real pre-existing world
   object that had the old extension authorized — stale old-lineage extension
   authorizations are harmless on-chain but must not confuse the new flow.
4. The same class applies to `gate_policy` re-binding (`bind_gate`) after a
   main-package fresh publish — enumerate bound gates and notify.
If the old registry's table size is 0 (zero adopters), record that evidence and
mark C6 trivially satisfied — do not skip it silently.

**C7. Degraded-read disambiguation ("couldn't read" must not collapse to "empty").**
Several read helpers map RPC failure to an empty/none result
(`loadPolicyForSsu` → `{kind:"none"}`, `resolvePolicyId` → null,
`indexFirst` → null). During rewiring QA, every "empty" result on a
freshly-cut-over feature is ambiguous: genuinely empty vs. read failure vs.
querying a dead lineage. Rule: before accepting any zero/empty result as PASS
evidence in Phase C or D, confirm the read path succeeded (HTTP 200 + well-formed
response) via a second source or explicit logging. New read helpers should
distinguish `{empty}` from `{error}` in their return type rather than collapsing.

---

## 6. Phase D — Per-panel QA (mandatory, every panel, every deploy)

**Gate: a panel is not "done" because it renders. It must return real data for a
real wallet.**

**Coverage rule:** `src/components/` contains ~35 real panels; the matrix below
names the core rows. For **every panel not in the matrix** (Dashboard, Intel/
Killboard, Industry, Registry/attestor, Treasury, TribeDex, Recruiting, SRP,
CargoContract, Inheritance, EventCalendar, GateProfile, AssetLedger,
TribeHierarchy/Leaderboard, …) the deploy record MUST contain an explicit
**"out of scope this deploy"** line naming the panel — silence is a decision,
not an omission. Note: Dashboard is the identity/boot path where resolver bugs
actually surface; treat "out of scope" for it with suspicion on any deploy that
touches character resolution.

For **each** in-scope panel, record PASS/FAIL + evidence:

| Panel | Must verify |
|---|---|
| Structures | Owned structures enumerate; count matches chain; all 5 kinds (NetworkNode/Gate/Assembly/Turret/StorageUnit) |
| Inventory / SSU | Owned + shared SSUs discovered; operator names resolve (not hex); non-owner deposit/withdraw; **DEPOSIT ALL**; policy create *and* update; re-enable over a pre-existing world SSU that had the OLD extension authorized (C6) |
| Casino | Bet places, hand resolves, payout credited; house bankroll reads; wallet with **no live Character** shows a clean "create a character" message (not an abort toast); **destroyed-then-rerolled** character wallet resolves to the LIVE character (resolver's hardest case, `src/lib.ts:774-786`) |
| Tribe / Vault | Tribe resolves; vault balances; deposit/withdraw |
| Gate / Defense / Turret | Policy create + delegate; friendly/hostile by `character_id` |
| Voting | Election create; ballot cast |
| Query / Search | Character search returns; index path + fallback both exercised. Note: `discoverSharedSsus` deliberately includes a whole batch on type-filter RPC failure — "stale SSUs shown" is an expected degraded mode, not a regression |
| Keeper / Lore | RAG answers; citations resolve |
| Map / Route | Systems resolve; route computes |

**Negative-path rows (mandatory for the feature being shipped — these are the
aborts ssu_access promote will actually produce):**

| Case | Expected behavior |
|---|---|
| Offline SSU (`ENotOnline`, `storage_unit.move:454`) | Human-readable error via `lib/txError`, not a raw abort code |
| DEPOSIT ALL with empty per-char partition | Raw dynamic-field abort must be translated to something human; UI must not soft-fail |
| Expired allowlist entry | Access denied, message names expiry |
| Deny-listed character under hybrid mode | Access denied |
| MODE_PUBLIC deposit + withdraw by a tribeless character | Succeeds |
| Owner revokes extension, then non-owner attempts withdraw | `EExtensionNotAuthorized` surfaced sanely |
| Policy exists + RPC degraded | UI must NOT display re-init as if virgin — a "no policy" reading can be a false negative (`loadPolicyForSsu` collapses RPC failure to `{kind:"none"}`; on-chain `EPolicyAlreadyExists` protects state, but the operator must know) |

**Environment axis (mandatory):** every PASS names the environment it ran in.
The **Inventory/SSU and Casino rows must each PASS twice**: once in desktop
Chrome AND once in the EVE Vault / Stillness embedded webview. Desktop-only QA
has shipped webview breakage repeatedly (dialogs, selects, emoji).

**Degraded-read rows (per §5 C7):** for Inventory and Query, one PASS must be
recorded with the index deliberately unreachable (fallback path exercised).

**QA rules:**
- **Two wallets minimum**: owner + non-owner. Owner-only testing is how the
  non-owner SSU path shipped broken.
- **A power-user wallet** (>50 owned objects) to catch pagination truncation.
- **Zero-state wallet** must degrade gracefully, not error — and per C7, "empty"
  must be verified as *genuinely* empty, not a failed read rendered as empty.
- **Webview constraint audits** (EVE Vault Mobile / Stillness embedded Chrome) —
  ALL THREE, per TOOLS.md "Webview Dialog + Native Overlay Ban":
  ```bash
  # 1. dialog ban:
  grep -rE 'window\.(prompt|confirm|alert)' src/                 # must be empty
  # 2. native <select> ban (popouts render off-panel + insta-dismiss in webview):
  grep -rn '<select' src/ --include='*.tsx'                      # every hit must use the
  #    portal-mount pattern (OperatorFilterDropdown reference) or be justified
  # 3. color-emoji ban (renders as empty boxes in webview):
  grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}][\x{FE0F}]?' src/ --include='*.tsx' # new
  #    icons must be monospace-safe Unicode (◉ ⚔ ✦ …), no emoji
  ```
- **Evidence required**: tx digest, object id, or screenshot per PASS.
  "It loaded" is not evidence (SOUL: verify before claiming).

**Automatable subset (wire into deploy-both.sh as a gate over time):** the
type-identity class is ~100% automatable with zero wallets/gas/UI via
devInspect (S-5), plus: resolver fixture asserts (3 wallets: live-only,
rerolled, zero-state — via index path AND with the index stubbed to fail),
pagination parity for the power-user fixture, registry asserts (S-7), repo
greps (S-6), and one index-search + forced-fallback parity check. Rendering,
signing UX, and in-game visibility remain manual by nature.

---

## 7. Phase E — Ship + post-deploy verification

**E1.** IOC gate: `scripts/scan-npm-iocs.sh` (hard block on non-zero).
**E2.** `./deploy-both.sh` — **both** targets (CF Pages primary + gh-pages mirror).
Never one target; drift shipped stale house numbers twice (2026-07-07, 2026-07-18).
**E3.** Live bundle hash matches the just-built bundle, on **both** origins.
This is a **hard gate inside deploy-both.sh** (retries up to ~3 min per origin,
then exits non-zero on mismatch — hardened 2026-07-27 per audit H-4). A drift
identical to 2026-07-07/2026-07-18 now fails the script instead of logging a
warning.
**E4.** Re-run the Phase D matrix against **production URLs**, not dev.
**E5.** Record in `memory/YYYY-MM-DD.md`: pkg id, UpgradeCap, digest, publisher,
**B0 commit hash + tag**, QA matrix result, known-broken list.
**E6. Zero-adoption canary (post-deploy silence detection).**
ssu_access v5 sat broken with 0 policies / 0 events until a user hit it. For any
freshly launched feature, record the registry table size (S-7) and event count
at launch, then **alert if either is still 0 after N days** (N=3 default).
Implementation: ~10-line addition to the character-index poller (DGX2), which
already watches events. A feature at zero adoption after N days is either
broken or undiscoverable — both are failures worth waking up for.

---

## 8. UpgradeCap + publish-wallet custody (testable procedure)

Three lineages were *believed* orphaned (`0x61f4dab5`, `0xc3c2381f`, `0x177583b2`
— the last also holding the ssu_access v5 cap, the casino v28 cap, and the live
casino house bankroll). **CORRECTION (2026-08-02): the key was never lost.** The
"exhaustive confirmation" of unrecoverability searched DGX1 while the deploy had
actually been made from DGX2. A custody *plan* you cannot test is still the right
demand — but note the failure mode that actually occurred was a false-negative key
search, so §8.1's signing proof must be attempted on every candidate host before
any key is declared lost. This section is acceptance-tested, not aspirational.

### 8.1 Pre-publish (blocks Phase B) — **REQUIRES OPERATOR (Raw)** for key handling

1. **Signing proof FROM BACKUP MATERIAL.** Immediately before publish, the
   publish wallet must sign a 0-value self-transaction (or `sui keytool sign` a
   digest) *using the key material restored from its backup location* — not the
   live keystore. If the backup cannot produce a valid signature, **stop: the
   publish is blocked.** Record the proof digest in the daily log.
2. **≥2 off-host backups.** The key must exist on at least two physical hosts /
   media, neither of which is the publish host alone (the DGX1 reformat
   destroyed `0xc80fe7d6`; a single-host backup is not a backup). Verify both
   locations exist and are readable. **REQUIRES OPERATOR (Raw):** confirming
   physical backup locations is a human action; the agent records the
   attestation, it does not invent it.
3. **Custody destination written BEFORE publish.** The address that will hold
   the new UpgradeCap (ideally a 2-of-3 multisig built with
   `sui keytool multi-sig-address` — must be arranged *before* publish; the
   `0x177583b2` post-mortem confirmed plain-ed25519 leaves no recovery path)
   is recorded in the daily log before the publish tx is signed.

### 8.2 Post-publish (same session as B3)

4. **Transfer the new UpgradeCap + admin-cap-class objects** (HouseAdminCap
   etc.) to the custody address. Record cap id + custody address + tx digest in
   `constants.ts`, TOOLS.md, and the daily log **before Phase C starts**.
5. **Deliberate immutability for fresh-publish-on-change lineages.** If no
   upgrade path is ever intended for a lineage (ssu_access/casino pattern —
   world rotation forces a fresh publish anyway), consider
   `sui client call --function make_immutable` on the package. An orphaned cap
   and an immutable package are operationally identical, but immutability is
   *chosen and documented* rather than an accident. **REQUIRES OPERATOR (Raw):**
   immutability is irreversible; explicit sign-off required.

### 8.3 Acceptance test (what "custody done" means)

- [ ] Signing proof digest from backup material recorded (8.1.1)
- [ ] Two backup locations attested by operator (8.1.2)
- [ ] Custody address recorded pre-publish (8.1.3)
- [ ] Cap transfer digest recorded, or make_immutable digest + sign-off (8.2)

---

## 9. Rollback

- Keep prior pkg id in constants (commented, marked ARCHIVED) for one cycle.
- Frontend rollback = redeploy previous bundle hash (fast).
- **Move rollback is impossible** — a bad fresh publish is only fixed by another
  fresh publish. Hence Phase A + the S-checks are the real gate.

---

## 10. Resolved audit items (was §8 "Open items")

The five open items in v0.1 §8 were answered by FABLE_AUDIT_2026-07-27.md §2 and
folded into this document: (1) HA ordering → per-read-class table in §5 C4;
(2) Phase D automation → automatable subset in §6 + S-5; (3) static I1 check →
S-1/S-2/S-3; (4) custody → §8; (5) promote ABI regression → S-4/S-5 + the A3
world-dep signature assert.
