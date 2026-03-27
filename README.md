# CradleOS

<p align="center">
  <img src="cradleos-logo.png" alt="CradleOS Logo" width="200" />
</p>

<p align="center">
  <strong>On-chain civilization infrastructure for EVE Frontier, built on Sui Move.</strong>
</p>

---

## What Is CradleOS?

CradleOS is a unified Sui Move package for running a tribe, corporation, and settlement
stack inside EVE Frontier. The current package contains **24 Move modules** and **6,533
lines of code**, with a live **v5 deployment on Sui testnet** and a full dApp that runs
both on the web and **inside the EVE Frontier in-game browser**.

CradleOS turns the social, economic, defensive, and operational layer of a Frontier
civilization into wallet-native, composable on-chain systems:

- Treasury and member balances (generic `<phantom T>` — works with EVE, LUX, or any Sui token)
- Bounties, cargo contracts, collateral, ship reimbursement (SRP)
- Gate access control and turret defense policy
- Recruiting, announcements, lore wiki, contribution tracking
- Inheritance, delegation, and role-based governance
- AI operations assistant (Keeper) with real game data

## Live Deployments

| Server | URL |
|---|---|
| **Stillness** (Live) | <https://r4wf0d0g23.github.io/CradleOS/> |
| **Utopia** (Hackathon) | <https://r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026/> |

## On-Chain

| Field | Value |
|---|---|
| Package (v5) | `0x38115c0620f5f885529e932c1369cbe10305c9f2de504a6f203ce831941439c4` |
| Original-id | `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3` |
| Network | Sui testnet (`4c78adac`) |

## Architecture

```text
                        +------------------------------+
                        |        CradleOS dApp         |
                        |  34 panels · React + Vite    |
                        |  EVE Vault wallet · three.js |
                        +--------------+---------------+
                                       |
                        +--------------+---------------+
                        |     CradleOS Move Package    |
                        |  24 modules on Sui testnet   |
                        +--------------+---------------+
                                       |
                        +--------------+---------------+
                        |    EVE Frontier World        |
                        |  Character · Gate · Turret   |
                        |  StorageUnit · NetworkNode   |
                        +------------------------------+
```

## Module Map

### Economy (9)
`tribe_vault` · `treasury` · `bounty_contract` · `trustless_bounty` · `cargo_contract` · `collateral_vault` · `ship_reimbursement` · `tribe_dex` · `keeper_shrine`

### Defense (5)
`defense_policy` · `gate_control` · `gate_policy` · `turret_ext` · `turret_delegation`

### Infrastructure (5)
`registry` · `corp` · `tribe_roles` · `inheritance` · `gate_profile`

### Social (5)
`recruiting_terminal` · `announcement_board` · `lore_wiki` · `contributions` · `character_registry`

## dApp Features (34 panels)

Dashboard · Tribe Vault · Defense Policy · Turret Policy · Gate Policy · Industry (supply chain calculator) · 3D Starmap · Ship Fitting · Intel Dashboard · Bounties · SRP · Cargo Contracts · Keeper (AI assistant) · Recruiting · Lore Wiki · Announcements · Calendar · Links · Structures · Inventory · Query · Leaderboard · Hierarchy · DEX · and more

## Repository Structure

| Path | Contents |
|---|---|
| `cradleos-dapp/` | React/TypeScript dApp source |
| `world-contracts/` | EVE Frontier world contracts (submodule) |
| `evevault/` | EVE Vault wallet extension (submodule) |
| `eve-vault-mobile/` | EVE Vault Mobile app (submodule) |
| `data/` | Decoded game data (blueprints, systems, regions) |
| `models/` | 3D ship and structure models (.glb) |
| `demo/` | Boot teaser and demo assets |

## In-Game Browser

Set a structure's metadata URL to the CradleOS dApp URL. Press **F** near the structure
in EVE Frontier. The dApp loads in the in-game browser with EVE Vault wallet pre-injected.

## Hackathon

**Event:** EVE Frontier × Sui 2026 Hackathon · March 11–31, 2026  
**Theme:** *A Toolkit for Civilization*  
**Team:** `@reality_anchor` + `@raw`  
**DeepSurge:** <https://deepsurge.xyz/projects/d54bf1c2-02dc-4361-8377-0c3eadd2a7f3>

## License

MIT
