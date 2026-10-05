# GitHub Pages: redirect only

The only CradleOS application is https://cradleos.io/ (Cloudflare Pages).
GitHub Pages serves this small redirect, not an application mirror.

`index.html` handles the project root and hash routes. Identical `404.html`
handles old deep links. The script strips only the `/CradleOS` project prefix,
then preserves the remaining path, query and fragment on the fixed cradleos.io
origin using `location.replace`. It never accepts an alternate destination.
No scripts, app bundles, wallet state or local storage are copied between hosts.

GitHub Pages cannot supply configurable HTTP redirect headers. These are
browser redirects: the root returns HTTP200 and a missing deep path HTTP404
before navigation. With JavaScript disabled, the meta-refresh/manual link goes
to the primary homepage. Non-browser API/asset consumers should update their
base URL directly to https://cradleos.io/.

Deployment branch: `gh-pages`, root `/`, no CNAME, `.nojekyll` retained.
Only index.html,404.html,.nojekyll,README.md belong on that branch. Publish
changes through the repository's supported PR/merge flow; do not push app
dist files here. No GitHub Actions app-build workflow is required.

Canonical source: `deploy/github-pages-redirect` on the source branch.
Future application releases target Cloudflare only; see
`cradleos-dapp/PRIMARY_DEPLOY.md`. No redirect redeployment is needed when
the app changes.
