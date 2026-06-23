# CradleOS

<p align="center">
  <img src="logo.png" alt="CradleOS Logo" width="200" />
</p>

<p align="center">
  <strong>On-chain civilization infrastructure for EVE Frontier, built on Sui Move.</strong>
</p>

<p align="center">
  <a href="https://r4wf0d0g23.github.io/CradleOS/">Live dApp</a> ·
  <a href="../cradleos-dapp/README.md">dApp Source</a> ·
  <a href="../cradleos_voting/README.md">Voting Extension</a> ·
  <a href="../cradleos_ssu_access/README.md">SSU Shared Access</a>
</p>

---

## What Is CradleOS?

CradleOS is a unified **Sui Move package for running a tribe, corporation, and settlement
stack inside EVE Frontier**. It is not a concept repo and not a thin demo: the current
package contains **25 Move modules**, **7,619 lines of code**, a live **v14 deployment on
Sui testnet (Stillness world)**, and a full dApp that also runs **inside the EVE Frontier
in-game browser**.

At a high level, CradleOS turns the social, economic, defensive, and operational layer of a
Frontier civilization into wallet-native, composable on-chain systems:

- treasury and member balances
- bounties, cargo contracts, collateral, and ship reimbursement
- gate access, turret behavior, and defense posture
- recruiting, announcements, lore, and contribution tracking
- inheritance, delegation, and role-based governance
- shared SSU inventory access policies

It is built as a **civilization toolkit**, not a single feature. The result is a package that
can govern real tribe infrastructure, plug into EVE Frontier Smart Assemblies, and drive a
reactive dApp for both web and in-game use.

---

## Package Snapshot

- **Package:** CradleOS
- **Chain:** Sui testnet
- **Chain ID:** `4c78adac`
- **World:** Stillness
- **Version:** v14 (current — full version history in `Published.toml`)
- **Code size:** 25 modules, 7,619 lines of Move

**Live IDs (Stillness):**

| Item | ID |
|---|---|
| Published (latest, use for `moveCall` targets) | `0xb6be32f915bb8ffead4a721207d9e43d2bedc7a60acdb08af60af84e1915ba93` |
| Original (use for event queries on original-era modules) | `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3` |
| Upgrade origin (v2 — modules introduced in v4 upgrade) | `0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d` |
| UpgradeCap | `0xdc3df6486bd0f429066eaa6e7318d106678036af9df82a61a76700886d9f064a` |
| CharacterRegistry | `0x3018a65e2d8d019cb82398539afa9dc3fa2e12854439b37059d4548441c4a6c4` |

> **Sui split-package convention:** `published-at` (latest) is used for `moveCall` targets,
> and `original-id` is used for event/type queries on modules that existed in the original
> publish. Modules added in later upgrades use `CRADLEOS_UPGRADE_ORIGIN`. See
> `Published.toml` for the authoritative state.

---

## Module Map

The 25 modules group into the following civilization layers:

### Identity + Registry (3)
- `character_registry` — on-chain mapping of player wallets to in-game characters
- `registry` — root directory of all CradleOS-registered corporations
- `tribe_roles` — role assignment and permission gating

### Economy + Treasury (5)
- `treasury` — corp treasury with deposit/withdraw flows
- `tribe_vault` — tribe-level vault with founder controls
- `tribe_dex` — DEX for tribe-issued tokens against any `Coin<T>`
- `contributions` — member-level contribution accounting
- `collateral_vault` — escrow for any `Coin<T>` with phantom typing

### Defense + Access Control (5)
- `defense_policy` — security levels, tribe relations, friendly/hostile character lists
- `turret_delegation` — delegate a Smart Turret to CradleOS for tribe defense
- `turret_ext` — the on-chain turret extension that runs target-selection logic
- `gate_policy` — Smart Gate access control (OPEN / TRIBE / ALLIES / CLOSED)
- `gate_profile` — composable gate behavior profiles
- `gate_control` — gate state machine + permit issuance

### Logistics + Contracts (5)
- `bounty_contract` — peer-to-peer bounties on EVE characters
- `trustless_bounty` — bounty board with on-chain escrow
- `cargo_contract` — trustless delivery contracts with proof-of-delivery bonds
- `ship_reimbursement` — killmail-verified SRP/insurance flows
- `inheritance` — timed OwnerCap escrow for cap inheritance / wills

