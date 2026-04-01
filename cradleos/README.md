# CradleOS

<p align="center">
  <img src="logo.png" alt="CradleOS Logo" width="200" />
</p>

<p align="center">
  <strong>On-chain civilization infrastructure for EVE Frontier, built on Sui Move.</strong>
</p>

---

## What Is CradleOS?

CradleOS is a unified **Sui Move package for running a tribe, corporation, and settlement
stack inside EVE Frontier**. It is not a concept repo and not a thin demo: the current
package contains **24 Move modules**, **6,533 lines of code**, a live **v9 deployment on
Sui testnet**, and a full dApp that also runs **inside the EVE Frontier in-game browser**.

At a high level, CradleOS turns the social, economic, defensive, and operational layer of a
Frontier civilization into wallet-native, composable on-chain systems:

- treasury and member balances
- bounties, cargo contracts, collateral, and reimbursements
- gate access, turret behavior, and defense posture
- recruiting, announcements, lore, and contribution tracking
- inheritance, delegation, and role-based governance

It is built as a **civilization toolkit**, not a single feature. The result is a package that
can govern real tribe infrastructure, plug into EVE Frontier Smart Assemblies, and drive a
reactive dApp for both web and in-game use.

---

## Package Snapshot

- **Package:** CradleOS
- **Chain:** Sui testnet
- **Chain ID:** `4c78adac`
- **Version:** v9
- **Edition:** Move 2024
- **Dependency:** EVE Frontier world-contracts
  (`../world-contracts/contracts/world`)
- **Code size:** 24 modules, 6,533 lines

---

## Module Map

### Economy

| Module | Lines | Purpose |
|---|---:|---|
| `tribe_vault.move` | 341 | Core tribal economy, vaults, balances, accounting |
| `treasury.move` | 240 | Corp treasury deposits and withdrawals |
| `bounty_contract.move` | 291 | On-chain bounties with token rewards |
| `trustless_bounty.move` | 367 | Escrowed bounty board with verification |
| `cargo_contract.move` | 318 | Trustless delivery contracts with proof-of-delivery |
| `collateral_vault.move` | 256 | Collateral deposits backing agreements |
| `ship_reimbursement.move` | 364 | SRP combat reimbursement flow |
| `tribe_dex.move` | 202 | Tribe-level order-book DEX |
| `keeper_shrine.move` | 161 | Community donation pool / treasury shrine |

### Defense

| Module | Lines | Purpose |
|---|---:|---|
| `defense_policy.move` | 534 | Security levels, relations, hostile lists |
| `gate_control.move` | 308 | Smart Gate access control |
| `gate_policy.move` | 308 | OPEN / TRIBE / ALLIES / CLOSED gate rules |
| `turret_ext.move` | 334 | Live Smart Turret targeting extension |
| `turret_delegation.move` | 114 | Member turret delegation to tribe policy |

### Infrastructure

| Module | Lines | Purpose |
|---|---:|---|
| `registry.move` | 84 | Root shared object for CradleOS deployments |
| `corp.move` | 356 | Core corporation object, membership, commander cap |
| `tribe_roles.move` | 176 | Delegated Admin / Officer / Treasurer / Recruiter roles |
| `inheritance.move` | 252 | Succession planning and dead-man switch logic |
| `gate_profile.move` | 183 | Gate metadata and profile storage |

### Social

| Module | Lines | Purpose |
|---|---:|---|
| `recruiting_terminal.move` | 210 | Recruitment applications and approvals |
| `announcement_board.move` | 249 | Tribe announcements published on-chain |
| `lore_wiki.move` | 296 | On-chain lore wiki and article publishing |
| `contributions.move` | 226 | Track materials, builds, and combat support |
| `character_registry.move` | 363 | Wallet ↔ character ↔ tribe directory |

> Modules compose across concerns — for example, `character_registry` feeds both governance
> and intelligence surfaces, and `defense_policy` drives both turret behavior and dApp
> threat displays.

---

## Build

Requires Sui CLI (v1.68+) and the EVE Frontier `world-contracts` repo checked out at
`../world-contracts/`.

```bash
sui move build
sui move test    # run unit tests
```

For on-chain deployment:

```bash
# First publish
sui client publish --gas-budget 500000000 --skip-dependency-verification

# Upgrade (requires UpgradeCap)
sui client upgrade --gas-budget 500000000 --skip-dependency-verification \
  --upgrade-capability <UPGRADE_CAP_ID>
```

---

## Architecture

