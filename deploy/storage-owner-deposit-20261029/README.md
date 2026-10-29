# Owner storage → shared pool

User authorized implementation (2026-10-29, message 1565387813938143333).
Compatible in-place upgrade: adds deposit_owner and OwnerDeposit, retains existing SharedAccess defining package and policies. No user SSU writes during deployment. New amount-controlled Share action requires unit owner and deposit permission; explicit wallet consent remains required.

Checks: 49 Move, 658 frontend, 18 browser scenario groups; unchanged old production code, private-witness construction rejection, independent build equality, live world dependency parity and unsigned checks-enabled upgrade simulation. See review.md and receipts.

Upgrade signing: refresh-backup-proof.py then custody.json; exact clean source tag upgrade/cradleos-storage-owner-deposit-2026-10-29, package-build.json equals fresh-build.json. upgrade.mjs defaults simulation-only; STORAGE_UPGRADE_SIGN=1 signs once, journals durably before sending. Reconcile journal/chain instead of retrying. verify-upgraded.mjs must pass, followed by live original-bound owner ingress simulation. Pin only callable packageId; preserve originalId/registryId/worldId.

Release does not transfer players' inventory, change their permissions, or configure units. Actual owner wallet transfer remains a user action, not release QA.

## Live release

Pages d2438395, runtime 038d332. Package e5267a986c97c61f4d37a41a897f256f5fb8c943cf0a8540aa429510aa6596d0, original b373.../registry unchanged. Upgrade digest 5Y6UJTnoXz2zCLbP3pjH9zzRKc3HcqBnKVPB6qP8et2g. All publication, live ABI/bytecode/custody, original-bound unsigned owner flows, frontend and final deployment reviews passed. See onchain.json, owner-flow-simulations.json, web-release.json, live-assets.json and live-browser.json. No user inventory transactions. Do not rerun upgrade signer.
