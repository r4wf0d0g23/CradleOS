# Activity counter repair — candidate, October 9, 2026

## Root causes (read-only production diagnosis)
- Existing API reported 12 wallet MAU, 3 wallet DAU, 0 chain MAU. All 20 wallet-day rows contributing to those 12 addresses had verified=0. Signature-verification exceptions were accepted and counted as verified.
- Chain tracking still referenced June/pre-wipe packages and retired testnet JSON-RPC. Last persisted chain activity was July17; errors were silently swallowed.
- Old day-string >= cutoff included up to an extra UTC calendar-day tail and lacked proof freshness/replay boundaries.

## Scope and repair
- Metric is unique verified wallet ADDRESSES, not people, online users, visits, clicks or casino rounds. Operational/admin wallets are not excluded. A wallet in both sources counts once.
- Fresh existing identity challenges verified with current installed SDK + official Sui GraphQL, claimed address enforced. Exact challenge format/five-minute freshness; persisted signed timestamp means replay cannot extend dates. Invalid/unverifiable proofs rejected. No extra signing prompt or auth/session-hook modification.
- Separate v2 tables leave legacy data intact but exclude it from trusted totals. Wallet proof coverage starts when repaired service is installed; unrecoverable historical site usage is explicitly disclosed.
- Successful transactions calling the five current app packages (core, casino, SSU, voting, personal turret), including eventless calls. Failed transactions, pre-wipe packages, retired KeeperSeal and walletless practice activity excluded. This is direct current-package call coverage, not all transactions in the EVE world.
- Official GraphQL read-only scans: chain identity, retained history and latest checkpoint verified; pagination fixed to one checkpoint; complete all-package snapshot committed atomically. Exact rolling30d lower bound, todayUTC sign-ins; source checked through disclosed checkpoint. Max1000 scanned transactions/package/poll; hitting cap or partial/malformed/pruned/stale response fails closed, preserving prior snapshot but nulling public combined/chain totals.
- Ten-minute coalesced backend poll; frontend refresh60s plus foreground return,12s timeout. Unknown/stale/error distinct from real zero. Accessible disclosure,44px target, explicit historical coverage.
- Runtime uses Node24 builtin SQLite. Existing better-sqlite3 native addon crashed during crypto-test GC; no installation or dependency change was made. Actual service executable /usr/bin/node v24.21.0 supports DatabaseSync.
- Existing retired-Keeper guard, shared image/war routes, chain/wallet state, SSU quarantine, casino math/gates and astral rendering unchanged.

## Verification so far
- 18 backend regression tests pass; 356 frontend tests and TypeScript pass. Backend tests include real locally-generated Ed25519 proof verification, mismatched signer/corruption/unsupported/stale rejection, signed-day replay and rolling window, overlap union, pagination, partial/fault/stale/retained-history/scope/atomicity boundaries. Synthetic keys are test-only, never submitted publicly.
- Independent inherited-model source review PASS (Opus unavailable to native reviewer); independently reran18backend+4frontend telemetry tests. No functional blocker; dependency symlink excluded, actual runtime checked.
- Read-only live GraphQL scan finds4 unique successful callers across21 package/transaction matches. One transaction calling multiple packages can appear in multiple matches; these are NOT claimed as21 distinct transactions. Snapshot live-scan.json uses isolated in-memory DB, no public metric mutation or chain writes.
- Origins8/approved IOC/build pass. Browser/live release checks pending.

Previous frontend rollback: Pages68c543cb / runtime071339d. Backend backup/install receipt and final source/deployment will be appended after verification. Rollback must keep frontend/backend schema compatible; prefer fixing forward rather than restoring misleading legacy totals.

## Candidate browser verification
Production-build preview passed10 grouped checks:320/390/1440 viewport/touch/keyboard/disclosure, zero/stale/unavailable/malformed/legacy/old-index states, and refresh failure clearing cached total followed by successful recovery. No page exceptions. Screenshots visually inspected at320. Activity response fixtures were intercepted locally; these are not live wallet counts. Initial dev-mode attempt was blocked by the dev-only role toolbar, so final tests use the actual production build with no dev overlay. Build CSS remains byte-identical to prior astral release.
