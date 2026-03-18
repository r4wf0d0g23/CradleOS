# EVE Frontier World Contracts — Launch Day Reference
*Scraped 2026-03-09 from https://github.com/evefrontier/world-contracts*
*Source: `frontier/world-contracts/`*

---

## Architecture Overview

Three-layer system:
1. **Primitives** — composable low-level modules (location, fuel, energy, inventory, status, network_node)
2. **Assemblies** — in-game structures (Gate, StorageUnit, NetworkNode, Turret) built from primitives
3. **Player Extensions** — your custom Sui package extending assembly behavior via typed-witness pattern

All assemblies are **shared objects** on Sui. State mutations require `OwnerCap<T>` or `AdminACL`.

---

## Key Contracts

### `network_node.move`
The power source for all base assemblies.

**Struct:**
```
NetworkNode {
    key: TenantItemId,         // in-game item ID + tenant
    type_id: u64,
    status: AssemblyStatus,    // anchored/online/offline
    location: Location,        // hashed coordinates
    fuel: Fuel,                // burn rate, capacity, quantity
    energy_source: EnergySource,  // max production GJ
    connected_assembly_ids: vector<ID>,  // all assemblies drawing power
}
```

**Critical flows:**
- `anchor()` → creates NWN, issues `OwnerCap<NetworkNode>` to character
- `online()` → starts fuel burn + energy production
- `offline()` → returns `OfflineAssemblies` hot potato; must call `offline_connected_gate/storage_unit` for each assembly in same tx
- `update_fuel()` → call periodically; if fuel depleted, returns hot potato (same pattern)
- `connect_assemblies()` → returns `UpdateEnergySources` hot potato; must update each assembly's energy source
- `fuel_quantity()` → readable on-chain; monitor for depletion risk

**Events:**
- `NetworkNodeCreatedEvent` — assembly_key, type_id, fuel_max_capacity, max_energy_production

---

### `gate.move`
Smart Gate — programmable teleport link between two structures.

**Struct:**
```
Gate {
    key: TenantItemId,
    type_id: u64,
    linked_gate_id: Option<ID>,    // partner gate
    status: AssemblyStatus,
    location: Location,             // hashed
    energy_source_id: Option<ID>,  // NetworkNode ID
    extension: Option<TypeName>,   // authorized builder extension
}
```

**Jump mechanics:**
- Default (`jump()`): anyone can jump, no permit — requires NO extension configured
- Extended (`jump_with_permit()`): caller needs `JumpPermit` from your extension logic
- `JumpPermit`: single-use (deleted on jump), bound to character + bidirectional route hash, has expiry timestamp
- Gates must be **linked** (both directions) and **online** to jump
- Linking requires distance proof signed by CCP server (≥20km apart, same owner)

**Extension pattern:**
```move
// 1. Define your witness type
public struct Auth has drop {}

// 2. Register with gate
gate::authorize_extension<Auth>(gate, owner_cap);

// 3. Issue permits in your extension logic
gate::issue_jump_permit<Auth>(source, dest, character, Auth {}, expires_ms, ctx);

// 4. Player jumps using your permit
gate::jump_with_permit(source, dest, character, permit, admin_acl, clock, ctx);
```

**Events — most important for intel:**
- `JumpEvent` — `source_gate_key`, `destination_gate_key`, `character_key`, `character_id`
  → This is the kill-feed equivalent for movement intelligence
- `GateLinkedEvent` / `GateUnlinkedEvent` — track gate topology changes
- `ExtensionAuthorizedEvent` — when a gate gets custom logic

---

### `killmail.move`
On-chain kill records — shared objects AND events.

**Struct:**
```
Killmail {
    key: TenantItemId,
    killer_id: TenantItemId,
    victim_id: TenantItemId,
    reported_by_character_id: TenantItemId,
    kill_timestamp: u64,    // Unix seconds
    loss_type: LossType,    // SHIP (1) or STRUCTURE (2)
    solar_system_id: TenantItemId,
}
```

**Events:**
- `KillmailCreatedEvent` — same fields; queryable via `suix_queryEvents`

**Query:**
```
suix_queryEvents(filter: { MoveEventType: "world::killmail::KillmailCreatedEvent" })
```

---

### `access_control.move`
Three-level capability hierarchy:

1. **`GovernorCap`** — top level (CCP deployer only)
2. **`AdminACL`** — shared object with `authorized_sponsors: Table<address, bool>`; most admin ops require sponsored tx from an authorized address
3. **`OwnerCap<T>`** — transferable capability granting mutation access to one specific object of type T

**Key rules:**
- `OwnerCap<Character>` is **NOT transferable** (enforced in code)
- All other `OwnerCap<T>` are transferable (delegation works)
- `verify_sponsor()` checks the tx sponsor address against AdminACL — critical: most game ops are **sponsored transactions**
- `is_authorized(owner_cap, object_id)` — simple boolean check

**Future noted in code:** Multi-party capability registry for corporation/tribe shared control — this is the exact gap CradleOS fills.

---

### `character.move` (inferred from usage)
- Has `tenant()`, `key()`, `tribe()`, `character_address()` fields
- `OwnerCap<Character>` lives under the character object (received via `Receiving<OwnerCap<T>>`)
- Tribe membership tracked on-chain (`character.tribe()` — u32)

