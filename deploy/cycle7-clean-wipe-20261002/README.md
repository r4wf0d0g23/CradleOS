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

## Current state

**No new Move package has been published.** `src/lib/cycleDeployment.ts` contains empty IDs
and false readiness flags. Never substitute prior-cycle IDs or simulated IDs.
All five packages compile against current sources. Core/Casino/SSU/Seal publish dry-runs succeed;
Voting needs the ACTUAL freshly published Core address before a meaningful publication simulation.
The existing Cycle 7 character/index backend already uses a fresh database and current-world filters.

The web correction blocks retired packages/types before wallet signing, removes old recovery routes,
resets previous operational caches and namespaces vault caches to world + Core origin. New service
screens wait for package IDs AND initialized objects. Casino also waits for a funded fresh house;
Voting waits for registry/provider bootstrap. No fabricated zero old-world balances are displayed.

## Changes to fresh contract source

- Fresh manifests: no old `published-at` or `Published.toml` lineage; regenerate Move locks.
- Voting proof constructors are package-private. Open eligibility requires the sender's real
  current-world Character and derives its game ID on-chain. Public numeric IDs are not proof.
- Initial Voting eligibility/weight are **Open / One** only, enforced in `create_election` and UI.
  Other providers require identity/weight hardening before enabling. Age helper internals are private.
- UI handles Character object ID separately from game ID; election/tally readers use direct fields
  and the nested ElectionSchedule. Unsupported direct founder transfer is disabled, not invented.
- Tracked old Move build caches and the stale browser upgrade payload are retired.

## Publication gate still outstanding

`cradleos-dapp/FRESH_DEPLOY_PROTOCOL.md` §8.1 requires:

1. An immediately-before-publish signature using **backup-restored material**, not just the live key.
2. Raw's attestation of **two readable off-host backups**.
3. The cap custody destination recorded before signing.

Custody destination is confirmed. No off-host backup attestation or backup-derived signature has
been found. The wallet choice is settled; do not ask Raw to choose it again. Do not claim the key is lost and do not
copy secret key material into this repository, chat, logs, or evidence. This gate is independent of
the obsolete asset-migration requirements, which Raw's clean-wipe instruction supersedes.

## Concrete publication / bootstrap sequence after custody proof

Use the isolated verified Sui binary and client config; assert chain `4c78adac` before each batch.
Record a source commit/tag and retain exact command, bytecode digest, result and gas receipt.
All publishing must be **fresh publish**, never upgrade or old-cap reuse.

1. **Core** (`cradleos`): repeat a dry-run with explicit gas coin and budget >= 1 SUI, then publish.
   Save the real package ID and UpgradeCap. Keep the new `Published.toml`; it binds Voting's local
   Core dependency. Call these *fresh* entry points and record created shared object IDs:
   - `character_registry::create_registry()` → CharacterRegistry.
   - `bounty_contract::create_bounty_board_entry()` → BountyBoard.
   - `trustless_bounty::create_board_entry()` → Board.
   - `keeper_shrine::create_shrine<CURRENT_EVE>(b"CradleOS Cycle 7")` → Shrine.
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
