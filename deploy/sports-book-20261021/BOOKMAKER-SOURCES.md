# Established book / prediction-market result sources

Raw message1562647880660156518 asks whether an established sportsbook can supply
results. Read-only research, October21,2026. No sports wagering deployed.

## Best demonstrated candidate: Polymarket

Polymarket is a prediction market, not a conventional sportsbook. Its documented
public discovery API needs no authentication. A direct request to
`https://gamma-api.polymarket.com/markets` returned HTTP200 without credentials.
NBA Bucks–Wizards market5716421 reports closedtrue, umaResolutionStatusresolved,
moneyline, outcomes[Bucks,Wizards], values[0,1], NBA as its resolution source,
and rules including overtime. Parent eventendedtrue, eventgameId20023963.

Official docs pin Polygon chain137 and CTF contract
0x4D97DCd97eC945f40cF65F87097ACe5EA0476045. A public read-only RPC query at the
`finalized` tag for condition
0x49c26a169079ce41dd215fa99782dfb35262b9104ac640f9255105e4a4beea06
returned payoutDenominator1, payoutNumerators[0,1], consistent with the resolved
Gamma record. This demonstrates accessible settlement state, not merely prices.
The test was a v1 CTF market; current Polymarket also has v2 contracts requiring
a distinct adapter. Unknown versions must fail closed. CLOB endpoint returned403;
no bypass attempted. Public Gamma and Polygon RPC reads worked independently of
the blocked CLOB route. No account, order, signature, bridge or funds required.

## Proposed integration boundary

- Curated professional full-game match-winner markets only. Freeze exact source
  market/condition/version, game ID, both teams, outcome-token/slot mapping and
  supported rule text/hash before our first wager. Do not match by names alone.
- Verify token/slot mapping against the canonical deployed position mechanism;
  an outcome-array order alone is not sufficient production mapping evidence.
- The demonstrated scope is non-negative-risk v1 only. Verify canonical
  oracle/question/condition binding, exactly two outcome slots and token-to-team
  mapping. Reject negative-risk/v2/unknown formats until separately implemented.
- Read actual finalized resolution, NOT a market price, closed flag, suggested
  winner or optimistic pending proposal. Pin chain/contract and one finalized
  block number/hash for all payout reads. Retain exact RPC requests and responses.
- Keep our testnet EVE stake pools and fixed-beneficiary payouts entirely on Sui.
  We reuse a result, not their liquidity or odds, and place no upstream bets.
- Freeze this adapter's policy: follow the named source market's FINAL SETTLEMENT,
  not an independently proven official NBA result. A postponement of the same
  bound fixture may resolve within our original48h deadline; never reopen betting
  or extend that deadline. This supersedes immediate-postponement-void for this
  adapter only. Do not switch sources or replace teams after wagers.
- Exact one-hot payout selects a winner; unresolved waits. Source50/50/void or
  unsupported fractional payouts refund original stakes, not split our pool50/50.
  Source postponement may wait forever; our hard48h deadline does not. A source
  result too late to finish our confirmation hold refunds, even if upstream later
  settles. No unsupported soccer90min/prop/series markets.
- The existing disclosed trusted-reporter model still applies. Reading Polygon
  through RPC does NOT make a Sui contract verify Polygon finality or establish a
  trustless bridge. Reporter/RPC/source resolution are trusted unless a separate
  proof mechanism is actually implemented and verified.
- End-to-end mapping, split/void, timing, source-version and rules tests remain
  necessary before activation. Public accessibility is not a commercial licence
  determination; review documented reuse terms before production integration.

## Traditional sportsbook alternatives

- Betfair supports an established Exchange API, but its current support page says
  personal live-key read-only access is not permitted and commercial licensing
  depends on intended use. The older FAQ's299GBP differs from the current support
  page's499GBP; do not quote the older price or buy access. Its main developer
  website also blocked this US host. Not an immediate free read-only route here.
- Pinnacle's official API README says general-public access closed July23,2025;
  access is bespoke/select bettors/commercial partners. No account/application
  was created and no outreach sent. Not a free plug-in source today.
- The Odds API is a data aggregator, not a sportsbook; it advertises a free
 500-credit tier and completed-game scores. Requires an API key; scores are not
  bookmaker ticket-settlement decisions. No subscription or account created.

## Sources / evidence

- https://docs.polymarket.com/market-data/discover-markets.md
- https://docs.polymarket.com/resources/contracts.md
- https://docs.polymarket.com/market-data/realtime-data
- https://support.developer.betfair.com/hc/en-us/articles/115003864531-Are-there-any-costs-associated-with-API-access
- https://raw.githubusercontent.com/pinnacleapi/pinnacleapi-documentation/master/README.md
- https://the-odds-api.com/
- Raw data/HTTP receipt/RPC result: workspace research/sports-book-20261021/bookmakers.

## Review

Independent native source-choice review PASS, not activation approval. Findings
above incorporated: explicit postponement/settlement-source semantics, v1/non-neg
risk scope, exact mapping/condition binding, all payout shapes, immutable source
selection and single-block receipt requirements. No contracts changed/deployed.
