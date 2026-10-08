# Independent play-options candidate source review

2026-10-08. Inherited native reviewer, not Opus. Runtime read-only; local browser touches and pure module probes only. No wallet, chain write, deployment or source mutation.

## Final bounded candidate source gate: PASS

The five-feature accounting design is sound in inspected code. Initial three source/UI findings were corrected during review and confirmed in actual 390px touch browser. All remaining bounded integrity/presentation items below were corrected and independently rechecked. No unresolved source blocker remains in this pass. Parent retains the broader responsive/normal-motion/storage-failure/build and deployment gates.

## Findings and rechecks

1. **Resolved — selected Plinko risk did not update pre-play payouts.** Initial High selection still showed Low/5×. Parent now distinguishes selected-profile preview from committed last drop and hides prior paths on profile change. Actual recheck: High selected, accessible board label High, edge 500×. Receipt stays immutable. Evidence `candidate-probes.json` / `plinko-selected-high.png`.
2. **Resolved — active Keno paytable always used first ticket.** Parent relays active picks to Rules. Actual Ticket 2 with six numbers now shows six-match 970× rather than Ticket 1's three-number table. Evidence `keno-selected-ticket2.png`.
3. **Resolved — Keno settings lost across unrelated play/reload.** Separate validated `OPTIONS_KEY` preferences now preserve the tickets independently of the latest committed pack. Actual two-ticket Keno → Coinflip → reload → Keno retains two tickets. Uncommitted preferences have no wager/balance effect; authoritative v2 remains a single ledger write before rendering.
4. **Resolved — Scratch immutable receipt validation.** `validPack` only checks generic Round shape for Scratch; it does not derive return from the visible symbols. Pure repro: make three losing tickets with deterministic zero RNG; set `pack.rounds[0].payout=123456` and matching `history[2].payout=123456`; `restoreSession` accepts with no notice. This is local free-chip consistency, not a financial exploit. Fix now validates the exact six possible tier histograms and derived payout. All six tier regressions pass; original forged-return probe now rejects with a restore notice.
5. **Resolved — Keno main result overlay had no ticket identity.** Generic `CasinoRoundStage` receives `history[0]`, i.e. the LAST ticket of a shared pack. Its caption says “outlined numbers are your picks,” while the editor can select any other ticket. New Result 1–4 controls select the committed receipt and explicitly label its identity. Actual Result 2 touch selection outlines its six committed picks [1,2,3,4,5,6], captions “Ticket 2 outlined · same shared draw,” and leaves authoritative ledger bytes unchanged.
6. **Resolved minor draft edge:** preferences use wager-time `validTickets` requiring ≥1 pick, but UI allows clearing a ticket to zero. Reload then rejects the entire ticket array. Draft validation now permits zero picks while play still requires ≥1. Actual clear-Ticket-2 → reload retains two tickets and zero picks in Ticket 2.
7. **Resolved pure-engine hardening:** new Roulette/Plinko/Keno RNG calls bypass the original validated `draw` guard. `playSession(...roulette..., ()=>99)` returns spin99 and an invalid save that resets on restore. Production `randomInt` is bounded; the added wrapper now rejects this injected invalid draw before producing a session. Direct probe and targeted tests pass.

8. **Resolved shared count edge:** last committed Scratch pack → visit Plinko → select10 without betting → reload previously resumed Scratch with unsupported count10. `restoreOptions` now normalizes for the resumed game. Actual ordinary-touch workflow restores selected count1, confirmed in `candidate-probes.json`.

## Independently checked positives

- All per-pack opening stakes checked before draws. Roulette49 canonical choices and Keno1–4 tickets share one outcome; independent per-unit integer floor then aggregate credit. Plinko profile arrays match source (Classic center4851), four exact tables; prior Low receipts remain unchanged.
- Blackjack uses one52-card shoe and deterministic round-robin deal. Deferred natural payouts, exact-rank single split, no resplit/double-after-split, split-ace one-card stand, S17, split21 ordinary win, one final settlement. Additional stake checked before action; active state copied rather than mutated.
- `validTable` replays bounded action log against exact permutation and compares full state; catches reordered/deleted/duplicated cards, cursor/lineage/flag inconsistencies. Valid action states and settled table receipts roundtrip in tests.
- v2 absent-only migration; corrupt v2 never falls back to richer v1. Corrupt data explicitly reports reset. Legacy active hand retains old no-split engine. History bounded20; packs bounded49/10/5/4 and per-unit limits retained.
- Authoritative sessionStorage write precedes current ref/state/animation. Busy ref guards same-turn repeats. Old/new hand activity guards game/mode/donation/refill. No network/wallet imports introduced in pure practice engines; testnet/HouseDonate code unaffected apart from honest Blackjack footer copy.
- Plinko stagger deadline includes final ball; paths use committed bits and immutable rounds reference. Scratch mouse/touch masking is cosmetic with explicit Reveal ticket/all; touch-action is scoped to canvas.
- `npm test -- --run src/lib/casinoSessions.test.ts src/lib/casinoDonations.test.ts src/lib/casinoLounge.test.ts`: **37 PASS** (24 options +13 donation/lounge). Includes16,384 profile/path cases and150 three-seat replay suites. `git diff --check` and `npx tsc --noEmit` PASS.
- Actual local390touch targeted probes: zero page exceptions, no financial actions. Parent owns broader responsive, normal-motion, storage-failure and release acceptance.

Runtime source untouched. Final evidence: `candidate-probes.mjs`, `candidate-probes.json` and screenshots. All probes used a fresh isolated local browser session; `draftSave:null` intentionally refers to the authoritative ledger before any wager, not the separate preference key. No fake financial action or wallet execution is claimed.

Remaining release work belongs to parent: broad responsive/normal-motion/storage tests, build, exact asset verification and a separate public deployment gate. This PASS does not authorize wager activation or alter the existing contract-security HOLD.
