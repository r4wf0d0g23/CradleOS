# Frontier slot fleet — design and deployment

Raw: “Can we make a full fleet of slots games with modern reward structures.” Implement eight new mechanically distinct practice slots alongside unchanged classic Salvage Reels. Existing seed-only donations stay available; paused/quarantined $EVE wagering is not activated and no new testnet entries/contracts are implied.

## Lineup

1. **Scrapyard Circuit:** five reels/three rows, ten paylines, wild substitution, scatter-triggered five free spins. Accessible line-slot anchor.
2. **Wreckway 243:** five by three, left-to-right ways, six scatter-triggered free spins at2×.
3. **Reactor Fall:** five by four,8+ matching symbols anywhere, gravity/refills and increasing cascade multipliers, at most six paid cascade stages per spin.
4. **Feral Swarm:** five by five, orthogonally connected clusters of5+, four-stage cascade chain. Distinct adjacency mechanic, not all-symbol scatterpay.
5. **Null Vault:** five by three coin collection; six coins trigger hold-and-respin. Three misses remain, reset on a new locked coin; full grid adds a fixed bonus on top of the variable collected coin values. Exact finite bound derives from15cells and three misses; no fake pooled/progressive jackpot.
6. **Gatecrash:** five by three, ten lines and expanding wild reels; free spins with a higher fixed multiplier.
7. **Drone Protocol:** five by three lines; scatter-triggered free spins with sticky wild positions throughout the free feature.
8. **Eclipse Routes:** five variable-height reels (2–5cells each), left-to-right ways; scatter-triggered free spins and a feature multiplier. Real cell-count-derived ways, not a branded third-party mechanic.

Reuse current extracted object icons, Frontier palette and original layout/sound work. Distinct thumbnails, board geometries, mechanics badges, visual payout highlights and compact bonus status; detailed rules/paytables/weights/statistics behind disclosure. No aggressive autoplay, bonus buys, paid boosts, near-miss manipulation or loss-disguised-as-win celebrations. Player chooses the whole-spin stake; never ambiguous per-line vs total pricing.

## Reward math

Fixed symbol weights and paytables, unbiased bounded draws. All rewards derive from visible symbols and declared rules. Tune fixed per-game payout coefficients offline, then independently measure with separate reproducible seeds. Publish observed return/hit/bonus/cap rates and sample size with uncertainty, NOT certified RTP or guaranteed player returns. No adaptive odds based on user balance, history or losses. Hard total-return cap2500× declared per paid spin including all bonus stages; every per-stage cash amount and cap adjustment reconciles to final total. Free spins never debit again; feature rounds have bounded duration/retriggers and cannot become endless.

## Atomic saved feature

Keep existing v2 ledger and v1 migration semantics. New practice keys/round types extend canonical registries without exposing nonexistent chain games. A paid spin generates the complete bounded outcome tape once, writes all stake/return accounting atomically, and records immutable grids/wins/bonus stages plus a reveal cursor. Presentation cannot change outcomes. Each next/skip action changes only the saved cursor; reload resumes without new draws, charge or duplicate credit. No active blackjack can start slots. New spin, refill/mode/game/donation navigation is locked while a feature presentation is pending, with accessible **Reveal all** to finish immediately. Reduced motion skips decorative travel, not accounting. Display committed bonus returns progressively without implying uncommitted wallet funds.

Persist bounded entropy values; validator replays exact game version/rules to reconstruct grids, physical cascades/holds and payouts, rejecting malformed or inconsistent receipts. Existing ledger history may use a compact identifying round while full newest slot receipt carries evidence. Never reinterpret an old game's receipt using another slot's controls. Old generic packs/legacy hands remain valid.

## Acceptance/deployment

- Deterministic line/ways/cluster/wild/scatter/coin/hold/gravity rules; free/hold accounting, cap, winning-cell attribution, raw-value bounds and corrupted tape/grid/cursor rejection.
- Multi-seed simulation with documented samples, variance/confidence and per-stake rounding; audit rare rewards and feature exhaustion. Independent architecture/math/source reviews.
- All eight normal and triggered feature states across mobile320/390/landscape and desktop: visible symbols match receipts, responsive boards, line/cascade/coin animations faithful, replay/reset/double-click/storage-failure/skip/cursor safety; existing practice and donation boundaries regression.
- Sound remains opt-in; distinct reel stop/feature/cascade cues respect mute/visibility and never celebrate a net loss. Reduced motion and accessible labels/keyboard controls.
- Full tests, Origins8, IOC, TypeScript/build, existing43asset hashes. Primary-only publication from reviewed source; exact public bundle/data verification and independent live review. Rollback9ccc3c8c; no contract publish, wallet signature or fund movement.
