# CradleOS — Design Document

**Project:** CradleOS — On-chain civilization infrastructure for EVE Frontier  
**Network:** Sui Testnet  
**Status:** Live — unified v5 package deployment  
**Hackathon:** EVE Frontier × Sui 2026 · March 11–31

---

## Architecture Overview

CradleOS is a **single unified Sui Move package** for running the social, economic,
defensive, and operational layer of a tribe inside EVE Frontier. Rather than treating
these as separate tools, CradleOS models them as one coherent on-chain operating stack:

- tribal economy and treasury operations
- logistics contracts, bounties, collateral, and reimbursements
- gate policy and turret behavior
- membership, governance, delegation, and inheritance
- recruiting, announcements, lore, and contribution tracking

The current package contains **24 Move modules** and **6,533 lines of code**, built in
**Move 2024 edition** against the **EVE Frontier world-contracts** dependency. It is not a
fragmented suite of standalone packages; the architecture has been consolidated into a
single package so shared patterns, events, and interfaces stay consistent across the
entire system.

### Package Snapshot

- **Package:** CradleOS
- **Chain:** Sui testnet
- **Chain ID:** `4c78adac`
- **Version:** v5
- **Edition:** Move 2024
- **Dependency:** EVE Frontier world-contracts
- **Code size:** 24 modules, 6,533 lines

### Current On-Chain Status

- **Published-at:**
  `0x38115c0620f5f885529e932c1369cbe10305c9f2de504a6f203ce831941439c4`
- **Original-id:**
  `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3`
- **UpgradeCap:**
  `0xdc3df6486bd0f429066eaa6e7318d106678036af9df82a61a76700886d9f064a`

### Module Layout

#### Economy (9)
- `tribe_vault` — core tribal vaults, balances, and accounting
- `treasury` — corp treasury deposits and withdrawals
- `bounty_contract` — attested on-chain bounties
- `trustless_bounty` — escrowed bounty board
- `cargo_contract` — trustless delivery contracts
- `collateral_vault` — collateral-backed agreements
- `ship_reimbursement` — SRP reimbursement flow
- `tribe_dex` — tribe-level order-book exchange
- `keeper_shrine` — donation / offering pool

#### Defense (5)
- `defense_policy` — security levels, relations, hostile logic
- `gate_control` — Smart Gate access control
- `gate_policy` — OPEN / TRIBE / ALLIES / CLOSED gate rules
- `turret_ext` — Smart Turret targeting extension
- `turret_delegation` — member-held turret delegation objects

#### Infrastructure (5)
- `registry` — root shared object for deployments
- `corp` — corporation object, membership, commander authority
- `tribe_roles` — delegated Admin / Officer / Treasurer / Recruiter roles
- `inheritance` — succession and dead-man-switch logic
- `gate_profile` — gate metadata and profile storage

#### Social (5)
- `recruiting_terminal` — applications and approvals
- `announcement_board` — on-chain tribe announcements
- `lore_wiki` — on-chain lore publishing
- `contributions` — contribution and support tracking
- `character_registry` — wallet ↔ character ↔ tribe claim registry

This module map matters architecturally: CradleOS is not one contract with add-ons, but a
composable package where governance, defense, economy, and social state can interoperate
through shared IDs, events, and world-contract integrations.

---

## Design Principles

### 1. Unified package, composable modules

The package is organized into focused modules, but deployed as one coherent unit. That
reduces interface drift, keeps shared patterns consistent, and avoids the coordination cost
of maintaining a fragmented multi-package architecture.

### 2. No `TribeVault` type dependency in extension-style flows

One of the most important lessons carried forward is to **avoid hard type coupling where it
creates brittle integration boundaries**. In practice, secondary or extension-style flows use
raw identifiers such as `vault_id: address` and `tribe_id: u32` instead of requiring direct
`TribeVault` type dependencies everywhere.

This principle remains important because it makes the system easier to compose with other
objects and avoids the class of package-boundary type mismatch problems that appeared in
earlier iterations.

### 3. Shared objects for policy, owned objects for delegation

CradleOS deliberately separates **global policy state** from **wallet-held delegated
authority**.

- Shared objects are used for things the tribe needs to inspect collectively, such as
  `TribeDefensePolicy`, `TribeGatePolicy`, and `TribeRoles`.
- Owned objects are used for delegated authority held by a specific wallet, such as
  `TurretDelegation`, capability objects, and member-specific control surfaces.

