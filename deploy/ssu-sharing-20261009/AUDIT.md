# SSU sharing recovery and redesign — 2026-10-09

## Recovered work
Prior run c97cec49 completed read-only official-source/ABI/storage research in workspace research/ssu-sharing-20261009 and stopped before application edits. Canonical source610bc11 was clean except pre-existing Wrangler directories; no new release or chain mutation receipt was present. Current world-contracts main remains d33ff232bd3878e8f9ad0721e18564b21facc925 (GitHub rechecked October9).

## Confirmed defect
Deployed SSU extension d73c02463c1c679c94a5d7a133a944798870a2da302a6f4f52f626aa0010721e exposes public new_auth() without arguments. Official storage_unit APIs trust that witness, not the CradleOS policy. Tribe/allow/deny settings therefore cannot be represented as an enforced security boundary. Source and deployed ABI agree. Prior registry snapshot has one policy; refreshed STRG-1 (0x63e80d174bdcb508dad45dc9883c235ff31cc49968b854bf02a0ede5eb6d71e7) still authorizes it. This affects extension-accessible inventories, not just the communal pool. Clearing a policy is NOT revocation. A package upgrade cannot erase already-callable old package bytecode.

## Web-release design
- Preserve orange/charcoal/ivory Frontier palette and current verified item/UI icons; labeled touch controls, no emoji-only operation controls.
- Separate owner storage, personal storage, and shared pool with visible counts, search, independent per-partition capacity, and explicit ownership. On-chain inventory data is public; labels do not promise confidentiality.
- Remove unsafe enable/configure/move-to-shared affordances and fail closed in exported shared-operation builders. Retain safe return of wallet-held items to personal storage.
- Read actual extension binding/frozen status, not policy existence. Errors remain unknown with Retry; never convert failed reads to a safe/empty state.
- Independent review rejected automatic recovery+disable: deposits arriving during wallet approval can remain locked after revocation; shared inputs provide no version compare-and-swap. The web release offers REVOCATION ONLY with explicit informed confirmation: no items move; listed and newly arriving shared stock may become inaccessible pending separately reviewed recovery. Borrow SSU OwnerCap, revoke extension, return cap atomically. Fresh authoritative contents and binding before construction; frozen/wrong binding/stale preview fail closed. Owner/personal partitions are not moved. No new_auth witness calls, cross-SSU moves, wallet-item transfers or automatic signing.
- On-chain deployment/replacement is NOT part of this web release. No current-world state, wallet custody or funds are changed by the agent. Quarantine is only a client guard until the owner signs revocation.

## Sources
https://github.com/evefrontier/world-contracts/tree/d33ff232bd3878e8f9ad0721e18564b21facc925/contracts/world/sources/assemblies
Local current package: cradleos_ssu_access/sources/ssu_access.move.
Saved chain evidence: workspace research/ssu-sharing-20261009/live and recovered/.

## Completed verification
- Independent native review identified the shared-stock signing race; automatic recovery was removed before release.
- Opus 4.8 milestone review: PASS, no blockers. Reviewed revocation-only flow, ownership, freeze, identity/staleness guards and signer-boundary quarantine. Retained recover_to_owned is the existing manual recovery of an Item already in the caller's wallet to that caller's personal partition; it is not automatic shared-pool recovery.
- Fresh current-world normalized ABI confirms revoke_extension_authorization(StorageUnit, OwnerCap) has no generic/context argument. Unsigned devInspect: actual owner succeeds; different sender aborts in borrow_owner_cap. A subsequent read confirms the real extension is unchanged. See live-simulation.json. No execute, sign, or submit RPC was called.
- Live authoritative reader verified STRG-1 owner and open partitions. At 2026-10-09 13:56 UTC the shared pool was empty; extension enabled, not frozen. This is a point-in-time observation, not a promise about signing-time contents.
- Full Vitest suite: 348 tests / 35 files passed. Includes 29 new safety tests for partition completeness, mixed snapshots, strict unknown/error handling, offline revocation, ownership/freeze/staleness, blocked builders and pre-wallet quarantine.
- Browser fixtures render the actual production components at 320/390/1440px. Owner/nonowner/frozen/foreign/no-extension/read-error views, area filters/search, consent gating/cancel, independent capacity and collapse verified. No overflow, all tested buttons >=44px, no runtime or icon asset failures. See qa/browser.json and screenshots. Fixtures do not prove a connected-wallet production session.
- Origins canon guard: all eight checks passed. Approved dependency IOC scanner: clean, executed via bash because its executable bit is unset. Exact canonical dApp directory scanned.
- Browser harness files live only in this release evidence folder; no fixture route or test wallet is included in the production build.
- Final TypeScript + Vite production build passed. Existing bundle-size advisory remains non-blocking; no build errors. Actual anonymous production-build route resolves inventory to storage and retains the existing EVE Vault wallet gate. Connected-wallet execution is intentionally not claimed or performed.
- Final runtime files: index-qW0qe1v0.js SHA-256 730e01d8948637966692213650632773a70e4b9324100a6045591f54ead1e5a2; index-BTp7no0d.css SHA-256 c899b2f1293e82c64e875e4c367e183cbdde412a5c73cb248862cc5edc2eb3e9.
