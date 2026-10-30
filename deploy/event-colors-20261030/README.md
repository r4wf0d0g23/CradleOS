# Event identity contrast — 2026-10-30

Requested by Raw (1565798648124801067). Identified names use warm gold #ffdc9b / weight600; unresolved numeric/address labels use muted gray #8b8d92 / weight400. Applied consistently to event sentences, expanded details and both ticker copies. Unknown objects remain readable/searchable; no filtering or disappearance. Names require the existing typed metadata compatibility check, not string matching. Shared structured sentence parts keep plain-text search and ticker timing intact; React renders names as text, never HTML.

Presentation only: no readers, metadata provenance, transaction handlers, event counts, contracts or permissions changed. Existing 29 event regressions, TypeScript/build, Origins8 and scoped IOC guard required. No new unit tests for this reversible presentation change; live browser checks cover colors, identity fallback, copy consistency, search and desktop/mobile layout. Independent native source and production reviews recorded (not Opus).

Prior production rollback: Pages5298055e, source24a7e08cf1e28d292cd510703b737bb18d0d37cf.

Release checks PASS: 29 existing event tests, TypeScript/Vite build, Origins8, scoped IOC clean; five real-data preview browser groups passed with no page errors or writes. Verified both identified and unresolved entities in log and ticker, details, search, 390/1440px layout and muted fallback after simulated metadata failure. Initial harness reload wrongly expected root navigation to persist; corrected test to reload the explicit event route, without application changes.
