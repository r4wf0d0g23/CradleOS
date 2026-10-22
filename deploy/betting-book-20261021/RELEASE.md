# Betting book — onchain published; rewards-only web release ready

Current release replaces the initial pilot/fleet design. Old receipts are in
`archive-initial-pilot/`; never use their ABI or simulated IDs for deployment.
Current exact source/bytecode/build hashes: `provenance.json`.
Publication source: `c585fe5e695d66f5ce33adc5675de0e7d7f90efe`, tag
`publish/cradleos_book-rewards-2026-10-21`. Current web manifest/build evidence:
`web-release.json`. Source is committed locally; final web push/deploy pending.

## Implemented

- Fixed BTC/USD and ETH/USD Above / At-or-below markets, testnet EVE, zero fee.
- Immutable rules, canonical authenticated first-crossing price, fixed cutoff;
  missing proof or one-sided pool refunds. Equality pays At-or-below.
- Exact-item sponsored wallet handoff/reward with live origin SSU check and
  timed refund. No outcome wager on a supplier-controlled delivery.
- Shared fixed-recipient automatic-payment entitlement, owned discovery receipt,
  permissionless wallet fallback, pause-safe recovery and integer conservation.
- Dedicated-signer keeper, durable signed transaction journal, OS process lock,
  bounded jobs, systemd user timer, incident/status guidance.
- **No combat entry points.** Current killmails cannot establish victim controller
  at death. See `EXPANSION.md`; no self/alt/collusion-proof claim.

## Actual onchain and keeper deployment

- Package `0xd3ff5ab45de2c4b9a980d3d35251a9112067824506a03301e6a488c45dee68a9`.
- Book `0xd77497e93dcf02d70ce250751844eea561df4e7b2abb11034a4ba19530a6424b`, current EVE, version1, tenantstillness,
  pausedfalse, zero markets/rewards; real GraphQL read verified.
- Publication `5wEkrB5ssmCBguoyHsnijHXRDPQDLxKAjdLeL91oYPWf`.
- Bootstrap `5aeoUu1kXzCTyBXLkSBoWUXBngbF7oCjKBZJ4k7PW5Ri`; BootstrapCap consumed.
- UpgradeCap/AdminCap in recorded deploy custody; actual object owners verified.
- Entire published module bytes match reviewed source after self-address relocation;
  public signatures/imports match after debug-argument-label normalization.
- Dedicated keeper funded0.25 testnet SUI; no EVE/AdminCap. Persistent30-second user
  timer enabled, private configuration/signer and versioned source snapshot. Healthy
  autonomous runs verified. No reward/price jobs exist, so real payment remains
  unverified; do not claim a completed user payout or end-to-end wallet flow.
- Web manifest: actual IDs, rewardsEnabledtrue/wageringEnabledfalse. Real-book
  browser checks at320/390/1440 PASS; no mocks/wallet signatures. Website cutover
  pending. Existing House/HOLD/balances and productionea9de180 unchanged so far.

No fabricated markets/rewards/bets were created. No EVE funds moved. Pricing stays
disabled pending authenticated current oracle access; no price markets were made.

## Completed verification

- 54 Move tests, including permissionless paid-replay, exact conservation/u64 edge,
  explicit equality, first-crossing/confidence/time/feed rejection, creator
  exclusion, real World Item handoff, sponsor-self/second/wrong-origin rejection,
  exact quantity, deadline refund and pause independence.
- 483 frontend tests (23 book-specific); TypeScript,8 Origins canon checks,
  approved scanner of the **exact dapp directory**, production Vite build,
  git diff checks. Existing large-bundle warnings remain; no optimization claimed.
- 7 keeper tests, including durable-before-broadcast and identical-byte recovery
  after lost response; actual OS-lock smoke check before config/signer load.
- 8 fixture-only browser checks at320/390/1440: market/reward poll invalidates
  confirmation, exact conditions, no horizontal overflow, error distinct from
  empty. Separate unmodified production preview fails closed at390/1440.
