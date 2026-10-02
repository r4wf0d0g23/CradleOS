# Website deployment receipt — 2026-10-02

- Primary: https://cradleos.io
- Pages deployment: https://92ecd800.cradleos-d75.pages.dev
- Source: `858c09e1b099747a882bde50c7ed12f0f1eb2e83`, branch `cycle7-vestiges-20261002`.
- Project `cradleos`, production branch `main`; `VITE_BASE=/`.
- Live JS `index-D_7oxoZ1.js`; CSS `index-D_K0sBVG.css`.
- 91 frontend tests + production TypeScript/Vite build pass. Existing large-bundle warning remains.
- Independent pre-deploy review: no blockers for **empty-manifest website-only** state.
- Local and live browser checks: dashboard, tribe, casino, voting, registry, map, Origins,
  fitting, industry. No page exceptions or horizontal overflow; no retired API/package requests
  observed; no old recovery controls. Mobile casino/setup page also fits.
- Browser seeded with retired vault/game/delegation keys: removed. Origins reading progress
  preserved. Newly written current-cycle cache survives second load.
- Current-world read/index work from the earlier release retained. Origins/media assets unchanged.
  Automated browser audiovisual playback remains unverified (codec unavailable); no new claim made.

## Explicit non-completions

- No transaction signing, publication, funds movement, or singleton bootstrap. An offline
  PersonalMessage backup-proof signature was produced from the restored Jetson2 copy.
- Contract services await actual deployment/initialization; simulations are not publication.
- No connected-wallet financial end-to-end tests possible before fresh contracts exist.
- Voting simulation must be repeated after actual fresh Core address is bound.
- Repository §8.1: custody confirmed and Jetson2 restored-backup proof verified; second off-host copy (DGX1) remains unverified. See README.md.

The earlier recovery-oriented deployment `54e4e2fc` is **not** the rollback target for this
user-approved clean-wipe semantics. If a web regression requires rollback, retain the clean-wipe
manifest/signing fence and disabled services; never revive old-world recovery as a fallback.
