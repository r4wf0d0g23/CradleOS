# Polymarket sports book — release in progress

Raw selected Polymarket and authorized plan/build/deploy. Sui testnet EVE only.
Zero-fee independent pari-mutuel pools, source finalized Polygon payout vector,
Cradle trusted reporter. No upstream accounts, bets, odds, funds or liquidity.
NBA Cavaliers–76ers and NFL Patriots–Bears live source mappings verified.
Publication simulation PASS; not yet published or enabled.

## Custody
Existing publisher/UpgradeCap/AdminCap destination fixed before publication:
0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a.
Raw's Jetson2-only exception (1562636926295740447) applies to this continuing
bet-book deployment; second backup deferred, not invented. Restore/sign existing
Jetson2 backup immediately before publishing. No immutable-cap destruction.

Separate dedicated gas-only payout and result reporter identities in
service-identities.json. Generated privately0600; neither holds admin/upgrade caps
or any EVE. Gas funding not yet performed. Loss/outage of reporter -> deadline
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