### Communication + Knowledge (3)
- `announcement_board` — tribe-wide broadcast
- `lore_wiki` — moderated on-chain article publishing
- `keeper_shrine` — Keeper interaction surface

### Operations (3)
- `corp` — corp object + founder controls
- `recruiting_terminal` — recruitment applications with accept/reject
- `ssu_access` — shared SSU inventory partition access (production-first on Stillness)

---

## Build

Requires Sui CLI **v1.73.1+** (current testnet validators run 1.73.x). Lower versions
may produce bytecode the chain rejects with `VMVerificationOrDeserializationError`.

CradleOS depends on EVE Frontier's `world-contracts` package. Clone it as a sibling
directory:

```bash
git clone https://github.com/evefrontier/world-contracts.git
git clone https://github.com/r4wf0d0g23/CradleOS.git
cd CradleOS
```

Set your Sui CLI environment to match the target world:

```bash
sui client switch --env testnet_stillness
```

Then build + publish:

```bash
sui move build
sui client publish --gas-budget 500000000 --skip-dependency-verification
```

For upgrades (after first publish):

```bash
sui client upgrade --upgrade-capability <UpgradeCap_ID> --gas-budget 500000000 --skip-dependency-verification
```

---

## Architecture

CradleOS sits between EVE Frontier's `world-contracts` package and the player.

```
   ┌──────────────────────────┐
   │   EVE Frontier in-game   │
   │  browser  (or web app)   │
   └─────────┬────────────────┘
             │  EVE Vault wallet
             ▼
   ┌──────────────────────────┐
   │   CradleOS dApp          │
   │   34 panels for ops,     │
   │   economy, defense,      │
   │   logistics, intel       │
   └─────────┬────────────────┘
             │  signTransactionBlock
             ▼
   ┌──────────────────────────┐
   │  CradleOS Move package   │   ←—  this repo
   │  on Sui testnet v14      │
   └─────────┬────────────────┘
             │  borrow/return pattern
             ▼
   ┌──────────────────────────┐
   │  world-contracts pkg     │
   │  Character / Gate /      │
   │  Turret / StorageUnit /  │
   │  NetworkNode             │
   └──────────────────────────┘
```

Player wallets own `Character` objects; `Character` objects own `OwnerCap<T>` for each
Smart Assembly (Gate / Turret / StorageUnit / NetworkNode). CradleOS modules use the
canonical `borrow_owner_cap → operate → return_owner_cap` pattern to act on assemblies
without taking custody of player state.

---

## Tech Stack

- **Move 2024 edition** — modern Move syntax (`public struct`, `let mut`, etc.)
- **Sui testnet** — chain id `4c78adac`
- **Phantom typing** — every escrow module is generic over `Coin<T>` so vault, bounty,
  cargo, SRP, DEX, and toll flows operate on EVE, LUX, tribe tokens, or any future
  `Coin<T>` without contract changes.
- **`OwnerCap<T>` borrow/return** — never custody player state; always borrow, operate,
  return.

---

## Sibling Repos in This Workspace

CradleOS extends across multiple Sui packages:

| Path | Purpose |
|---|---|
| `../cradleos-dapp/` | React + Vite dApp (34 panels) — `https://r4wf0d0g23.github.io/CradleOS/` |
| `../cradleos_voting/` | On-chain voting extension with Hot Potato proofs + Enoki-sponsored ballots |
| `../cradleos_ssu_access/` | SSU inventory partition access policies (Stillness only) |

Each has its own README. See sibling links at the top of this file.

---

## Why This Matters for Frontier

EVE Frontier is a Sui-native game. Most third-party tools today are read-only: dashboards
that show on-chain state but don't write to it. CradleOS proves you can build a full
on-chain civilization stack — treasury, defense, contracts, governance — that runs
*inside the EVE Frontier client itself* via the in-game browser, signed by the same wallet
the player uses to fly ships and operate Smart Assemblies.

The repo is intentionally MIT-licensed and structured so other Frontier developers can
fork, extend, and ship their own civilization stacks. CradleOS's goal is **platform
dominance through versatility** — being the first-choice option for any third-party
Frontier development.

---

## License

MIT — see `../LICENSE`.

The CradleOS source is intentionally MIT-licensed for the same reason `world-contracts`
is: Frontier benefits from third-party developers having maximum freedom to fork, extend,
and integrate.
