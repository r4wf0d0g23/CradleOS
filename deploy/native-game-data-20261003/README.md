# Native Game Data reference release — 2026-10-03

Raw's "carry on" extends the validated native correlation proof into Game Data.

- 299 current-client recipe definitions with complete input/output lists.
- 455 linked raw attribute records; 233 attribute definitions with source units.
- 538 API items remain primary; 28 additional recipe-linked client-only types are
  explicitly distinguished. Smart Turret and Field Cairn lack native records.
- API/client discrepancies retained, no silent replacement. Same-name Reiver
  variants retain different type/graphics IDs.
- No facility/timing/effective-stat claims; Industry/fitting remain historical.
- No models, contracts, wallet activity, funds, private profile or services changed.

Reproduce: datamine/cycle7/NATIVE.md. Input digests and native run/decoded output
are linked in native-v1.json provenance. The run's local evidence was preserved
under workspace research/cradleos-native-data-20261003 before further experiments.

Prepublication: 63 frontend tests,15 Python extraction tests, TypeScript/Vite,
8 Origins canon checks, recovered existing IOC scanner, independent extraction
and UI reviews, desktop/mobile recipes/item details/error retry/wrong-cycle
checks all pass. No page errors or retired Keeper requests.

Publication uses the existing Cycle 7 worktree and PRIMARY cradleos.io Pages
project (production branch main), preserving the current release topology.
The old deploy-both.sh hardcodes the other dirty source tree and absent scanner
path; it must not be executed unmodified. Use the same reviewed worktree build
and explicit Pages publication as preceding Cycle7 releases. The older GitHub
Pages mirror is outside this scoped domain release and is NOT claimed updated.
Do not reset the original frontier worktree or delete this worktree: live
character-index runs from it. Rollback is the prior8f878413 Pages deployment.

Postpublication source hash, deployment ID, bundle/data digests and live browser
results are recorded in release.json after verification.
