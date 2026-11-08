# Arcade independent milestone review — 2026-11-08

Native inherited-model review; requested Opus model unavailable. Source review and actual preview Chromium; no deployment performed by reviewer.

## Scope

`src/App.tsx`, `src/components/ArcadePanel.tsx`, `src/components/ArcadePanel.css`, `public/arcade/*.webp`.

## Findings

- **BLOCKER — final mobile Play occluded by fixed Activity pill.** At 320×568 after scrolling Rift Run's Play into view, link bounds were x184/y499/w111/h44. `document.elementFromPoint` at its center returned the existing `Verified wallet activity` button. Full-page screenshot `reviewer-320.png` shows the overlap. Add bottom scroll clearance on Arcade so the last link can move above the fixed footer, then check pointer hit-testing and actual launch.
- No source/routing/security blockers: new tab is in standard/compact/kiosk navigation, all public sets, forward/reverse routes, and the render branch. No contract gate, wallet action, save mutation, game-source change, iframe, or permissive security-header change.
- Two fixed HTTPS launch anchors use `_blank`, `noopener noreferrer`, meaningful accessible labels with “new tab”, and visible focus outlines. Concise labels preserve Raw's UI direction.
- Both game origins independently returned 200 with correct titles. Frontier Drift retains `frame-ancestors 'self'` / SAMEORIGIN and Rift Run `frame-ancestors 'none'`; separate top-level launch is appropriate.
- Thumbnail source and crop/resize provenance recorded by implementer in README.md.

## Evidence

`reviewer-browser.mjs` / `reviewer-browser.json`: 12 preview cases covering root-nav, `/#/arcade`, `/arcade` × 1440×960, 650×850, 320×568, 568×320. All public gating, image decode, horizontal bounds, 44px minimum targets, link destination/safety, keyboard focus, hash history checks pass, zero page errors. Screenshots inspected at1440 and320. These bounds checks alone did not detect the fixed overlay; actual center hit-testing identified the blocker above.

Initial script selector used a button title rather than accessible contents; corrected to KNOWN SPACE without a product change. No wallet-connected signing or full-game simulation claimed for this launcher-only change.

## Final candidate — PASS, 20:12 UTC

Blocker resolved by scoped `.arcade-panel` bottom padding `calc(72px + env(safe-area-inset-bottom, 0px))`. Independently reran all12 root/hash/direct-path cases after the production rebuild. Four additional actual-popup checks (1440/650/320/568 widths) scroll to the natural document bottom, assert the last Play link owns its center hit target, click it, load the real Rift Run launch screen, verify the original origin and `window.opener === null`, and close the game. All16 checks PASS; zero page errors. Refreshed320 screenshot visually confirms the Play button clears the Activity pill. Public-game resources in these browser checks used a TLS-validating Node fetch relay, not disabled certificate validation.

No remaining publication blockers for this launcher scope. Parent's distinct preview receipt covers both games' actual launch/play/pause; reviewer independently covers public root/hash/direct-path exposure, history, responsive images/bounds, focus, bottom-action clearance and live Rift popup. Final production identity/interaction checks remain the deploy owner's responsibility.
