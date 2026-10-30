# Gate control feature / release review

Reviewed 2026-10-30. Independent native-agent source review; no publication,
wallet signing, player-state mutation, or runtime-source edits performed.

## Result

**PASS — no blocking money, authorization, or publication-scope defect found in
the reviewed source.** This is a source/release-tooling review, not evidence that
publication or a real EVE Vault link/sign/jump has completed.

Reviewed contract source SHA-256:
`5fff1382198b777bf459e1c7f0cae6192e5197d2704f780abbb4d42a47bbe560`.
It matches `package-checks.json`.

## Verified corrections

- Pair-history admission now checks both current exact extension witnesses,
  reciprocal linkage and canonical capability IDs. Discovery/details label
  unverified routes honestly; buyers cannot bypass admission through the UI.
- Archived object versions and fully paginated transaction events require the
  native creation event, strictly increasing history through the current read
  version, and exactly one matching same-transaction RouteCreated/GateAuth
  authorization per endpoint. Errors and pagination limits fail closed.
- Purchase prepare and submit both revalidate identity, policy, price, passes,
  gate state and historical admission. Owner lockdown remains available when
  historical reads fail.
- Quote fingerprints exclude route activity/accounting changes while retaining
  policy revision and endpoint state; claims retain the quoted proceeds.
- Deactivation rejects unrelated current extensions before offering the
  interface's public-transit restoration action.
- Both owner capabilities must identify the expected canonical gate authority;
  the interface accepts the observed native address-to-character ownership
  representation as well as object ownership, without accepting another owner.
- Private witness construction is not exported. Payments are exact, atomic
  with permit/pass issuance, and route currency is immutable. The application
  accepts only current testnet EVE routes. Passes never override current policy.
- Reporting labels permits, passes and revenue separately; it does not claim
  native completed-jump analytics.

## Publication tooling

The one-shot publisher checks chain and publisher identity, restored-backup
personal-message proof freshness, reviewed commit/tag, clean committed build,
source/module hashes and pinned world dependency. Checked simulation effects
allow only publication, the empty registry, publisher-held UpgradeCap and gas;
two nested table UIDs are accounted for. A durable exclusive transaction journal
precedes submission. Independent verification compares confirmed effects,
relocated module bytes, empty registry tables and UpgradeCap custody.

Reviewed receipt evidence includes 15 unsigned fixture-browser scenario groups,
both rejected witness-construction attacks, and matching native dependency bytes.
These receipts are not substituted for actual owner-wallet operation.

## Nonblocking observations / boundaries

- The backup-proof challenge text still says "storage release" rather than
  "gate release"; this does not change its personal-message-only semantics.
- The emergency-lockdown builder requires the first endpoint's parent-node ID.
  An already-offline endpoint without a parent cannot use that builder, although
  the separate issuance-pause control remains available.
- Historical admission protects the application purchase path, not against an
  owner using native authority outside the application. Existing native permits
  cannot be recalled. Restoring power can revive an unexpired permit.
- EVE Vault destination selection and an actual owner-signed link/permit/jump
  remain unverified. Publication must not alter existing player gates.