- 15 live read-only verifier simulations: USDC sample and configured BTC/ETH
  historical leaves accepted; four mutations each rejected. These are canonical
  Pyth/Wormhole calls, not deployed book lifecycle or a live historical API test.
- Clean production build: only book/delivery/price, no test-only/combat entry points,
  current World and pinned Pyth/Wormhole origins. Matches unsigned publication
  simulation build. Dependency verification and unsigned publish dry-run PASS.
  Estimated gas81,529,600 MIST. Dry-run IDs are not actual publication IDs.
- Independent staged implementation review PASS; see `REVIEW.md`.

## Publication/activation gates

1. **Custody exception authorized.** Raw approved Jetson2 alone for this deployment
   at20:21 CT, message1562636926295740447: “Jetson2 should be good enough for this
   deployment.” One verified off-host backup is accepted for this release; a
   second copy is deferred, not falsely marked verified. Existing backup restore
   and independent signature proof PASS. Refresh immediately before publication.
   Existing publisher/custody remains
   `0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a`.
   See `custody.json`, `network-recovery.json`, `jetson2-restored-signing-proof.json`.
2. **Price activation only — oracle access.** Secure PYTH_API_KEY request expired unanswered. Current
   authenticated exact-target retrieval, feed catalog and durable service-secret
   provisioning unverified. Public posted proofs establish verifier feasibility,
   not continuous availability. No account purchase is authorized. Independent
   split-release review PASS: item rewards and expiry refunds have no oracle
   dependency and can deploy first. Keep zero price markets and AdminCap only
   in custody; wageringEnabled=false, rewardsEnabled=true after real receipts.
   This is not a separate onchain price-pause flag.

## Exact resume sequence (already authorized work)

1. Honor the explicit one-backup exception for this release. Refresh Jetson2
   signing proof immediately before publication; custody already recorded.
2. For later price activation, obtain oracle credential via protected input, verify
   authenticated catalog and signed first-crossing responses for the exact pinned
   feed/state pairs. Generic documentation's Beta note must not override actual
   upgraded canonical verification. If IDs/API semantics change, edit/review/test
   source before price activation. Do not enable prices on a guessed endpoint.
   Missing credential does not block the reviewed rewards-only release.
3. Recheck source hashes, current World/EVE, chain4c78adac and wallet. Rebuild clean
   production artifacts and unsigned dependency-verified dry-run if source changes.
   Source snapshot must have its own new tag; do not move the original pilot tag.
4. Publish **only cradleos_book** with pinned Sui1.81.0 and existing client config.
   Record actual digest/package/BootstrapCap/UpgradeCap/custody immediately. Compare
   runtime ABI/type origins to current `abi-public.txt`; no test-only functions.
   Consume BootstrapCap once via `book::create_book<CURRENT_EVE_COIN_TYPE>`.
   Record Book/AdminCap owner and exact version/tenant/empty lists. No migrations
   of other packages or existing player state. No cap immutability without Raw.
5. Verify real current Character/Item/Pyth inputs by unsigned simulations. Create
   no invented events or wagers. Live wallet lifecycle needs consenting users;
   do not fabricate coverage from fixtures.
6. Provision/fund gas-only keeper, verify journal/lock/timer and an autonomous run.
   Observe a genuine qualifying proof, finalization and payment/refund. Only then
   state automatic payouts are operational. Keep per-template activation gates
   accurate; unresolved price access must not be described as live.
7. Fill frontend manifest from real receipts, review actual IDs and affected
   checks. Commit/push reviewed source, run PRIMARY_DEPLOY gates, publish same
   dist to cradleos primary only. Verify exact live HTML/JS/CSS and affected UI.
   Rollback web target ea9de180; Move publication cannot be rolled back.
8. Update memory/receipts with actual deployment and verification gaps. House
   wagering HOLD is unrelated and remains untouched.

Toolchain: `/home/rawdata/.openclaw-captain/workspace/tools/sui-testnet-1.81.0/sui`.
Client config: `research/eve-cycle7-clean-wipe-20261002/client.yaml` in workspace.
Package build environment `testnet_stillness`. Never skip dependency verification.
