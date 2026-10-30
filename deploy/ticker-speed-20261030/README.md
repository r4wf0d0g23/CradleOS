# Ticker speed — 2026-10-30

Raw request1565805177892507829: ticker far too slow. One-line duration change from max(45,chars/9) seconds to max(22.5,chars/18): exactly2x scrolling speed for any batch. Source reads, latest8/15min ordering, identity contrast, pause/hover/focus/reduced-motion unchanged. No new unit tests for this reversible style-only change. TypeScript/build, Origins8 and scoped IOC checks plus actual browser duration/motion/accessibility verification. Native source reviewPASS (not Opus).

Rollback Pagesd48d0689/sourcee3bf5259622c9d37fbcf0a31002862f369a919d6.

Preview PASS: real one-highlight batch measured22.5s (previous45s), actual motion observed; hover/keyboard/explicit pause and reduced-motion retained,390px fits,0errors/writes. TypeScript/build,Origins8,IOC PASS; one-line source independently reviewed.
