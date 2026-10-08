# Paying-hit feedback — October 8

Raw clarified that a paying hit should feel satisfying even if the whole round
returns less than its bet. Preserve transparent accounting while separating hit
feedback from whole-round victory.

## Scope

- Positive returns at/below bet: short, distinct two-note payout receipt cue,
  replacing the old downbeat loss cue. Above-bet return keeps existing win cue;
  zero keeps loss cue. Mute/opt-in/background teardown unchanged.
- Finite payout-value highlight on an actively revealed positive result. Exact
  payout shown immediately; no invented increment or delayed accounting.
- Fresh successful user-triggered settlement owns an ephemeral event. Never
  replay on restored mount, navigation back, next-bet edits, disclosure opens,
  hidden→visible or reduced→normal. Event never enters saved ledger.
- Actual free-spin frame award>0 uses the short payout cue; unpaid stages do not.
  Existing bonus fanfare, cascade/hold sounds and symbol highlights retained.
- Keep Payout + exact Total bet, truthful partial/bet-return labels and accounting
  detail; don't relabel a below-bet round as a profitable round.
- Practice only. No paid activation, changed odds/RNG/receipt/balance/bet,
  animation-driven money changes, autoplay or added prompts.

## Acceptance and release

Verify zero/partial/equal/win cue mapping; audible cue remains short/bounded.
Check real active reveal versus silent/still reload; rapid clicks, navigation,
input/disclosures, reduced motion and visibility must not replay a paid event.
Confirm exact aggregate pack/blackjack stakes, no future bonus disclosure and
unchanged bonus experience. Mobile320/390 +desktop1440; build/tests/Origins/IOC,
independent architecture/source/live gates, primary-only deploy and hash proof.

Baseline runtime77c4b00 / Pages0c1d38f9; receipt branch9361269. Native inherited
reviewer used because the AGENTS-requested Opus is not available in native tools.
