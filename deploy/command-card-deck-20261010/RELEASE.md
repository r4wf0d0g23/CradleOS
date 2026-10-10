# Shared command deck — 2026-10-10

Raw requested Fleet Duel-style visual upgrades across the other card games.

## Delivered

Six currently playable games share stateless metallic card faces and backs: Command Deck, Command Baccarat, Three-Card Sortie, Frigate Duel, Transit Window and Signal Chase. Dark metal frames, cool/warm suit accents, readable standard ranks/suits, framed current Frontier icon artwork, native three-Lai artwork for rank-only cards and geometric CRADLE backs. Original deal, flip, winner, hover and stack behaviors remain with their existing wrappers. Blackjack now names its unchanged suit indices Spades/Hearts/Clubs/Diamonds instead of thematic names.

No explanatory UI copy added. Fleet Duel itself is unchanged. Shared AstralCard also skins gated testnet blackjack, without activating it or testing wallet execution. Other unactivated legacy games remain outside this pass.

## Boundaries

Only shared card renderers, the new stateless furniture/style, two legacy Andar image selectors and one existing suit-name test expectation change. Legacy selectors narrowed to direct-child images so they cannot override nested ship formations. A <=360px Signal Chase corner adjustment keeps both digits of10 visible in full overlapping fans.

All18 protected files in `boundaries.json` match runtime0c1f790 byte-for-byte: engines/session/ledger/RNG, clocks, Fleet Duel, Warp Run, Probability Drive, Lai and artwork. No rules, odds, payouts, balances, schema, financial/SSU guards, chain/backend writes, dependencies or asset files changed. Existing Animated default and explicit System/Instant retained.

## Verification

- Independent native source gate PASS; review caught the legacy Signal Chase image-size collision, fixed and delta-reviewed. No concealment, rank/ace mapping or timing blockers.
- 384 tests /42 files PASS. The existing blackjack expectation changed from K · Gates to K · Diamonds to match the intended suit label. No runtime rule changed to satisfy a test.
- TypeScript/Vite build, Origins8 and approved exact-directory IOC scanner PASS. Wrong-package-ID event-query search clean.
- 18 fresh natural Play Money preview rounds at320/390/1440: all six games, real transforms, early face masking, face/rank/suit/artwork checks, stable ledger, no horizontal overflow or errors. `qa/preview-browser.json`. This batch began before the narrow legacy-selector fix; three additional fresh Signal Chase rounds on that fix passed at all widths (`qa/final-andar-browser.json`). Other runtime behavior is unchanged.
- 13 blackjack action/lifecycle groups: actual fresh deals plus engine-produced saved hands; concealed hole, hover/pause, hit, double, split unaffected seats, exact outcomes, reload, resize, synthetic hidden-tab and motion preference changes. No ledger mutation by animation; no errors. `qa/blackjack-browser.json`.
- Final long Signal Chase fixture: actual unchanged-engine saved hand >20cards with two10 ranks in the final fan;8 visible cards checked at320/390/1440. Full rank corners unobscured by neighboring cards (three sampled points per corner must hit that same card), lead/wing image size hierarchy and exact restored ledger. `qa/long-fan.json`. This narrow check caught and corrected the320px two-digit occlusion; last delta is cosmetic CSS only, not falsely represented as a fresh rerun of earlier suites.
- Parent inspected phone/desktop faces, backs, split hands and fans. Native submission-ready visual/evidence gate PASS. Final narrow-corner delta and three-width long-fan review PASS.

Browser scope: viewport-emulated Chromium, browser-local free Play Money. Preview blackjack and long-fan fixtures are not live natural RNG or physical-device tests. No wallet signing, testnet wagering or chain changes.

## Publication

- Runtime `8198298fc6563a88c4d193921d772e1ebaab6d82`, committed/pushed.
- Cloudflare Pages `a4bf4e75`; immutable https://a4bf4e75.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino.
- Eight production files exactly match dist: JS, CSS, native Lai WebP, current icon manifest and four card icon PNGs. `live-build.json`.
- JS `index-B4cyo4RK.js`: `4c780c9457814d5df5474a475a6b8f8dd8077fc6c2dfbbaee91324853c561c8c`.
- CSS `index-DvQebkZc.css`: `b49de555bf4bb65609c935141e25183a90f52038af79ddcfc1ffe4975fa01ed2`.
- Twelve fresh natural-RNG live rounds PASS: all six games at390 and1440. Real transforms, face concealment, rank/suit/artwork checks, stable committed ledger and no overflow. Zero page errors or failed card assets. `qa/live-browser.json`. Saved-hand/action/lifecycle fixtures remain preview-only, not claimed as fresh live cases.
- Task-owned preview5225 stopped; port verified closed. Canonical service-hosting worktree and unrelated Wrangler directories preserved.
- Rollback Pages `28ae3ec8` / runtime `0c1f790f40329e67122b1c291ecd7961ac8be7c2`. Primary origin only; GitHub Pages remains redirect-only.

Final independent native delivery gate PASS: runtime,8exacthashes,18protectedfiles,384tests42files,18+13+3+3 scoped preview groups and12fresh live rounds reconcile. Live mobile/desktop screenshots readable; preview5225 closed. Reviewer's additional immutable Pages URL fetch returned HTTP403 in its environment; primary-origin live evidence remains valid, and no independent immutable-URL availability claim is made. Evidence-only receipt; no runtime changes.
