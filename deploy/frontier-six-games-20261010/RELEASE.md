# Six Frontier games — October 10, 2026

Status: prepublish source, visual and evidence gate PASS; production deployment pending.

## Delivered scope
Six new **Play Money** games on the existing casino floor:
- Reactor Remainder: four-way ore sorter/Fan-Tan, actual groups of four.
- Derelict Broker: 12 sealed cargo cases, conditional-mean offers, keep/swap finish.
- Command Hold’em: staged ante/blind/play decisions and full best-five-of-seven settlement.
- Wing Command: no-joker Pai Gow variant, five-card main/two-card escort, click/tap/drag or auto-arrange.
- Gate Runner: four equal-probability Lai-class competitors, win/place betting and committed finishing order.
- Salvage Pusher: fixed-cost token drops, deterministic disc collisions, persistent inventory and physical front-lip collection.

Rules and exact variants are in DESIGN.md and each game’s decision-useful rules/paytable. Pusher has no fixed RTP claim. Broker cargo mean is not an optimal-strategy RTP claim. Whole-chip/money accounting remains integer hundredths with down-rounding of fractional returns.

## State and boundaries
Optional version1 Frontier transcript/history on the existing v2 tab-local practice save, sharing chip balance. Stake, random draw and legal action are saved before presentation. Terminal payouts credit exactly once after reveal. Reload resumes paid rounds without resampling or recharging; hidden-tab interruption leaves an explicit saved-round reveal. Every mutation checks round ID and action revision. Parked craps reserve and future Hold’em affordability remain accounted for. Legacy blackjack reconstruction and restore retain new optional state.

Web catalog expands34→40. Retired physical station catalog stays34; no geometry or station activation. No chain/contract, wallet, authentication, real-money/testnet wagering activation or SSU-quarantine changes. No dependencies added.

## Artwork and interaction
Original industrial panels/machinery, existing verified native Frontier item icons, top-down Lai and Mini Gate. All racers are expressly Lai-class callsigns, not four falsely labeled hulls. Native artwork provenance stays in existing Lai/craps/card releases; no newly generated game asset claimed. Existing animated-default preference, explicit System/Instant and opt-in sound retained.

## Verification
- 434 tests /47 files PASS; TypeScript and production build PASS; Origins8 and repository IOC scan PASS.
- Independent architecture/source gate and final source-delta/visual/evidence gate PASS. Initial review findings (early reveal, coercible race IDs, token-counter exhaustion) corrected before publication.
- `qa/final-preview-games.json`:18 complete game/viewport groups at320,390,1440 on the pre-delta candidate, including pending reloads at320, chip conservation, exact committed outcomes and card/cargo concealment.
- `qa/delta-preview-games.json`:6 fresh final pusher/Wing complete rounds at320/390/1440 after fixed-precision replay and drag/hit-test changes. Other four game runtime logic unchanged by that delta.
- `qa/pusher-cross-runtime.json`:9 exact Node/Chromium physical replay comparisons (full tray plus collected/missed token IDs).
- `qa/release-boundaries.json`:17 final groups PASS: royal/tie/fold/Wing showdown, Broker keep/swap, Instant/System, hidden/resume, resize, storage failure, keyboard/double-submit, desktop drag/click, chute hit mapping320/1440, touch assignment and legacy blackjack preserving the Frontier save. Viewports/touch are Chromium emulation, not physical-phone certification.
- Exploratory failed/mixed-build runs are debugging artifacts, not counted as release evidence.

## Deployment
Primary application origin only: https://cradleos.io/#/casino
Previous rollback: source e8f4a26c98120e26f7d33d111867a95817f32985 / Cloudflare Pages2b5f5744.
Source commit, deployment ID and live hashes pending.
