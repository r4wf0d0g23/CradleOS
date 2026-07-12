// ── Server environment ─────────────────────────────────────────────────────────
// VITE_SERVER_ENV: "utopia" (hackathon) | "stillness" (live CradleOS)
// Set at build time via env var. Defaults to stillness (live CradleOS build).
// Hackathon build sets VITE_SERVER_ENV=utopia explicitly.
// In dev mode, can be toggled at runtime via setServerEnv().

export type ServerEnv = "utopia" | "stillness";

// Runtime-switchable env — check localStorage override in ALL builds (not just dev)
const _buildEnv = (import.meta.env.VITE_SERVER_ENV ?? "stillness") as ServerEnv;
// For Stillness (CradleOS) builds: never allow localStorage to override to utopia.
// Utopia localStorage state from the hackathon dApp must not bleed into Stillness.
const _storedEnv = (localStorage.getItem("cradleos_server_env") as ServerEnv | null);
let _serverEnv: ServerEnv = (_buildEnv === "stillness") ? "stillness" : (_storedEnv ?? _buildEnv);
const _listeners = new Set<() => void>();

export function getServerEnv(): ServerEnv { return _serverEnv; }
export function setServerEnv(env: ServerEnv) {
  if (env === _serverEnv) return;
  _serverEnv = env;
  localStorage.setItem("cradleos_server_env", env);
  _listeners.forEach(fn => fn());
}
/** Switch server and reload the page so all derived constants reinitialize. */
export function switchServerAndReload(env: ServerEnv) {
  localStorage.setItem("cradleos_server_env", env);
  window.location.reload();
}
export function onServerEnvChange(fn: () => void) { _listeners.add(fn); return () => { _listeners.delete(fn); }; }

// Static alias for non-reactive imports (still reads current value)
export const SERVER_ENV = _serverEnv;

// Derived values — use getters for reactive access
export const SERVER_LABEL = _serverEnv === "stillness" ? "STILLNESS (Live)" : "UTOPIA (Hackathon)";

// ── World package IDs ─────────────────────────────────────────────────────────
// Source of truth: src/lib/tenantConfig.ts (vendored from @evefrontier/wallet-core,
// MIT, last synced 2026-06-22 from HEAD 1b4be23). The vendored table mirrors
// CCP's authoritative TENANT_CONFIG. Do not hand-edit these values here; update
// tenantConfig.ts instead. The Utopia v1 id is preserved for historical event
// queries on objects that pre-date the v2 upgrade.
import { TENANT_CONFIG, TenantId } from "./lib/tenantConfig";

// v2 (post-upgrade) Utopia world package — used as moveCall target on Utopia.
// Original v1 retained for event queries on pre-upgrade objects.
export const WORLD_PKG_UTOPIA    = "0x07e6b810c2dff6df56ea7fbad9ff32f4d84cbee53e496267515887b712924bd1";
export const WORLD_PKG_UTOPIA_V1 = TENANT_CONFIG[TenantId.UTOPIA].packageId;
// Stillness world package — read live from canonical TENANT_CONFIG so wipe-day
// updates are a single-file change.
export const WORLD_PKG_STILLNESS = TENANT_CONFIG[TenantId.STILLNESS].packageId;
export const WORLD_PKG = _serverEnv === "stillness" ? WORLD_PKG_STILLNESS : WORLD_PKG_UTOPIA;

