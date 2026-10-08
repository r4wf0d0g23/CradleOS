# Independent seed-only donation architecture review

2026-10-08. Inherited native reviewer, not Opus. Read-only current Move/frontend source and official Sui GraphQL. No wallet, transaction simulation, signing, funding, pause changes or chain writes.

## Verdict

**Conditional architecture PASS for the newly authorized, explicitly irreversible seed-only donation UI, with every wagering gate retained.** This is not candidate-source approval and does not lift the security HOLD on wagering activation. Fresh `paused=true` alone is not sufficient evidence that donated funds cannot be paid out; the current house's clean history and empty escrow scans are important additional evidence.

The source is being changed concurrently by the parent. This report describes inspected baseline behavior and implementation requirements; the completed UI/build requires its own review.

## Actual current-house evidence

Independent official read at the timestamp in `house-live-history.json`:

- Exact current House `0x4a0386fc44328714d0d48bb38d99cda6397c089fd753e3abc4f40b1cb1d98370` with current casino package type and current EVE coin type.
- Creation version **939311497**: bank 0, min/max 1 raw unit, unpaused, all lifetime counters 0.
- Current version **939311498**: bank 0, min/max 1, **paused=true**, all lifetime counters 0.
- This matches the clean-wipe bootstrap/pause receipts: `AXKeCvEtfe3QQHrrKTi6M32McppcTfdCcc4PwQSZsZ5A` and `HRzwrt8hUMhwZrF44D6V76M9rh7S2EfEmjrjo9ERjiit`; fresh package/type, not an old-house balance/liability migration.
- Complete global current-package/current-EVE scans returned **zero active objects** for `blackjack_live::Hand`, `blackjack_live::SplitHand`, `hilo::HiLoGame`, `mines::MinesGame`, `dragon_tower::TowerGame`, `video_poker::VideoPokerHand`. Every connection returned `hasNextPage=false`; see `active-escrows.json`.

These checks support seeding this specific still-pristine house while paused. A zero bank/counter snapshot of an arbitrary house would not establish the same fact: escrowed stakes affect lifetime counters only when settled.

## Contract boundaries and concrete cautions

1. `house::donate` (`house.move:458`) requires only a positive coin and label at most 64 bytes. It consumes the donor's coin into the bank and emits a Donation event. It needs no AdminCap, Character, ban exemption, or wager readiness. It changes neither pause nor risk parameters and is callable while paused. This is a real permissionless donation path; do not send a naked coin transfer to the shared object's address.
2. Every `take_wager*` path checks pause, so new instant games and new escrow starts reject while paused. Keep `casinoFunded=false`, testnet quarantine, and all new-bet/extra-stake UI guards unchanged. Donation readiness must be a separate condition, never an alias for `CASINO_READY` or inferred wagering readiness from positive bank balance.
3. **Pause does not freeze outflows.** `pay_winnings` (`house.move:603`) does not check pause. Existing Hi-Lo, Blackjack, Mines, Tower and Video Poker objects can settle against new donations. Blackjack `double`/`split` also accept extra stake while paused at the contract level. Admin withdrawal works while paused. The clean current escrow result resolves this immediate concern, not the general design flaw.
4. **No atomic paused-only donation promise.** `donate` has no paused assertion. A fresh pre-sign frontend read can fail closed, but cannot guarantee the operator did not unpause during the wallet prompt. Say “donations join the house bankroll; wagering remains disabled in this release,” not “locked funds,” “safe escrow,” or “funds cannot leave while paused.” Operator withdrawal and eventual risk changes remain possible. Recheck state/account as late as practical before signing; reject unknown/failing reads. A truly enforced paused-only escrow would require separate reviewed contract design, outside this UI task.
5. The current math/old-path vulnerabilities and missing aggregate-liability reservations still prohibit wagering activation. Adding donations must not alter Move code, publish a package, increase bet limits or enable any wager.

## Required implementation safeguards

- Parse exact decimal strings to integer raw EVE (9 decimals); reject exponent notation, signs, zero, excess precision, over-u64 and over-balance. Do not use `Number(amount) * 1e9`/rounding. Display the exact amount that is built. “All” must use raw balance, not float round-trip.
- Verify pinned House ID, exact package/type/current EVE and shared ownership; require explicit boolean `paused === true`, complete numeric fields and no transport/GraphQL errors. Do not reuse the old permissive cached `fetchHouseState` decoder as security evidence (`Boolean(fields.paused)` and numeric defaults are unsafe).
- Keep active-escrow verification fail-closed when claiming clean seeding. Never infer no liabilities merely from zero counters or an empty first page.
- Fetch fresh, complete coin pages; reject malformed/duplicate IDs, stalled cursors, limits, wrong type/owner and insufficient exact sum. Bound transaction input count; do not silently accept truncated pagination or merge an arbitrarily large coin inventory.
- Capture the actual verified wallet address and network; pin `tx.sender`; recheck after asynchronous state/coin/gas work and immediately before invoking the wallet. Account switch clears or scopes notices/results. Never take a developer override as the signing identity.
- Synchronous in-flight latch against double submission; rejection/error leaves form recoverable. Require positive SDK execution success, not merely absence of one nested error field. If execution is uncertain, preserve digest and check status rather than auto-retry the donation.
- Strict donation-only transaction construction: coin merge/split plus exactly the pinned `house::donate` with current EVE. No wager, transfer-to-arbitrary-recipient, risk update, deposit-with-cap or pause call. The shared cycle compatibility checker is an allowlist for many packages, not a donation-command audit.
- Validate labels by UTF-8 byte length. Existing byte truncation can cut a multibyte character; reject over-limit input or truncate at a valid codepoint boundary with clear feedback. Render donor labels as text, not HTML.
- Show separate SUI gas cost, irreversible/no-return nature, actual destination and current paused state. Remove misleading present-tense “unlock max bets”/Video Poker examples from the paused seed-only presentation, or clearly mark future hypothetical limits. Keep practice chip balances completely separate.
- Public browser GraphQL preflight failed during the prior release review; test the actual production donation read path. Fail-closed is correct, but a button whose verification can never load does not satisfy a usable donation feature.

## Bounded multi-play corroboration

The parent's broader options audit owns the full inventory. Independently confirmed:

- Move Plinko supports `play_multi` with **2–10 balls**, one total stake split by integer division, each payout floored; division remainder goes to the house. Exposure is deliberately per-ball, not aggregate, so up to 10 balls is not a one-ball total-risk ceiling.
- `casinoGames.ts` contains `buildPlinkoMultiTx`, but baseline `InstantGamePanel` keeps `plinkoDrops=1` with an unused setter and dispatches only single/classic or single-mode builders. Existing helper support is not an exposed working multi-ball option.
- Practice currently resolves one round at a time. Live Blackjack supports one ordinary hand or one two-hand split, not a general multi-seat mode; double/split belong to the existing-hand state machine.
- None of these audited options should become enabled as a side effect of seeding. Future practice multi-play needs explicit per-round versus total stake, bounded count, atomic accounting/storage and readable aggregate/per-result history; financial batching remains under the separate activation HOLD.

## Must-test cases before candidate approval

Exact smallest/maximum/over-precision amounts; 64-byte and multibyte labels; wrong House/type/coin/network; paused false/missing/string values; stale/unavailable reads; nonempty escrow/page error; coin pagination/dedup/insufficiency; account switch at each await; rapid double click; rejected/failed/unknown transaction result; correct sender/destination/amount/command whitelist; all new wagers remain disabled after a mocked bank increase; disconnected mobile donor UI and no accidental wallet invocation. Use mocked signing or read-only simulations only for review; do not donate real funds as a test.
