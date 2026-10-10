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

Published source`fe7ac41fa920440d6d4f7d94089215c4ba9dea79`, Pages`adbad865` (https://adbad865.cradleos-d75.pages.dev), primary https://cradleos.io/#/casino. Live JS, CSS and Lai artwork exactly match dist (live-build.json). Four fresh live natural-RNG cases PASS: win and loss at390 and1440; desktop OS reduction with defaultAnimated, visible movement, correct effect/end state, unchanged committed ledger, no page exceptions or asset failures. Rollback: Pages80bd1dcd, sourcee8459b4f961b90967d187c5420cfb1402aebae51. Canonical worktree is preserved because it hosts the live character-index service. Unrelated Wrangler directories are untouched.

## Live artifacts

- JS `index-BvS-ahuv.js`: `b787aab0729004702c88e8912944ec79e2aa7ed4cbbe149b97b35045c669698d`
- CSS `index-CytlU_qT.css`: `60d4cbab27d35a8af73a03a650bed2253312c355c34c4469b60829ae843b5af9`
- Lai WebP: `54d4d452e9b93b6e9306fa655f711db18a73e42e27fb71d3d0f4d01b45f01404`

Task-owned preview5214 stopped and port closure verified. No unrelated services changed. Independent native delivery review reconciled all source IDs, counts, hashes and verification bounds. Its metadata correction was applied: deployment.json uses recordedAt for receipt creation, not a claimed Cloudflare event timestamp. No runtime or verification discrepancies remain.
