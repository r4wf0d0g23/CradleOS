# Known Space — plan and release boundaries

Raw authorized: **plan, audit, create, audit, launch** (1566157116245409842).

## Data and meaning

- Build an observed smart-gate network, not a full universe catalog. Native current-world JumpEvent is the only traffic input; permits, link events and purchases are not jumps.
- A gate's type selects a configured maximum distance. This is not its actual separation, not a system-center measurement, and not independently proved pair geometry. Native distance-proof binding has limitations; do not turn a successful link into a measured distance. No invented LY conversion or geographic coordinates.
- Native LocationRevealedEvent / LocationRegistry disclosures bind gate IDs to system IDs when backed by the correct current Gate object. They are sponsor disclosures, not a hash proof of coordinates. Registry rows outlive deleted objects; never trust registry membership as evidence of a live gate.
- Unresolved endpoints remain separate gate nodes. Confirmed system associations collapse nodes by system ID. Current client names resolve only observed IDs; never enumerate the names dictionary into the graph. Do not infer systems from gate names or energy-source nodes.
- Early audit found only one currently revealed Gate among 142 registry entries. This is expected to produce mostly unresolved nodes initially. No fake sample data in production.

## Service

Isolated Node24 read-only collector/API, SQLite in its own data directory, loopback port8045. Dedicated user service. Add only `/known-space` and its query-string endpoint to the existing keeper tunnel before its fallback; preserve all existing ingress/config and rollback snapshot. Do not modify the existing character index, contracts, wallet flows or House.

Canonical world/cycle/registry/chain configuration generated from current frontend source. DB refuses a mismatched namespace. Supported official Sui GraphQL events and current-object reads only; chain ID, exact types, tenant/item-derived IDs, timestamps/checkpoints and pagination shapes validated. Native event ID is transaction digest plus event sequence. Public API excludes pilot identifiers and raw coordinates.

Per-source forward and backward cursors commit atomically with events. Initial latest-page bootstrap, incremental head polling plus bounded backfill. Never silently skip cursor gaps, clear data on outages, turn unreadable data into zero, or claim complete-cycle history. Record exact missing checkpoint intervals as provider retention advances; retire only expired scan ranges and preserve every stored discovery. Persist immutable archive start separately from current provider retention. Report archive start, available-range watermark, backfill completion, rejected records and stale/error state. Current provider retention begins October4, later than Cycle7 start. Persistent state survives browser closure and service restart.

Render only jump-backed endpoints. Read current typed Gate state for live name/type/status/link and location-hash correspondence; missing or stale objects cannot be presented as currently online/located. Historical replay uses events up to its selected time and does not borrow present status or future location disclosures. Timestamp ambiguity must not fabricate a location join.

## Interface

Public Known Space nav + `#/known-space`, wallet not required. Deterministic topology-grouped schematic SVG (connected components and bounded relaxation; not physical positions), zoom/pan/touch, search, bright identified systems/muted unresolved gates, selectable nodes/routes, directional traffic counts, first/last observations and source transaction links. Concise Schematic / Retained history / Backfilling / Stale labels. Discovery replay with Live return; reduced-motion honored. Keep existing event ticker behavior and all other tabs intact.

## Release checks

Independent pre-build source/data audit; strict decoder, namespace, dedup, pagination, restart, retention, replay and object-failure tests; frontend parser/graph tests; TypeScript/build; existing frontend and Origins checks; desktop/mobile real-data browser checks plus explicit failure/empty/stale/replay cases. Independent source and release audit before activation. Commit exact build inputs; release service from committed artifacts; test restart and persistence; deploy Pages project cradleos/main and compare production asset hashes. Final independent live review. No signing, player-state writes, secret transmission or backup-custody ceremony needed for this read-only deployment.

Rollback: restore prior tunnel config, stop new isolated service, restore previous Pages deployment. Retain SQLite for recovery; no destructive cleanup.

## Durability and public bounds

Dedicated loopback service; 32-entry/10-second snapshot cache with revision invalidation and global four-burst/one-per-second computation budget. Invalid methods/times rejected; limited sockets and request timeouts. Graceful shutdown waits for collector completion. Consistent SQLite backup copied daily to authorized Jetson2 and verified there by SHA-256 and SQLite integrity check; no signing material. Backup timer failures remain visible in systemd.
