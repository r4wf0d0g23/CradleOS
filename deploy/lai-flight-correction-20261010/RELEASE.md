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

Pending. Source baseline1f4f182; runtime to replacefe7ac41, Pagesadbad865 (rollback). Only cradleos.io is the application origin; GitHub Pages stays redirect-only. Canonical worktree hosts live character-index and must be preserved.
