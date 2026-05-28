# CradleOS Voting — Move Call Targets

**Generated:** 2026-05-28 from `frontier/cradleos_voting/sources/*.move` at commit `bd86cef3`.
**Purpose:** Authoritative reference of every `public fun` callable from a Sui PTB. Use this for:

- Building the CradleOS-operated **sponsor relayer allowlist** — only entries marked **SPONSORABLE** should be accepted by the relayer.
- Wiring `useSignAndExecuteTransaction` / sponsored-tx call sites in the dApp.
- Future CCP allowlist request, if/when CCP opens third-party sponsorship via their backend.

**Package id (placeholder until publish):** `CRADLEOS_VOTING_PKG`
**Module path style:** `<CRADLEOS_VOTING_PKG>::<module>::<function>`

---

## Legend

| Tag | Meaning |
|---|---|
| 🟢 **SPONSORABLE** | Safe for relayer to pay gas. Per-voter, single-tx, on-chain SponsorCap accounting enforces budget. |
| 🟡 **CREATOR-PAID** | Election creator should pay gas; one-time setup. Not in relayer allowlist. |
| 🔴 **ADMIN-ONLY** | AdminCap-gated or extension-registry ops. Captain wallet only. |
| ⚪ **READ/HELPER** | Pure getter or off-chain helper. Not a tx target. |

---

## 1. `voting` module — election lifecycle + ballot casting

| # | Target | Tag | Notes |
|---|---|---|---|
| 1.1 | `voting::create_election` | 🟡 CREATOR-PAID | One-time per election. Creator chooses to pay. |
| 1.2 | `voting::add_option` | 🟡 CREATOR-PAID | DRAFT state only. Creator only. |
| 1.3 | `voting::remove_option` | 🟡 CREATOR-PAID | DRAFT state only. Creator only. |
| 1.4 | `voting::set_schedule` | 🟡 CREATOR-PAID | DRAFT state only. Creator only. |
| 1.5 | `voting::set_sponsored` | 🟡 CREATOR-PAID | Creates a `SponsorCap` object; transfers to `sponsor` address. Funds the sponsorship pool on-chain. |
| 1.6 | `voting::publish` | 🟡 CREATOR-PAID | DRAFT → SCHEDULED. Creator only. |
| 1.7 | `voting::cancel` | 🟡 CREATOR-PAID | DRAFT → CANCELED. Creator only. |
| 1.8 | `voting::advance_to_open` | 🟢 SPONSORABLE | State machine tick. Anyone can crank once `scheduled_open_ms` passes. Relayer can pay to keep elections flowing. |
| 1.9 | `voting::advance_to_reveal` | 🟢 SPONSORABLE | Same as above. Crank after `scheduled_close_ms` for commit-reveal elections. |
| 1.10 | `voting::advance_to_closed` | 🟢 SPONSORABLE | Same. Crank after `reveal_deadline_ms`. |
| 1.11 | `voting::cast_ballot` | 🟢 **SPONSORABLE (PRIMARY)** | Public-privacy vote. Accepts optional `SponsorCap`. **This is the main relayer target.** Returns SponsorCap to sponsor for next ballot. |
| 1.12 | `voting::commit_ballot` | 🟢 **SPONSORABLE (PRIMARY)** | Commit-reveal privacy vote, commit phase. Accepts optional `SponsorCap`. Same flow as `cast_ballot`. |
| 1.13 | `voting::reveal_ballot` | 🟢 SPONSORABLE | Commit-reveal reveal phase. **TODO: confirm whether reveal accepts SponsorCap — currently uses `cast_ballot`-style sponsor flow per the existing code.** |
| 1.14 | `voting::mint_eligibility_proof` | 🟢 SPONSORABLE | Hot Potato. Almost always batched into the same tx as `cast_ballot` / `commit_ballot` via PTB chaining. Sponsor whole batch. |
| 1.15 | `voting::mint_weight_proof` | 🟢 SPONSORABLE | Same as above. Batched. |

**Note on Hot Potato batching:** Items 1.14 and 1.15 should never appear alone in a relayer-submitted tx. They mint single-use proofs that *must* be consumed by `cast_ballot`/`commit_ballot` in the same PTB. The relayer allowlist should accept PTBs whose terminal command is a sponsorable cast/commit target, and inspect the PTB structure rather than treating each call as independent.

