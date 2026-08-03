# FABLE AUDIT — FRESH_DEPLOY_PROTOCOL.md (2026-07-27)

**Auditor:** fable-deploy-audit subagent (anthropic/claude-fable-5)
**Scope:** FRESH_DEPLOY_PROTOCOL.md DRAFT v0.1, adjacent deploy tooling, and the
code paths it claims to protect, ahead of the imminent `cradleos_ssu_access`
fresh publish.
**Method:** read-only source/artifact inspection. No chain writes, no git writes.
Every claim cites file:line or a command I actually ran. Items I could not
verify locally are marked **UNVERIFIED**.

---

## 1. SEVERITY-RANKED FINDINGS

### CRITICAL

#### C-1. Invariant I2 mislabels world-bound modules as "lineage-immune" — the protocol itself would cause the next Casino-v27-class outage

Protocol §1 I2 lists `gate_policy` and (by the ground-truth phrasing it inherits)
`turret_ext` as modules that "survive world rotations untouched" because they
"key on u32 tribe ids / raw address." **Source contradicts this:**

- `cradleos/sources/gate_policy.move:694,717,738-740` — `bind_gate`/`unbind_gate`/
  `request_jump_permit_entry` take `&Gate`, `&Character` (and OwnerCap proof),
  added in v3 2026-07-08 (`constants.ts:68-73`).
- `cradleos/sources/gate_control.move:123-124,140-142` — `&mut Gate`,
  `&OwnerCap<Gate>`, `&Gate` params.
- `cradleos/sources/turret_ext.move:199-201` — `&Turret`, `&Character` params.
- `cradleos/sources/bounty_contract.move:210-211` and
  `cradleos/sources/trustless_bounty.move:223-224` — `&Killmail`, `&Character`.
- `cradleos/sources/ssu_access.move:163-164` — a **stale v1-era twin** of
  ssu_access (with `set_tribe_only`, no promote) still lives inside the main
  package sources and takes `&StorageUnit`/`&OwnerCap<StorageUnit>`.

These modules **work today** only because the v15/v16 lineage happened to be
built while the world dep pointed at the live `0x8b8a46ed` — i.e. the on-chain
observation ("clean") is correct, but the protocol's stated *reason* ("they key
on u32, not world reference types") is false for gate_policy/turret_ext/
gate_control/bounties. The distinction is not academic: **on the next world
rotation, I2 as written tells the operator the main cradleos package does not
need a fresh publish. It does.** Gate binding, jump permits, turret targeting,
and both bounty claim paths would all abort `TypeMismatch` exactly like Casino
v27.

**Fix:** Rewrite I2 to say *the unit of lineage-binding is the package, not the
module*. Any package containing ≥1 function with a world reference-typed param
is world-bound in its entirety. Replace the hand-maintained module list with the
mechanical inventory in §4 check S-2 below, and add to Phase A: "run S-2; every
listed package requires fresh publish on rotation."

#### C-2. Phase A2 as written can pass while the build resolves a different Published.toml section — the exact v5/v27 mechanism is still open

`world-contracts/contracts/world/Published.toml` contains **four** env sections
(`published.testnet`, `published.testnet_internal`, `published.testnet_stillness`,
`published.testnet_utopia`) with **different** ids (`testnet_internal` still
points at `0x353988e0/0xe148a2...`; `testnet_utopia` at the dead Utopia pair).
Protocol A2 says only:

> `cat ../world-contracts/contracts/world/Published.toml   # published-at MUST == live world`

An operator eyeballing the `testnet_stillness` section (correct) can pass A2
while the toolchain resolves a *different* section. Evidence that this is the
real resolution path: `cradleos_ssu_access/Move.toml` declares only
`[environments] testnet_stillness`, yet the regenerated
`cradleos_ssu_access/Move.lock` pins `use_environment = "testnet"` for the
`world` dep (`[pinned.testnet.world]`), and the v5 publish record landed under
`[published.testnet]` in `cradleos_ssu_access/Published.toml` — not
`testnet_stillness` (the pre-v5 backup `Published.toml.bak-20260718-164647`
used `testnet_stillness`). On 2026-07-18 the `[published.testnet]` world section
held the dead `0x920e577e` (per the 2026-07-19 correction comment in the file),
which is precisely what v5 baked.

**Fix:** A2 must be env-aware and mechanical, not a `cat`. Concrete check S-1
below (resolve the env from the consumer's Move.lock, extract that section's
`published-at`, compare to tenantConfig). And the *authoritative* gate is the
post-build **bytecode assertion** S-3, which I verified works (see below).

