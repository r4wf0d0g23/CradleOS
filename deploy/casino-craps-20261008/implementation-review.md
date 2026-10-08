# Frontier Craps — independent implementation/candidate review

**PASS. All reported blocking findings are resolved in the reviewed candidate.** Native inherited reviewer; not Opus. Read-only runtime review; research scripts/reports only. Public deployment requires its separate live gate.

## Resolved findings

- **Practice escrow exposed a Testnet resume route:** the parked-table banner originally appeared in the shared lobby and could call `navigate("craps")` under Testnet. It is now practice-only; browser check confirms 34 practice games, 23 Testnet games and no Testnet craps resume entry.
- **Parked escrow could be stranded at the numeric ceiling:** a valid near-limit session could win another game and then fail to refund its parked bet. Placement, ordinary settlement, legacy-hand settlement, restore and craps roll now reserve the maximum gross return of parked bets. The independent boundary probe proves unsafe transitions reject atomically and allowed parked bets remain refundable.
- **Strict-restore gaps:** unknown table/receipt fields, a current point inconsistent with the latest revealed roll, and a pending winning receipt with a negative implied before-balance were accepted. Exact schemas, latest/adjacent point continuity and pending cash≥gross payout now reject all reported mutations. Between-roll legal bet edits remain allowed.
- **Rounded additions hidden on occupied spots:** actual `+X / tap` remains visible with existing chips. The 320px test selects a 25-chip denomination on occupied Place6, sees +30/tap and observes exactly 30 deducted.
- **Phone roll did not bring dice into view:** synchronous smooth scrolling was undone in an actual touch probe. The post-render/focus RAF scroll plus anchoring fix now places the tray at y213–303 inside a 568px viewport. Dice are visibly in flight rather than rolling above the screen.
- **Pending Refill tooltip could hint at settled escrow:** it now uses the receipt's before-bets until reveal. Final production-preview check confirms the stable tooltip even when the committed after-state has no bets.

The author's compact hint-grid overlap fix and three-column phone number layout were independently inspected: explanatory paragraphs do not overlap, table increments remain legible and controls are reachable.

## Independent evidence

- **43 focused tests / 3 files PASS** (`casinoCraps`, `casinoSessions`, `casinoSpinRun`), including the current 14 craps tests. These cover ordered dice pairs/points, exact ratios, caps, malformed saves, escrow and legacy state.
- **All 33 existing practice games PASS** in an independent cross-game escrow probe: park an established Pass contract, play/resolve the other game, round-trip saves during and after it, then seven-out/reveal craps. Escrow, local craps history and root sequence remain intact through the relevant pack, slot-feature, Scratch and Blackjack paths. Evidence: `review-crossgame.json`.
- **Independent fix probes PASS:** maximum-return headroom, atomic rejection/refund, four previously accepted malformed saves, and a mixed hard-point result. Pass+odds+Place6+Hard6+Field resolves 42 chips and returns exactly 88 gross. Evidence: `review-probe.json` (original findings) and `review-recheck.json` (resolved).
- **Real 320×568 touch production-preview flow PASS:** valid pending mixed-point fixture shows before-point6, escrow42 and cash9,958; no unrevealed dice or receipt; no automatic replay. Reduced-motion reversal stays settled. A forced session-storage reveal-write failure preserves pending ledger/before-state; retry and reload reveal the same3+3 and exact88/42 receipt without another payout. Parked lobby return, refill lock, practice-only routing, occupied-spot increment and legal refund pass. No page exceptions or document horizontal overflow. Evidence: `review-browser.json`, `review-320-rolling.png`, `review-320-controls.png`.
- **14 existing financial/feedback/legacy boundary files byte-unchanged** versus the pre-candidate HEAD. Existing practice/expanded/slot/BJ math, donation helpers/panel, legacy testnet panels and sound policy are preserved. Shared PhysicalDie change is export-only.

## Exact reviewed candidate

Nine source file hashes, 14 frozen-boundary hashes and preview bundle comparison are recorded in workspace research `cradleos-casino-craps-20261008/reviewed-source-hashes.json`.

Final preview `http://127.0.0.1:5296/#/casino` serves exact production `dist` bytes:

- `assets/index-BOxHGjjA.js` — `a98bf30fa431450b5205594d1dfa04ac67163ad9266e1ef1f6c5ca7e0098cd2b`.
- `assets/index-DPIXiR1G.css` — `3642f229a5b1acbafa0d08f6e4c8de3e4d1f70b78583bc62ac25d2759bb0d413`.

The full bounded browser flow was rechecked after the scrolling fix; the final tooltip-only delta received its own fresh browser assertion and exact bundle check. No other runtime delta intervened in that final check.

## Scope and remaining limits

This gate confirms the stated practice rules and reviewed ownership/reveal paths; it is not a regulated-casino, multiplayer-trust or on-chain security claim. The integer local ledger is not server-trusted or redeemable. No testnet entry, funding, contract activation, wallet connection, signature, donation or chain mutation was performed or approved.

The reviewer did not independently repeat every viewport, all 306 parent-reported tests, or browser-audible sound recording. Mobile fixture results are deterministic saved-outcome probes, not claims of live RNG coverage. Existing SDK console diagnostics are not represented as absent; this probe records page exceptions only. Browsers were closed and the parent's preview service was preserved. Only research/report files were written by the reviewer.
