# Known Space archive

Read-only, cycle/world/tenant/chain-scoped Sui event collector. Only native jump-backed endpoints enter the graph. Current typed Gate objects and native location disclosures can identify their systems; unresolved endpoints remain separate. Gate size is not a distance measurement. No raw coordinates or pilot identifiers are persisted/exposed.

## Build / test

From the repository root with the reviewed dApp dependencies available:

```sh
ln -s ../../cradleos-dapp/node_modules services/known-space/node_modules
node --test services/known-space/core.test.mjs
node services/known-space/build.mjs
KNOWN_SPACE_DB=/private/path/cycle7.sqlite node services/known-space/dist/server.mjs
```

Build regenerates public config from canonical current-world frontend constants. Node24 with builtin SQLite is required. Default loopback API port8045. GET `/known-space` returns the live snapshot; `?at=<epochMillis>` replays indexed evidence up to that time. `/health` is local operational liveness/initialization, not a completeness proof. Query and method validation are strict. Public rate limit is a global graph-computation budget, not per-IP identity tracking.

Each event page and its cursor commit atomically. Initial latest pages are followed by forward head reads and bounded reverse backfill. Historical retention gaps are recorded, never silently replaced by latest. Archive start does not advance with provider pruning. `indexedAt` is the source watermark; pending head/history windows remain Backfilling rather than claiming complete. Existing snapshots survive source failures, and current object metadata expires after180seconds. Public retained history is not a complete-cycle claim.

Replay suppresses current names/status/link/type and uses disclosures known by the cutoff. LocationRegistry bootstrap is timestamped when observed, never retroactively. Location disclosures prove publication, not physical-coordinate truth. The schematic groups actual connected components, not star positions; layout may repack when topology changes, but unchanged topology/traffic refresh does not move nodes.

## Operations

Install reviewed `cradleos-known-space.service` under the user systemd directory and immutable server bundle/backup script under `~/.local/share/cradleos-known-space/releases/<source-sha>/`; `current` points to that release. DB namespace validation prevents accidental cross-cycle reuse. Stop waits for the current collector pass; do not copy a live WAL database as ordinary files.

The daily backup service uses SQLite online backup, then pinned SSH to authorized Jetson2 and verifies remote SHA-256 plus SQLite integrity. Generations are retained; monitor disk growth and timer failures. Restore by stopping the collector, verifying the saved SQLite scope/integrity, and selecting the restored DB before restarting. No wallet/signing material is part of this archive.

The Cloudflare ingress addition is exactly `keeper.reapers.shop` + `^/known-space$`; all other routes remain untouched. Public API is read-only, CORS-public, and contains public gate/network data only. Rollback: restore the private pre-change tunnel configuration, stop the isolated service, select previous Pages release. Keep the DB for recovery.
