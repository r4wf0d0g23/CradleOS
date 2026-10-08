# Casino play-options implementation and deployment plan

Raw: “Build plan and execute” following the five recommended upgrades. Deliver all five on the25-game **Play Money** floor; keep existing $EVE seeding and wager/security boundaries intact. This does not activate insecure contracts, move seeded funds or introduce real-time multiplayer Crash/new financial protocols from the audit's later research wave.

## State and accounting architecture

A version2 tab-local session wraps the existing single-game ledger, preserving balances/history and unfinished version1 blackjack hands. Retain the old key as a rollback snapshot; write version2 only when a new action commits. Atomic `sessionStorage.setItem` precedes UI state and animation. Every instant batch is fully settled in one update; animation/scratching reveals immutable results only. Reload displays the same receipt, never redraws or debits. Any active old or new blackjack hand blocks new rounds, donations, refill and game changes. No background/autoplay bets.

1. **Plinko:**1/3/5/10 balls, Classic/Low/Medium/High exact source tables, unit stake×count shown. Each ball retains12 committed bits and payout; shared board animates staggered paths with genuine peg contacts. Per-ball and total receipts; reduced motion lands immediately.
2. **Roulette:** one shared single-zero spin, editable wager chips for straight/color/parity/range/dozen/column; remove/undo/clear/repeat selections without auto-betting. Combined stake and per-selection return. Zero loses all outside bets. New inside geometries deferred because not part of supported six kinds.
3. **Keno:**1–4 editable tickets,1–6 unique numbers each, individual stakes, quick-pick, shared ten-number draw without replacement. Each ticket uses the existing exact hypergeometric paytable and rounding. Tickets saved per tab; no mandatory data reset.
4. **Blackjack:**1–3 seats, one52-card shoe, one dealer S17. Initial natural checks before decisions, player blackjack3:2, regular wins1:1, pushes return stake. One split per original seat; no resplit, split aces receive exactly one card, split21 not natural; double initial unsplit hand only. Dealer natural beats split21 (splits only available after peek). Each action debits its additional stake atomically. Sequential active hand highlighted; all hands settled once together. Persist full local shoe (safe for free chips only), cursor, dealt cards, seat lineage, active index and exact stakes. Maximum6 final hands; no insurance/side bets.
5. **Scratch:**1/3/5 immutable tickets; actual touch/mouse scratch reveal, keyboard-accessible reveal ticket/all, honors reduced motion, ticket-level result and total. Reveal progress cosmetic; cannot alter payout. Reload may reveal settled receipts directly rather than force a second scratch.

Shared finite manual packs may reuse infrastructure for existing instant games where rules are unchanged; not required to ship new rule variants. No infinite autoplay, stake progression or automatic refills. Total and unit stakes explicit; per-unit maximum1,000chips and each batch must be affordable from opening balance, not borrowed from future wins.

## Acceptance and gates

- Deterministic/exhaustive payout tests: all4096Plinko paths across4profiles; all37roulette outcomes for6kinds/multiple selections; shared Keno draw and independent ticket payouts; fixed blackjack shoes for natural/split/aces/double/dealer/bust plus full-shoe consistency; scratch outcomes do not reroll.
- Reject invalid counts, choices, duplicate numbers, insufficient aggregate funds, corrupt saves/cursors/card duplication, repeated actions after settle, numeric overflow. State inputs never mutated; legacy active hand resumes under its original rules.
- Browser normal-motion multi-ball peg/path/payout checks; mobile320/390/844 anddesktop1440 controls, shared draw, active-hand focus, reload mid-hand/batch, pointer/keyboard scratch, storage failure/double-click and mode/refill locks.
- Independent architecture/source/UI reviews; inherited native reviewer because requested Opus is not available in current runtime. No unsupported review-model claim.
-205 baseline tests plus new tests; TypeScript/build, Origins8, IOC; preserve43artwork hashes. Fix inherited staged Blackjack fixed-deck/footer claim to match fresh-draw contract without editing contract logic.
- Publish reviewed source to primary Cloudflare Pages only (rollback9909b62f), verify exact primary/immutable assets and real mobile interactions. No funded wallet action or contract publish.
