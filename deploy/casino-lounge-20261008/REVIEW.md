# Pre-publication review

- Independent inherited-model reviewer completed source, payout/restore probes,
  audio cancellation and 320px browser review. Requested Opus is unavailable in
  the native tool model set; no claim that this was an Opus run.
- Review fixes: reject malformed per-game history, match dice chance 2–96,
  cancel pending audio on mute/hidden/unmount, scope CSS semantic colors,
  remove the misleading funding-as-world display guard, add live-house readiness
  to new-wager controls/handlers, including double/split. Hit/stand recovery retained.
- 158 unit tests pass (25 new); 8 Origins checks; exact-directory IOC scan clean;
  TypeScript + production Vite build pass. Existing monolithic chunk-size warning remains.
- Eight local games exercise stake/return conservation, triple-click and reload
  no-replay, storage failure before mutation, corrupt history recovery, and no
  practice POST requests. All 26 staged tables open at 390px; reviewer independently
  checks 320px. No page exceptions/overflow. Audio opt-in race tests pass.
- No source Move, current deployment IDs, ownership/custody or raw artwork changed.
- Current house public GraphQL: paused=true, bank 0, min/max 1 atomic. Static
  casinoFunded=false retained. No wallet connected, funding, signatures or wagers.
- This is a staged testnet integration, not funded end-to-end wagering proof.
- Previous deployment/rollback: 5c2a6e1a.
