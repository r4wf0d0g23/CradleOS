# Cycle 7 clean-wipe cutover — 2026-10-02

## Authoritative scope

Raw confirmed: **the old world is retired; there is no migration of funds or other state.**
This supersedes the recovery-oriented release described in `docs/CYCLE7-VESTIGES-20261002.md`.
Do not import old balances, casino games, vaults, policies, elections, registries, or obligations.
Archive old deployment records for audit only. Origins/content/reading progress are unrelated and retained.

## Verified inputs

- Chain: Sui testnet `4c78adac`.
- World: `0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92`.
- EVE: `0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE`.
- Official source: `world-contracts` submodule `d33ff232bd3878e8f9ad0721e18564b21facc925`.
- Toolchain: official Sui testnet 1.81.0 (`bf0c491c17b8`), aarch64 release archive SHA256
  `2ae9a4eb77a97f48bb085f0d583efdddcf78adf588c3c5f2bba2f73e9a879092`.
- Prepared signer: `0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a`.
  Raw confirmed this SAME wallet for new cap custody at 10:29 CT October 2; see `custody.json`.
  Live key present; this is NOT a claim of backup verification.
- Previous manifests/publication records preserved in `previous-manifests/`.

## Current state — deployed on-chain October 2

Five fresh service packages are published and initialized. `onchain.json` is the
receipt ledger; each active package's `Published.toml` matches it. All UpgradeCaps
and owned admin/mint caps remain with the confirmed 177583b2…99b91a custody wallet.
The website manifest contains only these verified new package/object IDs.

- Core: fresh CharacterRegistry, BountyBoard, TrustlessBountyBoard, KeeperShrine.
- SSU: fresh standalone SsuPolicyRegistry.
- Keeper Seal: fresh Registry and KeeperMintCap; no old seals imported.
- Casino: fresh current-EVE House with bank=0, counters=0, paused=true.
  Wagering stays disabled pending deliberate new bankroll and operating limits.
- Voting: current fresh package `0xf1166f0e22b5c1407ee16d2ff5ce0a3a1d101827b82747df53ff636883b5abec`,
  new registry with Open/One, SingleChoice/Approval, Public privacy, no recasts.
  Unsupported modes reject on-chain and are disabled in the UI. Full voter inputs
  are checked for completeness, order, uniqueness, stored values and unit weights.
  Canonical tally binding, cast-time validation and close-time checks are enforced.
- Current-world character/index backend uses the isolated Cycle 7 database.
  Official GraphQL now supplies event/dynamic-field reads through the existing
  loopback-only read adapter; local proxy change is recorded in
  `sui-proxy-indexed-reads.patch`. No transaction/write methods were added.

The first Voting publication failed the valid-owner smoke check: a literal
self-package address stayed zero after publication. It was never activated;
its metadata/caps/test election are archived in `rejected-voting-first/`, not
used by the app. Corrected providers obtain the immutable runtime type origin.
The replacement valid-owner cast simulation succeeds; wrong-owner mint rejects.
Simulations did not sign for the sample character or store a ballot. Verification
polls are clearly labelled technical checks, use zero funds and no stored votes,
and are finalized after their short window. No old-world data is transferred.

Activation checks: Core25 + Casino176 prior contract regressions; Voting20,
frontend102, backend28 current tests; external forged-proof compilation rejected.
Nine-route local desktop/mobile browser QA passes with no exceptions, retired
requests, recovery screens or overflow. Origins reading progress survives and
current-cycle caches survive repeated loads. Full wallet-driven browser signing
has not been asserted by the automated browser tests.

Website deployment receipt and live bundle proof are recorded below once complete.

## Changes to fresh contract source

- Fresh manifests: no old `published-at` or `Published.toml` lineage; regenerate Move locks.
- Voting proof constructors are package-private. Open eligibility requires the sender's real
  current-world Character and derives its game ID on-chain. Public numeric IDs are not proof.
- Initial Voting eligibility/weight are **Open / One** only, enforced in `create_election` and UI.
  Other providers require identity/weight hardening before enabling. Age helper internals are private.
- UI handles Character object ID separately from game ID; election/tally readers use direct fields
  and the nested ElectionSchedule. Unsupported direct founder transfer is disabled, not invented.
- Tracked old Move build caches and the stale browser upgrade payload are retired.

## Publication authorization — second-backup check deferred

**Raw authorized at 13:01 CT: “Let's deploy and fix backups later.”** Proceed with the
existing custody wallet and verified Jetson2 copy; the DGX1/second-offhost check is a
recorded follow-up, NOT a blocker for this release. This is a release-specific operator
exception, not a global weakening of the deployment protocol. Jetson2 restored-signature
proof was refreshed immediately before this publication batch; digest in `custody.json`.

The baseline `cradleos-dapp/FRESH_DEPLOY_PROTOCOL.md` §8.1 requires:

1. An immediately-before-publish signature using **backup-restored material**, not just the live key.
2. Raw's attestation of **two readable off-host backups**.
3. The cap custody destination recorded before signing.

Custody destination is confirmed. Raw authorized Jetson2 for the second backup destination
and confirmed SSH authorization. At 12:11 CT, Captain created the selected-wallet-only backup
on Jetson2 (private 0700 directory, 0600 file), restored that stored copy and verified a harmless
Sui PersonalMessage signature independently with the Sui SDK. See `custody.json` for its digest.
This proves **ONE off-host backup**, not two. DGX1 remains offline/SSH-unreachable and its copy is
unverified. The proof was refreshed immediately before publication. Signed deployment/bootstrap
transactions consumed SUI gas only; no EVE bankroll or previous-world funds were transferred.