---

### `location.move`
- All locations stored as **cryptographic hashes** — raw coordinates never on-chain
- Proximity verification currently via **CCP server signature** (trusted oracle)
- **Future:** Zero-knowledge proofs (any party with cleartext can prove proximity without revealing it)
- `verify_distance()` — used by gate linking; validates signed distance proof

---

## Extension Examples (Hackathon Templates)

### `tribe_permit.move`
- Gate only allows jump for characters with a specific tribe ID
- Stores `TribeConfig` as a dynamic field on `ExtensionConfig`
- `issue_jump_permit()` checks `character.tribe() == tribe_cfg.tribe` then issues 5-day permit

### `corpse_gate_bounty.move`
- Player submits a specific item (corpse) to a StorageUnit → gets a JumpPermit
- Withdraw from player inventory → validate type_id → deposit to owner storage → issue permit
- Shows: cross-assembly interaction (StorageUnit + Gate) in a single extension tx

---

## Hot Potato Patterns (Critical for PTB construction)

Three hot potatoes enforced by the contract — all must be consumed in same transaction:

| Hot Potato | Source | Must consume by |
|---|---|---|
| `OfflineAssemblies` | `nwn.offline()` or `nwn.update_fuel()` (depleted) | Call `offline_connected_gate/storage_unit` for each assembly ID, then `destroy_offline_assemblies` |
| `UpdateEnergySources` | `nwn.connect_assemblies()` | Call `update_energy_source_connected_gate/storage_unit` for each, then `destroy_update_energy_sources` |
| `HandleOrphanedAssemblies` | `nwn.unanchor()` | Call `offline_orphaned_gate/storage_unit` for each, then `destroy_network_node` |

---

## On-Chain Events to Index (Launch Day Priority)

| Event | Module | Use Case |
|---|---|---|
| `JumpEvent` | gate | Movement intel — who jumped where |
| `KillmailCreatedEvent` | killmail | Kill feed — ship/structure losses |
| `NetworkNodeCreatedEvent` | network_node | Base placement intel |
| `GateLinkedEvent` | gate | Gate topology — route mapping |
| `ExtensionAuthorizedEvent` | gate | Which gates have custom logic |

**Query pattern:**
```
suix_queryEvents({
    filter: { MoveEventType: "world::gate::JumpEvent" },
    cursor: null,
    limit: 50,
    descending_order: true
})
```

---

## Sui GraphQL Queries (Testnet)

Gate state:
```graphql
query GetGate($id: SuiAddress!) {
  object(address: $id) {
    asMoveObject {
      contents { json }
    }
  }
}
```

All NetworkNodes (via object type):
```graphql
query {
  objects(filter: { type: "world::network_node::NetworkNode" }) {
    nodes {
      address
      asMoveObject { contents { json } }
    }
  }
}
```

---

## CradleOS Integration Points

1. **Fuel monitoring**: `nwn.fuel_quantity()` — track across all corp NWNs, alert before depletion
2. **Assembly roster**: `nwn.connected_assemblies()` — enumerate all structures on a base
3. **Gate access control**: `authorize_extension<CradleOSAuth>` + issue permits based on corp membership
4. **Corp gate topology**: Index `GateLinkedEvent` to map corp route network
5. **Kill tracking**: Index `KillmailCreatedEvent` filtered by corp character IDs
6. **Movement intel**: Index `JumpEvent` — same data our intel API already exposes
7. **Multi-party OwnerCap**: Code explicitly notes this as a TODO — "Capability registry for corporation/tribe with multiple members." This is the legal authority CradleOS can claim to fill.

---

## Deployment Notes

- All assemblies are `transfer::share_object()` — concurrent access from any address
- Sponsored transactions required for most admin ops — builder extensions need their own sponsor address in AdminACL
- `derived_object::claim()` used for deterministic object IDs from registry — IDs are predictable given item_id + tenant
- Package on Utopia testnet from March 11 — contract addresses in deployment artifacts post-launch

---

## Files
```
frontier/world-contracts/contracts/world/sources/
├── access/access_control.move       ← OwnerCap + AdminACL
├── assemblies/
│   ├── assembly.move                ← Base assembly
│   ├── gate.move                    ← Smart Gate (JumpEvent, JumpPermit)
│   ├── storage_unit.move            ← Inventory structure
│   └── turret.move                  ← Defense structure
├── character/character.move         ← Player character
├── killmail/killmail.move           ← Kill records
├── network_node/network_node.move   ← Power/energy source
├── primitives/
│   ├── energy.move
│   ├── fuel.move
│   ├── in_game_id.move              ← TenantItemId
│   ├── inventory.move
│   ├── location.move                ← Hashed coordinates
│   ├── metadata.move
│   └── status.move                  ← anchored/online/offline
└── registry/
    ├── killmail_registry.move
    └── object_registry.move

contracts/extension_examples/
├── corpse_gate_bounty.move          ← Multi-assembly extension template
├── tribe_permit.move                ← Gate access control template
└── config.move                      ← XAuth witness + ExtensionConfig shared obj
```
