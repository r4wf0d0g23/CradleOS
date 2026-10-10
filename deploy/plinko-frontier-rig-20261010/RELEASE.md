# Debris Drop — Frontier sorting rig, 2026-10-10

## Approved plan and implementation

Raw approved the proposed salvage-sorting machine treatment and requested a plan followed by execution (PLAN.md).

- Angular gunmetal housing, recessed dark ceramic backing, exposed fasteners, sparse wear and restrained orange hazard details. An original authoredSVG machine—not a native client machine render.
- Verified current-client salvage/reprocessing UI motifs, referenced through the validated icon manifest (assets.json). No synthetic item rewards or newly downloaded art.
- Mechanical twin feed jaws above the unchanged release plane. Cosmetic motion comes from the shared elapsed clock: subsequent loads open in advance; the initial release begins with clear jaws. No new timer or delay.
- Flush hex backplates behind the unchanged rounded steel collision caps. Backplates do not represent additional raised collision surfaces. Bright metallic pellets retain fixed lighting and exact radius/coordinates.
- Contact-impulse-scaled localized light; three dedicated opt-in metallic tick/strike/catch cues. Merged pack cues are sorted by timestamp. Generic sounds and opt-in/mute lifecycle remain untouched; no ambient loop.
- Recessed collection bays retain floor222/rest219 and original divider geometry. Amber arrival lighting begins at floorAt; counts/collection continue to follow route.duration. No early payout or result disclosure.
- Exact multiplier values remain at their original bucket x positions, staggered into two rows with short connector lines. Classic0.4851× and High500× remain exact. Long text is fitted within its plaque. Mobile-only Plinko padding gives the board more room. No tutorials, explanatory panels or new controls.

## Unchanged

plinkoMotion.ts and all4096 reviewed trajectories, ball/peg radii, owner deadline, RNG, odds, paytables, payouts, accounting, persistence, wallet/chain and financial/SSU gates. Single-ball rest, multi-ball spacing/fade, Animated default and explicitSystem/Instant remain. The quarantined legacy testnet renderer is untouched.

## Gates and scope

- Independent native architecture, source and actual fixture visual gates PASS. Visual review inspected intermediate full-size images, contact sheets, feeder/collection video frames and all four risk-profile labels at320px. Not an Opus review.
-368tests/39files PASS, including the existing five exhaustive Plinko physics/accounting/clearance/spacing tests. Physics source is byte-identical to the prior release.
-8component fixtures PASS: extreme left/right, alternating and mixed at390/1440; extreme left uses10balls. These are actual components with engine-generated deterministic rounds, not fresh live RNG.
-Origins8, approved IOC scan at the exact canonical directory, TypeScript and production build PASS. No new package or runtime dependency.
- Production-preview PASS: 12 natural-RNG playback/lifecycle groups (single/ten-ball at 320/390/1440 plus Instant, System, hidden, resize, reload, profile), 14 additional labels/asset/audio groups (all 4 profiles at 320/390/1440, missing-manifest fallback, opt-in/mute scheduling). Zero page errors, correct endpoints, unchanged ledger, full board visibility and working feed gate.
- Production PASS: 4 fresh natural-RNG playback cases (single/ten-ball at 390/1440), plus 4 exact-label/asset cases (Classic/High at 320/1440). Real intermediate movement, peg impacts, feeder motion, collection and committed endpoints verified. No page errors or failed game assets. Label/fallback/audio checks from preview are not presented as fresh live tests.
- Browser scope is viewport-emulated Chromium/free browser-local Play Money, not physical phones, audio listening or wallet/testnet execution. Gameplay costs and results remain those of the existing engine; the presentation adds no balance mutation.

## Publication

- Runtime source: `d2d6885d8173674446177f3d41672d62ab4e3478`, pushed to `cycle7-vestiges-20261002`.
- Cloudflare Pages: `0d725d71`; immutable URL https://0d725d71.cradleos-d75.pages.dev. Primary https://cradleos.io/#/casino → Debris Drop.
- Five live files exactly match the reviewed dist: JS, CSS, icon manifest and two client motif PNGs. Full SHA256 receipts in `live-build.json`.
- JS `index-DWTqRJDM.js`: `094bcb15536e2fc0c056b4e3da8a9e917cba801a967cbdbd9467877681eb0f4f`.
- CSS `index-hA2hk3Al.css`: `7246ae50bd4dc44d27637604545fae937c4ced213ab0508b10eb8e7ccdd8a596`.
- Rollback: Pages `37098633` / runtime `c717c0c3d4be7d47572b61a952589afb963da729`.
- Task dev 5218 and preview 5219 stopped; both ports verified closed. Fixture archived outside app source/dist. Canonical worktree and unrelated Wrangler directories preserved.
- Only https://cradleos.io/ is the app origin; GitHub Pages remains redirect-only. No wallet, chain, backend or financial/SSU gate changes.
- Final independent native delivery review PASS: source/deployment/rollback, distinct evidence counts, exact files, unchanged physics/gameplay boundary and cleanup reconciled. No blockers.