This split improves readability, reduces ambiguity over who controls what, and fits Sui's
ownership model cleanly.

### 4. Generic asset handling over hardcoded token assumptions

Economic modules are designed around generic coin types instead of a proprietary token.
That makes the package usable with the live EVE ecosystem as it exists, rather than forcing
all flows through a project-specific currency.

### 5. Events as the primary UI synchronization layer

CradleOS emits events across state-changing flows so the dApp can remain reactive. This is
important in a game-adjacent operational interface: officers need to see updates to policy,
contracts, reimbursements, and social activity without treating the UI as a static admin
panel.

---

## Economy Model

CradleOS uses a **generic `<phantom T>` coin architecture** across its economic modules.
Instead of assuming a single project token, escrow, vault, contract, and bounty systems are
parameterized over coin type.

This pattern is visible across the package, including modules such as:

- `collateral_vault::CollateralVault<phantom T>`
- `tribe_dex::TribeDex<phantom T>`
- `trustless_bounty::TrustlessBounty<phantom T>`
- `keeper_shrine::KeeperShrine<phantom T>`
- `cargo_contract::CargoContract<phantom T>`
- `bounty_contract::Bounty<phantom T>`

### Why this matters

This makes CradleOS compatible with:

- **EVE tokens**
- **LUX-linked economic flows**
- any other fungible Sui asset that fits the transaction context

The current EVE token references used by the broader project are:

- **Stillness:** `0x2a66a89b...::EVE::EVE`
- **Utopia:** `0xf0446b93...::EVE::EVE`

Operational assumptions documented in the project:

- **9 decimals**
- **10B total supply**
- **1 EVE = 100 LUX in-game**

### Economic scope

CradleOS does not implement a narrow treasury contract. It models a broader settlement
economy, including:

- member balances and vault accounting
- deposits and withdrawals
- bounty issuance and payout
- cargo delivery rewards with dispute windows
- collateralized agreements
- ship loss reimbursement
- tribe-level exchange activity
- donations and community funding

The key architectural point is simple: **CradleOS is token-agnostic by design**. There is no
project-specific CRDL token dependency in the current system.

---

## Defense & Access Control

CradleOS treats defense as policy, not just permissions. The defense stack spans both
readable governance objects and live Smart Assembly integrations.

### Defense policy

`defense_policy.move` is the main security policy module. It handles:

- security posture
- relations and hostile logic
- tribe-level defensive state used by the dApp and assembly integrations

### Gate access

CradleOS contains two gate-related layers:

- `gate_control` integrates directly with Smart Gate authorization logic
- `gate_policy` models policy states such as **OPEN**, **TRIBE**, **ALLIES**, and **CLOSED**

The code also reflects that access control is grounded in **EVE Frontier native `tribe_id`**
checks rather than an entirely separate identity layer. That matters because gate policy is
not an abstract ACL system; it is tied to in-world membership semantics.

### Roles and delegated authority

`tribe_roles` provides delegated roles such as:

- Admin
- Officer
- Treasurer
- Recruiter

These roles are designed to work alongside policy objects, rather than replacing them.
Policy answers what the tribe allows; role delegation answers who can administer it.

### Same-tribe protection override

One deliberate design choice appears in `turret_ext.move`: turret targeting is overridden to
**protect same-tribe members unless they are explicitly marked hostile by character ID**.

This is an intentional divergence from the default game behavior described in project notes.
Architecturally, it reflects the view that tribe defense should preserve internal safety by
default and escalate only through explicit hostile designation.

---

## Smart Assembly Integration

CradleOS is not only a set of bookkeeping contracts. It is designed to plug into **EVE
Frontier Smart Assemblies** and extend their behavior on-chain.

### Typed witness pattern

Assembly-sensitive flows use typed witness structures such as:

- `CradleOSAuth` (gate control)
- `TurretAuth` (turret extension)

These witness types constrain who can authorize certain actions and help ensure that permits
or turret behavior extensions are issued only through the intended CradleOS pathways.

### Dynamic fields for per-assembly configuration

The package also uses dynamic fields where per-object configuration needs to live on-chain
without bloating root objects. This pattern is used in multiple modules and is especially
important for assembly-centric state, such as per-gate and per-turret configuration.

### OwnerCap borrow/return pattern

EVE Frontier's world-contract model places assembly ownership authority on character-owned
capabilities. CradleOS integrates with that model through a **borrow → use → return**
pattern: it uses the relevant owner capability to operate on a gate or turret without
transferring long-term ownership of the assembly itself.

