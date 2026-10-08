# Player seeding and play-options release

Raw explicitly requested player $EVE seeding and an audit of multi-hand, multi-ball, multi-play and diverse play options on2026-10-08. This overrides the previous blanket *funding* hold only for deliberate seed-only gifts. **Wager activation remains blocked.**

## Design / acceptance

- Restore a prominent **Donate $EVE** entry in the casino account bar, independent of Play Money/Testnet wager flags. Legacy nested bankroll links use the same corrected form.
- Use existing current-world `house::donate<EVE>` only, with no admin cap, no direct coin transfer to a shared object, no automatic game activation, no custody-wallet transaction by the agent.
- Exact decimal→raw integer amounts, positive u64 bounds and≤64-byte UTF-8 public label. Collect full fresh paginated coin data; reject malformed/foreign/duplicate/stalled reads.
- Choose bounded sufficient coin inputs; split exact required amounts before merging so a whale's complete balance need not fit one u64 coin. Maximum64 consumed inputs, current-house object and coin type pinned.
- Verify shared current House<EVE> type, balance and paused boolean; before signing reject any active current-package EVE Hand/SplitHand/HiLo/Mines/Tower/VideoPoker object. These checks are conservative and not an on-chain pause lock or isolated treasury.
- Capture account, set sender, explicitly pin testnet, guard account/network changes before opening wallet. No pending request from a form closed during preflight.
- Synchronous submit latch; per-attempt unique marker saved before signing; uncertain result cannot silently repeat after reload. Only the same marker's completion clears it. Definite success requires tagged SDK success+digest; errors never become thank-you messages.
- UI clearly describes an irreversible shared-bank gift and operator withdrawal rights. Remove “fund to unlock bets” marketing and retired-game limit examples. One concise transaction-purpose notice, no redundant page-wide disclaimers.
- Keep `casinoFunded:false`, pause, bootstrap limits, wallet/play-chip separation and game quarantines. Donation mode alone enables its chain reads; practice remains local until explicitly selected.
- Audit all29 entries with current capability vs proposed gameplay; no implied new multi-play features in this release. See OPTIONS-AUDIT.md.

## Architecture evidence

Independent read-only reviewer verified current house creation version939311497 was empty (limits1/1), immediate version939311498 paused, and all six current EVE escrow types empty. Pause alone is not a proof of no liabilities; existing settlements/admin withdrawals are not stopped by pause. Pre-sign scans fail closed. Deposits stay ordinary bankroll gifts; operator actions can change future state.

Independent review is the available inherited native reviewer, not an Opus run. Evidence lives at `research/cradleos-casino-donation-20261008/review/` in the operator workspace. Two substantive findings repaired before release: excessive/overflowing whole-wallet merge and stale completion clearing a newer pending marker.

## Verification / publication plan

1. Unit tests of exact amounts, UTF-8, full pagination, destination/command boundaries, coin selection/overflow, missing liabilities/status, definite SDK outcomes and retry ownership.
2. Move tests prove donation while paused preserves pause, limits and wager statistics. Test-only source additions; **no contract publish or chain write**.
3. Browser fixtures exercise wallet requests without real signing: triple click, success, definite failure, uncertainty/reload, wrong identity/network, unpaused/foreign house and outstanding hands. Separately verify anonymous production UI at320/390/1440 with real read-only data; fixture success is not a funded transaction proof.
4. Full frontend tests, TypeScript/build, Origins canon, IOC scan; independent code and browser review.
5. Commit/push branch; primary Cloudflare Pages only, previous deployment105a5fc4 is rollback. Verify primary/immutable bundle hashes, assets, donation navigation and existing play/testnet boundaries. Record actual receipt.

## Not changed

No gameplay RNG/paytable/settlement code, wallet keys, admin ownership, House limits/pause, protocol versions or chain bankroll. No automatic wagers, gifts or migration of seeded funds; no assertion that current games are financially safe merely because seeding is possible.
