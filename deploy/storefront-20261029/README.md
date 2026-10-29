# SSU storefront release — 2026-10-29

Raw authorized adding SSU storefront options separate from tribal storage (Discord1565407155635355649). Staged, not yet deployed.

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
42 Move integration tests (native world) and 50 targeted frontend tests; full frontend715. Browser13 groups, real components/builders, simulated reads/signing, zero realtransactions. Review fixed duplicate approve races (including keyed identity remount), poisoned shop-directory entry isolation, stale Character permissions and destroyed-SSU earnings UI. Native reviewer (not Opus) passed source milestone; release gates separately recorded below.

Jetson2 standing exception applies; fresh restored-backup PersonalMessage proof required, no second backup claimed. Custody publisher remains 0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a.
