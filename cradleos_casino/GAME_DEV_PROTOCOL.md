# CradleOS Casino — Game Development & Launch Protocol

**Owner:** Reality Anchor (Captain)
**Status:** ACTIVE (v1, 2026-07-11)
**Scope:** Every new casino game, from concept to live-on-cradleos.io. No game ships without clearing every gate below.

> Doctrine (per Raw, 2026-07-11): *"Strategic and developed steps starting with design, psychological research on effectiveness, and profitability; then building it out and building it up. Each game on deployment needs modern, effective, cutting-edge UI. QA pass at every stage and continuous process improvement throughout."*
> Aligns with the standing CradleOS mandate: **Quality > MVP; versatility = product.** We aim to be the first-choice platform for EVE Frontier casino gaming — breadth of polished options wins players.

---

## The Five Stages (each has an explicit exit gate)

```
  STAGE 0            STAGE 1           STAGE 2          STAGE 3           STAGE 4
  DISCOVERY   →      DESIGN      →     BUILD      →     POLISH      →     LAUNCH
  (research)         (spec+math)       (contract+UI)    (UX+animation)    (deploy+watch)
     │                  │                  │                │                │
   GATE 0            GATE 1             GATE 2           GATE 3            GATE 4
   go/no-go          math+UX spec       green tests      visual QA         live QA +
   greenlight        signed off         + edge verified  + a11y pass       feed watch
```

A game may only advance when the prior gate is signed off. Regressions bounce it back a stage.

---

## STAGE 0 — DISCOVERY (research & greenlight)

**Goal:** decide *whether* a game is worth building, before writing a line of code.

### 0.1 Player-psychology research
Every candidate game is evaluated against the engagement levers that make casino games sticky. Document each explicitly (cite sources / prior-game evidence, mark inferences):
- **Anticipation window** — is there a satisfying 2-4s gap between bet and reveal we can animate? (Games with zero suspense underperform. Crash/Plinko/wheel-spins score high; instant-flip scores low unless dressed up.)
- **Near-miss potential** — can the UI surface "so close" moments? (Drives replays. Plinko landing next to a jackpot, Keno hitting 4/5, Mines cashing out one tile early.)
- **Agency / skill illusion** — does the player make a choice? (Hold in poker, cash-out timing in Mines/Crash, target in Limbo. Perceived control ↑ session length.)
- **Volatility profile** — where does it sit? (low-vol grinders vs high-vol jackpot chasers. We want a spread across the catalog, not 15 clones of the same variance.)
- **Session-loop tightness** — time-to-next-bet. Faster loop = more bets = more edge realized, but must not feel frantic.
- **Social/streamable moment** — is there a screenshot/clip-worthy peak? (Big multipliers, tower climbs, royal flush.)

### 0.2 Profitability model
- **House edge target: 2–5%.** Compute the exact edge from first principles (probability × payout table). NEVER invent payout numbers — every table is derived and simulated (`scripts/edge_sim.py` style). Mark the measured edge in the module doc-comment.
- **Exposure fit:** the game's max multiplier must be playable at meaningful bets given the house-bank exposure guard (3% of bank per play). If max-mult × min-interesting-bet > 3% of bank, either cap the multiplier or flag that the bank needs a top-up. (Lesson: Mines clear-all = 2230x blew the guard → capped at 1000x.)
- **Variance vs bankroll:** high-variance games need a bigger bank to avoid a bad run draining it. Model the risk-of-ruin at expected volume.
- **Catalog fit:** does it add a NEW volatility/mechanic niche, or duplicate an existing game? Prefer differentiation.

### 0.3 Feasibility
- Single-tx (instant) vs stateful (commit-reveal) — stateful is ~3x the build cost. Justify stateful only when the mechanic requires mid-round decisions.
- On-chain randomness security: any `&Random` fn must be `entry` + non-`public` (Sui rule). Confirm the mechanic fits the single-shuffle-then-deterministic-replay pattern (blackjack_live/mines/dragon_tower).

