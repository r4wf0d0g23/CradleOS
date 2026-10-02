# Cycle 7 production activation receipt — 2026-10-02

> **System names update:** deployment `a2635a4e`, source `213a54b`, supersedes the web bundles below. Names-only Cycle 7 client lookup; no map/topology or on-chain changes. See [extraction/scope](SYSTEM-NAMES.md) and [live receipt](system-names-release.json).

> **Website text/link update:** deployment `f1d658ac`, source `2b94dff`, supersedes the web bundle below. See [copy audit](COPY-AUDIT.md) and [live receipt](copy-release.json). On-chain activation facts below remain unchanged.

- Primary: https://cradleos.io
- Final Pages deployment: https://bbf026a2.cradleos-d75.pages.dev
- Source commit: `1320a2f`, branch `cycle7-vestiges-20261002` (pushed).
- Application implementation: `a03608d`; final commit corrects only social-preview metadata.
- Pages project `cradleos`, production branch `main`, `VITE_BASE=/`.
- JS: `index-DtLhTuyI.js`, 2,728,198 bytes, SHA256
  `b3710f55afd60c1409376f3bd0a8b936e3ed078bcb0e93076d9cd9bade4ee324`.
- CSS: `index-D_K0sBVG.css`.

## Verified release state

Five fresh current-world packages and singleton registries are published and initialized;
see `onchain.json`. No previous-world balances, games, obligations, vaults, policies,
elections or seals imported. Fresh caps remain in the previously confirmed custody wallet.
The corrected Voting package is active; rejected initial publication remains archived only.

- Casino: current EVE, empty bankroll, paused, wagering disabled. Bootstrap 1-unit limits
  are inert and not recommended operating limits. Website and social previews say awaiting funding.
- Voting: verified current Character ownership; Open eligibility, unit weight; Public
  SingleChoice/Approval only, no recasts. Unsupported modes and sponsorship disabled.
- Valid-owner cast: successful unsigned VM simulation; wrong-owner rejected.
- Live technical poll: signed create/open/close/tally/finalize completed, with **zero ballots**.
  Not governance and no funds transferred. This does not verify a real user's browser-wallet cast.
- Indexed reads: official GraphQL event/dynamic-field bridge verified through public proxy.
  Existing loopback boundary preserved; no new transaction-write methods.

## Checks

- Frontend 102 tests; TypeScript/Vite production build passes. Existing bundle-size warning remains.
- Voting 20 Move tests; prior unchanged Core25/Casino176 suites; backend28 tests.
- External proof-forgery compilation rejected. No test modules or retired World links in production bytecode.
- Anonymous production browser: nine routes and mobile pass; no page exceptions, horizontal overflow,
  retired API/package requests or recovery UI. Old operational cache cleared; Origins reading
  progress retained; new-cycle cache survives subsequent reload.
- HTML-only metadata follow-up retains the byte-identical app bundle tested above.
- Live bundle byte-for-byte matches build; all five active packages present; rejected Voting absent.
- Live HTML matches build except normal Cloudflare analytics-beacon injection/whitespace.
- Five actual static assets verified by MIME and byte hash (not merely SPA fallback HTTP200):
  logo, comics catalog, Chapter2 poster/captions, Chapter1 transcript.
- Independent final production review passed; focused Voting frontend suite 11/11 reconfirmed.
- Receipts: `live-activation-bundle.json`, `production-browser-summary.json`, `verification.json`.

## Explicit remaining items

- Casino needs a deliberate new bankroll and operating-limit configuration before wagering.
- Browser-wallet signing / funded financial end-to-end flows remain unverified.
- One off-host wallet backup (Jetson2) restored-signature verified. Raw explicitly deferred
  the second backup check for this release; DGX1 verification remains a follow-up, not a blocker.
- Origins Chapter2 serving was hash/range verified; automated browser playback remains unverified
  due to missing codecs. Approved Chapter1 film remains a pre-existing missing-media item.
- Keep this worktree: live character-index.service uses its source directory.

## Rollback

Earlier empty-manifest clean-wipe deployment `92ecd800` is a possible web-only safe-mode
reference; it cannot undo new on-chain publication. Never revert to the superseded
recovery-oriented release or import retired-world funds/state. New package receipts remain authoritative.
