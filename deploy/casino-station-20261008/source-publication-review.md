# Final source publication gate — 2026-10-08

## PASS — bounded two-visitor pilot source

The remaining lobby navigation and public endpoint changes have no blocking finding. This is an inherited native-model review, not an Opus review. The frontend has not been independently tested as deployed by this gate; a separate live-app smoke is still required after publication.

### Independent checks

- Lobby `Station ↗` action synchronously checks `chainBusyRef`, pauses future slot-run scheduling, then changes the hash. The button is disabled during reported chain activity. Existing unmount cleanup cancels presentation/automatic timers; committed practice state remains the same tab-local ledger. No wallet or ledger access was added to the stream controller.
- Default stream URL resolves to `wss://spark-2def.tail587192.ts.net:10000/join`; HTTPS/WSS transport, not a localhost default, was observed in the actual compiled app.
- Fresh **320×568 touch** browser, exact compiled dist fulfilled at the primary origin, **mocked video transport**: real lobby entry → station → directory → Craps stake placement → station return → Craps remount passed. Exactly one CasinoExperience was mounted in a game, zero on the station floor, and saved escrow remained byte-identical through return/remount. Entry target was99.67×46px and within the viewport; no horizontal overflow, page exception or financial request.
- Both candidate bundle hashes exactly match `candidate-build.json`. Twelve protected files (configuration plus accounting/session/RNG/odds, donation, slot motion and bonus logic) are byte-identical to HEAD. Hashes are recorded in the accompanying JSON.
- Stream controller and station CSS retain the previously reviewed hashes. Parent identified the service-JS hash delta as formatting-only; the reviewed packet/connection/input/backpressure/shutdown bounds remain present. All six current service tests passed independently.
- Read-only operation evidence: one completed installed-service job (`job-1791497354164512048`) has `wine_cleanup:true`, exit0; the global cleanup-required marker is absent. Prior17-case sentinel/failure gate remains separately documented.

### Evidence and limits

Independent browser proof: `review-probes/final-candidate.json` and `final-candidate-320.png`; source/bundle fingerprints: `source-publication-review.json`.

Parent's `research/casino-native-stream-20261008/public-candidate.json` and public-mobile screenshot were reviewed: they document locally fulfilled candidate HTML with real public WSS, independent two-browser movement, approximately19/20fps, saved-game return and fullscreen. These are **parent measurements**, not an independent WAN performance guarantee. The visible mobile scene is the authored native casino interior; this gate does not claim official client interior parity, multiplayer avatars or a browser Carbon port.

No configuration or source-runtime edits, wallet connections, signatures or chain transactions were performed by this reviewer. Native public capacity remains capped at two anonymous visitors; Funnel bandwidth/service limits and unverified EVE embedded-browser/owner assignment behavior remain as documented. Testnet wagering HOLD and seed-only donation safeguards are unchanged.