#### C-3. Stale dead-world build artifacts are sitting in the publish path right now

- `cradleos_ssu_access/build/cradleos_ssu_access/bytecode_modules/ssu_access.mv`
  (built 2026-07-18 16:47) **contains the dead world address and not the live
  one, and predates the promote restore.** Verified:
  ```
  $ xxd -p build/.../ssu_access.mv | tr -d '\n' | grep -oc 8b8a46ed…c1aa1   → 0
  $ xxd -p build/.../ssu_access.mv | tr -d '\n' | grep -oc 920e577e…d631   → 1
  ```
- `cradleos-dapp/src/upgrade-bytecode.json` — a prebuilt upgrade payload whose
  `"dependencies"` array includes `0x920e577e…` and whose embedded module
  bytecode contains the dead world address (visible in the base64 address
  tables). It is imported and **bundled into the shipped dApp** by
  `src/components/UpgradePanel.tsx:15`.

`sui client publish` rebuilds, so the stale `build/` dir is "only" a hazard for
any `--dump-bytecode-as-base64` / artifact-reuse workflow — but that is exactly
the workflow UpgradePanel encodes. The protocol has no "purge stale artifacts"
step.

**Fix:** Add to Phase B: `rm -rf build/` before every publish build; delete
`src/upgrade-bytecode.json` + `UpgradePanel.tsx` (see H-2); add S-6
(repo-wide dead-id grep) to Phase A.

#### C-4. UpgradeCap custody (I7/A6) has no verifiable procedure — and the imminent publish is about to mint orphan #4 unless gated

Three lineages were *believed* orphaned (`0x61f4dab5`, `0xc3c2381f`, `0x177583b2`
— the last also holding the ssu_access v5 cap, the casino v28 cap, and the live
casino house bankroll). **CORRECTION (2026-08-02): the key was never lost.** The
"exhaustive confirmation" of unrecoverability searched DGX1, but the deploy had
been made from DGX2, where the key still lives. A6 still needs an acceptance test
— but the failure mode that actually occurred was a false-negative key search, so
the test must attempt signing on every candidate host before declaring loss.

**Fix (blocking for the imminent publish):**
1. **Pre-publish signing proof:** the publish wallet must sign a 0-value
   self-transaction (or `sui keytool sign` a digest) *from the recovered key
   material at its backup location*, not from the live keystore, immediately
   before publish. If the backup can't sign, stop.
2. **Off-host backup:** key material must exist on ≥2 physical hosts (DGX1
   reformat destroyed `0xc80fe7d6`; a single-host backup is not a backup).
3. **Post-publish custody transfer:** transfer the new UpgradeCap +
   HouseAdminCap-class objects to a dedicated custody address (ideally a
   2-of-3 multisig built with `sui keytool multi-sig-address`) in the same
   session as B3. Record cap id + custody address + tx digest in constants,
   TOOLS.md, and the daily log before Phase C starts.
4. If no upgrade path is ever intended for a lineage (fresh-publish-on-change
   pattern, which is what ssu_access/casino actually do), consider
   `sui client call --function make_immutable` on the package —
   an orphaned cap and an immutable package are operationally identical, but
   immutability is *chosen* and documented rather than an accident.

### HIGH

#### H-1. A3/A4 ABI parity is name-only — it cannot catch signature drift, and the promote restore it exists to protect is currently an uncommitted working-tree edit

- The A3 grep (`grep -oE 'public (entry )?fun [a-z_0-9]+'`) compares **names**.
  A republish that keeps `promote_ephemeral_to_shared` but changes its arity/
  types (e.g. drops the `character_cap` param, or the world dep's
  `withdraw_by_owner<T>` signature shifts — currently confirmed at
  `world-contracts/contracts/world/sources/assemblies/storage_unit.move:448`)
  passes A3/A4 and breaks every caller
  (`src/lib/ssuAccess.ts:1093-1104` passes exactly 7 args + Clock).
- `git status` shows `cradleos_ssu_access/sources/ssu_access.move` **modified,
  uncommitted**, and `Move.lock`/`build/` untracked. The protocol has no
  "commit and tag the exact source tree before publish" step, so the artifact
  that catches silent drops (A4 manifest) has no provenance anchor. The v5
  silent drop was possible precisely because nobody could diff "what was
  published" against "what was in git."

