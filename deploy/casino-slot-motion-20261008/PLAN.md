# Fluid outcome-faithful slot motion

Raw approved the eight visual identities and now requests fluid, realistic animation. Scope: those eight practice slots, not an unrequested rewrite of the rest of the casino. Frozen payout engine, replay/session/practice code, math data, donation/wager gates, assets and saved schema remain unchanged. Current source db23db8 / deployed b9d836f4 is rollback.

## Motion system

- One presentation-only timing plan shared by board choreography and parent cursor timer. Completion includes a buffer after longest visual transition; only existing guarded parent revealSlot advances saved cursor. No animation or sound callback pays/rolls/saves anything.
- Mechanical reels: actual continuously translating masked strips, ordinary decorative symbols only (no manufactured near-miss wild/scatter), accelerate/cruise/brake and a small damped stop; five staggered stops with synchronized opt-in cues. Final strip rows are exactly current saved original board. No fake prize readout during motion.
- Cascades: prior winning symbols remain as short-lived ghosts, dissolve/clear, then survivors fall from exact old row coordinates; replacement symbols enter from above with distance-based gravity and small impact damping. No survivors teleport or shuffle. Previous wins alone determine clear/fall mapping.
- Vault: held coins remain stationary. Only empty compartments search/reveal; actual new tokens flip/settle into place. Full initial board advances through collection, not a nonexistent respin. No fabricated coins on misses.
- Drone free spins: occupied wild hardpoints remain stationary; vacant/nonlocked sockets cycle in place, then latch actual new wilds.
- Gatecrash: all raw reels stop first; original scatter provenance stays visible for a beat; then real expanding-wild columns open through a bounded energy sweep. No early lit-pylon state or false bonus.
- Eclipse: stable board footprint across different reel heights; orbital windows open smoothly and final rows match receipt. Reactor/Feral use actual cascade stage/cluster effects, not a universal particle shower.
- Effects tied to revealed wins/actual awarded features, no fake near misses, manufactured progress or loss celebration. No continuous ambient loops, no flashing/shake-heavy full-screen effects.

## Lifecycle and accessibility

Use compositor transforms/opacity and bounded DOM strips; no React-per-frame render loop or new dependencies. Read measured row sizes/gaps once per run. Cancel owned timers/WAAPI/observers on unmount/new run, reduced motion, resize or hidden document; reveal correct current board safely without changing ledger. Prefer reduced motion resolves immediately without sliding/spin/flip; existing short parent callback retains cursor safety. Overlay art aria-hidden; semantic board never narrates decorative symbols. Mask pending actual outcomes from feature instruments while reels are moving.

## Gates

Independent architecture/source review; frozen-file byte hashes; unit timings/strip final sequence/survivor mapping/golden replay. Record normal-motion frame sequences at320/390/1440 including first spin, new round, consecutive cascades, Gate raw/expanded, sticky free frame and locked Vault. Assert actual travel, staggered stops, no overlay at completion, exact final symbols/highlights, resize/hidden/reduced behavior, audio and atomic ledger. Production 4-width full fleet/donation regression,260existing tests,Origins8,IOC,TS/build. Publish primary only; exact public bundles/assets and independent live normal-motion gate. No signatures, funds or contracts.
