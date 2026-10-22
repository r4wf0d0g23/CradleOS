# Polymarket testnet sports release
Authorized by Raw 1562649918701838437; continues plan/build/deploy authorization.

Separate `cradleos_sports` package, immutable per-book reporter, admin-only curated
listing. NBA/NFL full-game winner, overtime included. No public arbitrary markets.
Original cutoff start-300s, hard deadline start+172800s; onchain candidate hold7200s.
Source: Polygon137, CTF4d97…6045, non-negative-risk v1, UMA CTF Adapter V4
65070…f2a7 (Gamma resolvedBy, canonical CTF condition hash, adapter ctf getter,
verified Explorer identity; upstream feat/adapter-v4 commit7e4f741… source schema).

Before listing: exact Gamma event/game/market/slug/league/outcome labels; strict
standard rule template; question hash=keccak(ancillary); condition hash=keccak
(oracle,question,2); getOutcomeSlotCount2; getCollectionId(zero,condition,1/2)
and getPositionId(USDC.e,collection) equal ordered clobTokenIds; ancillary res_data
explicitly maps p2/YES/index0 to outcomeA and p1/NO/index1 to outcomeB. Creator
bulletin-board getUpdates must be empty. Unknown formats reject. Snapshot hashes
and complete frozen terms committed to Sui. Metadata is trusted, not independently
verified official league data; all definitions fixed before stakes.

Before results: compare immutable metadata, ancillary/rules and creator updates;
any mutation cannot pay winner. Same fixed fixture postponement follows source
within original deadline, without reopening/extending. Payout reads use one fresh
finalized block number/hash; re-read block hash to detect change. Exactly one-hot
winner; fractional/void returns stake; unresolved waits. Never use market prices.
Reporter submits result tuple hash plus full receipt hash, observed block/time;
confirmation binds exact current candidate revision/terms/result tuple and fresh
later block after7200s onchain. Receipt hash changes without resetting stable tuple.
At exact deadline, unsettled markets refund only. One-sided pools refund.

Escrow: dedicated EVE pools, no House/bankroll access, zero fees, existing reviewed
u128 cumulative payout accounting and shared fixed-beneficiary entitlements.
Reporter/creator cannot wager; no claim of hidden-alt/insider-proof protection.
Reporter cannot withdraw funds/change recipients, but is trusted for result truth.
Separate dedicated reporter and existing gas-only payout keeper identities;
separate service/config/state, durable signed-byte journal and kernel flock.
No upstream account/bets/odds/hedges/liquidity; no mainnet wagering.
