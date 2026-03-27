# CradleOS dApp

React/TypeScript command interface for the CradleOS on-chain tribe economy stack.
34 panels covering governance, economy, defense, logistics, intelligence, and social
coordination for EVE Frontier tribes.

**Live:** <https://r4wf0d0g23.github.io/CradleOS/>

## Features

- **Dashboard** — tribe overview, vault balances, member count, structure summary
- **Tribe Vault** — launch tribe economy, deposit/withdraw EVE tokens, member balances
- **Defense Policy** — security levels (GREEN/YELLOW/RED), tribe relations, player relations, hostile character KOS list
- **Turret Policy** — authorize CradleOS turret extension on Smart Turrets, apply tribe/personal defense policies, batch apply
- **Gate Policy** — OPEN/TRIBE/ALLIES/CLOSED access control on Smart Gates
- **Industry** — full supply chain calculator (78 blueprints, 7 levels deep), raw material shopping lists, in-game notepad export
- **Map** — 3D starmap (three.js), proximity luminescence, jump range visualization, system search, target tracking
- **Ship Fitting** — EVE-style fitting tool with real module stats, CPU/PG, damage profiles, ammo selection
- **Intel Dashboard** — structure monitoring, passage events, character resolution, threat analysis
- **Bounties** — on-chain bounty board with EVE token escrow
- **SRP** — ship replacement program, killmail-verified combat insurance claims
- **Cargo Contracts** — trustless delivery with proof-of-delivery bonds and dispute windows
- **Keeper** — AI operations assistant with 72 real manufacturing recipes, anti-hallucination guardrails
- **Recruiting** — tribe recruitment applications and approval flow
- **Lore Wiki** — on-chain article publishing for tribe knowledge base
- **Announcements** — tribe-wide broadcast board
- **Calendar** — hackathon schedule + custom tribe events
- **Links** — structure service assignment (14 services), node hierarchy view
- **Structures** — all deployed structures with type, status, energy source
- **Inventory** — on-chain item browser per structure
- **Query** — search all riders and tribes by name across Sui GraphQL
- **Leaderboard** — tribe rankings
- **Hierarchy** — org chart and role delegation view
- **DEX** — tribe-level order book exchange

## In-Game Browser

CradleOS runs inside EVE Frontier's in-game browser. Set a structure's metadata URL to the
dApp URL and press **F** near the structure in-game. EVE Vault wallet is pre-injected — no
external wallet setup needed.

## Dev

```bash
npm install
npm run dev        # dev server at localhost:5173
```

## Build

```bash
# Default (Stillness live server)
VITE_BASE=/CradleOS/ npm run build

# Utopia (hackathon server)
VITE_BASE=/CradleOS/ VITE_SERVER_ENV=utopia npm run build
```

## Stack

- React 19 + TypeScript + Vite
- `@evefrontier/dapp-kit` — EVE Vault wallet + sponsored transactions
- `@mysten/dapp-kit-react` — Sui wallet standard
- `@tanstack/react-query` — data fetching
- `three.js` — 3D starmap rendering
- Sui testnet RPC + GraphQL

## Key Files

| File | Purpose |
|---|---|
| `src/constants.ts` | Package IDs, world config, server env |
| `src/lib.ts` | Sui RPC helpers, contract tx builders (3,045 lines) |
| `src/App.tsx` | Tab layout, wallet connection, era/cycle header |
| `src/components/` | 34 panel components |
| `src/graphql.ts` | Sui GraphQL queries for structures + characters |
| `src/data/industry.json` | 78 blueprints, 535 types (decoded from game binary) |
| `src/data/recipes.ts` | 72 manufacturing recipes for Keeper context |
| `src/moduleStats.ts` | Module CPU/PG fitting data |
| `src/moduleAttributes.ts` | Module attributes (damage, resist, etc.) |
| `src/munitionStats.ts` | Ammo/charge damage values |
| `public/models/` | 3D ship and structure models (.glb) |
| `public/game-*.png` | Structure/ship icons from game ResFiles |
| `DEPLOY.md` | Deployment SOP with pre-flight checklist |

## Environment

```
VITE_SERVER_ENV=utopia|stillness   # default: stillness
VITE_BASE=/CradleOS/               # for GitHub Pages builds
```

## License

MIT
