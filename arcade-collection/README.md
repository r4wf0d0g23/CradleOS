# Frontier Arcade

Eight dependency-free, first-release browser arcade games for the CradleOS Arcade.

## Run locally

```sh
npm test
python3 -m http.server 5370 --directory site --bind 127.0.0.1
```

Open http://127.0.0.1:5370/. Native ES modules require HTTP, not file://. No install, wallet, server-side API, telemetry or account is required. Tests use built-in Node test runner; browser verification scripts use the workspace's existing Playwright/Chromium installation, not shipped dependencies.

## Games

- **Voidhook:** three cargo fields, constrained tethers, inertia, finite steering energy restored by tethering, debris collisions and real delivery-gate overlap. Five hull, seven-minute ceiling; recharge anchors cover every playable position.
- **Gatebreaker:** three armored decks, angle-controlled paddle, volatile adjacency, moving shields on later decks, two redirect/damage pulses per deck, eight-hit final reactor, four charges/lives. A finite objective with no forced time limit.
- **Signal Diver:**72 notes across three accelerating phrases. Hits within190ms, perfect within85ms, per-lane120ms debounce; wrong taps reduce sync. Win requires47hits and hits/(72+bad taps)≥65%. Visuals/scoring/cues use the same paused simulation clock; silent play is identical.
- **Wreck Runner:** three1800-unit shafts, gravity, eight-shot ammo, fire recoil, landing reload, hot walls, ferals and actual recovery gates. Missed gate costs hull and retries the lower shaft, not an automatic clear. Five hull; five-minute ceiling.
- **Feral Circuit:** three laps/36ordered checkpoints, inertia, throttle/boost/brake, heat lock and cooling, off-track slowdown and timed drone rivals.95seconds; score rewards time and rank. One compact track in this release.
- **Dockyard Panic:**24ships over three shifts, exclusive repair/fuel/reload bays, staged multi-service jobs and finite patience. Four missed ships ends a run. Invalid/busy bay requests do not consume resources.
- **Salvage Swarm:** two24-second waves with cutter/drone/chain upgrade choices, then guardian wave. Kiting, automatic beams, orbit contacts, chain strikes, magnetic scrap and12-second Nova recharge. Five hull,150-second ceiling, bounded28enemy field and protected arrivals.
- **Scrapline Defense:** six waves, three tower types, three-level upgrades, power capacity/generator spending and physically transported salvage credit. New waves require explicit Start Wave. Core12; ten-minute ceiling. All-cutter is a tested viable strategy, not proof every strategy is balanced.

The games use original scenarios and arcade abstractions, not authoritative EVE Frontier mechanics. No physical-device or average-human balance certification is claimed. Scripted pilots establish reachable completion; small first-release courses/boards intentionally differ from full commercial-game scope.

## Controls and lifecycle

See each launch screen for specific controls. Desktop uses arrows/WASD, Space and game-specific keys. Touch uses direct canvas drag/tap plus large action buttons. Fire, Boost, Brake and Tether support pointer or focused-button Space/Enter holds; release/cancel/blur clears ownership. Discrete economic actions occur on click, so native scrolling does not buy upgrades.

World coordinates are a720×720 square, drawn with an isotropic contain transform and explicit render clipping. Portrait controls sit below; short landscape uses a scrollable side rail. The board is not stretched or reoriented. Resize, fullscreen change, window blur and document hiding pause the simulation and clear held input; resume is deliberate. Terminal and choice overlays freeze advancement.

No in-flight reload/resume checkpoint is promised. Reload starts at the menu; completed-run records persist. Sound starts only after a gesture, can be muted, and uses short generated oscillator cues. There are no scheduled past-note audio backlogs.

## Source contract

- `site/core.js`: pure deterministic helpers, art loaders and common render primitives.
- `site/games/<id>.js`: `create(seed)`, `update(state, dt, input)`, `action(state,key)`, `render(ctx,state)`, `hud(state)`, optional `controls` / `choices`.
- `site/app.js`: shell, fixed60Hz timestep capped to6steps/frame, inputs, menus, sound, lifecycle and award-once.
- `site/profile.js`: individual versioned keys `frontier-arcade-v1:<game-id>`, separate `:sound`. Reads validate version and bounded numeric fields. Terminal award rereads only that game's key, then writes best/max and run counters. Different game tabs cannot overwrite one another. Simultaneous completion in two tabs of the *same* game is not transactionally synchronized; this collection has no competitive/accounted economy.
- `window.arcadeSnapshot()` is a read-only serialized copy for inspection; changing the returned copy cannot mutate the game. No writable QA state hook is published.
- `site/assets/collection-provenance.json`: exact reused art hashes. Source provenance/NOTICE retained. PNGs derive from approved Frontier client assets; listed mechanical drone/asteroid SVGs are our original artwork.

## Verification and release

`research/engines.test.mjs` exercises genuine mechanics, guards, failures and storage. `research/pilots.mjs` supplies legal input to pure engines; explicit pathological fixtures are separate. `research/browser-runs.mjs` drives real browser keyboard/mouse events using read-only state, then verifies terminal award-once/retry/reload. Reviewer scripts/receipts cover32layouts, multitouch, scrolling without purchases, focused-button holds, fullscreen, hidden/resize, invalid/denied storage and screenshots.

Publish only `site/` to isolated Cloudflare Pages project `frontier-arcade`. Keep `_headers` including CSP and frame restriction. Verify every served runtime/data/image file SHA256 at both public and immutable deployment origins, then real game launches and representative controls. Only after that add/update CradleOS launch cards using its canonical PRIMARY_DEPLOY.md gates.

## Maintenance, rollback and retirement

Keep release ID, source SHA, hashes, old rollback ID and actual tests in DEPLOYMENT.md. Preserve per-game keys/schema; changes need validation/migration tests. Regression-test changed engine plus shared input/profile tests, independent milestone review, deploy isolated site, verify bytes/interactions. Do not automatically migrate or wipe existing Frontier Drift/Rift Run saves.

Rollback the entire collection to its preceding immutable deployment, never a mix of modules. CradleOS card rollback is a separate web release. No recurring billable monitor is scheduled by this task. If retiring a game, remove its launch card first and retain the immutable playable version and same record format until a replacement/retirement plan is agreed. Browser-local records are not cloud-backed; clearing site storage removes them.

Canonical maintained source is `arcade-collection/` in the CradleOS source repository on `cycle7-vestiges-20261002`. The workspace artifact is the original research/QA staging directory; publication uses a verified byte-identical copy in the canonical checkout.
