# Shared shell independent review — 2026-11-08

Native inherited-model review; requested Opus is unavailable. Review-only, no source edits or deployment.

## Initial findings — publication blocked

1. **Scrapline controls overflow the viewport.** At320×568 the six-button control rail forces550px document width, clipping the board and header actions. At568×320 the vertical rail overflows upward across Pause and below the viewport; Start Wave is offscreen. Actual Pause tap is intercepted by the Cutter button. Use a bounded responsive grid/scroll rail and retest preinteraction bounds, center hit targets and natural scrolling.
2. **Keyboard activation of held primary controls fails.** The window keydown handler returns for Space on a button, while the button's detail-zero click invokes `mod.action()`. Wreck Runner and Feral Circuit implement held controls through `input.action`, with no-op `action()`. With Fire focused,350ms Space leaves ammo8; with canvas focused it drops to5. With Boost focused heat remains0; canvas focused reaches14.28. Wire focused primary keydown/up to held state and clear on blur/cancel.
3. **Touch brake parity needs resolution.** Feral Circuit's planned throttle/brake/heat decisions currently have only a Boost touch button; `i.down` braking is keyboard-only. Add a touch Brake hold action or explicitly revise the touch design/rules with equivalent control.

## Verified so far

- All eight pages load and start without script errors at320portrait and568landscape.
- Fifteen complete start/pause/resume cases pass. Sixteenth is blocked specifically by Scrapline's overflowing rail over Pause.
- Pause freezes simulation; deliberate Resume restores it. Two rotation probes preserve state and pause/freeze correctly.
- Independent source review confirms user-gesture audio, simulation-clock-driven visual/cue progression, safe fixed-timestep bounds, no remote runtime API, no iframe/wallet/transaction surface, local assets, fixed known catalog strings, restrictive self-only CSP, denied-storage fallback, game-specific record keys and terminal `awarded` guard.
- Read-only snapshot serializes copies; no live writable state reference is exposed.
- Pure storage probe confirms one game's save cannot overwrite another's; lower scores retain best; malformed JSON defaults safely.

## Evidence

- `shell-review.mjs`, `shell-review.json`:16 attempted compact route/lifecycle cases,15 complete before real Scrapline Pause interception; screenshots `shell-<game>-<width>.png`.
- `shell-input-review.mjs/json`: actual focused-button versus focused-canvas keyboard comparisons and pause-on-rotation checks.
- `shell-record-review.mjs/json`: terminal/once-only awards, retry and blocked-storage behavior (result pending at initial write).

Do not treat these partial checks as a final publication PASS. Parent owns complete engine pilots, full live deployment proof and final integration review.

## First correction retest

- Responsive rail fix:16/16 compact start/pause/resume cases now pass; no horizontal overflow, no header interception. Landscape Start Wave is below the rail's initial scroll view and becomes reachable after native scroll.
- Focused held input fix: actual350ms Space on focused Fire reduces ammo8→5, and focused Boost raises heat0→14.7; release clears held input. Canvas-focused controls still work; rotation still pauses/preserves state.
- Added touch Brake resolves the initial missing-control parity concern by source inspection; touch behavior will be checked with final controls.
- Terminal test: natural no-input Signal Diver loss after55simulation seconds displays the terminal menu, writes plays1 exactly once despite another5seconds, and Retry resets the award latch. Repeated with denied localStorage: game still runs, shows `Record not saved`, Retry succeeds. Zero errors. Cross-game record isolation/corrupt record tests pass.

## Additional concrete findings

4. **Scrolling the economic control rail performs unintended actions.** Real native touch swipe starting on POWER in568×320 buys a generator before moving the rail: cash180→100, generator1, scrollTop34. Start Wave becomes visible and owns its center hit target afterward. Nonheld action buttons must activate on click/released tap after browser scroll cancellation, not pointerdown. Held Fire/Boost controls may retain pointerdown semantics. `shell-scroll-review.json` is the exact reproduction.
5. **Scrolling world draws outside fixed square viewport.** `shell-play-contact.png` shows Wreck Runner's platforms and enemies rendered into the upper/lower letterbox outside the720-unit board. Add a shared saved canvas clip around each game's render, restoring afterward. This preserves the intended fixed-square visual boundary.

## Early-play visual inspection

`play-<game>.png` and `shell-play-contact.png` show all eight real390px early-play sessions using ordinary inputs, no injected game state. Distinct compositions/readable cues: tether anchors/cargo; armor bricks/paddle; three rhythm lanes; shaft platforms; circuit track/checkpoints; three service bays; feral swarm; conveyor/plots/beams. Titles/HUD/control text is legible and palettes separate games. First dock service completes through real select/service input. No script errors. This is an interface/art review, not a human-balance certification or full campaign proof.

## Final shared-shell candidate — PASS

No remaining publication blockers in the reviewed shell scope.

-32 total layout/lifecycle cases pass: all8 games ×320×568,568×320,390×844,1440×960. Zero script errors or horizontal overflow. The landscape economic rail intentionally scrolls; actions no longer cover header controls, and the final action is reachable by an ordinary native swipe.
- Native rail swipe now preserves cash180 and generator0 while scrollTop becomes34 and Start Wave owns its center hit target. The follow-up ordinary Start Wave tap is checked in `shell-scroll-review.json`.
- Focused primary Space/Enter held semantics fixed; Fire/Boost respond and release clears input. Touch Brake now exists and actual press/release changes its held state.
- Real two-finger canvas movement plus Fire/Boost works; releasing the action finger leaves the movement finger active, and releasing that final finger clears movement. Actual fullscreen enter/exit pauses with held inputs cleared and deliberate Resume works.
- Shared canvas clip verified visually in `play-wreck-clipped.png`; offboard shaft machinery no longer bleeds into letterbox space.
- Natural Signal Diver terminal loss, once-only record, Retry and denied-storage behavior pass. Cross-game storage and corrupt-record fallbacks pass. Lobby320px shows eight actual game cards without overflow.

Evidence: `shell-review.json` (compact16), `shell-wide-review.json` (desktop/39016), `shell-input-review.json`, `shell-scroll-review.json`, `shell-final-review.json`, `shell-record-review.json`. Early-play art/screenshot review is separate from parent's full-campaign legal-input tests. No physical-device/human-balance claim.

Reviewed shared source SHA256:
- app.js:54ad4b142ce0cf4100f1c49d4ccb9c4d5522ee4098a3b6413e1300035340e87b
- style.css:cf33d3261bb99c7d0e10913624785465516b769a57da28d7eeec6e44ff1acabc
- profile.js:0910275311ce0139530e16af4a60b8481e78b09c4072aeefb4f6f51cb97e7c14
- catalog.js:1e7653d276bf6f609546b7864c769c79269ffb1485d6c3272979fa9da95ccbf8
