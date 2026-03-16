/// CradleOS – CradleCoin (CRDL)
/// Protocol-wide backbone currency backed by registered EVE Frontier infrastructure.
/// Supply grows when any tribe registers structures; burns when deregistered.
/// Real Sui Coin<CRDL> — visible in EVE Vault wallet.
module cradleos::cradle_coin {
    use sui::coin::{Self, TreasuryCap, Coin};

    /// One-time witness for CRDL currency creation.
    public struct CRADLE_COIN has drop {}

    /// Shared minting authority. All TribeVaults call through this.
    public struct CradleMintController has key {
        id: UID,
        treasury: TreasuryCap<CRADLE_COIN>,
    }

    fun init(witness: CRADLE_COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            0, // whole units only
            b"CRDL",
            b"CradleCoin",
            b"Protocol backbone for CradleOS. Backed by registered EVE Frontier infrastructure. Earn CRDL by registering structures; spend it to acquire tribe influence.",
            option::none(),
            ctx,
        );
        transfer::share_object(CradleMintController { id: object::new(ctx), treasury });
        transfer::public_share_object(metadata);
    }

    /// Mint CRDL — only callable within the cradleos package.
    public(package) fun mint(
        ctrl: &mut CradleMintController,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<CRADLE_COIN> {
        coin::mint(&mut ctrl.treasury, amount, ctx)
    }

    /// Burn CRDL — only callable within the cradleos package.
    public(package) fun burn(
        ctrl: &mut CradleMintController,
        coin: Coin<CRADLE_COIN>,
    ): u64 {
        coin::burn(&mut ctrl.treasury, coin)
    }

    /// Protocol-wide total supply.
    public fun total_supply(ctrl: &CradleMintController): u64 {
        coin::total_supply(&ctrl.treasury)
    }
}
