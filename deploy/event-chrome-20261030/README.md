# Event-log chrome cleanup — 2026-10-30

Raw screenshot request: repeated Current labels are clutter. Healthy source-status row removed entirely; only source-specific Stale/Unavailable states appear, with the existing freshness logic. No duplicate generic failure paragraph. Refresh/Search labels shortened; Loaded appears once for events/jumps/unique-pilot counts. History marker remains concise; unknown counts remain em dash, names/unsupported warnings retained. Network label/provenance/content preserved. Chronological latest8/15min ticker, identity gold/gray and pause remain unchanged.

UI-only two-file change; no unit tests added for label/render cleanup. TypeScript/build, Origins8, scoped IOC and real-data browser checks cover healthy/failure/retained-stale/recovery/history/mobile/desktop states. Independent native review required (not Opus). No readers, contracts, wallet handlers, backend or player-state change.

Rollback: Pages9e1a427e/source1ae7a0f49fc2d85f923d67eec374ce13bb1b37b1.

Preview PASS: six real-data scenario groups with explicit all/partial source failures, freshness expiry/recovery, history and390/1440px. No page errors or writes. TypeScript/Vite, Origins8 and IOC guards PASS. First preview attempt raced the ongoing build and returned HTTP failure; rerun after confirmed build completion passed, no application change needed.
