# Storage configuration restoration — 2026-10-29

## Status: deployed and production verified

Raw reported missing storage configuration on `Reap Shared storage` in a screenshot.
The current `Manage access` view was intentionally reduced to status/revocation on
October 9: the old module exports its authorization witness. Restoring those
buttons against that package would restore a bypass, not permissions.

Scope assumed from the shown Manage access panel: sharing rules and the shared
pool workflow. An optional scope question was sent; no answer was received.
Native name/description/URL/power controls elsewhere are not changed in this release.

## Implemented

- New isolated `cradleos_storage_access::storage_access` package, private witness
  construction, fresh `Policy` and `Registry` types. Old source/package untouched.
- Closed, tribes, pilots, tribes+pilots, public modes. 32 tribes / 128 entries
  per pilot list. Duplicates rejected. Deny wins; a matching explicit pilot entry
  is authoritative (no tribe fallback for expiry/direction). Expiry exclusive;
  zero means no expiry. Editor dates limited to a representable calendar range.
- Policy tied permanently to its SSU; actual owner capability for create/config;
  canonical singleton registry; expected revision prevents lost policy updates.
- Only shared↔caller-personal atomic transfers; no owner-main withdrawal API,
  no free-floating Item returns, no public witness constructor. Closed-pool
  recovery requires SSU owner's capability and sender-bound destination.
- Owner editor, stock/permissions review, explicit replacement consent, wallet
  and network guards, stale-read rejection, post-submit verification status.
- Deposit-all is caller personal stock only, at most 100 distinct stacks.
- New and legacy discovery remain separate; catalogue/descriptor failures do not
  suppress successful results. Unknown is not empty. Old signer quarantine stays.

## Important semantics

`authorize` is explicit replacement, NOT compare-and-swap. Official StorageUnit
has no extension getter; current binding can change during approval. Confirmation
expressly covers replacement of the current binding and access to ALL shared
stock, including arrivals after preview. No claim of approval-time binding CAS.
The shared pool is keyed to the SSU, not to this extension. Rebinding moves no
stock but changes access to retained stock. Owner-main and personal pools are
not shared. No SSU is reconfigured, frozen, migrated, or signed automatically.

Legacy registry/discovery/manual recovery/quarantine are preserved. The isolated
new registry does not orphan old assets. Existing `STRG-1` adopter has empty
shared/personal pools at the recorded read; this is not a signing-time guarantee.
No migration notice is needed for a silent cutover because there is no cutover
of existing users: each owner must explicitly activate the new extension.

## Evidence

- 32 Move integration tests pass: real official world setup, exact owner and
  Character caps, sender/SSU mismatch, duplicate policy, stale revision, mode
  direction/expiry/deny/tribe changes, frozen/revoked/offline/foreign witness,
  tenant, quantity/capacity failure, owner-main/other-personal isolation, recovery.
- External attacker compilation fails both direct witness construction and old
  `new_auth()` calls (`check-package.py`, `package-checks.json`).
- Activated release: 629 frontend tests / 59 files pass; 84 focused tests independently checked.
- TypeScript + production build, Origins8 and exact-dApp IOC scan pass.
- Browser: sandboxed Chromium fixture with REAL components, transaction builders
  and compatibility guard; simulated reads and wallet. Nine checks, 650/390/320px,
  no JS errors, no real transactions. `verify-ui.mjs`, `ui-browser.json`.
- Supported gRPC live snapshot of target and legacy adopter: `live-before.json`.
- All 21 compiled world dependency modules exactly match live deployed bytes:
  `verify-dependency.mjs`, `world-dependency.json`.
- Unsigned publication simulation with checks ENABLED succeeds:
  `simulate-publish.mjs`, `publish-simulation.json`. No key loaded, no submission.
- Clean separate build produces identical bytecode/dependencies/digest. Full
  compiled ABI manifest saved; production Move SHA256
  `8ce1baf940e96ba09869f2c5923b3493e9e6f72d840c2eb1c4d925da7d696d95`.
- Independent native architecture, Move and frontend reviews PASS after fixes.
  Reviewer used the available native model, NOT Opus. Review notes below.

Browser fixtures are not an actual EVE Vault, user PIN, or Stillness embedded
webview test. Live owner-signed configuration and two-wallet transfers remain
unverified until deployment/owner participation. Do not represent fixture wallet
calls or simulated publication output as transaction digests on chain.

## Custody / release gate

