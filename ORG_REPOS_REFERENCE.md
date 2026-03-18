# EVE Frontier GitHub Org — Full Repo Reference
*Scraped 2026-03-09 from https://github.com/evefrontier*
*All 7 repos cloned to frontier/*

---

## Repo Inventory

| Repo | Language | Purpose | Last Updated |
|---|---|---|---|
| `world-contracts` | Move | Core game contracts (Gate, NetworkNode, StorageUnit, Turret, Killmail) | Mar 9 |
| `builder-scaffold` | TypeScript + Move | Hackathon starter kit — example contracts + TS scripts | Mar 9 |
| `builder-documentation` | MDX | Official builder docs (GitBook source) | Mar 9 |
| `evevault` | TypeScript | Chrome extension wallet (zkLogin + Sui Wallet Standard) | Mar 9 |
| `sui-gas-pool` | Rust | Sponsored transaction gas station | Feb 20 |
| `eve-frontier-proximity-zk-poc` | TypeScript | ZK proof system for location/distance privacy | Dec 2025 |
| `sui-go-sdk` | Go | Sui Go SDK (forked from MystenLabs) | Nov 2025 |

See `WORLD_CONTRACTS_REFERENCE.md` for the full world-contracts breakdown.

---

## builder-scaffold (Hackathon Starter Kit)

**This is the primary hackathon toolkit — all scripts and examples for building extensions.**

### Structure
```
builder-scaffold/
├── move-contracts/
│   ├── smart_gate/      ← Gate extension examples (tribe_permit, corpse_bounty)
│   ├── storage_unit/    ← StorageUnit extension example
│   └── tokens/          ← Custom token contract example
├── ts-scripts/
│   ├── smart_gate/      ← TS scripts for gate ops (authorise, issue permit, jump)
│   ├── helpers/         ← gate.ts, character.ts, storage-unit.ts helpers
│   └── utils/           ← config.ts, constants.ts, transaction.ts (sponsored tx), derive-object-id.ts
├── dapps/               ← React dApp template with @evefrontier/dapp-kit queries
├── zklogin/             ← zkLogin CLI for OAuth-based signing
└── docs/
    ├── builder-flow.md                  ← Main flow overview
    ├── builder-flow-docker.md           ← Docker setup
    ├── builder-flow-host.md             ← Host setup
    └── building-on-existing-world.md    ← WIP: live game integration (coming soon)
```

### Key TypeScript Utilities

**`ts-scripts/utils/transaction.ts` — Sponsored Transaction Helper**
Critical pattern: most game ops require CCP-sponsored txns. Two-signature flow:
```typescript
async function executeSponsoredTransaction(
    tx, client,
    playerKeypair, adminKeypair,
    playerAddress, adminAddress
) {
    // Build tx kind bytes → player sets sender, admin sets gas owner
    // Both sign → execute with [playerSig, adminSig]
}
```
On the live game: CCP/game server is the admin sponsor. Your extension code runs as player.

**`ts-scripts/utils/derive-object-id.ts` — Deterministic Object IDs**
Objects use `derived_object::claim` — IDs are deterministic from registry + item_id + tenant:
```typescript
deriveObjectId(objectRegistry, itemId, packageId)
// → predictable Sui object ID before on-chain creation
```

**`ts-scripts/smart_gate/authorise-gate.ts` — Extension Authorization Flow**
```typescript
// 1. Get gate's OwnerCap ID via devInspect
const gateOwnerCapId = await getGateOwnerCap(gateId, client, config);
// 2. Build PTB:
//    borrow_owner_cap → authorize_extension<XAuth> → return_owner_cap
// 3. Execute (sponsored)
```

**`dapps/src/queries.ts` — @evefrontier/dapp-kit Query Functions**
```typescript
import {
    getAssemblyWithOwner,    // Assembly + character owner
    getObjectWithJson,        // Object by ID with JSON
    getOwnedObjectsByType,   // All owned objects of a type
    getObjectsByType,         // All objects of a type (paginated)
    transformToAssembly,      // Raw moveObject → typed Assembly
    executeGraphQLQuery,      // Raw GraphQL
} from "@evefrontier/dapp-kit";
```

### test-resources.json (required for TS scripts)
Generated after world deploy — contains:
```json
{
    "locationHash": "...",
    "character": { "gameCharacterId": 0, "gameCharacterBId": 0 },
    "networkNode": { "typeId": 0, "itemId": 0 },
    "assembly": { "typeId": 0, "itemId": 0 },
    "storageUnit": { "typeId": 0, "itemId": 0 },
    "gate": { "typeId": 0, "itemId1": 0, "itemId2": 0 },
    "item": { "typeId": 0, "itemId": 0 }
}
```
On live game: these IDs come from in-game item IDs / CCP's world config.

---

## builder-documentation (Official Builder Docs)

**Key docs to read before building:**

### Smart Assemblies
- `smart-assemblies/introduction.md` — overview of all assemblies
- `smart-assemblies/gate/README.md` + `build.md` — gate extension guide
- `smart-assemblies/storage-unit/README.md` + `build.md` — storage unit guide
- `smart-assemblies/turret/README.md` + `build.md` — turret guide
- `smart-assemblies/network-node.md` — network node reference
- `smart-assemblies/smart-character.md` — character reference

### Smart Contracts
- `smart-contracts/eve-frontier-world-explainer.md` — 3-layer architecture explainer
- `smart-contracts/introduction-to-smart-contracts.md` — getting started

### EVE Vault
- `eve-vault/introduction-to-eve-vault.md` — wallet overview + currencies (LUX, EVE Token)
- `eve-vault/wallets-and-identity.md` — zkLogin flow, identity model
- `eve-vault/browser-extension.md` — extension setup

### dApps
- `dapps/connecting-in-game.md` — how dApps connect inside game client
- `dapps/connecting-from-an-external-browser.md` — external browser dApp (TODO in docs — use dapp-kit)
- `dapps/customizing-external-dapps.md` — customization guide

---

## EVE Vault (Chrome Extension Wallet)

**zkLogin-based wallet — the player's identity and signing mechanism.**

- Chrome MV3 extension (WXT + React)
- Auth: EVE Frontier FusionAuth OAuth → Sui zkLogin (via Enoki) → wallet address
- Implements **Sui Wallet Standard** — discoverable by any dApp
- No seed phrase — wallet address derived from OAuth identity via ZK proof
- Multi-network: Devnet, Testnet (Utopia = Testnet)

**Download:** `https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip`

**Currencies (from EVE Vault docs):**
- **LUX** — primary in-game transaction currency (most trades/services)
- **EVE Token** — Sui-based utility token; ecosystem participation, modding rewards, developer onboarding, special asset acquisition

**dApp connection flow:**
1. Player installs EVE Vault extension
2. Extension exposes wallet via Sui Wallet Standard
3. dApp discovers wallet → requests connection (permissioned)
4. Player approves → dApp can request tx signing
5. All signing goes through zkLogin (no private key exposure)

**For CradleOS:** Corp members authenticate via EVE Vault → CradleOS reads their Sui address → looks up their character, OwnerCaps, assembled structures on-chain.

---

## sui-gas-pool (Sponsored Transaction Infrastructure)

Rust service — CCP's gas station for sponsored transactions. Most game operations require the admin/CCP sponsor. For builders:
- In local/testnet: you run your own gas pool or use your admin keypair as sponsor
- In live game: CCP is the sponsor — you submit tx kind bytes, CCP wraps with gas and co-signs
- The `executeSponsoredTransaction()` in builder-scaffold shows the client-side pattern

---

## eve-frontier-proximity-zk-poc (ZK Location Privacy)

**The future privacy layer — not needed for hackathon MVP but critical for understanding location mechanics.**

### What it does
Proves location and distance without revealing coordinates:
- **Location proof**: "I am at coordinates X without revealing X" — Groth16, ~320ms
- **Distance proof**: "These two objects are within Y meters" — Groth16, ~250ms

### Current vs Future
- **Now (Mar 11):** CCP server signs location proofs (Ed25519 signature from trusted oracle)
- **Future:** Players/builders generate ZK proofs themselves — no oracle needed

### Key numbers
- Location circuit: ~2,359 constraints, ~320ms proof gen
- Distance circuit: ~1,010 constraints, ~250ms proof gen
- Distance metric: Manhattan distance (|x1-x2| + |y1-y2| + |z1-z2|)²
- Hashing: Poseidon throughout (100x cheaper in circuits vs SHA256)

### POD Structure (Location)
```
objectId, solarSystem, x_coord, y_coord, z_coord,
timestamp, pod_data_type, salt, poseidon_merkle_root, ed25519_signature
```

### Data Marketplace Angle (from docs)
> "Survey data, direct in-game interaction data, data about objects a character is piloting/using... Data marketplace for buying and selling location information of valuable objects in space... Corporate espionage and intelligence gathering... Player-to-player information trading."

CCP explicitly describes a data marketplace use case. This is a revenue model for a future CradleOS feature.

---

## sui-go-sdk

Fork of MystenLabs' Go Sui SDK. For any Go-based services that need to interact with Sui — not needed for the hackathon (we're using TypeScript SDK and Python/Sui CLI).

---

## Critical Gaps in Docs (WIP sections)

- `building-on-existing-world.md` — marked "Coming soon" — the most important guide for hackathon since we don't hold GovernorCap on the live game. Key insight from the WIP note: **on live game, you only perform player-signer operations, not admin ops.** Admin ops (configure rules, authorise gates) are for local testing only.
- `dapps/connecting-from-an-external-browser.md` — TODO
- `dapps/dapps-quick-start.md` — TODO

---

## Launch Day Checklist (March 11)

1. **Get Utopia package ID** — from CCP deploy announcement or `sui client objects --type Package`
2. **Get world object IDs** — ObjectRegistry, AdminACL, GateConfig, KillmailRegistry addresses
3. **Install EVE Vault** — Chrome extension, log in with EVE SSO
4. **Configure builder-scaffold** — update `test-resources.json` with live game IDs
5. **Check @evefrontier/dapp-kit** — update package if new version drops with Utopia contract addresses
6. **Query live JumpEvents** — update our intel API's event query with new package ID
7. **Publish CradleOS contract** — `sui client publish` on Utopia testnet
8. **Register CradleOS as gate extension** — `authorize_extension<CradleOSAuth>` on corp gates

---

## Currencies Reference (for any payment features)

| Currency | Use | Chain |
|---|---|---|
| LUX | In-game transactions, services, trades | Sui |
| EVE Token | Ecosystem participation, mod rewards, dev onboarding | Sui |
| USDC | External payments | Base (our x402 API) |
