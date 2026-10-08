# Finite slot runs + non-slots animation upgrade

## Scope
All nine playable slots gain finite 1/3/5/10-spin runs. All 24 playable non-slots receive audit-driven lifecycle/presentation work. No testnet wagering activation, dormant game resurrection, donations/custody/odds/paytable changes. Retain existing assets and reviewed slot bonus/motion engines.

## Slot run accounting contract
- Each paid spin invokes the unchanged one-spin engine and is atomically saved before presentation. Future spins are not drawn/debited upfront.
- Explicit Start N spins shows per-spin stake and maximum spend. Require enough starting chips for the full maximum; stake/game/count lock for the run. No infinite option, automatic top-up, loss chasing or increasing stake.
- Version2 optional run metadata: game, stake, planned, paid, shown, start sequence, stopped. Validate against contiguous current history (max10), current sequence and legitimate slot receipt. Existing v1/v2 saves remain valid.
- Optional autoplay state is ephemeral. Reload restores paused. Hidden closes sound and pauses; returning never restarts. Pause/Stop synchronously inhibit scheduler; Stop discards future attempts but leaves the paid spin/feature intact.
- Paid and shown counters differ by at most one; the current pending spin stays private until its final reveal. Only completed, fully revealed spins advance; stop on bonus entry, storage failure, invalid state or limits. Earned bonus controls remain manual; Resume explicit. At most one timer per scheduler generation; stale/rapid callbacks cannot spend twice.
- Normal new game/Refill requires current paid feature completion and stopped/completed run. Cash accounting/history exact; run totals computed only from revealed history, not inferred from UI animation.

## Shared motion contract
Parent-owned monotonically increasing run ID + monotonic start/duration. Child progress never restarts due to prop/motion changes. Reduced/hidden latches cancelled for that run; direct media/visibility listeners prevent races. One bounded event cue per crossed milestone, no catch-up burst or restored-result sounds. Exact committed final values; no RNG/financial writes from animation.

## Scratch
Optional reveal indices in saved pack, strict bounds/uniqueness validation; old completed packs without marker treated as already revealed. New packs start empty. Reveal storage commit precedes one-shot cue; progress changes do not alter balance/history. Hidden result pack/aggregate until revealed, explicit Reveal all available; restored revealed tickets stay open. Reduced motion removes visual travel, not user progress. Canvas erasure local until threshold, then durable reveal; failed writes keep valid receipt and retry affordance.

## Presentation batches
- Cards: proper blackjack new-card dealing/hold flip/dealer draw sequence, stable split seats; baccarat alternating order, three-card fan/qualification, duels opposing lanes, Andar fixed lanes, Red Dog rank interval.
- Wheels: equal probability sector widths, roulette ball orbit/braking/pocket landing, detent motion and exact readable selected result. Highlight actual selected winning wagers.
- Dice/coin: outcome-oriented two-sided toss; bounded die rotation/throw/settle with exact faces, cage for Chuck; probability ticker+target.
- Keno scanner/incoming draw strip + per-ticket counters; diamonds actual matching groups; distinct Crash ship/auto-stop vs Limbo gate; refinery feed/process/output; preserve Plinko paths with per-ball lands/count/contacts.
- Opt-in event-specific sounds, reduced-motion static equivalents, finite celebration and mobile stage stability.

## Gates
Independent architecture, feature and release review. Strict save/run validation, rapid callbacks, stop/hidden/reload/bonus/failure boundaries, aggregate cost conservation. Existing slot golden math and bonus/motion regressions retained; source tests+TS/build/Origins/IOC. Full 24 non-slot browser coverage, nine slot run coverage, exact endpoint and time-domain checks, desktop/mobile/reduced/mute. Preserve exact assets and custody files. Publish reviewed primary-only build, verify public hashes/UI, record rollback4c8cbbda.
