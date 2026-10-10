# Plinko physics — 2026-10-10

## Change

Raw requested better Plinko physics. The previous renderer stopped for32ms on every peg, repeated fixed-duration Bézier hops and had no supporting catch floor.

The new renderer fits a deterministic ballistic replay to the existing twelve bits. Between impacts, horizontal velocity is constant and vertical acceleration is fixed. At each peg, the fitted upper-shoulder contact satisfies a passive frictionless normal impulse with restitution0.35; no airborne steering, contact freeze or collision energy gain. A bounded25-variable Newton solve fits twelve contact angles and thirteen flight durations, including release from rest. All4096 paths converge. Peg/ball radii are2/3board units so these paths clear the hardware. Gravity1000 is an authored board/time scale, not a measured real-world gravity claim.

The visible collection tray has a floor at222 and ball-center rest at219. Floor restitution0.16 produces diminishing vertical rebounds; the small lateral speed is arrested by a feasible static-friction impulse(mu0.3). Single balls remain visible at rest; pack balls fade into the collection/count display over160ms. Pack launches are staggered360ms so independently replayed balls remain separated; no ball-to-ball physics is claimed. This is outcome-constrained animation, not a new random or unconstrained simulation. No runtime dependency, downloaded trajectory bank or explanatory UI copy was added.

Peg flashes and audio-cue timestamps follow actual contacts, not fixed intervals. The3600ms per-ball presentation budget includes the slowest trajectory and its complete collection fade; the last launch offset and reveal beat remain inside the shared owner deadline. Animated default, savedSystem/Instant, hidden-tab/reload/resize behavior and committed risk profile remain intact.

## Scope

Only CasinoPlinko, plinkoMotion and its tests, plus the reveal-duration import/calculation in CasinoExperience. No RNG, odds, payouts, accounting, persistence schema, wallet, chain, security gate or other game changes. The quarantined legacy testnet renderer is untouched. Financial HOLD and SSU quarantine stay in effect.

## Verification

-368tests/39files PASS. Five Plinko tests cover every4096bit path against existing engine payouts/accounting, passive impulse/energy equations, continuous analytic peg clearance, tray tips, release from rest, ballistic acceleration, deterministic mirror symmetry, dissipative settling, full collection budget, invalid input, and4ms sampled all-path vertical envelopes for multi-ball spacing. The spacing test is sampled; continuous clearance claim applies to individual ballistic peg paths, not a continuous interacting multi-ball simulation.
-8component-fixture cases PASS: extreme left/right, alternating and mixed paths at390/1440; extreme-left is a10ball pack. Captured intermediate frames and phone-sized video. These are actual rendered components with deterministic engine-generated rounds, not live RNG coverage.
-TypeScript/Vite build, Origins8 and the approved IOC scanner at the exact canonical dApp directory PASS.
-12production-preview groups PASS: single/10ball natural RNG at320/390/1440; Instant, System+OSreduce, hidden, resize, reload and profile-preview boundaries. Animated default also verified under desktopOSreduce. Unchanged ledger and zero page/asset errors. Live verification PASS:4fresh natural-RNG cases, single and10ball packs at390/1440. Real intermediate motion/rebounds/contact flashes, separated balls, exact committed endpoints, complete collection and unchanged ledger; zero page/asset errors. Browser scope is Chromium viewport emulation, free local Play Money; no physical-phone, listening or wallet/testnet execution claim.

## Review

Independent native architecture/source review identified an incomplete final pack fade at the initial3500ms budget. Fixed to3600ms with a shared collection duration and exhaustive guard/assertion. Source delta gate PASS; latest collection ends3524.70ms with75.30ms spare. Fixture visual gate PASS after actual intermediate image/video inspection; final delivery gate PASS. Native reviews are not Opus reviews.

## Publication

Published source `c717c0c3d4be7d47572b61a952589afb963da729`, Pages `37098633` (https://37098633.cradleos-d75.pages.dev). Live verification PASS:4fresh natural-RNG cases, single and10ball packs at390/1440. Real intermediate motion/rebounds/contact flashes, separated balls, exact committed endpoints, complete collection and unchanged ledger; zero page/asset errors. Previous live source a1ce882 / Pagesbad23f67 is rollback. Only https://cradleos.io/ is the app origin; GitHub Pages remains redirect-only. Preserve the canonical cycle7 worktree hosting live character-index and unrelated Wrangler directories.

## Production files

Two public bundles exactly match reviewed dist (live-build.json):

- JS `/assets/index-B6P-hkJ5.js`: `6183cc0f4af29c74a06830b3cbe072b4158d10ab11ad1dbeb1a686f119fa8fc7`
- CSS `/assets/index-C20R54o5.css`: `356511ac2b281dde07c06932467a6017055d561d514969b45f9e457ba573ead0` (unchanged bytes)

No artwork/data files changed. Task-owned dev5216 and preview5217 are stopped and both ports verified closed. Component fixture source is archived under qa, not shipped in the dApp.
