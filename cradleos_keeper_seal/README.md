# cradleos_keeper_seal

Soulbound on-chain achievement records ("Seals") issued by The Keeper. Recognizes player
accomplishments — both known (catalog-listed) and hidden (cryptic Keeper-voice clues
until earned). Lore-tied to the Keeper's role as observer of the cycle.

**Status:** Pre-publish as of 2026-06-22. First publish lands on the new Stillness world
on **2026-06-25** (wipe day) per the canonical-v1 strategy.

---

## Design

- **Soulbound:** `Seal` has `key` only (no `store`), so it cannot be transferred after
  issuance. The recipient owns it forever.
- **No duplicates per character:** a shared `Registry` enforces `(seal_id, recipient_address)`
  uniqueness via on-chain table lookup.
- **Off-chain catalog:** each `Seal` carries a `metadata_url` field pointing to canonical
  lore for that `seal_id`. Catalog can grow without contract upgrades; per-issuance
  variants are supported via custom `metadata_url` overrides.
- **Identity binding:** `issued_to: address` stores the player's
  `character.character_address` (the EVE Vault zkLogin wallet), which persists across
  cycles even when Character objects are culled at world wipe.
- **Mint authority:** `KeeperMintCap` is held by a single dedicated Keeper signing wallet.
  Issuance requires a reference to this cap.

---

## Trigger Paths

All three paths converge on `issue_seal`:

1. **Deterministic** — backend cron watches chain events for predefined achievement
   patterns (first kill, first vault deposit, first 100M EVE handled, etc.).
2. **Heuristic** — Keeper LLM has `issue_seal` available as a tool call. Mid-conversation
   the model can recognize a community moment worth recording and issue.
3. **Discretionary** — manual issuance for community moments, lore beats, or events
   that don't fit either of the above patterns.

---

## Tiers

- `TIER_COMMON` (0)
- `TIER_RARE` (1)
- `TIER_LEGENDARY` (2) (where applicable in the catalog)

Tier is set at issuance time and stored on the `Seal`. Tier is purely metadata — the
contract does not gate behavior on tier value.

---

## Why a Separate Package

`keeper_seal` is currently its own package, separate from the main `cradleos` package,
for two reasons:

1. **Iteration speed.** Soulbound achievement design is the kind of feature that benefits
   from rapid catalog iteration without dragging the rest of the CradleOS upgrade cadence.
2. **Isolated blast radius.** A bug or upgrade in `keeper_seal` doesn't risk the
   `cradleos` UpgradeCap signing key or break treasury/defense flows.

At the next world wipe (post-2026-06-25), the module will be folded into the main
`cradleos` package as the 25th module. This is consistent with the canonical-v1 strategy
of reducing extension-package count once we're on the new world.

---

## Identity Binding Notes

The `issued_to` field stores a Sui address — specifically the player's
`character.character_address`, which is the EVE Vault zkLogin wallet derived from their
Google account. This address persists across world wipes even though `Character`
objects do not. So a Seal earned in cycle 5 remains attributable to the same player in
cycle 6, even after their cycle-5 Character is culled.

---

## Build

Requires Sui CLI **v1.73.1+**. Does NOT depend on `world-contracts` (deliberate — keeps
upgrade coupling at zero).

```bash
git clone https://github.com/r4wf0d0g23/CradleOS.git
cd CradleOS/cradleos_keeper_seal

sui client switch --env testnet_stillness
sui move build
sui client publish --gas-budget 500000000 --skip-dependency-verification
```

After publish, transfer the `KeeperMintCap` to the dedicated Keeper signing wallet.

---

## License

MIT — see [`../LICENSE`](../LICENSE).
