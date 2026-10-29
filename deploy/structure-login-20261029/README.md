# Structure discovery and wallet-lifecycle repair — October 29

## Scope

Raw authorized “Fix it” after reporting Tauriskus's EVE Vault PIN / empty-structures / repeat-login issue. The confirmed application fault was legacy JSON-RPC object reads returning removed-method errors which CradleOS interpreted as deleted objects. No evidence established that the separate Vault PIN prompt has the same cause.

This release uses a dedicated supported Sui testnet gRPC reader for current-world structures. It reads complete wallet profiles, authorized characters, full owned-object pages and batched objects; verifies current-world types, wallet/character ownership, object IDs and OwnerCap bindings; and omits only typed NOT_FOUND targets. Valid optional metadata and unlinked energy sources remain supported. For multiple current wallet characters, select the complete live holdings set with most structures (version tiebreak), never combine characters in one transaction context.

The dashboard and Structures panel consume one identity/holdings snapshot, cancel obsolete query reads and reset account-scoped UI on wallet change. Failed reads show unavailable, not zero. Remaining legacy single/batch helper errors also fail explicitly instead of masquerading as deletion.

Identity verification remains cryptographic and once-per-connection. A connection-generation guard suppresses duplicate in-flight requests and discards stale signature/verification completions after account changes. No PIN storage, Vault extension patch, automatic approval, wallet unlock change, weakened identity gate, or transaction execution was introduced. Casino/House/contracts/currency and backend workers remain unchanged.

## Verification

- Full frontend suite: 551 tests pass (55 files); targeted independent review: 27 tests pass.
- TypeScript and production build pass; Origins guard 8 checks; approved IOC scan clean for this exact dApp.
- Supported live read: 139 structures linked to Tauriskus's current character; 126 online; 32 nodes, 85 assemblies, 14 turrets, 8 storage units. Every returned owner-cap binding checked. See `live-read-verification.json`.
- Actual React verification hook browser test: six lifecycle checks in `hook-browser.json`; deferred wallet/verifier fixtures, not a real EVE Vault PIN/signature. Harness `verify-hook.mjs`.
- Independent architecture + implementation review: PASS after correcting nullable-option and multiple-character cases.
- Full app browser and live deployment receipts are recorded separately when complete.

## Limits

The user's real browser-connected account/Vault version and PIN sequence remain unverified. Do not describe the PIN loop as reproduced or definitively fixed. The deprecated backend/index and other unrelated legacy API callers are not globally migrated by this frontend repair. The stale index remains disabled for ownership discovery. Optional location enrichment may remain unknown when its source is unavailable.

Production rollback baseline: Cloudflare Pages `302e8112-d3c2-4230-9596-3df11428f9a3`, source `81d901f`. Only primary `cradleos.io` is deployed; GitHub Pages remains redirect-only.
