# Slot motion — independent public release gate

**PASS** for source `12886d252270ed77ebbe5d73441648c5c1020a77`, Pages `d589ed26`. Native inherited reviewer; no Opus claim. Read-only live-service checks using anonymous, isolated browser storage; no wallet connection, signature, donation, funding or transaction.

## Delivered identity

- Primary `https://cradleos.io` and immutable `https://d589ed26.cradleos-d75.pages.dev` both serve the expected JS/CSS bytes, identical to local production dist. Both HTML responses reference these bundles.
- JS `index-BhNxrfzD.js`: `b95507e59646b55d82ef91fc04ff47799fe5a8c772a63e2e75275bae16968f82`.
- CSS `index-CXtBMBo6.css`: `89e27397726b59bd453728ecc0eb42187410270217172975c64b0df2999d0f1a`.
- All nine presentation source/test files still match the independently approved corrected-source hashes. No source drift since the candidate gate.

## Independent320px touch / normal-motion check

- Fresh anonymous practice floor:33 games,9 slots; no development toolbar and no horizontal overflow.
- Actual unseeded production-RNG Scrapyard spin via touch: five strips move materially between100ms and450ms samples, settle to the exact saved first-frame grid, then unmount. Stake100 and payout0 (internal hundredths of play chips) were committed once before reveal; resulting balance999900. Cursor advances0→1 only; reload preserves the entire resulting saved state exactly.
- Explicit isolated **valid saved-receipt fixture**, Feral cascade: real preceding winning ghosts visible in the clear phase, fully transparent by the later falling sample; surviving/new cells have active vertical movement. Exact committed end-grid and one cursor advance; settled balance/history/sequence unchanged.
- Explicit isolated **valid saved-receipt fixture**, Gate: normal→reduced→normal gives5→0→0 strip windows, with final expanded state retained. Cursor advances1→2 once; reload preserves exact state. No replay/reroll or animation restart after cancellation.
- Settled Scrapyard and in-flight Feral screenshots were inspected. These remain genuinely distinct presentations; native symbols are readable on the compact view. No compositor-time scrubbing or forced random results was used in the public checks.

## Diagnostics / limits

Zero page exceptions. Console diagnostics include the existing DappKit no-objectID notice and Slush metadata CORS/failed-fetch messages; a third-party `keeper.reapers.shop/telemetry/combined` CORS failure also appeared. These did not interrupt any motion, saved-ledger or reload assertion. This report does **not** claim an empty browser console. Observed POST classification was Cloudflare analytics; no transaction execution/signing request occurred.

This bounded check does not repeat all eight games, wallet boundaries or the parent's broad asset matrix. Source economic/donation boundaries were independently confirmed unchanged at the candidate gate. Live findings above are independently exercised, not copied from parent QA.

## Evidence

- `live-hashes.json`: both-origin HTML/bundle checks.
- `live-motion.mjs` / `live-motion.json`: fresh public touch workflow, temporal samples, ledger assertions and diagnostics.
- `live-320-reels-moving.png`, `live-320-reels-settled.png`, `live-320-cascade-falling.png`.
- `corrected-source-hashes.json` and `implementation-review.md`: prior source gate and resolved M1–M3 evidence.