### GATE 0 — Greenlight
Produce a one-page **Game Brief**: mechanic, psychology scorecard, computed edge, exposure fit, variance class, build class (instant/stateful), and a go/no-go. **Raw signs off** (or Captain self-approves for low-risk instant games that clearly fit the catalog). No brief → no build.

---

## STAGE 1 — DESIGN (spec + math, signed off before code)

**Goal:** a complete, unambiguous spec so the build stage is mechanical.

### 1.1 Math spec
- Full payout table in bps (10000 = 1x), every outcome enumerated.
- Exact RTP / house-edge computation, verified in a sim script (`scripts/`), committed alongside.
- Exposure guard constant (`MAX_MULT_X`) and the resulting max-bet at current bank.
- Edge-case handling: ties/pushes, min/max targets, invalid params → explicit abort codes.

### 1.2 UX spec ("modern, effective, cutting-edge")
- **The anticipation animation is specced here, not bolted on later.** Describe the signature reveal (the climbing rocket, the dropping ball, the flipping cards, the spinning wheel). Every game ships with a real animation stage matching the quality bar in `CasinoAnimations.tsx`.
- Control layout: bet input + presets, game-specific controls (sliders/selectors/grids), disabled/exposure states.
- Result reveal: win/loss flash, payout delta, provably-fair feed entry.
- Responsive + in-game-webview constraints: **Monaco/webview-safe Unicode glyphs only (NO emoji)**, no `window.prompt/confirm/alert` (portal modals only), no native `<select>` popouts (custom portal dropdowns). See the "Webview Dialog + Native Overlay Ban" rules in TOOLS.md.
- Accessibility: color is never the only signal (win/loss also has text + glyph); tap targets ≥ 40px; motion is meaningful, not gratuitous.

### GATE 1 — Design sign-off
Math spec + UX spec reviewed. Edge sim committed and re-derived independently. Animation described concretely. Bounce back to Stage 0 if the edge/exposure math doesn't hold.

---

## STAGE 2 — BUILD (contract + functional UI)

**Goal:** working, tested, on-chain.

### 2.1 Move contract
- One module per game, mirroring the house-API pattern (`take_wager_amount` → guard exposure → `deposit_stake` → randomness → `payout_for` → `pay_winnings` → emit event).
- **Pure `payout_for` / math helpers with exhaustive `#[test]` coverage** — spot-check every payout tier + edge case. Move tests are the first QA gate.
- Stateful games: player-owned object holds escrow + committed layout; post-deal actions consume no randomness (no test-and-abort). Auto-settle on terminal states.
- Event struct carries everything needed to render + verify the outcome (provably-fair).

### 2.2 Functional UI
- `casinoGames.ts` registry entry (instant) or dedicated `casinoX.ts` lib (stateful): tx builders, resolve-by-digest, feed query pinned to the introducing package id.
- Panel wiring: controls, `play()` dispatch, exposure pre-check mirroring the on-chain guard, stale-ref retry, result display.
- **Package-id discipline:** moveCalls → `CASINO_PKG` (latest published-at); event/struct queries → the package id that INTRODUCED the type (`CASINO_V5`/`V7`/etc.). Wrong id = silent zero results.

### 2.3 QA at build
- `sui move test <module>` green (unit).
- **Live on-chain smoke test** from the cradle CLI wallet against the live House: play the game, decode the event, confirm payout math matches the contract exactly. (Every game this session got a live smoke test — non-negotiable. Verify-before-claiming.)
- `tsc --noEmit` clean.
- IOC scan clean (`scripts/scan-npm-iocs.sh`) before any build that ships JS.

### GATE 2 — Green build
All Move tests pass, live smoke test verified with decoded event, tsc clean. Bounce on any red.

---

## ASSET STUDIO (production-phase capability — feeds Stages 1-3)

> Added per Raw 2026-07-11: a dedicated "UI group" that generates EVE-Frontier-authentic assets for game displays and visual elements, so every game draws from a shared, lore-true art system instead of ad-hoc glyphs. This extravagates the player experience and is a core piece of the EVE-native moat (category J and beyond).

