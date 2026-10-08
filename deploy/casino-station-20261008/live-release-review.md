# Independent live release review — 2026-10-08

## PASS — bounded published-app gate

Release: Pages `91253fe3`, reviewed source `3f2f4c1`. Actual `https://cradleos.io/#/casino-station`, fresh anonymous **390×844 touch** Chromium context. No route fulfillment, mocked transport, imported save fixture, wallet connection, signature or on-chain action. Native browser used the explicitly requested public relay mapping (`spark-2def.tail587192.ts.net` → `209.177.145.97`) so this check did not depend on MagicDNS reaching the private host.

### Verified independently

- Published JS and CSS exactly match reviewed candidate bytes:
  - `index-BpPvreTp.js`: `5defa0b3f1b3b952c8554e8673626216b283b8772c903a3b3d20c4f7634a86f5`.
  - `index-DIDRr4pu.css`: `a6f4583f99f93a25f9e01afc70f10e5e8957cfe21f78ec4d746752571451581e`.
- Real public WSS selected AV1, received multiple native frames, and displayed the authored casino interior at native960×540. Canvas sampling and inspected screenshot confirm rendered content, not a status-only assertion.
- Mobile Games directory → Craps → place a local Play Money Pass Line stake → return to native floor → reopen Craps. The saved practice ledger stayed byte-for-byte identical through floor return and game remount. Game view had one CasinoExperience; native floor had none.
- No horizontal overflow on native or game views; no exposed development toolbar detected.
- No JavaScript page exceptions and no financial submission requests. The only active console diagnostics were the previously documented SDK messages: SmartObjectProvider missing object ID and Slush wallet metadata CORS/fetch failure. This is **not** an all-console-clean claim.
- Reviewer browser/context closed. Subsequent gateway health was `ready:true`, `capacity:2`, `active:0`: no reviewer slot remains occupied.

### Evidence and limits

Machine evidence: `live-release-review.json`; probe: `review-probes/live-release.mjs`; inspected screenshot: `review-probes/live-native-mobile.png`.

This short smoke proves published-app/public-native integration and the mobile one-ledger handoff. It does not remeasure sustained capacity/latency, test the EVE embedded browser, or perform owner assignment or wallet-funded gameplay. Parent's broader two-browser movement, fullscreen and service qualification evidence remains separate. Existing testnet wagering HOLD and seed-only donation boundaries were not changed or exercised financially. No source, service, Tailscale or deployment configuration was modified by this reviewer.
