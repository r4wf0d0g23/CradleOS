# Activity counter repair — LIVE October 9, 2026

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
- Origins8/approved IOC/build pass. Candidate and live browser checks passed below.

Previous frontend rollback: Pages68c543cb / runtime071339d. Rollback must keep frontend/backend schema compatible; prefer fixing forward rather than restoring misleading legacy totals.

## Candidate browser verification
Production-build preview passed10 grouped checks:320/390/1440 viewport/touch/keyboard/disclosure, zero/stale/unavailable/malformed/legacy/old-index states, and refresh failure clearing cached total followed by successful recovery. No page exceptions. Screenshots visually inspected at320. Activity response fixtures were intercepted locally; these are not live wallet counts. Initial dev-mode attempt was blocked by the dev-only role toolbar, so final tests use the actual production build with no dev overlay. Build CSS remains byte-identical to prior astral release.


## Live delivery
- Source990bab7a4e316ea33759bf37dae2c48a85859c33 pushed; Cloudflare Pages production4235ec55 (https://4235ec55.cradleos-d75.pages.dev), primary https://cradleos.io/. Rollback frontend68c543cb; use compatible v2 backend to avoid reintroducing false counts.
- Backend activity.mjs/telemetry.js/config copied byte-exactly to existing proxy and only cradleos-agent.service restarted. SQLite online backup and prior telemetry source preserved in restricted local backup path recorded in backend-install.json. All150wallet,189chain and22cursor legacy rows preserved. Never commit DB/signatures/individual wallet data.
- Public telemetry200, CORS permits app origin, Cache-Control:no-store. API and live DB agree:4 distinct successful chain callers,0 new verified sign-ins at verification time, combined4. Invalid synthetic proof rejected401 without contributing a record; no valid synthetic wallet was submitted publicly. Existing health remains Keeper retired; /v1/models remains410. No chain writes, user-wallet signatures or session/auth changes.
- Exact live JS/CSS hashes match dist (live-build.json). JSindex-pLwWGISo.js SHA25652d3c6ba599bdf3b338d20d7ac068faf06aa5d4582ed25775a02c8b184fcefe4; CSSindex-zO7umNL4.css unchanged from astral release, SHA2565142ca71c345172a136c374f370ded27aa091a96964dc8030a32023cb88cd5ca.
- Actual public site and public API at320/390/1440 each show4verified wallets; expansion/collapse, keyboard,44px touch target, viewport bounds and historical-coverage copy verified. No mocked telemetry or connected-wallet flow in live browser checks; no page exceptions. Other third-party wallet-SDK diagnostics are not claimed absent. qa/live-browser.json and screenshots retain evidence.
- Positive signed proof tested using locally generated Ed25519 keys in isolated memory only. Actual EVE Vault/zkLogin signing was not performed; SDK adapter is configured with current GraphQL client/address validation, but do not claim connected-wallet E2E verification.


Final independent delivery review PASS: installed backend source/hash, API/DB aggregate evidence, legacy preservation, source/Pages/bundle receipts, three actual public widths versus ten fixture cases and unperformed zkLogin signing are accurately scoped. Reviewer did not independently repeat public asset fetch (its urllib request returned403); parent curl hashes and browser checks establish the public proof above. Task-owned5205/5206preview servers stopped; live index/proxy services and pre-existing Wrangler directories preserved. No remaining implementation blocker.