```text
                           +------------------------------+
                           |        CradleOS dApp         |
                           |  34 panels for ops, economy, |
                           |  defense, intel, logistics   |
                           +--------------+---------------+
                                          |
                                          | wallet actions,
                                          | events, queries
                                          v
+----------------------+      +-----------+------------+      +----------------------+
|  EVE Frontier Game   |<---->|     CradleOS Move      |<---->|  World Contracts     |
|  In-Game Browser     |      |   24-module package    |      |  Character / Gate /  |
|  metadata URL loads  |      |   on Sui testnet v9    |      |  Turret / Storage /  |
|  dApp with wallet    |      |                        |      |  NetworkNode         |
+----------+-----------+      +-----------+------------+      +----------+-----------+
           ^                              |                              ^
           |                              | typed witnesses,             |
           |                              | shared objects,              |
           |                              | dynamic fields               |
           |                              v                              |
           |                   +-------------------------+               |
           +-------------------+  Smart Assembly Mods    +---------------+
                               |  Gate control, turret   |
                               |  extension, policy      |
                               +-------------------------+
```

### How the pieces fit

- **CradleOS Move** is the on-chain operating layer: governance, economy, contracts,
  policy, and social systems.
- **World Contracts** provide the in-world primitives CradleOS integrates with, including
  `Character`, `Gate`, `Turret`, `StorageUnit`, and `NetworkNode`.
- **The dApp** is the command interface for tribe members and officers, powered by on-chain
  reads, events, and wallet transactions.
- **The in-game browser** loads the same dApp directly from structure metadata URLs, so the
  system can be used from inside EVE Frontier with EVE Vault wallet context available.

---

## Tech Stack

- **Sui Move, 2024 edition**
- **EVE Frontier world-contracts integration**
- **Generic coin architecture** using `<phantom T>` so escrow and economy modules can work
  with EVE, LUX, or other Sui assets
- **Shared objects** for globally readable policy and registry state
- **Owned capability objects** for delegation and wallet-held authority
- **Typed witness pattern** for Smart Assembly extensions such as `CradleOSAuth` and
  `TurretAuth`
- **Dynamic fields** for per-assembly configuration stored directly on-chain
- **Event-driven state changes** across the package for reactive dApp UX

### Notable implementation details

- The economy stack is designed to be **token-agnostic**, not hardcoded to a single asset.
- Defense and access systems separate **policy objects** from **delegation objects**, making
  them easier to inspect, delegate, and compose.
- `turret_ext.move` is not theoretical: it is a **live Smart Assembly mod** that overrides
  turret targeting to protect same-tribe members and enforce custom hostile logic.

---

## Current On-Chain Status

CradleOS is currently deployed on **Sui testnet**.

- **Published-at:**
  `0x955d7ffb4c0bf6abc4caea3041f982ae7e9b21eb4b9c1ea500bb404609faf0ce`
- **Original-id:**
  `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3`
- **UpgradeCap:**
  `0xdc3df6486bd0f429066eaa6e7318d106678036af9df82a61a76700886d9f064a`
- **Network:** Sui testnet
- **Chain ID:** `4c78adac`

---

## dApp Surface

The CradleOS dApp currently spans **34 panels**, including:

- Dashboard
- Tribe Vault
- Defense Policy
- Turret Policy
- Gate Policy
- Industry supply-chain calculator
- 3D starmap
- Ship fitting
- Intel dashboard
- Bounties
- Ship reimbursement
- Cargo contracts
- Recruiting
- Lore wiki
- Announcements
- Keeper AI panel
- Calendar
- Structures
- Inventory
- Query tools
- Leaderboard
- Hierarchy
- DEX
- and more

Live app:
<https://r4wf0d0g23.github.io/CradleOS/>

---

## Hackathon Submission

**Event:** EVE Frontier × Sui 2026 Hackathon  
**Dates:** March 11-31, 2026  
**Theme:** *A Toolkit for Civilization*  
**Tracks:** Utility, Technical Implementation, Creative, Live Frontier Integration  
**Team:** `@reality_anchor` + `@raw`

Links:

- **DeepSurge project:**
  <https://deepsurge.xyz/projects/d54bf1c2-02dc-4361-8377-0c3eadd2a7f3>
- **Live dApp:**
  <https://r4wf0d0g23.github.io/CradleOS/>

CradleOS is aimed squarely at the hackathon's core question: what does civilization
infrastructure look like when it is programmable, composable, and fully on-chain?

---

## Why This Matters for Frontier

EVE Frontier already gives players programmable infrastructure. CradleOS extends that idea
up the stack: from individual assemblies to the **social operating system of a tribe**.

That means:

- programmable trust for logistics and payouts
- enforceable security policy at gates and turrets
- on-chain governance and succession
- persistent social memory through announcements, lore, and contribution records
- a real control surface that works both on the web and inside the game

This is not just contract code. It is an attempt to make a settlement legible,
coordination-friendly, and survivable.

---

## License

Released under the **MIT License**.