**Fix:** (a) upgrade A3/A4 to full-signature parity via
`sui_getNormalizedMoveModule` (check S-4); (b) add "B0: `git add` + commit +
tag `publish/<pkg>-<date>` the exact sources; record the commit hash alongside
the pkg id in B3."

#### H-2. UpgradePanel is a loaded footgun bundled into production

`src/components/UpgradePanel.tsx:11-12` hardcodes UpgradeCap `0xe9710eaa…` and
gate-owner `0xc80fe7d6…` (key destroyed in the DGX1 reformat) and at :49-52
passes `package: BYTECODE.dependencies[0]` — which is `0x…0001` (MoveStdlib),
not any CradleOS package id, so even with the key it would be wrong. Combined
with C-3's dead-world payload this is dead code that can only ever do damage,
and it ships bytes to every user.

**Fix:** delete `UpgradePanel.tsx` + `src/upgrade-bytecode.json`; add S-6 to the
pre-deploy gate so archived ids in *artifacts* (not just source constants) are
caught. (DEPLOY.md step 2 greps only two ancient ids and only in `src/`.)

#### H-3. Phase C has no post-republish *user-migration* step for extension packages

A fresh ssu_access publish mints a new `SsuAuth` type and a new, empty
`SsuPolicyRegistry`. Every SSU that participated under the old lineage must
(a) re-run `world::storage_unit::authorize_extension<newPkg::SsuAuth>` and
(b) re-run `init_policy` against the new registry + re-set its mode — the dApp
does both in one PTB (`src/components/SharedAccessSection.tsx:243-258`), but
nothing in the protocol requires verifying that *existing adopters* are told,
or that the panel surfaces "your old policy is gone, re-enable." For v5→v6 this
is moot (registry table size 0 — zero adopters), but the protocol is generic,
and for any lineage with real adopters this is the difference between "owner
smoke test passed" and "every previously-shared SSU silently reverted to
OwnerOnly." Note the same class applies to gate_policy re-binding
(`bind_gate`) after a main-package fresh publish — v16's cutover comment
(`constants.ts:74-79`, "users re-init") acknowledges this happened with no
protocol step.

**Fix:** Add C6: "Enumerate old-lineage adopters (event scan on the old
original-id), publish a migration notice, and verify the re-enable UX path on
one real non-Raw-owned object where possible." Also make Phase D's SSU row
explicitly include "re-enable over a pre-existing world SSU that had the old
extension authorized" — stale extension authorizations are harmless but must
not confuse the new flow.

#### H-4. deploy-both.sh soft-passes the E3 hard requirement

Protocol E3: "Live bundle hash matches the just-built bundle, on **both**
origins." `deploy-both.sh:88` logs
`⚠ cradleos.io serving …, built … (CF edge cache may lag ~30s)` and **continues
with exit 0**. gh-pages verification checks the *git push* landed
(`deploy-both.sh:118-121`) but never fetches `GH_LIVE` to compare the served
bundle. A drift identical to 2026-07-07/2026-07-18 would still exit green.

**Fix:** in deploy-both.sh, retry `live_bundle` for up to ~3 min on both
origins and `die` on final mismatch; or add an explicit E3 command to the
protocol that the operator must paste output from.

### MEDIUM

#### M-1. C3 omits the index-side world-rotation steps it depends on

C3 says "character-index must be purged and re-backfilled" with no commands.
The operational reality (TOOLS.md, "CradleOS Character Index") is: update
`TENANTS` in `~/character-index/indexer.js` on DGX2, then
`node indexer.js --backfill --stillness`, and the same drift rule applies to
`cradleos-dapp/src/lib/tenantConfig.ts`. The dApp's wallet→character resolver
is **index-first** (`src/lib.ts:939-945` → `_resolveCharacterFromIndex`,
`src/lib.ts:914-937`), so a stale index doesn't just pollute search — it feeds
the canonical identity path. The index returns `stale:true` handling
(`lib.ts:934`) only helps if the index *knows* it's stale; after a world
rotation with an un-updated `TENANTS` it will confidently serve dead-lineage
characters. **Fix:** inline the exact commands + a parity spot-check (index
resolver result == RPC PlayerProfile-scan result for 3 known wallets) into C3.

#### M-2. L1 "local fullnode authoritative" is wrong for one whole read class (and the protocol knows it but keeps the ordering)

