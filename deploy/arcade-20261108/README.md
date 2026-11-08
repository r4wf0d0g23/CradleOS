# Arcade tab — 2026-11-08

Request: Raw, Discord1569081188134555890, add arcade games to cradleos.io in an Arcade tab.

Scope: public `/#/arcade` and `/arcade` panel, normal/compact/kiosk navigation, two concise game cards with actual gameplay screenshots. Play uses ordinary new-tab anchors to the established Frontier Drift and Rift Run origins. No wallet, auth, game code, save schema, service, contract or casino changes. No new dependencies.

Existing game response policies prohibit cross-origin embedding (`frame-ancestors self`/`none`). Preserve these policies and top-level game origins; do not copy or iframe the games. Browser-local saves remain at each original origin. No cross-origin migration or cloud saves claimed.

## Preview image provenance

Cropped/resized to800×450 using Pillow ImageOps.fit, WebP quality85 from existing game verification screenshots:
- frontier-drift.webp: workspace artifacts/frontier-drift-my-ship-20261012/research/aim-live-laser-1440.png (actual live input).
- rift-run.webp: workspace artifacts/frontier-drift-arcade-20261106/research/sprites-live-1200-5.png (live renderer with staged boss/sector fixture).

No generated replacement game art. Game details remain concise; technical provenance stays here.

## Checks

- TypeScript + Vite build (`VITE_BASE=/ npm run build`).
- Origins canon guard8; targeted Origins tests7; approved exact-directory IOC scanner.
- verify-browser.mjs: four desktop/phone/landscape sizes, root tab and public hash/path, reload, kiosk navigation, image loads, preinteraction bounds, real popup link clicks/taps, actual game launches and simple play/pause input, null opener. Public responses use the established TLS-validating Node relay; no gameplay fixtures or signed-wallet actions.
- Existing game simulations are intentionally not rerun: this change only launches unchanged public games.
- Independent workspace-required review uses available inherited native model; Opus is not available in native model choices and is not claimed.
