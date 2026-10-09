# Astral blackjack — October 9, 2026

User request: make blackjack cards fly/float in space, with an astral EVE Frontier theme.

## Delivered design
- Original lightweight starfield, wispy nebula, eclipse limb, orbital arcs and an orbital card shoe. Frontier charcoal/ivory/copper-orange with restrained cold starlight; no third-party space imagery or new runtime dependency.
- Metallic double-corner rank cards, verified current-client ship/structure icon emblems, emissive edges and a masked eclipse-seal reverse.
- 900ms curved measured-origin flight from the orbital shoe to each card's actual layout position, staggered deals, subtle luminous wake and 600ms hole-card flip. Flight and drift are separate transforms. Dealer reveal waits until all incoming cards arrive.
- Small independent zero-gravity hover. Pause drift survives new hands/reload via a separate cosmetic session key. Hidden tabs pause ambience; OS reduced motion disables atmosphere and uses existing sticky-cancel deal clock.
- Practice ready/table/settled and legacy saved-hand views use the new style; the staged testnet card view shares the artwork. No testnet activation or wallet execution.

## Boundaries
No RNG, deck, odds, paytables, session schema, balances, stake handling, settlement, donation, custody or wager gates changed. Display runs from already-committed hands. Hole cards emit no rank/suit/value metadata before the authorized reveal. Split mapping preserves unaffected seats. All other casino games and SSU sharing quarantine remain intact.

## Verification
Opus 4.8 source milestone review PASS: masking, reveal timing, split continuity, effect cleanup and unchanged wager gates. Full suite352/36, TypeScript, Origins8 and approved exact-directory IOC scan pass. Four new tests exercise hidden card markup, face threshold, reduced-mode output and all motion finishing before control unlock across80 deterministic game seeds. Browser results and release evidence are recorded alongside this file.

Production candidate: TypeScript/Vite passed, index-DGFUbUEd.js SHA256 e3e5cd616671abe2958ba58d959e4bf8d7a8755268c647e68339bd54b8dd71c1; index-jYaQmalH.css SHA256 cfb74d211f78f436c426699e87faadc81e59ee62248115ed4e21c29c80f13a0d. Existing bundle-size advisory remains non-blocking. Only ~0.9KB JS and10.2KB CSS added uncompressed; no new packages or downloaded imagery.

Development browser21 grouped checks passed across320/390/844/1440. Compiled production preview9 checks passed at390 including hidden/reduced/reload/resize boundaries. Zero page errors, icon failures or viewport/table overflow. See qa/dev-browser.json and qa/preview-browser.json. Deterministic fixtures are browser-tab-local Play Money only, never seeded into the shipped app.
