# Polymarket sports book — release in progress

Raw selected Polymarket and authorized plan/build/deploy. Sui testnet EVE only.
Zero-fee independent pari-mutuel pools, source finalized Polygon payout vector,
Cradle trusted reporter. No upstream accounts, bets, odds, funds or liquidity.
NBA Cavaliers–76ers and NFL Patriots–Bears listed on Sui testnet.
Contracts, services and production website live at https://cradleos.io/#/casino.
Select Betting Book → Sports. Cloudflare Pages `302e8112`; source
`81d901feff5896600eb8904e1fbf7e465e1d738b`; previous rollback `8e87ba66`.
Production JS/CSS bytes match reviewed dist exactly; HTML asset references match.
Live browser repeats all preview checks at 320/390/1440 with both real fixtures.
See web-release.json, live-assets.json and live-browser.json.

## Published deployment
- Package: `0x7b705d0e74b7b8c5e8874db91e0cf717a89f8413d6e0a146398a7d4b1ceeb2c6`
- Book: `0x31c07a935633158211587519945eed0a0d52add58f7e2548d9b5bab43c9acbe4`
- Publish: `4AVsSP4vwXwtAY7Vqx8p1nZbyy6kwnsV6Tfy3Za3WMvt`
- Bootstrap: `7Jc525XDS2jgzr9mQEyLRfkqdrZk5En5QRNmZa8e8ywb`
- NBA: `0xe9c4cd23560e3b023fb5e19eeaef4b76c2cc9db46b3debd395362e94ae4a6510`
- NFL: `0xcf6d527c498f20b85c0a9c1f527eebc917d1bbaf49eaebd19eed5b76c859e306`
- Exact source/custody/onchain receipts are in this directory.

## Verification
36 Move, 524 frontend and 69 Node tests pass. TypeScript, Origins guard and
approved IOC scan pass. Clean committed bytecode matches published module after
normalizing its single self-address. Independent publication/runtime review PASS.
Real-chain sandboxed Chromium preview at 320/390/1440 passes: fixture bindings,
source links, testnet labels, unsigned-wallet guards, no horizontal overflow or
page errors. Existing item rewards remain present and price wagering paused.
Actual player wagering, browser wallet signing, embedded EVE Vault webview and
real result/refund/payout execution remain unverified. No player stakes yet.
Other application panels and existing casino House/character flows unchanged and
out of scope: Structures, Inventory/SSU, Tribe/Vault, Gate/Defense/Turret, Voting,
Query/Search, Keeper/Lore, Map/Route, Dashboard, Intel/Killboard, Industry, Registry,
Treasury, TribeDex, Recruiting, SRP, CargoContract, Inheritance, EventCalendar,
GateProfile, AssetLedger, TribeHierarchy/Leaderboard.

## Custody
Existing publisher/UpgradeCap/AdminCap destination fixed before publication:
0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a.
Raw's Jetson2-only exception (1562636926295740447) applies to this continuing
bet-book deployment; second backup deferred, not invented. Existing Jetson2 backup restored/signed at 2026-10-22T02:34:03Z, independently
verified; proof SHA256 `434db8ff4e92b6ee0a8462e60ac99c14db450d9f76dbb5af998bdc7ce343da17`.
UpgradeCap `0xd1b150c3fe3e7f640e2e30f94ec1a426f20aa3aca75bf89a95951d5b1a9e8f7a`
and AdminCap `0x873d6cfa313a1fbbcbcc91977b891d0f2ddb2f2a1174f3605b1df6836f605721`
verified at custody address. No immutable-cap destruction.

Separate dedicated gas-only payout and result reporter identities in
service-identities.json. Generated privately0600; neither holds admin/upgrade caps
or any EVE. Each funded with 0.25 testnet SUI. Both live user-systemd timers enabled and
healthy; runtime `/home/rawdata/cradleos-sports/releases/60f3d82`. Loss/outage of reporter -> deadline
refund, not discretionary key rotation of an existing wager.

## Rules
Fixed NBA/NFL two-team full-game winner including overtime. Cutoff5min before
original start; never reopen. Finalized one-hot source payout plus fresh confirmation
after2h onchain hold. Original start+48h hard refund deadline. Fractional/void,
one-sided, changed rules/fixture or observed early start refund original stakes.
Permitted same-game postponement stays under original cutoff/deadline. Missing
malformed or unavailable data never chooses a winner. Source/status metadata and
our reporter/RPC are trusted: no Sui-native Polygon proof or independent league
result verification. An early start not exposed by upstream cannot be detected.
Source contracts permit their own resolution governance; we follow named-market
settlement, not prices or a claim of independent official scoring.
UpgradeCap retained under existing custody; not immutable/upgrade-proof.

## Recovery
Reporter and payout service are separate with distinct gas keys, kernel locks,
durable identical-byte transaction journals and receipt archives. Unknown chain
outcomes block new signing until resolved/replayed exactly. Payout signer has no
result authority. Users retain Release refunds and fixed-beneficiary Claim.
Pause new bets only; deadline and claim recovery remain available.
No House funding, House activation, reward-keeper replacement or price activation.
