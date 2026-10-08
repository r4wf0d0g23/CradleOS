# Production-preview candidate review

**PASS after the compact run-panel grid fix.** Independent inherited native reviewer; not Opus. Preview: `http://127.0.0.1:5296/#/casino`. This report supplements the source/accounting review; it is not a public deployment attestation.

## Actual independent checks

- Touch Chromium at **844×390 normal motion, 320×568 normal motion, and 320×568 reduced motion**.
- Valid committed classic fixture: covered restore, explicit reveal, Resume, Pause, Resume and Stop. Controls were successfully tapped in each viewport. Pausing/stopping prevented further debits; no outcome or balance recalculation.
- Three-ticket Scratch fixture: Reveal all reachable; exact balance and opened tickets survive reload.
- Three-seat Blackjack fixture: Split and Stand reachable; split deducts exactly one original stake and retains four hands.
- No horizontal document overflow or page exceptions in these flows. Actual screenshot inspection supplements—not just relies on—overflow checks.
- Served JS and CSS exactly match local production `dist`; exact paths, hashes, sizes and control rectangles are in `candidate-review.json`.

## Narrow-layout correction

Initial functional checks passed but screenshot inspection found a real new layout defect: `.casino-spin-run` occupied only one column of the existing phone console grid, stretching the adjacent saved-spin button to **100×371px**. The author added full-column compact rules for the panel, saved reveal CTA, feature controls, totals and explanation. Independently rechecked: saved-spin CTA is now **244×48px**, the panel fits, and controls remain reachable. Before/after evidence: `candidate-320-pending-classic-before-grid-fix.png` and `candidate-320-pending-classic.png`.

The compact font specificity was then corrected. Final computed-style/screenshot recheck confirms both run buttons are **105×44px with 11px text**, and the saved-spin CTA remains **244×48px**. No remaining layout finding. This final CSS-only adjustment received a focused style/hash/screenshot check, not a redundant full interaction rerun.

Final served bundle identities (exact `dist` matches):

- `assets/index-B8DkMLsr.js`: `417435f9db9c45e19f882c9bfd16385b984a972218778432122f31306b64aae5` (JS bytes unchanged).
- `assets/index-Y1UkcxVh.css`: `d071e545cf69ff99c97ace50d328b6369b169890819f0e44514e8fccfd088289`.

## Evidence and limits

`candidate-review.mjs`, `candidate-review.json`, candidate screenshots and `reviewed-source-hashes.json`. The first harness timeout measured a button after its successful click removed it; the probe now measures before the click and completed successfully. It was not an application failure.

Fixtures were installed only in isolated browser session storage. No wallet connection, signature, donation, testnet wager or external state mutation occurred. Browsers were closed; the parent's preview service was left running. No runtime files were edited by the reviewer. This was a bounded candidate smoke, not a repeat of the parent's all-game suite or a comprehensive assistive-technology audit.
