# Frontier Arcade — cradle-to-grave execution plan

Owner: Captain. Request Raw1569085561736527994, 2026-11-08. Interpret “ask if them” as “all of them”: all eight previously proposed games. Announced this assumption before implementation; retain any later steering.

## Outcome and scope

Deliver eight complete, replayable browser arcade games with distinct mechanics, Frontier-inspired industrial-wasteland art, desktop/touch controls, actual win/loss/retry loops, local records and a public CradleOS Arcade entry for each. This is a first-release collection, not eight large commercial clones. No wallet, wagers, blockchain transactions, multiplayer, paid assets, accounts, telemetry, ads or backend required. Existing Frontier Drift and Rift Run origins and saves stay untouched.

Keep labels, score, state and actions concise. Explain rules once on each launch screen; retain useful pause controls. Use authentic already-approved client derivatives plus original mechanical/environment artwork, with a provenance manifest. No copying reference-game assets, branding or level layouts.

## Release contracts

| Game | Core decision | First-release complete run | Touch / desktop |
|---|---|---|---|
| Salvage Swarm | Kite ferals, collect scrap, choose one of three weapon upgrades between waves | Three waves plus salvage guardian; cutter, orbit drones, chain arcs with distinct benefits | Drag ship / WASD, Nova button / Space |
| Gatebreaker | Angle paddle rebounds and choose when to spend a charge | Three hull decks, armor/volatile blocks, moving shield and final reactor | Drag paddle / arrows, launch/pulse / Space |
| Wreck Runner | Descend safely, shoot to brake, choose safe platforms versus salvage | Three station shafts, landing reloads, hazards and exit gate | Drag horizontal / arrows, fire button / Space |
| Scrapline Defense | Split limited salvage between defenses and power/logistics | Six feral waves on a visible conveyor path; build/upgrade cutter, arc, tractor towers | Tap plot + build choice / mouse +1/2/3 |
| Voidhook | Tether, orbit and release at the right moment | Three salvage fields; deliver marked cargo to recovery gate, avoid debris | Hold nearest-anchor tether and steer / arrows + Space |
| Dockyard Panic | Route timed repair/fuel/reload jobs between stations | Three shifts; finite deadlines, repair/fuel/ammo stations, escalating two-service jobs | Select ship + station / click or1–3 thenQ/W/E |
| Feral Circuit | Balance thrust, braking and heat through gates | Three-lap time trial against drone rivals; track hazards, boost and checkpoints | Drag steering / arrows, boost button / Space |
| Signal Diver | Read pulse timing, select correct circuit lane and build a combo | Three paced signal phrases, accuracy/combo, reactor lock final phrase | Three large lane buttons / A/S/D |

## Architecture and execution order

1. **Plan/review:** independent milestone audit of this scope/architecture and acceptance criteria; correct contradictions before implementation.
2. **Shared foundation:** dependency-free ES modules; deterministic seeded simulation with bounded fixed timestep; shared Canvas2D renderer helpers, art cache, responsive shell, sound after user gesture, Pause/Resume/Retry/Fullscreen/Mute, input ownership and cleanup. Each game module exposes create/update/action/render/HUD and testable state. Fixed square simulation with isotropic contain transform; landscape shell uses side control rail to preserve board height. Resize/hidden/blur pauses and clears held input; resume deliberately. No writable public debug hook.
3. **Records:** versioned, game-specific best score/completed runs/wins stored under new collection key. Validate numeric ranges/schema, ignore unknown IDs, tolerate denied/corrupt/quota storage. Never award twice, never overwrite another game's record, no fabricated migration. Record best and wins at completed runs; no promise of resumable in-flight runs.
4. **Build batch1:** Voidhook, Gatebreaker, Signal Diver. Prove controls, physics/timing and lifecycle first.
5. **Build batch2:** Wreck Runner, Feral Circuit, Dockyard Panic. Add vertical camera, track checkpoints and queue scheduling as genuinely separate engines.
6. **Build batch3:** Salvage Swarm and Scrapline Defense. Add bounded encounter systems and meaningful upgrade/build choices; no reskin substitution.
7. **QA/review:** engine tests target conservation, collision/scoring, objective completion, failure, retry, pause and records. Seeded legal-input pilots complete all eight games; separate edge fixtures from natural-input browser proof. Browser at1440×960,390×844,320×568,568×320: actual start/input/pause/retry, multitouch where applicable, rotate while preserving state, fullscreen, focus/release/cancel, native scrolling, overflow and final action hit-testing. Inspect one actual gameplay screenshot per game and compact mobile/landscape layouts. Independent milestone reviews before publication.
8. **Publish:** new isolated Cloudflare Pages project `frontier-arcade`, using existing authorized deployment capability, immutable deployment receipt and documented rollback. Do not change other game projects. Keep self-contained source and assets; no remote runtime API. Verify ALL public/immutable runtime hashes, page content, errors and actual interactions.
9. **CradleOS integration:** add only verified games to existing public Arcade tab with concise gameplay cards and original-site new-tab links. Use canonical current checkout/PRIMARY_DEPLOY.md, guard/IOC/build/review and live mobile launch checks. No iframe or save-origin move. Preserve two current games.
10. **Maintain/retire:** write game rules, control contracts, save schema, provenance, exact release/hash/test receipts and known limits. Keep previous immutable deployments. Future updates: regression affected engine and shell, preserve records, independent review, publish isolated collection then integration only if URLs/cards change. Do not schedule ongoing spend without request. Retirement: remove launcher entry first, keep prior playable release/save-export path until replacement agreed; do not silently erase records or redirect to incompatible saves.

## Definition of done

All eight named games have actual distinct loops and reachable win/loss, no placeholder/Coming Soon cards, no simulation/gameplay errors, mobile controls proven, records persist, bounded entity counts and deterministic testable mechanics. Independent review has no release blockers. Live assets match reviewed bytes, all eight public launch flows work and Arcade links point to them. Final report includes launch URL(s), finished games and honest remaining limitations (no physical-device/human-balance certification).

## Work log

- Planning started. Existing two-game Arcade release21329794/sourcef628a7b is baseline; do not disturb its saves or game origins.

### Architecture review resolutions
- Scrapline: killed enemies create moving conveyor salvage parcels; currency arrives only when parcels reach the core. Tower power cost and bounded generator capacity gate construction; upgrading generator competes with tower spending. Tests prove delayed resource delivery and power rejection.
- Signal Diver: simulation time is the one chart/timing clock. Visual notes and beat events derive from it; audio is a user-gesture-enabled cue, not a second scoring clock. Paused/hidden time never advances chart; resume schedules only future cues, never a backlog. Silent play remains identical.
- Records: per-game versioned keys plus separate sound preference; a game's terminal award rereads only its own record immediately before write and shell awards once per run. No collection-wide save can clobber another game's results.

### Implementation review fixes
All eight engines implemented and reviewed.42mechanics/profile tests pass;32layout/lifecycle scenarios pass. Fixed terminal-frame reward ordering, anti-spam rhythm accuracy, actual shaft-gate overlap/hot walls, required final reactor and pulses, finite tether-recharged steering, touch Brake, focused keyboard holds, scroll-safe economic actions and clipped world rendering. Eight legal-input pure-engine pilots complete; actual browser completion/records tests in progress. Source formatting normalized with existing Prettier; no dependency added.