// Globally-shared ObjectRegistry — derived child-object root for in_game_id
// resolution. One per world pkg; changes whenever world is republished.
// 2026-06-25 wipe-day: Stillness republished, new registry below.
export const OBJECT_REGISTRY_STILLNESS = "0xf6aed9361acc0d7021672b653ebe9dae45d88e11fecef01cc5434c8f60ae764f";
// 2026-06-25 audit: Utopia ObjectRegistry id is not currently known on-chain.
// Previous value (0x454a9aa3...) was the PRE-WIPE Stillness registry being
// borrowed as a placeholder — wrong on both counts. The only consumer is
// IntelDashboardPanel, which is Stillness-only in practice. Zero it out so a
// stray Utopia code path can't silently derive against the wrong registry.
export const OBJECT_REGISTRY_UTOPIA    = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const OBJECT_REGISTRY = _serverEnv === "stillness" ? OBJECT_REGISTRY_STILLNESS : OBJECT_REGISTRY_UTOPIA;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── CradleOS package IDs ──────────────────────────────────────────────────────
// Sui uses TWO addresses:
//   original-id  → event types, struct types, type filters (immutable, never changes)
//   published-at → moveCall targets (changes on each `sui client upgrade`)
//
// v2 deployed 2026-03-25 (Reapers_v2)
// 2026-06-25 WIPE-DAY: chain-side wipe orphaned the prior CradleOS lineage.
// All shared objects (TribeVault, Treasury, Registry, defense_policy state,
// voting elections, ssu_access policies) created under the old packages are
// unreachable from the new world. The fresh v1 publish below is the new
// canonical "original" for all type/event queries going forward.
// Pre-wipe lineage (now archived, returns zero hits forever):
//   v1 original: 0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3
//   v4 upgrade-origin (collateral_vault etc): 0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d
//   last pre-wipe published-at (v14): 0xb6be32f915bb8ffead4a721207d9e43d2bedc7a60acdb08af60af84e1915ba93
export const CRADLEOS_ORIGINAL = "0xd4f46821b371c776887922a5ac8e2e405b86b30f9066b9e5f5563f30921fc41e";
// CRADLEOS_PKG v14 (2026-05-04 PM): closes the gate-access bug class.
// Adds GateFriendlyCharacterKey + GateHostileCharacterKey + character-keyed
// entry functions on TribeGatePolicy mirroring the v13 turret-friendly fix.
// New is_allowed(policy, character_id, character_tribe_id) accessor composes
// access_level + tribe_overrides + friendly + hostile into a single boolean.
// New request_jump_permit_entry(policy, src, dest, character, clock) lets a
// pilot self-mint a JumpPermit when allowed; aborts E_ACCESS_DENIED otherwise.
// CradleOSAuth witness from gate_control is reused so a single authorize_extension
// call covers all CradleOS gate enforcement.
// Tx digest: v14 AAzKpSzqnZtNWcm3oQCZrYpWqX8Ln58XvsDw97hJ7NCR
// v13 (2026-05-04 AM): turret friendly-fire fix, tx HaZwqgiu...
// v12 (2026-04-27): shared_withdraw_to_owned, tx 6aaYV3Yha...
// v11 (2026-04-26): recover_to_owned + recover_to_shared, tx 8aevQ9uu...
// 2026-06-25 WIPE-DAY fresh publish on Stillness against new world
// `0x8b8a46ed...`. Original-id == published-at (v1). All prior CradleOS state
// (TribeVaults, defense_policy, ssu_access policies, voting elections) is
// orphaned by the chain-side wipe and unreachable from the new world.
// Tx digest: FT5Wy4ZxFLHgvNXKeK93bZmEpdW8WGHoyfP2kbadj69H
// UpgradeCap: 0x82935954658845b86584b035143a5614530b6bb8d30ad2a3b53ec70c7e2b61be
// v2 (2026-07-08): configurable JumpPermit lifetime — gate_policy::set_permit_ttl
// + permit_ttl_ms + PermitTtlKey DF + GatePermitTtlSet event.
// Tx digest: 648Vzom7hjsGSYunE3D5i9AGDPAH32BLGGZaGVELLuSV
// v3 (2026-07-08): SECURITY — gate↔policy binding. bind_gate/unbind_gate with
// OwnerCap proof + GateBindingKey DF; request_jump_permit_entry now fail-closed
// requires the source gate to be bound to the policy passed. Without this, any
// tribe's OPEN policy could mint permits for any enforced gate.
// Tx digest: 7skiif5oYopW8ruUkk2qTFHfLvVzqGQjXvveoiKSji5x
export const CRADLEOS_PKG      = "0xaf2b9fca870b3e14f64f4f5935b972a39ccbc405b9d2339ccbb8ff0953fc0995";
// Defining packages for structs introduced in specific upgrades — DF name
// types and event struct types are typed under the package that FIRST defined
// them, regardless of the current published-at:
export const CRADLEOS_V2_PKG = "0xd98eea77615be152f02d70f50140734d7cdf18f2bfb8c02abbbb1421023841ed"; // PermitTtlKey, GatePermitTtlSet
export const CRADLEOS_V3_PKG = "0xaf2b9fca870b3e14f64f4f5935b972a39ccbc405b9d2339ccbb8ff0953fc0995"; // GateBindingKey, GateBound, GateUnbound
// Previous v1 (wipe-day fresh publish) = CRADLEOS_ORIGINAL below.
// Previous v14: 0xb6be32f915bb8ffead4a721207d9e43d2bedc7a60acdb08af60af84e1915ba93 (last pre-wipe)
// Previous v13: 0x443e4730c58b29096b5289ad700740e08e4925f5d0486ec07a0c645ef75617d6
// Previous v12: 0xa9c899be21e47d30882cb5da021780ccc35421e9181518ae8161b09f7c92b11f
// Previous v9:  0x955d7ffb4c0bf6abc4caea3041f982ae7e9b21eb4b9c1ea500bb404609faf0ce

// ── SSU shared-access feature (cradleos::ssu_access) ─────────────────────────
//
// IMPORTANT: ssu_access takes `&StorageUnit` and `&OwnerCap<StorageUnit>` as
// Move parameters, which means the module is hard-linked to a specific world
// package lineage at publish time. It cannot accept world objects from a
// different lineage. We publish ssu_access as a SEPARATE single-module package
// per server so each lineage has its own correctly-linked binding.
//
//   Stillness (production):  pkg = 0x7d85b7c5... (linked to world 0x28b497559d)
//   Utopia (legacy):         no publish — feature disabled on Utopia
//
// Active CradleOS state (TribeVaults, defense_policy, turret_delegation, etc.)
// remains on the Utopia CradleOS package for current players. ssu_access is a
// *new* feature shipping production-first on Stillness only.
// v2   (2026-04-26 multi-tribe alliance) — fresh publish with vector<u32> tribe_ids
// v2.1 (2026-04-26 PUBLIC mode upgrade) — added MODE_PUBLIC=4 + set_public()
// v3   (2026-04-27 wallet recovery) — added shared_withdraw_to_owned (preferred
//      tribemate-withdraw primitive: routes Item directly into caller's per-character
//      partition on the same SSU instead of wallet limbo) and recover_to_owned /
//      recover_to_shared (rescue items already stranded in wallet via legacy
//      shared_withdraw_to_character). Tx digest: 81fNb5DK8peXPS6UADooPfoLPaWqjaM4YXauj5WYei8p
//
// IMPORTANT: Sui split-package convention
//   moveCall targets and type-arg paths must use `published-at` (latest version)
//   event/type queries (suix_queryEvents MoveEventType, etc.) must use `original-id`
//   Mixing them up breaks upgraded packages silently. See MEMORY.md 2026-03-25.

