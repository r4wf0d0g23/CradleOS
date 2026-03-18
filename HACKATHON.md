# EVE Frontier Hackathon 2026 — Mission Brief
_Compiled 2026-03-07. T-4 days to launch._

---

## Schedule
| Date | Event |
|------|-------|
| **Mar 11** | Hackathon starts. Utopia sandbox goes live. Sui migration live. |
| **Mar 11–31** | Build period |
| **Mar 31** | Submission deadline |
| **Apr 1–8** | Optional: Deploy into Stillness (LIVE game) |
| **Apr 1–15** | Community voting |
| **Apr 15–22** | Judging |
| **Apr 24** | Winners announced |

**T-4 days. Hard cutover on Mar 11.**

---

## Theme: "A Toolkit for Civilization"
Build infrastructure, systems, and tools that a recovering civilization depends on.

Two tracks:
1. **In-world mods** — Smart Assembly custom logic (Move contracts, deployed into space)
2. **External apps** — World API dApps (maps, dashboards, coordination, analytics)

CradleOS fits both. Intel API is track 2. Smart Gate/SSU extensions are track 1.

---

## Tech Stack (Confirmed)

### Chain
- **Sui** (Layer 1). Move language. Full migration from Ethereum/MUD on Mar 11.
- **World Contracts repo**: `github.com/evefrontier/world-contracts` (Sui Move, WIP, not yet live)
- **Current in-game contracts**: `github.com/projectawakening/world-chain-contracts` (old chain, ignore)

### World Architecture (3 layers)
```
Layer 1: Primitives (Move modules)
  location.move, inventory.move, fuel.move, status.move, 
  network_node.move, energy.move

Layer 2: Assemblies (Sui shared objects)
  StorageUnit, Gate, Turret
  — each is a shared object (concurrent access by game + players)
  — compose primitives, enforce digital physics

Layer 3: Player Extensions (typed witness pattern)
  — Custom Move packages register Auth witness type
  — Assembly verifies TypeName at runtime
  — Only registered extension can call authenticated entry points
```

### Read Path (Intel API data sources)
```
GraphQL: query objects by type, owner, filters
  endpoint: Sui GraphQL RPC (testnet IDE available)
  example type filter: ::network_node::NetworkNode

gRPC: high-throughput streaming (checkpoints)
  requires gRPC-enabled Sui full node

Events: suix_queryEvents (JSON-RPC)
  JumpEvent — gate traversal (MOVEMENT INTEL)
  inventory updates — item flow
  deployment changes — new structures
```

**JumpEvent is the kill feed equivalent.** Every player gate jump emits on-chain.

### Write Path
- Sui TypeScript SDK (primary)
- Rust SDK or community Go SDK (alternatives)
- Sponsored transactions for proximity-validated ops (player signs, EVE Frontier pays gas)

---

## Smart Assembly API Reference

### Gate
```move
// Issue a jump permit (custom extension)
public fun issue_jump_permit<Auth: drop>(
    source_gate: &Gate, destination_gate: &Gate,
    character: &Character, _: Auth,
    expires_at_timestamp_ms: u64, ctx: &mut TxContext,
)

// Jump with permit
public fun jump_with_permit(
    source_gate: &Gate, destination_gate: &Gate,
    character: &Character, jump_permit: JumpPermit,
    admin_acl: &AdminACL, clock: &Clock, ctx: &mut TxContext,
)

// JumpPermit struct
public struct JumpPermit has key, store {
    id: UID,
    character_id: ID,
    route_hash: vector<u8>,     // direction-agnostic
    expires_at_timestamp_ms: u64,
}
```
Gate linking requirements: same owner, both online, ≥20km apart, sponsored tx.

### Storage Unit (SSU)
```
Primary inventory — owner access via OwnerCap
Ephemeral inventories — per-character, temporary (biometric-style access)
Items bridged: Game→Chain (mint) or Chain→Game (burn)
Extension pattern: same typed witness as Gate
```

### Network Node
Required before any Smart Assembly can be deployed.
Must be at L-point. Energy anchor for all assemblies.

---

## Wallet Integration
- **EVE Vault**: Sui wallet browser extension for in-game auth (`github.com/evefrontier/evevault`)
- **dApp Kit SDK**: `@evefrontier/dapp-kit` — connects external apps to game wallet
- Players use EVE Vault to sign transactions from external dApps

---

## Action Items Before Mar 11

### URGENT (do before Wednesday)
- [ ] Register in EVE Frontier launcher for Utopia server access
  - Add `--frontier-test-servers=Utopia` to launcher target
  - Click Register, fill details (won't get verification code — that's expected)
  - Must register before Mar 11 for batch processing
- [ ] Join EVE Frontier Discord hackathon section
  - `discord.com/invite/evefrontier` → #Hackathon section

### BUILD (staging against static data now, swap to Utopia on Mar 11)
- [ ] Set up Sui dev environment (Sui CLI + Node.js)
  - Clone `evefrontier/world-contracts`
  - `cp env.example .env`, add Sui private key
- [ ] Clone and study world-contracts Move source
- [ ] Build JumpEvent listener prototype (suix_queryEvents)
  - This becomes the live threat intel feed on Mar 11
- [ ] Build GraphQL gate network query (all deployed Gates by type)
- [ ] Build dApp kit connection to intel API

---

## Integration Architecture (CradleOS)

```
[Utopia Sui Chain]
    ↓ suix_queryEvents (JumpEvent, inventory, deploy)
    ↓ GraphQL (Gate objects, SSU objects, NetworkNode objects)
    
[Frontier Intel API :8899]   ←— static frontier.db (staging)
    /system/{name}               ←— swap to live chain read on Mar 11
    /route/jump-range
    /intel/systems/rich
    /intel/isolated
    
[CradleOS Sui Contracts]     ←— our Move extensions
    corp_gate.move              (JumpPermit with corp allowlist)
    corp_treasury.move          (SSU with corp access logic)
    corp_intel.move             (aggregate + score + alert)
    
[Discord / Agent Layer]
    Agent-Nav, Agent-Raw
    Real-time alerts, route recommendations, threat scores
```

---

## Key URLs
- Docs: `https://docs.evefrontier.com`
- World Contracts: `https://github.com/evefrontier/world-contracts`
- EVE Vault: `https://github.com/evefrontier/evevault`
- Sui Developers: `https://developers.sui.io`
- GraphQL Testnet IDE: (from Sui docs)
- EVE Frontier Discord: `discord.com/invite/evefrontier`
- Hackathon Terms: `evefrontier.com/en/eve-froniter-hackathon-event-rules`
