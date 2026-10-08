# Independent donation candidate review

2026-10-08. Runtime read-only, inherited native reviewer. Mocked browser signing calls only; no real wallet, funds, signatures or chain writes. Baseline/candidate worktree: `worktrees/cradleos-cycle7-20261002`.

## Final candidate gate: PASS

Both initial blocking findings below are resolved and independently rechecked. This is a seed-only UI gate, not approval to activate wagering, publish a casino contract, or represent donated funds as locked escrow. No real transaction was signed or submitted.

### D1 — stale attempt completion deletes a newer retry guard (resolved)

`HouseDonatePanel` removes the single `cradle.casino.donation.pending` key unconditionally after success or `FailedTransaction`. An asynchronous donation promise survives SPA unmount. Exact browser reproduction:

1. Start A, 1 EVE, with mocked wallet result unresolved.
2. Navigate normal app hash to Recipes, then back to Casino, reopen donations.
3. Explicitly clear A's guard after checking wallet activity.
4. Start B, 2 EVE, still unresolved.
5. Resolve old A successfully.

B's persisted marker changes from its own 2-EVE record to **null**, even though B is unresolved. Reload can now lose the retry safeguard. This does not itself send a second transaction, but breaks the explicit uncertain-submission guarantee.

Evidence: `pending-ownership.mjs`, `pending-ownership.json` (`guardPreserved:false`). Use a unique attempt token and compare-and-clear only the marker owned by the finishing submission. The manual-clear handler must likewise not erase a newer marker than the one shown. Test old success/definite failure plus storage removal failure. No global cancellation claim is needed: preserve newer ownership.

### D2 — whole-wallet merge is insufficiently bounded (resolved)

`fetchEveCoins` may return 1,250 coins. `buildDonateTx` merges every coin into one native `MergeCoins` before splitting the requested amount. Current protocol config reports `max_arguments=512`, `max_input_objects=2048`, `max_tx_size_bytes=131072`. A sufficiently fragmented wallet can exceed the command argument bound despite having enough money. A wallet whose combined coin balances exceed u64 also overflows that single merge even for a tiny requested gift.

Prefer selecting a bounded sufficient subset from fresh per-coin balances, minimizing input count; do not merge unrelated excess balance. Alternatively explicitly reject oversized construction before the wallet with an actionable message. Canonicalize Sui IDs before deduplication: `0x1` and `0x01` currently pass string-level distinctness but denote the same coin. Cover large fragmented inventory, sum above u64, insufficient bounded subset, and alias duplicates.

## Positive source findings

- Exact nine-decimal string parsing to BigInt, positive/u64 bounds, house capacity/available balance checks. No float donation construction. UTF-8 label length rejects instead of cutting codepoints.
- Fixed destination/package/current EVE and shared-object type check; explicit boolean pause. Six aliased escrow reads require empty nodes and explicit final-page false, failing closed on omitted/error/nonempty data.
- Fresh coins, then gas preparation, fresh liability/house check, captured account and network recheck, sender pinned, explicit SDK testnet/account options. Actual dApp Kit action documentation supports these arguments.
- Donation builder produces only coin merge/split and pinned `house::donate`; no wager, risk change, operator cap, generic transfer or unpause.
- Static `casinoFunded=false` and existing wager/quarantine guards unchanged. Donation mode is separate and practice does not mount donation queries.
- Synchronous latch blocks duplicate submission. Pending marker written before wallet invocation, and uncertain results remain blocked across reload. Definite failure clears; positive SDK tagged success is required for receipt. The UUID compare-and-clear correction now preserves attempt ownership.
- Disclosures correctly say irreversible shared bankroll, not investment/withdrawable deposit/separate escrow; no donor-label anonymity claim. Receipt labels the captured donating address and links a testnet digest.
- No automatic retry. Wallet rejection is conservatively treated as uncertain until the user reviews/clears it.

## Independently executed checks

- Donation + lounge tests: **13 PASS** (10 donation, 3 lounge).
- `npx tsc --noEmit`: **PASS** for inspected candidate.
- Exact current house and all six empty active-escrow lists independently read in the architecture gate (`house-live-history.json`, `active-escrows.json`).
- Browser mocked asynchronous ownership reproduction: two mock signing calls, zero page exceptions, reproduced D1. Network reads and signing are intercepted locally for that case; no actual wallet/financial transaction.
- Actual configured `https://keeper.reapers.shop/sui?nocache=1` read-only coin API responds with expected complete-page shape; SUI coin type was canonical. Public fullnode JSON-RPC itself is deprecated, but the application is configured to the working adapter, so that unrelated endpoint is not reported as an app blocker.
- Fresh explicit OPTIONS requests with production/local Origin to official GraphQL returned allowed CORS headers at this review time. Prior release CORS failure was real but not demonstrated persistent here.

## Final independent rechecks

- D1 fixed: UUID-tagged markers and compare-and-clear preserve the newer B marker when an unmounted A completes successfully **or** with explicit FailedTransaction. Both actual browser/mock-wallet cases pass: `pending-ownership-success.json` and `pending-ownership-failed.json`. Each made two intercepted mock signing calls and had zero page exceptions. Closing the form during liability verification also prevents a later wallet request or marker write. Historical failing evidence remains in `pending-ownership-before.json`.
- D2 fixed: verified per-coin balances, canonical object-ID deduplication, descending sufficient subset of at most 64 coin inputs; split each required portion before merging only the exact requested gift. This avoids full-wallet u64 overflow and oversized merge arguments. Targeted tests include rich wallets, near-u64 exact gifts, excessive dust input count and alias duplicate IDs.
- Fresh pending-storage recheck occurs before signing; marker write failure rejects submission. Unit coverage checks mismatched marker ownership and storage removal failure. Parent owns the broader rejection/quota/account-switch mock-wallet matrix; this reviewer does not claim real wallet execution.
- `npx tsc --noEmit` and `git diff --check`: PASS.
- Actual anonymous real-touch browser navigation at 320×780 and 844×390: donation route opens, live bank reads 0 $EVE, wagering is explicitly “Not enabled”, disconnected submission disabled, back restores 25 practice games, no horizontal overflow or page exceptions (`anonymous-mobile.json`, corresponding screenshots). Entry target measured 64.7×50 and 98.7×36 respectively; no claim every target is 44px. Local dev toolbar was present in local screenshots, not evaluated as a production artifact.
- All 29 rows and staged/practice counts in `deploy/casino-donations-20261008/OPTIONS-AUDIT.md` checked against the reviewed catalog: 25 practice, 23 staged testnet, zero active wagering. Multi-play versus shared-outcome multi-bet distinctions and proposed-vs-shipped boundaries are clear. The two nonblocking Scratch priority / Crash correlation wording nits were corrected.

## Retained boundaries

- Current empty paused House plus six empty complete escrow queries support the narrowly authorized seed-only action. Pre-sign reads do not atomically lock pause status during a wallet prompt; owner unpause/withdrawal and future payouts remain possible, and the UI discloses this.
- Old game math, hidden-state exploits, extra-stake pause checks, aggregate liability reserves and obsolete-package/version isolation remain separate wager-activation blockers.
- No deployed contract, House flags, balances, limits or configuration were mutated by this review. Parent reports additional test-only Move regression and full release checks separately; public deployment still requires its own bounded live verification.
