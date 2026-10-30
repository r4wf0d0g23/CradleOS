# Gate control — 2026-10-30

Raw authorized the audited gate feature set: reliable native linking/unlinking,
access controls, EVE tolls, timed passes, discounts, access windows, lockdown,
and reporting. Existing player gates must not be altered by publication.

## Native constraints established from current world source

- The installed EVE Vault sponsored API accepts a source assembly and action,
  not a destination. Use its native linking flow; remove the misleading local
  destination selector. Confirm the resulting reciprocal pair with supported
  chain reads. Never infer success from a wallet response alone.
- Linking requires both OwnerCaps, matching types, and an authorized sponsor's
  distance proof. Normal users cannot manufacture that proof.
- JumpPermit is character-bound, single-use, direction-agnostic, and accepted
  without rechecking extension policy. Both gates must use the same witness to
  issue it. Existing permits cannot be remotely recalled by our extension.
- Native jumps require both gates online. Native owner offline is the means
  of immediately stopping transit. Clearing an extension opens public transit.

## Implemented isolated architecture

- New `cradleos_gate` package, current pinned world dependency, private witness
  constructor. No dependency on old public CradleOSAuth or tribe vault.
- Registry binds BOTH gate IDs to one shared Route. Creation requires a
  reciprocal linked pair, canonical OwnerCaps for both, and authorized control of both caps; the interface borrows both from one
  authenticated character. The owner explicitly signs activation. No automatic
  migration or gate changes at deployment. No new irreversible freezing.
- One route policy and price in both directions. Configuration requires both
  canonical caps and exact revision. Closed/lockdown and deny rules win over
  all allows/passes/discounts. Public, tribe, allies and named-pilot controls.
- Route currency is an immutable Move generic. The application creates,
  discovers and sells only the exact current testnet EVE type. Exact u64 amounts, current-revision quotes,
  current character identity/tribe, and atomic payment plus permit issuance.
- Route-bound, character-bound nontransferable pass entitlements expire by
  chain clock. A pass buys fee exemption, never bypasses current policy or
  schedule. Membership discount uses the current on-chain character tribe.
- Single-jump permits have a short fixed validity (60 seconds), capped at
  schedule end and pass expiry. A charge buys a permit, not evidence of a
  completed transit. Show that consequence at confirmation. No queued keeper
  has owner caps, customer funds or authority to change access.
- Configure an absolute UTC access window and optional recurring daily UTC
  window. Native permits cannot outlive the current open window.
- Emergency Lockdown sets the route locked and takes one endpoint offline in
  the SAME transaction using native owner authority and its exact parent node.
  Already-offline gates still permit setting the policy lock. Resume only
  clears the lock; bringing gates online remains explicit owner action.
- Reporting separates permits issued, pass sales, EVE collected/claimed and
  available proceeds, plus the last 20 purchases. Native completed-jump
  analytics are not implemented. A permit is not counted as a completed jump.
- Deactivate explicitly restores public access and unregisters both gates;
  old route remains for proceeds recovery, cannot issue more permits/passes.
  No pass-refund guarantee; access changes are disclosed at purchase review.

## Verification gates

Move accounting/auth/schedule/revision/route/character tests; malicious alternate
policy and witness-export rejection; supported-read decoding/pagination/failure
tests; exact transaction builder and wallet-switch guards; desktop/mobile
browser review; clean-source bytecode/dependency check, unsigned publication
and live-world simulations. Fresh Jetson2 restored-backup signature and cap
custody per standing authorization before publication. Independent reviews at
architecture and release milestones. Actual EVE Vault link/sign/jump remains
unverified until a real owner performs it; do not fabricate player actions.

## Archival admission

Supported GraphQL objectVersions and fully paginated transaction events must
prove creation, every version and current gRPC version of both gates. New
pairs must never have authorized an extension. Existing routes require exactly
one matching GateAuth authorization per gate in the same RouteCreated transaction.
Current reciprocal links, canonical caps and both current extensions must match.
Incomplete or stale history disables purchases/activation, not owner lockdown.
This protects the app sale path against legacy unbounded permits; it cannot
prevent a gate owner from using native authority to open their own gate.
