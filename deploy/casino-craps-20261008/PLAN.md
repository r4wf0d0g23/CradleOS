# Frontier Craps — implementation / release plan

Raw requested an EVE Frontier themed craps table. Build a practice-only shipboard
dice table with existing Frontier art, orange/ivory instrumentation, chip targets,
an ON/OFF point puck and two independent physical dice. No testnet entry, contracts,
donation custody or wager activation changes. Current rollback: Pages 4900a6d9.

## Rules pinned 2026-10-08

Source: https://wizardofodds.com/games/craps/basics/ (Pass, Odds, Don't Pass,
Laying Odds, Place, Hard Ways, Working Bets, Field).
- Pass: come-out 7/11 wins 1:1, 2/3/12 loses; otherwise point before 7.
- Don't Pass: come-out 2/3 wins 1:1, 7/11 loses, 12 pushes; 7 before point.
- Pass odds capped at 3/4/5 times line on 4,10 / 5,9 / 6,8; pays 2:1 / 3:2 / 6:5.
- Don't odds risk up to 6 times line; pays 1:2 / 2:3 / 5:6.
- Field one roll: 3/4/9/10/11 pays 1:1, 2 pays 2:1, 12 pays 3:1.
- Place: 4/10 pays 9:5, 5/9 pays 7:5, 6/8 pays 7:6; 7 loses.
- Hardways: doubles 4/10 pays 7:1, doubles 6/8 pays 9:1; soft same total or 7 loses.
- Place/Hardways OFF on come-out (Atlantic City convention). Winning bets are
  returned with their winnings, not automatically rebet; losing bets removed.
  Other bets stay in escrow. The UI explicitly states this variant.
- No Come/Don't Come, Buy/Lay, hops or automatic rebet in this release.
- Fractional payouts forbidden: wager increments match exact integer-hundredths
  ratios. Chip panel shows the actual increment per spot. Aggregate escrow cap
  1,000 chips; odds additionally constrained by line. Pass locked after point;
  Don't removable, but its dependent odds must be removed together.

## Durable state / accounting

Optional Session.craps field in existing v2 wallet, old saves accepted unchanged.
No reinterpretation of instant Round schemas: craps owns a compact roll history.
Placement debits shared balance once; legal removal returns escrow once. Roll
credits gross returns of resolved bets only. Unresolved bets are never recharged.
Each immutable receipt includes before-point/bets and two checked uniform faces.
Pure evaluation recomputes result, payout, resolved stake and after-state.
Save outcome before animation; pending reveal prohibits all monetary actions and
navigation. Reload offers Reveal saved roll, never rerolls or credits again.
Only pending reveal locks all games. Between rolls user may leave table; its bets
remain saved and refill is disabled while escrow exists. Resume from lobby.
Receipt validation checks bounds, exact bet keys, points, increments, odds caps,
sequence order and pending after-state. Invalid v2 follows current fail-closed
practice reset with explicit notice (no stale rollback). Local chips not trusted
server-side and not redeemable.

## Review / acceptance

1. Independent architecture review before implementation milestone approval.
2. Exhaustive 36 dice pairs for line/field/point/odds/place/hardways, integer
   payout and multi-roll escrow conservation; legacy/reload/malformed tests.
3. Mobile 320/390 and desktop: readable point, tappable chips/targets, scroll
   without overflow, real UI roll and resume. Pending results/history/balance
   masked; storage failure doesn't mutate/charge; reduced motion and mute.
4. Existing full tests, production build, Origins 8 and IOC; targeted regressions
   of shared ledger and previously completed slot-run/BJ/scratch paths.
5. Independent source + browser review, publish exact reviewed source to sole
   app origin cradleos.io, compare live artifact hashes and exercise table.
6. Record release/rollback IDs, test evidence, memory. No wallet signatures/funds.
