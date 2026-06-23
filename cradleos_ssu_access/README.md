# cradleos_ssu_access

Shared inventory partition access policies for Smart Storage Units (SSUs) in EVE Frontier,
deployed as a CradleOS extension package on the Sui testnet **Stillness** world.

**Status:** Live as of v4 on Stillness. See `Published.toml` for the canonical state.

---

## What It Does

EVE Frontier Smart Storage Units (SSUs) natively own items per-character. `cradleos_ssu_access`
lets an SSU owner *delegate* the SSU into shared/ethereal partition modes so multiple
characters (tribe-wide, allowlist-based, or public) can deposit and withdraw items
according to a posted policy — without taking custody of player items in a third-party
package.

Use cases:

- A tribe shares a single SSU as a community equipment locker
- A logistics character lets allied pilots refuel/restock from a forward SSU
- A public market SSU lets anyone deposit "for sale" items and retrieve their own
- An ephemeral pool lets characters move items between partitions on the same SSU

---

## Live State (Stillness)

| Item | ID |
|---|---|
| Active package (latest upgrade) | `0x6ea83a3e990892331b799f8ff516835bc8362793c635403db19a87ca9b81aeb8` |
| Original package (event/type queries) | `0x56e545d8907628fd6a23bf1b84bd24256f0a3a497a29f1576501d2c837837b9e` |
| Shared Policy Registry | `0x59bbda885ae86d8c10033959d64c1375ff83b2a1a77966e7721da5c6005f402e` |

Current version: **v4** (2026-04-27 `promote_ephemeral_to_shared` upgrade).

Full version history: `Published.toml`.

---

## Why This Is a Separate Package

The `ssu_access` module hard-binds to a specific `world-contracts` lineage at publish
time. SSU access takes `&StorageUnit` and `&OwnerCap<StorageUnit>` as Move parameters,
which means the binary is locked to the specific world package id that defined those
types. We publish `cradleos_ssu_access` as a single-module sibling package per server
(Stillness gets one, future worlds will get their own) so each lineage has its own
correctly-linked binding.

The functional logic lives outside the main CradleOS package because:
1. It's binary-coupled to a specific `world-contracts` publish
2. It's an extension feature, not a core CradleOS primitive
3. New worlds want fresh `ssu_access` publishes to avoid orphaning items from old worlds

---

## Policy Modes

| Mode | Behavior |
|---|---|
| `MODE_PERSONAL` | Standard SSU — only the OwnerCap holder can deposit/withdraw |
| `MODE_TRIBE` | Tribe members can deposit/withdraw via on-chain tribe lookup |
| `MODE_ALLOWLIST` | Only character IDs on the allowlist can deposit/withdraw |
| `MODE_PUBLIC` | Anyone can deposit/withdraw |
| `MODE_EPHEMERAL` | Per-character partitions within one SSU (no public pool) |

Modes are set per-SSU by the OwnerCap holder via `register_policy`. Policy changes
propagate to every dApp surface that queries the registry.

---

## Important Operational Notes

⚠️ **Items in shared/ethereal partitions are NOT visible in the EVE Frontier game
client.** The CradleOS dApp (`cradleos-dapp/`) is the only retrieval UI. If
`cradleos_ssu_access` is republished against a new world with structural drift, items
in shared partitions become unreachable through both the game and the dApp until a
compatible package id lands. **Before any republish, announce the maintenance window and
give users time to pull items back to personal partitions.** This is a standing rule.

---

## Build

Requires Sui CLI **v1.73.1+**:

```bash
git clone https://github.com/r4wf0d0g23/CradleOS.git
cd CradleOS/cradleos_ssu_access

sui client switch --env testnet_stillness
sui move build
sui client publish --gas-budget 500000000 --skip-dependency-verification
```

After publish, update `cradleos-dapp/src/constants.ts`:

- `SSU_ACCESS_PKG_STILLNESS` — new `published-at`
- `SSU_ACCESS_ORIGINAL_STILLNESS` — new `original-id`
- `SSU_POLICY_REGISTRY_STILLNESS` — new shared Registry object id

---

## License

MIT — see `../LICENSE`.
