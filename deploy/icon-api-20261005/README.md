# Public searchable icon API — 2026-10-05

Production: https://cradleos.io/api/icons. Public, read-only, no API key.

- Name / partial-name / raw resource-key search with bounded pagination and collection filters.
- Exact type lookup and image redirects, explicit missing-image responses, duplicate identities retained.
- Wildcard CORS for JSON/errors/redirects/PNG, browser canvas access verified across origins.
- ETag/HEAD/304/OPTIONS, immutable content-hash PNGs, strict input validation.
- Human documentation and OpenAPI 3.1 schema linked from Game Data → ICONS.
- 85 tests, Functions TypeScript, 8 Origins checks, IOC scan and production build pass.
- Actual Pages dev and public production route QA; not just direct-handler tests.
- No catalog re-extraction, art changes, transactions or services modified.

Source commit, deployment/rollback IDs, exact live asset hashes, browser and HTTP checks
are in release.json. Research evidence (including repeatable api-qa.mjs) is under
workspace/research/cradleos-icon-api-20261005. Review caught a raw-resource-key search
mismatch; both full keys and underscore substrings now have unit and HTTP regressions.

Deployment uses the existing reviewed Cycle 7 primary-only path from this worktree:
VITE_BASE=/ build, explicit-path IOC scan, cached Wrangler through protected gateway
environment. Old deploy-both points at a dirty original checkout and absent scanner;
it was not invoked. GitHub Pages mirror is not changed or claimed updated.

Rollback: prior production e3732607. Do not remove this worktree: shared character-index
service still runs from services/character-index (untouched by this release).
