# Current review — October21 expanded book

**PASS — staged implementation; not approval/evidence of live activation.**
Native independent reviewer `book_v2_architecture_review` reviewed current source.
Workspace requests Opus, but that model was unavailable; inherited native reviewer
was used. No Opus result is claimed.

Architecture review blocked combat wagering: no canonical victim-controller-at-
death attestation. Current package removes combat entry points entirely.

Implementation review confirmed fixed recipient/indexed/idempotent payment,
conserved cumulative arithmetic, permissionless pause-safe recovery, pinned
canonical Pyth authentication of exactly parsed bytes, and deadline refunds.
Resolved findings:
- Removed >10000 reward-count branch that could stop all keeper work.
- Enforced real kernel flock before signing/journal access, including manual runs.
- Captured/check-bound delivery ID/items/recipient/reward/form in confirmation.
- Required exact live origin StorageUnit during fulfillment; no SSU access promise.
- Exposed pending digest/action and documented evidence-backed journal incident
  recovery; unknown transactions are never silently rebuilt/reset.
- Scope no-admin-override to reviewed code; UpgradeCap remains governed authority.

Reviewer independently ran6 keeper tests, inspected54 Move/483 frontend passes,
and gave a final scoped PASS after the origin and operational fixes. They required
release artifact replacement; this directory now supersedes old pilot artifacts.

Remaining external gates: restored backup verification/attestation, current API
credential and authenticated exact-expiry retrieval, actual publication/cap
custody, funded scheduled keeper proof, wallet lifecycle, web cutover. Do not
convert simulation or local browser fixtures into claims of production success.

## Network recovery / existing-backup proof review

October21 20:16 CT: DGX2 Tailscale reauthenticated; approved pinned Jetson2 route
restored. Independent native reviewer inspected `refresh-jetson2-proof.py` in
workspace research and independently verified the public receipt; altered-message
verification failed. Existing backup restored only on Jetson2, no private key
transfer, replacement, or transaction. PASS for this narrow proof procedure.
Only ONE verified off-host backup; this does not clear the two-backup gate or
authorize publication. Requested Opus unavailable; inherited native model used.

## Rewards-first deployment and chain-identity preflight

Raw's Jetson2-only exception (message1562636926295740447) is recorded in custody.
Independent native review PASS: publish/bootstrap reviewed modules, enable exact-
item rewards only, retain AdminCap in custody and create zero price markets.
Global Book.paused must befalse for new rewards; this is not a separate onchain
price-pause flag. Pyth key is needed only for price-proof jobs, not reward refunds.

Preflight caught SDK gRPC returning the full genesis digest while keeper compared
short CLI chain ID. Narrow fix pins full genesis before signer load. Reviewer
independently queried live genesis and decoded its first four bytes to4c78adac;
7 keeper tests pass. Move source/bytecode unaffected. Native review PASS.

## Rewards-only web cutover gate

Independent native review PASS: live Book, AdminCap and UpgradeCap re-read from
canonical GraphQL with exact IDs/owners/bindings; version1/stillness/pausedfalse
and empty market/reward arrays verified. Timer active with recent healthy
autonomous runs; deployed runtime hashes equal receipt. Real manifest and all
three dist hashes match web-release.json; rewards enabled, price wagering off.
Corrected stale noPublicationPerformed assertion in prepublication provenance.
Real user payment and signed-wallet lifecycle remain unverified; no fake activity.

## Final deployed delivery review

PASS — rewards-only deployment delivered, no remaining delivery blocker. Native
independent reviewer confirmed allthree live viewport receipts, exact JS/CSS
hashes and HTML-only hosting analytics injection/whitespace. Scheduled keeper
healthy; rewards enabled, prices off, existing House HOLD unchanged. No genuine
user payout or signed-wallet E2E has been verified. Final receipts committed.
