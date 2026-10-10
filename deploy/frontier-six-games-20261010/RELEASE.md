# Six Frontier games — October 10, 2026

Status: published and verified. Independent final delivery receipt gate PASS.

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
Runtime source: **d72035c719c9e2b9bba96d93feed08440d13b65b** (pushed).
Cloudflare Pages production: **7384c7df**, https://7384c7df.cradleos-d75.pages.dev.
`live-build.json`:12 exact production artifacts: JS/CSS, icon manifest, native Lai top/Mini Gate and seven referenced item/card icons.
- JS `index-DjuyPs4q.js`: `eb1ad25d09670dbc83d42a6d2dc7e849d0cd0c2d62249297ba464334c6133021`
- CSS `index-CHKwYhjZ.css`: `b21a18693c231232babe3802132824fa73da7d6f63e1705b6382d6a848207e49`

Rollback note: the previous runtime predates the Frontier transcript extension. Prefer a forward fix; do not discard unfinished new-game practice rounds by reverting to a reader that does not understand them.

## Fresh production verification
- `qa/live-games.json`:12 actual public-app groups (six games ×320/1440), fresh practice random deals and actual pusher drops. Full legal play, pending reloads, committed-draw equality, exactly-once chip settlement, animations and responsive bounds PASS. No page errors or failed casino/icon assets.
- `qa/live-boundaries.json`:17 fresh production fixture/lifecycle groups PASS, matching the candidate cases above. Exact expected payouts for royal/tie/fold, final cargo decisions, dealer concealment, saved-round recovery, physical chute mapping, keyboard/touch/drag and existing blackjack interoperability. No page errors.
- Fixtures modify only their isolated browser tab’s Play Money save. No wallet signing, chain transactions, financial wagering, shared database/global-state mutation or real customer-funds testing.
- All12live file hashes remain the reviewed build. Final delta fixed comments only after verification; no untested runtime changes.

Final delivery gate PASS: source/Pages identity,12exactartifacts,12freshlivegamegroups,17freshliveboundarygroups and all prior verification scopes reconciled. Task-owned preview5230 stopped. No runtime changes after deployment; this receipt commit does not require redeployment.
