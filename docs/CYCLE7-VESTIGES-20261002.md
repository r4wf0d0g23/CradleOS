# Cycle 7 / Vestiges compatibility — 2026-10-02

## Findings and primary sources

Vestiges launched **29 September 2026**, not a routine patch to the previous world.

- [Launch](https://evefrontier.com/en/news/cycle-7-vestiges-launches-29-september)
- [0.7.0.0 patch notes](https://evefrontier.com/en/news/patch-notes-founder-access-0-7-0-0-vestiges)
- [0.7.0.1 patch notes](https://evefrontier.com/en/news/patch-notes-founder-access-0-7-0-1-vestiges)
- [0.7.1.0 / October 1 changes](https://evefrontier.com/en/news/patch-notes-founder-access-0-7-1-0-vestiges)
- [Official world-contracts PR 261](https://github.com/evefrontier/world-contracts/pull/261), commit `d3c7016b48a796ee70ecff7b892316f2d0170282`
- World-contracts main checked at `d33ff232bd3878e8f9ad0721e18564b21facc925` (September 28).
- [Official dapps PR 53](https://github.com/evefrontier/dapps/pull/53), main checked at `33e77c60522fcea6b1d370c7eb92a047265c1a8b`.
- wallet-core generated MVR cache corroborates the new Stillness addresses; evevault updated wallet-core to 0.0.13 September 29. Builder-scaffold was pushed October 1 but its main commit remains March 17: push time alone is not a release.

### Breaking changes

The public World API deliberately removed solar systems, constellations, and character jump history. Discovery and routing now depend on the character's in-game exploration. Do not revive the old complete universe snapshot or use a third-party map as a runtime dependency.

Nine skills grow through Memories; the old Pathways model is removed. Mining cuts fragments and uses regoliths rather than the old ore model. October 1 reduced Network Node component requirements from 10 to 8 and changed Debris refining to 10 Debris → 6 Salvaged Materials + 2 Aromatic Carbon Weave + 2 Nickel Iron Veins + 6 Silicon Dust. Existing detailed fitting/industry tables were **not** represented as current: they now carry historical-reference notices.

### Verified Stillness identities

- World: `0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92`
- Current EVE: `0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE`
- ObjectRegistry: `0x8fd47e6e5cf8cb9b789cef26fbb674be819d8abd6afccaf50e95451212f0813a`
- FuelConfig: `0xefe91f22b382d34721a386d8d5188d5244316bcfea47dee518210c01cf080b60`
- EnergyConfig: `0xafde88ecb4f7722660a094582904c32bd837a1af8761a243d08e842a7905b6b3`
- Network: Sui testnet, chain identifier `4c78adac`.

Original/type-origin and latest published-at are different concepts. Use original types for owned-object filters and latest packages for Move calls. Current Stillness v1 has matching original/published addresses; legacy casino v29 does **not**.

## Implemented website behavior

- Current character/profile discovery uses official GraphQL, with pagination and explicit failures. Public gRPC is independently verified for owned objects.
- Updated world/config identities, 538 official item types, and 22 on-chain energy costs.
- Retired map/jump requests and caches; map links explain the discovery change instead of showing old routes.
- Scoped character caches by world; did **not** globally clear recovery/session storage.
- Existing casino/contracts retain their original EVE type. Current EVE is separately exported; funds were not relabelled or converted.
- A shared pre-wallet signer guard blocks incompatible new legacy actions, including serialized and mixed PTBs. Narrow exact-package/function/type recovery exceptions remain.
- Legacy blackjack/split-hand discovery, hi-lo/mines/tower/video-poker recovery, and manual legacy vault lookup remain reachable. Failed lookups are errors, not proof of empty holdings.
- New betting/deposits and incompatible old-world extension operations are paused pending separately reviewed contract migration. No packages were published, upgraded, or funded by this update.
- Origins Chapters 1 and 2, public catalog, companions, immutable hashes, and canon checks are preserved.

## Index service and data isolation

Source: `services/character-index/`. Uses pinned better-sqlite3 13.0.3 for Node 24; the deployed old 11.x native binding was unstable on that runtime.

- Previous data remains at `/home/rawdata/character-index/data/characters.sqlite`.
- Consistent SQLite backup: `/home/rawdata/character-index/data/archive-before-cycle7-20261002.sqlite`.
- Separate current database: `/home/rawdata/character-index/data/cycle7-20261002.sqlite`.
- Startup rejects databases without a verified matching world-origin marker.
- Initial verified inventory: 1,655 characters, 5,756 current-world objects, 735 killmails. These are time-specific observations, not fixed expected counts.
- Current official catalog: 538 items; removed universe catalog is empty and its endpoint returns HTTP 410.
- Character and kill updates use official GraphQL events because public JSON-RPC event indexing is disabled. Page cursors are opaque GraphQL strings, separate from persistent event-ID markers.
- Polling captures the first processed page's newest marker, fails closed on incomplete/capped reads, and commits markers/freshness atomically with records. It never rereads a later event merely to advance progress.
- Mixed event candidates skip confirmed unrelated types; unresolved target reads remain failures. Cold polling covers events since the full snapshot's **start**, closing the snapshot/poll gap.
- Primary ownership reader uses public Sui gRPC; protected pre-existing recovery cache configuration is preserved. RPC/index listeners bind loopback only.

The original source/database were not overwritten. The service cutover uses a named systemd override, keeping existing protected EnvironmentFiles. Roll back that override to restore the previous code/data; do not delete databases or restart the fullnode.

## Evidence and checks

Evidence retained outside the repository under `research/eve-cycle7-20261002/`: official raw GitHub/API responses, data exports, live character proof, build/test logs, browser screenshots, and rollout receipts.

- 98 app tests: type separation, exact recovery allowlist, pre-wallet rejection, failed/partial reads, pagination, retired maps, correct legacy recovery origins, and Origins preservation.
- 20 backend tests include real SQLite write-failure triggers verifying no marker/freshness advancement on failed writes.
- Production-base TypeScript/Vite build passes. Existing large-bundle warning remains; no dependency upgrade was needed for the frontend.
- Desktop/mobile browser checks: no page exceptions, no horizontal overflow, no retired universe/jump requests; legacy recovery screen opens.
- Canon check and supply-chain IOC scan required before deployment.
- No wallet signatures or end-to-end financial recovery transactions were performed. Read paths and transaction construction/guard semantics are verified; actual user settlement remains unexercised.

## Existing outages / limits

The RPC proxy, character-index service, and approved Chapter 2 media service were found unavailable and restored/replaced as part of validating site functionality. Chapter 2's 49,437,043-byte original matches SHA-256 `4288982d54339a63b3eb404f828eec93dd91042e86816ae12bf7cc5d8b6f40a1`.

Chapter 1's approved 301,223,529-byte film is missing from its expected origin path. Expected SHA-256: `18ea72e95c9b45f0a452cc9550ac9b0cac594fbca11d63c9a6600ef5c76e568d`. Its metadata/transcript remain; a different cut was **not** substituted. Restoring that exact approved file is separate follow-up.

Old-world SSU/structure workflows cannot simply reuse a current-world character. They remain blocked until compatible migration or an explicit legacy context is implemented. This release is a **website/read compatibility update**, not a completed on-chain migration.

## Source provenance

The original workspace checkout was dirty and was left untouched. A separate checkout began at public master `b64e072ee43d76a70c76dc700d4646bbee1059d0`. Relevant application/Origins source was restored from local known commit `a4d070beb5c7628f64794f876d8a4878feb7a3cf`, plus the already-public September 8 Chapter 2 catalog/media-companion assets and original Pages route. This preserves known live content, but is not claimed to recreate the old minified build byte-for-byte.

Production Pages project: `cradleos`, branch `main`, domains cradleos.io/www.cradleos.io. Prior production deployment: `c9ca8427-1e14-4d39-b902-3718597eb5f8`. GitHub mirror PR 21 was already open and review-gated; do not bypass branch protection or merge it automatically.

## Rollout state

- Preview deployment: `2bf06f65` on `cycle7-preview.cradleos-d75.pages.dev`; browser route checks pass. Preview intentionally lacks the production-only media secret and reports "media delivery not configured"; the production Chapter 2 endpoint is independently verified HTTP 200 with the immutable hash/length above.
- Production index cut over via `~/.config/systemd/user/character-index.service.d/20261002-cycle7.conf`. Public character resolution matches the official current-world read; at cutover 1,658 characters and 5,761 owned objects, increasing from the initial snapshot.
- Frontend production deployment ID and final live checks are recorded in the rollout receipt after publication.

### Production receipt

- Published October 2: `https://54e4e2fc.cradleos-d75.pages.dev`, production domains cradleos.io / www.cradleos.io.
- Application source commit: `5d876140d241a148f24b5689b35fc5be3708e4d9`, branch `cycle7-vestiges-20261002` (pushed to GitHub; no protected branch merge).
- Live assets: `index-0Emmt49s.js`, `index-D_K0sBVG.css`.
- Live browser check passes seven routes, desktop/mobile layout, no page exceptions or retired-map requests, and opening the recovery panel.
- Production Chapter 2 range request: HTTP 206, bytes 0–63 of 49,437,043, matching immutable SHA ETag. Automated Chromium lacks this H.264/AAC codec (`canPlayType` empty), so **end-to-end audiovisual playback is not claimed**. No media cut or encoding was altered.
- Final full owned-object pass: 5,762 upserts, two confirmed stale objects removed, `allOk=true`; subsequent incremental pass wrote 19 objects. Current character resolution remains independently checked against the official chain.
- Both pre-wallet transaction guards and discovery/atomic-index regressions pass: 98 frontend + 20 backend tests; eight canon checks; IOC scan clean.
- Existing large-bundle warning remains. Chapter 1's missing approved media and full legacy extension migration remain explicit follow-ups, not completed work.
