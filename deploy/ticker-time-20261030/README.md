# Latest-only chronological ticker — 2026-10-30

Raw request1565803393119686697: ticker goes forward in time, latest events only. Select newest eight eligible highlights, then display each batch oldest to newest. Window15minutes (previous24hours). Both chain-recorded time and occurrence time, when present, must be within the window and not future. Old backfilled reports remain in full log, not headlines. Source freshness/history suppression and notable-event eligibility remain unchanged. Full log remains newest-first and still supports older pages. Continuous ticker loop, pause/reduced-motion and identity contrast retained; order increases within a batch, then normal loop repeats. Added semantic times and record IDs for provenance/testing.

31 targeted event tests PASS, including shuffled selection, newest-eight cutoff, non-mutating log order, 15-minute boundary, backfilled/future exclusions. TypeScript/build, Origins8 and scoped IOC scan required. Independent native source review PASS (not Opus), production/browser evidence recorded alongside release. No chain/backend/player-state change.

Rollback: Pages7483fcc2/source351fb31e39099ff09cf30ba310cedc9a33be322f.

Checks PASS: 31 targeted tests, Origins8, approved scoped IOC scan, TypeScript/Vite build. Preview four scenario groups on real chain data; chronological/top-eight selection tested with shuffled twelve-record unit fixture. Live preview had one eligible recent highlight at check time. Fresh-index/old-event simulation correctly clears ticker without clearing log. 390/1440px, pause, highlight click and refresh recovery checked; zero page errors/writes.