// Latest upgrade target — use for moveCall targets and SsuAuth type-arg.
// v4 (2026-04-27 promote_ephemeral_to_shared): adds promote_ephemeral_to_shared which lets
// a non-owner character move items from their per-character partition to the shared open pool.
// Uses withdraw_by_owner<Character> with the character's own OwnerCap. Tx digest: 3SpS84N3i57jiPwx19JsdbUEfKYUWgP3XsxGfAWucc5t
// 2026-06-25 wipe-day: republished against new Stillness world (fresh v1).
// Tx digest: Gj8pXc84s4k9smw7hZFBvRrYw24ZJPMA9NJbUZFxYPkh
// UpgradeCap: 0x21d0cfbbf509ccfd3f86d3fa9fcb2344d2b34ba3b2a7fb5f81548d3f45a691b4
// Pre-wipe pkg (now orphaned): 0x6ea83a3e990892331b799f8ff516835bc8362793c635403db19a87ca9b81aeb8
export const SSU_ACCESS_PKG_STILLNESS    = "0x61f4dab56be12cfa74c268d900cfc7490a50c5969810433476b78d495e572232";
// Original-id (publish v1) — use for event queries and shared-object type tags.
// Fresh v1 publish post-wipe — ORIGINAL == PKG. Pre-wipe original (orphaned):
// 0x56e545d8907628fd6a23bf1b84bd24256f0a3a497a29f1576501d2c837837b9e
export const SSU_ACCESS_ORIGINAL_STILLNESS = "0x61f4dab56be12cfa74c268d900cfc7490a50c5969810433476b78d495e572232";
// Registry — shared object id is unchanged across upgrades.
// 2026-06-25 wipe-day: new policy registry on the republished extension. The
// pre-wipe registry (0x59bbda88...) still exists but maps pre-wipe SSU ids and
// is unreachable via the new pkg — leave it orphaned.
export const SSU_POLICY_REGISTRY_STILLNESS = "0x6fff6e36947a9cad9c8fb09578494f0c50a33440b708142af0b33ba4d56c1daa";
//
// Archived ssu_access packages (do NOT use):
//   v1   (2026-04-26 single-tribe):    pkg=0x7d85b7c5524ffa0b0b029bdf77bb4f68d263f1b995f772272b04697520304a33
//                                      registry=0x3a5c99ffebc11b092822df63ff088cf0689c8290c8c60d44607e8c6cea8478ff
//                                      (replaced because struct field changes (tribe_id u32 → tribe_ids vector<u32>)
//                                       are not backward-compatible under Sui upgrade rules; only state was Raw's empty
//                                       policy 0x29dbc5d7... — regenerable)
//   v2.1 (2026-04-26 multi-tribe + PUBLIC mode):  pkg=0x14cd86a1b95fedc2f40ee46691271d03e9c333412c74f825dd79812cd942c51e
//                                      (superseded by v3 wallet-recovery upgrade 2026-04-27)

/** Active ssu_access package (LATEST upgrade target) for moveCall targets and SsuAuth type-arg. */
export const SSU_ACCESS_PKG: string = _serverEnv === "stillness" ? SSU_ACCESS_PKG_STILLNESS : "";
/** Original-id of ssu_access for event queries and type tags. */
export const SSU_ACCESS_ORIGINAL: string = _serverEnv === "stillness" ? SSU_ACCESS_ORIGINAL_STILLNESS : "";
/** Active SsuPolicyRegistry, or empty string when feature is unavailable. */
export const SSU_POLICY_REGISTRY: string = _serverEnv === "stillness" ? SSU_POLICY_REGISTRY_STILLNESS : "";
/** Convenience: is the SSU shared-access feature available on the active server? */
export const SSU_ACCESS_AVAILABLE: boolean = SSU_ACCESS_PKG !== "";
//
// ── ARCHIVED PACKAGE IDS (do NOT use) ─────────────────────────────────────────
// v1 (2026-03-24 clean-slate):  0x97c4350fc23fbb18de9fad6ef9de6290c98c4f4e57958325ffa0a16a21b759b4
// pre-v1 (legacy):              0x7541ac23fb681e4ea2cb54c0693a0c618c2ab24e69217cf4d0436adcc62ee715
// ───────────────────────────────────────────────────────────────────────────────

// Modules added AFTER the original publish have a different original-id on Sui.
// Sui indexes events/types by the package version where the module first appeared,
// NOT the package's original-id. These modules were introduced in upgrade v2.
// 2026-06-25 wipe-day: collapsed back into single-pkg lineage. CRADLEOS_UPGRADE_ORIGIN
// equals CRADLEOS_ORIGINAL post-wipe because the fresh publish carries every module.
export const CRADLEOS_UPGRADE_ORIGIN = "0xd4f46821b371c776887922a5ac8e2e405b86b30f9066b9e5f5563f30921fc41e";
// Affected modules: collateral_vault, keeper_shrine, trustless_bounty
// Use CRADLEOS_UPGRADE_ORIGIN (not CRADLEOS_ORIGINAL) for event queries on these.

