# Turret extension decoding repair — 2026-10-07

## Cause and scope

The owner turret reader expected `extension.name` for every configured turret.
Current public Sui GraphQL flattens `Option<TypeName>` to a string or null.
A valid configured turret therefore threw `Turret extension data is incomplete`
and prevented the owner's fleet from loading. Power cycling does not change this
JSON representation.

The patch accepts the current string form and prior name/option representations,
normalizes the full struct identity, and rejects missing/malformed data rather
than treating it as an unconfigured turret. Existing ownership, frozen binding,
foreign replacement consent, and pre-signature refresh checks remain unchanged.
No contract deployment, targeting settings, ownership or on-chain data changed.

## Evidence

- Public GraphQL sample: 30 current-world turrets, four configured as strings.
- Regression suite before patch: nine failures, including the exact live value.
- After patch: 42 focused turret tests; 133 complete frontend/server tests pass.
- Origins guard: eight checks pass; IOC scan clean; TypeScript/Vite build passes.
- Desktop 1440px and mobile 390px: real read-only owned-fleet fetch returns four
  configured turrets. Those rows render through the actual settings card; foreign
  replacement confirmation, frozen controls, own-extension recognition and game
  defaults verified. Simulated save callbacks only: no wallet transactions.
- Public release details and verification recorded separately in release.json.

Local evidence: `research/cradleos-turret-decode-20261007/` under the agent
workspace (live snapshots, failing/passing tests, browser script/screenshots).
Read-only discovery/UI checks do not prove game-server callback execution or
actual turret firing. Infinion's specific wallet was not identified or used.

Deployment follows `cradleos-dapp/PRIMARY_DEPLOY.md`; only cradleos.io is updated.
Rollback: prior Cloudflare deployment c8398be2; no chain rollback required.
