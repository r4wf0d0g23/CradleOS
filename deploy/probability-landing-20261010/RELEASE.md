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
- Parent visually inspected mobile endpoint100 screenshot; marker lands under100, readout and labels fit. `qa/preview-browser.json` and helper preserve evidence; local PNGs ignored.
- Browser scope: viewport-emulated Chromium and isolated browser-local free Play Money, not physical devices or wallet/testnet execution. Hidden case synthetically dispatches visibility change.

## Publication

Pending reviewed build publication and fresh live checks. Rollback: Pages a585128e / runtime e357cda8b6b888f5b6497855bdc6cfad63796621. Primary https://cradleos.io/#/casino only; GitHub Pages is redirect-only.