// All historical CradleOS package ids where event STRUCT types may be defined.
// Sui types each event under the package id where its struct was *first defined*
// in the upgrade history — not the latest published-at, not the original-id
// in general. Multiple struct definitions across the lifetime of the package
// produce multiple defining package ids, so any robust event fetcher must
// query all of them and merge.
//
// Discovered defining packages (defense_policy struct → first-seen package):
//   v1  0x70d0797b... — PolicyCreated, RelationChanged, EnforceToggled,
//                       SecurityLevelSet, AggressionModeSet, PassageLogged,
//                       PlayerRelationSet
//   v5  0x38115c06... — HostileCharacterSet (added 2026-03-26)
//   v13 0x443e4730... — FriendlyCharacterSet, PlayerRelationRemoved
//                       (added 2026-05-04)
//
// CRADLEOS_UPGRADE_ORIGIN (v4 0xbf4249b1) covers an unrelated set of modules
// (collateral_vault, keeper_shrine, trustless_bounty); included for those.
//
// When a future upgrade introduces a new event struct, append the new
// package id here. fetchEventAcrossPackages in lib.ts uses this list.
// 2026-06-25 wipe-day: post-wipe single-pkg lineage. The fresh v1 publish
// carries every module, so there are no historical event pkgs to also query.
// All prior CradleOS lineage pkgs are orphaned and return zero hits forever.
// Append new pkgs here when future upgrades introduce new event structs.
export const CRADLEOS_EVENT_PKGS: readonly string[] = [
  CRADLEOS_ORIGINAL, // fresh v1, post-wipe — defines all v1 event structs
  CRADLEOS_V2_PKG,   // v2 2026-07-08 — defines GatePermitTtlSet
  CRADLEOS_V3_PKG,   // v3 2026-07-08 — defines GateBound/GateUnbound
];

// Backward-compat aliases — all point to published-at for moveCall targets
export const RECRUITING_PKG       = CRADLEOS_PKG;
export const TRIBE_ROLES_PKG      = CRADLEOS_PKG;
export const GATE_POLICY_PKG      = CRADLEOS_PKG;
export const CRADLEOS_EVENTS_PKG  = CRADLEOS_PKG;

// ── CradleOS Voting ──────────────────────────────────────────────────────────
// Separate sibling package. Published 2026-06-26 post-wipe on Stillness v1.
//   Pkg:           0x7756113607b23efc989f0ce9976c1b93dae87f8824e1c0ba4988273565565a7a
//   UpgradeCap:    0x2e279a2cfb1ce40e3a67bb43f486b7285d63cc553bfcce435142b1dea38436aa
//   AdminCap:      0xef1828b1055b5240d82fa4e2acec03a74ddd64a860b66fc295f61781c75b8071
//   Publish tx:    7aMUdvJWyG4Rr5w2423n5CSTbiVLBBd9GTzY4tUTTLLK
//   Registry tx:   79RqEp2zfLaNNYdqoWGrXGQvVKLnUWMmxU1arTSnpqnz
// Two blockers cleared today: (1) removed a stray `MethodKindMarker` OTW twin
// in voting.move (Sui caps zero-sized has-drop structs to one per module —
// OTW uniqueness), (2) refactored `Election` from 35 fields to exactly 32 by
// packing the 4 scheduling timestamps into an `ElectionSchedule` sub-struct
// (Sui validator caps structs at 32 fields). Both rejected at publish time
// with VMVerificationOrDeserializationError; neither caught by `sui move build`.
export const CRADLEOS_VOTING_PKG: string =
  "0x7756113607b23efc989f0ce9976c1b93dae87f8824e1c0ba4988273565565a7a";
export const CRADLEOS_VOTING_REGISTRY: string =
  "0x85c113874576b407fcebf077de1d2f9993b6edfce4e71fcc382785abd72df183";
// Append every upgrade-publish for fetchVotingEventAcrossPackages.
export const CRADLEOS_VOTING_EVENT_PKGS: readonly string[] = [
  CRADLEOS_VOTING_PKG,
];
export const CRADLEOS_VOTING_AVAILABLE: boolean =
  CRADLEOS_VOTING_PKG !== "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── Stillness wipe-day preview flag ──────────────────────────────────────────
// June 25, 2026 wipes the Stillness world package; every CradleOS object minted
// before then becomes orphaned. The voting package shipped during the preview
// window (pre-Jun 25) is intentionally a throwaway test deployment that lets us
// validate Hot Potato / AdminCap / Display patterns on real chain and capture
// real-world feedback before the clean republish. Set false in the post-wipe
// publish to drop the banner.
// 2026-06-25 PM: wipe-day passed. Preview window closed.
export const CRADLEOS_VOTING_PREVIEW: boolean = false;
export const CRADLEOS_WIPE_DATE_ISO: string = "2026-06-25";

/**
 * Build a MoveEventType string for suix_queryEvents using CRADLEOS_ORIGINAL.
 *
 * ⚠ SAFE ONLY for events whose struct was first defined in v1
 * (the original publish). Sui types every event under the package id
 * where its struct was *first defined* in the upgrade history; structs
 * introduced in mid-life upgrades have a different defining package.
 *
 * For new event consumers, ALWAYS use `fetchEventAcrossPackages` from
 * `lib.ts` instead. It queries every package id in `CRADLEOS_EVENT_PKGS`
 * in parallel and merges — robust against future upgrades that introduce
 * new event structs.
 *
 * Audit script: `scripts/cradleos_event_audit.py` walks every event
 * type queried by the dApp and verifies its defining package is in
 * `CRADLEOS_EVENT_PKGS`. Run it after any new event-query callsite is
 * added or any upgrade is published.
 */
