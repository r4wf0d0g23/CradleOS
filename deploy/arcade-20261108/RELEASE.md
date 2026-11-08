# Arcade live — 2026-11-08

- Public: https://cradleos.io/#/arcade (also /arcade)
- Source: f628a7b1c2783254dc313ff6122b713cbce85559
- Cloudflare Pages deployment:21329794, https://21329794.cradleos-d75.pages.dev
- Rollback:b30825bf-01ac-438c-8646-c981eb829601 (runtime aff8d52)

Wallet-free Arcade tab in standard, compact and kiosk navigation. Frontier Drift and Rift Run cards use provenance-recorded gameplay previews and ordinary new-tab Play links. Existing game origins, headers, saves and game code remain unchanged. No contracts, services, wallet handlers or casino logic changed.

TypeScript/Vite build, Origins canon8, targeted Origins tests7, approved exact-directory IOC scanner, static guide/sitemap/noindex checks pass. Preview and production each12 grouped browser cases at1440×960,390×844,320×568,568×320 cover normal navigation, public hash/path/reload, kiosk return, images, horizontal bounds, final action hit-testing, both actual game launches and play/pause. Zero page errors and failed network requests. TLS-validating public-response relay, isolated sandboxed Chromium; no signed-wallet or physical-device claims.

Independent review found the existing Activity pill obscured final Play at320px; scoped72px+safe-area bottom clearance fixed it. Final candidate16 review checks pass. Independent production check confirms public assets and320px wallet-free launcher, natural-bottom hit target, actual Rift launch/play/pause, null opener, no errors or failures. Inherited native reviewer, not unavailable Opus.

All7runtime/image files match dist at BOTH public and immutable origins. Root, /arcade and partner HTML reference reviewed bundles; partner noindex retained. Receipts:live-assets.json,live-browser.json,reviewer-live.json,REVIEW.md. No game deployments performed. Owned preview5369 stopped after verification.
