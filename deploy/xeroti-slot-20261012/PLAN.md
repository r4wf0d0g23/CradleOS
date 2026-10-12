# Xeroti Tidofiza — The Hunger

## Scope

A new web-only Play Money slot with native client artwork, a native Carbon/Trinity hull portrait and a four-stage devouring cluster feature. No physical-station, world, wallet, real-money or service changes. The existing eight fleet machines keep their original rule/receipt fingerprint.

## Research, not invented canon

Verified client snapshot: build **3573151**, Cycle 7 / Stillness. Exact native type → graphic → SOF hull join:

- Types **91011, 91368, 91369, 91370, 91371**: **Xeroti Tidofiza**.
- Graphic **29124**, hull **moontumor_04v02**, faction **asteroids_generic_07**, race **moontumor**.
- Group name **♦ Xeroti**; nearby localized strings **Feral Moon Tumor P2** and **♦ Moontumor**.
- Ordinary **Feral Mooneater** types **83487, 85278, 85702** point to a different asset: `str_moon_01v01:genericfrontier:generic`.

Client description:

> It swells and throbs, a corrupted bulge craving substance. Movements once tentative now ripple with purposeless energy, scraping and gnawing at the world around it. The air hums with quiet malice, as if the thing is learning, rehearsing the frenzied logic of its eventual freedom.

The files support the corrupted, hungry Moon Tumor identity. They do **not** establish an explicit evolutionary relationship with the ordinary Mooneater, current live spawn location or exact present-day server appearance. “The Hunger,” reel-symbol aliases and devouring gameplay are casino art direction, not additional canon.

## Presentation and assets

- Original 128px transparent client icon is the top symbol.
- Native portrait: exact hull built and rendered with Carbon/Trinity, 85 resolved texture records all reporting good. Empty-scene control provides alpha; 1.15× brightness and proportional crop only. No generated or substitute mesh.
- Six other symbols reuse checked-in Frontier ore, material and component artwork. Seven distinct symbols, familiar payouts in Rules.
- Quiet lunar starfield, jagged native entity, amber connecting veins and visible 1×–4× chain.
- Only previous, already revealed winning cells fly toward the entity. Clear takes 760ms; refill starts afterward; shared monotonic reveal deadline 1940ms. Final fourth-stage wins stay visible—no fictitious fifth board.
- Instant/System preferences, cancellation cleanup and saved-result concealment preserved.

## Economics

5×5 grid; clusters of five or more edge-connected identical symbols; up to four boards at 1×, 2×, 3×, 4×. Existing calibrated cluster evaluator and scale **12422698**, no new prize generator. Existing 2,500× cap, cumulative integer rounding and exactly-once settlement.

Independent new validation: **1,000,000** paid rounds at 100 chips, rejection-sampled xorshift32, seed123897. Measured return **96.2327%**, approximate 95% interval **95.6086–96.8567%**; any payout **23.6321%**, above-stake payout **18.1068%**. Simulation is not certification or a guarantee. Production uses existing WebCrypto RNG. See MATH.json and reproducible simulate.mjs.

## Acceptance

- Exact native assets visible; seven symbols legible at 320/390/1440px.
- Loss, partial and full-board wins align with committed receipts.
- Connections meet actual cell centers; only winning cells devour.
- Reload, skip, resize, hidden return and motion preference never change balances or replay settled results.
- 1/3/5/10-spin runs and stop retain exactly-once accounting.
- Preserve 34 physical terminals and disabled wagering boundaries.
- Build, focused/full tests, Origins/IOC gates, independent review, live file hashes and fresh live Play Money rounds.

Release status: published and verified; Pages3c7c7854, sourcef411594. See RELEASE.md.