C4 both declares DGX2's fullnode "L1 — authoritative" and then admits its
`suix_getOwnedObjects` index is incomplete. Those cannot both be true for
owned-object reads. See Open Item #1 answer below for the corrected per-class
ordering. Also **UNVERIFIED:** whether the owned-objects index service
(`OWNED_INDEX_BASE`, `constants.ts:~430-450`) is fed from event streams or
from the incomplete local `suix_getOwnedObjects` — if the latter, the "L2"
layer is poisoned by the "L1" defect and parity verification must gate it.

#### M-3. World-type StructType filters assume `original == published-at` for the world package forever

`constants.ts:591-596` (`CHARACTER_TYPE`, `STORAGE_UNIT_TYPE`, …) and
`src/lib/ssuAccess.ts:1028` (`OwnerCap<…Character>` filter in
`fetchCharacterOwnerCapId`) build StructType filters from `WORLD_PKG`
(= tenantConfig `packageId`, which tracks published-at). Sui indexes types by
*defining* id. Today the world is a fresh v1 (`world Published.toml`:
`version = 1`, original == published), so this works. The day CCP performs an
**in-place world upgrade** instead of a wipe-publish, every StructType filter,
`expectedTypePrefix` check (`src/lib/ssuAccess.ts:935`), and OwnerCap inner
filter silently returns zero. The dual-ID discipline (I3) is enforced for
CradleOS packages but the tenantConfig schema has no `originalId` field at all
(`src/lib/tenantConfig.ts:44-52`). **Fix:** add `worldOriginalId` to
TenantConfig now (equal to packageId today) and route all type-filter
construction through it; add a Phase A assert `world version == 1 || originalId
present`.

#### M-4. Phase D negative-path coverage misses the aborts this exact feature will produce

`promote_ephemeral_to_shared` → `withdraw_by_owner` requires: SSU **online**
(`storage_unit.move:454` `assert!(…is_online(), ENotOnline)`), the caller's
per-character partition DF to **exist** (`storage_unit.move:462`
`df::borrow_mut` aborts with a raw dynamic-field error, not a friendly code,
when nothing was ever deposited), and the extension still authorized. The
matrix tests only happy paths. Missing rows: offline SSU; DEPOSIT ALL with
empty partition; expired allowlist entry; deny-listed char under hybrid;
MODE_PUBLIC deposit+withdraw by a tribeless character; owner revokes
extension then non-owner attempts withdraw (expect EExtensionNotAuthorized
surfaced sanely). Also `loadPolicyForSsu` maps *any* RPC failure to
`{kind:"none"}` (`src/lib/ssuAccess.ts:264,274`) so "no policy" in the UI is
ambiguous — the matrix should include "policy exists + RPC degraded ⇒ UI must
not display re-init as if virgin" (on-chain `EPolicyAlreadyExists` protects
state, but the operator reading the matrix needs to know a "no policy" PASS
can be a false negative).

#### M-5. DEPLOY.md actively contradicts the protocol and is still the file named "Deployment SOP"

DEPLOY.md (last updated 2026-03-27) instructs: smoke tests against
`fullnode.testnet.sui.io` (dead since 2026-07-08, per protocol B1), pushes to
the **entombed** hackathon repo, Utopia builds (Utopia purged 2026-07-19,
`constants.ts:1-6`), `npx gh-pages` deploys (superseded by deploy-both.sh),
and a package-ID table four lineages stale. An operator (or subagent) grabbing
"the deploy doc" has a coin-flip chance of following the wrong one. **Fix:**
add a banner at the top of DEPLOY.md: "SUPERSEDED for publish/rotation flows by
FRESH_DEPLOY_PROTOCOL.md; canonical dApp deploy = ./deploy-both.sh", and delete
the dead-RPC/hackathon/Utopia steps.

#### M-6. constants.ts comment rot inside the exact block operators must edit during this publish

`src/constants.ts:107` still says Stillness ssu_access is
`0x7d85b7c5… (linked to world 0x28b497559d)` — two lineages and two worlds
stale, in the header of the block where B3 says to record the new ids. Wrong
comments in the wiring file are how the wrong id gets "confirmed" during a
2 a.m. cutover. **Fix:** when performing B3, also delete/rewrite the stale
narrative comments; the protocol should say "comments describing dead lineages
move to the ARCHIVED section, never remain inline as if current."

### LOW

- **L-1.** Protocol A3's `sui_getNormalizedMoveFunction <pkg> <module> <fn>` is
  presented as a runnable command; it's a JSON-RPC method. Give the curl
  one-liner (see S-4) so it's copy-pasteable under pressure.
