# Base-first dashboard — review

## Scope

UI-only replacement of the location/Hidden drilldown with a searchable directory of all owned Network Nodes. Existing native ownership reader, contract calls, transaction handlers and per-row guards are unchanged.

- Base titles retain custom names; unnamed nodes use their game item ID.
- Exact `energySourceId` attaches each child to its owned node across location groups.
- Empty/offline/unknown-location nodes remain represented. Unmatched children remain under Other structures / No visible network node.
- Location uses the node's own known system ID or Location unknown; it is never inferred from a child or from absence in an event archive.
- Search selects entire bases, preserving all sibling inputs for counts, power and stance/bulk actions.
- Existing object-ID collapse storage and wallet-keyed remount remain in place. Expand/collapse-all controls added.
- No contract publication, custody, server services or player state changes.

The separate retired location-event read path remains unchanged. This release removes misleading Hidden/unrevealed presentation; it does not claim full location coverage or identify the particular missing starter base without its item ID.

## Evidence

- 866/866 Vitest tests (70 files), including six grouping/search invariants.
- TypeScript and Stillness production build pass.
- Origins guard: 8 checks pass; npm IOC scanner clean for this exact dApp directory.
- Independent native reviewer: architecture and source PASS. No blocking issue; recommended concise orphan qualifier was included.
- Browser uses a synthetic read-only Wallet Standard address fixture with real public chain reads, not the player's actual authenticated session. Signing/execution throw; zero writes.
- Browser validates 6 bases, 27 structures (6 turrets / 2 storage), exact-child search retaining full base text/accounting, saved custom name and item-ID titles, no matches/clear, persisted collapse/reload, expand all, and disconnect cleanup.
- Desktop/narrow widths: 1440 / 650 / 390 / 320; no document overflow. Screenshots visually reviewed at 1440 and 390.

Previous runtime source: `3b81f24e40d94068306b10340cf2f95b1efe612d`.
Previous Cloudflare Pages deployment: `55757e91`.
