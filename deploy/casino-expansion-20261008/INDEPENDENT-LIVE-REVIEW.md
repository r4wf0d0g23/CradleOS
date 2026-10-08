# Independent live casino expansion gate

2026-10-08. **PASS for the practice-only frontend deployment.** No remaining release blocker found in this bounded independent live check. Current-contract funding/activation HOLD remains unchanged; this is not on-chain game or financial security approval.

- Reviewed source: `b02ca5a1975521ee5a2efbe09e7b1f3e9dd926b2`.
- Pages deployment: `105a5fc4`.
- Public browser tested: https://cradleos.io/#/casino .
- Immutable assets checked: https://105a5fc4.cradleos-d75.pages.dev/ .
- Inherited native reviewer, not Opus. No runtime/source edits, deployments, wallets, signatures, bets with testnet funds or funding actions.

## Independent delivery checks

All four independent fetches (two assets on production and immutable) returned 200 and matched expected and local reviewed build SHA256:

- `assets/index-DPo35JVe.js`: `e0df19fc77dd9494b6b07c83c17b7f4b5ff4cb7ca8bbb99d4569de05cf70c6f7`.
- `assets/index-DGn-09B_.css`: `aa0c60adf02321117ddff88fc53558755674847fcf66782bca62a74cbc9832c8`.

Evidence: `live-hashes.py`, `live-hashes.json`. Parent's broader asset sweep is separate, not claimed as independently repeated here.

## Actual public mobile checks

Fresh isolated Chromium browser, 320×780 touch viewport, normal motion; ordinary UI taps and local practice session only. No writable QA fixture used for this public run.

- All **25 practice games** present; no development toolbar; no horizontal page overflow.
- Banker Baccarat normal animation shows progressive covered/revealed cards. Final rendered values equal the committed round. Independently calculated scores Player 0 / Banker 4 match the visible cards and 12.34-chip stake returns **24.06 chips**, rounded down correctly. Balance matches debit plus payout.
- New card ranks remain clearly readable, measured **13.55:1** against the cream card face; public screenshot visually inspected.
- High-risk wheel moved through three distinct sampled rotations. Final indexed sector aligns geometrically with pointer and committed result; independently derived payout agrees. Controls disabled while resolving.
- Reload preserved exactly the same two-round ledger, sequence and balance; no reroll/debit duplication.
- **23 staged testnet tables** present; Hi-Lo, Baccarat, Scratch Cards, Mines, Dragon Tower and Video Poker absent. A remaining wheel preview displayed a disabled wager button without wallet connection.
- No page exceptions. Observed POSTs were Cloudflare analytics and read-only GraphQL/JSON-RPC queries (`suix_queryEvents`, `sui_getObject`); no financial execution or mutation requests observed.

Evidence: `live-browser.mjs`, `live-browser.json`, `live-320-baccarat.png`, `live-320-wheel.png`.

## Explicit limitations and diagnostics

This public browser run hit a **GraphQL preflight CORS failure** from `graphql.testnet.sui.io`. The status panel truthfully displayed **“Testnet status unavailable / Unable to verify the house. No wagers enabled.”** Its fail-closed behavior passed. This reviewer did **not** independently verify the current paused/bank state through that failed lookup; no claim that the house was successfully read is made.

The console also contained the documented baseline DappKit SmartObjectProvider missing-object-ID and Slush metadata CORS/ERR_FAILED diagnostics. GraphQL CORS is recorded separately rather than mislabeled as baseline or hidden behind an “all console clean” claim. Practice rounds were unaffected. No on-chain RNG, payouts, package fixes or financial activation were tested.