- **L-2.** `discoverSharedSsus` deliberately includes a whole batch on RPC
  failure of the type-filter step (`src/lib/ssuAccess.ts:960-963`) — acceptable
  tradeoff, but it means "stale SSUs shown" is an expected degraded mode; the
  Phase D Query/Search row should note it so a tester doesn't file it as a
  regression.
- **L-3.** `fetchCharacterOwnerCapId` uses bare `fetch` with no retry
  (`src/lib/ssuAccess.ts:1030`) on the DEPOSIT-ALL critical path, unlike every
  neighboring helper that uses `fetchWithRetry`. One transient blip disables
  the promote button.
- **L-4.** Registry table walk caps at 20×50 = 1000 SSUs
  (`src/lib/ssuAccess.ts:895`) with a comment "switch to event-based discovery"
  — fine, but note there is no `SSU_ACCESS_EVENT_PKGS` list yet; the first
  upgrade that adds an event struct to ssu_access will need the
  CASINO_V*-style defining-pkg bookkeeping from day one (`constants.ts:186-197`
  shows the pattern).

---

## 2. ANSWERS — the five "Open items for Fable audit" (§8)

**1. Is the L1/L2/L3 HA ordering correct given DGX2's incomplete owned-objects index?**
No — not as a single global ordering. It is correct for **event reads** and
object-by-id reads (DGX2 event queries are complete; ground truth) and wrong
for **owned-object enumeration**, where "L1 authoritative" is the layer with a
known-incomplete index. Restate C4 as a per-read-class table:
- *Events / getObject / multiGetObjects / dynamic fields:* L1 local fullnode →
  L3 proxy rotation. (L2 index irrelevant.)
- *Owned-object enumeration:* L2 index service **first** (it's what
  `findLatestCharacterForWallet` already does, `src/lib.ts:939-945`) → L3
  public/proxy RPC → L1 local fullnode **last or never** until
  reindex + parity verification (the sui-proxy bench drop-in per TOOLS.md).
- *Wallet→character resolution:* L2 index (`/resolve-character`) → RPC
  PlayerProfile scan via proxy — never local-node `suix_getOwnedObjects`.
Also resolve M-2's UNVERIFIED: document what feeds the owned-objects index; if
it's the local node's owned index, add a parity gate before trusting it.

**2. Should Phase D be automated? Minimum automatable subset for the type-identity class?**
Yes — the type-identity class is ~100% automatable and needs **zero wallets,
zero gas, zero UI**: `sui_devInspectTransactionBlock` executes a PTB with real
shared/owned object ids without signatures. A node script that builds each
entry-fn PTB with live object ids and asserts the failure mode is a *Move
abort* (or success), never `CommandArgumentError { TypeMismatch }`, would have
caught Casino v27 and ssu_access v5 within seconds of publish (see S-5).
Keep manual: webview rendering, wallet-signing UX, in-game visibility of
partitions, and anything asserting what a human *sees*. Automate: resolver
correctness (3 fixture wallets incl. one destroyed-and-rerolled), pagination
(power-user fixture >50 caps), registry type/table asserts (S-7), devInspect
sweep (S-5), and the repo greps (S-6). Wire the automated set into
deploy-both.sh as a hard gate next to the IOC scan.

**3. Static check for I1 violations pre-publish?**
Yes, three layers, all concrete (S-1, S-2, S-3 below). The decisive one is S-3
(compiled-bytecode address assertion) — I verified it detects the actual v5
artifact. Parsing sources for world reference params (S-2) is the right way to
*inventory* which packages are world-bound (and fixes C-1); the dep-pin assert
(S-1) closes the multi-env Published.toml hole (C-2).

**4. UpgradeCap custody?**
See C-4. Summary: dedicated deploy identity whose key is provably restorable
from ≥2 off-host backups, a mandatory pre-publish *signing proof from backup
material*, immediate post-publish transfer of caps to a 2-of-3 multisig custody
address (`sui keytool multi-sig-address` — note this must be arranged *before*
publish; the 0x177583b2 post-mortem confirmed plain-ed25519 leaves no recovery
path), and recording (cap id, custody address, digest, key-backup locations) in
constants.ts + TOOLS.md + daily log as part of B3, not after QA. For
fresh-publish-on-change lineages, deliberate `make_immutable` is better than an
accidental orphan.

