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
- [x] Casino3D lazy chunk scaffolded; 2D lobby untouched when toggle unused (2026-07-11 — separate 9.9kB chunk verified in build output, commit 7d094617)
- [ ] Procedural room renders at 60fps desktop (needs live check)
- [ ] Click-to-move + drag-look works with mouse AND touch (code review ok — needs live check)
- [x] 3 stations with proximity + "ENTER" prompt (blackjack/roulette/plinko; code verified)
- [ ] Station opens live game panel (real bet placed through it end-to-end) — GATE-0 walkthrough item
- [ ] WebGL-fail fallback verified (force-disable test)
- [x] tsc + IOC clean; deployed dual-target behind BETA toggle (2026-07-11 — cradleos.io index-BIzHmPBZ.js + gh-pages index-Ct_-ZD8y.js, 3D chunk HTTP 200 live)
- [ ] **GATE 0 (exit):** Raw walks the room on desktop + in-game webview and a bet settles from a 3D station. Perf acceptable in webview.

## PHASE 1 — Full floor
**Scope:** all live games as stations via archetype system; floor layout zoned by category (card pit / wheel hall / dice pit / high-volatility wing); signage from card art; minimap or zone labels; spawn/orientation polish.
- [x] Station archetypes: card table, wheel plinth, cabinet, grid pit, tower, crash pad (2026-07-11, commit 02dd16a5)
- [x] All catalog games auto-placed from registry (buildStations consumes CASINO_CATALOG; verified in code — catalog-add test still owed at Gate 1)
- [x] Card-art signage panels per station (glyph-plate fallback wired; 6/20 art files live, rest generating)
- [x] Zone lighting/color accents per category
- [x] Wayfinding: zone HUD chip + "⌂ ENTRANCE" recall
- [ ] Perf pass: frustum culling, merged geometries, instanced props; webview 30fps hold (needs live measurement)
- [ ] **GATE 1:** every live game playable from the floor (live walkthrough); catalog-add test proves zero 3D rework; webview perf hold.

## PHASE 2 — Alive layer
**Scope:** the floor feels inhabited — without any new backend.
- [x] Presence holograms: recent bettors from the provably-fair feed rendered as silhouettes at the station they played (wallet-hash → color/height variation) — pooled 8 slots, capsule+sphere MeshBasicMaterial, 10-min TTL (iteration 2, commit b3934d71)
- [x] Animated station props on live plays: 15s feed poll fires triggerPulse() on base ring + rising orange activity-pulse ring at station position (iteration 2, commit b3934d71)
- [ ] Wall screens streaming the live feed (canvas texture) + house bank ticker
- [x] Jackpot moment: wall seam strips flash gold for 2s when payout/wager >= 25 (iteration 2, commit b3934d71)
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
| 2026-07-11 | 0 | Spike built (5 files, 665 lines) + deployed dual-target behind BETA toggle. Remaining Phase-0 boxes are live-QA items → Gate 0 walkthrough by Raw. |
| 2026-07-11 | 0→1 | Raw walked the spike: "looks nice." Iteration 1 shipped same evening (commit 02dd16a5, deploy #10): full floor — 6 archetypes, all catalog games auto-placed, category zones, art signage, feel pass (accel/decel, target ring, proximity pulse), zone chip + entrance recall. Chunk 19.2kB. Pending: perf measurement + Gate 1 walkthrough. |
| 2026-07-11 | 0 | **Gate-0 webview-render evidence CAPTURED:** Raw ran the 3D floor inside the EVE Vault in-game webview (walkthrough screenshot ~19:55 CT) — floor renders + camera walks in the embedded Chrome. The webview-render risk box (biggest Gate-0 unknown) is effectively demonstrated. Raw live feedback: speed OK; lighting too low; floating signage images too dark. |
| 2026-07-11 | 1 | Lighting fix shipped (commit 83de2671, deploy #11, bundle index-BF9dJvF_/Casino3D-Beq4BjId): ambient 0x1e1e2e×1.4 → 0x3a3a52×3.4, added HemisphereLight(warm sky/cool ground, 1.6), point lights ~2.5× intensity + wider falloff (range 32→44); signage planes → unlit MeshBasicMaterial(toneMapped:false) so card art/glyph renders full-brightness regardless of scene light; brighter fallback plate. Deployed + live-verified both targets (gh-pages serves index-BF9dJvF_). Pending: Raw re-walk to confirm brightness. |
| 2026-07-11 | 1 | Card signage art: 8/20 webp present (blackjack, coinflip, dice, limbo, roulette, slots, wheel + mines recovered from pre-restart gen). 12 remaining (baccarat, crash, diamonds, double_dice, dragon_tower, hilo, keno, plinko, sicbo, three_card_poker, video_poker, war) — **deferred**: art subagent bailed twice + 2 gateway restarts under heavy load today; glyph fallback covers missing cards (non-fatal). Resume in a lighter session. |

| 2026-07-11 | 1 | Lighting pass per Raw's IN-GAME walkthrough (floor renders+walks in EVE Vault webview — Gate-0 webview evidence). Brighter ambient/hemi/points, unlit signage. Label text -> near-white #f2f2f2, ring base intensity raised ~1.3x. Commit e5824928 (label/ring fix) on top of prior 83de2671 (main lighting). gh-pages: 13c7640, bundles index-BF9dJvF_.js + Casino3D-Beq4BjId.js. CF: index-Bm-IJkdz.js + Casino3D-BPBKl7LM.js. Card art: 9 webp in public/casino/cards/. |
| 2026-07-11 | 1→2 | Iteration 2: label consistency (sizeAttenuation=false, uniform screen-space scale 0.42×0.084), station richness (cardTable orange felt inlay, wheelPlinth slow pocket-ring pulse, cabinet richer flicker, gridPit glow lines +0.23, tower edge-light strips, crashPad brighter trail), feed-reactive floor (15s poll, activity pulses, presence holograms pool-8, jackpot klaxon). Commit b3934d71, bundles index-yQfCV3tf.js + Casino3D-BBaYv4hn.js. Card art: 12 webp. |

## Session pickup instructions (for future context-fresh sessions)
Read this doc top to bottom, find the first unchecked box in the lowest incomplete phase, verify the previous boxes' claims live (verify-before-claiming), continue. Update the checklist + progress log in the same commit as the work.
