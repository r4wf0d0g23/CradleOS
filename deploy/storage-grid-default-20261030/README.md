# Storage grid default — October 30, 2026

Raw requested “Default the grid view” (Discord1565695324557676687).

Only three runtime lines change in useStorageView.ts: fresh/missing/invalid saved preferences use Grid; initial storage-error fallback and server snapshot use Grid. Explicit saved List stays respected. Preference key/setter/cross-card synchronization unchanged. No wallet, permission, inventory, transaction or contract changes; storefront view already defaults to Grid separately.

Independent native source review PASS. TypeScript/build, Origins8 and exact dApp IOC scan pass. No new unit tests for this reversible preference change; scoped browser release checks verify fresh Grid, saved List after reload, toggle and mobile layout using actual chain data and a read-only synthetic wallet. No signing or inventory changes. Production receipts record source/deployment/rollback and live asset/browser verification.

Final independent deployment review PASS: source5eba751a, Pages9fc2e31d; five exact assets, preserved root/partner routes and browser behavior confirmed. Preview5358 stopped.
