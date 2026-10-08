# Plinko motion repair — 2026-10-08

Raw reported the ball falling straight through the board. The practice component
received a null result during reveal and used a vertical CSS translate loop; its
actual committed path was only drawn afterward. The board also lacked a centered
first peg.

Replace that placeholder with a pure presentation route driven by all twelve
committed outcome bits, not new random draws. Correct the triangular geometry to
one through twelve pegs per row. The ball touches each peg at the sum of the
ball/peg radii, holds contact for 32ms to remain visible between frames, rebounds
along quadratic arcs, flashes the hit peg, and trails its recent motion. The
last rebound aligns to the exact paid bucket. 2220ms travel +180ms landing beat;
reduced-motion preference skips the travel. Tick identity is the immutable round,
not the refill-reset numeric ID. Animation is cancelled when unmounted.

No change to random outcome generation, payout odds, chip debits, save format,
contract packages or live house state. Reloading cannot re-debit or reroll. This
fix targets Play Money; legacy staged-testnet PlinkoStage is unchanged, and
casinoFunded=false / paused empty house remain intact.

Verification: all4096 paths map to the actual payout bucket; contact coordinates,
full-board clearance, visible contact timing, all-left/right/mixed extremes;
163 total unit tests, Origins8, IOC and TS/Vite build. Actual RAF browser captures
at320/390/1440 show all12 contacts and lateral bounces, one debit despite two
synchronous clicks, exact landing, reduced motion, mid-flight reload and refill
ID reuse. Independent geometry/source/browser review passes. No funded wagering.

Pre-release rollback:0558af33. Public/immutable checks and final receipt follow.
