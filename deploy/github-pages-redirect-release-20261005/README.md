# GitHub Pages retired as an app mirror

Raw authorized redirect-only GitHub Pages and subsequently approved existing
admin merge permission for the two independently reviewed PRs. Both were merged,
not merely pushed. Pages build37354701031 succeeded; public navigation verified.
Branch protections, Pages source configuration, DNS and Cloudflare deployment
remain unchanged. No wallet, contract, RPC service or client-art source changes.

Source/docs landed on master and were cherry-picked onto the active Cycle7 branch.
The retired deploy-both.sh now exits2 without building or publishing. Normal web
releases follow cradleos-dapp/PRIMARY_DEPLOY.md and target Cloudflare only.

Canonical static redirect: deploy/github-pages-redirect. Published gh-pages tree
has only index.html,404.html,.nojekyll,README.md. No app dependency, build or app
asset synchronization is needed there. Previous pages commit is recorded for
rollback without rewriting history.

Nine local and nine public browser navigation scenarios pass, including path,
query, hash, fixed-origin adversarial inputs and no-JS fallback. Three additional
unintercepted app landings verify actual Recipes/GameData rendering with no
retired app asset requests or page exceptions. Live index/404/deep-path bodies
match the reviewed SHA256. Primary app bundle and icon API unchanged/healthy.

GitHub Pages serves HTML browser redirects, not HTTP301. Raw HTTP API/asset
consumers should use cradleos.io directly. No-JS goes to the primary homepage.

Evidence/repeatable checks: workspace/research/cradleos-pages-redirect-20261005.
Exact PRs, commits, build and test results: release.json.
