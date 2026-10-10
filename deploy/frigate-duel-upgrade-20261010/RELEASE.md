# Frigate Duel — one-on-one engagement, 2026-10-10

Raw requested upgraded Frigate Duel animations.

## Delivered

- One Dragon frigate and one Tiger frigate, distinct from Fleet Duel's three-ship wings. Native Lai hulls coast along fixed opposing diagonal velocities, with headings aligned to the hull's verified +X nose. No continuous exhaust pretending to accelerate a constant-speed ship.
- Shared metallic cards, single-frigate card art, in-place concealed flips and readable Dragon/Tiger labels. Both ranks fully reveal before combat. No outcome-dependent DOM/decoration before both reveals.
- Paired aimed volleys: bolts leave transformed muzzle points on straight fixed-speed paths and intersect the actual moving hull-front position. Brief muzzle flashes and shield responses track their ships.
- Higher-rank ship alone fires the decisive salvo. The losing hull fragments in place, preserving both inherited velocity components and its original orientation. Equal ranks leave both ships intact in a standoff. Combat winner derives from committed rank comparison, never the player's bet or payout.
- Finite effects finish before resolution. One existing owner clock, Dragon/Tiger only2000→4300ms (visual4200ms); no extra timer. Existing Animated default, explicit System/Instant, hidden/reload behavior retained. Short labels/status only.

## Preserved boundaries

No new asset files, dependencies, RNG, odds, wager rules, payouts, ledger/schema, wallet/chain/backend behavior or financial/SSU gates. Actual engine draws distinct physical cards, allowing equal ranks. Dragon/Tiger side win2×, tiebet9×, tied sidebet rounded½return remain unchanged.

Twenty-one protected engine, shared card, Fleet Duel, Warp, Probability, Lai, timeline and art files are byte-identical to runtime8198298 (`boundaries.json`). Exact reverse-delta confirms only Dragon/Tiger's duration changes in the common motion library. RoundStage integration adds one scene route and removes Dragon/Tiger from generic card cues; other games unaffected. Legacy gated testnet Dragon/Tiger stage is outside this change.

## Verification

- 389 tests /43files PASS. Five meaningful new tests cover all169rank pairs across3bet choices (including odd-unit half rounding), direct payout/restore comparisons, heading/velocity consistency, fragment continuity, transformed projectile intercepts, preflip identical DOM, settled effect cleanup and duration boundaries.
- Independent native architecture/source review PASS. Source review caught equal-specificity card sizing overridden by generic CSS; fixed by sizing the scoped slot and filling it. CSS delta and final320px visuals PASS.
- TypeScript/Vite build, Origins8 and approved exact canonical IOC scanner PASS. Wrong-package-ID event query search clean.
- 22 completed preview groups:3fresh natural rounds at320/390/1440;9isolated crypto-fixture actual-engine Dragon/Tiger/tie playbacks across those widths;2extra390px winning Tiger/tie bet cases with2×/9×checks;3engine-produced saved outcomes;5Instant/System-reduced/synthetic-hidden/resize/reload cases. Actual RAF samples verify rank masks, ship/bolt motion, shield contacts, loser-only fragmentation, intact ties, clean settlement, stable committed ledger and contained card/stage geometry. Zero page errors or failed hull assets. `qa/preview-browser.json` combines two explicitly labeled batches.
- Initial saved-snapshot harness sampled framing before page scroll settled; corrected saved/reload inspection centers the scene and waits250ms. No runtime code change. Fourteen completed playback checks were retained; eight saved/lifecycle checks reran successfully. Partial report remains available, not falsely claimed wholly successful.
- Parent inspected phone sequence and desktop resolved states. Browser scope is Chromium viewport emulation and browser-local free Play Money; fixture RNG exists only in isolated browser tests. No test flag or RNG override shipped. Audio listening, physical devices and wallet/testnet execution are not claimed.

## Publication

- Runtime `78686dc92c59c15503ce710a2218a3f1e2711a8b`, committed/pushed.
- Pages `f16bacd3`; immutable https://f16bacd3.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino → Frigate Duel.
- JS `index-ljVWicg0.js`: `6e0a2514e6afe0e0ae34007708349563e73de756fa351f4fabbc41e7bc280be1`.
- CSS `index-DdIlwGAp.css`: `37ec51f6910d975bfd517f7eb3695d8cc78d0c8e5888a3ef9b2298ebc0d4dd7d`.
- Production JS, CSS and native Lai WebP exactly match reviewed dist;3files in `live-build.json`. Eight fresh natural-RNG live rounds PASS:6at390 and2at1440, both Dragon and Tiger wins at each width. Actual masked reveal, ship/bolt/shield motion, loser-only breakup, exact final ranks, responsive containment and stable committed ledger; zero page errors or failed hull assets. `qa/live-browser.json`. Ties, selected-bet fixtures and saved/lifecycle proofs remain preview-only, not claimed as fresh live cases.
- Task-owned preview5226 stopped; port verified closed. Canonical service-hosting worktree and unrelated Wrangler directories preserved.
- Rollback Pages `a4bf4e75` / runtime `8198298fc6563a88c4d193921d772e1ebaab6d82`. Primary cradleos.io only; GitHub Pages redirect-only.

Independent native submission-ready gate PASS:22checks reconcile as14playback+8saved/lifecycle;389tests43files,21protectedfiles and exact duration-only reverse delta verified. Desktop Dragon/Tiger/tie captures and mobile sequences readable/unclipped, correct loser-only breakup. No blockers.

Final independent native delivery gate PASS: runtime/Pages/rollback,3exacthashes,21protectedfiles,Dragon/Tiger-onlyduration,389tests43files,22scopedpreviewgroups and8freshlive rounds reconcile. Both winners covered at each live width; inspected captures readable/outcome-correct. Preview5226 closed. No blockers. Evidence-only receipt, no runtime changes.
