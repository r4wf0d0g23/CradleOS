# EVE Frontier — Game Knowledge Base
_Compiled from official help center. Last updated: 2026-03-07_

---

## Currency & Economy
- **LUX**: In-game currency. All market transactions, broker fees, tolls
- **EVE Points**: Earned by converting Grace at end of each Cycle. Leaderboard-distributed (not 1:1)
- **Grace**: Earned via missions/gameplay during a Cycle. Must convert before Cycle ends or lost permanently
- **Blockchain wallet**: Linked to in-game wallet. Smart Assemblies transact on-chain (Ethereum/MUD)
- **Market**: Regional markets at Keeps. Buy/sell orders. Broker fee = max(100 LUX, 3% order value). Sales tax auto-deducted from seller

---

## Travel & Navigation

### Stargates (Static)
- Fixed connections between systems — our `jumps` table
- Standard gate travel, always available

### Smart Gates (Player-Built)
- Deployed by players near L-points (requires Network Node first)
- **Max 5 Smart Gates per system**
- Each gate links to **exactly one** other gate (paired)
- Both gates in a pair must be **owned by same character**
- Default: open to all players
- Owner can restrict via **Solidity smart contract** (`canJump` function):
  - Ally-only access
  - Time-gated access
  - **Toll systems** (require LUX payment)
- Smart Gates run on Ethereum blockchain (MUD framework) — **state queryable on-chain**

### Interstellar Jump Drive (Built-in)
- Every ship has a jump drive — no gate required
- Range is **fuel + mass dependent**: more cargo = shorter range
- Visible as a bubble radius on the star map
- Right-click system within bubble → "Jump Using Jump Drive"
- Consumes fuel (from fuel bay)

### Route Modes (for our API)
1. **Gate route**: Stargates only (our current BFS)
2. **Jump route**: Direct jump (fuel/mass limited, all systems reachable if enough fuel)
3. **Smart gate route**: Player gate network (on-chain queryable)
4. **Combined**: Optimal mix of all three

---

## Structures & Deployables

### Core Structures (No Network Node Required)
| Structure | Cost | Build Time | Notes |
|-----------|------|-----------|-------|
| Refuge | 50 Platinum-Palladium Matrix | 1 min | Ship storage, refit, respawn point |
| Portable Refinery | 50 Feldspar Crystal | 30s | Process resources in field |
| Portable Printer | 50 Hydrated Sulfide Matrix | 30s | Craft survival gear |
| Portable Storage | 50 Feldspar Crystal | 2 min | Limited storage |

### Item Type IDs (Confirmed)
| Item | Type ID | Notes |
|------|---------|-------|
| Feral Data | 72244 | Drops from feral sites; sellable via Relay |
| EU-90 Fuel | 78437 | Highest quality fuel (efficiency 90) — use for Network Node |
| EU-80 Fuel | 78515 | efficiency 80 |
| EU-40 Fuel | 78516 | efficiency 40 |
| EU-40 Fuel (alt) | 84868 | efficiency 40 |
| EU-15 Fuel | 88319 | efficiency 15 |
| EU-10 Fuel | 88335 | efficiency 10 (lowest) |
| Carbon Weave | 84210 | Network Node material |
| Thermal Composites | 88561 | Network Node material |
| Printed Circuits | 84180 | Network Node material |
| Reinforced Alloys | 84182 | |
| Feldspar Crystals | 77800 | |
| Hydrated Sulfide Matrix | 77811 | |
| Building Foam | 89089 | Gate construction material — Large Gate needs 4300 |

### Advanced Structures (Requires Network Node at L-point)
| Structure | Notes |
|-----------|-------|
| Network Node | Base anchor. Must be at L-point. Cost: 10 Carbon Weave + 10 Printed Circuits + 10 Thermal Composites |
| Relay | Enables selling Feral Data (typeID 72244) directly at your Network Node — no Keep required |
| Keep | Full station services including regional market |
| Smart Assembly (see below) | Programmable on-chain structures |

### Smart Assemblies (Programmable via Solidity/MUD on Ethereum)
These are the core of CradleOS — player-programmable blockchain structures:

- **Smart Storage Unit (SSU)**: Storage + dispensing. Extensions: marketplace, quest giver, bounty system, arcade machine, etc.
- **Smart Gate**: Travel network with `canJump` access logic
- **Smart Turret**: Area defense

**Key**: Smart Assemblies are Ethereum smart contracts → state is public, queryable on-chain

---

## Combat & PvE

### Death Mechanics
- Ship is **permanently destroyed** — must rebuild or buy new
- Cargo/resources on ship may be looted from wreck by other players
- **Respawn**: Choose spawn point via map interface
  - Any original starting system
  - Any Hangar you own
  - Any Refuge you own
