# CradleOS Casino — 3D Walkthrough Floor (Build Path)

**Status:** ACTIVE (v1, 2026-07-11) — per Raw: "this is a long horizon project - be sure to create a build path and check it all the way to completion."
**Vision:** a walkable, EVE-Frontier-themed 3D casino interior in the dApp. Players move station to station; each station is a live on-chain game. The 3D world is a *skin over the existing contracts* — game logic, exposure guards, and provably-fair feeds are untouched.
**Doctrine:** Quality > MVP. Category-J moat. Every phase has an exit gate; no phase ships without clearing its gate. This doc is the single source of truth for progress — update the checklists in the same commit as the work.

---

## Standing constraints (apply to every phase)
- **Runtime:** Three.js only (already in deps, proven in-game via MapPanel). No Unity/Unreal exports.
- **In-game webview first:** EVE Vault embedded Chromium is the primary target. No pointer-lock dependency (click-to-move + drag-look). No `window.prompt/confirm/alert`, no native `<select>`, no emoji glyphs (TOOLS.md webview rules).
- **Perf budget:** ≤100k triangles in view, no dynamic shadows (emissive + baked-feel lighting), 60fps on desktop / stable 30fps in webview. Texture memory ≤64MB.
- **Bundle discipline:** the 3D floor is a lazy-loaded chunk (`import()` on entry). The 2D lobby must stay instant and remain the default until Phase 4 gate.
- **Graceful degradation:** WebGL init failure → silent fallback to 2D lobby (KeeperPanel RAG-image pattern).
- **Deploys:** dual-target (CF Pages + gh-pages), IOC + tsc gates, commit-before-deploy — same as everything else.

## Architecture (fixed at Phase 0, revisit only with cause)
- `src/components/casino3d/` — `Casino3D.tsx` (mount/loop/resize), `floor.ts` (procedural interior builders), `stations.ts` (station registry), `controls.ts` (click-to-move nav + drag-look), `hud.tsx` (interaction prompts + game overlay host).
- **Station registry keys off `casinoCatalog.ts`** — adding game #21 to the catalog auto-creates its floor station from a station-archetype (card table / wheel plinth / cabinet / grid pit / tower). Zero per-game 3D rework.
- Entering a station opens the EXISTING game panel as a HUD overlay (same components, same props as the 2D router).
- Entry point: `◈ 3D FLOOR (BETA)` card in the 2D lobby; `casinoView` gains mode `"floor3d"`.
- Card art (`public/casino/cards/*.webp`) doubles as in-world signage textures above each station.

---

## PHASE 0 — Feasibility spike (walkable proof)
**Scope:** one procedural room (dark hull panels, orange emissive strips, gold trim), click-to-move + drag-look camera, 3 stations (blackjack table, roulette wheel plinth, plinko tower), proximity prompt → opens the real game panel overlay, BETA toggle entry + fallback.
- [ ] Casino3D lazy chunk scaffolded; 2D lobby untouched when toggle unused
- [ ] Procedural room renders at 60fps desktop
- [ ] Click-to-move + drag-look works with mouse AND touch
- [ ] 3 stations with hover/proximity highlight + "ENTER" prompt
- [ ] Station opens live game panel (real bet placed through it end-to-end)
- [ ] WebGL-fail fallback verified (force-disable test)
- [ ] tsc + IOC clean; deployed dual-target behind BETA toggle
- [ ] **GATE 0 (exit):** Raw walks the room on desktop + in-game webview and a bet settles from a 3D station. Perf acceptable in webview.

## PHASE 1 — Full floor
**Scope:** all live games as stations via archetype system; floor layout zoned by category (card pit / wheel hall / dice pit / high-volatility wing); signage from card art; minimap or zone labels; spawn/orientation polish.
- [ ] Station archetypes: card table, wheel plinth, cabinet, grid pit, tower, crash pad
- [ ] All catalog games auto-placed from registry (adding a game = catalog entry only)
- [ ] Card-art signage panels per station (webview-safe fallback: glyph plate)
- [ ] Zone lighting/color accents per category
- [ ] Wayfinding: zone labels + a "recall to entrance" control
- [ ] Perf pass: frustum culling, merged geometries, instanced props; webview 30fps hold
- [ ] **GATE 1:** every live game playable from the floor; catalog-add test proves zero 3D rework; webview perf hold.

## PHASE 2 — Alive layer
**Scope:** the floor feels inhabited — without any new backend.
- [ ] Presence holograms: recent bettors from the provably-fair feed rendered as silhouettes at the station they played (wallet-hash → color/height variation)
- [ ] Animated station props: roulette wheel idles/spins on live plays, plinko ball drops when the feed shows a drop, slots reels tick
- [ ] Wall screens streaming the live feed (canvas texture) + house bank ticker
- [ ] Jackpot moment: klaxon light sweep + sound when feed shows a >50x win
- [ ] Extracted EVE ship models (asset-registry.json) as hangar decor beyond windows
- [ ] **GATE 2:** floor visibly reacts to real on-chain activity within one feed-poll interval; no perf regression.

## PHASE 3 — Polish (Stage-3 equivalent — the returning-player gate)
**Scope:** the reason people come back.
- [ ] Spatial/ambient audio (hum, table sounds, muffled klaxons) with mute control
- [ ] The Keeper hologram alcove (ties to KeeperPanel — talk to it in-world)
- [ ] Lighting/composition pass: fog, bloom-feel emissives, entrance reveal moment
- [ ] Idle NPC drones / motion details
- [ ] Full visual QA checklist (protocol Stage 3) on desktop + webview + mobile width
- [ ] **GATE 3:** screen-capture review vs the quality bar; "works but looks flat" does NOT pass.

## PHASE 4 — Launch + watch
- [ ] BETA label dropped; 3D floor promoted to first-class entry (2D lobby remains one click away — it's the accessibility/perf path, never removed)
- [ ] Announcement assets (clips of jackpot moment, walkthrough GIF)
- [ ] 48h watch: error rates, WebGL-fallback rate, webview complaints
- [ ] Post-launch retro → lessons back into this doc + GAME_DEV_PROTOCOL
- [ ] **GATE 4 (completion):** stable for 48h, Raw sign-off. Project moves to maintenance.

---

## Progress log
| Date | Phase | Event |
|---|---|---|
| 2026-07-11 | — | Plan created; Phase 0 spike started |

## Session pickup instructions (for future context-fresh sessions)
Read this doc top to bottom, find the first unchecked box in the lowest incomplete phase, verify the previous boxes' claims live (verify-before-claiming), continue. Update the checklist + progress log in the same commit as the work.
