# Architecture review — finite slot runs and animation upgrades

2026-10-08. Read-only review of `deploy/casino-motion-batches-20261008/PLAN.md` and the existing Session/Experience/reveal adapters, with a brief look at the in-progress pure helper scaffold. Inherited native reviewer, not Opus. This is an architecture gate, not implementation or release approval.

**Verdict: the design is viable. Proceed with the explicit invariants below; verify them at the source milestone before publication.** Per-spin debit with a finite user-selected count is preferable here to a large speculative outcome pack. Keep single-spin math, previously earned feature tapes, testnet HOLD and custody unchanged.

## Required clarifications

### 1. Separate paid/committed count from visually completed count

The existing ledger commits the whole current spin's payout and history entry before its first frame is presented. Consequently `sequence - startSequence` counts paid/committed spins, not fully revealed spins. The initial helper scaffold sets `completed=1` immediately after the first debit; do not also interpret that as a fully revealed round.

Use an explicit `paid`/`started` field, or clearly document the field as paid count and independently track the current presentation completion. A design with a revealed-completed field instead must allow exactly one additional committed pending round. In either form:

- Validate finite safe integers, an allowed slot key, stake bounds, planned count in 1/3/5/10, contiguous IDs from the start sequence, matching game/stake and matching current pack/receipt. At most one paid unresolved spin exists.
- For the eight fleet games, current receipt cursor is the durable reveal boundary. **Classic slots do not have a SlotReceipt cursor**; explicitly handle their settled-but-not-presented state, particularly reload, duplicate completion and Resume. Do not quietly rely on a React-only busy flag as the sole completion proof.
- Advance completion metadata and the final receipt reveal in one saved transition. A refresh between those operations must not double count or skip a paid spin.
- Run totals shown as completed totals must omit the current unrevealed final payout. The scaffold's raw history sum would otherwise reintroduce the future-feature payout leak removed in the prior UX release. It is fine to show paid stake count immediately; label it accurately.

### 2. Give one scheduler ownership of the next debit

The scheduler must hold a generation/token and recheck the **latest** canonical session immediately before a new spin is computed/committed: mounted, visible, practice mode, same run identity/game/stake, not paused/stopped, not busy, fully revealed current spin, remaining count, and sufficient balance/limits.

- A synchronous ref/latch changes before clearing timers or awaiting anything. Double clicks, stale React closures and multiple completion notifications cannot authorize a second debit.
- One pending advance timer per generation; one accepted commit consumes its expected sequence. Resume creates a new generation and never restores an automatic-running flag from storage.
- Pause/Stop are reachable and enabled during animation, outside any disabled controls fieldset. Stop inhibits future spending immediately even if saving its stopped marker fails; report that failure. Reload still comes back paused, so a failed stop-marker write cannot silently restart.
- Unmount, route/mode change, pagehide/visibility loss, refill, and reduced/normal changes must not recreate a spending scheduler. Reduced motion is a rendering preference, not permission for an accelerated burst of ten invisible wagers; retain a bounded inter-spin cadence and a usable Stop control.
- First spin/outcome/run metadata are persisted together before UI/audio; each subsequent spin is another one-spin engine call plus one atomic session write. Failed storage must not expose a new outcome or retry automatically.

### 3. Define feature progression explicitly

A paid spin may contain ordinary cascades, earned free spins, Vault respins, or collection. Count these as **one paid spin**, never extra run debits.

Ordinary cascading resolution can follow the current paid tape automatically if that is the intended experience. Stop the paid-run scheduler at an earned bonus/hold/collection boundary and keep its controls manual; do not skip the earned-entry presentation by auto-revealing all. A full initial Vault must still use the reviewed collection-ready semantics, not fictional free spins. On feature completion require an explicit Resume for the remaining paid run if it was paused for the feature. Stopping a run never discards an already-paid receipt or its remaining controls.

Do not determine trigger timing by inspecting undisplayed future outcomes. Use the revealed frame/earned state. The existing immutable tape remains the only outcome authority.

### 4. Keep stopped/completed run metadata from poisoning later saves

History retains 20 rounds and a run is at most 10; contiguous run validation is practical while that run owns the session. Once stopped and its paid feature is complete, or fully finished, the next unrelated play/new run must atomically clear or archive that run metadata. Otherwise a later game or history truncation can make an otherwise valid session fail restoration.

Existing v1/v2 snapshots without run metadata must preserve balance, hand, pack and earned features. Missing optional fields are legacy defaults; explicit malformed fields must never create an automatic run. Retain current strict invalid-v2/no-v1-rollback behavior unless an explicitly reviewed recovery design replaces it. Test both a prior complete snapshot and a prior pending feature, not only a fresh empty save.

