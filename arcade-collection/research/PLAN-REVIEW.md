# Frontier Arcade lifecycle / architecture review

2026-11-08. Independent native inherited-model review; requested Opus is not available in the native model choices and was not used. Review of PLAN.md only; no implementation or deployment performed.

## Verdict

**Architecture PASS; three contract clarifications required before the corresponding implementation is accepted.** Shared foundation can proceed. The eight games have genuinely different decision loops, bounded first-release campaigns and explicit touch/desktop controls. Dependency-free isolated deployment, origin-preserving Arcade links, existing-game isolation, truthful verification and rollback/retirement are appropriate. There is no reason to add accounts, a backend or blockchain state for this scope.

## Required clarifications

1. **Scrapline logistics must change play.** The pitch and core-decision column promise resource routing, power distribution and salvage bottlenecks; the run column currently promises only towers and a visible conveyor. Define the minimal functional logistics rule before building it: a bounded salvage-delivery rate and an explicit power budget or routing choice that constrains active defenses. Show resource/power state compactly. Acceptance: an engine test proves insufficient power/throughput affects defenses, resources are conserved, and a legal build sequence completes all six waves. A cosmetic conveyor over ordinary tower defense would not fulfill this game's declared twist.

2. **Signal Diver needs one timing authority.** Select the run clock used for note positions, hit windows and sound scheduling. Rebase or cancel scheduled sound on pause, visibility loss and resume so old notes cannot play during or after a held run. Silent/denied-audio play must remain possible using visual cues; avoid a promise of audio rhythm if sound is unrelated feedback only. Acceptance: early/late/out-of-window hits, repeated keydown, background pause and resumed phrase alignment have explicit tests; use real input to exercise at least one phrase. Gameplay must not depend on uncontrolled wall-clock catch-up after backgrounding.

3. **Record isolation must survive multiple tabs.** “Never overwrite another game's record” needs a concrete storage strategy, not only an in-memory profile containing eight fields. Prefer a versioned per-game key, or a concurrency-safe latest-record merge; merge best score/medals monotonically and award wins once per completed run. Acceptance: two tabs playing different games preserve both records, retry/reload cannot award again, and malformed/denied/quota storage remains playable. No requirement to add cloud or in-flight saves.

## Scope and acceptance notes

- Keep the release promises concrete: Voidhook must include an actual tether/orbit/release and cargo delivery loop; Feral Circuit must validate checkpoint order and laps; Wreck Runner must have landing reload/braking rather than only scrolling; Dockyard's stations must process required service types and real deadlines. These are direct consequences of the existing plan, not extra features.
- Legal-input completion pilots should use public action/update contracts without changing HP, score, timers, entity positions or outcomes. Use separate, clearly labelled fixtures for edge cases. Retain at least one loss/retry path per game as well as a win.
- The fixed-square/isotropic board is feasible, provided small-landscape side controls leave meaningful board area and pointer inverse mapping rejects letterbox input. Preserve state and require deliberate resume after orientation changes; distinguish browser emulation from physical-device play.
- Local records and prior immutable deployments are sufficient for this first-release lifecycle. The retirement “save-export path” is a future option, not an implemented export capability or a reason to create new scope now.
- No additional permission step or unrelated cleanup is required. Final publication remains gated on the plan's independent candidate/live verification, not merely successful upload.
