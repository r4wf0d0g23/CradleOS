# Base-first dashboard — live 2026-11-01

- Source: `656eb34108dffe6c3544e3757a1c24896923cdab`
- Cloudflare Pages: `a4d21375` — https://a4d21375.cradleos-d75.pages.dev
- Primary: https://cradleos.io/#/dashboard
- Rollback: Pages `55757e91`, source `3b81f24e40d94068306b10340cf2f95b1efe612d`
- Reviewed, committed source pushed to `cycle7-vestiges-20261002` before publication. Built in the same canonical dApp checkout with `VITE_BASE=/ VITE_SERVER_ENV=stillness`.
- All five production JS/CSS SHA-256 hashes match dist. Root and partner HTML references match; partner noindex and 301 retained. See `live-assets.json`.
- Production browser: 6 owned bases / 27 structures, live public chain reads; synthetic read-only wallet, no player authentication/signing. Child-ID search retains full-base contents; no-match/clear, persisted collapse/reload, expand all and disconnect cleanup pass. Widths 1440/650/390/320, zero errors and writes. See `live-browser.json` and screenshots.
- Full release evidence and explicit location-read limitation: `REVIEW.md`.
- No player assets, policy settings, contracts, custody, backend services or Known Space collector changed.

Final independent production audit PASS: reviewer re-fetched all five live assets and compared receipt/local hashes, checked source alignment, partner routes and production browser/mobile screenshot. No blocking issue. Owned preview on port 5367 stopped after verification.
