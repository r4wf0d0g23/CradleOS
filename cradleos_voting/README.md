# cradleos_voting

On-chain voting extension for CradleOS. Implements pluggable eligibility, weight, and
counting methods with optional commit-reveal privacy and Enoki-sponsored gas. Built as a
sibling Sui Move package to CradleOS (not a module inside it) so it can ship and upgrade
independently.

**Status:** Pre-publish as of 2026-06-22. First publish lands on the new Stillness world
on **2026-06-25** (wipe day). See `WIPE_DAY_REPUBLISH.md` for the publish runbook.

---

## What It Does

`cradleos_voting` lets any CradleOS user run an on-chain election — for a tribe, a
specific role, a token holder set, or an open vote — with:

- **Pluggable eligibility** — open / allowlist / CradleOS tribe / in-game tribe / composite
- **Pluggable weight** — one-per-account / role-based / asset-weighted / character-age /
  composite
- **Pluggable counting method** — single-choice / approval / score / quadratic / ranked
  choice / conviction
- **Optional commit-reveal privacy** — `commit_ballot` + `reveal_ballot` flow
- **Enoki-sponsored gas** — voters never pay gas during the proof-of-concept phase
- **On-chain SponsorCap budget** — `funded_so_far < max_ballots_funded` is enforced by
  Move code, so sponsorship can't be drained
- **Disputeable tally** — `dispute_tally` lets observers challenge the result before
  finalization

---

## Module Map

22 modules, 5,551 lines of Move:

### Election lifecycle (3)
- `voting` — election state machine + ballot casting (cast / commit / reveal)
- `tally` — final tally compute + dispute window + finalize
- `extension` — provider registry for pluggable extensions

### Eligibility extensions (5)
- `eligibility_open` — any wallet can vote
- `eligibility_allowlist` — pre-shared list of approved voters
- `eligibility_tribe_cradleos` — CradleOS-native tribe membership (with founder-only mode)
- `eligibility_tribe_ingame` — in-game tribe attestation
- `eligibility_composite` — AND / OR combinators

### Weight extensions (5)
- `weight_one` — one vote per voter
- `weight_role` — role-based weighting (per CradleOS `tribe_roles`)
- `weight_asset` — `Coin<T>` balance weighting (generic over any coin type)
- `weight_char_age` — character age weighting (older characters get more weight)
- `weight_composite` — AND / OR combinators

### Method extensions (6)
- `single_choice` — first-past-the-post
- `approval` — multi-select approval voting
- `score` — score voting (each option gets a 0..N score)
- `quadratic` — quadratic voting (cost grows quadratically with votes)
- `ranked_choice` — instant-runoff ranked choice
- `conviction` — conviction voting (vote strength grows with hold time)

### Privacy extensions (3)
- `privacy_public` — public ballots (default)
- `privacy_commit_reveal` — commit-reveal for sealed ballots
- `privacy_zk` — placeholder for future zk-snark sealed ballots

---

## Architecture

Eligibility and weight are proven via **Hot Potato** types: a single-use, non-storable
proof object that must be consumed in the same PTB it's minted in. This means a voter
can't mint a proof and use it twice, can't sell their proof, and can't get griefed by
a separate actor.

```
[mint_eligibility_proof] ──┐
                            │
[mint_weight_proof] ───────┤── one PTB ──→ [cast_ballot / commit_ballot]
                            │
[any other prep commands] ─┘
```

The relayer (Enoki or our own) validates that any PTB it sponsors:
1. Has every MoveCall in the SPONSORABLE allowlist (`MOVE_CALL_TARGETS.md`)
2. If it mints proof Hot Potatoes, it MUST terminate in a cast/commit/reveal that
   consumes them
3. The gas budget is under the cap (`max_ballots_funded` × `funded_so_far` is enforced
   on chain)

---

## Sponsored Voting (Enoki)

CradleOS uses Mysten's **Enoki sponsored transactions** to pay voter gas. The Enoki
backend at `noki.mystenlabs.com` (account: `reapers shop`) is configured with:

- **Allowed Address:** the CradleOS sponsor wallet
- **Allowed Move Call Targets:** 23 targets from `MOVE_CALL_TARGETS.md` marked
  🟢 SPONSORABLE

When a voter casts a ballot through the dApp, the tx is built with `gasOwner` set to
the sponsor wallet; Enoki's backend co-signs and submits; the voter pays nothing.

Voting is intended as a **free-for-PoC, paid-as-a-service after** model. Once the
proof-of-concept phase ends, sponsorship moves to a per-election creator-pays model.

---

## Build

Requires Sui CLI **v1.73.1+** and the CradleOS package as a sibling directory:

```bash
git clone https://github.com/r4wf0d0g23/CradleOS.git
cd CradleOS/cradleos_voting

sui client switch --env testnet_stillness
sui move build
sui client publish --gas-budget 500000000 --skip-dependency-verification
```

After publish:

1. Capture the published package id
2. Mint the `Registry` shared object via `extension::create_registry`
3. Register the extension providers (`extension::self_register_*` for each module)
4. Update Enoki sponsored-tx allowlist with the new package id
5. Update CradleOS dApp `constants.ts` `CRADLEOS_VOTING_PKG` + `CRADLEOS_VOTING_REGISTRY`

The full sequence is in `WIPE_DAY_REPUBLISH.md`.

---

## Documents

- **`MOVE_CALL_TARGETS.md`** — canonical reference of every `public fun` callable from a
  PTB, tagged 🟢 SPONSORABLE / 🟡 CREATOR-PAID / 🔴 ADMIN-ONLY / ⚪ READ-ONLY.
- **`WIPE_DAY_REPUBLISH.md`** — step-by-step publish runbook for 2026-06-25.

---

## License

MIT — see `../LICENSE`.
