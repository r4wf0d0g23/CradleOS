# Storage views and exact-amount drag/drop — October 29, 2026

Raw requested grid/list views and drag/drop with specific amounts after a player
reported own stock could not be moved into the shared pool.

## Scope

- List/Grid selector, shared cosmetic browser preference, responsive cards.
- Drag a permitted personal stack onto Shared pool, or shared stack onto
  Personal storage in the same SSU. Drop opens a quantity/consent review only.
- Exact positive whole amounts bounded by available source stock and u32;
  Max shortcut, editing clears consent. Explicit wallet signature required.
- Deposit/Withdraw/Recover buttons provide touch/keyboard alternatives.
- Other pilots, owner-main, foreign/external/cross-SSU drags and same-area drops
  are rejected. No payload quantity, authority or cross-unit transfer inferred.
- Fresh permissions/stock and exact version comparison before signing;
  changed wallet/network/context cancels old preparation. Separate signer lock
  survives snapshot refresh; no duplicate wallet request while one is pending.
- Failed initial Character-cap lookup is retried by card Refresh, with a short
  unavailable status instead of silently hiding deposit access indefinitely.
- No contract, policy, custody, stock or backend changes. No native-wallet or
  real player transaction claimed; simulations/fixtures explicitly labeled.

## Reported SSU: current read, not a reconstruction of the screenshot

live-storage-state.json at 15:22Z: Reap Shared storage has the new private-witness
extension, enabled tribe 98000666, resolved owner Character cap and deposit
permission. Tauriskus has no stock in his Character-cap personal partition.
There is one owner-main stack, two other pilots' partitions with four stacks
each, and zero shared stacks. Owner-main is deliberately NOT repurposed as
personal stock. Existing contract does not offer owner-main -> shared; no
unsafe temporary extension change is added to work around it.

## Verification

655 frontend tests / 62 files, TypeScript/production build, eight Origins checks,
exact-directory supply-chain scan. Isolated browser uses actual UI/PTB builders
and simulated read/wallet adapters, no submitted transactions. Fifteen groups:
real mouse drag in both views/directions and exact serialized quantities,
invalid amounts, cancellation/consent reset, denied sources/external/cross-SSU,
stale wallet/network/stock, pending-signature refresh lock, missing-cap recovery,
blocked preference storage, and responsive 320/390/650/1440.

Production-preview and live browser use real chain data, a read-only synthetic
wallet that rejects all signatures, and an explicitly injected initial cap-read
failure to prove card Refresh recovery. No TLS verification bypass.

Unsigned checks-enabled chain simulation also passed with one item from a
permitted pilot’s actual personal stock into the shared pool. No simulated
stock seeding, configuration change, signing or broadcast. See
live-transfer-simulation.json; this is not a real signed player transfer.

## Deployment

Only Cloudflare Pages cradleos -> https://cradleos.io. Partner report/backend,
contracts and existing House HOLD untouched. Previous rollback Pages020f14f8;
source 4ee4045, receipt 3af8b0d. Source, release, hashes and final live review are
recorded alongside this file after deployment. Preview5347 is temporary.
