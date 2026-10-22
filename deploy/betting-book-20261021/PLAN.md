# Current execution plan

Initial pilot plan is superseded; archived in `archive-initial-pilot/PLAN.md`.
See `EXPANSION.md` for the authorized immutable rules and anti-control decision.

1. Proof/anti-manipulation architecture — complete. Combat blocked.
2. Contracts, wallet UI, automatic payout keeper — implemented, staged.
3. Local meaningful tests, live read-only verifier simulations and browser checks
   — passed; see `RELEASE.md`, `provenance.json` and current receipts.
4. Jetson2-only backup exception explicitly authorized by Raw20:21 CT. Refresh
   restored signature before publishing; approved wallet/custody unchanged.
5. Publish reviewed testnet package and bootstrap EVE book with zero price markets.
   Install/fund dedicated gas-only keeper and verify autonomous healthy run.
6. Deploy exact-item rewards first: rewardsEnabled=true, wageringEnabled=false.
   Only custody-held AdminCap can create markets; create none. Verify actual
   IDs/caps, source, browser and primary-origin hashes. Existing House stays HOLD.
7. Price activation remains blocked on Pyth credential and current authenticated
   first-crossing retrieval. No claim of verified live payment without real receipts.

No blanket deployment permission is missing: Raw already authorized deployment.
Do not create fabricated markets or place bets using Raw's wallet.
