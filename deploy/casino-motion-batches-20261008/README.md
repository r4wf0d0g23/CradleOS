# Finite slot runs and outcome-faithful table motion

All nine Play Money slots support 1, 3, 5 or 10-spin runs. The selected unit stake stays fixed, the full maximum cost is displayed before Start, and each spin is charged only when it begins. Pause/Stop remain available while animating. Stopping cancels future spins, not the current paid outcome. Hidden tabs, reloads and earned bonus entry pause further spending; ordinary cascades can finish within the paid spin. No infinite mode, increased stakes, automatic top-up or loss-chasing behavior.

The nine-game one-spin engines, payout tables, RNG, existing bonus/motion engines and non-slot outcome engines are unchanged. Optional validated v2 metadata records paid versus revealed counts; legacy saves remain accepted. New games clear completed run metadata. Scheduler generations and latest sequence/cursor checks reject stale continuation. Failed writes stop the run before a new UI result, and failed Stop still disables the scheduler immediately.

## Non-slot animation upgrades

- Shared parent-owned timeline: no motion restart on reduced/normal reversal or hidden-tab return; bounded event-specific opt-in audio.
- Roulette: equal-width outcome sectors, counter-rotating ball and pocket landing, immutable settled-wager highlights. Three wheel themes retain exact stop multipliers.
- Physical two-sided coin toss and six-faced dice with actual final faces, per-die impacts, distinct cage/threshold/total presentation.
- Blackjack: staged seat/dealer dealing, hidden hole-card flip and dealer draws; split repositions the affected hand without re-dealing other seats. Baccarat alternates draws; Three-Card Poker highlights contributing cards; duels use opposing lanes; Andar keeps bounded lane stacks; Red Dog shows the revealed rank window.
- Keno: scanner, sequential draw strip and live match counters per ticket, one shared draw/clock. Distinct Crash flight/target crossing, Limbo gate, signal capsules and refinery stages.
- Plinko retains the reviewed peg-contact paths, with individual landings, ball colors and bucket counts.
- Scratch reveals persist as cosmetic indices; aggregate/history feedback stays behind the same reveal boundary. No re-cover or feedback replay on restore. The last losing ticket does not celebrate a previously revealed win. Reveal-all emits one fresh aggregate cue.

## Scope retained

Practice-only. Existing testnet wagering HOLD, 23-table catalogue, seed-only donations, contracts, wallets and custody unchanged. All 92 current casino artwork hashes preserved. No replacement media or dependency installation.

## Verification

See PLAN.md, implementation-review.md, candidate-review.md and VALIDATION.md. Independent native inherited review used; the configured Opus route is unavailable, and no Opus review is claimed. Browser evidence is Chromium desktop/touch emulation and Web Audio scheduling, not physical-device performance or acoustic testing.

Rollback: previous Pages deployment `4c8cbbda`, runtime `f222d32e13c141620817fe86b4a85e1f7e5ca507`. Only cradleos.io is published; GitHub Pages redirect remains untouched.