export function eventType(module: string, event: string): string {
  return `${CRADLEOS_ORIGINAL}::${module}::${event}`;
}

// EVE Token coin types per server environment
// 2026-06-25 wipe-day: Stillness EVE coin package republished by CCP (PR #189).
// New pkg: 0xac361aa5... (was 0x2a66a89b...)
export const EVE_COIN_TYPE_STILLNESS = "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8::EVE::EVE";
export const EVE_COIN_TYPE_UTOPIA = "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE";
export const EVE_COIN_TYPE = _serverEnv === "stillness" ? EVE_COIN_TYPE_STILLNESS : EVE_COIN_TYPE_UTOPIA;

// Backward compat alias — deprecated, use EVE_COIN_TYPE
export const CRDL_COIN_TYPE = EVE_COIN_TYPE;

// Developer testnet objects — real users connect their own wallet.
// 2026-06-25 wipe-day: Raw's pre-wipe Character / NetworkNode / OwnerCap are
// orphaned by the chain-side wipe. Empty for now; will be repopulated after
// Raw creates a new Character on the republished Stillness world.
export const RAW_CHARACTER_ID = "";
export const RAW_NETWORK_NODE_ID = "";
export const RAW_NODE_OWNER_CAP = "";
// FuelConfig per server — used in network_node::offline tx
// 2026-06-25 wipe-day: new FuelConfig on republished Stillness world
export const FUEL_CONFIG_STILLNESS = "0x190645fbcf66b9322dbc8f3ee5f883e46e1e6ab562daa978ffd78cb88404f7cf";
export const FUEL_CONFIG_UTOPIA    = "0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f";
export const FUEL_CONFIG = _serverEnv === "stillness" ? FUEL_CONFIG_STILLNESS : FUEL_CONFIG_UTOPIA;
// EnergyConfig for Stillness world package (0x28b497...)
// 2026-06-25 wipe-day: new EnergyConfig on republished Stillness world
export const ENERGY_CONFIG_STILLNESS = "0x885d13b06bd9199d037aa358ba37e6692aca92d7bf6c1b5a5210da7d83501b09";
export const ENERGY_CONFIG_STILLNESS_ISV = 868826232;
// EnergyConfig for Utopia world package (0xd12a70c7...)
export const ENERGY_CONFIG_UTOPIA = "0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62";
export const ENERGY_CONFIG_UTOPIA_ISV = 791126162;
// Active EnergyConfig — selected by server env
export const ENERGY_CONFIG = _serverEnv === "stillness" ? ENERGY_CONFIG_STILLNESS : ENERGY_CONFIG_UTOPIA;
export const ENERGY_CONFIG_INITIAL_SHARED_VERSION = _serverEnv === "stillness" ? ENERGY_CONFIG_STILLNESS_ISV : ENERGY_CONFIG_UTOPIA_ISV;
export const CLOCK = "0x6";
// Sui system Random object (on-chain randomness beacon) — reserved address.
export const RANDOM_OBJECT = "0x8";

