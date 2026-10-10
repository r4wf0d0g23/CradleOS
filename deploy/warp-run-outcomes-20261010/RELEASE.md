# Warp Run — successful departure, 2026-10-10

Raw reported that a successful run still exploded. The previous release deliberately kept every ship flying to drive loss after auto-stop; that presentation was wrong for the requested successful-run outcome. This release supersedes that behavior.

## Correction

- Success is derived from the committed limit >= committed target. At the original exact auto-stop crossing, the intact ship accelerates forward into warp. It can never enter breakup, show explosion flash/debris or emit the crash cue.
- Zero-initial-acceleration forward jerk preserves position/velocity at warp entry. Rigid hull, +X departure, aft exhaust, independent camera and actual historical engine-position wakes. Hull/exhaust hide only once fully outside the viewport. No stretch, rotation or sudden teleport.
- Losing runs retain their existing drive-loss time and in-place inertial breakup. PAID and final statuses now agree with the ship outcome: WARPING / WARP COMPLETE versus DRIVE LOST.
- Source review caught a wake disappearing while its tail was still visible. Corrected it to clear independently of the hull, using the aftmost historical endpoint. Exact-target wins clear the wake by ~2,574ms, before the2,600ms visual endpoint.
- Round multiplier telemetry and auto-stop crossing time are unchanged: the multiplier still advances to the committed round limit even after the successful ship has departed. Payout, auto-stop target, RNG, odds, ledger, schema,2,700ms owner deadline, shared motion preferences and financial/SSU gates are unchanged. No manual cash-out added.
- Existing saved/Instant/System/hidden endpoints resolve immediately to the correct success/loss outcome. No explanatory UI added.

## Verification

- Independent native source review PASS after wake continuity correction; no remaining blockers. Sampled losing trajectories unchanged; exact-target winner clears the intact hull before settle.
- 379tests /41files PASS. Success permanence, exact-target/near-target boundaries, continuous departure, unchanged losses and independently clearing wake covered.
- TypeScript/Vite build, Origins8, exact canonical-directory approved IOC scan PASS; wrong package-ID event-query search clean.
- Final production preview:17groups PASS — six fresh natural-RNG paid/missed rounds at320/390/1440; six engine-produced saved boundary rounds (sub-one, one, target−1, exact target, target+1, maximum); five lifecycle cases (Instant, reduced System, synthetic hidden cancellation, resize, reload).
- RAF samples verify intact accelerating +X departures without any breakup/flash, hull rigid dimensions, separate static stars/camera, late loss breakup only, unchanged paid timing, final committed ledger equality, no overflow and visible framing. No page errors or failed native hull assets. Animated remains default under OS-reduced desktop.
- Parent inspected actual mobile/desktop contact sheets; successful intact departure/trailing wake and loss-only breakup visible. Captures taken after requested progress thresholds; RAF report carries actual timestamps. Scope is viewport-emulated Chromium, browser-local free Play Money, not physical devices, audio listening or wallet/testnet execution.
- Twelve protected engine/timing/Probability/Lai/art files byte-identical to68eb4f2: `boundaries.json`. Source change only Warp Run presentation/tests/style.

## Publication

- Runtime `2ef0d1c26d89c63f3c61e3c9ecb79d1dcda96455`, committed/pushed.
- Pages `d7e9b59a`; immutable https://d7e9b59a.cradleos-d75.pages.dev; primary https://cradleos.io/#/casino → Warp Run.
- Three live files exactly match reviewed dist: JS, CSS and native Lai WebP. Full hashes in `live-build.json`.
- JS `index-eAWGow-G.js`: `89b8a92bda1bdcd1d3e404984534b112a5734438cdd64f5641d4434095164b0f`.
- CSS `index-CIUwJ3pZ.css`: `1f4c602181e1ab0d996911f444c7bb1e64d216bf07807e30a6366ae4af0dc1d9`.
- Four fresh live natural-RNG paid/missed rounds at390/1440 PASS: successful intact departure without any flash/debris/breakup, loss-only breakup, correct paid timing, unchanged committed ledger and no errors/failed hull assets. Saved boundary/lifecycle cases are preview-only, not fresh live tests.
- Preview5223 stopped and port verified closed. Canonical worktree/index service and unrelated Wrangler dirs preserved.
- Rollback Pages `937079b0` / runtime `68eb4f2893f53d7336923a9d8e3b674b77150c62`. Primary origin only; GitHub Pages redirect-only. No wallet/chain/backend/gate changes.

Final independent native delivery gate PASS: contact sheets support intact successful warp/trailing wake and loss-only breakup; source/Pages/rollback,379tests/41files,17preview versus4freshlive,3exacthashes,12unchangedboundaries and closed5223 reconcile. No blockers or overclaim. Evidence-only receipt update, no runtime change.
