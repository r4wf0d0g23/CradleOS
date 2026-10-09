# SSU recovery release — 2026-10-09

- Primary app: https://cradleos.io/#/storage
- Source: ff14b6ffeab70a08cd6d1a9967d9b5b05f61f17b (pushed cycle7-vestiges-20261002).
- Cloudflare Pages production deployment: 70d7eed4; https://70d7eed4.cradleos-d75.pages.dev.
- Previous rollback: ace82e52 (web-only casino / Null Vault release). Warning: rolling back also removes this SSU safety quarantine; do not revert for cosmetic reasons.
- Same canonical dApp build directory uploaded. Three changed files uploaded; 1047 unchanged files reused. Wrangler dirty warning was only the two pre-existing untracked .wrangler directories; tracked source was clean. GitHub Pages redirect untouched.

## Delivered
Icon-led owner/personal/shared storage cards, filters/search, per-area capacity, ownership and active-extension status, explicit error/retry, mobile touch targets, orange/charcoal/ivory palette. Unsafe sharing controls removed; shared builders and common signer fail closed. Manual return of an already wallet-held Item to personal storage remains available.

Owner mitigation is revocation only: fresh preview and explicit acknowledgement, wallet confirmation, atomic OwnerCap borrow/revoke/return. No stock movement, no replacement extension, no new policy. Shared stock can become inaccessible after revocation, including deposits arriving during wallet approval. This consequence is disclosed before confirmation.

## Verification
- 348 tests / 35 files; final targeted 43 safety/compatibility tests also pass.
- TypeScript + Vite production build, Origins 8 checks, approved exact-directory IOC scan pass.
- Native architecture review and Opus 4.8 security gate PASS. Automatic recovery was rejected and removed before publication.
- Real current-world unsigned devInspect succeeds for actual owner, rejects wrong sender; live state stays unchanged (live-simulation.json). No signed transaction, execute RPC or chain deployment.
- Actual component fixtures: owner/nonowner/frozen/foreign/no-extension/error at 320/390/1440; filter/search, preview consent/cancel, capacity, collapse and 44px controls pass (qa/browser.json). Connected-wallet production execution not performed.
- Actual live route at 320/390/1440 preserves existing wallet gate with no runtime errors, asset failures or overflow (qa/live.json). Production authenticated inventory is not claimed as tested.
- Live JS/CSS, icon manifest and six action/area icon assets exactly match dist (live-build.json).

## Outstanding on-chain fact
At last read, STRG-1 still authorizes the affected extension and is not frozen. The current shared pool was empty. Owner storage and the shared pool remain exposed until the owner signs revocation. A package upgrade, saved policy change or UI warning alone does not secure the old callable code. Replacement sharing and recovery of retained pool stock require separately reviewed contract work.

Final Opus 4.8 deployment-evidence review: PASS. Production/fixture/simulation boundaries and outstanding owner action are accurately disclosed. The live report contains nine matched files in total (2 bundles + 1 manifest + 6 icons).
