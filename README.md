# CradleOS

<p align="center">
  <strong>On-chain civilization infrastructure for EVE Frontier — Sui Move package + React dApp.</strong>
</p>

<p align="center">
  <a href="https://r4wf0d0g23.github.io/CradleOS/">Live dApp</a> ·
  <a href="cradleos/README.md">Move source</a> ·
  <a href="cradleos-dapp/README.md">dApp source</a> ·
  <a href="cradleos_voting/README.md">Voting</a> ·
  <a href="cradleos_ssu_access/README.md">SSU shared access</a> ·
  <a href="cradleos_keeper_seal/README.md">Keeper Seals</a>
</p>

---

## What's Here

CradleOS turns the social, economic, defensive, and operational layer of an EVE Frontier
civilization into wallet-native, composable on-chain systems. The repo contains the full
stack:

| Package | Modules | LOC | What it does |
|---|---|---|---|
| [`cradleos/`](cradleos/README.md) | 25 | 7,619 | Core civilization toolkit — treasury, defense, contracts, governance |
| [`cradleos-dapp/`](cradleos-dapp/README.md) | 34 panels | — | React + Vite command interface (web + in-game browser) |
| [`cradleos_voting/`](cradleos_voting/README.md) | 22 | 5,551 | On-chain voting with Hot Potato proofs + Enoki-sponsored gas |
| [`cradleos_ssu_access/`](cradleos_ssu_access/README.md) | 1 | — | Shared SSU inventory partition policies |
| [`cradleos_keeper_seal/`](cradleos_keeper_seal/README.md) | 1 | 266 | Soulbound Keeper-issued achievement records |

---

## Live dApp

| Server | URL |
|---|---|
| **Stillness** (live) | <https://r4wf0d0g23.github.io/CradleOS/> |

Open in any browser. Wallet connects via EVE Vault (auto-injected in the EVE Frontier
in-game browser) or Slush / Sui Wallet on the web.

---

## In-Game Use

The dApp runs inside the EVE Frontier in-game browser. Two paths:

1. **Set a structure's metadata URL** to `https://r4wf0d0g23.github.io/CradleOS/` and
   press **F** near the structure to open it overlaid on the game.
2. **Bookmark from the web** — `https://r4wf0d0g23.github.io/CradleOS/` works in any
   browser; the EVE Vault wallet is detected when running in the game client.

---

## Architecture

```
   ┌──────────────────────────┐
   │ EVE Frontier in-game     │
   │ browser  (or web)        │
   └─────────┬────────────────┘
             │  EVE Vault wallet (zkLogin)
             ▼
   ┌──────────────────────────┐
   │ CradleOS dApp (cradleos- │
   │ dapp/) — 34 React panels │
   └─────────┬────────────────┘
             │
             ├──→ Caching JSON-RPC proxy (keeper.reapers.shop/sui)
             │
             ▼
   ┌──────────────────────────┐
   │ Sui testnet              │
   │  ├ cradleos/ pkg         │
   │  ├ cradleos_voting/ pkg  │
   │  ├ cradleos_ssu_access/  │
   │  ├ cradleos_keeper_seal/ │
   │  └ world-contracts/      │ ← EVE Frontier's official package
   └──────────────────────────┘
```

Each Move package upgrades independently. The dApp queries them in parallel and stitches
the results together.

---

## Build

Requires Sui CLI **v1.73.1+**. Each Move package is published independently — see each
package's README for build instructions.

For the dApp:

```bash
cd cradleos-dapp
npm install
npm run dev        # local dev server at localhost:5173
```

To deploy to GitHub Pages:

```bash
VITE_BASE=/CradleOS/ npm run build
# See cradleos-dapp/DEPLOY.md for the full deploy SOP
```

---

## Why This Matters for Frontier

EVE Frontier is a Sui-native game. Most third-party tools today are read-only: dashboards
that show on-chain state but don't write to it. CradleOS proves you can build a full
on-chain civilization stack — treasury, defense, contracts, governance — that runs
*inside the EVE Frontier client itself* via the in-game browser, signed by the same wallet
the player uses to fly ships and operate Smart Assemblies.

The repo is MIT-licensed and structured so other Frontier developers can fork, extend,
and ship their own civilization stacks.

---

## Sister Repos

- **EVE Frontier official world contracts:** <https://github.com/evefrontier/world-contracts>
- **EVE Frontier wallet-core:** <https://github.com/evefrontier/wallet-core>
- **CCP's dapp-kit:** `@evefrontier/dapp-kit` on npm

---

## License

MIT — see [`LICENSE`](LICENSE).
