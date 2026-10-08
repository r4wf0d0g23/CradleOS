# Testnet activation remains a separate step

The lounge is live; testnet wagers are not enabled by this release.
Current House<EVE> is paused with zero bank. Its min/max of 1 atomic unit are
bootstrap values, not usable operating limits. casinoFunded remains false.

Before activation:
1. Obtain the intended testnet bankroll and min/max stake policy from Raw.
2. Verify current contracts, exposure limits and wallet/game integration using
   the current Cycle 7 EVE type; re-review multi-step game security before funding.
3. Apply specifically authorized funding/limits/unpause transactions.
4. Verify live House<EVE> and publish the explicit casinoFunded change.
5. Prove signed wagering, settlement and failure/recovery behavior on testnet.

No funds, user balances, or play chips are migrated or redeemed. Practice chips
are tab-local and deliberately cannot be passed to any wallet or contract call.
