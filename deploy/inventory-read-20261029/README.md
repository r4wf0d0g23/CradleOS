# Inventory/API repair — 2026-10-29

Raw reported the embedded inventory showing `sui_getObject is not supported` after the structure-discovery repair. This release migrates the inventory-specific read graph; it is not a blanket removal of all legacy APIs elsewhere in CradleOS.

## Scope

- Supported public Sui testnet gRPC, uncached reads with bounded timeouts. Strict batch cardinality and IDs, exact types, ownership and complete pagination. Typed NOT_FOUND alone represents absence.
- Authoritative SSU inventory keys derive exact dynamic-field IDs; every partition's parent/type/key and item key/type/tenant/numbers are validated. Inventory capacities match item volumes. Parent, partitions and freeze marker are reread to reject mixed versions.
- Freeze marker's synthetic `dummy_field: bool` layout was read from the live current-world package. Empty Move struct key is BCS `[0]`; a present marker's key/value must both contain false.
- Policy registry, ID mapping, policy type and SSU binding use supported reads. Missing policy and unavailable policy remain distinct. Both deployed single-tribe and alliance schema are recognized. Saved rules remain informational, not a claim of enforced shared permissions.
- Inventory identity and owned SSU caps come from the same current-world structure snapshot. Shared descriptor/operator and wallet-transit-item readers are migrated. No stale tribe or unverified shared-SSU fallback, no partial wallet-item list.
- Keyed wallet remount, request generation and cleanup discard stale inventory reads. Failed reads hide old stock and show unknown counters; explicit empty appears only after successful reads. Failed shared discovery never implies no storage. Policy failure clears old policy while preserving independent successful stock reads.
- Existing shared-transfer pause, signer quarantine, confirmations and owner-revocation scope stay unchanged. No contract publication or chain transaction is part of this repair.

## Checks

- Independent native architecture and final code reviews PASS; reviewer independently ran 64 focused tests.
- 586 tests / 58 files pass; TypeScript and production build pass.
- Origins canon guard: 8 checks; exact-dApp approved IOC scan: clean.
- Initial live read: 8 owned SSUs, 16 partitions, 264 item stacks. A later full ownership enumeration discovered a newly added ninth SSU; `current-read.json` is the fresh comparison source for browser checks, not the earlier cap sample. `live-read.json` includes exact SSU summaries, layouts and personal-cap identity. Wallet transit-item enumeration succeeded with zero items; eligible shared discovery returned none for the checked identity. Positive eligible shared-descriptor behavior is covered by fixtures, not claimed live.
- Browser verification uses actual release code and chain reads with a synthetic read-only Wallet Standard account. It never signs or executes transactions; it does not reproduce EVE Vault extension/PIN or in-game embedded webview behavior.
- Chromium sandbox remains enabled; authenticated egress is relayed via TLS-validating Node fetch. TLS verification is not bypassed.

Publication and final production evidence recorded in release.json and live-browser/live-assets receipts. Previous production rollback: 6e88c302 (source b565777).

## Reproduce the read-only checks

From repository root, bundle `read-entry.ts` with the installed dApp esbuild into this directory's ignored `read-bundle.mjs`, then run `verify-read.mjs`. Run `verify-browser.mjs` with `INVENTORY_QA_BASE` (preview defaults localhost5341; production https://cradleos.io) and `INVENTORY_QA_LABEL=preview|live`. Browser expectations are anchored to the newly captured `current-read.json`; live stock can legitimately change between reads. `verify-assets.mjs` checks production hashes with `INVENTORY_RELEASE_SHA`.
