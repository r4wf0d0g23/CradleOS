/// CradleOS Voting — Asset-balance-weighted vote.
///
/// Weight is derived from the voter's Coin<T> balance at proof-mint time.
/// The coin is borrowed by reference — NEVER consumed, transferred, or modified.
/// Voting with this module does not require locking or burning any assets.
///
/// Two formula modes:
///   0 = BALANCE_DIV:    weight = min(balance / divisor, cap)  [cap=0 means no cap]
///   1 = SQRT_BALANCE:   weight = min(floor(sqrt(balance)), cap)
///
/// BALANCE_DIV is linear (pro-whale unless capped). SQRT_BALANCE compresses the
/// dynamic range and is recommended for elections aiming at fair representation.
///
/// weight_params layout:
///   [0]      mode:    u8  (0=BALANCE_DIV, 1=SQRT_BALANCE)
///   [1..9]   divisor: u64 LE (BALANCE_DIV only; 0 treated as 1)
///   [9..17]  cap:     u64 LE (both modes; 0=no cap)
///
/// Built-in shortcuts:
///   - Tribe coin: no special handling needed. Pass Coin<TribeCoin> to prove_asset<TribeCoin>.
///   - EVE Frontier coin: see EVE_COIN_TYPE_TODO comment below. Use prove_asset<EveCoin>
///     once the canonical type is known.
///
/// Security model:
///   - Coin<T> is passed as &Coin<T>. coin::value() reads the balance atomically.
///     The underlying value cannot change during proof minting.
///   - inputs_hash binds: KIND + params + coin_type_name + balance_at_mint.
///     Off-chain verifier: look up the coin balance at the proof-mint block and
///     re-derive weight. The type name (e.g. "0x2::sui::SUI") is captured for
///     disambiguation when multiple coin types are used in the same election.
///   - Snapshot risk: voter could split coins BEFORE minting and merge AFTER.
///     For high-stakes elections, pair with an eligibility provider that anchors
///     to a balance snapshot at scheduled_open_ms (future work).
///   - Sybil concern: any Coin<T>-weighted election is susceptible to Sybil via
///     coin splitting across characters. Recommended: pair with
///     eligibility_tribe_cradleos (unique per tribe member) + min_epochs age check.
///
/// TODO (EVE Frontier coin): The canonical EVE Frontier Coin<T> package address
///   and type path are unknown at time of writing. When CCP publishes the EVE coin
///   package on Sui testnet/mainnet, add:
///     const EVE_COIN_TYPE: vector<u8> = b"<pkg>::<module>::<CoinType>";
///   and a dedicated shortcut entry:
///     public fun prove_eve_balance(election, coin: &Coin<EveCoin>, character_id, ctx)
///   where EveCoin is the published type. No other code changes needed — the generic
///   prove_asset<T> already handles it; the shortcut is ergonomic only.
module cradleos_voting::weight_asset {
    use sui::hash;
    use sui::coin::{Self, Coin};
    use std::type_name;
    use std::ascii;
    use cradleos_voting::voting::{Self, Election, WeightProof};

    const KIND_ASSET: u8 = 3;

    // Formula mode constants
    const MODE_BALANCE_DIV:  u8 = 0;
    const MODE_SQRT_BALANCE: u8 = 1;

    // Error codes
    const E_BAD_PARAMS:   u64 = 0;
    const E_INVALID_MODE: u64 = 1;

    // weight_params layout:
    //   [0]      mode:    u8  (0=BALANCE_DIV, 1=SQRT_BALANCE)
    //   [1..9]   divisor: u64 LE
    //   [9..17]  cap:     u64 LE (0=no cap)

    /// Core mint logic, generic over coin type T.
    /// Reads Coin<T>.value by reference — coin is NOT consumed or modified.
    public fun mint<T>(
        election: &Election,
        coin: &Coin<T>,
        character_id: u32,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 17, E_BAD_PARAMS);

        let mode    = *vector::borrow(params, 0);
        let divisor = decode_u64_at(params, 1);
        let cap     = decode_u64_at(params, 9);

        // Read balance by reference only — no ownership transfer
        let balance = coin::value(coin);
        let weight  = compute_weight(mode, balance, divisor, cap);

        // Encode coin type for inputs_hash: disambiguates multi-asset elections
        // and ensures off-chain verifiers know which coin was snapshotted.
        // type_name::get<T>() returns the full Move type path, e.g.
        //   "0000...0002::sui::SUI" or "a1b2...::tribe_coin::TRIBE"
        let tn = type_name::get<T>();
        let type_bytes: &vector<u8> = ascii::as_bytes(type_name::borrow_string(&tn));

        // inputs_hash: KIND + params + balance_at_mint + type_name_bytes
        let mut hbuf = vector[];
        vector::push_back(&mut hbuf, KIND_ASSET);
        vector::append(&mut hbuf, *params);
        append_u64_le(&mut hbuf, balance);
        vector::append(&mut hbuf, *type_bytes);
        let inputs_hash = hash::keccak256(&hbuf);

        voting::mint_weight_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_ASSET,
            @cradleos_voting,
            weight,
            inputs_hash,
            ctx,
        )
    }

    fun compute_weight(mode: u8, balance: u64, divisor: u64, cap: u64): u64 {
        let d = if (divisor == 0) { 1 } else { divisor };
        let raw = if (mode == MODE_BALANCE_DIV) {
            balance / d
        } else if (mode == MODE_SQRT_BALANCE) {
            // Precision note: floor(sqrt(balance)).
            // Example: balance=1_000_000 tokens → weight=1000.
            // Compresses whale advantage: 100x coin → 10x vote weight.
            isqrt(balance)
        } else {
            abort E_INVALID_MODE
        };
        // Apply cap (both modes): if cap=0, no cap is applied
        if (cap > 0 && raw > cap) { cap } else { raw }
    }

    /// Integer square root (floor) via Newton's method.
    /// Precision: exact floor(sqrt(n)) for all u64 n.
    /// Convergence: O(log log n) iterations.
    fun isqrt(n: u64): u64 {
        if (n == 0) return 0;
        let mut x = n;
        let mut y = (n + 1) / 2;
        while (y < x) {
            x = y;
            y = (x + n / x) / 2;
        };
        x
    }

    // Note: prove_asset removed. Use mint<T>() in a PTB and pass result to cast_ballot directly.

    // ── Encoding helpers ──────────────────────────────────────────────────────

    fun decode_u64_at(v: &vector<u8>, off: u64): u64 {
        let mut out: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            let b = (*vector::borrow(v, off + i)) as u64;
            out = out | (b << ((i * 8) as u8));
            i = i + 1;
        };
        out
    }

    fun append_u64_le(buf: &mut vector<u8>, v: u64) {
        let mut i: u64 = 0;
        while (i < 8) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xFF) as u8);
            i = i + 1;
        }
    }

    public fun kind(): u8 { KIND_ASSET }
}