Do not ask Raw to choose a custody wallet again. Do not claim any key is lost. Never copy key
material into this repository, chat, logs, or evidence. This backup gate is independent of the
obsolete asset-migration requirements, which Raw's clean-wipe instruction supersedes.

## Publication / bootstrap procedure (completed for this release)

Use the isolated verified Sui binary and client config; assert chain `4c78adac` before each batch.
Record a source commit/tag and retain exact command, bytecode digest, result and gas receipt.
All publishing must be **fresh publish**, never upgrade or old-cap reuse.

1. **Core** (`cradleos`): repeat a dry-run with explicit gas coin and budget >= 1 SUI, then publish.
   Save the real package ID and UpgradeCap. Keep the new `Published.toml`; it binds Voting's local
   Core dependency. Call these *fresh* entry points and record created shared object IDs:
   - `character_registry::create_registry()` → CharacterRegistry.
   - `bounty_contract::create_bounty_board_entry()` → BountyBoard.
   - `trustless_bounty::create_board_entry()` → TrustlessBountyBoard.
   - `keeper_shrine::create_shrine<CURRENT_EVE>(b"CradleOS Cycle 7")` → KeeperShrine.
   New tribes/vaults/policies are created by current owners later. Do not seed them from old state.
2. **SSU** (`cradleos_ssu_access`): fresh publish. Capture auto-created SsuPolicyRegistry and cap.
   This is the standalone current-world binding, not Core's historical twin module.
3. **Casino** (`cradleos_casino`): fresh publish. Build a PTB with `0x2::coin::zero<CURRENT_EVE>()`
   feeding `house::create_and_share<CURRENT_EVE>(zero, 1, 1)`. The temporary 1-unit min/max are
   inert bootstrap bounds, not recommended operating bets. Capture House and HouseAdminCap;
   immediately `house::set_risk_params<CURRENT_EVE>(house, cap, 1, 1, true)` to pause it.
   No old-house withdrawal, balance transfer, game settlement or liability import. Do not enable
   bets until a deliberate new-cycle funding/risk configuration is verified. `casinoFunded=false`
   until then; zero-seed creation is not evidence that wagering works.
4. **Voting**: rebuild only AFTER Core's actual publication metadata exists. Check every linked
   address includes current World + new Core, no old origins. Repeat publication dry-run and publish.
   `extension::create_registry()` creates ExtensionRegistry + AdminCap. Register eligibility kind 0
   (`eligibility_open`, `mint`) and weight kind 0 (`weight_one`, `mint`) under the NEW Voting package.
   Register only implemented/reviewed methods; prove create→cast/commit→tally with current Character
   before setting `votingProvidersReady=true`. No prior-election import. Third-party proof providers
   remain unsupported until a proper capability/witness authentication protocol exists.
5. **Keeper Seal** (`cradleos_keeper_seal`): fresh publish; capture automatic Registry and KeeperMintCap.
   It is world-independent bytecode but gets a fresh lineage/registry for this clean wipe. Do not
   move old seals into the new registry. Update the mint service only to the new verified cap.
6. Move all UpgradeCaps/admin-cap objects to the pre-recorded custody destination; retain receipts.
   Read live normalized ABIs and object types, compare with current frontend builders. Dry-run
   representative current-Character calls; perform only authorized transaction smoke tests.
7. Fill `cradleos-dapp/src/lib/cycleDeployment.ts` from actual successful receipts and live reads.
   Set readiness per initialized service; do not flip flags just because a package exists.
   Build/test/review, deploy Pages, and verify connected-wallet flows. Keep old IDs solely in archives.

## Verification and website release

- Move suites: Core 25, Casino 176, Voting 3; SSU/Seal have no unit tests in this source.
- `verify-proof-boundary.py <sui>` compiles an external forgery attempt and requires visibility errors
  for BOTH proof factories. No signing or publication.
- Production-bytecode scan: 25/31/1/22/1 modules; current World linked in the four world-bound
  packages; known retired-world bytes absent; no test modules in production builds.
- Frontend: `npm test`; `VITE_BASE=/ npm run build`.
- UI: desktop/mobile; seed old cache values; reload twice; preserve Origins progress; ensure no
  old-package requests, recovery UI, or retired universe/jump requests. Never report read failure
  as a zero balance.
- Pages deployment is independent of the Move publication gate. Until fresh contracts are ready,
  the honest production state is **clean-wipe reads/content with contract services awaiting setup**.

See `verification.json` for simulation/test receipts and `PRODUCTION.md` for the website receipt.

## Deferred follow-ups (not release blockers)

- Verify the second off-host backup on DGX1 when it is reachable; Jetson2 restore/signature proof already verified. Raw explicitly deferred this check for this release.
- Fund/configure the fresh Casino only with a deliberate new bankroll and approved operating limits; do not import old funds.
- Additional Voting methods, weights, eligibility providers, commit/reveal and sponsorship remain unavailable until their own verified implementation.
- Preserve this worktree: the live character-index service runs from its services directory.

GraphQL ballot payloads are decoded explicitly as base64, separate from RPC arrays/hex.
Malformed byte payloads fail closed; browser tally verification checks winners, total
weight and the complete per-option payload with the actual chain seed and parameters.
