# Frontier Betting Book — staged release, October 21, 2026

**NOT PUBLISHED. NOT ENABLED ON THE LIVE WEBSITE.** No new wallet signature,
funding, wager, market, or chain object was created. Current casino House/HOLD,
balances, practice games and production deployment remain unchanged.

## Reviewed implementation

- Source: `de37c69358243c75f4d4a6a41ebe2a3e3dc46bd6`.
- Local provenance tag: `publish/cradleos_book-2026-10-21` (pre-publication
  source snapshot, not evidence of publication). Neither source nor tag pushed.
- Separate `cradleos_book` Move package and casino Betting Book panel.
- Current Sui testnet EVE; player-funded two-pilot kill contests, zero house fee.
- Terms freeze before betting. Only qualifying canonical official Killmail
  objects submitted before the proof deadline count. Scores stay provisional
  until then. Game-admin attestation is trusted; game-wide completeness and
  self/alt-kill filtering are NOT promised.
- Tie/zero-proof/one-sided pools refund. No administrator withdrawal or result
  override. Permissionless proof/finalize/claim remains available when paused.
- Owned, sender-bound tickets; integer accounting; exact aggregate escrow
  conservation with at most one atomic unit of order-dependent rounding per
  winning ticket. No current character required to reclaim a prior ticket.
- Publication manifest intentionally has blank package/book IDs and wagering
  disabled. No simulated publication IDs are used as real deployment data.

## Completed checks

- 29 Move tests, including maximum-u64 pool, rounding, refunds, canonical proof
  rejection, deadlines, pause recovery, cap binding and foreign-market tickets.
- 479 frontend tests in 50 files; 19 are new book-specific tests.
- TypeScript, 8 Origins canon checks, approved exact-directory IOC scanner,
  production Vite build and `git diff --check` PASS.
- Seven fixture-only browser checks at 320/390/1440 pixels; no wallet signatures.
  Confirmation invalidation on market refresh is covered. Official-character
  ownership is re-read to reject transferred-profile stale candidates.
- Unmodified production-build preview at 390/1440 is checked separately:
  setup pending, no betting action, no page errors or horizontal overflow.
- Clean production Move build in a fresh temporary installation directory:
  only module `book`, no test-only setup; current world reference present,
  other published world origins and protocol-listed retired origin absent.
  It exactly matches the package-directory bytecode used by the dry-run.
- Unsigned `sui client publish --dry-run --verify-deps` succeeded against the
  verified current testnet. Estimated gas 46,303,600 MIST. This is a simulation,
  not a publication. All IDs in `publish-dryrun.json` are simulation outputs.
- Independent architecture and staged-release reviews PASS after fixes;
  reviewer did not approve or claim live publication/wallet E2E.

Evidence: `provenance.json`, `abi-public.txt`, `browser-qa.json`,
`production-preview.json`, `publish-dryrun.json`, `REVIEW.md`. Raw tool logs are
retained locally (repository ignores `*.log`). Existing Vite chunk/dynamic-import
warnings are non-blocking; this release does not claim bundle optimization.

## Actual remaining publication gate

`cradleos-dapp/FRESH_DEPLOY_PROTOCOL.md` §8.1 requires an immediately-before-publish
signature from restored backup material and operator-attested readable backups
on at least two off-host locations. Existing deploy wallet/custody destination
is already authorized: `0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a`.
Do not ask Raw to reselect it.

October 2 records prove one Jetson2 backup then, not today. The second (DGX1)
was not verified. The October 2 backup exception explicitly covered that Cycle 7
release only. Today the approved pinned-host SSH route to Jetson2 times out;
Tailscale reports NeedsLogin/no peers. No host-key bypass, secret output, new
backup destination, login change, or signature was attempted to work around it.

Before signing this release: restore approved backup access and satisfy §8.1,
or obtain a new **explicit release-scoped exception** from Raw covering the
currently-unrefreshed backup signing proof and second-backup requirement. Record
the exact authorization and its scope. No exception has yet been requested or
granted in this receipt. Existing casino activation HOLD is not part of any
book-only exception.

## Resume publication after that gate

1. Recheck current world/EVE/registry, chain `4c78adac`, deploy wallet, source
   hashes and selected environment. Move source is world-lineage-bound through
   `&Character` and `&Killmail`; a future world rotation requires a new package.
   This is a first book lineage: no previous book/player-state migration or
   prior book ABI exists. Do not alter other packages or old player state.
2. Satisfy/record custody gate, then regenerate a clean production build and
   rerun bytecode assertions. Re-run unsigned publication simulation with
   dependency verification. Keep the exact source commit/tag as anchor.
3. Publish only `cradleos_book` with the pinned Sui 1.81.0 tool and existing
   `research/eve-cycle7-clean-wipe-20261002/client.yaml`. Record actual digest,
   package ID, BootstrapCap, UpgradeCap and owner immediately. Never use IDs
   from `publish-dryrun.json`.
4. Compare new normalized public ABI against `abi-public.txt` (prepublish
   disassembly signatures). Check all public entry signatures and type origins.
   Bootstrap exactly once via `book::create_book<CURRENT_EVE_COIN_TYPE>`, consuming
   actual BootstrapCap. Record Book/AdminCap and custody; verify shared Book
   exact type, version1, correct registry/tenant, paused state, empty markets.
5. Pre-cutover type-identity dry-runs with live current Character/Killmail objects:
   create_market future terms; place_bet with exact EVE coin; submit_proof with
   current Killmail; finalize/claim against actual book objects once available.
   Expected time/authority aborts must be distinguished from type/ABI failures.
   No demo or invented-event market and no wager on Raw's behalf. Full wallet
   lifecycle requires actual consenting test participants/eligible events.
6. Fill manifest using real verified receipts only. Keep new betting disabled
   until checks pass. Do not make package immutable without explicit approval;
   retaining an UpgradeCap is not permission to bypass event/escrow rules.
7. Re-run affected tests/production build and independent release review after
   real IDs are wired. Follow `PRIMARY_DEPLOY.md`: commit/push reviewed source,
   canon/IOC/build gates, primary-only Pages deployment, exact live asset hashes
   and actual browser checks. Current rollback target is `ea9de180`.
8. Report actual chain/frontend receipts and any live-wallet verification gaps.
   Book begins empty; operator can create future contests with actual official
   character IDs. A book release never unpauses the existing casino House.

## Local reproduction

Use `/home/rawdata/.openclaw-captain/workspace/tools/sui-testnet-1.81.0/sui`,
not the host's unrelated/broken global Sui link. Build/test with environment
`testnet_stillness`. CLI `client publish` uses the selected client environment,
not `--build-env`. Native Move publication verifies dependency source; do not
add skip-verification flags. Browser fixture runner expects local Vite port5230;
production preview uses port5231 with `VITE_BASE=/`. Both temporary servers were
stopped after validation. Rebuild artifacts from source rather than committing
build caches.
