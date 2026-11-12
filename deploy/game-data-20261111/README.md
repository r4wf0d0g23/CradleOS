# Game Data mid-cycle refresh — LIVE

- Production: https://cradleos.io/#/gamedata
- Deployment ID: `5ac85279-7fc7-4e7c-99bd-d4763a9e5db7`
- Immutable deployment: https://5ac85279.cradleos-d75.pages.dev
- Deployed source: `59999aa687d2f9a1bc4bc6ccbde978df5ee5b095`
- Rollback: `0e772ead-5565-47ba-918b-dbe55257ee88` (November 8 ten-game Arcade).

## Scope

Current build 3693609 reference browser: 188 schemas, 185 traits, 215 properties,
768 reference items, optional full client catalog, current client text, patch notes
and downloadable provenance. Legacy planner and icon pack remain Historical
3573151. Native and API-only records remain distinct; continuous materials show
Variant mass/volume. No effective manufacturing simulation is claimed.
No chain, backend, wallet, inventory or game deployments changed.

## Verification

- 49 focused tests, 7 Origins tests, 8-check canon guard, exact-dApp IOC and build PASS.
- Preview at 1440/390/320px: all current sections, fields, lazy fetches, historical
  planner/icons, five HTTP 503/retry paths and wrong-build rejection PASS.
- Live at 1440/390/320px: item/schema/trait/property/event/patch/source browsing,
  historical labels and lazy-loading PASS; zero page errors and no card overflow.
- 15 SHA-256/size checks on production and 15 on immutable deployment match the
  reviewed build: application bundles, all nine current JSON files, retained
  historical native/icon data and system names. JSON MIME checked.
- Architecture and corrected implementation reviews PASS. Independent production
  review PASS: `postdeploy-review.md`. Reviewers are inherited native agents, not Opus.
- Desktop/mobile screenshots visually inspected; browser emulation, not physical-device testing.

Raw unit names and IDs are retained: 8000 Milliseconds is not 8000 seconds;
0.3 Absolute Percent is not 0.3%. Exact item names rank first; numeric searches
are exact IDs. Initial test failures (harness case sensitivity and search ranking)
were corrected before the final complete passing runs.

## Evidence

`tests.log`, `origins.log`, `ioc.log`, `build.log`, `preview-browser.json`,
`live-browser.json`, `live-assets.json`, `immutable-assets.json`, `review.json`,
deployment records and browser screenshots. Reproduction: `browser.mjs` and
`verify-assets.mjs` in this directory; data exporter docs in
`datamine/cycle7-midcycle/README.md`.

Native extraction evidence remains in workspace
`research/frontier-midcycle-20261111`; manifest/input hashes and the comparable
full-table baseline support the cumulative October-to-November changes.
