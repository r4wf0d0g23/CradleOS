# Salvage Wheel winch — 2026-10-10

Raw requested a more interactive and realistic Salvage Wheel.

## Delivered

- Salvage-only winch scene: braced gunmetal housing, worn rotor, 54 physical pegs, bearing hub, nine-tooth counter-rotating drive gear (6:1 ratio), spring-loaded pointer and restrained settled sector illumination. Actual 54 uniform engine pockets and their order retained:24zero,18at1.1×,8at1.2×,3at1.6×,1at18×.
- Hub Spin button displays the current stake. Pull handle supports deliberate downward drag/release, tap and keyboard; both invoke the unchanged owner `act()` path. Short/sideways/upward/cancelled/lost-capture/hidden gestures do not spin. Synchronous owner busyRef prevents duplicate commitments across hub, handle and existing Play. Secondary pointers ignored; pointerup uses final coordinates. Inspection buttons never wager: they highlight/count the five payout categories, overriding the old-result outline while active, and clear/disable during motion.
- Starts from the prior committed wheel pose; motor take-up, brief drive and monotonic frictional coast end exactly at the committed sector. Pure integrated angular trajectory, not a rigid-body simulation. Half-boundary peg-crossing times drive damped pointer responses and original quiet opt-in tick cues. Existing cue hook may drop same-frame/late audio events; not every peg is claimed audible. All54→54 transitions, repeated indices and saved results retain exact alignment.
- Only money_wheel owner duration changes2800→4500ms (4400visual). No extra animation timer. Animated default, explicit System/Instant, hidden-tab cancellation and saved reload behavior retained. Compact ready/passing/recovered/sector data; no explanatory product prose.

## Boundaries

`boundaries.json`:24 protected engine, RNG/payout/session, financial/SSU, prior dice/card/ship, timeline and other-wheel files byte-identical to688af25. Exact reverse delta proves CasinoExperience changed only callback/stake prop wiring and shared duration changed only money_wheel. Other three wheel mechanisms are unchanged. No dependencies/assets, contract/backend/wallet changes, schema changes or financial activation. New spin interaction exists only where the practice owner supplies its action; absent callbacks disable the scene controls.

## Verification

- Final functional source400tests/45files PASS. Six new tests cover all54outcome payouts/restore, all2916previous→next endpoints/continuity, monotonic acceleration/coast/rest, peg contacts/pointer settling, outcome concealment and Salvage-only duration.
- Native architecture/source review identified gesture and inspection defects:fixed2D maximum movement, missing pointerdown x initializer, final pointerup displacement, and inspection overriding settled highlight. Initial typed build correctly rejected missing x; a prematurely launched browser run against the older dist reproduced the already identified stale highlight (partial report retained). Corrected typed build and full suite then passed before the complete browser run.
- `qa/final-preview-browser.json`:28 completed final-JS groups. Hub+pull natural spins, category inspection and44px targets at320/390/1440; six short/sideways/upward/cancel/lost/hidden gestures; keyboard-after-cancel, rapid hub+lever+Play single commit, release-coordinate-only input; five engine-produced saved payout outcomes; Instant/System-reduced/hidden/resize/reload. Actual rotor/pointer samples, previous-pose continuity, no early committed highlight, exact final index/payout, correct category counts and unchanged ledger. Zero page errors. Fixtures are browser-local free Play Money; no RNG override or fixture hooks shipped.
- `qa/touch-browser.json`:four additional boundaries PASS:invalid stake no debit, secondary pointer ignored, browser touch-emulated pull commits one spin at changed10-chip stake, keyboard Enter hub activation. Not physical-phone testing.
- `qa/audio-browser.json`:opt-in actual Web Audio680/1523Hz detent scheduling and muted replay with no scheduled notes PASS. Listening not claimed.
- Visual review caught inherited desktop padding wrapping PULL; scoped padding/grid centering/nowrap fixed. Runtime JS byte-identical after CSS-only correction (`label-delta.json`). Three fresh final-CSS label/active-framing/pull checks at320/390/1440 PASS (`qa/label-browser.json`); prior28+4groups are correctly attributed to the same JS before this label-only adjustment, not falsely claimed rerun.
- TypeScript/Vite, Origins8, exact approved canonical IOC scan, event-query preflight and git diff check PASS. Existing chunk-size/dynamic-import warnings only. Scope:Chromium viewport/touch emulation, browser-local practice, no wallet or testnet execution.

## Publication

Published to primary https://cradleos.io/#/casino (Salvage Wheel).

- Runtime/source `e165ff1b867864f93cbd911d1fe3d6097a6dc2ae`, pushed to `cycle7-vestiges-20261002`.
- Cloudflare Pages production `697a44af`: https://697a44af.cradleos-d75.pages.dev
- `live-build.json`: both production bundles match the reviewed local build byte-for-byte.
  - JS `index-D7am5hk1.js`: SHA256 `738e53599529bc720983ed6ef9ce14d1f8c06588a2c20b63aafeba0de7fef341`.
  - CSS `index-BMFznalb.css`: SHA256 `4e89074d61756ab5a05116af9b927b3eb9e0f4759b06f03d484c351f73114e6f`.

`qa/live-browser.json`: six fresh primary-origin groups PASS at 390/1440: four natural free Play Money rounds (hub and deliberate pull at each width), plus two inspection/44px-target groups. Actual forward rotation and reactive pointer, previous-pose continuity, concealed committed highlight while active, exact result-sector/payout landing and unchanged committed ledger verified. Zero page errors or overflow. No RNG overrides, saved-result injection, wallet, testnet or global-state changes in this live pass. Lifecycle, emulated touch, keyboard and audio proofs above remain preview-only; not presented as fresh live tests.

Task-owned preview port 5228 stopped and port closure verified. Unrelated Wrangler files and the canonical index-service worktree preserved.

Independent native final delivery gate PASS: runtime, Pages, rollback and both production bundle hashes reconcile; all 24 protected files unchanged; preview port closed. Four live natural rounds and two inspection groups are accurately scoped separately from preview lifecycle/touch/audio checks. Live screenshots confirm corrected handle and exact landing. No remaining blockers.

Rollback:Pages68a3ab00 / runtimee746f9e452b1ff470265104e178b446d2c95c3f9. Canonical source worktree hosts live index service and is preserved; unrelated Wrangler files preserved. Primary cradleos.io only; GitHub Pages redirect-only.

Independent native submission gate PASS: desktop PULL contained/centered;3fresh CSS checks,28runtime groups,4input boundaries andaudio proof accurately separated; runtimeJS unchanged by label correction;24protected files and gesture/inspection fixes verified. No blockers.