// ── CradleOS Casino ───────────────────────────────────────────────────────────
// Standalone Move package (modules: house, blackjack). Wired directly to $EVE.
// Published 2026-07-05 on Stillness. Single-pkg lineage (original == published-at).
//   tx: (publish) — pkg below; UpgradeCap 0x372bbe54784c4e59ddba7a111977163decfdec8aa56632d849c8cf1570975736
// House edge is MEASURED (scripts/edge_sim.py), not invented: ~4.9% at best play
// (stand_on=15), rising with looser thresholds. Profitable at every threshold.
// v2 (2026-07-05 PM): fresh publish adding blackjack_live (commit-reveal
// interactive hit/stand/double). Modules: house, blackjack, blackjack_live.
// UpgradeCap 0x76124b462d729eedd46e7dda64df819837d850651595cc8c2865dbe541c5ed29
// Prior v1 pkg (orphaned, House drained back to cradle wallet):
//   0x02ce3fd64b4e19fc608d48efca66d37708bc356cca0d9dc3d35221d3f7a7afbb
// v12 upgrade (plinko multi-drop: play_multi + PlinkoMultiDropped) — published-at:
// moveCall targets. Tx J8rJyxpcWUENSWCn2QfSEn5yccD2xuSotxmWVmJynBZ2 (2026-07-11).
// v11 upgrade (duplicate of v10 — double-publish, see CASINO_V10 note) — published-at:
// moveCall targets. Tx C82ntkRRz7JezdGo6knqZvqcaugbJHsSDY1uGNkMpYmR (2026-07-11).
// v10 tx 7xoUYUQ7SAUvBXfERg5Ut3QPiMfXSDAzhSjnxwW6oVQS (plinko risk modes).
// v9 tx 4zE29FTkKv9HB6iU4sw4U47qSdRqFV4LbaPzHNf3ioQE (live two-step Hi-Lo).
// v7 tx BW4utkwZQoz82wgFXRkAPDmnrgFwoKN9frPD4aEnRT4h (crash/diamonds/double_dice/war/baccarat/dragon_tower/video_poker/three_card_poker).
// v6 tx 5m1rmB7EShihUmqJUdRWEnxn5goqi4jpw5vczEqjT64D (mines exposure fix).
// v5 tx 8gxuNFsfvHByuMM9961K4jwitFTAaAJQR87dC5Hypsyi (limbo/hilo/plinko/keno/sicbo/mines added).
// v13 upgrade (per-ball exposure guard — operator ruling 2026-07-11) —
// moveCall targets. Tx AsGb2LZmQ83KXEaeTmBsNeDiKxqtrUVHvpGVnWwh4MhP.
export const CASINO_PKG_STILLNESS = "0x43de12dce6c3c318953f5f07c13c214a0ba1e1b99f3bbf32cf2af17a0494b1e6";
// v3 pkg id: instant-game event types (FlipResult/DiceRolled/RouletteSpun/
// SlotsSpun/WheelSpun were introduced in v3 — they tag under THIS id forever).
export const CASINO_V3_STILLNESS = "0x726979357374f6a0618732fc95d0d5dc443c9a1badd2d8654034c7cbcfeae0fa";
// v2 pkg id: HandSplit/SplitSettled event types (introduced in v2) tag here.
export const CASINO_V2_STILLNESS = "0x8c342cdca493fdcd374419bc452095ec08c9a9c723dddeaa30af416d6c6c7c8a";
// original-id: v1 event/type queries (HandDealt/HandSettled/HandPlayed, Hand<T>).
export const CASINO_ORIGINAL_STILLNESS = "0x461d12965a74b59816572b104e72d47a16d64e2ade0c2b78f95ec0658753c164";
export const CASINO_PKG = _serverEnv === "stillness" ? CASINO_PKG_STILLNESS : "";
export const CASINO_V3 = _serverEnv === "stillness" ? CASINO_V3_STILLNESS : "";
// v5 pkg id: new instant-game + mines event types (LimboRolled, HiLoDrawn, PlinkoDropped, KenoDrawn,
// SicBoRolled, MinesStarted, TileRevealed, MinesSettled were first introduced in v5).
// v5 introduced these event types; they tag under the v5 package id forever.
export const CASINO_V5_STILLNESS = "0x929272e41188cc14ed6916ad211d8aff86be02cf8e6996aa2eea9b54ed1a9c25";
export const CASINO_V5 = _serverEnv === "stillness" ? CASINO_V5_STILLNESS : "";
// v7 introduced these event + object types: CrashRoundPlayed, DiamondsDrawn,
// DoubleDiceRolled, WarPlayed, BaccaratPlayed, TowerStarted/RowClimbed/TowerSettled,
// VideoPokerDealt/Settled, ThreeCardPlayed — tag under the v7 id forever.
// TowerGame + VideoPokerHand object structs also introduced in v7.
// ⚠ CORRECTED 2026-07-11: the introducing package is 0x82f80f21… (lineage v7).
// 0xb66cb00e… was a same-day FOLLOW-UP upgrade (lineage v8, no new types) that
// was mislabeled "v7" — types queried under it return ZERO rows (live-verified).
export const CASINO_V7_STILLNESS = "0x82f80f21672cabe13076d1ea8e6ef0ce2a707d4b184146a4a7e5bd67527e5996";
export const CASINO_V7 = _serverEnv === "stillness" ? CASINO_V7_STILLNESS : "";
// Lineage v9 introduced: hilo::HiLoGame<T> object + HiLoStarted event (live two-step
// hi-lo). HiLoDrawn stays tagged under V5. (Constant named V8 before the lineage
// numbering was reconciled — keep the name, the id is what matters.)
export const CASINO_V8_STILLNESS = "0x005222bea5f40139a0dad2fc4bc67fe0292a7cd82e232ff00c6a6d3e1a7132c5";
export const CASINO_V8 = _serverEnv === "stillness" ? CASINO_V8_STILLNESS : "";
// Lineage v10 introduced: plinko::PlinkoModeDropped (risk modes). ⚠ v10 was
// accidentally published twice (a piped upgrade whose output parse failed had
// actually succeeded); v11 = 0xfbca70d4… is byte-identical. Event types tag
// under v10 = 0x35f5a8e2… (first introduction) — verified live via smoke event.
export const CASINO_V10_STILLNESS = "0x35f5a8e20f4e9413ebf392e5c4380c2393bed221f8579d2d1f440579d372816d";
export const CASINO_V10 = _serverEnv === "stillness" ? CASINO_V10_STILLNESS : "";
// v12 introduced: plinko::PlinkoMultiDropped (multi-drop). Event types tag under v12 id.
// This pins PlinkoMultiDropped event queries to the defining package id.
export const CASINO_PLINKO_MULTI_STILLNESS = "0xe28fcf20b93ffc759bda93d73d033a66c24fe6a41a6d3a017f1cf1d684bb984a";
export const CASINO_PLINKO_MULTI = _serverEnv === "stillness" ? CASINO_PLINKO_MULTI_STILLNESS : "";
export const CASINO_V2 = _serverEnv === "stillness" ? CASINO_V2_STILLNESS : "";
export const CASINO_ORIGINAL = _serverEnv === "stillness" ? CASINO_ORIGINAL_STILLNESS : "";
// House shared object + admin cap (on v2 package).
// Seeded 2026-07-05 from the cradle wallet (0xc80fe7d6...) with 90,000 $EVE.
// max_bet 500 EVE, min_bet 1 EVE. Admin cap held by the cradle wallet
// (server-controlled) for operator top-up / risk-param / pause:
//   HouseAdminCap = 0x476c10fc52b73f52322957368780d370c8705c2ccc1876b0cbfcf13e2cec7391
export const CASINO_HOUSE_STILLNESS = "0xeec606d9b3dfd5063c26a1b23b9ad0ed112f7de81dce64862a0d78edbb9b2c96";
export const CASINO_HOUSE = _serverEnv === "stillness" ? CASINO_HOUSE_STILLNESS : "";
export const CASINO_AVAILABLE = CASINO_PKG !== "";

