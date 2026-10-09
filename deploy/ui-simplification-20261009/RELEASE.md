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
Pending publication and production verification.
