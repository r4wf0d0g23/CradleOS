# Probability Drive — exact landing, 2026-10-10

## Correction

The previous fixed 987-modulo sweep approached 88 for every round, then swapped to the actual roll at completion. The new bounded continuous scan progressively captures the committed roll, lands at 92% of the unchanged visual clock and holds. The number is the rounded needle position; both finish on the exact committed integer. All 100 legal outcomes converge without a terminal jump.

Calibration ticks, threshold and needle share a single 1–100 coordinate map and track width. Labels are centered on their true marks, including 1 and 100. No explanatory UI, new controls or dependencies.

The owner deadline remains 2,400 ms; visual clock remains 2,300 ms. Landing at 2,116 ms leaves 284 ms before unlock. RNG, odds, payouts, ledger, session schema and gates are unchanged. Ten-file byte-identity boundary proof against previous runtime e357cda: `boundaries.json`. No wallet/chain/backend activity. Saved dice records do not include target/side; they show their committed roll without inventing a historical target.

## Verification

- Independent native source review PASS: exact continuous convergence, bounded synchronized needle/readout, common scale coordinates, unchanged owner and financial boundaries.
- 377 tests / 41 files PASS. Three new tests cover all100 results, 301 samples per result and shared scale mapping.
- TypeScript/Vite production build PASS, Origins 8 checks PASS, approved IOC scan CLEAN in exact canonical dApp directory.
- Production preview: 14 browser groups PASS — three fresh natural draws at 320/390/1440; six engine-produced saved edge cases (1/50/100 at320/1440); Instant, reduced System, hidden cancellation, resize and reload.
- Actual RAF samples verify continuous movement, number/needle synchronization, tick/threshold/needle rendered centers within0.65px, exact early landing/hold, final receipt equality, visible framing and no overflow. Default Animated still animates under OS reduced-motion at1440. No page errors or extra session/balance mutations.
- Parent visually inspected mobile endpoint100 and desktop66 landing screenshots; markers align with results, readouts and labels fit. `qa/preview-browser.json` and helper preserve evidence; local PNGs ignored.
- Browser scope: viewport-emulated Chromium and isolated browser-local free Play Money, not physical devices or wallet/testnet execution. Hidden case synthetically dispatches visibility change.

## Publication

- Runtime `68eb4f2893f53d7336923a9d8e3b674b77150c62`, committed and pushed.
- Pages `937079b0`; immutable https://937079b0.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino → Probability Drive.
- Two live bundles exactly match reviewed dist (`live-build.json`). JS `index-1FLsWE5-.js`: `ef504dd4deee7e323005508f27de383b6095b8b6509c7e01613136bd93868791`; CSS `index-dW_6h-aK.css`: `60ee85050ffa10ef74947f56a099b5162b78588da621f9b7761c329d56acfbc4`.
- Two fresh live natural draws at390/1440 PASS (rolls14/13): continuous sweep, exact early landing and hold, aligned scale, unchanged committed ledger and no errors. Saved edge/lifecycle proofs remain preview-only, not claimed as fresh live cases.
- Preview5222 stopped; port verified closed. Canonical worktree, live index service and unrelated Wrangler directories preserved.
- Rollback Pages `a585128e` / runtime `e357cda8b6b888f5b6497855bdc6cfad63796621`. Primary origin only; GitHub Pages redirect-only. No wallet/chain/backend/gate changes.

Final independent native delivery gate PASS: source/deployment/rollback, 377tests/41files, 14preview versus2freshlive, two exact hashes, ten unchanged boundaries, actual screenshots and closed preview5222 reconcile with no discrepancies. This receipt update changes no runtime files.
