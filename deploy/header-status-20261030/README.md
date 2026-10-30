# Header status correction — 2026-10-30

Authorized by Raw: “Let's correct them” following the mobile header screenshot.
Frontend-only; no contracts, backend configuration, player transactions or
wallet connection handlers changed.

## Data semantics

- Checkpoint/epoch/time: official Sui testnet `LedgerService.GetServiceInfo`.
  Network name and genesis digest are checked. Timestamp is the latest executed
  checkpoint, not server wall time. UInt fields must fit safe display integers.
- Validators/reference gas: `GetEpoch`, bound to the same epoch. Committee epoch
  must also match. Failed/missing data is unknown, never zero. Each gRPC call has
  an eight-second deadline; the whole refresh is cancelled after eighteen seconds.
- API latency: successful `GetServiceInfo` response duration, not failed legacy
  JSON-RPC timing or transaction confirmation time. Suppressed on stale samples.
- Refresh: every thirty seconds while visible, plus return-to-visible refresh.
  No overlapping reads; unmount cancels work. Local age advances every second.
- `Live`: valid current sample and checkpoint, both at most ninety seconds old.
  `Partial`: checkpoint verified, optional epoch fields unavailable. `Stale`:
  failed refresh with a prior sample, or sample/checkpoint older than ninety
  seconds. First failure is `Unavailable`; initial pending state is `Checking`.
- Stillness indicator explicitly describes its HTTP health API, not the game
  server or the chain. HTTP success AND JSON `ok: true` are required. Failed
  probes are `Unavailable`, not proof that the game server is offline. Expired
  samples are `Stale`.
- Removed unverified hardcoded `ERA 6: AWAKENING`; retained Cycle 7 · Vestiges.
- `Not connected` replaces `No wallet`. Missing-provider mobile guidance is
  `Connect from desktop`; desktop points to official Chrome/Firefox releases.
  Platform detection only selects guidance. A detected provider retains the
  original connection path on any platform. No new mobile wallet bridge claimed.

Existing private-node maintainer telemetry remains unchanged.

## Checks

- 809 frontend tests in 67 files, including 31 targeted header cases.
- TypeScript/release build, eight Origins checks, approved IOC scan: passed.
- Independent native source/API review: PASS; no blocking findings. Reviewer
  separately verified current official testnet and Stillness API data.
- `verify-browser.mjs`: release browser against actual live read-only APIs,
  deliberate failure/partial/stale/recovery cases, four desktop widths, mobile
  missing-provider guidance and synthetic provider discovery. No signing.
  TLS-validating Node relay supplies browser external egress.
- `verify-assets.mjs`: exact production JS/CSS hashes plus main/partner routes.

Prior production rollback: Pages `1f1eb0fd`, runtime source
`4f372e327db2d0f1699c713001217e85996561b9`.

Publication and production results are recorded separately after verification.
