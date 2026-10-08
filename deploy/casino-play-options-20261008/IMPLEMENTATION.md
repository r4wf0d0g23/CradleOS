# Delivered options and boundaries

## Practice floor

- Plinko: 1/3/5/10 balls, Classic/Low/Medium/High source tables. Twelve physical peg contacts per path, staggered common board, preview follows selected risk, receipt stores original risk.
- Roulette: up to 49 canonical choices across six types, one single-zero spin; add/remove chips, Undo/Clear/Repeat (copies draft only). Each selection limited to 1,000 chips; combined stake explicit.
- Keno: 1–4 tickets, 1–6 picks apiece, independent stakes, shared 10-of-40 draw. Quick pick and ticket-specific paytables/result overlays. Drafts including unfinished empty picks survive other games/reloads; empty tickets cannot play.
- Blackjack: 1–3 seats, one shuffled 52-card shoe and dealer; S17, naturals3:2, initial natural check, one exact-rank split per seat, no resplit, split aces one card, split21 ordinary win. Double unsplit initial two cards only; no insurance. All payouts deferred until final settlement. Active total/dealer upcard repeated by phone controls.
- Scratch: 1/3/5 tickets, touch/mouse scratch mask, individual or all-ticket keyboard reveal; reduced motion shows symbols immediately. Scratching never changes the committed ledger.

Finite user-triggered packs only. No autoplay, escalating losses, deposit conversion or real-money payouts. Unchanged instant games retain their previous rules. All return multipliers include stake; integer rounding applies to each unit before totals.

## Storage

`cradleos:casino:practice:v2` is authoritative after its first successful write. Migrate v1 only when v2 is absent; retain v1 as an untouched rollback snapshot, never silently restore it over corrupt v2. Legacy unfinished hands use their original single-hand rules. Corrupt v2 explicitly resets free practice chips with a notice. Pack receipts retain original choices, results and stakes; bounded blackjack action logs replay the exact shoe to validate saved state.

`cradleos:casino:options:v1` stores nonfinancial preferences independently. Preferences cannot overwrite ledger state or initiate a play. New actions commit synchronously before UI/animation; storage failure leaves the previous ledger unchanged. Active old/new blackjack blocks refill, game, currency and donation navigation.

## Financial boundary

Existing seed-only Donate $EVE remains unchanged. `casinoFunded:false`, contract quarantine, pause/readiness and donation preflight/unknown-result guards stay in place. No contract or live house write, wallet signature, activation or fund movement performed by this release. Testnet options are not advertised as implemented multi-play equivalents. Stale staged Blackjack fixed-deck prose now describes its actual fresh-draw source rather than practice rules.

## Verification

229 tests across22files;24 new options tests (including16,384 Plinko routes/profiles, all37 roulette outcomes,150 three-seat blackjack shoes, migrations/corruption/RNG/draft checks). Origins8, IOC, TS and build pass. Independent architecture and final candidate source review pass. Development responsive320/390/844/1440 plus real normal-motion and mock-wallet donation regression pass. Production peg frame captures confirm all12 contacts at left/center/right and reload/refill integrity; production full matrix and public delivery receipts are recorded alongside this document.

No extracted artwork changed:43 hashes retained. Existing large-bundle/mixed-import build warnings remain. Rollback: Pages9909b62f, with prior v1 snapshot retained; rollback is not a seamless merger of new practice winnings.
