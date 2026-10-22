# Authorized book release — current design (October 21, 2026)

Raw authorized “Plan it build it deploy it” (1562623438265524279), then required
mitigation of player-controlled outcomes and both ends of any death fully defined.
This document supersedes the initial pilot/fleet proposals. Historical artifacts
in `archive-initial-pilot/` are not deployment instructions.

## Combat is blocked, not loosely filtered

No combat-market creation or kill-count submission entry exists in this release.
Current World Killmail identifies the killer Character key and victim **ship or
structure entity**, without authenticated controller-at-death. Current Character
and OwnerCap possession cannot establish historical or exclusive control; caps
can transfer/additional caps can be issued. No public Ship ownership module fills
that gap. Naming only killers, or comparing victim ID numbers to Character IDs,
would not prevent self/alt losses.

Future combat admission requires immutable attacker rosters AND exact opposing
victim entity lists, canonical victim semantics, authenticated event-time
controller mapping, one score per target plus killmail deduplication, and frozen
creator/participant/known-controller betting exclusions. No wildcard targets,
open-ended kills, survival yes/no, mutable rosters or manual interpretations.
Even these restrictions cannot prove distinct humans or prevent hidden collusion.
Missing provenance prevents **opening**, not just eventual settlement.

## Implemented templates

- **BTC/USD or ETH/USD threshold.** Fixed feed catalog, 8-decimal positive USD
  strike, immutable betting close and target. A strictly higher verified price
  pays Above; equality pays At-or-below. Creator wallet cannot bet. A linked
  current Frontier Character is required only to place a new bet.
- Exact official Pyth accumulator bytes are authenticated by pinned canonical
  Wormhole + Pyth state objects. Parsed message must have
  `previous_publish_time < target <= publish_time <= target+60`, not future,
  positive price, matching feed/exponent, and confidence at most1%. Proof cutoff
  is fixed at target+3600. No qualifying proof or one-sided pool refunds stakes.
  No discretionary historical-price choice or unauthenticated JSON settlement.
- **Sponsored item reward.** Exact Item type/quantity/tenant/origin, fully funded
  reward, fixed sponsor wallet and bounded deadline. Supplier transfers genuine
  World Items atomically to sponsor and receives reward. Exact origin StorageUnit
  must still exist. No partial fulfillment, sponsor-self fulfillment or repeated
  payout. No travel/game-inventory deposit proof, SSU permission grant, or
  third-party outcome bets. Expired unfilled reward returns to sponsor.
- **Payments.** Shared immutable-beneficiary indexed entitlements and owned
  discovery receipts. Permissionless, idempotent push payment; exact aggregate
  escrow conservation. Claim/refund/proof/finalize are unaffected by pause and
  prior claimants do not need a still-owned Character. Current code has no admin
  withdrawal or result override. Retained UpgradeCap authority is NOT described
  as upgrade-proof immutability; no irreversible cap destruction authorized.

## Timer implementation

Real Node service + systemd user timer supplied in
`cradleos-dapp/scripts/book-keeper/`. Dedicated gas-only signer; never deploy key.
OS flock enforces one instance. Signed transaction journal fsynced before send;
unknown outcomes replay identical bytes. Pending digest/action surfaced; incident
recovery requires evidence/operator review. Bounded16 submissions/pass, indexed
claim cursor, rotating128 reward scan. Reward count cannot stop market work.

Not installed, funded or enabled yet. No claim of autonomous production payout.
No new market, wager, bankroll transfer, wallet signature or chain publication.
Casino House/HOLD remains untouched. All funds/features are testnet EVE only.

## Proof facts and remaining access

Current World pinned d33ff232; Pyth/Wormhole dependency pinned
6c78a4d882daf4d91457ad5142cb58fc7e376f98. Canonical live verifiers accepted three
public signed leaves (USDC sample, actual configured BTC and ETH feeds) and
rejected altered signatures/feed/price/Merkle proofs:15 simulations, no writes.
BTC/ETH samples are historical Oct12 proofs, NOT a live expiry data source.
Generic Pyth docs still warn Sui users to use Beta IDs, while the newly upgraded
canonical testnet verifier demonstrably accepts these configured stable IDs.
Activation must verify current authenticated catalog/retrieval against **these
exact state/feeds**; do not swap IDs from generic documentation or relabel data.

Protected API request expired without a credential. Historical authenticated
Hermes retrieval is unproven; price creation must stay disabled until tested.
DGX2 Tailscale NeedsLogin/no peers blocks DGX1/Jetson2 backup checks. DGX1 power
state is unknown. Prior Oct2 backup exception was release-scoped, not carried
forward. Current FRESH_DEPLOY_PROTOCOL §8.1 still applies.
