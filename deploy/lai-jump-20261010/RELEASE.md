# Lai Jump Threshold — 2026-10-10

## Scope

Jump Threshold (Limbo) now uses the current-client Lai hull artwork: accelerating star streaks and engine exhaust, a stretched warp departure on a committed win, or a single explosion with drifting hull fragments on a committed loss. Concise speed/target/state only; no explanatory product prose.

4.1-second finite reveal uses the existing shared motion lifecycle. Animated default, saved System/Instant and hidden/resize/saved-round behavior retained. Valid next target previews before the first round; a finished round always displays its committed target. Saved Limbo target initializes the input correctly. Near-threshold loss remains numerically distinct from a win in the stage and round details/history.

Rules, odds, RNG, accounting, session schema, financial HOLD, SSU quarantine and chain state unchanged. No new dependencies or runtime 3D engine. Actual Lai type82425/graphic27407 art is derived from the verified current-client512 image; see art-source.json and prepare-art.py. The archived GLB trial had broken geometry and was rejected, not shipped.

## Verification

- Independent native source review and small summary-label delta: PASS (SOURCE-REVIEW.md). Not an Opus review.
- Full suite: 363 tests / 39 files PASS; includes exact-threshold branch, monotone endpoint and false-round-up regression checks.
- 12 preview browser groups PASS: both natural RNG outcomes at320/390/1440 plus saved win/loss, synthetic hidden event, resize, Instant, System+OS reduction. Desktop default Animated tested under OS reduction.
- 4 final-build target-boundary groups: ready1.37 preview, engine-produced saved1.37 reload, engine-produced19999/20000 loss reload; current/details/history speed precision and 1,000× HUD bounds at320px verified. The first max-value layout check found a7.6px inner-HUD overflow; reduced mobile gap/font fixes it. The12 earlier preview groups are motion/lifecycle evidence, not claimed as rerun after this CSS-only correction.
- TypeScript/Vite, Origins8 and approved canonical-directory IOC scan PASS.
- Tests use Chromium viewport emulation and isolated browser-local free Play Money. No physical-device profiling, audio-listening, wallet signing, testnet wagering or chain writes claimed.

## Deployment

Pending publication and exact live verification. Rollback: Pages80bd1dcd, sourcee8459b4f961b90967d187c5420cfb1402aebae51. Canonical worktree is preserved because it hosts the live character-index service. Unrelated Wrangler directories are untouched.
