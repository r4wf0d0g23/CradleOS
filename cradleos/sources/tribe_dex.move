/// CradleOS – TribeDex v3
/// Order book for trading tribe coin (accounting balance) against CradleCoin (CRDL).
/// Sell orders escrow tribe coin from the seller's vault balance.
/// Buyers fill orders with real Coin<CRADLE_COIN>; CRDL goes to the seller's wallet.
module cradleos::tribe_dex {
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use cradleos::cradle_coin::CRADLE_COIN;
    use cradleos::tribe_vault::{Self, TribeVault};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotSeller:           u64 = 0;
    const EOrderNotFound:       u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const EZeroAmount:          u64 = 3;
    const EOrderFullyFilled:    u64 = 4;
    const EWrongVault:          u64 = 5;
    const EFillExceedsOrder:    u64 = 6;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct TribeDex has key {
        id: UID,
        vault_id: ID,
        sell_orders: Table<u64, SellOrder>,
        next_order_id: u64,
        /// Last fill price in CRDL per 1 tribe coin unit.
        last_price_crdl: u64,
        total_volume_tribe: u64,
        total_volume_crdl: u64,
    }

    /// An open sell order. Tribe coins are escrowed from seller's vault balance.
    public struct SellOrder has store, drop {
        id: u64,
        seller: address,
        raw_amount: u64,
        raw_remaining: u64,
        /// Price in CRDL per 1 tribe coin unit.
        price_crdl_per_raw: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct DexCreated has copy, drop {
        dex_id: ID,
        vault_id: ID,
        creator: address,
    }

    public struct OrderPosted has copy, drop {
        dex_id: ID,
        order_id: u64,
        seller: address,
        raw_amount: u64,
        price_crdl_per_raw: u64,
    }

    public struct OrderFilled has copy, drop {
        dex_id: ID,
        order_id: u64,
        buyer: address,
        seller: address,
        fill_amount: u64,
        price_crdl_per_raw: u64,
        crdl_paid: u64,
        raw_remaining: u64,
    }

    public struct OrderCancelled has copy, drop {
        dex_id: ID,
        order_id: u64,
        seller: address,
        raw_refunded: u64,
    }

    // ── Constructors ──────────────────────────────────────────────────────────

    public fun create_dex(vault: &TribeVault, ctx: &mut TxContext): TribeDex {
        let creator  = ctx.sender();
        let vault_id = object::id(vault);
        let dex_uid  = object::new(ctx);
        let dex_id   = object::uid_to_inner(&dex_uid);
        event::emit(DexCreated { dex_id, vault_id, creator });
        TribeDex {
            id: dex_uid,
            vault_id,
            sell_orders: table::new(ctx),
            next_order_id: 0,
            last_price_crdl: 0,
            total_volume_tribe: 0,
            total_volume_crdl: 0,
        }
    }

    entry fun create_dex_entry(vault: &TribeVault, ctx: &mut TxContext) {
        transfer::share_object(create_dex(vault, ctx));
    }

    // ── Order management ──────────────────────────────────────────────────────

    /// Post a sell order. Debits tribe coins from seller's vault balance (escrowed).
    entry fun post_sell_order_entry(
        dex: &mut TribeDex,
        vault: &mut TribeVault,
        amount: u64,
        price_crdl_per_raw: u64,
        ctx: &mut TxContext,
    ) {
        let seller = ctx.sender();
        assert!(amount > 0, EZeroAmount);
        assert!(price_crdl_per_raw > 0, EZeroAmount);
        assert!(object::id(vault) == dex.vault_id, EWrongVault);
        tribe_vault::debit_balance_internal(vault, seller, amount);
        let order_id = dex.next_order_id;
        dex.next_order_id = order_id + 1;
        table::add(&mut dex.sell_orders, order_id, SellOrder {
            id: order_id,
            seller,
            raw_amount: amount,
            raw_remaining: amount,
            price_crdl_per_raw,
        });
        event::emit(OrderPosted { dex_id: object::id(dex), order_id, seller, raw_amount: amount, price_crdl_per_raw });
    }

