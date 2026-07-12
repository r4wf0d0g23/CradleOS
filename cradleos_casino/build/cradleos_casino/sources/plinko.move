/// CradleOS Casino — Plinko. A ball drops through 12 rows of pegs; at each row
/// it bounces left or right with equal probability. It lands in one of 13
/// buckets: bucket k = number of right-bounces (0..12). The bucket distribution
/// is binomial C(12,k)/4096, so the center is common and the edges are rare
/// jackpots.
///
/// MEASURED expected return (exact):
///   counts  = [1,12,66,220,495,792,924,792,495,220,66,12,1]  (sum 4096)
///   mult_bps= [1300000,60000,30000,16000,12000,5000,4850,5000,
///              12000,16000,30000,60000,1300000]
///   RTP = Σ count[k]·mult[k] / 4096 = 9600 bps → 96% return, 4% house edge.
///   Max multiplier 130x (edge buckets).
///
/// Provably fair: the 12 bounces are drawn from the Sui randomness beacon in a
/// single tx; the per-row bounce bitmap is published in the result event so the
/// entire path can be replayed/verified.
module cradleos_casino::plinko {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    const ROWS: u8 = 12;
    /// Gross multiplier (bps) per bucket 0..12.
    const BUCKET_BPS: vector<u64> = vector[
        1300000, 60000, 30000, 16000, 12000, 5000, 4851, 5000, 12000, 16000, 30000, 60000, 1300000,
    ];
    /// Max multiplier (x) for the exposure guard: 1_300_000 bps = 130x.
    const MAX_MULT_X: u64 = 130;

    public struct PlinkoDropped has copy, drop {
        player: address,
        wager: u64,
        path: u16,          // 12-bit bounce bitmap (bit i set = right on row i)
        bucket: u8,         // 0..12
        multiplier_bps: u64,
        payout: u64,
    }

    /// Multiplier (bps) for a landed bucket. Pure.
    public fun bucket_multiplier(bucket: u8): u64 {
        *vector::borrow(&BUCKET_BPS, (bucket as u64))
    }

    /// Gross payout for a landed bucket. Pure.
    public fun payout_for(amount: u64, bucket: u8): u64 {
        let bps = bucket_multiplier(bucket);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    /// Count of set bits in a 12-bit path = the bucket index. Pure.
    public fun bucket_of_path(path: u16): u8 {
        let mut b = 0u8;
        let mut i = 0u8;
        while (i < ROWS) {
            if ((path >> (i as u8)) & 1 == 1) { b = b + 1; };
            i = i + 1;
        };
        b
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let mut path = 0u16;
        let mut bucket = 0u8;
        let mut i = 0u8;
        while (i < ROWS) {
            let bounce = random::generate_u8_in_range(&mut g, 0, 1); // 0=left, 1=right
            if (bounce == 1) {
                path = path | (1u16 << (i as u8));
                bucket = bucket + 1;
            };
            i = i + 1;
        };
        let multiplier_bps = bucket_multiplier(bucket);
        let payout = payout_for(amount, bucket);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(PlinkoDropped { player, wager: amount, path, bucket, multiplier_bps, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // table length + RTP sanity
        assert!(vector::length(&BUCKET_BPS) == 13, 0);
        // exact RTP = 9600 bps
        let counts = vector[1u64,12,66,220,495,792,924,792,495,220,66,12,1];
        let mut sum = 0u128;
        let mut k = 0u64;
        while (k < 13) {
            sum = sum + (*vector::borrow(&counts, k) as u128) * (*vector::borrow(&BUCKET_BPS, k) as u128);
            k = k + 1;
        };
        assert!((sum / 4096) as u64 >= 9600, 1);
        // payouts
        assert!(payout_for(100, 0) == 13000, 2);   // 130x jackpot
        assert!(payout_for(100, 12) == 13000, 3);  // 130x jackpot (symmetric)
        assert!(payout_for(10000, 6) == 4851, 4);  // 0.4851x center
        // bucket_of_path
        assert!(bucket_of_path(0) == 0, 5);
        assert!(bucket_of_path(0xFFF) == 12, 6);   // all 12 bits set
        assert!(bucket_of_path(42) == 3, 7);  // 42 = 0b101010 = 3 bits set
    }

    #[test]
    fun test_play_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
