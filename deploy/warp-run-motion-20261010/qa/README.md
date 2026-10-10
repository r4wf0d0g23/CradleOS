# QA reproduction

`verify.mjs` drives actual app with QA_BASE and QA_TAG. Built preview runs six fresh natural-RNG flight cases, six exact engine-produced saved receipts and five lifecycle cases. HTTPS runs four fresh natural paid/missed flights at 390/1440 only. It records compact sampled motion rather than every frame. Console logs name each passed case. Browser sessions are isolated free Play Money; no wallet or global state changes.

`export-fixtures.ts` bundles with the already-installed esbuild and creates exact receipts through unchanged playSession, verifying restoreSession round-trip after JSON serialization. No Vite SSR profile or shared cache modifications. Receipts test stored readout/target/payout boundaries, not replayed animation.

`CONTACT-*` and `preview-final-*` are the final acceleration300/startX168 visual pass. Initial acceleration150 evidence remains local and is not counted as final. Raw PNGs/videos/logs are ignored. Native visual review should inspect intermediate frames and extracted mobile recording frames, not only endpoints.

Pure tests compare actual integrated-position derivatives, reconstructed fragment origin, mass-weighted momentum and strict payout boundaries. A continuity assertion was improved to extrapolate left/right positions to the cutoff: finite movement across the sample interval is not a position jump.