    /// Fill a sell order with CRDL. Tribe coins credited to buyer's vault balance.
    /// CRDL goes directly to the seller's wallet.
    entry fun fill_sell_order_entry(
        dex: &mut TribeDex,
        vault: &mut TribeVault,
        order_id: u64,
        mut payment: Coin<CRADLE_COIN>,
        fill_amount: u64,
        ctx: &mut TxContext,
    ) {
        let buyer = ctx.sender();
        assert!(fill_amount > 0, EZeroAmount);
        assert!(object::id(vault) == dex.vault_id, EWrongVault);
        assert!(table::contains(&dex.sell_orders, order_id), EOrderNotFound);
        let order = table::borrow_mut(&mut dex.sell_orders, order_id);
        assert!(order.raw_remaining > 0, EOrderFullyFilled);
        assert!(fill_amount <= order.raw_remaining, EFillExceedsOrder);
        let cost_crdl = fill_amount * order.price_crdl_per_raw;
        assert!(coin::value(&payment) >= cost_crdl, EInsufficientPayment);
        let seller = order.seller;
        let price  = order.price_crdl_per_raw;
        order.raw_remaining = order.raw_remaining - fill_amount;
        let remaining = order.raw_remaining;
        // CRDL to seller
        let exact = coin::split(&mut payment, cost_crdl, ctx);
        transfer::public_transfer(exact, seller);
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };
        // Tribe coins to buyer's vault balance
        tribe_vault::credit_balance_internal(vault, buyer, fill_amount);
        dex.last_price_crdl   = price;
        dex.total_volume_tribe = dex.total_volume_tribe + fill_amount;
        dex.total_volume_crdl  = dex.total_volume_crdl + cost_crdl;
        event::emit(OrderFilled {
            dex_id: object::id(dex), order_id, buyer, seller, fill_amount,
            price_crdl_per_raw: price, crdl_paid: cost_crdl, raw_remaining: remaining,
        });
        if (remaining == 0) { table::remove(&mut dex.sell_orders, order_id); };
    }

    /// Cancel a sell order. Refunds tribe coins to seller's vault balance.
    entry fun cancel_sell_order_entry(
        dex: &mut TribeDex,
        vault: &mut TribeVault,
        order_id: u64,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(object::id(vault) == dex.vault_id, EWrongVault);
        assert!(table::contains(&dex.sell_orders, order_id), EOrderNotFound);
        let order = table::borrow(&dex.sell_orders, order_id);
        assert!(order.seller == sender, ENotSeller);
        let refund = order.raw_remaining;
        let seller = order.seller;
        table::remove(&mut dex.sell_orders, order_id);
        tribe_vault::credit_balance_internal(vault, seller, refund);
        event::emit(OrderCancelled { dex_id: object::id(dex), order_id, seller, raw_refunded: refund });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(dex: &TribeDex): ID               { dex.vault_id }
    public fun last_price_crdl(dex: &TribeDex): u64       { dex.last_price_crdl }
    public fun total_volume_tribe(dex: &TribeDex): u64    { dex.total_volume_tribe }
    public fun total_volume_crdl(dex: &TribeDex): u64     { dex.total_volume_crdl }
    public fun next_order_id(dex: &TribeDex): u64         { dex.next_order_id }
    public fun order_exists(dex: &TribeDex, id: u64): bool { table::contains(&dex.sell_orders, id) }
    public fun order_remaining(dex: &TribeDex, id: u64): u64 { table::borrow(&dex.sell_orders, id).raw_remaining }
    public fun order_price(dex: &TribeDex, id: u64): u64 { table::borrow(&dex.sell_orders, id).price_crdl_per_raw }
    public fun order_seller(dex: &TribeDex, id: u64): address { table::borrow(&dex.sell_orders, id).seller }
}
