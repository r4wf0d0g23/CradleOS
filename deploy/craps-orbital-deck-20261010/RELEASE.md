# Orbital Frontier Craps — 2026-10-10

Raw requested authentic EVE Frontier artwork and a craps table floating in space.

## Delivered

- Original raised industrial deck: layered hull/rim, structural rails, metal betting pads and chips, planetary limb and sparse starfield. The table, dice and bets drift together as one rigid assembly; the chip console stays stationary. This is authored CSS scenery/motion, not a native game renderer or gravity simulation.
- Verified client-build3573151 Mini Gate type88086/graphic28064 native512 artwork, plus existing native Lai hull. `art-source.json` and `prepare-art.py` record exact input/output hashes and derivative. Only border-connected near-black backdrop removed; hull artwork preserved. Existing floor texture reused, not falsely claimed as verified native artwork. No new runtime dependency or WebGL requirement.
- Compact Drift control, independently persisted cosmetic preference. Effective owner motion setting controls the scene: Animated remains default even under OS reduction; System-reduced/Instant stop drift. Hidden/offscreen pause both cosmetic layers. Busy, hover, focus and explicit pointer-down tracking pause the table at its current pose. Pointer-ID set supports multiple presses; release/cancel removes each, blur/hidden clears all. No preventDefault or input capture. Listeners and observer cleaned up on unmount.
- Existing decision-useful rules/paytables retained; redundant status/tutorial copy shortened. No new explanatory product prose.

## Boundaries

`boundaries.json`: 26 protected game-engine, RNG, accounting, casino/SSU gates, other-game renderers, dice pose/art and timing files byte-identical to baseline8bb5f66. Complete `CasinoCraps` owner logic before its outer render is exact, including roll/put/reveal, guard, timers and scroll target. No payouts, odds, session schema, escrow, settlement or chain changes; wager hold remains. No wallet signing/testnet action.

## Verification

- 400 tests /45 files PASS. TypeScript/Vite, Origins8 and canonical-directory approved IOC scan PASS; existing bundle warnings only.
- Source architecture review PASS. First implementation review caught the legacy OS-reduce `animation:none!important` conflict. Scoped animation identity and winning pause rules fixed it; targeted source review PASS. No animation restart on pause.
- `qa/final-preview-browser.json`: three fresh natural free Play Money rounds at320/390/1440 on the final pointer-pause build. Actual dice transforms, exact committed faces, unchanged roll history, responsive die support geometry, active-tray visibility and no overflow/page errors.
- `qa/final-scene-browser.json`: ten final-build groups: native-art load and actual default drift/pause/persistence, keyboard chip placement/removal and44px bet/control targets at320/390/1440; Instant, System+OS reduction, synthetic hidden, actual offscreen suspension via viewport resize, CDP touch press/release and cancellation, and engine-produced pending-roll reload/reveal. All ten PASS, with zero page errors or failed native assets. Unobstructed toolbar captures included.
- Raw touch-down exposed delayed CSS-only :active behavior; explicit pointer tracking fixed it. Focused independent source delta review PASS; actual touch/saved probes passed before the complete final run.
- Browser harness corrections: initial click/screenshot stabilization assumed stationary table; final probes physically hover to pause before clicking and screenshot the stationary wrapper. Fresh empty game selection is not persisted until gameplay; preference reload test explicitly reopens Craps. New empty ledger can be null; removal test uses the actual charged amount. Offscreen probe resizes to240px height to make the scene genuinely leave the viewport. These harness corrections do not change production code. Initial OS-motion failure report is retained. Pause-transform assertion waits for the compositor to latch the paused frame before sampling; no production change was needed for the subpixel one-frame sampling race.
- Scope: Chromium viewport and touch emulation, isolated browser-local non-redeemable Play Money. No physical-phone profiling or new listening/wallet/financial claims.

## Publication

Independent native submission gate PASS: three natural rounds plus ten final scene/lifecycle groups, unobstructed toolbar,26 protected files and native-art hashes reconcile. No remaining blockers. Publication pending.

Rollback: Pages697a44af / runtimee165ff1b867864f93cbd911d1fe3d6097a6dc2ae. Primary cradleos.io only; GitHub Pages redirect-only. Preserve canonical service-hosting worktree and unrelated Wrangler files. Task preview5229 will be stopped after live verification.
