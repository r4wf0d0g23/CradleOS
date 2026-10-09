# CradleOS UI simplification — October 9, 2026

## Scope
Raw’s standing direction: simple information, no explanatory UI narratives, across the product. Saved in workspace preferences and the repository’s UI_GUIDELINES.md / AGENTS.md.

- Compact activity disclosure: label/value rows, 30-day and UTC labels, sign-in coverage start, chain checked time, explicit unavailable/stale states. No telemetry or backend change.
- Removed recurring per-route tutorial briefs, casino promotional hero and repeated implementation/audit commentary. Simplified cycle strip, wallet states, storage, game data, recipes, donations, voting, tribe and defense panels.
- Preserved real article/lore/item content, decision-useful rules/paytables, data-source downloads, numerical outputs and controls.
- Critical consequences remain at the action: SSU revocation moves nothing and can strand existing/new shared stock; concurrent extension changes remain warned against; consent required. Donations remain irreversible/operator-controlled with no withdrawal/profit-sharing rights and existing pending-attempt guards.
- Source review corrected non-open voting status (including draft/scheduled), preserved mode2 turret NPC scope and bounded the transaction digest on narrow screens.
- Browser audit also found the existing narrow Intel kill-feed grid spilling beyond viewport. Table now has its own keyboard-focusable horizontal scroll region with readable columns. No filtering, row handler or RPC changes.
- No contracts, transaction builders, engines, balances, RNG, activity parsing, authentication, permissions or financial/quarantine gates changed. No chain writes, wallet signing, backend changes or testnet activation.

## Checks
- 356 existing tests in 37 files passed; TypeScript/build passed. Origins8 and approved IOC scan clean. Existing Vite chunk-size advisory remains.
- Independent inherited-model source review PASS, including short-consequence preservation and voting/turret status semantics. Native reviewer used available inherited model, not Opus.
- Real SSU component fixtures: owner/nonowner/frozen/foreign/none/read-error at320/390/1440. Owner filtering/search, preview, consent, cancel, separate capacities, collapse; other modes show no revocation. 18 grouped checks, no page errors, no icon failures,44px targets and no page overflow. Mocked read RPC only; no transaction execution implemented or invoked. See qa/browser.json.
- Public preview and production checks recorded separately below; fixture results do not claim authenticated production execution.

## Production-build preview
28 grouped checks at320/1440 passed: compact activity keyboard toggle and real read-only API values, no casino hero, concise cycle strip, donation gate/consequence text, all seven Game Data sections/source downloads, item search, recipe selection/quantity/planning, plus query/intel/defense/storage/voting/tribe/gates/origins/dapps routes. No page exceptions or local JS/CSS/PNG failures, no page overflow. Wallet-only routes verified their anonymous gate only. Popup measured156.5px high (previous screenshot showed a large narrative panel). Screenshots in qa/; qa/public-browser.json.

Browser-harness corrections: source download links are named semantically rather than “JSON”; recipe calculation requires explicit route selection. These were harness assumptions, not UI defects. Intel layout delta received independent source PASS and passed the final viewport run.

## Delivery
- Source a8ea7ecdc9929fab98910a0296ce5bccb0895bc1 pushed to cycle7-vestiges-20261002. Cloudflare Pages production2716f048, https://2716f048.cradleos-d75.pages.dev ; primary https://cradleos.io/. Previous frontend4235ec55.
- Both public bundles byte-match the reviewed dist: JSindex-Cv55xxQR.js SHA2560c863a35d8f168e4ff9fb626e27d02d621764bc9020dc56f050df6941940fb33; CSSindex-DZfTepD1.css SHA256134bef3a010aaad8267bbf549f08b3d47d8bf73360767b6c2fd9275b03f43044. See live-build.json.
- Actual anonymous production checks at320/1440: compact156.5px activity popup, real public count4 at verification time, label/value rows, keyboard collapse, no promotional hero, concise cycle strip, no page overflow or page errors or local bundle/icon failures. No mocked telemetry. See qa/live-browser.json. These two live checks are not presented as fresh repeats of all28 preview or18 SSU fixture checks.
- Intel mobile keyboard scroll also verified locally:272px region/680px contents, ArrowRight moves40px, document remains320px. qa/intel-scroll.json.
- Source runtime unchanged after build/commit. Uncommitted deployment-time files were QA receipts plus pre-existing Wrangler state; no uncommitted source delta. Temporary fixture entry points removed before finalbuild. No backend restart, wallet signing or on-chain action.

Final independent receipt review PASS: source/dist/public hash consistency,28preview/18fixture/2live scoping, Intel keyboard evidence and no wallet/chain/backend overclaims verified. Task-owned5207/5208servers stopped; canonical live-service worktree and pre-existing Wrangler state preserved.
