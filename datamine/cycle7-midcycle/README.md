# Current Game Data — build 3693609

The Game Data tab uses the separately versioned currentGameData.ts contract and
schemaVersion2 JSON envelopes. The historical Recipes planner and icon pack
retain their original3573151 constants/files. Do not bump gameData.ts to publish
a new reference snapshot: it is also the legacy recipe/icon contract.

## Reproduce

From the repository root:

```sh
python3 datamine/cycle7-midcycle/export_game_data.py \
  --evidence /home/rawdata/.openclaw-captain/workspace/research/frontier-midcycle-20261111 \
  --out cradleos-dapp/public/data/game-data-cycle7-3693609 \
  --client-root '/home/rawdata/frontier-client/launcher/fex-linux/wineprefix/drive_c/CCP/EVE Frontier'
```

The evidence contains 70 hash/manifest-verified input files and 33 matching native
reader exports. An independent full-table3573151 export supplies the cumulative
type delta. Both native runs completed with unchanged inputs and cleanup; three
wrong-schema combinations rejected. The exporter verifies recorded input/output
hashes and the API response, and decodes the current manifest-bound event file
using the constrained event decoder. Raw proprietary binaries are not published.

## Published scope

- 768 reference entries: union of official API, schema links, property-bearing
  types, Creation references and added-to-baseline records. This is a convenience
  subset, not live-availability certification.
- All definitions: 33,092 native types plus2 API-only records. Native type0 remains.
- 188 schemas,185 traits,215 properties,9 facility catalogs; fractional and
  trait-only inputs preserve slot identity and complete trait constraints.
- Raw dogma attributes (internal unit names/IDs, never unverified display conversions), client text and63 internal event definitions. Large files
  load on demand; initial catalog is about281KB. Each file is below Pages25MB limit.
- November10–11 patch summaries through0.7.6.3, exact source URLs and provenance.

Absent bounds, units and native fields remain absent/null—not zero. Continuous
material mass/volume displays Variant. Other static mass/volume values are labeled
Base. Trait-only quantity units remain material-dependent. Durations are raw;
legacy conversion duration1 vs earlier3-second notes is not reconciled by guessing.
API values are separate from native values. Ship and construction IDs are never
merged by name. Current cards do not reuse unverified historical icons.

This is a read-only reference browser. It does not evaluate material variants,
yield/derived-stat formulas, run production, alter chain state, or migrate the
historical standalone planner. Rule tables are available as JSON for research.

## Gates

Tests: currentGameData.test.ts plus retained gameData/recipePlanner/gameIcons tests.
Required Origins guard, exact-dApp approved IOC scan and TypeScript/Vite build.
Browser checks cover desktop/390/320px, schema/material/trait search, range details,
API-only items, lazy large data, sources/events/historical surfaces, HTTP failure
and retry, and wrong-build rejection. Publish only from PRIMARY_DEPLOY.md's current
checkout; verify live bundle and every new data file against the reviewed dist.