---

## 2. `tally` module — finalization + disputes

| # | Target | Tag | Notes |
|---|---|---|---|
| 2.1 | `tally::compute_tally` | 🟢 SPONSORABLE | Anyone can compute; deterministic. Relayer can pay to keep elections flowing past the close. Small budget per election. |
| 2.2 | `tally::dispute_tally` | 🟡 CREATOR-PAID | Disputer pays. Has skin in the game by definition. |
| 2.3 | `tally::finalize` | 🟢 SPONSORABLE | State machine tick after dispute window closes. |

---

## 3. `extension` module — provider registry (AdminCap-gated)

These are NOT for voters. Captain wallet only, run once per extension deploy.

| # | Target | Tag | Notes |
|---|---|---|---|
| 3.1 | `extension::create_registry` | 🔴 ADMIN-ONLY | Bootstrap. Run once post-publish via the published-day runbook. |
| 3.2 | `extension::register_eligibility` | 🔴 ADMIN-ONLY | AdminCap-gated. Curated registrations. |
| 3.3 | `extension::register_weight` | 🔴 ADMIN-ONLY | AdminCap-gated. |
| 3.4 | `extension::register_method` | 🔴 ADMIN-ONLY | AdminCap-gated. |
| 3.5 | `extension::self_register_eligibility` | 🟡 CREATOR-PAID | Third-party extension authors. Open to anyone. They pay. |
| 3.6 | `extension::self_register_weight` | 🟡 CREATOR-PAID | Same. |
| 3.7 | `extension::self_register_method` | 🟡 CREATOR-PAID | Same. |
| 3.8 | `extension::deprecate_eligibility` | 🔴 ADMIN-ONLY | |
| 3.9 | `extension::deprecate_weight` | 🔴 ADMIN-ONLY | |
| 3.10 | `extension::deprecate_method` | 🔴 ADMIN-ONLY | |

---

## 4. `eligibility_*` modules — proof minting

Each eligibility module exposes a `mint*` function. These produce single-use Hot Potato proofs consumed by `cast_ballot`/`commit_ballot`. Always PTB-batched with the cast/commit call.

| # | Target | Tag | Notes |
|---|---|---|---|
| 4.1 | `eligibility_open::mint` | 🟢 SPONSORABLE (batched) | Any wallet; lowest-friction elections. |
| 4.2 | `eligibility_allowlist::mint` | 🟢 SPONSORABLE (batched) | Caller must be on the allowlist (checked on-chain). |
| 4.3 | `eligibility_tribe_cradleos::mint` | 🟢 SPONSORABLE (batched) | CradleOS-native tribe membership. |
| 4.4 | `eligibility_tribe_cradleos::mint_founder_only` | 🟢 SPONSORABLE (batched) | Founder-restricted tribe votes. |
| 4.5 | `eligibility_tribe_ingame::mint` | 🟢 SPONSORABLE (batched) | In-game tribe attestation. |
| 4.6 | `eligibility_composite::mint_and` | 🟢 SPONSORABLE (batched) | AND-combined proof. |
| 4.7 | `eligibility_composite::mint_or` | 🟢 SPONSORABLE (batched) | OR-combined proof. |

**Eligibility tribe_ingame admin ops (not for voters):**

| # | Target | Tag |
|---|---|---|
| 4.8 | `eligibility_tribe_ingame::create_registry` | 🔴 ADMIN-ONLY |
| 4.9 | `eligibility_tribe_ingame::set_attestor` | 🔴 ADMIN-ONLY |
| 4.10 | `eligibility_tribe_ingame::set_admin` | 🔴 ADMIN-ONLY |
| 4.11 | `eligibility_tribe_ingame::issue_attestation` | 🟡 ATTESTOR-PAID | Attestor wallet (could be CradleOS-sponsored if we run it). |
| 4.12 | `eligibility_tribe_ingame::issue_attestations_batch` | 🟡 ATTESTOR-PAID | Same. |
| 4.13 | `eligibility_tribe_ingame::revoke_attestation` | 🟡 ATTESTOR-PAID | Same. |

---

## 5. `weight_*` modules — weight proof minting

Same shape as eligibility: each weight kind mints a Hot Potato consumed inside `cast_ballot`/`commit_ballot`.

