# Independent public donation release review — PASS

2026-10-08, approximately 13:10 UTC. Inherited native reviewer; not Opus. Read-only browser and public-chain queries only. No wallet connection, signature, transaction submission, donation, funding or deployment.

Release: source `fd9c39e1786a664892c1dc6f8fb4af8897e3187e`, Pages `9909b62f`, production `https://cradleos.io/#/casino` and immutable `https://9909b62f.cradleos-d75.pages.dev/`.

## Independently verified

- Both origins deliver exact expected JS `index-BsqxVPq3.js` SHA256 `0dc581afcafe4ece9892848ea2889be70aea9f84760c7585e76323426b843c20` and CSS `index-CWIquRsD.css` SHA256 `fca8dad0c0caa1338323a7e14e3bd1440c8145f321a0d55821aa849051f08cc6`. Four exact checks: `live-hashes.json`.
- Fresh anonymous production contexts at **320×780 portrait** and **844×390 landscape**, actual touch taps: Donate entry opens the seed form; amount/label, irreversible-gift and public-address disclosures fit and are readable; no horizontal overflow. Disconnected donation remains disabled. Screenshots visually inspected: `live-320.png`, `live-844.png`.
- Back restores **25 Play Money games**. Testnet lists **23 staged tables**, settles to “house paused” / bank 0 / security-repair warning. Sampled Blackjack Deal is disabled. No production DEV VIEW toolbar.
- Direct **production-origin browser** official GraphQL query validates exact House address/type/current EVE and Shared ownership, version `939311498`, bank `0`, `paused:true`, min/max `1`, all wager/payout/settlement counters `0`.
- Same fresh query independently checks all six current-package/current-EVE escrow types: empty nodes and explicit `hasNextPage:false` for each. This is a point-in-time read, not a permanent paused-status guarantee.
- Zero page exceptions. Observed JSON-RPC methods were read-only `suix_queryEvents` and `sui_getObject`; no financial RPC submission.

## Diagnostics / limits

Known pre-existing console diagnostics remain: SmartObjectProvider missing object ID, Slush metadata CORS and associated ERR_FAILED/metadata fetch error. No “all console clean” claim. Official GraphQL reads succeeded in this pass.

No connected-wallet or real donation was performed; source/mock-wallet safeguards are covered by `candidate-review.md`, not represented as live financial execution. Donations are shared-bank gifts, not locked escrow. Wager-activation security HOLD remains separate and unchanged.

One nonblocking inherited copy issue was reported to parent: disabled Blackjack footer still describes a once-shuffled fixed deck/full deck publication although the current live implementation uses fresh draws. This text predates the donation change and is not a donation release regression; correct it in a scoped copy follow-up.

Evidence: `live-browser.mjs`, `live-browser.json`, `live-hashes.py`, `live-hashes.json`, two screenshots. Runtime source untouched.
