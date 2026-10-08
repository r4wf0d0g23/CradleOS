# Casino play-options independent architecture review

2026-10-08. Native inherited reviewer, not Opus. Runtime read-only. Reviewed `deploy/casino-play-options-20261008/PLAN.md`, current practice/expanded engines, Plinko motion, CasinoExperience commit/navigation lifecycle, and exact Move Plinko/Roulette payout constants. No wallet or chain write.

## Verdict

**Architecture is viable; proceed with the explicit invariants below.** This is not a candidate/source or publication PASS. No contract activation or new donation behavior is implied. The five requested option families are covered; future multiplayer/financial protocols remain correctly out of scope.

## Required corrections / clarification

1. **Migration must never resurrect the rollback snapshot.** Read/migrate v1 only when v2 is absent. Present-but-corrupt/unsupported v2 is a recovery/error condition, not permission to load a stale higher balance or old unfinished hand. Preserve the original v1 key unchanged. One v2 state must be authoritative and allow at most one active legacy hand or new multi-hand round. Strict legacy validation happens before wrapping; resumptions keep the original rules/deck/stake/cursor.
2. **Receipts contain frozen choices as well as outcomes.** Persist profile, per-unit stake, picks/roulette selection, committed bits/cards/draw, derived per-unit return and aggregate stake/return. Recompute validity from those inputs on restore; reject mismatched shared draws, payout sums or truncated packs. Do not use current form settings to render a prior receipt. Compute `sum(floor(unitStake*bps/10000))`, not a rounded aggregate. Legacy `Round` stake bound of `2*MAX_BET` cannot validate a legitimate 10-ball pack or six-hand settlement; use separate bounded receipt shapes rather than weakening all legacy checks.
3. **Plinko migration distinction:** existing practice `PLINKO_BPS` equals **Low**, not the 130× Classic array. Old history remains Low. Classic source center is **4851 bps**, despite its stale comment saying 4850. Exact pre-chip-rounding RTP from source arrays: Classic 96.001767578125%, Low 96.484375%, Medium 95.9814453125%, High 96.5185546875%. Use code constants/tests, not rounded source prose, for claims.
4. **Bound and canonicalize roulette drafts.** Six kinds have 49 unique legal choices (37 straight + 2 color + 2 parity + 2 range + 3 dozen + 3 column). Either coalesce repeated chips into a canonical selection with an explicit 1,000-chip selection cap or state/test another bounded policy. Define Undo as removing the last chip edit, not an already committed wager. Repeat copies a prior draft and requires explicit new Spin and fresh aggregate affordability. All selections share exactly one outcome. Zero loses outside bets, including even and column 3.
5. **No borrowing from pending wins.** Debit total opening seats/tickets/balls/selections before drawing. Multi-seat naturals and finished hands remain unpaid until one final shared-dealer settlement; otherwise an early natural could fund a later double or split. Every additional stake action rechecks the current uncommitted balance atomically. Pack affordability is not sequential play financed by an earlier unit's payout.

## Blackjack state/rule invariants

- Explicitly choose and document split eligibility (same rank vs all ten-valued cards); UI, action validation and restore must agree. Define deterministic multi-seat deal order and preserve stable seat/hand lineage through inserted split hands.
- One canonical 52-card permutation and cursor, no duplicated/omitted consumed cards. Dealt cards across dealer and all hands correspond exactly to the consumed prefix; stable draw indices/action provenance simplify strict reconstruction after split moves a card. Cursor alone and per-hand array lengths are insufficient validation.
- Original naturals only: dealer natural settles before decisions; player natural pays 3:2 unless dealer natural, then push. Split 21 is ordinary 21. Split aces receive exactly one card each and stand; no resplit. Double is initial two-card **unsplit** hand only, including affordability and already-doubled guard. Use integer floor for odd-cent 3:2 returns and disclose normal rounding.
- Active index always identifies the next actionable hand, skipping natural/21/bust/split-ace/completed hands. At most three original seats, six final hands and one split per original seat. Reject states claiming multiple simultaneously active indices, contradictory flags, or active dealer-natural rounds.
- Dealer S17 runs once after all decisions, not independently per seat. Exactly one receipt sequence increment and aggregate credit. No action succeeds after settlement. If all hands bust, define whether the dealer draws (either display policy is acceptable but must remain deterministic and not accidentally pay a busted hand).
- Full local shoe is inspectable by users: acceptable for nonredeemable practice, never call it a secure on-chain shuffled shoe or reuse it for testnet.

## Persistence and interaction gates

- Read latest ref; build a new immutable state; persist the single authoritative JSON before UI/animation. Storage write failure leaves balance, hand, cursor and receipt unchanged. Timer/reveal callbacks must never write captured older ledger snapshots. Guard duplicate pointer/keyboard submits synchronously.
- Unknown version/invalid data should report recovery explicitly, not silently refill. Bound receipt count, units, arrays, labels, sequence and every intermediate/product/sum to safe integers; no NaN/Infinity/fractional balances or permissive coercion.
- All new and legacy active hands block game/mode/donation/refill routes, including internal header/back and restore entry. Parent-app navigation may unmount the casino, but reload must restore the identical round and lock; no implicit settlement/redraw.
- Per-ball keys include immutable round identity plus unit index (refill may reuse numeric sequence). Multi-ball unlock/reveal deadline includes last stagger plus complete motion; normal/reduced motion, visibility changes and reload cannot reroll. Preserve current contact dwell and actual bucket alignment.
- Scratch reveals only already-committed outcomes. Pointer capture and touch-action restricted to the scratch area; pointercancel/unmount releases capture and normal page scroll survives. Keyboard ticket/all controls, readable focused state and reduced-motion reveal required. Cosmetic progress never writes back an older ledger. Reload may reveal the receipt directly as planned.
- Keno uses one ten-distinct-number draw for all 1–4 tickets, each 1–6 unique in-range picks. Duplicate/overlapping tickets are valid correlated selections if explicitly allowed, not independent draws. Quick-pick changes draft only. Saved ticket preferences never overwrite a concurrent hand/receipt.

## Required candidate probes

- Exhaust all 4096 Plinko paths for each exact table; test fractional unit stakes and per-ball rounding, max 10-ball total affordability, immutable legacy Low receipts and final stagger contact/payout.
- All 37 Roulette outcomes ×49 legal selections plus mixed board aggregate; canonical duplicate chips, Undo/Clear/Repeat and zero boundary behavior.
- Keno shared identical draw across overlapping tickets, independent per-ticket rounding, duplicate-pick rejection, aggregate insufficient funds despite a profitable first ticket.
- Deterministic Blackjack shoes: 1/3 seats, natural+active sibling without early credit, dealer blackjack, natural push, one split, split aces, forbidden resplit/double-after-split, unsplit double, last available stake, all bust and one shared dealer. Save/restore after **every** action and tamper cursor/lineage/cards/flags/payout. Compare state input before/after rejected actions.
- v1 untouched inactive/history and mid-hit hand migration; v2 precedence; corrupt v2 with valid richer v1 must not resurrect it; storage-full initial deal/split/double/settlement; reload mid-animation and scratch; repeated submit at settlement boundaries.
- Mobile 320/390 portrait and 844 landscape plus desktop: 10 balls, 4 tickets and six hands remain readable; focused active hand visible; pointer and keyboard scratch; no horizontal overflow; game/donation navigation locks. Existing anonymous donation and all wager/security gates remain intact.

No additional runtime files were edited during this review. Parent is implementing and owns later full tests/browser/release gates.
