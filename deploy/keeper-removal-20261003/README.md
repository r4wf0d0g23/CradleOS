# Keeper and stale calendar removal — 2026-10-03

Raw requested removal of the Dashboard Lattice Contributions panel and Keeper
system, then the old hackathon schedule. Origins story content is out of scope.

Removed: contribution ledger, chat/orb/cipher, donation transaction controls,
Keeper structure-link easter egg, exclusive UI/helpers/tests, old demo assets,
and active app Keeper contract IDs/readiness dependency. Chain source and signed
on-chain history remain archival; no funds/caps/contracts were moved or revoked.
Shared `keeper.reapers.shop` RPC/index/telemetry/Origins/media routes stay intact.

Calendar: no built-in hackathon schedule. Exact reserved IDs are excluded when
loading older localStorage saves; user-created events are preserved unchanged.
Public empty state no longer claims an active public hackathon schedule.

Backend: reviewed route-retirement middleware in `services/agent-proxy` responds
410 before parsing old Keeper client requests. Shared proxy's pre-existing
Node24/better-sqlite3 Node22 ABI mismatch required a local native-module rebuild.
Do not stop the shared tunnel, indexer, Sui proxy, or embedding service.

Validation: TypeScript/Vite build; 55 remaining frontend tests (56 deleted
Keeper-only tests, two new calendar-retirement tests); three route policy tests;
independent review plus real Express integration against malformed JSON and
shared routes; desktop/mobile anonymous root, old Keeper/Cipher links, calendar
wallet-gate and Origins navigation; shipped-bundle retirement markers absent.
No wallet transaction/signing was tested or required. Evidence lives in workspace
`research/cradleos-removal-20261003/`. Node version repair and final live endpoint
status are recorded in the release receipt.

The required independent review passed. Requested Opus model was unavailable in
this runtime; an available native reviewer was used, not represented as Opus.

Next user request: research and properly refresh Game Data from current Cycle7
client sources; that is a separate follow-on release, not addressed by relabeling.
