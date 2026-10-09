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
Pending publication and live verification.
