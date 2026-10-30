# Chain event log and ticker — 2026-10-30

## Scope

Public `https://cradleos.io/#/events` and an app-wide (non-kiosk) notable-event ticker. Gate controls link into the same log filtered by gate ID. No wallet needed for reads; no contracts, transaction builders, backend services, custody or player state changed.

- Readable native gate jumps, links, unlinks, creation, extension changes and permits.
- Structure status transitions and native loss reports.
- Isolated CradleOS route creation/configuration, permits, passes and revenue claims.
- Search loaded records by current name, object/item ID, transaction or text; category filter; older pages; transaction links and details.
- Slow ticker highlights noteworthy events recorded within 24 hours. Routine jumps/permits stay in the log. Pause preference, hover/focus pause and reduced-motion support; no announcement churn.

## Provenance and limitations

Official Sui testnet GraphQL, exact current-world/route package types, exact testnet identifier and Stillness tenant-derived IDs. Freshness exclusively uses `serviceConfig.availableRange(type:"Query",field:"events",filters:["type"]).last`, never the root chain head or last matching event time. Each source retains its own cursor, failure and freshness state. Three-minute age limit; stale sources cannot supply ticker highlights. Refresh every 60 seconds only while visible and not browsing history.

The newest 30 records per source are loaded initially; up to ten pages per source can be browsed. Counts describe loaded/filtered records, **not all-time totals**. This browser reader is not a persistent archive. Source failures are unavailable/stale, not successful empty results. Unsupported future types are counted as omitted. Older browsing pauses head polling/ticker until Refresh latest.

Only native `world::gate::JumpEvent` counts as a jump, never permit issuance/purchase. It is an on-chain game record, not independent evidence of physical in-game arrival. Gate directions and typed pilot identity are preserved. Unanchoring is never called destruction; route Changed is never inferred to be a price change or physical lockdown.

Loss reports can be backfilled: recorded time and reported occurrence time are displayed separately. Reporter is not victim; killer/victim remain entity references unless typed metadata resolves them. Names are current metadata, not historical identity attestations; typed object/tenant checks precede names and failures retain ID fallbacks. Hashed locations are not dehashed; no ship cargo inferred.

Route events contain neither tenant nor token type. Before publication into the feed, Route<T> and both immutable native gate endpoints must resolve as the expected Stillness objects. Exact T controls EVE/SUI display; other currency stays raw units/unknown. If historical route/gate objects can no longer be verified, that source fails closed; there is no fabricated historical ownership/tenant proof. Native/custom permit descriptions fold only on matching digest and permit ID; actual jump records remain separate.

## Release verification

- 838 frontend tests across 68 files, including 29 chain-event cases.
- TypeScript/Vite production build; Origins guard (8 checks); approved scoped IOC scan clean.
- Independent architecture and final source review by existing native reviewer: PASS after correcting the event-specific index watermark. Review was not an Opus run.
- Preview browser uses live chain data with explicit simulated failures, TLS verification and sandboxed Chromium. See preview-browser.json; no transactions or wallet signing performed.
- Root/partner assets and production browser receipts are recorded after publication.

Previous production rollback: Cloudflare Pages `c150da8c`, runtime source `9c638d0228d3fafd1a66072b922ad0cc2eea0e00`.
