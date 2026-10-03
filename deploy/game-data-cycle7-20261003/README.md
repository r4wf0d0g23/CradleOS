# Current-cycle Game Data refresh — 2026-10-03

User requested research and a proper refresh, not an archive relabel.

- 538 official Stillness API item types with genuine type IDs, category/group,
  descriptions and reported mass/volume. One unnamed row is explicitly unnamed.
- 151,879 readable English client strings from 253,325 total. IDs correctly called
  localization message IDs; 99,679 numeric placeholders and empty strings excluded.
- 63 client event definitions decoded from current hash-verified eventtypes.static.
- Source-linked Cycle 7 patch changes through 0.7.1.0, including September 30 fuel
  hotfix and October 1 Debris/Network Node updates. Official GitHub heads checked.
- Versioned snapshot path, metadata world/cycle/build gate, explicit coverage and
  provenance download. No old dataset or 3D stand-in presented as current data.
- Full crafting/combat binaries remain undecoded. Industry/fitting historical
  notices remain; this release does not claim those calculators were refreshed.

Authoritative client build 3573151. Generation/tests described in
`datamine/cycle7/README.md`. Research evidence is workspace
`research/cradleos-gamedata-20261003/`. Frontend/backend chain services and the
previous Keeper/calendar removal are preserved. No signing/funds/contract changes.

Build/tests/independent review and live verification are recorded in release.json
when complete. Working branch cycle7-vestiges-20261002, VITE_BASE=/, Pages project
cradleos, production branch main. Do not delete this worktree; it hosts the live indexer.

Pre-publication checks passed: 58 frontend tests, 5 extraction tests, TypeScript
and Vite build, independent source/extraction review, desktop (1440px) and mobile
(390px) browser workflows. Wrong-cycle metadata fails closed; failed data fetch
recovers on Retry. Browser checks found no page errors or retired data requests.
