#!/usr/bin/env bash
# Retired 2026-10-05: GitHub Pages is redirect-only, never an application mirror.
set -euo pipefail
cat >&2 <<'NOTICE'
Dual deployment is retired. No build or publication was performed.
The sole application target is cradleos.io (Cloudflare Pages, base /).
Follow PRIMARY_DEPLOY.md from the reviewed release checkout.
Do not publish dist/ to gh-pages; that branch contains only the redirect.
NOTICE
exit 2
