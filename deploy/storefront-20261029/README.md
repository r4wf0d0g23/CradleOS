# SSU storefront release — 2026-10-29

Raw authorized adding SSU storefront options separate from tribal storage (Discord1565407155635355649). Isolated testnet contract published and independently verified; reviewed website integration ready for deployment. No player SSU has been activated by this release.

## Model
- Isolated `cradleos_storefront` package and registry. No changes to tribal sharing Move package, policies or inventories.
- Dedicated SSU mode, one native extension/open pool. UI activates only default, unfrozen, empty open stock; onchain exact BCS emptiness guard rejects occupied/zero-volume items. Native binding has no getter: activation confirmation explicitly adopts storefront mode; not a binding CAS. Canonical owner can independently revoke/rebind through native APIs, never frozen automatically.
- One listing per item type, 100 types per shop. Fixed unit price in a full coin type, min/max/step quantities, exclusive end timer, per-character lifetime limits. Currency immutable for a listing; generic Move supports coin types, UI supports verified current EVE and SUI (9 decimals each). No barter, buy orders, auctions, price oracle or house treasury interaction.
- Stock owner-main or canonical owner personal inventory into same-SSU sale stock. Other pilots cannot supply someone else's shop or personal inventory. All recovery bounded by tracked sale stock, never arbitrary pool drain.
- Purchase atomic exact payment + native same-SSU buyer personal delivery. No Item/witness exports, no pending paid delivery. Expiry uses chain Clock. Stock and owner proceeds tracked separately; buy totals bounded u64.
- Shop public/tribes/pilots/hybrid/closed rules, deny wins. Shop open/paused and listing enabled separate. Limits are per-character, not Sybil-resistant per-human.
- Escrowed proceeds claimable only with canonical stored SSU cap, including after native SSU destruction. Cap transfer transfers proceeds rights; no stale payee. UI independently verifies cap custody and exact typed balance fields, no SSU dependency for claims.
- No SSU adoption/player inventory/payment transaction is signed by deployment. Owners opt in, configure/stock, buyers sign their own purchases.

## Verification
42 Move integration tests (native world) and 63 targeted frontend tests; full frontend728. Browser17 groups, real components/builders, simulated reads/signing, zero realtransactions. Review fixed duplicate approve races (including keyed identity remount), poisoned shop-directory entry isolation, stale Character permissions and destroyed-SSU earnings UI. Native reviewer (not Opus) passed source milestone; release gates separately recorded below.

Jetson2 standing exception applies; fresh restored-backup PersonalMessage proof required, no second backup claimed. Custody publisher remains 0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a.

## Publication and integration gate
- Source/tag: `72bd1cf8210752b69544bc0024bea82a2e94fa8a`, `publish/cradleos-storefront-2026-10-29-reviewed`.
- Transaction: `GdGJLuhewxRG2bQ8ADD6nh31jTdToDGxaeYCE7HMifDV`.
- Package/original: `0x2845dbb680315b6f579275b9553847d6dd118f17a9f91b837cc29ef44924853a`.
- Registry: `0x1f75791145a1c8ec7812120ccb52db4f05334ec7b4021bc4ead30998c2a990b1`.
- UpgradeCap: `0x91e1978364e41c5004fc1e6b2b217efa8af0305a02462c7c0499dc82c4636f72`; publisher custody above.
- Fresh restored Jetson2 signature verified at 17:02:48Z. Clean committed-source bytecode matches; 21 world modules exact. Independent effect equality, object-scope check, relocated bytecode, cap custody and registry verified. Initial post-submit NOT_FOUND was resolved by read-only retry; no rebroadcast.
- Six unsigned live-world checks pass, including SUI and current EVE native purchase/delivery/proceeds; wrong-wallet, stale-quote and exact-payment rejection pass. Registry remains zero, source SSU version unchanged. **No signed player purchase has been performed.**
- Raw gRPC shape proof caught decorated TypeName/Balance strings. Readers corrected with strict u64 and exact field identity/type/parent/currency checks. Real post-sale Shop JSON retained in raw-json-shapes.json; no persistent populated Shop was created.
- Final preview browser uses real chain reads and a synthetic read-only wallet. Activation review, owned SSU discovery, tribal/storefront separation, read failure recovery, disconnect and zero transaction-sign calls pass with zero page errors. Screenshots include desktop and 390px mobile.
- Rollback baseline: Cloudflare Pages `8b14f93c`, runtime source `0edbbef7dd84ead7c1c9fc2880e72c7c7e8d566e`. This release changes no backend service or existing tribal/casino package.