**5. Does `promote_ephemeral_to_shared` / `withdraw_by_owner<Character>` need an ABI-parity regression test?**
Yes, two of them:
- **Pre-publish (source-level):** assert the candidate source declares
  `promote_ephemeral_to_shared` with the exact 8-param shape the dApp builds
  (`src/lib/ssuAccess.ts:1093-1104`), and that the *pinned world dep source*
  still declares `withdraw_by_owner<T: key>` with the 6-param shape
  (`storage_unit.move:448-455`). A 5-line grep/awk in the pre-publish gate.
- **Post-publish (chain-level):** S-4's normalized-module diff, plus one S-5
  devInspect of a real promote PTB (expects Move abort `EAccessDenied`/df-missing,
  never TypeMismatch or `FunctionNotFound`). `FunctionNotFound` is the signature
  of a re-drop; add it to the assert list explicitly.
Also note the restore is **uncommitted** right now (H-1) — commit it before any
manifest is generated, or the manifest protects nothing.

---

## 3. GAPS IN THE PROTOCOL (failure classes it still does not catch)

1. **Package-granularity blindness (type identity, part 2).** The protocol
   reasons module-by-module (I1/I2) but Sui links, publishes, and
   type-identifies at *package* granularity. Nothing in Phases A–C inventories
   which packages are world-bound (C-1). A single "world-ref inventory"
   artifact per repo, regenerated by S-2 and diffed in CI, closes this.