/**
 * Sui testnet RPC endpoint.
 *
 * Routes through our caching JSON-RPC proxy on DGX1 (`sui-proxy.service`)
 * which provides request coalescing + TTL caching + upstream rotation.
 * Drops Failed-to-fetch cascades by ~70% on heavy fanout panels.
 *
 * `lib/rpcCircuitBreaker.ts` (installed at boot in main.tsx) monitors
 * outgoing fetches to this URL. If the proxy returns >=3 consecutive 5xx
 * or network errors, the breaker trips and `window.fetch` transparently
 * rewrites subsequent requests to `SUI_TESTNET_RPC_FALLBACK`. After 45s
 * cooldown the breaker re-tries the proxy; one success resets state.
 *
 * NOTE: only affects bare `fetch()` calls in our code. The @evefrontier
 * dapp-kit SDK uses gRPC and bypasses this constant entirely — it goes
 * straight to the public fullnode regardless. SDK-routing fix is a
 * separate piece of work.
 */
export const SUI_TESTNET_RPC = "https://keeper.reapers.shop/sui";
// 2026-07-08: fullnode.testnet.sui.io began returning HTTP 404 (empty body) on
// all requests — every direct/fallback read against it failed with
// "Unexpected end of JSON input" and cascaded into "Character Not Found" /
// "No tribe vault found" for live users. Fallback + direct now point at
// BlockVision's public testnet endpoint (CORS: *, verified 2026-07-08).
export const SUI_TESTNET_RPC_FALLBACK = "https://sui-testnet-endpoint.blockvision.org";

/**
 * DIRECT public-fullnode endpoint for CRITICAL-PATH reads only.
 *
 * Why this exists separately from `SUI_TESTNET_RPC` and `_FALLBACK`:
 *   The DGX1 caching proxy is a huge win for high-volume fanout panels
 *   (inventory, intel, calendar, query, industry, wiki, lore) where 50-200
 *   parallel RPCs would otherwise rate-limit users. But the proxy is also
 *   a single point of failure — when DGX1 has a storm/network blip, the
 *   circuit breaker trips after 3 failures, and during that 3-fail window
 *   the user's TribeVault and Character lookups can fail with "not found"
 *   errors. Critical app-shell identity should never depend on DGX uptime.
 *
 * Routing rule:
 *   - Cache-friendly bulk reads → SUI_TESTNET_RPC (proxy, with breaker fallback)
 *   - App-shell identity reads → SUI_TESTNET_RPC_DIRECT (bypasses DGX entirely)
 *
 * Critical helpers (in lib.ts) that use this direct URL:
 *   - findCharacterForWallet
 *   - fetchCharacterTribeId
 *   - fetchTribeInfo
 *   - fetchTribeVault
 *   - discoverVaultIdForTribe
 *   - fetchAllRegisteredTribes
 *
 * The circuit breaker (lib/rpcCircuitBreaker.ts) only intercepts URLs that
 * start with the proxy URL, so direct URLs naturally bypass it. The user
 * pays slightly higher RPC latency on these calls in exchange for storm
 * resilience.
 */
// 2026-07-08 (later): BlockVision free-tier 429s browser traffic aggressively —
// worse than the old public fullnode ever was. The "bypass DGX" rationale for
// this lane died with fullnode.testnet.sui.io: there is no longer a generous
// public JSON-RPC endpoint to bypass TO. Route the critical-path reads through
// the proxy as well — they gain caching/coalescing/upstream-rotation, and the
// circuit breaker still gives them the BlockVision fallback if DGX1 is down.
// `?nocache=1` = proxy cache bypass (added 2026-07-11): every read through this
// URL hits the upstream fullnode fresh. Required for owned-object refs that
// mutate between player actions (TowerGame/MinesGame/HiLoGame/VideoPokerHand,
// blackjack Hand reads, wager-coin refs) — the proxy's 30s sui_getObject cache
// was serving stale versions, causing "provided version doesn't match" aborts.
export const SUI_TESTNET_RPC_DIRECT = "https://keeper.reapers.shop/sui?nocache=1";

/**
 * Sui GraphQL endpoint.
 *
 * Routed through our caching proxy on DGX1 (cradleos-agent-proxy at
 * keeper.reapers.shop/graphql). Adds TTL caching + request coalescing for
 * the new Track 6 char-helper migration paths that hit GraphQL on every
 * wallet-connect (GET_WALLET_CHARACTERS, getObjectWithJson, etc.). The
 * proxy auto-detects query shape and applies appropriate TTLs:
 *   - character/PlayerProfile reads: 60s
 *   - object/normalized-move reads: 5min
 *   - default: 15s
 *
 * Fallback constant kept for direct probing during proxy outages.
 */
export const SUI_GRAPHQL = "https://keeper.reapers.shop/graphql";
export const SUI_GRAPHQL_DIRECT = "https://graphql.testnet.sui.io/graphql";

