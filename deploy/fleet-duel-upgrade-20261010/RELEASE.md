# Fleet Duel — command cards and fleet engagement, 2026-10-10

Raw requested an upgrade to Fleet Duel's cards and an animation that actually resembles a fleet duel.

## Delivered

- Replaced War's generic shoe/two-card table with metal command cards: large original2–A rank, native Lai wing artwork, opposite faction accents, rank corners, concealed card backs and clear victory/defeat/standoff status. No rank DOM/ARIA before reveal.
- Two opposing three-ship Lai formations coast toward contact with correct opposing headings. Opening volleys strike moving ship centers with shield responses. The higher-card fleet sends the decisive salvo; only the opposing wing fractures in place and carries its forward momentum. Winner stays intact. Equal cards retain both wings, with no lethal salvo or destruction.
- Single existing owner clock, now4,100ms for War alone (4,000ms visual). Cards reveal before combat; transient shots/shields/flash end before resolved state. Animated default and explicit System/Instant/hidden/reload behavior retained. No independent timer, dependencies, new asset files or game-rule changes.
- Verified native Lai top-view cutout, engine-side orientation and fragment metadata reused. Rendered materials/effects are authored presentation, not a new3D or full combat simulation.
- Simple result information: card ranks, fleet status and2×/0×/tie½return. No implementation/tutorial text in product UI. Existing rule/payout panel preserved.

## Unchanged boundaries

RNG, rank odds, win2×/loss0/tiehalf-return settlement, session ledger/schema, other game behavior and financial/SSU gates. Thirteen protected engine/Probability/Warp/Lai/timeline/art files byte-identical to2ef0d1c. Exact reverse-delta proof confirms only War's duration changed in shared motion library. CasinoRoundStage integration only routes War to its new scene and removes its obsolete generic card cues. See `boundaries.json`.

## Verification

- Independent native source gate PASS: all169rank pairs checked against actual settlement, correct concealed DOM/ARIA,42shot configurations reaching actual moving targets, in-place fragmentation, loss-only destruction and settled effects.
- Parent mobile visual inspection enlarged ships for clarity and removed redundant result narration. Final native source-delta/mobile visual gate PASS: no clipping, readable ranks/status, shared scale geometry preserved.
- 384tests /42files PASS, including five new exhaustive outcome/endpoint/continuity/reveal/settlement checks. A negative-zero equality assertion was corrected to numeric closeness; no runtime fault was masked.
- TypeScript/Vite production build, Origins8, exact canonical approved IOC scan PASS. Wrong package-ID event query search clean.
- Final production preview:20groups PASS — three fresh natural draws at320/390/1440; nine fixture-seeded actual-engine win/loss/tie playbacks across those widths; three engine-produced saved win/loss/tie reloads; Instant, reduced System, synthetic hidden, resize and reload lifecycle cases. RAF frames verify concealment, moving formations/bolts/shields, correct loss-only destruction, tieintact, exact final ranks, stable ledger, no overflow and full stage framing. Zero page errors or failed hull assets. Animated under OS-reduced1440 remains animated. Evidence `qa/preview-browser.json`. Browser scope: viewport-emulated Chromium and isolated browser-local free Play Money; not physical devices, audio listening or wallet/testnet execution. Deterministic playback uses a two-draw crypto fixture only inside the isolated browser, through the unchanged app engine; no test RNG endpoint or flag shipped.

## Publication

Pending reviewed build publication and fresh live proof. Rollback Pagesd7e9b59a / runtime2ef0d1c26d89c63f3c61e3c9ecb79d1dcda96455. Primary cradleos.io only; GitHub Pages redirect-only.