That design keeps CradleOS composable with native game ownership while still enabling tribe
policy automation.

### Why this layer matters

This is where CradleOS stops being a generic governance package and becomes real Frontier
infrastructure. Gate rules, turret behavior, metadata-linked UI, and on-chain policy are all
connected to actual in-world structures.

---

## Agent Integration

CradleOS includes an AI-assisted operational layer through the **Keeper** integration.

### Current deployment

- **Proxy host:** `keeper.reapers.shop:4403`
- **Serving stack:** vLLM
- **Model:** Nemotron-3-Super-120B
- **UI surface:** Keeper panel in the dApp

### Role of the proxy

The agent proxy fronts model inference for the dApp and supports an in-universe operations
assistant. According to the current project state, it:

- connects to the Keeper panel in the dApp
- logs queries for training data collection
- injects a system prompt containing **72 real manufacturing recipes** to reduce
  hallucinations in industry support flows

This is an important architectural choice: the AI layer is not presented as authoritative
consensus logic on-chain. It is an operational assistant layered alongside the on-chain
system, with explicit grounding data for domain-specific tasks.

---

## Oracle Settlement

Some workflows in CradleOS intentionally separate **claim submission** from **final
settlement**.

### Dispute-window flows

Two important examples are:

- **cargo contracts**
- **ship reimbursement claims**

These flows include dispute windows so that a claim can be challenged or reviewed before
being finalized.

### Off-chain oracle process

Settlement is completed by an oracle process:

- **Oracle script:** `oracle_tx.mjs`
- **Related service:** `api.py`
- **Intel / support host:** Jetson1 on port `8899`

The oracle polls for expired claims and submits the finalization transaction on-chain once a
contract or reimbursement has cleared its waiting period.

This is a pragmatic design decision. It keeps the core agreement and timing guarantees
on-chain while using an off-chain process for liveness and scheduled execution.

---

## dApp Architecture

The CradleOS dApp is a substantial front end, not a thin wallet demo. It provides the
control surface for the package on both the open web and the EVE Frontier in-game browser.

### Stack

- **React 19**
- **TypeScript**
- **Vite**
- **`@evefrontier/dapp-kit`** for EVE Vault integration
- **`@mysten/dapp-kit-react`** for Sui wallet standard support
- **`@tanstack/react-query`** for data fetching
- **`three.js`** for the 3D starmap

### Scale

- **34 panel components** in `cradleos-dapp/src/components/`
- **`lib.ts`** at **3,045 lines** for RPC helpers and transaction builders

This front end spans operational domains including economy, defense, intelligence,
logistics, governance, and social coordination.

### Dual-runtime access

The dApp supports both:

- normal browser access
- the **EVE Frontier in-game browser**, loaded through a structure metadata URL

When opened in-game, the **EVE Vault wallet is pre-injected**, so players can interact with
CradleOS without leaving the Frontier client flow.

### Sponsored transactions

Metadata update flows use sponsored transactions, allowing users to perform supported actions
without directly paying gas in the normal wallet UX path. For a game-native system, this
matters: infrastructure tooling has to feel operationally accessible, not like a separate
crypto ceremony.

### Server support

The dApp also supports **Stillness** and **Utopia** server contexts with runtime switching,
which is important for live use versus hackathon/demo environments.

---

## In-Game Integration

CradleOS is designed to be used where players already operate: **inside EVE Frontier**.

If a structure's metadata URL points to the CradleOS app, the same dApp can be opened in the
game's embedded browser. This gives structures an immediate operational interface tied to the
on-chain systems behind them.

That creates a tight loop between:

- in-world infrastructure
- wallet-native on-chain actions
- reactive operational UI
- AI-assisted support through Keeper

This in-game deployment model is one of the project's strongest architectural qualities. It
connects the chain layer to actual play rather than isolating it in an external admin site.

---

## Why This Architecture Fits Frontier

EVE Frontier already provides programmable structures and wallet-native systems. CradleOS
extends that foundation upward into a full settlement stack.

The core architectural claim is not that every feature is novel in isolation. It is that the
features are assembled into a coherent operating model for civilization-building:

- economy is programmable and token-agnostic
- defense is inspectable and enforceable
- governance is delegated but auditable
- logistics and reimbursement flows are trust-minimized
- social memory is kept on-chain
- the UI works both on the web and inside the game

In other words, CradleOS is designed as **civilization infrastructure**, not just a bundle of
contracts.
