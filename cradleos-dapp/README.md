# CradleOS dApp

React/TypeScript dApp for the CradleOS EVE Frontier tribe economy stack.

## Dev

```bash
npm install
npm run dev        # dev server at localhost:5173
```

## Build

```bash
# Utopia (hackathon)
npm run build

# Stillness (live)
VITE_BASE=/CradleOS/ VITE_SERVER_ENV=stillness npx vite build --base=/CradleOS/
```

## Stack

- React 19 + TypeScript + Vite
- `@evefrontier/dapp-kit` — EVE Vault wallet + sponsored transactions
- `@mysten/dapp-kit-react` — Sui wallet standard
- `@tanstack/react-query` — data fetching
- Sui testnet RPC + GraphQL

## Key Files

| File | Purpose |
|---|---|
| `src/constants.ts` | Package IDs, world config, server env |
| `src/lib.ts` | Sui RPC helpers, contract tx builders |
| `src/App.tsx` | Tab layout, wallet, era/cycle header |
| `src/components/` | 20+ panels |
| `src/moduleStats.ts` | Module CPU/PG data |
| `src/moduleAttributes.ts` | Module attributes from game screenshots |
| `src/munitionStats.ts` | Ammo/charge damage values |
| `public/lineagewar-corridor.jpg` | Background (EVE Frontier station corridor scene) |
| `public/ef-*.svg` | Launcher UI SVGs extracted from app.asar |
| `public/game-*.png` | Structure/ship icons from game ResFiles |

## Environment

```
VITE_SERVER_ENV=utopia|stillness   # default: utopia
VITE_BASE=/CradleOS/               # only for CradleOS repo build
```
