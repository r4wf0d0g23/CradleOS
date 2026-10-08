# Null Vault pacing and station retirement — candidate review

## PASS — bounded source/candidate gate, 2026-10-08

Inherited native reviewer; no Opus claim. Source, runtime services and configuration were not changed by the reviewer. Parent's full multi-viewport/feature regression and the later delivered-production gate remain separate checks.

### Findings resolved

- **Unstarted saved Vault colour leak:** the first candidate masked busy sockets but retained coin-specific classes on a covered cursor-0 board. Current `visibleSymbol` neutralizes both `socketCovered` and covered hold boards. Independent restored-state browser check reports zero coin classes; no coin values or outcome titles were shown.
- **Outdated plan:** PLAN now reflects Raw's station shutdown instruction rather than preserving native hosting.

### Source assessment

The new schedule is presentation-only: earliest opening900ms,660ms per socket, last opening ends2760ms, aggregate reveal3400ms. Already-held coins bypass shutters; the feature instrument uses previous known state during scanning. Shutters/scan are neutral and finite, and the final displayed grid/value comes from the existing committed receipt. Collection has its own1350ms visual/1750ms reveal plan, without fictional respin sockets. Existing parent guarded callback remains the sole cursor updater; no settlement or RNG work moved into animation callbacks.

New socket timers participate in the existing run-generation cancellation/cleanup, and WAAPI uses the shared monotonic run start. Slot reveal timing is shared with the parent; seven other fleet mode timings remain unchanged. Service source, casino session/accounting/paytable/RNG/donation modules and network configuration constants have no patch diff.

### Independent browser evidence

Actual localhost5199 React UI, isolated valid frozen-engine Vault receipt in tab storage,320×700 touch viewport:

- Restored cursor0 has neutral cells. At600ms all15 unresolved sockets remain shuttered with no coin-specific class/value/title.
- At1600ms some sockets have opened while others remain unresolved. At2900ms every exact result is readable while the saved cursor is still0; after3400ms it advances once, with unchanged balance and sequence.
- A respin with six existing locks retains all six stationary/readable, shows only nine shutters, and preserves `VAULT BREACHED` rather than reverting known progress.
- Reduced-motion cancellation followed by a return to normal motion does not restart shutters; one final cursor update occurs.
- Mid-reveal reload preserves the prior cursor and does not autoplay. No page exceptions or horizontal overflow.

Six current motion unit tests passed independently. Evidence: `review/independent.mjs`, `.json`, `scan-320.png`, `locks-320.png`. Screenshots were visually inspected. This reviewer did not repeat the parent's full320/390/1440 matrix or every full-collection/miss fixture.

### Station retirement independently verified

- App no longer imports/mounts CasinoStation. Lobby entry and Assembly preset removed. Legacy `#/casino-station` opens the existing web casino; browser observed no native-media request or station entry button.
- Both native user units read as **inactive and disabled**.
- Current complete Tailscale Serve configuration has canonical SHA256 `766c7d9d901951f0be7a3875142b5713cac52bac358a3134d7f12dc5b610d02b`, exactly matching the recorded pre-pilot baseline. Private4174/443/8443 remain; public10000 is absent. No service was started and no configuration was changed during this review.
- Archived station source/evidence can remain without browser reachability. Confirm the final production bundle no longer carries/references the native endpoint when packaging; actual deployed app verification follows publication.

Source fingerprints and machine evidence are captured in `candidate-review.json`. No wallet connection, signature, funding or testnet wager was performed.