### 5. Scratch needs one durable reveal contract across every surface

New packs use explicit bounded unique reveal indices. Old packs with no marker being treated as already revealed is sensible: it prevents an upgrade from re-covering settled history and does not touch financial values.

- Commit the index first, then publish its visual result and a once-only cue. Repeated index requests, resize, navigation, media reversal and reload do not replay sound/pulse. A write failure leaves the saved index set and receipt unchanged and preserves a clear retry/Reveal ticket action.
- Remove the old generic 2.4-second aggregate completion cue for Scratch. Ticket-specific amount/cue is tied to a successful new reveal; aggregate summary appears only when all are revealed. Reveal all should emit one bounded aggregate acknowledgement, not a simultaneous per-ticket audio burst followed by another full cue.
- Apply the same pending filter to primary result, pack receipt, recent-round detail and accessible labels. A closed disclosure still contains DOM; omit unrevealed content rather than hiding it with CSS. Keep the actual chip balance truthful. An explicit Reveal all/skip operation may unlock the full record without any debit or reroll.
- A single saved `pack` cannot retain two independently pending scratch packs. Require completion/explicit reveal-all before replacement, or define a separate durable archive. Do not let playing another game silently discard unrevealed paid-ticket presentation state.
- Partial canvas erasure may remain local until the threshold, as planned. Resetting that partial erasure after reload is distinct from re-covering a durably revealed ticket; set that expectation accurately.

## Animation integration constraints

- Keep one immutable old/new presentation snapshot per action for Blackjack splits, hit/dealer draws and card replacement. Display totals from the visible prefix, not the committed future hand. Disable choices until the presentation reaches the legitimate next decision state; do not invent extra decisions.
- Shared monotonic presentation runs and sticky direct media/visibility cancellation should cover non-slots, Plinko packs and resumed old receipts. Completion cannot depend exclusively on `animationend` or RAF, which may be suppressed or throttled.
- Event cues are opt-in and keyed to crossed milestones, never component rerenders. Late mounts/hidden return should settle or catch up silently, not dump accumulated sounds. Bound ten-ball/long-card-deal audio and per-frame work.
- Wheels retain probability-faithful geometry: equal angular widths for equiprobable stops. Change art/labels/legend for volatility identity. Keep every final card, pip, pocket, multiplier and matching group equal to the committed data.
- Retain the established exact payout/total-bet/partial-return labels and finite paying-hit feedback. Batch counts do not authorize misleading aggregate win labels or future-payout disclosure.
- No legacy animation import/revival, testnet bets, donation modifications, native asset replacement, RNG/paytable changes or automatic top-up belongs in this work.

## Minimum meaningful acceptance cases

1. All nine slots × counts 1/3/5/10: exactly N one-spin calls and N stakes at completion; zero extra draws/debits from presentation. Fixed-RNG comparisons match the unchanged engine outputs and balance telescoping.
2. Initial affordability at exactly maximum stake and one unit short; next-step insufficient/limit rejection; invalid counts, non-slot IDs, fractional/unsafe fields, count/sequence/history/pack mismatch.
3. Pause/Stop immediately before and during next-debit callback, double Start/Resume, duplicate completion, navigation/unmount and refill ID reuse; no stale spending or lost paid feature.
4. Reload after debit before first frame, mid-cascade, earned bonus entry, mid-free/hold, after final reveal, between paid spins, stopped and finished. Always paused, exact balance/receipt, no sound replay. Include classic slots explicitly.
5. Storage failure on initial spin, next spin, reveal completion, Stop, one-ticket reveal and Reveal all. Restore latest successful snapshot; no automatic retries or rerolls shown.
6. Previously published v1/v2 normal hand, completed pack and pending feature snapshots migrate unchanged. Run metadata remains valid after stop then another game and after normal history truncation.
7. Scratch partial/full reveals: exact unique indices, no premature default history/aggregate, repeated touch/reload/reduced reversal/resize retains revealed state, bounded one-shot audio, usable keyboard fallback.
8. Existing frozen slot math/bonus/motion/payout-hit tests remain; all 24 non-slot normal outcomes and selected desktop/mobile/reduced interruption checks use exact endpoint/time-domain assertions. Do not claim every outcome, physical-device performance or all-sizes coverage from a representative matrix.

## Review limits

No runtime edits or deployment were performed. The parent's implementation was changing during this architecture review; the helper observations identify design hazards, not a completed-source verdict. A separate implementation review must verify the final counters, scheduler, strict restoration and shared disclosure gates.
