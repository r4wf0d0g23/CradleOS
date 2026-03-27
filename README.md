# CradleOS — EVE Frontier Tribe Economy Stack

> **ERA 6: AWAKENING · CYCLE 5: SHROUD OF FEAR**

CradleOS is an on-chain tribe economy and command infrastructure for EVE Frontier, built
on Sui testnet. It provides tribe founders and members with tools to manage defense policy,
gate access, roles, treasury, intelligence, cargo contracts, ship insurance, and more — all
accessible from an in-game browser overlay or the web dApp.

The current package contains **24 Move modules**, **6,533 lines of code**, and a live **v5
deployment** with a **34-panel dApp** that runs both on the web and inside EVE Frontier's
in-game browser.

---

## Live dApp

| Server | URL |
|---|---|
| **Stillness** (Live) | <https://r4wf0d0g23.github.io/CradleOS/> |
| **Utopia** (Hackathon) | <https://r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026/> |

---

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

---

## Repository Structure

```
.
├── cradleos/                        # Sui Move package (24 modules, 6533 LOC)
│   ├── sources/
│   │   ├── tribe_vault.move         # Core tribal economy + vaults
│   │   ├── defense_policy.move      # Security levels, relations, hostile lists
│   │   ├── turret_ext.move          # Smart Turret targeting extension
│   │   ├── cargo_contract.move      # Trustless delivery contracts
│   │   ├── ship_reimbursement.move  # SRP combat insurance
│   │   ├── trustless_bounty.move    # Escrowed bounty board
│   │   ├── collateral_vault.move    # EVE-backed collateral deposits
│   │   ├── corp.move               # Corporation, membership, commander cap
│   │   └── ... (24 modules total)
│   ├── DESIGN.md                    # Architecture + design principles
│   └── README.md                    # Module map + build instructions
├── cradleos-dapp/                   # React/TypeScript dApp
│   ├── src/
│   │   ├── components/              # 34 panel components
│   │   ├── lib.ts                   # Sui RPC helpers + tx builders (3,045 lines)
│   │   ├── constants.ts             # Package IDs + world config
│   │   └── data/                    # Industry blueprints + recipes
│   ├── public/                      # Game assets, 3D models, icons
│   ├── DEPLOY.md                    # Deployment SOP
│   └── README.md                    # Feature list + dev guide
├── cradleos-agent-proxy/            # Keeper AI proxy (Nemotron3-Super via vLLM)
├── oracle_tx.mjs                    # Settlement oracle for contracts + SRP
└── api.py                           # Intel API + route planning
```

---

## On-Chain Status (Sui Testnet)

CradleOS is deployed as a **single unified package** (v5):

| Field | Value |
|---|---|
| Published-at | `0x38115c0620f5f885529e932c1369cbe10305c9f2de504a6f203ce831941439c4` |
| Original-id | `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3` |
| Chain | Sui testnet (`4c78adac`) |
| Version | 5 |
| Modules | 24 |

All escrow and economy modules use generic `<phantom T>` coin types — works with EVE, LUX,
or any Sui fungible token.

---

## Module Map

### Economy (9)
`tribe_vault` · `treasury` · `bounty_contract` · `trustless_bounty` · `cargo_contract` · `collateral_vault` · `ship_reimbursement` · `tribe_dex` · `keeper_shrine`

### Defense (5)
`defense_policy` · `gate_control` · `gate_policy` · `turret_ext` · `turret_delegation`

### Infrastructure (5)
`registry` · `corp` · `tribe_roles` · `inheritance` · `gate_profile`

### Social (5)
`character_registry` · `recruiting_terminal` · `announcement_board` · `lore_wiki` · `contributions`

---

## dApp Features (34 panels)

- **Dashboard** — tribe overview, vault balances, member count, structure summary
- **Tribe Vault** — launch tribe economy, deposit/withdraw EVE tokens, member balances
- **Defense Policy** — security levels (GREEN/YELLOW/RED), tribe relations, hostile character KOS list
- **Turret Policy** — authorize CradleOS turret extension, apply tribe/personal policies
- **Gate Policy** — OPEN/TRIBE/ALLIES/CLOSED access control on Smart Gates
- **Industry** — supply chain calculator (78 blueprints, 7 levels deep), notepad export
- **Map** — 3D starmap (three.js), proximity luminescence, jump range visualization
- **Ship Fitting** — EVE-style fitting tool with real module stats, CPU/PG, damage profiles
- **Intel Dashboard** — structure monitoring, passage events, threat analysis
- **Bounties** — on-chain bounty board with EVE token escrow
- **SRP** — ship replacement program, killmail-verified combat insurance
- **Cargo Contracts** — trustless delivery with proof-of-delivery bonds
- **Keeper** — AI operations assistant with 72 real manufacturing recipes
- **Recruiting** — tribe recruitment applications and approval flow
- **Lore Wiki** — on-chain article publishing
- **Announcements** — tribe-wide broadcast board
- **Calendar** — hackathon schedule + custom tribe events
- **Links** — structure service assignment, node hierarchy
- **Query** — search all riders and tribes across Sui GraphQL
- **Leaderboard** · **Hierarchy** · **DEX** · **Inventory** · **Structures** · and more

---

## In-Game Browser

Set a structure's metadata URL to the CradleOS dApp URL. Press **F** near the structure
in EVE Frontier. The dApp loads in the in-game browser with EVE Vault wallet pre-injected —
no external wallet setup needed.

---

## Hackathon

**Event:** EVE Frontier × Sui 2026 Hackathon · March 11–31, 2026  
**Theme:** *A Toolkit for Civilization*  
**Tracks:** Utility · Technical Implementation · Creative · Live Frontier Integration  
**Team:** `@reality_anchor` + `@raw`  
**DeepSurge:** <https://deepsurge.xyz/projects/d54bf1c2-02dc-4361-8377-0c3eadd2a7f3>

---

## License

EVE Frontier intellectual property belongs to CCP Games.
CradleOS contracts and dApp code are open source under MIT.
