# Partner report expansion — 2026-10-29

Requested by Raw: separate Cloudflare website access and wallet-use metrics for
all project cycles; condense chronology to major changes back through Cycle5.
Public link remains https://cradleos.io/partners/metrics/ with no app navigation.

## Independent sources and meaning

- Website: Cloudflare Web Analytics, exact CradleOS site-tag AND requestHost
  cradleos.io filter, rolling30days. Adaptive-estimate pageviews and visits;
  visits are not unique people. No wallet/website union. Site created July6;
  unavailable earlier analytics are not invented. Initial source reading:
  1540pageviews/1300visits. Hourly collector uses dedicated Account Analytics
  Read credential only, kept0600 outside source and never returned publicly.
- Cycle5/6: archived event-sender observations from legacy core package
  allowlist.37/22distinct canonical addresses. Partial observed dates March25–
  June24 and June26–July17. No retained per-event transaction proofs; not
  described as reverified successful transactions or full-cycle audiences.
  All43legacy sign-in addresses have verified=0 and are EXCLUDED.
- Cycle7: exact existing5package scope, verified proof observations sinceOct9
  plus validated fresh successful-call snapshots; collector persists each
  observation in a private archive so later rolling-window pruning does not
  erase earlier observations.14union/13sign-ins/7chain observed initially.
  Not complete-cycle coverage, not summed across cycles or sources; operators
  remain included. New book and storage-access packages outside existing
  collector scope are explicitly excluded. Unknown initial chain values are
  null, not zero; past recorded observations remain marked partial.
- Existing live rolling30day endpoint and app footer are unchanged. Historical
  and website exports are separate from the existing current-window export.

## Cycle boundary evidence (UTC date buckets)

- Cycle5 March11: https://evefrontier.com/en/news/cycle-5-arrives-11-march
- Cycle6 June25: https://fenris.com/news/2026/eve-frontier-cycle-6-sanctuary-launches-today-with-a-five-day-free-trial
- Cycle7 September29: official release references in src/lib/cycle.ts and
  https://www.youtube.com/watch?v=eC76ehNwtuc

Date buckets use the published start dates, not a claim of exact reset-hour.
No observed legacy/current transactions fall on an ambiguous boundary day.

## Major milestones

Seven dated entries: March27 tribe foundation, May4 gate/defense policies,
July12 casino expansion, August19 Origins reader, October3 Vestiges rebuild,
October22 books, October29 shared storage. Older evidence is immutable
published gh-pages snapshot commits, not dates assigned to new code. All16
repo/evidence links returned200 anonymously. Not a claim every historical
feature remains financially activated; current House HOLD remains unchanged.

## Collection and public boundary

services/partner-metrics contains pure aggregation, scheduled collector,
strict projected GET handler and user service/timer. Source telemetry.db opens
readonly in one consistent read transaction. Archive0600, parent0700; report
atomic0600 rename. No sourceDB or other service data changes. Secret missing or
Cloudflare failure yields website unavailable while wallet collection proceeds.
GET /telemetry/history returns only strict known aggregate schema; no raw file
extras, wallet list, token, signatures or error details.2hreportTTL; nested
collection times and exact host/cycle/scope checked. Snapshot age cannot be
laundered with a fresh response timestamp. Frontend/backend use the same
history.ts validator, compiled to history-model.mjs via installed esbuild.

13Node +651frontend tests; focused independent review; strictsourcevalidation,
union/dedup, sourcefailures, initial unknownchain, archivepersistence, malformed
CFcounts, directAPIprivacy/TTL. Sandboxed preview/live browser verifies real
source values, exports, independent outages, suspended-clock expiry, public
no-wallet access, four widths, unchanged navigation and major milestones.
Injected failures are labelled fixtures, not source data.

Previous web rollback: Pagescb41d5f2. Backend backup/runtime/token permission and
live checks recorded in backend-install.json and release.json after execution.
No contract/custody/stock/player transaction changes.
