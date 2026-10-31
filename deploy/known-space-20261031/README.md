# Known Space release — 2026-10-31

Raw authorized plan/audit/create/audit/launch. Live map: https://cradleos.io/#/known-space. Read-only public API: https://keeper.reapers.shop/known-space.

Source `3b81f24e40d94068306b10340cf2f95b1efe612d`, Pages `55757e91`; previous rollback Pages `a03fd651` / source `1e8e98b7bd123151d4004c2606d32fbf97d4f7c8`. Feature source commit `5f89dcf`, followed by reviewed symlink startup fix. No contract, wallet-signing or player-state changes.

## Verified

- 860 frontend tests /69 files;20 map-focused;26 backend; TypeScript/build, Origins8, approved scoped IOC scan, three systemd unit checks.
- Independent native plan, implementation, deployment and symlink-runtime reviews PASS; not an Opus review.
- Actual bundle launched through deployment symlink, emitted collector state and exited cleanly on SIGTERM.
- Preview seven browser scenario groups; production six: public real-data graph, zoom/pan/search/node/edge provenance, replay/live, 320/390px fit, actual touch pinch, failure preserves graph. Zero page errors or chain writes. Preview additionally verifies honest empty/unavailable fixtures. Screenshots were visually reviewed; disconnected routes were regrouped before launch.
- All five production JS/CSS hashes equal reviewed dist; root/partner HTML refs, partner noindex and slash301 preserved.
- Public API reconciles all route counts with observed jumps, preserves event scope, suppresses pilot identifiers and current metadata in replay, rejects mutation methods/invalid times. Existing keeper health routes remain200.
- 14039 durable event IDs survived restart, SQLite integrity passed. Daily Jetson2 backup enabled; a consistent backup was remotely SHA256/integrity verified. See durability.json.
- Collector service active, restart count0. Private state under `~/.local/share/cradleos-known-space/`; immutable release/current symlink. Only anchored `/known-space` keeper ingress added; all other config retained. Prior tunnel configuration privately backed up.

## Meaning and coverage

This is an observed smart-gate schematic, not geographic star positions or all game travel. Gate type provides a maximum cap, not measured separation. Revealed locations are native sponsor disclosures, not a coordinate/hash guarantee. Unresolved gates remain separate; no guesses from names or oldworld catalog. The current data initially identifies only one system.

The archive retains collected evidence beyond the provider's rolling event window. Current provider history begins October4 (after Cycle7 start), four missing historical checkpoint ranges are explicit, and backfill was still running at public verification (15039 events /7150 jumps /279 gates). The UI labels this partial history; it does not claim complete-cycle coverage. Current object metadata expires; outages preserve saved graph and show stale. Replay does not borrow future disclosures or present names/status.

## Rollback / operations

Restore prior Pages deployment; restore private tunnel-before.json configuration and stop the isolated known-space service/timer if needed. Retain the SQLite archive. Jetson2 backups retain generations; monitor disk/timer health. No second-host custody or signing required. Owned preview5366 and staging8046 stopped after production verification.

Final independent native production audit PASS: source/running immutable backend hash, five public assets and partner refs/noindex, fresh scoped API/counts, nonempty replay without lookahead, public browser281nodes/keyboard selection/zeroerrors orwrites, and independently SSH-verified Jetson2 SHA/integrity plus timer. Backfill and four gaps remain explicit; no release blocker.
