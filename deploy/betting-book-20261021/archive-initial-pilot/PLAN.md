# Frontier Betting Book — testnet EVE

## Authorized direction
Raw requested a casino betting book, then selected verifiable EVE Frontier events and testnet EVE. Build a separate market escrow, not a new entry point to the paused casino House. No existing bankroll, games, donation gates, or personal practice ledger changes.

## First market: verified kill contest
Two named official Frontier characters compete during a future fixed UTC window. Players back A or B before that window starts. A selected loss type (ship or structure) and optional solar-system ID are fixed at creation. The score is the number of distinct qualifying official Killmail objects **submitted to this market before its proof deadline**, not a claim to a complete census of every in-game kill. A public proof period follows the event window; anyone may submit proofs. Higher submitted score wins; equal scores (including zero/zero), or an unfunded opposing pool, void/refund. No negative-event claims or subjective referee settlement.

This is deliberately NOT "first kill wins": callers cannot establish chronological firstness by presenting one event. An indexer may discover candidate proofs, but cannot attest a result or mint a proof. The UI must expose the proof deadline and a short decision-useful rule that only submitted verified kills count. Missing or late records never silently count as evidence of a loss. A score lead is provisional until finalization. No promises that all game events are published or discovered.

## Chain evidence checked October 21
- Sui testnet, existing application environment testnet_stillness / chain prefix 4c78adac.
- Official world package 0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92.
- Canonical KillmailRegistry 0x69dfecd272649c16aff85bb7638b45a0b3afe40b57433009408aa27c397a4db7, discovered with an official GraphQL type-filter query.
- Canonical Killmail has public accessors for key, killer, victim, tenant, Unix seconds, loss type and solar system. Creation is game-admin gated and ID derives from the canonical registry and tenant/item key. Contract validates derived ID, exact tenant, time interval, eligible killer and loss type/system. Market-local deduplication prevents counting a record twice. These are official game-admin attestations; the book does not independently measure combat or filter self/alt/farmed kills. The victim field alone cannot prove historical ownership.
- Existing EVE coin type remains 0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE.

## Escrow and accounting
- Separate generic Book<T>/Market<T>; release manifest pins T to current EVE. Book creation is deployment bootstrap; its linked AdminCap can create markets/pause NEW betting only, never choose winners, change existing terms or withdraw player escrow.
- Terms, player keys and event/proof cutoffs freeze at market creation. Minimum lead time and bounded windows prevent past-event markets.
- Each wager creates an owned non-transferable Ticket<T>, bound to market, side and exact atomic stake. Wallet submission is explicit. New stakes must precede event start and have a matching live Character owned by the sender.
- Initial fee is zero: no fee recipient/custody ambiguity. Player-funded pools only, no fixed-odds promise or house liability. Display estimated return, final pools fix at event start.
- Permissionless finalize after proof cutoff. Claims consume ticket; winning payout is floor((claimedStake + stake) * total_pool / winning_pool) minus floor(claimedStake * total_pool / winning_pool), using u128 intermediates. Each payout is floor/ceil of its ideal share; claim-order variation is at most one atomic unit and total payout exactly exhausts escrow. Losing tickets consume for zero. Void refunds full stake. No claim deadline and no admin withdrawal.
- Pause cannot block proofs, finalization, claims or refunds. Version/cap identity and book/market binding checks required throughout. Immutable publication preferred after review; no assumption an upgrade alone disables old bytecode.

## Interface
Casino subview "Betting Book". Testnet label, Open/Live/Proofs/Settled/Refund status, two competitors, UTC window, pools, verified scores, estimated return, Stake, My bets, Submit proof, Finalize, Claim. Empty book is honest empty state, not seeded fake markets. Compact rules preserved; no implementation prose in chrome. Admin creation form limited to actual capability owner. Account/network switch and unknown transaction outcomes must not trigger repeat bets.

## Verification and release
Move tests: authority/binding, escrow conservation, asymmetric pools, rounding, multiple claims, duplicates, wrong tenant/world/registry, wrong players/system/type/timestamp, deadlines, ties/no pool/refunds, pause recovery and exact-amount bounds. Frontend tests: strict parsing, EVE arithmetic, claim previews, transaction targets, account/network guards, result/unknown handling. Mobile/desktop browser QA with fixtures separately labelled from live data. Independent architecture and release review. Prepare concrete deployment artifacts before any final publication/activation decision; do not reactivate existing casino contracts.
