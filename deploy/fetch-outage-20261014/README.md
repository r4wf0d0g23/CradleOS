# CradleOS fetch outage — October 14, 2026

## Root cause
The public Pages site was available, but the shared data origin returned HTTP502 for `/index/*` and `/sui`.

The host rebooted at08:11:10 CDT. The enabled character-index service immediately failed with `MODULE_NOT_FOUND`: its WorkingDirectory was a development sparse checkout excluding `services/character-index`. Git marked the omitted tracked files skip-worktree, so ordinary clean status did not reveal the missing runtime sources. The running process had survived before reboot; absence became fatal at restart. Evidence establishes omission/reboot exposure, not who changed the checkout or when.

The Sui proxy was disabled and did not start at boot. Both the normal RPC URL and its cache-bypass fallback use that same proxy, so neither could recover a stopped daemon. The main website, tunnel and agent service were available. This was not a casino release failure.

## Repair
- Exported all20 committed character-index files from source `c3bed89691c5103f57ac19df05f2b63ec4cd779c` into `/home/rawdata/character-index/releases/c3bed896-20261014`.
- Independently verified byte identity; copied existing tested100MB node_modules as a real directory, not a worktree symlink. No dependencies installed.
- SQLite quick_check passed. Saved a consistent pre-restart backup at `/home/rawdata/character-index/backups/fetch-outage-20261014/cycle7-pre-restart.sqlite`.
- Added only `20261014-durable-runtime.conf`, overriding WorkingDirectory. Existing absolute Cycle7 DB path, environment files, ownership configuration and protected Origins media settings remain unchanged.
- Enabled and started the user Sui proxy; restarted the index. Both bind loopback8002/8004 and are enabled at boot (user linger already enabled).
- No frontend deployment, chain transaction, financial activation, database reset, credential change or retired-service/fullnode activation. Current web remains Pages`ea9de180`.

## Verification
-28 backend tests passed against the staged runtime; all20 source files match recorded hashes.
-Public site, character search/count, item catalog, GraphQL, chain identifier`4c78adac`, package object and indexed event reads return successful real data.
-CORS preflight204 and cross-origin allow headers verified. Protected direct Origins media remains404 without its authorization.
-Index caught up from3326 to3380 characters and2090 to2118 kills; last poll advanced to current time. No manual backfill/reset.
-Stable service PIDs, no additional restart count growth, fullnode remains inactive/disabled.
-Live Chromium checks: home, Intel, Game Data and Casino render without failed-to-fetch text or application exceptions; five cross-origin Cradle API reads succeed. A mistaken exploratory `#/treasury` URL resolved to the home fallback and is not counted as Treasury verification.
-Independent final review PASS: source identity, real dependency copy, backup integrity, enabled/stable services, current polling, search, chain ID and protected Origins denial independently confirmed. Public evidence reconciles.
-Residual third-party Google Fonts/Slush metadata requests can fail in the anonymous test browser; these are not the restored Cradle data endpoints. Connected-wallet signing was not tested.
-No runtime/application source edits; documentation/evidence only in the repository.

## Operations
Runtime source now lives independently of development sparse checkout. Future service upgrades should stage a versioned release, run backend tests, verify the same Cycle7 database/secret files, then change the narrow WorkingDirectory drop-in. Do not point the service back to an unmaterialized checkout or the older pre-Cycle7 `/home/rawdata/character-index/server.js`. The previous service source remains tracked in Git; do not delete the canonical worktree because other development/service uses may remain.