2. **Artifact staleness.** The protocol gates *sources* and *constants* but not
   *derived artifacts*: `build/` dirs, `upgrade-bytecode.json`, Move.lock env
   pins, Published.toml backups. Every one of these currently contains a dead
   world id somewhere in the tree (C-3). Dead ids don't only leak back through
   source rebases (DEPLOY.md's lesson) — they leak through cached bytecode.

3. **Env-name ambiguity in the modern Move package system.** Move.toml
   `[environments]`, Move.lock `use_environment`, the active `sui client env`,
   and Published.toml section names form a resolution chain the protocol never
   mentions. v5 published under `testnet` while its manifest declared only
   `testnet_stillness` (C-2). The protocol should mandate one env name per
   package, asserted by S-1.

4. **User-discovery via *typed filters* (not just ids).** C3 covers
   wallet→character and index purging, but discovery also flows through
   StructType/type-prefix filters built from `WORLD_PKG`
   (M-3: `constants.ts:591-596`, `ssuAccess.ts:935,1028`). A world in-place
   upgrade — a thing CCP can do without a wipe — breaks all of them silently
   and no current check would notice (queries return `[]`, the classic
   "feature looks uninitialized" failure the 2026-03-27 lesson documented for
   CradleOS's own ids).

5. **Provenance.** No step ties the published bytecode to a git commit (H-1).
   The v5 silent function drop was undiagnosable for a week partly because the
   published source's identity was unknown.

6. **Migration/adopter communication.** Fresh publish = state reset for
   *other people's* objects and policies. The protocol verifies the machine
   works but never that existing adopters are enumerated, notified, and can
   re-init (H-3). This is the "user-discovery" bug class in its social form:
   users can't find *the feature* after rotation, not just their objects.

7. **Post-deploy silence detection.** ssu_access v5 sat broken with
   0 policies / 0 events and nobody noticed until a user hit it. The protocol
   ends at E5. Add a canary: alert if a freshly-launched feature's
   registry table size or event count is still 0 after N days (a 10-line
   addition to the character-index poller, which already watches events).

8. **Degraded-mode ambiguity in reads.** Several read helpers collapse "RPC
   failed" into "empty/none" (`loadPolicyForSsu` → `{kind:"none"}`,
   `resolvePolicyId` → null, `indexFirst` → null in
   `src/lib/dataClient.ts:75-86`). Phase D "zero-state wallet degrades
   gracefully" does not distinguish *genuinely empty* from *couldn't read* —
   the recurring "hit-or-miss" bugs (protocol §0 table, 2026-05-07 row) all
   live in that gap.

---

## 4. CONCRETE STATIC CHECKS (would have caught Casino v27 and ssu_access v5 pre-publish)

All commands are runnable from the package dir (e.g. `frontier/cradleos_ssu_access/`).
`LIVE`/dead ids are pulled from tenantConfig, never typed by hand.

**S-0. Setup (shared by all checks):**
```bash
TCFG=/home/rawdata/.openclaw-captain/workspace/frontier/cradleos-dapp/src/lib/tenantConfig.ts
LIVE=$(awk '/\[TenantId.STILLNESS\]/,/datahubHost/' "$TCFG" | grep -oE '0x[0-9a-f]{64}' | head -1)
DEAD_IDS="920e577e1bf078bad19385aaa82e7332ef92b4973dcf8534797b129f9814d631
28b497559d180bbf2f0b23b1711407653b1b3a4b0f13cbdc25327af171ff8dbb"   # extend as worlds die
```

**S-1. Dep-pin assertion (closes C-2; catches v27 & v5 at the manifest layer):**
```bash
ENV=$(awk -F'"' '/^\[pinned\./{split($0,a,"."); e=a[2]} /use_environment/{print $2; exit}' Move.lock)
WPUB=$(awk -v env="[published.$ENV]" '$0==env{f=1} f&&/^published-at/{gsub(/"/,"",$3); print $3; exit}' \
      ../world-contracts/contracts/world/Published.toml)
[ "$WPUB" = "$LIVE" ] || { echo "FATAL: world dep for env '$ENV' = $WPUB != live $LIVE"; exit 1; }
```
On 2026-07-18 this exits 1 for both casino v27 and ssu_access v5
(`[published.testnet]` held `0x920e577e`).

**S-2. World-ref inventory (fixes C-1; mechanical I1/I2 classification):**
```bash
for pkg in cradleos cradleos_casino cradleos_ssu_access cradleos_voting; do
  W=$(grep -hoE 'use world::\{?[^;]*' ../$pkg/sources/*.move 2>/dev/null \
      | grep -oE '\b[A-Z][A-Za-z]+' | sort -u)
  for t in $W; do
    grep -nE "&(mut )?$t\b|OwnerCap<$t>" ../$pkg/sources/*.move
  done | sed "s/^/[WORLD-BOUND $pkg] /"
done
```
Non-empty output for a package ⇒ that package is lineage-bound and MUST be
fresh-published on rotation. Today this correctly flags `cradleos` (gate_policy
:694-740, gate_control:123-142, turret_ext:199-201, bounty_contract:210-211,
trustless_bounty:223-224, ssu_access:163+), `cradleos_casino` (every game's
`&Character` gate), and `cradleos_ssu_access`.

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
1 hit of `920e577e…` and 0 hits of `8b8a46ed…` (commands + output in C-3).
Run this after `sui move build` and again on the *exact* artifacts `sui client
publish` reports (digest match), then publish. This single check makes the
v27/v5 class structurally impossible to ship.

**S-4. Full-signature ABI parity (replaces name-only A3/A4):**
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
Store both files as the A4 manifest (`deploy/abi-<pkg>-<date>.json`). This
catches drops (`promote_ephemeral_to_shared` absent = a deletion hunk) **and**
signature drift, which the name grep cannot.

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
against a re-dropped promote it fails with `FunctionNotFound`. This is the
minimum automatable Phase D subset from Open Item #2.

**S-6. Repo-wide dead-id sweep (extends DEPLOY.md step 2 beyond src/ and beyond two ancient ids):**
```bash
cd frontier/cradleos-dapp
for d in $DEAD_IDS 61f4dab5 c3c2381f 874f10e0; do
  grep -rln "$d" src/ public/ scripts/ --exclude-dir=node_modules \
    | grep -vE '\.(md)$' | grep -v tenantConfig
done
# Expected: empty, or hits ONLY inside comments explicitly marked ARCHIVED/RETIRED.
# Today this flags src/upgrade-bytecode.json (binary payload — not a comment). Delete it.
```

**S-7. Shared-object wiring assertion (makes C1/C2 mechanical):**
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
the C2 record + the §3.7 zero-adoption canary baseline.

---

## 5. PER-PANEL QA MATRIX CRITIQUE (Phase D)

**What's good:** two-wallet rule, power-user pagination fixture, zero-state
wallet, evidence-required PASS. These directly encode the 2026-05-07 and
non-owner-SSU post-mortems.

**What's missing:**

1. **Coverage.** The matrix names 9 rows; `src/components/` contains ~35 real
   panels. Unlisted and load-bearing: Dashboard (the identity/boot path where
   the resolver bugs actually surfaced), Intel/Killboard, Industry, Registry
   (attestor flows), Treasury, TribeDex, Recruiting, SRP, CargoContract,
   Inheritance, EventCalendar, GateProfile, AssetLedger, TribeHierarchy/
   Leaderboard. Minimum fix: an explicit "out of scope this deploy" line per
   unlisted panel so silence is a decision, not an omission.
2. **Negative paths for the feature being shipped** (M-4): offline SSU
   (ENotOnline), DEPOSIT ALL with empty per-char partition (raw df abort —
   verify the UI error translation in `lib/txError` says something human),
   expired allowlist entry, hybrid deny, MODE_PUBLIC, revoked extension.
3. **Environment axis.** Rows don't specify *where* they run. The webview
   constraints bullet exists, but nothing requires each PASS to name its
   environment. Minimum: Inventory/SSU + Casino rows must each PASS once in
   desktop Chrome **and** once in the EVE Vault/Stillness webview (the
   dialog/select/emoji bans in TOOLS.md exist because desktop-only QA shipped
   webview breakage repeatedly). The protocol's grep only covers
   `window.prompt|confirm|alert` — it omits the native `<select>` and color-
   emoji audits that TOOLS.md ("Webview Dialog + Native Overlay Ban") mandates.
4. **Degraded-read rows** (§3.8): for Inventory and Query, one PASS must be
   recorded with the index deliberately unreachable (fallback path) — C4
   demands "both exercised" for search only; make it explicit per panel.
5. **Casino row is under-specified for the char-gate era:** must include a
   wallet with **no live Character** (expects clean "create a character"
   message, not an abort toast) and a destroyed-then-rerolled character wallet
   (the resolver's hardest case, `src/lib.ts:774-786`).

**Headless automation:** rows 1–5 of my S-checks plus:
- *Structures/pagination:* node script calling `fetchPlayerStructures` for the
  power-user fixture and asserting count == an independently-paginated RPC walk.
- *Resolver:* assert `findLatestCharacterForWallet(fixture)` equals pinned
  expected ids for 3 fixture wallets (live-only, rerolled, zero-state) via both
  the index path and with `OWNED_INDEX_BASE` stubbed to fail.
- *Casino/SSU tx-shape:* devInspect sweep (S-5) per game entry fn and per
  ssu_access entry fn.
- *Search:* one `/index/character-search?q=` call asserting >0 rows and one
  forced-fallback GraphQL walk asserting parity on a known name.
These need no browser and can run inside deploy-both.sh as a gate. Rendering,
signing UX, and in-game visibility remain manual by nature.

---

## 6. VERDICT

**The protocol is directionally right — its §0 diagnosis is accurate and Phase
C/D encode real lessons — but it is NOT yet safe to follow as written for the
imminent ssu_access fresh publish**, because the two mechanisms that produced
v27 and v5 (multi-env Published.toml resolution, C-2; stale/unverified build
artifacts, C-3) are still open as written, and A6 custody has no acceptance
test while the publish wallet situation is exactly the one that has already
orphaned three lineages (C-4).

**Blocking prerequisites before `sui client publish` of ssu_access v6:**

1. **Commit the restored source** (`ssu_access.move` is a working-tree edit;
   H-1) and tag it. Generate the A4 manifest from the commit, not the tree.
2. **Run S-1** (env-resolved dep-pin assert) — must print the live
   `0x8b8a46ed…` for the env actually pinned in Move.lock.
3. **`rm -rf build/`, rebuild, run S-3** — bytecode must contain the live world
   id and no dead id. Non-negotiable; this is the check that makes a v5 repeat
   impossible.
4. **Pre-publish signature proof + off-host key backup for the publish wallet,
   and a written custody destination for the new UpgradeCap** (C-4). Do not
   publish from a wallet whose key exists on exactly one host.
5. **Pre-write the S-4/S-5/S-7 post-publish gates** (ABI diff vs v5, devInspect
   of init_policy/shared_deposit/promote against live objects, registry-type
   assert) so they run in the minutes after publish, *before* constants.ts is
   cut over and before any announcement.
6. **A5/I6 occupancy check is satisfiable trivially this time** (v5 registry
   table size 0, zero module events — no user inventory at risk), but record
   that evidence explicitly in the daily log rather than waiving the step.

**Strongly recommended in the same session (non-blocking):** delete
`UpgradePanel.tsx` + `src/upgrade-bytecode.json` (H-2/C-3), fix I2's module
list (C-1), harden deploy-both.sh's E3 verification (H-4), and add the
supersession banner to DEPLOY.md (M-5).

With items 1–5 done, the protocol + S-checks reduce the recurring
type-identity/discovery failure classes from "caught by users" to "caught by a
failing exit code before publish," which is the document's stated purpose.
