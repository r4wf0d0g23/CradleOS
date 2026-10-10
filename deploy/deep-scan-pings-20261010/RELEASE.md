# Deep Scan — result-location pings, 2026-10-10

Raw requested scan pings at the locations of the results.

## Change

The unrelated horizontal sweep is replaced by two expanding/fading rings inside each revealed number cell. Mint returns and dark-amber rings on gold matches remain legible. Exact cell anchoring replaces approximate overlay match circles; the existing selected-number constellation and draw order stay intact. No new copy or controls.

The existing draw clock reveals each number and starts its ping together. Each pulse lasts 0.92 of one draw interval; the last ends around 3,077 ms, before the unchanged 3,200 ms owner deadline. No new timers or CSS keyframes. Saved/settled, Instant, reduced System and hidden-cancelled runs emit no pings; Animated stays the default.

Engine, RNG, odds, paytables, balances, persistence, wallet/chain and financial/SSU gates are untouched. The quarantined legacy testnet renderer is unchanged.

## Verification

- Independent native source review PASS: no early results, responsive cell centers, final-ping completion, cancellation/lifecycle suppression, no accounting or other-game changes.
- 60 targeted tests in three existing engine/timeline files PASS. TypeScript/Vite production build, 8 Origins checks and exact-directory approved IOC scan PASS.
- Nine production-preview groups PASS: natural draws at 320/390/1440 (all ten pings individually verified for location, correct reveal timing, radius growth and fade), plus Instant, reduced System, hidden cancellation, resize, reload and shared-ticket switching. Animated on OS-reduced desktop remains animated.
- Preview evidence includes both matched and unmatched pings. Parent inspected the actual mobile motion screenshot. No page errors, early results, overflow or extra balance mutation.
- Scope: viewport-emulated Chromium, fresh natural RNG, isolated browser-local Play Money. No physical-device, audio-listening or wallet/testnet execution claim.

## Publication

- Runtime source `8f71c67f37a9a1eecfda55cc4f0ca1b9fab2cde9`, committed and pushed.
- Pages `99895f55`, immutable https://99895f55.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino → Deep Scan.
- Two live bundle hashes exactly match reviewed dist (live-build.json).
- JS `index-DU7i-1FF.js`: `012d13a8dfe3f53c1c9461edaa619339e462cbc5abbc100db0cd78e8e33bf9d9`.
- CSS `index-DwgPBx6M.css`: `677550b0cb41a4d0816dfa34cf5822fbf7b24ac5a6e3338f8fdd862403cb8ae6`.
- Two fresh live natural-draw checks at 390/1440 PASS, individually checking all ten chronological pings for exact centers, actual expansion/fade and completion. Zero page errors, no overflow or extra ledger mutations. Preview lifecycle cases are not presented as fresh live tests.
- Task preview 5220 stopped and port verified closed. Canonical worktree and unrelated Wrangler directories preserved.
- Rollback Pages `0d725d71` / runtime `d2d6885d8173674446177f3d41672d62ab4e3478`. Only the primary app origin changed; GitHub Pages remains redirect-only.

Final independent native delivery review PASS: source/Pages/rollback, nine preview versus two live groups, two exact bundle hashes, unchanged protected files, honest scope and closed preview port reconcile. Live motion screenshot confirms centered ping. No blockers.
