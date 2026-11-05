# CradleOS web deployment — one application origin

Effective 2026-10-05: **https://cradleos.io/** is the only app deployment.
GitHub Pages is a permanent-purpose static browser redirect, not a mirror.
`deploy-both.sh` is retired and fails closed without building or publishing.

## Release from the reviewed current source

Use the reviewed release checkout, not an arbitrary/default branch or a dirty
original checkout. Current Cycle 7 work is on `cycle7-vestiges-20261002`.
Read the newest release receipt under `deploy/` before publishing. Do not reset
or delete worktrees that host running services. No world/contract/custody change
is implied by a web deployment; those retain their own release gates.

1. Review the diff and run tests appropriate to it.
2. In `cradleos-dapp`, run the Origins guard and the approved IOC scanner with
   this exact dApp directory, then `VITE_BASE=/ npm run build`. All gates must
   succeed; never silently skip a missing scanner or scan another directory.
   This host's existing scanner is
   `/home/rawdata/.openclaw-captain/workspace/research/eve-cycle7-20261002/scan-npm-iocs.sh`.
3. Commit/push the reviewed source. Use the existing authenticated Gateway
   environment for Wrangler; do not print/read credentials or add a new token.
   The installed cached Wrangler is usable without installing dependencies.
4. Publish from **that same dApp directory**:

   ```sh
   wrangler pages deploy dist --project-name=cradleos --branch=main \
     --commit-hash="$(git rev-parse HEAD)" --commit-message="Reviewed CradleOS release"
   ```

   `main` here is the Cloudflare production label, not an instruction to check
   out an old Git source branch. No `VITE_BASE=/CradleOS/` build or gh-pages push.
5. Verify production HTML references the reviewed bundle; compare live JS/CSS
   and changed data bytes/hashes against dist. Exercise affected UI/API routes
   in a real browser and check static assets/errors. An upload receipt alone
   is not proof of success.
6. Record source SHA, Cloudflare deployment ID, previous rollback ID and actual
   verification evidence. Future app releases do not republish the redirect.

## Legacy links

https://r4wf0d0g23.github.io/CradleOS/ redirects to the primary origin.
Its `index.html` and `404.html` preserve paths, queries and hash routes when
JavaScript is enabled. Browser-local wallet permissions/preferences remain
origin-scoped, not migrated. Update API/raw-asset consumers to cradleos.io;
a static HTML redirect is not a server-side HTTP301.

Redirect source and maintenance instructions: `../deploy/github-pages-redirect`.
Keep Pages enabled with source `gh-pages:/`; no custom domain or DNS change is
needed. Do not let old deployment scripts repopulate the app on that branch.

## Public guide and search surfaces (2026-11-05)

The app remains `/`; static no-JavaScript documentation lives in `public/guide/`.
Keep real `public/robots.txt` and `public/sitemap.xml` in each build: SPA fallback
can return HTTP200 HTML for either missing path, so verify content and MIME, not
status alone. Cloudflare may prepend managed crawler rules to robots; retain
those policies and verify no app HTML is appended. Public documentation must
keep per-page canonicals, useful content, actual HTML links and current metadata.
Partner metrics retains its existing noindex response; do not block robots from
reading that noindex.

Cloudflare Pages `_redirects` does **not** support domain-level redirects. The www
alias currently returns200 with apex canonicals. A true301 needs zone-level
Redirect Rules permission; the existing deploy token returned403 for Rulesets.
Do not claim a host redirect from a successful upload or add global Functions
middleware solely to work around this optional configuration gap.

Regression tools and the prepared optional zone rule:
`../deploy/seo-discoverability-20261105/`. Verify metadata, XML MIME, canonical
aliases, static bytes and live browser navigation before recording a release.