- No automatic respawn location — full player choice

### Feral Sites (PvE)
- Dynamic combat sites discoverable via System Camera (F3)
- Types: Osa Drone Nests, Minor Osa Drone Nests, Osa Surveyors, Okryda Surveyors
- Rewards: resources, items otherwise unobtainable
- Risk: can escalate, requires proper ship fitting
- Tactical note: use Orbit + Keep at Range vs. Rogue Drones

### Ship Fitting
Slot types:
- **Low Slot**: Armor, shields, cargo expansion
- **Mid Slot**: Armor systems, repair modules, navigation (afterburner)
- **High Slot**: Weapons, mining equipment
- **Engine Slot**: Engine upgrades
- CPU + Powergrid limits modules. Exceeding either = module can't go online
- Heat mechanic: proximity to stars raises ship temperature

---

## Mission System
- **Cycle Hub** (in-game) + **Mission Hub** (web browser accessible)
- Grace earned → converted to EVE Points after Cycle ends
- Leaderboard-ranked distribution (not proportional to Grace amount)
- Solo + group missions available
- Side missions exist for extra Grace

---

## Key Intel Integration Opportunities

### Immediate (can build now)
1. **Jump Drive Range API**: Given system + fuel quantity + ship mass → which systems are in jump range
2. **Multi-modal routing**: Gate + jump drive combined routes
3. **System risk scoring**: Feral site types (from `planet_types` proxy), isolation, gate count
4. **Blueprint cost calculator**: Materials × market price → production cost

### Requires Live Data
5. **Smart Gate network map**: Query MUD/Ethereum for deployed smart gates, owners, access rules
6. **Market price feed**: Live buy/sell orders from regional markets
7. **Kill/wreck tracker**: Recent kills by system → threat scoring
8. **Feral site activity**: Which systems have active sites right now

### On-Chain (CradleOS territory)
9. **Smart Gate toll optimizer**: Find cheapest route factoring in gate tolls
10. **Corp treasury via SSU**: Smart Storage as corp bank
11. **Access control via canJump**: Gate network as corp border

---

## API Endpoints to Add

```
GET /route/jump-drive?from={sys}&fuel={units}&mass={kg}
    → systems in jump range + required fuel per hop

GET /route/combined?from={sys}&to={sys}
    → optimal route using stargates + jump drives

GET /intel/systems/isolated
    → systems with 0 gate connections (jump-drive only access)

GET /intel/feral-potential?system={sys}
    → estimated PvE value based on planet types + isolation

GET /market/blueprint-cost?typeID={id}&runs={n}
    → material cost per run (requires live market prices)
```

---

## Fuel Note
Ship fuel powers:
- Capacitor recharge (mining, shooting, afterburner)
- Warp drive
- **Interstellar Jump Drive** (major consumer)

Fuel type: SOF-40 Fuel (from `Sophrogon` blueprint), PRIME-67 FUEL, others.
Always carry enough before exploring — running dry in deep space = stuck.

## Patch Notes — 2026-03-12 (Founder Access 0.5.2 "Shroud of Fear")
- **Mission Hub**: Opens full-screen now (adjustable); external URLs open in system browser — relevant if CradleOS links to dApp
- **Heavy Turret**: Range confirmed 160km (defect fix); now works correctly
- **Turrets**: Fixed shooting owner when boarding; more reliable/responsive
- **Crowns**: Singleton unstack-able objects; usable from non-ship storage; show more info about contained memories
- **Wrecks**: Now have resolvable signatures
- **Known Issue**: Heavy Turret can shoot players before they can detect it with passive scanning

---

## Turret Size Tiers — Confirmed from ATTRIBUTES (2026-03-12)

Three confirmed turret tiers in EVE Frontier:

| Tier | Name | Mass (kg) | Max Targeting Range | Activation Delay | Shield HP | Armor HP | Structure HP |
|------|------|-----------|--------------------|--------------------|-----------|----------|--------------|
| MINI | Mini Turret | 132,500 | 80.00 km | 1 minute | 10,000 | 10,000 | 10,000 |
| STANDARD | Turret | 198,750 | 120.00 km | 24 minutes | 15,000 | 15,000 | 15,000 |
| HEAVY | Heavy Turret | 265,000 | 160.00 km | 48 minutes | 25,000 | 25,000 | 25,000 |

All tiers share:
- Powergrid Output: 5,000 MW
- High Slots: 1
- Volume: 600 m³ (Mini/Standard), 300 m³ (Heavy)
- CPU Output: 1,000 tf
- Capacitor Recharge: 10,000 GJ/s
- Maximum Locked Targets: 2
- Turret Hardpoints: 1
- Sensor Strength: 4× 50 points

Names in-game match CradleOS size classification (MINI/STANDARD/HEAVY) exactly.
