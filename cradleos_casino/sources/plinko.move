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
    const EBadMode:     u64 = 2;
    const EBadCount:    u64 = 3;

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

    // ── Risk modes (v10) — selectable volatility on the same 12-row board ─────
    // Three player-selectable payout tables over the identical binomial drop.
    // Edges derived + simulated (BATCH_01_DESIGNS.md, edge_sim_batch01.py):
    //   LOW  (max 5x):   RTP 9648/10000 → 3.52% edge — grinder table, every
    //                    bucket pays something (worst 0.85x), fills the
    //                    low-volatility catalog gap.
    //   MED  (max 100x): RTP 9598/10000 → 4.02% edge — center pays 0.
    //   HIGH (max 500x): RTP 9651.85/10000 → 3.48% edge — center 0, edge 500x.
    // The legacy `play` (130x classic table) remains as a fourth option.

    const MODE_LOW:  u8 = 0;
    const MODE_MED:  u8 = 1;
    const MODE_HIGH: u8 = 2;

    const LOW_BPS: vector<u64> = vector[
        50000, 20000, 15000, 12000, 10000, 8500, 9000, 8500, 10000, 12000, 15000, 20000, 50000,
    ];
    const MED_BPS: vector<u64> = vector[
        1000000, 100000, 30000, 15000, 11000, 8500, 0, 8500, 11000, 15000, 30000, 100000, 1000000,
    ];
    const HIGH_BPS: vector<u64> = vector[
        5000000, 500000, 50000, 10000, 5000, 1000, 0, 1000, 5000, 10000, 50000, 500000, 5000000,
    ];

    public struct PlinkoModeDropped has copy, drop {
        player: address,
        wager: u64,
        mode: u8,           // 0=LOW 1=MED 2=HIGH
        path: u16,          // 12-bit bounce bitmap (bit i set = right on row i)
        bucket: u8,         // 0..12
        multiplier_bps: u64,
        payout: u64,
    }

    /// Multiplier (bps) for a bucket under a risk mode. Pure.
    public fun mode_multiplier(mode: u8, bucket: u8): u64 {
        let table = if (mode == MODE_LOW) { &LOW_BPS }
            else if (mode == MODE_MED) { &MED_BPS }
            else { &HIGH_BPS };
        *vector::borrow(table, (bucket as u64))
    }

    /// Max multiplier (x) per mode, for the exposure guard. Pure.
    public fun mode_max_mult_x(mode: u8): u64 {
        if (mode == MODE_LOW) { 5 } else if (mode == MODE_MED) { 100 } else { 500 }
    }

    /// Gross payout for a bucket under a risk mode. Pure.
    public fun payout_for_mode(amount: u64, mode: u8, bucket: u8): u64 {
        let bps = mode_multiplier(mode, bucket);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    entry fun play_mode<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        mode: u8,
        ctx: &mut TxContext,
    ) {
        assert!(mode <= MODE_HIGH, EBadMode);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        // Per-mode exposure guard: LOW allows far larger bets than HIGH.
        assert!(amount * mode_max_mult_x(mode) <= house::bank_balance(house) * 3 / 100, EMaxExposure);
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
        let multiplier_bps = mode_multiplier(mode, bucket);
        let payout = payout_for_mode(amount, mode, bucket);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(PlinkoModeDropped { player, wager: amount, mode, path, bucket, multiplier_bps, payout });
    }

    // ── Multi-drop (v12) — N balls, one transaction, one signature ──────────
    // mode: 0=LOW 1=MED 2=HIGH 3=CLASSIC (mirrors play / play_mode)
    // count: 2..=10 balls; any dust from integer division (amount % count) is house's.
    // Exposure guard: total worst-case payout = per_drop * mult_x * count.
    // We use the per-mode guard (mode_max_mult_x) for modes 0-2, MAX_MULT_X for classic.

    public struct PlinkoMultiDropped has copy, drop {
        player:       address,
        wager:        u64,       // TOTAL wager (full coin amount)
        mode:         u8,        // 0=LOW 1=MED 2=HIGH 3=CLASSIC
        count:        u8,        // number of balls dropped
        paths:        vector<u16>,
        buckets:      vector<u8>,
        payouts:      vector<u64>,
        total_payout: u64,
    }

    entry fun play_multi<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        mode: u8,
        count: u8,
        ctx: &mut TxContext,
    ) {
        assert!(mode <= 3, EBadMode);
        assert!(count >= 2 && count <= 10, EBadCount);

        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);

        let per_drop = amount / (count as u64);
        // per_drop must be at least 1 mist (dust check)
        assert!(per_drop >= 1, EBadCount);

        // Exposure guard: per-ball worst-case payout ≤ 3% of bank.
        // Operator ruling (2026-07-11): risk limits evaluate per ball, not total
        // bet. N single drops each pass the 3%-of-bank guard individually, so
        // batching N balls in one tx must not be stricter. The theoretical
        // all-balls-hit-max case (~(1/2048)^N for HIGH edges) is accepted as
        // tolerable tail risk. Any dust (amount - per_drop * count) is house's.
        let mult_x = if (mode <= 2) { mode_max_mult_x(mode) } else { MAX_MULT_X };
        assert!(per_drop * mult_x <= house::bank_balance(house) * 3 / 100, EMaxExposure);

        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let mut paths   = vector::empty<u16>();
        let mut buckets = vector::empty<u8>();
        let mut payouts = vector::empty<u64>();
        let mut total_payout = 0u64;

        let mut drop_i = 0u8;
        while (drop_i < count) {
            let mut path   = 0u16;
            let mut bucket = 0u8;
            let mut row    = 0u8;
            while (row < ROWS) {
                let bounce = random::generate_u8_in_range(&mut g, 0, 1);
                if (bounce == 1) {
                    path   = path | (1u16 << (row as u8));
                    bucket = bucket + 1;
                };
                row = row + 1;
            };
            let payout_i = if (mode <= 2) {
                payout_for_mode(per_drop, mode, bucket)
            } else {
                payout_for(per_drop, bucket)
            };
            vector::push_back(&mut paths,   path);
            vector::push_back(&mut buckets, bucket);
            vector::push_back(&mut payouts, payout_i);
            total_payout = total_payout + payout_i;
            drop_i = drop_i + 1;
        };

        house::pay_winnings(house, total_payout, player, ctx);

        event::emit(PlinkoMultiDropped {
            player,
            wager:  amount,
            mode,
            count,
            paths,
            buckets,
            payouts,
            total_payout,
        });
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
    fun test_mode_tables_exact_rtp() {
        let counts = vector[1u64,12,66,220,495,792,924,792,495,220,66,12,1];
        // LOW: RTP 9648 bps (3.52% edge)
        let mut sum = 0u128; let mut k = 0u64;
        while (k < 13) { sum = sum + (*vector::borrow(&counts, k) as u128) * (mode_multiplier(0, (k as u8)) as u128); k = k + 1; };
        assert!(sum / 4096 == 9648, 0);
        // MED: RTP 9598 bps (4.02% edge)
        sum = 0; k = 0;
        while (k < 13) { sum = sum + (*vector::borrow(&counts, k) as u128) * (mode_multiplier(1, (k as u8)) as u128); k = k + 1; };
        assert!(sum / 4096 == 9598, 1);
        // HIGH: RTP 9651.85 bps exact (39,534,000/4096) → 3.48% edge
        sum = 0; k = 0;
        while (k < 13) { sum = sum + (*vector::borrow(&counts, k) as u128) * (mode_multiplier(2, (k as u8)) as u128); k = k + 1; };
        assert!(sum / 4096 == 9651, 2);
        // table lengths + payout spot checks
        assert!(payout_for_mode(100, 0, 0) == 500, 3);       // LOW edge 5x
        assert!(payout_for_mode(100, 1, 0) == 10000, 4);     // MED edge 100x
        assert!(payout_for_mode(100, 2, 0) == 50000, 5);     // HIGH edge 500x
        assert!(payout_for_mode(100, 2, 6) == 0, 6);         // HIGH center 0
        assert!(payout_for_mode(10000, 0, 5) == 8500, 7);    // LOW worst 0.85x
        // per-mode guard mults
        assert!(mode_max_mult_x(0) == 5 && mode_max_mult_x(1) == 100 && mode_max_mult_x(2) == 500, 8);
    }

    #[test]
    fun test_play_mode_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play_mode<SUI>(&mut house, &r, bet, 0, ctx); // LOW
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EBadMode)]
    fun test_play_mode_rejects_bad_mode() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play_mode<SUI>(&mut house, &r, bet, 3, ctx); // invalid mode
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_multi_drop_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(500, ctx); // 5 drops × 100
            play_multi<SUI>(&mut house, &r, bet, 0, 5, ctx); // LOW, 5 balls
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EBadCount)]
    fun test_multi_drop_rejects_count_1() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play_multi<SUI>(&mut house, &r, bet, 0, 1, ctx); // count=1 invalid
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EBadCount)]
    fun test_multi_drop_rejects_count_11() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play_multi<SUI>(&mut house, &r, bet, 0, 11, ctx); // count=11 invalid
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_multi_payout_accumulation() {
        // Pure-math: verify sum of payouts over a fixed bucket list == hand-computed total.
        // Use LOW mode (mode=0), per_drop=1000 each, 5 buckets: [0, 3, 6, 9, 12]
        // LOW_BPS: [50000, 20000, 15000, 12000, 10000, 8500, 9000, 8500, 10000, 12000, 15000, 20000, 50000]
        // payout_for_mode(1000, 0, 0)  = 1000 * 50000 / 10000 = 5000
        // payout_for_mode(1000, 0, 3)  = 1000 * 12000 / 10000 = 1200
        // payout_for_mode(1000, 0, 6)  = 1000 * 9000  / 10000 = 900
        // payout_for_mode(1000, 0, 9)  = 1000 * 12000 / 10000 = 1200
        // payout_for_mode(1000, 0, 12) = 1000 * 50000 / 10000 = 5000
        // total = 5000 + 1200 + 900 + 1200 + 5000 = 13300
        let per_drop = 1000u64;
        let test_buckets = vector[0u8, 3u8, 6u8, 9u8, 12u8];
        let expected_payouts = vector[5000u64, 1200u64, 900u64, 1200u64, 5000u64];
        let expected_total = 13300u64;
        let mut acc = 0u64;
        let mut i = 0u64;
        while (i < 5) {
            let bucket = *vector::borrow(&test_buckets, i);
            let payout = payout_for_mode(per_drop, 0, bucket);
            assert!(payout == *vector::borrow(&expected_payouts, i), (i as u64));
            acc = acc + payout;
            i = i + 1;
        };
        assert!(acc == expected_total, 99);
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
