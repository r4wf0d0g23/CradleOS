# Betting book — reviewed staging, NOT DEPLOYED

Current release replaces the initial pilot/fleet design. Old receipts are in
`archive-initial-pilot/`; never use their ABI or simulated IDs for deployment.
Current exact source/bytecode/build hashes: `provenance.json`.
Reviewed source: `507712e7769c7c531921f32458f0590b9cec77df`; local tag
`publish/cradleos_book-oracle-2026-10-21`. Source/tag are committed locally, not pushed.

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

No chain write/signature, market, wager, funding, service activation, or website
cutover occurred. Manifest has blank IDs; wagering/rewards disabled. Existing
casino House/HOLD, balances and production ea9de180 are unchanged.

## Completed verification

- 54 Move tests, including permissionless paid-replay, exact conservation/u64 edge,
  explicit equality, first-crossing/confidence/time/feed rejection, creator
  exclusion, real World Item handoff, sponsor-self/second/wrong-origin rejection,
  exact quantity, deadline refund and pause independence.
- 483 frontend tests (23 book-specific); TypeScript,8 Origins canon checks,
  approved scanner of the **exact dapp directory**, production Vite build,
  git diff checks. Existing large-bundle warnings remain; no optimization claimed.
- 6 keeper tests, including durable-before-broadcast and identical-byte recovery
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

## Concrete publication/activation blockers

1. **Second off-host backup.** DGX2 Tailscale reauthenticated October21 at20:16 CT.
   Pinned Jetson2 SSH succeeds; existing backup restored and a fresh non-transaction
   Sui PersonalMessage independently verified. See `network-recovery.json` and
   `jetson2-restored-signing-proof.json`. Exactly ONE off-host backup verified.
   DGX1 is offline on Tailscale (last seen September18); Tailscale SSH times out and known
   LAN SSH reports No route to host. This does not establish physical power state.
   FRESH_DEPLOY_PROTOCOL §8.1 still requires two operator-attested readable off-host
   backups; refresh the signing proof again immediately before actual publish.
   The Oct2 exception covered only that prior release. Existing wallet/custody:
   `0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a`.
   No need to reselect it; no false attestation, host-key bypass or key movement.
2. **Oracle access.** Secure PYTH_API_KEY request expired unanswered. Current
   authenticated exact-target retrieval, feed catalog and durable service-secret
   provisioning unverified. Public posted proofs establish verifier feasibility,
   not continuous availability. No account purchase is authorized.

## Exact resume sequence (already authorized work)

1. Restore DGX1 or verify another explicitly approved second off-host backup;
   confirm physical-host attestation. Jetson2 is already verified. Refresh its
   signing proof immediately before publication. Record custody before signing.
2. Obtain existing oracle credential via protected input (never chat), verify
   authenticated catalog and signed first-crossing responses for the exact pinned
   feed/state pairs. Generic documentation's Beta note must not override actual
   upgraded canonical verification. If IDs/API semantics change, edit/review/test
   source before publishing. Do not enable price markets on a guessed endpoint.
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
