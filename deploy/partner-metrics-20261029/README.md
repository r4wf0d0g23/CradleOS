# Public link-only partner metrics — 2026-10-29

Requested by Raw for the EVE Frontier Partner Program application. Public URL:
https://cradleos.io/partners/metrics/

Standalone Vite entry, no EVE provider, wallet prompt, app navigation entry or
new analytics collection. Public anonymous read of the existing aggregate
endpoint. Noindex/nofollow is a discovery hint, not authentication. Includes
JSON/CSV download and print/PDF, plus eight selected Cycle 7 releases with
public commit and release-record links. Repository release archive is linked;
no GitHub Releases are fabricated.

## Metric meaning

Rolling 30-day distinct wallet addresses, not people/visits/full-Cycle reach.
Signed-in wallets are cryptographically verified identities; chain counts are
successful current-package senders in the five published tracked contracts.
Combined is a union, never a sum. Operator wallets are included. Sign-in
coverage begins 2026-10-09; new rewards, sports and secure-storage packages are
not counted in the current chain scope. These bounds are visible in the page
and exported report. No individual wallet list, key, log or signature exported.
Strict allowlist projection prevents future upstream extras leaking through.

## Checks

- 643 tests / 60 files; TypeScript and production build; 8 Origins checks;
  exact-dapp supply-chain IOC scan passed.
- 14 new model tests: projection, union, chain/cycle/scope, partial availability,
  timestamps, UTC boundary, stale export, CSV handling.
- Independent native review passed, including timer suspension/UTC rollover
  corrections. Requested Opus model unavailable; not claimed as Opus review.
- All 18 public source/release links returned HTTP200 unauthenticated.
- Sandboxed browser: real aggregate source, anonymous page, current counts,
  downloads, print, four widths; injected failure and suspended-clock expiry
  are identified fixtures. Root app navigation remains unchanged.
- Local Vite preview ignores Cloudflare _redirects; no-slash variant is verified
  on production separately with manual redirect fetch and browser load.

This release also includes the separately reviewed explicit tribe lookup:
../storage-tribe-selection-20261029/README.md. No backend, contracts, custody,
telemetry collector, balances or operator configuration is changed.

Deployment and production checks are recorded in release.json, live-assets.json
and live-browser.json once complete. Previous rollback: Pages33f7c6b7.
