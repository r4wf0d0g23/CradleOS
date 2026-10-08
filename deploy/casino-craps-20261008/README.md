# Frontier Craps release

## Implemented

Practice-only Frontier shipboard table, two independent six-sided dice, ON/OFF
point puck, 1/5/25/100 chip selector, direct betting spots and take-down controls.
Pass/Don't Pass (bar12), 3-4-5x/6x odds, Field (2double/12triple), six Place numbers
and four Hardways. Side bets OFF on come-out; winning wagers return with payout,
no automatic rebet. Come/Don't Come, Buy/Lay and prop/hop bets not included.

Optional v2-session subledger preserves previous practice saves and balance.
Bet placement escrows once; unresolved bets carry unchanged; legal refunds once;
outcomes save before reveal. Pending rolls prohibit monetary actions and hide
future phase/bets/chips/dice/receipts. Reload explicitly reveals, never rerolls.
Players can leave between rolls; parked wagers resume from practice lobby. Refill
is blocked while stakes remain. Exact schemas, roll/phase continuity, integer
increments, odds limits and worst-gross-return headroom validated on restore.

No Move packages, game paytables, donation custody or testnet activation changed.
34 practice games / 23 staged testnet entries. The craps route/card/resume banner
exist only in practice. Local chips are not an authoritative or redeemable ledger.

## Evidence

- 306 Vitest tests /31 files, including14 new craps tests: all36 dice pairs across
  come-out and six points, odds/place/hardways, exact house-edge derivations,
  200 sequential rolls, cap protection, malformed saves and cross-game escrow.
- TypeScript + production build, Origins8 guard and exact-directory IOC pass.
- Parent13 production-preview browser checks: 320/390/844/1440 layouts, actual
  WebCrypto roll, rapidclicks, placement/removal/resume, pending before-state,
  store failures (placement/roll/reveal), Blackjack resume priority, point locking,
  sticky reduced-motion cancellation and testnet/donation isolation.
- Four existing saved-slot/auto-run/storage/testnet boundary regressions pass.
-9 protected outcome/custody files and92 artwork bytes unchanged.
- Independent architecture, implementation and small-phone review reports
  accompany this release. Review caught testnet resume-link leak, cap headroom,
  strict-save gaps, occupied-chip increment disclosure, and phone tray-scroll;
  fixes incorporated and rechecked before publication.

No wallet signatures, token spending or claims of new testnet readiness.
Existing mixed-import/large-chunk build warnings remain. Known wallet SDK metadata
warnings are not page exceptions; actual phone loudspeaker acoustics are unverified.

Source/rules: https://wizardofodds.com/games/craps/basics/ (read2026-10-08).
Parent browser harness and deterministic fixtures included. Detailed screenshots
and independent raw probes: workspace research/cradleos-casino-craps-20261008.

Production source, deployment and rollback IDs are in release.json after publish.