// Well-known tribes that don't have CradleOS vaults but still need policy coverage
export const WELL_KNOWN_TRIBES: Array<{ tribeId: number; coinSymbol: string; label: string }> = [
  { tribeId: 1000167, coinSymbol: "—", label: "Default Spawn Tribe" },
];
/**
 * EVE Frontier World API (datahub) endpoint.
 *
 * Stillness traffic is routed through our caching proxy on DGX1
 * (cradleos-agent-proxy at keeper.reapers.shop/world). Adds TTL caching
 * for the heavy reads:
 *   - /v2/types catalog: 1 hour TTL (~100KB+, changes only on patches)
 *   - /v2/solarsystems: 1 hour TTL (static)
 *   - /v2/tribes, /v2/characters: 60s TTL (slow churn)
 *   - default: 30s TTL
 *
 * Utopia traffic still goes direct (low volume, hackathon-era only).
 * The proxy DOES support Utopia via `?env=utopia` but path-concatenation
 * patterns in components make the query-string approach error-prone, so
 * we keep Utopia on the direct upstream until we move to a typed helper.
 *
 * Direct constants kept for fallback / direct probing.
 */
export const WORLD_API = SERVER_ENV === "stillness"
  ? "https://keeper.reapers.shop/world"
  : "https://world-api-utopia.uat.pub.evefrontier.com";
export const WORLD_API_DIRECT = SERVER_ENV === "stillness"
  ? "https://world-api-stillness.live.pub.evefrontier.com"
  : "https://world-api-utopia.uat.pub.evefrontier.com";

export const NETWORK_NODE_TYPE = `${WORLD_PKG}::network_node::NetworkNode`;
export const GATE_TYPE = `${WORLD_PKG}::gate::Gate`;
export const ASSEMBLY_TYPE = `${WORLD_PKG}::assembly::Assembly`;
export const TURRET_TYPE = `${WORLD_PKG}::turret::Turret`;
export const STORAGE_UNIT_TYPE = `${WORLD_PKG}::storage_unit::StorageUnit`;
export const CHARACTER_TYPE = `${WORLD_PKG}::character::Character`;
// Struct types use ORIGINAL package ID (Sui indexes types by original, not published-at)
export const CORP_REGISTRY_TYPE = `${CRADLEOS_ORIGINAL}::corp_registry::CorpRegistry`;
export const CORP_TYPE       = `${CRADLEOS_ORIGINAL}::corp::Corp`;
export const MEMBER_CAP_TYPE = `${CRADLEOS_ORIGINAL}::corp::MemberCap`;
export const TREASURY_TYPE   = `${CRADLEOS_ORIGINAL}::treasury::Treasury`;
export const REGISTRY_TYPE   = `${CRADLEOS_ORIGINAL}::registry::Registry`;
export const TRIBE_VAULT_TYPE = `${CRADLEOS_ORIGINAL}::tribe_vault::TribeVault`;
export const TRIBE_DEX_TYPE   = `${CRADLEOS_ORIGINAL}::tribe_dex::TribeDex`;

// Shared objects that must be re-created by founders on the new chain
// 2026-06-25 wipe-day: pre-wipe BountyBoard (typed under orphaned pkg
// 0x7541ac23...) replaced with a fresh board created via PTB tx
// CnuugJF5CnsopcPAxVsoS75QagPCUx44TRRPjZ6t1yYi.
export const BOUNTY_BOARD = "0xdd3c2af5485f5f4e8d13b00ae3ad8407e9ca127207a2138269d0039de2b3c388";
// Trustless bounty board — set after deploying trustless_bounty module
// 2026-06-25 wipe-day: pre-wipe TrustlessBountyBoard (typed under orphaned
// pkg 0xa676b736...) replaced with a fresh board from same PTB.
export const TRUSTLESS_BOUNTY_BOARD = "0x1969d8e82db7c26c362d6bf1b5e39fec22fa4872e494e95225d102f1975adfa4";
// 2026-06-25 wipe-day: pre-wipe KeeperShrine<EVE> (typed under orphaned
// pkg 0x2e51c867... and pre-wipe EVE coin 0x2a66a89b...) replaced with a
// fresh KeeperShrine<EVE> typed correctly against new pkg + new EVE coin.
export const KEEPER_SHRINE = "0x65daea1b74ea88e7f21d26f71735d2fdddc8c40756bd975a92684eb763c39f9d";
// Wiki board not yet created on-chain — LoreWikiPanel shows placeholder when empty
export const WIKI_BOARD   = "";
export const WIKI_MOD_CAP = "";

export const MIST_PER_SUI = 1_000_000_000n;

export const STRUCTURE_TYPES = [
  { type: NETWORK_NODE_TYPE, kind: "NetworkNode" as const, mod: "network_node", label: "Network Node" },
  { type: GATE_TYPE,         kind: "Gate"        as const, mod: "gate",         label: "Gate"         },
  { type: ASSEMBLY_TYPE,     kind: "Assembly"    as const, mod: "assembly",     label: "Assembly"     },
  { type: TURRET_TYPE,       kind: "Turret"      as const, mod: "turret",       label: "Turret"       },
  { type: STORAGE_UNIT_TYPE, kind: "StorageUnit" as const, mod: "storage_unit", label: "Storage Unit" },
] as const;

export type StructureKind = "NetworkNode" | "Gate" | "Assembly" | "Turret" | "StorageUnit";
