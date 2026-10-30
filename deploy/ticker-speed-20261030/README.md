# Ticker speed — 2026-10-30

Raw request1565805177892507829: ticker far too slow. One-line duration change from max(45,chars/9) seconds to max(22.5,chars/18): exactly2x scrolling speed for any batch. Source reads, latest8/15min ordering, identity contrast, pause/hover/focus/reduced-motion unchanged. No new unit tests for this reversible style-only change. TypeScript/build, Origins8 and scoped IOC checks plus actual browser duration/motion/accessibility verification. Native source reviewPASS (not Opus).

Rollback Pagesd48d0689/sourcee3bf5259622c9d37fbcf0a31002862f369a919d6.

Preview PASS: real one-highlight batch measured22.5s (previous45s), actual motion observed; hover/keyboard/explicit pause and reduced-motion retained,390px fits,0errors/writes. TypeScript/build,Origins8,IOC PASS; one-line source independently reviewed.

LIVE Pagesa03fd651/runtime1e8e98b7bd123151d4004c2606d32fbf97d4f7c8. Production measured22.5s vs prior45s, actual movement/pause/reduced-motion/mobile PASS,0pageerrors/writes. Exact five live hashes and root/partner/noindex/301 verified. Initial propagation read hit transient ECONNRESET; retry succeeded with byte-identical results. Owned preview5365 stopped.

Independent native production PASS (not Opus): five live asset hashes and corrected duration independently verified; browser evidence22.5s vs45, motion, pause/reduced-motion/mobile reviewed; no blockers.