| # | Target | Tag |
|---|---|---|
| 5.1 | `weight_one::mint` | 🟢 SPONSORABLE (batched) |
| 5.2 | `weight_role::mint` | 🟢 SPONSORABLE (batched) |
| 5.3 | `weight_asset::mint<T>` | 🟢 SPONSORABLE (batched) — note generic type param |
| 5.4 | `weight_char_age::mint_ordinal` | 🟢 SPONSORABLE (batched) |
| 5.5 | `weight_char_age::mint_epoch` | 🟢 SPONSORABLE (batched) |
| 5.6 | `weight_char_age::mint_via_character` | 🟢 SPONSORABLE (batched) |
| 5.7 | `weight_char_age::mint_via_registry` | 🟢 SPONSORABLE (batched) |
| 5.8 | `weight_composite::mint` | 🟢 SPONSORABLE (batched) |

---

## 6. `methods/*` modules

The `compute(...)` functions are `public(package)` helpers called by `tally::compute_tally`. They are NOT independent PTB targets. Tally module is the entry point.

---

## 7. `privacy/*` modules

`kind()` accessors only. No PTB targets here.

---

## Relayer Allowlist (canonical SPONSORABLE set)

If we run a CradleOS-operated sponsor relayer, the allowlist regex against `MoveCall { package, module, function }` should be:

```
package == CRADLEOS_VOTING_PKG && (
  (module == "voting" && function ∈ {
    "advance_to_open", "advance_to_reveal", "advance_to_closed",
    "cast_ballot", "commit_ballot", "reveal_ballot",
    "mint_eligibility_proof", "mint_weight_proof"
  }) ||
  (module == "tally" && function ∈ {
    "compute_tally", "finalize"
  }) ||
  (module ∈ {
    "eligibility_open", "eligibility_allowlist",
    "eligibility_tribe_cradleos", "eligibility_tribe_ingame",
    "eligibility_composite",
    "weight_one", "weight_role", "weight_asset",
    "weight_char_age", "weight_composite"
  } && function starts_with "mint")
)
```

**Additional PTB structural checks the relayer MUST enforce:**

1. **Terminal command rule.** Any tx containing `mint_eligibility_proof` or a `weight_*::mint*` call MUST also contain a terminal `cast_ballot` / `commit_ballot` / `reveal_ballot` call consuming the proof. Reject otherwise — prevents proof-minting griefing.
2. **SponsorCap presence.** `cast_ballot` / `commit_ballot` calls MUST pass a valid `SponsorCap` (the one minted by `set_sponsored` for the target election). Reject ballots that try to ride relayer sponsorship without burning the on-chain SponsorCap budget — the on-chain accounting (`funded_so_far`, `max_ballots_funded`, `expiry_ms`) is the second line of defense.
3. **Per-character rate limit.** Off-chain limit: 1 ballot per `character_id` per `election_id` per N seconds. On-chain enforces eventually via the cast_ballot E_ALREADY_VOTED guard, but off-chain rejection saves the round-trip.
4. **Gas budget cap.** Default 50M MIST (0.05 SUI) per relayed tx; reject anything higher unless explicitly approved.

---

## 8. What CCP's `useSponsoredTransaction` covers (for reference)

Per audit: only `BRING_ONLINE`, `BRING_OFFLINE`, `UPDATE_METADATA` against the world package. No voting targets, no CradleOS targets. CCP's backend will not pay gas on calls to `CRADLEOS_VOTING_PKG`.

**Conclusion:** CradleOS-operated sponsorship is the only path to gas-free voting. CCP's hook is irrelevant to voting and remains valuable for structure-management UX (online/offline/metadata).

---

## Open Items

1. **Confirm `reveal_ballot` SponsorCap flow.** Tagged SPONSORABLE based on the SponsorCap option pattern; need a fresh read of the function body before wiring the relayer.
2. **`weight_asset::mint<T>` generic type.** The relayer needs to either pre-decide the allowed coin type per election (read from on-chain election config) or accept any T. Decide before relayer ships.
3. **Crank incentives.** `advance_to_*` and `compute_tally` are sponsorable but currently have no caller incentive. Either CradleOS runs a small cron that cranks elections at their boundaries, or the relayer accepts crank-only txs from any wallet.
