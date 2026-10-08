# Frontier Casino refresh

## Experience
A single responsive lounge: Frontier Crude black/Neutral cream/Martian red,
existing casino cabinet art, and verified current-client item icons inside games.
Lobby has featured Slots/Blackjack, category/search, eight playable practice
variants and the preserved 26 enabled on-chain tables. No disabled games revived.
Game surface, stake/action dock, rules in disclosure, local session history.
Lighting is restrained emissive borders/orbits, not flashes. Reduced-motion honored.
Optional sound after explicit tap only: existing power samples + original synthesized
sci-fi cues; mute stops active sound; no autoplay/hidden-tab hum.

## Two modes, never mixed
Default Play Money: free 10,000-chip browser-only balance; no wallet requirement,
no transactions, no house/feed polling, explicit refill/reset. Practice games:
Slots, Blackjack, Roulette, Coinflip, Dice, Wheel, Plinko, War. Local outcomes use
crypto RNG, integer hundredths, payout rules sourced from the existing Move modules.
Blackjack practice: single deck, S17, natural3:2, hit/stand/double, no split or insurance;
not represented as identical to every contract interaction. One committed round;
animation cannot resettle it. Active hand and balance persist atomically in sessionStorage for this tab (not a shared browser ledger). Storage failure rejects a bet before changing the state. Cannot
switch mode/game mid-hand; resume after reload. No chips redeemable as EVE.

$EVE Testnet: isolated mode uses existing current-world contracts/wallet signers and
only current EVE type. Real house status and paused/empty/configuration gates.
Default deployment casinoFunded=false remains until user supplies bankroll/limits.
No admin transaction or funding inferred from a visual refresh. Existing26 tables
remain navigable within the refreshed shell, with existing transaction controls;
testnet mode is not advertised as currently open if house paused/unfunded.

## Release gates
Independent architecture/source/live review; accounting/outcome/save tests;
unit suite + Origins guard + IOC + TS/Vite; 320/390/desktop browser playthroughs,
all8 practice games, active-hand reload, mode isolation, no signature/network writes,
muted/unmuted/reduced-motion and image-failure paths. Public bundle/data hashes.
No Move package or custody changes. Rollback previous web deployment5c2a6e1a.