Raw explicitly approved Jetson2 moving forward (2026-10-29 09:08 CDT, Discord message 1565366765733675169): one verified off-host backup on Jetson2 is the standing exception for this storage release and future CradleOS deployments. Do not re-request the second-host attestation. Fresh restored-backup signature proof and recorded cap custody remain required; no second backup is claimed.
Fresh proof and publication receipts follow below; staging evidence above remains unchanged.

Proposed unchanged publisher/custody destination:
`0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a`.
Deployment pin now matches the verified package, registry and world IDs in `onchain.json`. Frontend activated on production; see web-release.json.

## Release procedure (custody and publication completed)

1. Refresh restored-backup signature proof and record attestation/exception plus
   custody destination. Commit/tag exact reviewed source before publishing.
2. Rebuild clean from that commit; assert bytes/dependencies/ABI match receipts.
3. Publish ONLY this isolated package on testnet; immediately record package,
   registry, cap, digest, commit/tag and verified cap custody. No SSU mutation.
4. Compare live full ABI and normalized published bytecode, verify new registry
   type + empty table, and unsigned simulate actual-owner create/config PTB,
   wrong-owner failure and existing legacy rebind path. Do not broadcast owner
   configuration or use the deployment wallet as a substitute for their cap.
5. Set `storageAccessDeployment.ts` to reviewed actual package/registry/world;
   run guards/tests/build and browser checks with live read-only data. Explicitly
   report actual EVE Vault/embedded-webview signing limits; do not fabricate PASS.
6. Commit/push and deploy via PRIMARY_DEPLOY.md to cradleos.io only. Verify live
   hashes and UI, record rollback and source. Current rollback is Pages a024f5bd,
   inventory source da6a7e0bcf697308ed48f78d94801b3e5e732f9c.
7. Owner signs reviewed enablement; non-owner transfer proof remains outstanding
   until a participating wallet performs it. Do not automatically migrate stock.

Other panels, House, casino, services, world contracts, legacy extension and
existing on-chain permissions are out of scope and unchanged.

## Publication verification — 2026-10-29

- Source tag `publish/cradleos-storage-access-2026-10-29`, commit `3b30c8f`.
- `onchain.json`: independent canonical-chain execution lookup, exact relocated
  bytecode, registry type/empty table and UpgradeCap custody all pass.
- `owner-flow-simulations.json`: two actual-owner configurations pass; both wrong
  senders fail specifically `ESenderCannotAccessCharacter` in `borrow_owner_cap`.
- All public functions pass in a fifth unsigned live-object simulation. The owner
  has no own personal stock, so that simulation explicitly prepares one item via
  official owner-only APIs and a temporary simulation-only extension, then binds
  the real extension before testing deposit/withdraw/closed recovery. This seed is
  NOT in product builders and was NEVER signed/submitted. Registry still empty.
- No actual EVE Vault signing or live player inventory transfer is claimed.

## Activated frontend release checks

629 frontend tests /59 files, 84 independently checked focused tests, TypeScript
production build, Origins8 and exact-dApp IOC check pass. Real-data sandboxed
browser preview passes owner Manage access, five modes, tribe permission review,
pilot direction/expiry controls and 1440/650/390/320px layout; zero writes/errors.
The wallet account is a read-only synthetic Wallet Standard account representing
the real owner address, not a real EVE Vault/PIN or embedded-browser sign-in.
Independent release review PASS; actual owner signing remains untested.

## Final delivery

Production https://cradleos.io/ — Pages **33f7c6b7**, source
**902ada7c2d6ac55a3040e7fb0b7f6dc74ca18292**; rollback **a024f5bd**.
Live HTML references and both JS/CSS hashes match the reviewed build.
`live-browser.json` passes on real chain data with a read-only synthetic wallet:
owner configuration, all five modes, tribe review, pilot expiry/direction controls,
consent, 1440/650/390/320px, zero signing attempts and JS errors.
Initial domain/asset propagation probes were stale; normal requests and a fresh
browser succeeded at14:19:17Z. No cache configuration or unrelated services changed.
Independent deployed-delivery review PASS. Local preview stopped.

Owner path: **Inventory → storage unit → Manage access**. Owners explicitly choose
rules, review stock/access consequences and sign. No SSU binding, permissions or
inventory was changed automatically. Actual EVE Vault signing and live player
transfers remain unverified; neither fixture wallets nor simulations prove them.
