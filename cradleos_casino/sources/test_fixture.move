/// CradleOS Casino — shared TEST-ONLY fixture helpers
///
/// WHY THIS MODULE EXISTS
/// ─────────────────────────────────────────────────────────────────────────────
/// The v26 "proof-of-character" gate (2026-07-13) added an `&Character` parameter
/// to every game's `entry fun play*`, and every game module calls
/// `house::assert_character(house, character, ctx)` which asserts
///
///     character::character_address(character) == tx_context::sender(ctx)
///
/// That means a unit test can no longer just call `play(&mut house, &r, bet, ctx)` —
/// it needs a REAL `Character` object whose `character_address` is the test player.
///
/// When the v26 gate landed, the ~28 game modules' `#[test]` blocks were never
/// updated, leaving the package with 204 compile errors in test code and NO
/// runnable test suite (found 2026-08-07 while adding public donations). Minting
/// a Character is not one line — it requires a four-part world-admin fixture:
///
///   1. `world::world::init_for_testing`   -> GovernorCap (owned by sender)
///   2. `world::access::init_for_testing`  -> shared AdminACL
///   3. `add_sponsor_to_acl(acl, &gov_cap, who)`  -> satisfies `verify_sponsor`,
///        which `create_character` transitively requires via
///        `access::create_owner_cap_by_id`
///   4. `world::object_registry::init_for_testing`-> shared ObjectRegistry, used
///        for deterministic derived-object UID claiming
///
/// Rather than paste that into 54 call sites, it lives here once. Game tests call
/// `bootstrap_world(&mut sc, admin)` once after creating the House, then
/// `mint_character(&mut sc, player, game_id)` to get a Character to pass to `play`.
///
/// `#[test_only]`: this module is compiled ONLY under `sui move test`. It is never
/// part of the published bytecode, so it cannot widen the on-chain attack surface.
#[test_only]
module cradleos_casino::test_fixture;

use sui::test_scenario::{Self, Scenario};
// NOTE: the file is `access_control.move` but the module is declared
// `module world::access;` — import by MODULE name, not file name.
use world::access::{Self, AdminACL};
use world::character::{Self, Character};
use world::object_registry::{Self, ObjectRegistry};
use world::world::{Self, GovernorCap};

/// Tenant string used for all test characters. Any non-empty value works; the
/// (game_character_id, tenant) pair must be unique per character because
/// `create_character` claims a derived object keyed on it.
const TEST_TENANT: vector<u8> = b"test";

/// Default tribe id for test characters. Must be non-zero (ETribeIdEmpty).
const TEST_TRIBE_ID: u32 = 1;

/// Stand up the world-side admin objects required to mint Characters, and
/// authorize `admin` as an ACL sponsor.
///
/// Call ONCE per scenario, in a tx sent by `admin`, AFTER the House is created.
/// Leaves the scenario in a fresh tx owned by `admin`.
public fun bootstrap_world(sc: &mut Scenario, admin: address) {
    // Publish-time initializers for the three world modules we depend on.
    test_scenario::next_tx(sc, admin);
    {
        let ctx = test_scenario::ctx(sc);
        world::init_for_testing(ctx);
        access::init_for_testing(ctx);
        object_registry::init_for_testing(ctx);
    };

    // Authorize `admin` as a sponsor so `create_character` ->
    // `create_owner_cap_by_id` -> `verify_sponsor` passes.
    test_scenario::next_tx(sc, admin);
    {
        let mut acl = test_scenario::take_shared<AdminACL>(sc);
        let gov_cap = test_scenario::take_from_sender<GovernorCap>(sc);
        access::add_sponsor_to_acl(&mut acl, &gov_cap, admin);
        test_scenario::return_shared(acl);
        test_scenario::return_to_sender(sc, gov_cap);
    };
}

/// Mint a `Character` whose `character_address` is `player`, so that
/// `house::assert_character` passes when the tx sender is `player`.
///
/// `game_id` must be unique within a scenario (the registry rejects duplicate
/// (game_id, tenant) keys with ECharacterAlreadyExists). Use 1, 2, 3, ... when a
/// test needs several characters.
///
/// MUST be called after `bootstrap_world`. Runs in a tx sent by the ACL sponsor
/// (`admin` from bootstrap) because minting requires sponsor authorization; the
/// resulting Character is nonetheless bound to `player`. Callers then
/// `test_scenario::next_tx(sc, player)` before invoking `play`.
public fun mint_character(
    sc: &mut Scenario,
    admin: address,
    player: address,
    game_id: u32,
): Character {
    test_scenario::next_tx(sc, admin);
    let mut registry = test_scenario::take_shared<ObjectRegistry>(sc);
    let acl = test_scenario::take_shared<AdminACL>(sc);
    let ctx = test_scenario::ctx(sc);
    let character = character::create_character(
        &mut registry,
        &acl,
        game_id,
        TEST_TENANT.to_string(),
        TEST_TRIBE_ID,
        player,
        b"test_player".to_string(),
        ctx,
    );
    test_scenario::return_shared(registry);
    test_scenario::return_shared(acl);
    character
}

/// Convenience: `bootstrap_world` + mint one Character for `player` with
/// `game_id = 1`. Covers the common single-player game test.
public fun bootstrap_with_character(
    sc: &mut Scenario,
    admin: address,
    player: address,
): Character {
    bootstrap_world(sc, admin);
    mint_character(sc, admin, player, 1)
}

/// Dispose of a test Character.
///
/// `Character` has `key` but no `drop`, so it cannot simply go out of scope — it
/// must be explicitly consumed or the test will not compile. The world package's
/// only disposal path is `delete_character`, which requires the shared `AdminACL`
/// and sponsor authorization, hence the scenario + admin arguments.
///
/// Runs in a tx sent by `admin` (the ACL sponsor established by
/// `bootstrap_world`).
public fun destroy_character(sc: &mut Scenario, admin: address, character: Character) {
    test_scenario::next_tx(sc, admin);
    let acl = test_scenario::take_shared<AdminACL>(sc);
    let ctx = test_scenario::ctx(sc);
    character::delete_character(character, &acl, ctx);
    test_scenario::return_shared(acl);
}