**What it is:** a shared asset pipeline + registry that any game's Design (Stage 1) and Polish (Stage 3) stages pull from. Games should never invent one-off art; they request assets from the studio, which produces on-theme, reusable, webview-safe visual elements.

**Sources (in priority order):**
1. **Extracted game assets** — real EVE Frontier client art (ship hulls, structures, ore, module icons) via the datamine pipeline + `public/data/asset-registry.json` (canonical registry of extracted 3D models/sprites). Highest authenticity; already powers blackjack card art in `casinoTheme.ts`.
2. **Generated assets** — `image_generate` (transparent PNG/webp) for themed backgrounds, symbols, gem/reel faces, banners, category icons, win/jackpot flourishes. Prompt from EVE Frontier lore + the CradleOS aesthetic (dark, industrial, ACCENT #FF4700 / GOLD #E8B84B). Use the DGX2 Qwen3-VL stack for classification/QA of generated art where useful.
3. **Vector/CSS primitives** — for anything that must render crisply at any size or animate cheaply (wheels, plinko pegs, dice pips). Monaco/webview-safe glyphs remain the fallback for in-game-browser text contexts where color art can't load.

**Studio outputs (all registered, reusable across games):**
- **Symbol sets** — slot symbols, gem types, card faces, dice faces, keno tiles — themed to EVE assets (ore types, ship classes, modules) not generic casino icons.
- **Backgrounds / felt / table skins** per category (dice pit, card table, reel cabinet, anomaly-dive backdrop).
- **Category + game icons** for the lobby grid (NAV_PLAN) — one per game, on-theme.
- **Reveal-moment art** — win bursts, jackpot flares, bust explosions, tier-up flourishes.
- **EVE-native game art** — category J games get bespoke lore art (jump gates, killmails, refineries, the Keeper).

**Registry discipline (mirror `asset-registry.json`):** every studio asset gets a registry entry `{ key, kind, source (extracted|generated|vector), theme, path, usedBy: [gameKeys], webviewSafe: bool, license }`. Games reference assets by key. This makes art reusable, auditable, and swappable (re-skin a whole category by swapping registry entries).

**Constraints:** in-game webview can't render color-emoji and may fail to load some remote art (PNA/URL issues) — every game MUST degrade gracefully to a webview-safe glyph/vector fallback if an image asset fails to load (silent onError fallback, like the KeeperPanel RAG-image pattern). Assets are attachments, sized/optimized for fast load; lazy-load per game (don't ship 100 games' art on lobby mount).

**Where it plugs into the protocol:**
- **Stage 1 (Design):** the UX spec names which studio assets the game needs (existing or to-be-generated). If new art is needed, an asset request is filed here.
- **Stage 2 (Build):** functional UI wires asset keys (with glyph fallbacks) — art can be placeholder.
- **Stage 3 (Polish):** final assets in, registered, QA'd for webview rendering + load speed. Part of the Gate-3 visual sign-off.
- **Continuous:** the studio's library grows with each game; periodic art-refresh passes re-skin older games to the current bar. A future dedicated asset-studio agent/sub-crew can own this pipeline as the catalog scales toward 100+.

---

## STAGE 3 — POLISH (visual QA — the returning-player gate)

**Goal:** the game is *fun to look at*. This is the stage Raw called out — returning players come back for polish.

### 3.1 Animation build
- Real reveal-animation stage (CSS-only, keyframes injected once) matching the `CasinoAnimations.tsx` bar: decelerating/easing motion, a settle beat, a win/loss flash. NO text-only reveals ship to production.
- Signature motion per mechanic: climbing counters (crash/limbo), dropping ball with peg bounces (plinko), staggered card deals + flips (poker/baccarat/war/hilo), tumbling dice (sicbo/double-dice), spinning wheels, gem cascades (diamonds), tile flips + explosion/shake (mines/dragon-tower).
- Micro-interactions: hover/press states, held-card glow, current-row highlight, multiplier pulse-on-climb, near-miss emphasis.

### 3.2 Visual QA checklist (every game)
- [ ] Animation runs to completion and always fires the reveal (no hangs).
- [ ] Win, loss, AND push states each have a distinct, satisfying visual.
- [ ] Glyphs render in the in-game webview (no empty boxes — test the Monaco-safe set).
- [ ] Layout holds on mobile width + in the embedded game browser.
- [ ] Sound cues fire (win/loss/deal) where wired.
- [ ] Provably-fair feed row appears and reads correctly.
- [ ] Matches the CradleOS dark/EVE aesthetic (ACCENT #FF4700, GOLD #E8B84B, GREEN #3FCF6A).
- [ ] Uses Asset Studio assets (EVE-themed, registered) where applicable; every image asset has a webview-safe glyph/vector fallback that renders if the art fails to load.
- [ ] Motion is smooth (no jank) on the target hardware.

### GATE 3 — Visual sign-off
Screenshots/screen-capture reviewed against the bar. Bounce to Stage 3 rework if it looks unfinished. **A game that works but looks flat does NOT pass.**

---

## STAGE 4 — LAUNCH (deploy + watch)

**Goal:** live on both targets, verified, monitored.

### 4.1 Deploy (dual-target, standing rule)
- Package: `sui client upgrade` with the correct UpgradeCap; record new pkg id + tx; update `CASINO_PKG` + introduce a `CASINO_Vn` constant for the new event/struct types.
- Frontend: build both targets (CF Pages `VITE_BASE=/` + gh-pages `VITE_BASE=/CradleOS/`), IOC-clean, tsc-clean. Deploy **BOTH** (cradleos.io primary + gh-pages mirror) or they drift.
- Branch-protection dance for gh-pages/master (save → disable → push → restore).
- Commit source before/with deploy (commit-before-deploy standing practice).

### 4.2 Launch QA
- Verify live bundle hash on cradleos.io + mirror; grep the new pkg id in the served JS.
- One real play of the new game through the live UI (or CLI smoke if UI play needs a funded player wallet).
- Confirm the game tab renders, controls work, animation plays, feed updates.

### 4.3 Watch (first 24-48h)
- Monitor the provably-fair feed + House accounting (bank balance, bets settled, net P/L) for the new game.
- Watch for exposure-guard rejections (bets too large) → signal to top up bank or adjust cap.
- Watch for any payout anomaly vs the modeled edge.

### GATE 4 — Live sign-off
Live QA pass + first-window watch clean. Game is officially launched.

---

## Continuous Process Improvement (runs across all stages)

- **Post-launch retro** after each game (or batch): what took longest, what broke, what the edge/exposure math missed, what players engaged with. Feed lessons back into this protocol (version-bump it).
- **Catalog review** (periodic): volatility spread, which games get played, which are dead weight. Retire or re-theme underperformers.
- **Edge audit** (periodic): recompute realized house edge from on-chain feed vs modeled edge per game; investigate divergence.
- **Tech-debt sweep:** package-id map hygiene, RPC pagination, retry discipline, deploy-target parity.
- **This protocol is living.** Every lesson that would prevent a future mistake gets written in. If a stage/gate proves too heavy or too light, adjust it — but never silently skip a gate.

---

## Quick-reference: gate checklist per game

| Gate | Must have |
|---|---|
| 0 Greenlight | Game Brief: psychology scorecard, computed edge, exposure fit, variance niche, go/no-go |
| 1 Design | Payout table + verified edge sim + exposure constant + concrete animation spec + UX spec |
| 2 Build | Move tests green + live on-chain smoke (decoded event) + tsc clean + IOC clean |
| 3 Polish | Real animation stage + visual QA checklist all ticked + aesthetic match |
| 4 Launch | Dual-target deploy verified + live play QA + 24-48h watch clean |

*No game skips a gate. Quality > MVP. Make it look nice.*
