# Warp Run — continuous flight, 2026-10-10

Raw reported that Warp Run was neither fluid nor physically accurate.

## Implemented

- Removed the fixed-angle chart sprite, rewritten Bezier trail, ground shadow and terminal X. Spaceflight and multiplier telemetry are now separate.
- Reused the verified native Lai top-view cutout and engine/fragment metadata from `../lai-flight-correction-20261010/`. This is a native asset with approximate rendered materials, not a new full 3D game simulation.
- Integrated jerk-ramped ignition (0.35 seconds) followed by constant acceleration on +X. Fixed hull shape/heading, aft -X exhaust, camera derived separately from world travel. Original acceleration150 pass was too subdued in parent visual inspection; final300 with startX168 provides stronger visible flight without changing the model.
- Wakes follow actual past engine positions projected through the current camera. Far stars remain fixed; nearby dust moves opposite camera travel and leaves correctly oriented short exposure streaks.
- At drive loss, nine clipped pieces reconstruct the intact hull in place and inherit its actual cutoff velocity plus balanced separation impulses. Constant fragment velocity/spin thereafter; no gravity, atmospheric drag/smoke, stretching or ground shadow. Brief plasma light and old wake end fully before settle.
- Auto-stop payment never changes flight or creates manual cash-out. Both paid and missed rounds eventually lose the drive, as the committed Crash round does. Separate PAID label reflects the exact threshold crossing.
- Ready target forwarding, reload target initialization and precise near-target loss formatting extended to Crash. A 1.9999× loss cannot display as reaching a 2.00× target. Sub-1× values avoid logarithmic division. Saved outcomes keep their committed target, not newly edited controls.
- Existing Animated/System/Instant and hidden/reload behavior retained; no new clock or dependency. Opt-in cues sorted chronologically, including early auto-stop events.

All units are authored visual units; multiplier is not speed. Fictional warp is not a claim of relativistic simulation. Product UI remains short labels, values and state.

## Unchanged boundary

Existing 2,700 ms owner deadline (2,600 ms visual clock), RNG, odds, paytables, payouts, ledger and session schema; wallet/chain and financial/SSU gates. Jump Threshold source/art/motion and the shared timing owner remain byte-identical. Nine-file proof: `boundaries.json`.

## Verification

- Native architecture/source/final-delta and actual visual gates PASS. Independent reviewer inspected all three viewport contact sheets, extracted 25 fps mobile recording frames, and 320px max/near-miss readouts. Rigid bow-right flight, aft exhaust, continuous forward motion and in-place separation confirmed; no blockers.
- 374 tests / 40 files PASS, including six new invariants for integration/continuity, rigid flight, in-place fracture/momentum, inertial debris, exact payout boundaries and settled effects. Continuity assertions compare extrapolated left/right positions rather than confusing finite travel distance with a discontinuity.
- TypeScript/Vite build, Origins 8 checks and exact canonical-directory approved IOC scan PASS.
- Final production preview: 17 groups PASS — six fresh natural-RNG paid/missed flights at 320/390/1440; six engine-produced saved boundary receipts (0.98×, 1×, target−1, exact target, target+1, 1,000×); five lifecycle cases (Instant, reduced System, hidden, resize, reload).
- Actual intermediate frames verify forward travel, rigid dimensions, moving dust, fixed stars, clear thrust cutoff, in-place moving debris, complete effect fade, correct paid timing and visible framing. No page errors, failed hull asset, overflow or added balance mutation. Animated under OS-reduced desktop remains animated.
- Authoritative browser evidence: `qa/preview-final-browser.json`, CONTACT sheets and corresponding local PNGs/videos. Earlier preview passes are superseded. Browser scope is viewport-emulated Chromium and isolated browser-local free Play Money, not a physical phone, audio-listening or wallet/testnet exercise.

## Publication

- Runtime `e357cda8b6b888f5b6497855bdc6cfad63796621`, committed and pushed.
- Pages `a585128e`, immutable https://a585128e.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino → Warp Run.
- Three live files exactly match reviewed dist: JS, CSS and native Lai WebP. Full hashes in `live-build.json`.
- JS `index-n1rCb6ze.js`: `339fa542221435bfaa0336100b4d0b57094b99b96ab2cf7d2e02dc3750850553`.
- CSS `index-B7YTkTKA.css`: `fb066c4e37438bdf5ea35452e6f0817b91305476ed73a6903ca543608b8d648d`.
- Four fresh live natural-RNG flights PASS: paid/missed at 390/1440, actual continuous movement and breakup, correct auto-stop status, unchanged committed ledger, no page errors or failed ship assets. Preview boundary/lifecycle cases are not presented as fresh live tests.
- Preview5221 stopped; port verified closed. Canonical worktree/live index and unrelated Wrangler directories preserved.
- Rollback Pages `99895f55` / runtime `8f71c67f37a9a1eecfda55cc4f0ca1b9fab2cde9`. Primary origin only; GitHub Pages redirect-only. No wallet/chain/backend/gate changes.

Final native delivery review reconciled source/deployment/rollback, 374 tests/40 files, 17 preview versus four live cases, three exact files, nine unchanged boundaries and closed preview port. One receipt-only scope string incorrectly mentioned saved boundary cases in the live report; corrected the live string and helper selection. No runtime change or rerun required. Delivery gate PASS.
