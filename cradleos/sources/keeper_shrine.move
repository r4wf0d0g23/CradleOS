/// CradleOS – Keeper Shrine (compatible with on-chain v2 deploy)
///
/// Shared donation pool. Players deposit Coin<T> as tribute to the Keeper.
module cradleos::keeper_shrine {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use std::string::{Self, String};

    const ENotAdmin:            u64 = 0;
    const EZeroAmount:          u64 = 1;
    const EInsufficientBalance: u64 = 2;

    // ── Structs (MUST match on-chain layout exactly) ──────────────────────────

    public struct KeeperShrine<phantom T> has key {
        id: UID,
        admin: address,
        name: String,
        offerings: Balance<T>,
        total_offered: u64,
        total_withdrawn: u64,
        offering_count: u64,
    }

    public struct ShrineCreated has copy, drop {
        shrine_id: ID,
        admin: address,
        name: String,
    }

    public struct OfferingMade has copy, drop {
        shrine_id: ID,
        pilgrim: address,
        amount: u64,
        new_balance: u64,
        offering_number: u64,
    }

    public struct ShrineWithdrawn has copy, drop {
        shrine_id: ID,
        admin: address,
        amount: u64,
        remaining_balance: u64,
    }

    public struct AdminTransferred has copy, drop {
        shrine_id: ID,
        old_admin: address,
        new_admin: address,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    entry fun create_shrine<T>(name_bytes: vector<u8>, ctx: &mut TxContext) {
        let admin = ctx.sender();
        let uid = object::new(ctx);
        let shrine_id = object::uid_to_inner(&uid);
        let name = string::utf8(name_bytes);

        event::emit(ShrineCreated { shrine_id, admin, name });

        transfer::share_object(KeeperShrine<T> {
            id: uid,
            admin,
            name,
            offerings: balance::zero(),
            total_offered: 0,
            total_withdrawn: 0,
            offering_count: 0,
        });
    }

    entry fun make_offering<T>(
        shrine: &mut KeeperShrine<T>,
        coin: Coin<T>,
        _ctx: &mut TxContext,
    ) {
        let amount = coin.value();
        assert!(amount > 0, EZeroAmount);
        let pilgrim = _ctx.sender();

        balance::join(&mut shrine.offerings, coin.into_balance());
        shrine.total_offered = shrine.total_offered + amount;
        shrine.offering_count = shrine.offering_count + 1;

        event::emit(OfferingMade {
            shrine_id: object::uid_to_inner(&shrine.id),
            pilgrim,
            amount,
            new_balance: balance::value(&shrine.offerings),
            offering_number: shrine.offering_count,
        });
    }

    entry fun withdraw<T>(
        shrine: &mut KeeperShrine<T>,
        amount: u64,
        _ctx: &mut TxContext,
    ) {
        assert!(_ctx.sender() == shrine.admin, ENotAdmin);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&shrine.offerings) >= amount, EInsufficientBalance);

        shrine.total_withdrawn = shrine.total_withdrawn + amount;
        let payout = coin::from_balance(balance::split(&mut shrine.offerings, amount), _ctx);
        transfer::public_transfer(payout, shrine.admin);

        event::emit(ShrineWithdrawn {
            shrine_id: object::uid_to_inner(&shrine.id),
            admin: shrine.admin,
            amount,
            remaining_balance: balance::value(&shrine.offerings),
        });
    }

    entry fun withdraw_all<T>(
        shrine: &mut KeeperShrine<T>,
        _ctx: &mut TxContext,
    ) {
        let amount = balance::value(&shrine.offerings);
        assert!(_ctx.sender() == shrine.admin, ENotAdmin);
        assert!(amount > 0, EZeroAmount);

        shrine.total_withdrawn = shrine.total_withdrawn + amount;
        let payout = coin::from_balance(balance::split(&mut shrine.offerings, amount), _ctx);
        transfer::public_transfer(payout, shrine.admin);

        event::emit(ShrineWithdrawn {
            shrine_id: object::uid_to_inner(&shrine.id),
            admin: shrine.admin,
            amount,
            remaining_balance: 0,
        });
    }

    entry fun transfer_admin<T>(
        shrine: &mut KeeperShrine<T>,
        new_admin: address,
        _ctx: &mut TxContext,
    ) {
        assert!(_ctx.sender() == shrine.admin, ENotAdmin);
        let old_admin = shrine.admin;
        shrine.admin = new_admin;

        event::emit(AdminTransferred {
            shrine_id: object::uid_to_inner(&shrine.id),
            old_admin,
            new_admin,
        });
    }

    // ── Public reads (MUST exist — part of on-chain interface) ────────────────

    public fun admin<T>(shrine: &KeeperShrine<T>): address { shrine.admin }
    public fun name<T>(shrine: &KeeperShrine<T>): &String { &shrine.name }
    public fun balance<T>(shrine: &KeeperShrine<T>): u64 { balance::value(&shrine.offerings) }
    public fun total_offered<T>(shrine: &KeeperShrine<T>): u64 { shrine.total_offered }
    public fun total_withdrawn<T>(shrine: &KeeperShrine<T>): u64 { shrine.total_withdrawn }
    public fun offering_count<T>(shrine: &KeeperShrine<T>): u64 { shrine.offering_count }
}
