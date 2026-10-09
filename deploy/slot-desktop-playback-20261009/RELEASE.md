# Desktop slot playback — October 9, 2026

## Report and reproduction
Raw reports desktop slots flashing immediately to the endpoint while mobile completes motion. The specific desktop browser/OS preference remains unconfirmed; a clarification was requested but is not required to provide an explicit playback choice.

Actual current production Chromium with traditional scrollbars (not Playwright's hidden scrollbar default): normal1440x900 and1920x1080 desktop and390x844 mobile all show about2.06s of continuous Scrapyard reel travel/staggered stops. Same1440desktop with OS reduced-motion emulated reproduces instant results: about40ms/3active frames and no reel overlays. No resize cancellation occurred in these baseline probes. This establishes one reproducing condition, not proof of Raw’s exact desktop configuration. qa/reproduction.json.

A second concrete defect exists in classic Salvage Reels independently of the OS setting: movement CSS targeted direct child div elements, but current ItemIcon renders an img (or span fallback). Live normal-motion proof shows timeline progress0.097→0.256 and changing --roll-y values but transform:none for all icons. Corrected selector to .game-icon so actual current icons receive travel. qa/classic-before.json. This defect affects the classic slot across form factors; do not claim it exclusively explains desktop/mobile differences.

## Implementation
- Compact practice-slot-only **Reels: System / Animated / Instant** control. System is the default and displays the effective OS mode. Animated explicitly opts into full finite reel playback; Instant chooses the existing quick reveal.
- Choice uses validated cosmetic localStorage key cradleos:casino:slot-motion:v1, separate from session/accounting. Invalid/unavailable reads fall back to System; failed preference writes do not block play. No migration/reset of existing game state.
- One effective reduced flag drives both existing parent reveal deadlines and renderer. Classic reels pass a narrowly scoped opt-in past the timeline's initial and change-event OS checks. Other games and testnet remain on their original OS behavior.
- Only four slot WAAPI layers are restored under explicit opt-in: reels, cascade ghosts, gate sweeps and vault shutters. No global/ambient/bonus animation or audio-preference override. Hidden/resize cancellation stays sticky for the current generation.
- Control disabled while busy/autoplay, with synchronous busyRef/autoRef handler guards. It does not alter outcomes, odds, ledger, schema, entropy, slot choreography constants, authentication or transactions. Casino financial HOLD/SSU quarantine unchanged; no chain/backend changes or wallet signatures.

## Review/checks
Independent inherited-model architecture and initial four-file source reviews PASS. 356existingtests/37files, TypeScript/build, Origins8 and approved exact-directory IOC scan pass. Classic one-line selector delta independently reviewed PASS (actual IMG and span fallback matched; moving reels only). Existing Vite chunk-size advisory unchanged. Browser and delivery results below.

## Final production-build preview
26 grouped checks pass: all8fleet saved-frame scenarios plus classic slots at1440 OS-reduced+Animated and390 normal+Animated. Actual changing reel/cascade/Vault scan transforms and visible Gate sweeps recorded; classic actual IMG transforms now move (not merely timeline progress). Exact saved endpoint/cursor, frame data and ledger preserved. System reduced/Instant normal modes; sticky hidden/resize cancellation; explicit opt-in surviving OS change; saved-spin reload; non-slot OS behavior; invalid preference fallback and failed cosmetic storage write with a real fresh RNG spin all pass. No page exceptions or local JS/CSS/PNG failures. Preference survives reload and controls stay disabled during motion. qa/preview-browser.json.

## Delivery
- Source e3a09ec55b0092b904be61bc6b614748ea685b94 pushed. Cloudflare Pages production07611d3e (https://07611d3e.cradleos-d75.pages.dev), primary https://cradleos.io/#/casino. Previous frontend2716f048.
- Both live bundles exactly match reviewed dist: JSindex-51c0s8C0.js SHA256b8e6892650805bbe8c50c28649ca0f5e7b06b15532a79eac7b4c1a7fdbc249f4; CSSindex-VOoReneF.css SHA256edb190a0e101d0ea6794f723048f7a53e2f50722642efa70bd56008a30867499. live-build.json.
- Seven actual production browser groups: desktop1440 OS-reduced+Animated on Scrapyard/Reactor/Vault/Gatecrash/classic; mobile390 normal+Animated on Scrapyard/classic. Actual visible transforms (including classic icons), shutters, gate sweep and cascade motion verified; exact saved endpoints, one cursor, unchanged balance/result data and preference/reload preservation. No page exceptions, local JS/CSS/PNG failures or page overflow. qa/live-browser.json.
- Live Play Money checks use isolated browser-tab state, engine-produced deterministic saved fixtures and actual fresh classic RNG spins. No account, user wallet, testnet, chain or server-state mutation. No claim of physical-phone FPS or identifying Raw’s unconfirmed OS setting. The26 preview lifecycle groups are not represented as26 fresh live runs.
- Six boundary source files (engines/session/math/choreography) byte-identical to previous release; unchanged-boundaries.json. No source drift after final build. Uncommitted deploy-time files were QA receipts and pre-existing Wrangler state, not runtime source changes.

Final independent delivery gate PASS: source/hash/boundary consistency,26preview versus7live counts, baseline/fixed actual classic icon transforms, fleet motion and conditional OS reproduction accurately scoped. Task-owned5210preview stopped; canonical live-index worktree and pre-existing Wrangler directories retained.
