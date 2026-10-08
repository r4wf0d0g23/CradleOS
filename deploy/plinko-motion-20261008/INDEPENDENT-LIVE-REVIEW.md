# Independent Plinko live release gate

**PASS — deployment 058ed040, source 96f3e8877da97de7c11ceb8412200e9703c441e0.**

Reviewed 2026-10-08 with the inherited native reviewer. Read-only verification; no wallet connection, signing, funding, testnet wager, source modification or deployment.

- Primary and immutable JS/CSS exactly match the provided SHA-256 hashes (`hashes.json`).
- Fresh public 390×844 touch context, normal motion enabled. A real practice drop was sampled over 157 animation frames: 100 distinct horizontal positions, upward rebounds, and all 12 peg contacts observed. Minimum sampled ball/peg center distance was 7 SVG units, exactly the sum of their radii; no peg penetration observed.
- The 12 committed bits sum to bucket 6. The ball landed at x 150 and the highlighted bucket was 6. Stake 12.34 chips returned 11.10 chips (floored 0.9×), with exact balance accounting and one settled receipt.
- A second drop was reloaded during its animation. The committed round, balance and sequence survived unchanged; reopening Plinko showed its final position without rerolling or reanimating.
- No page exceptions, mobile overflow or DEV VIEW toolbar. Existing DappKit missing-object-ID and Slush metadata CORS console diagnostics remain and are recorded; no claim of an entirely clean console.

Evidence: `browser.json` contains the full frame samples and ledger; `live.mjs` is the independent probe; `live-390-landed.png` records the final board.
