# CradleOS — EVE Frontier Tribe Economy Stack

> **ERA 6: AWAKENING · CYCLE 5: SHROUD OF FEAR**

CradleOS is an on-chain tribe economy and command infrastructure for EVE Frontier, built on Sui testnet. It provides tribe founders and members with tools to manage defense policy, gate access, roles, treasury, intelligence, cargo contracts, ship insurance, and more — all accessible from an in-game browser overlay or the web dApp.

---

## Live dApp

| Server | URL |
|---|---|
| Utopia (Hackathon) | https://r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026/ |
| Stillness (Live) | https://r4wf0d0g23.github.io/CradleOS/ |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CradleOS dApp                         │
│  React + TypeScript + Vite · EVE Vault wallet auth      │
│  Deployed to GitHub Pages (Utopia + Stillness builds)   │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
   ┌──────▼──────┐      ┌──────▼──────┐
   │  Sui Testnet │      │  World API  │
   │  (Move contracts)   │  Stillness / Utopia
   └─────────────┘      └─────────────┘
```

---

## Repository Structure

```
frontier/
├── cradleos/                   # Sui Move contracts (V7–V14)
│   └── sources/
│       ├── tribe_vault.move    # Core tribe token + treasury
│       ├── defense_policy.move # Turret policy + player relations
│       ├── cargo_contract.move # Trustless cargo delivery
│       ├── ship_reimbursement.move  # SRP / combat insurance
│       ├── turret_delegation.move   # Member turret → tribe policy
│       ├── bounty_board.move
│       ├── announcement_board.move
│       └── ...
├── cradleos-dapp/              # React dApp
│   ├── src/
│   │   ├── components/         # 20+ panels (structures, tribe, defense, fitting...)
│   │   ├── lib.ts              # Sui RPC + contract helpers
│   │   ├── constants.ts        # Package IDs + world config
│   │   ├── moduleStats.ts      # Ship module CPU/PG data
│   │   ├── moduleAttributes.ts # Module attributes (damage, resist, etc.)
│   │   └── munitionStats.ts    # Ammo/charge damage data
│   └── public/                 # Game assets (extracted from EVE Frontier)
├── gate_policy_pkg/            # Standalone gate access control
├── tribe_roles_pkg/            # Standalone role delegation
├── cradleos-agent-proxy/       # CradleOS AI agent proxy (Nemotron3-Super)
├── oracle_tx.mjs               # Settlement oracle for contracts
└── api.py                      # Intel API + ContractOracle
```

---

## Deployed Contracts (Sui Testnet)

| Package | Address | Contents |
|---|---|---|
| V7 (core) | `0x036c2c...afade` | TribeVault, DefensePolicy, BountyBoard, AnnouncementBoard, Wiki |
| V10 | `0x6d2ef8...073f` | TurretDelegation |
| V11 | `0xf572af...dccc` | CargoContract (trustless delivery) |
| V12 | `0x30557f...fd7` | ShipReimbursement (SRP) |
| V13 | `0xf18450...b3f6c` | TribeRoles (superseded) |
| V14 | `0xcc3a03...a1f` | PlayerRelations on DefensePolicy |
| TRIBE_ROLES_PKG | `0x1686b3...79bf` | Standalone role delegation |
| GATE_POLICY_PKG | `0x398d1f...b14` | Standalone gate access control |

---

## Features

- **Tribe Vault** — CRDL token issuance, member balances, treasury
- **Defense Policy** — Security levels (GREEN/YELLOW/RED), tribe + player relations, turret delegation
- **Gate Policy** — OPEN/TRIBE ONLY/ALLIES/CLOSED access, member delegation
- **Role Delegation** — Admin/Officer/Treasurer/Recruiter on-chain roles
- **Cargo Contracts** — Trustless delivery with dispute window + oracle settlement
- **Ship Insurance (SRP)** — Killmail-verified combat loss reimbursement
- **Bounty Board** — On-chain bounties with CRDL rewards
- **Ship Fitting** — Full EVE-style fitting tool with real module/ammo stats from game files
- **Intel Dashboard** — Structure monitoring, passage events, threat analysis
- **Query** — Search all riders and tribes by name across Sui GraphQL
- **Wiki** — Lore + mechanics articles, on-chain publishing
- **Agent Integration** — Nemotron3-Super AI agent proxy with training data logging

---

## Hackathon

EVE Frontier Hackathon 2026 · March 11 – March 31  
Track: General · Network: Utopia testnet  
Project: https://deepsurge.xyz/projects/d54bf1c2-02dc-4361-8377-0c3eadd2a7f3  
Team: @reality_anchor + @raw

---

## License

EVE Frontier intellectual property belongs to CCP Games. CradleOS contracts and dApp code are open source under MIT.
