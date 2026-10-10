# Lai flight correction — 2026-10-10

## Why this replaces the previous treatment

Raw rejected the angled icon flying sideways and exaggerated hull stretching. The earlier functional tests proved outcomes, not the visual direction. This correction verifies the flight axis from native engine attachment data and reviews intermediate frames, not only endpoints.

## Presentation

- Current modular Lai type95276/graphic34663, native top-view render with booster-off matte. No synthetic replacement hull or runtime3D engine.
- Fresh native probe exposed42booster locators. All point+Z; native CreateBoosterFlares places exhaust at position-minus-direction. Top-view up=+Z, so clockwise90° rotation puts bow right and exhaust left. The old other-project CCW derivative's bow-right label was incorrect and that derivative is not reused.
- Three dominant engine clusters projected through the actual camera/crop. Hull remains rigid at fixed attitude; no nonuniform scale, fake banking or ground shadow.
- Position integrates acceleration. World position and camera position are separate and retain velocity at cutoff. Distant stars stay fixed; local dust moves opposite the camera with correctly directed exposure tails.
- Winning departure adds forward jerk from the existing velocity. Only the engine wake extends; the hull never stretches or dissolves in-frame.
- Failure cuts engines, shows one brief plasma flash, and separates9visible hull sections from their original positions. Alpha-mass/inertia proxies balance the outward impulses/spin. Fragments inherit ship velocity and keep constant linear/angular velocity; no gravity, drag, smoke, buoyancy or atmospheric shock ring.

This is a physically coherent authored2D presentation with fictional warp effects, not measured spacecraft velocities, a full physical fracture simulation, exact client-material reproduction, or literal warp physics. HUD multipliers retain their existing game meaning. No explanatory product UI added.

## Unchanged

Committed outcome, RNG, payout/accounting/session schema, game controls, shared4.1s timeline, Animated default, explicitSystem/Instant, hidden/resize/reload behavior, financial HOLD and SSU quarantine. No wallet, network/private-data flow, chain writes or new runtime dependencies.

## Gates

- Independent native architecture/source/provenance review PASS; final visual review PASS including the single pulse. Not an Opus review.
- Full suite368tests/39files PASS, including finite-difference position/velocity continuity, rigid forward-only motion, in-place fracture, mass-weighted impulse/spin, ballistic debris and engine cutoff.
- Final12preview groups PASS: both actual natural outcomes at320/390/1440, captured intermediate frames and stable hull proportions,6motion/reload/visibility/resize boundaries. Fouradditional final target checks PASS: ready1.37, saved1.37, near19999/20000 precision, max1000HUD. These replace initial passes, not inflate counts. Origins8, exact canonical IOC scan, TypeScript/Vite build PASS.
- Scope: isolated browser-local free Play Money in Chromium with viewport emulation. Physical phones, audio-listening and wallet/testnet execution are not claimed.

## Publication

Published runtime`a1ce88249d67d515c50c22a249d694c664e356fd`, Pages`bad23f67` (https://bad23f67.cradleos-d75.pages.dev), primary https://cradleos.io/#/casino. Previousruntimefe7ac41 / Pagesadbad865 is rollback. Live verification PASS. Only cradleos.io is the application origin; GitHub Pages stays redirect-only. Canonical worktree hosts live character-index and must be preserved.

## Live build and rollout

Three production files exactly match reviewed dist (live-build.json):

- `/assets/index-ufWDhLWg.js`: `dcd0d43a27ce13bfb1c52b91aa3d7f8f0126096b77c9dca0b8927c6636f8a6d1`
- `/assets/index-C20R54o5.css`: `356511ac2b281dde07c06932467a6017055d561d514969b45f9e457ba573ead0`
- `/casino/lai-jump/lai-top.webp`: `c22e4179a4bf01385a5b7a11101e63953418543b5d6c0548ceb866e9ff792d8e`

The first check ran during rollout and received the old page (HTML mismatch; captured old angled-icon frame, missing new world-position attributes). That attempt is retained as qa/rollout-first-browser.json and is not counted as a passing run. After the primary and immutable URLs served the new bundle, exact hashes passed and a fresh isolated live browser run was started.

Task-owned preview5215 and native private Wine/X109 are stopped; port/socket closure verified. Canonical live-index worktree and unrelated Wrangler directories preserved. Fresh live browser verification PASS: 4actual natural-outcome cases, win/loss at390/1440, rigid shape and forward motion, early/late effect frames, stationary distant stars, unchanged ledger and zero page/asset errors. Desktop OS-reduced setting still animates by default. Final independent native delivery gate PASS: source/Pages/rollback, counts, three hashes, artwork provenance, stale-rollout exclusion and closed task services reconcile. No remaining blockers.
