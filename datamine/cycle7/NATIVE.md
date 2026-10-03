# Native cFSD reference export — build 3573151

The October 3 Carbon/Trinity proof established that the matching generated
Windows cFSD readers decode the current client schema without a game-server
process. This exporter is a separate, scoped implementation, not the rendering
spike merged into the app. It publishes no executable or raw client binaries.

## Coverage

- All 299 decoded blueprint definitions with exact input **and** output lists,
  primary type ID and unconverted `runTime`. Primary type need not be an output;
  multi-output recipes are not collapsed.
- 538 API items plus 28 additional recipe-linked types. Broader inherited client
  types are not promoted to live items. API-published and native-only provenance
  stay separate. Smart Turret84556 and Field Cairn93228 have no native type record
  in this snapshot; no client stats are fabricated for them.
- 455 linked types have raw dogma attributes, joined to 233 definitions. Units
  retain both internal names and localization labels. For example unit11 has
  label `m/sec` and internal name `Acceleration`; no conversion is inferred.
- 15 API/client field differences are retained (including whitespace/case name
  differences). API card values are not overwritten by native values.
- Recipe1627's 21Residue→75D1 matches official0.7.0.1. Recipe1181's208WaterIce input
  matches the patch;75D1 output is native evidence, not a patch-note claim.

Not verified: facility eligibility, facility/timing/skill modifiers, effective
fitted stats, live availability, or all model assemblies. The fitting
calculator remains historical. Game Data is a reference browser; the separate
Recipes tab now plans batches and ingredient routes from these base quantities,
without facility eligibility, production duration or gameplay-modifier claims.
No chain state, wallet, user profile, or live launcher cache changes.

## Reproduce

Prepared-host runtime/evidence root used for this release:
`/home/rawdata/.openclaw-captain/workspace/.tmp/openclaw-spikes/cycle7-native-correlation`.
Durable initial setup/render proof is under workspace
`research/cradleos-carbon-correlation-20261003/proof`.

1. Prepare a separate Windows Python3.12 runtime with matching client Python
   DLLs and seven readers. Copy manifest-verified tables to `data/*.fsdbinary`
   and reader modules to `runtime/`. Retain `inputs.json`, copied source
   manifests, official-types.json and official-types-proof.json. Do not change
   the installed authenticated launcher profile or live cache. Inputs are pinned
   by SHA-256 `95ded19b5f875f708cdf6cf9a8af8b2d9ce4da11c2d6190cf99388f04d01a7b0`.
   Future builds require explicit requalification, not disabling this check.
2. Copy this repository's `native_decode.py` to the prepared root. Execute using
   the matching Windows Python. On this host the reviewed `run.py` transport
   runs it with Wine/FEX, private profile and private X display, recording
   `last-run.json`, native stdout/stderr, and cleanup/input-hash status. This is
   process/profile separation, **not a filesystem/network security sandbox**.
   The native stdout binds the exact `native-decoded.json` hash. Schema mismatch
   guards are not patched out.
3. From this repository root:

   ```sh
   python3 datamine/cycle7/export_native.py \
     --evidence-root /path/to/prepared-root \
     --snapshot cradleos-dapp/public/data/game-data-cycle7-3573151
   python3 -m unittest discover -s datamine/cycle7 -p 'test_*.py'
   ```

   The publisher checks manifest/reader/table hashes, decoder identity,
   successful run/cleanup, raw result hash, exact API bytes and localization
   hash, then validates joins, finite values, unique IDs, quantities, schema
   fields and independent patch quantities. It writes `native-v1.json` and
   updates meta.json coverage/provenance. No archived fallback is used.

4. Review source, generated data, unit tests, browser desktop/mobile and negative
   cases before site publication. The UI enforces the same world/cycle/build
   namespace, preserves API cards when native data is unavailable, and supports
   retry after failure. Check live JS + JSON hashes after deployment.

The rendered Chumaq proof and partial Reiver render are research artifacts, not
gameplay scenes or production previews. No generated/illustrative model is used
in the Game Data browser.
