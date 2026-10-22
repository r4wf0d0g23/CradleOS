# Sports book — testnet EVE extension

Requested by Raw 2026-10-21, message1562641724566798481. NFL/NBA are
working defaults pending league preference. This is NOT a mainnet release.

## Current boundary

The existing item-reward book and keeper remain deployed and unchanged.
Sports wagering is NOT enabled. Public ESPN fixture discovery works; neither
ESPN JSON nor a hash of that JSON is a cryptographically authenticated result.
No sports escrow, provider signer or production result oracle is deployed.
No bets, balances, payouts or sports fixtures are fabricated in production.

## Closed first release

- Professional NFL/NBA match winner only. No live bets, props, spreads,
  parlays, amateur/community events or user-authored questions.
- Freeze provider/competition/season/event IDs, home/away team IDs, scheduled
  UTC start, rule version and result-authority configuration before any stake.
- Close 5 minutes before the original scheduled start; never reopen.
- Final score includes overtime. Ties, cancellations, abandoned games,
  rescheduled fixtures, changed participants and unverified outcomes refund.
- Fixed proof deadline: original start +48 hours. No administrator extensions.
- Require authenticated provider finality/revision history, not two matching
  snapshots. A 2-hour correction window begins at onchain receipt of a
  corroborated candidate; authenticated revisions reset it. No source-timestamp
  backdating. If the window cannot finish by the 48-hour deadline, refund.
  At the deadline the accepted result is terminal; later corrections do not
  reopen settlement. Missing/ambiguous data never means a loss or zero score.
- Require evidence that the match did not begin before the wager cutoff.
  Otherwise refund. A planned kickoff timestamp is not an actual-start proof.
- Zero-fee pari-mutuel pools in the current testnet EVE type; returns vary until
  cutoff. One-sided pool refunds. No fixed odds or house underwriting.
- Shared, indexed, fixed-beneficiary entitlements; idempotent permissionless
  payments and refunds. Existing gas-only keeper can later service these.

## Oracle architecture — not yet connected

Use an isolated sports package, not an upgrade to the funded reward book.
Preferred: independently operated authenticated result feeds with Sui-verifiable
signatures. If using an operator-attested adapter instead, disclose that trust
model and obtain an agreed authority policy before taking stakes. Do not present
three keys controlled by us as three independent data sources.

Every attestation must bind chain genesis, exact package/book/market IDs, frozen
terms hash, source event mapping, both teams, start, final status, scores,
observation timestamp, rule version and evidence hash. Replay across markets,
chains or revisions must fail. Source IDs/mappings cannot be changed after stakes.
Results require corroboration and a correction window; disagreement refunds.
Freeze exact independent authorities/quorum/key policy before stakes. No key
rotation for live markets; lost authority means refund. Forfeits/suspensions
refund in v1. Delayed kickoff is acceptable only with unchanged original fixture,
authenticated actual start after cutoff and timely finality. Unknown status
semantics refund; verify provider mappings before activation.
An evidence hash supplies auditability, not truth. Provider signatures prove who
reported a result, not that the sporting event was impossible to manipulate.

Operator/creator/result-signer wallets must be excluded; professional fixtures
reduce participant control, but wallets alone cannot establish insider identity
or eliminate hidden alts, bribery, collusion or feed corruption. No such claim.

## Research and access needed

- ESPN scoreboard endpoints: reachable read-only NFL/NBA discovery on Oct21.
  Undocumented public API, no supported availability or signed-result guarantee.
  Snapshots in this directory are discovery receipts, never payout evidence.
- SportsDataIO: documented schedules/scores and prediction-market offering.
  https://sportsdata.io/developers/api-documentation/nfl
  https://sportsdata.io/developers/api-documentation/nba
  Need production/non-scrambled access, result/correction/actual-start semantics,
  permitted use and authenticated transport/proof. Do not use scrambled trial data.
- The Odds API: documented scores endpoint, subscription/API credential needed.
  https://the-odds-api.com/liveapi/guides/v4/#get-scores
  Event names alone are insufficient; verify stable mapping, cancellation,
  reschedule and actual-start coverage. HTTP authentication is not an onchain signature.
- Chainlink sports articles establish the architecture, NOT a verified Sui
  sports feed deployment: https://blog.chain.link/bringing-sports-markets-to-blockchains-using-chainlink/

## Deliverable now / activation later

Implement strict read-only fixture normalization, closed templates, mismatch and
finality handling, and tests against real discovery snapshots plus labelled
synthetic edge cases. Do not offer a wager transaction or deploy a dummy oracle.
Next activation dependency is a usable result source AND explicit trust policy,
not just an API key. After that, implement/review isolated escrow/signature checks,
dry-run, publish under current custody protocol, verify full lifecycle with
authorized test funds, then enable the sports tab. No separate casino House changes.

## Ad claims

30-second vertical cinematic, original actual 3D environment, existing Dracon
Feral voice. Item rewards live; sports in development. Testnet EVE label and exact
cradleos.io/#/casino URL. No claim of live sports odds, verified sports payouts,
guaranteed winnings or completed user reward payments. Delivery to Raw only.
