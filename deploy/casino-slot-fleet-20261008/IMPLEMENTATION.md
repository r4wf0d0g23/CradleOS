# Frontier slot fleet implementation

Eight original practice machines join unchanged classic Salvage Reels (9 slot games; 33 total practice games). Existing testnet catalog remains23, seed-only donations unchanged, wagering safety gates unchanged. No contract, custody, balance, wallet signature or real asset mutation.

## Reward architecture

- Version1 pure engines:10lines,243ways,8+anywhere cascade,5+connected cascade,hold/reset respins,expanding wild lines,sticky-wild free spins,variable2–5cell ways.
- All line/ways payments start at the leftmost reel; longest match once per line/symbol. Line wilds select highest eligible symbol. Ways have no wilds. Cluster adjacency is orthogonal; removal union and ordered gravity determine physical boards.
- Base-only3scatter triggers; fixed free-spin counts, no retriggers. Gatecrash retains raw grid and shows it before wild expansion; reduced-motion version still exposes scatter evidence. Drone wilds persist only within free spins.
- Null Vault requires6initial coins;3misses reset on any addition. Locked values pay once at timeout/full board. Full grid adds100scaled points to variable coin values, not a pooled or fixed-total jackpot. Extremal27respins plus initial =28frames is tested.
- Stake100..100000 in hundredths (1..1000chips). BigInt cumulative payout arithmetic floors once per cumulative stage, carrying fractional cents;2500× whole-feature return cap. Postcap stages cannot add credit.
- Coefficients calibrated on separate data then frozen.5games anchored by exact uncapped/unrounded expectation;3 estimated by1M/game calibration. Held-out1M/game plus2×250k independent seed batches/game at1,25,1000chip stakes. Minimum-stake floor bias and rare tails explicitly reported. Not certified RTP.

## Save and UI contract

- A paid round generates full bounded tape once. The same v2 save atomically debits stake, credits full capped return and stores the complete immutable receipt. Only newest receipt is retained;20-row history stores compact summaries.
- cursor = count of revealed frames. Next and Reveal all only advance it. A callback must match current roundID and cursor before committing. No draw, debit, credit or history mutation during presentation.
- New wager/game/currency/refill/donation blocked while presentation pending. Reveal all releases the lock. Other app navigation can unmount; return resumes from saved actual game, not blackjack.
- Visual balance masks unrevealed committed awards. Each settled frame displays saved actual award and running total. Future history return hidden until feature completed. Win celebration only after positive net final return; stop/feature cues distinct.
- Restore replays recorded bounded draws against frozen v1 rules; rejects edited grids, amounts, awards, rules version, cursor and extra/missing draws.300KB raw save bound and per-grid/frame/coin/win bounds prevent oversized corrupt snapshots. Invalid v2 never falls back to stale v1. Existing legacy hands and packs preserved.
- Future economic OR replay label changes require a new retained version. Fingerprint23cc3d2f394ca1480549faf5d1cf7d8745090fc90952ea2aad0a3d1e84de355c locks v1 tables and golden receipt strings. Do not re-tune live v1.
- Actual evaluated boards, declared paths and winning cells—not unrelated decorative outcomes. Responsive320/390portrait,844landscape,1440desktop. Bonus progress and feature cues. Mute stays opt-in; visibility cleanup and reduced motion preserved.

## Verification evidence

Engine23 tests + prior229 =252 tests; Origins8; TypeScript; dependency IOC scan; root-base production build. Browser reports include every fleet fixture and real random spins, rapid-click one-stake handling, all cursor locks, resume, skipped reveal, winning-cell match, failed storage writes, normal-motion raw→expanded Gate board and sound persistence. Full saved tape is locally inspectable by design; this is nonredeemable practice, not financial randomness security.

Art reuse preserves43 existing asset hashes. Public `casino/slot-fleet-math.json` carries measurements, stakes, seed/method, intervals, tail counts and zero-cap event bounds. Original icon manifest is unchanged.

## Release boundary / rollback

Primary cradleos.io only. Previous deployment9ccc3c8c. Commit reviewed source, publish from same dist, verify primary+immutable bundles/math bytes and existing43asset hashes, then independent live browser review. No GitHub Pages app mirror update. If rollback to old code is required, preserve tab storage: older UI does not know new fleet receipts, so prefer a forward compatibility fix and warn before any rollback that clears practice progress.
