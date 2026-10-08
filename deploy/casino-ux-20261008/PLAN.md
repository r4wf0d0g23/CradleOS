# Casino UX research and implementation — 2026-10-08

Request: review casino psychology and remove clutter such as prominently displayed “Net”.
Baseline: source 0633348 / runtime bd3156ca / production 230071f3.

## Findings and decisions

1. **Progressive disclosure reduces competing information.** Nielsen Norman Group's
   [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
   recommends primary-task controls first, with secondary detail on request.
   Apply to accounting receipts/history, not to hiding the price of play.
2. **Recognition and consistent language beat repeated interpretation.** Keep a
   stable Payout / Bet hierarchy, clear units, and the current balance. Avoid making
   players interpret an unlabeled signed amount as a payout.
3. **Audio/visual salience can distort recall.** Myles et al. (2023),
   [DOI 10.1016/j.abrep.2023.100500](https://doi.org/10.1016/j.abrep.2023.100500),
   randomized 940 people to simulated-play videos. Both had 2 genuine wins;
   participants shown 3 additional losses disguised as wins estimated 3.02 genuine
   wins versus 2.14 in control (d=.44). This is an outcome-perception experiment,
   not evidence that these changes improve our retention or satisfaction.
   Full indexed abstract verified through Europe PMC (PMID 38169673); the direct
   PMC/PubMed HTML fetch yielded a challenge and was not treated as a full-text read.
4. **Celebrate actual features, not a misleading profit.** Preserve earned bonus
   announcements, optional fanfares and deliberate next-spin controls. Primary
   results distinguish a return below the bet, a returned bet and a genuine win.
   No near-miss manipulation, loss-chasing prompts, autoplay, fake scarcity or
   invented player activity.
5. **Regulated cash casinos are a separate scope.** UKGC
   [RTS 14F](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-14-responsible-product-design)
   prohibits celebrating returns at/below the stake; its
   [RTS 2E](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-2-displaying-transactions)
   requires session net-position display for applicable casino products.
   These are design benchmarks, NOT a claim of jurisdictional applicability or
   compliance. This release changes nonredeemable local practice presentation;
   testnet wagering remains HOLD. Do not apply a hidden-accounting policy to a
   future regulated-money launch; that requires its own review.

## Implementation

- Replace the prominent per-round “Net” with Payout and adjacent exact Bet.
- Use short truthful status: Win / Bet returned / Partial return / No payout.
- Round details retain exact signed balance change and outcome explanation.
- Recent rounds become a keyboard/touch-accessible disclosure, with Bet/Payout
  instead of dominant signed gain/loss tiles; each row retains full details.
- Consolidate individual multi-play receipts into the history disclosure.
- Omit pending feature receipts entirely, not just inside a closed disclosure.
  Audit found opening the existing pack receipt could reveal the future total.
- Remove the redundant per-stage total row after a fleet feature is complete;
  preserve pending revealed-stage totals and bonus totals/counters.
- In optional measured-odds detail, rename “net profit” to “payout above bet”.
- Leave staged testnet UI/custody untouched; it is not playable in this release.

## Acceptance / deployment

- Presentation only: economic sources, immutable ledger/receipt schemas, RNG,
  payout tables, timing/audio/bonus modules, assets and funding boundaries frozen.
- Check zero/partial/equal/win results, batch total bet, history details, mutable
  next-bet input not changing prior-round amount, pending/no-future-disclosure,
  keyboard disclosure, reload, rapid clicks and mobile 320/390 plus desktop1440.
- Existing bonus/reduced-motion/accounting checks; TypeScript, full tests,
  Origins guard, IOC, production build. Independent architecture/source/live review.
- Publish primary only per PRIMARY_DEPLOY.md, verify reviewed bytes and live UI,
  record source/deployment/rollback. No chain, wallet, odds or donation changes.

Review note: AGENTS requests Opus milestone review. That model is not exposed by
the native reviewer tools; use the existing inherited-model independent reviewer
and do not describe it as Opus.

## Audit follow-up outside the active practice floor

The quarantined/testnet presentation is not a validated production-money casino.
`InstantGamePanel.tsx` still contains legacy result labels based on `payout > 0`
and signed `payout - wager` amounts, including a possible “WIN +negative” label
for a sub-stake payout. Its final audio already compares payout with wager.
`CasinoPanel.tsx` retains old signed Blackjack result badges. Those files are
byte-preserved in this practice-only release, not silently represented as fixed.
Correct/verify them together with the already-required replacement contract,
funding/liability and jurisdictional review before any testnet/cash activation.
The active practice floor now classifies outcomes on the exact total bet.
