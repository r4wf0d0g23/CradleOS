# Frontier Arcade release — 2026-11-08

- Public collection: https://frontier-arcade.pages.dev/
- Immutable deployment: https://a94c61d6.frontier-arcade.pages.dev/
- Source:68c7192 (gallery sourcec5df77b), branchcycle7-vestiges-20261002.
- Project:frontier-arcade; new isolated Pages project, production labelmain.
- First release: no previous collection deployment. Keepa94c61d6 as future rollback baseline. CradleOS integration can separately roll back to its prior two-game deployment21329794.
- Existing Frontier Drift/Rift Run projects, code, origins and save keys are untouched.

## Gates

-42/42 pure engine/profile tests, eight legal-input simulation wins, independent engine auditPASS.
- Eight actual-browser complete wins through Playwright keyboard/mouse inputs and accelerated browser time, read-only state feedback, no writable state injection. Actual terminal award-once/retry/reload checked. `research/browser-completions.json` records results. Initial Gate harness failed to rearm pointer capture after its own button click; corrected harness wins297.12simseconds/4charges. No game engine change for this test correction; initial failed receipt retained and labelled.
- Independent shared-shell review:32layout/lifecycle cases across8games ×1440/390/320/568widths; held keyboard controls, real multitouch ownership, native rail scrolling without purchase, fullscreen, pause/release, record isolation, denied storage and clipped renderingPASS.
- Runtime source formatted with existing Prettier after review, then42tests repeated; no dependencies added. Canonical source copied with all47file hashes exact beforecommit/deploy. Final public identity is anchored by `research/runtime-manifest.json` and `research/live-assets.json` rather than pre-format review hashes.
-46/46 served files atpublic and46/46 atimmutable origin match sourceSHA256. `_headers` is platform configuration, not publicly served; CSP/frame restriction checked on eachHTML.
-Live16game input/pause/resume/no-overflow groups at390portrait and568landscape, zero errors/failed requests. Separate stagedCradleOS24checks include all10actualpopups at1440/320, original origins/nullopener, gallerybounds/images/reloadat4sizes. Receipts `research/live-smoke.json` and `../deploy/arcade-collection-20261108/preview-gallery.json`.

## Scope / limitations

First-release finite arcade courses; no physical-device or average-human difficulty certification. No in-flight resume, account sync, multiplayer, wallet, money or official gameplay-fidelity claims. Records remain browser-local; sourceREADME documents format, same-game simultaneous-tab counter limitation and maintenance/retirement procedure. No recurring paid monitor scheduled.

CradleOS integration published as0e772ead at https://cradleos.io/#/arcade, source68c7192. Prior two-game rollback21329794. Independent collection production reviewPASS: currentapp/style/profile hashes,320lobby8, eight timed rhythm taps/pause and568scroll-safe Scrapline build/wave; CSP intact,0errors/failedrequests. SeeSHELL-REVIEW.md andshell-live-review.json. CradleOS final public verification is recorded in ../deploy/arcade-collection-20261108/RELEASE.md.
