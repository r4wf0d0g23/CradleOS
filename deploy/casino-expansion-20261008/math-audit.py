"""Read-only independent source-math audit; no RPC or transactions.
Run from workspace: python3 research/cradleos-casino-expansion-20261008/review/math-audit.py
"""
from pathlib import Path
from fractions import Fraction as F
from math import comb, prod
from itertools import product, combinations
from collections import Counter, defaultdict
import json, re
ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'worktrees/cradleos-cycle7-20261002/cradleos_casino/sources'

def array(name, key):
    source = (SRC / (name + '.move')).read_text()
    body = re.search(r'const\s+' + key + r'\s*:\s*vector<u64>\s*=\s*vector\[([^\]]+)\]', source).group(1)
    body = re.sub(r'//[^\n]*', '', body)
    return [int(x.strip().replace('_', '')) for x in body.split(',') if x.strip()]

def weighted(values, weights=None):
    weights = weights or [1] * len(values)
    return float(F(sum(a*b for a,b in zip(values, weights)), sum(weights)*10000))

def baccarat_counts(fixed):
    # Uniform six-card prefixes. Unused cards are counted as arbitrary suffixes,
    # so every branch has the same exact denominator52P6.
    base = [16] + [4]*9
    out = [0, 0, 0]
    def add(p, b, weight):
        out[0 if p > b else 1 if b > p else 2] += weight
    def draws(b, third):
        if fixed and third == 255:
            return b <= 5
        return b <= 2 or b == 3 and third != 8 or b == 4 and 2 <= third <= 7 or b == 5 and 4 <= third <= 7 or b == 6 and third in (6, 7)
    for values in product(range(10), repeat=4):
        counts, weight = base.copy(), 1
        for value in values:
            weight *= counts[value]
            counts[value] -= 1
        if not weight:
            continue
        p, b = (values[0]+values[2]) % 10, (values[1]+values[3]) % 10
        if p >= 8 or b >= 8:
            add(p, b, weight*48*47)
        elif p <= 5:
            for t, n in enumerate(counts):
                if not n:
                    continue
                if draws(b, t):
                    counts[t] -= 1
                    for u, k in enumerate(counts):
                        if k:
                            add((p+t) % 10, (b+u) % 10, weight*n*k)
                    counts[t] += 1
                else:
                    add((p+t) % 10, b, weight*n*47)
        elif draws(b, 255):
            for u, k in enumerate(counts):
                if k:
                    add(p, (b+u) % 10, weight*k*47)
        else:
            add(p, b, weight*48*47)
    denominator = prod(range(47, 53))
    assert sum(out) == denominator
    probs = [F(n, denominator) for n in out]
    return dict(counts=out, denominator=denominator,
                probabilities=list(map(float, probs)),
                rtp=list(map(float, [2*probs[0]+probs[2], F(195,100)*probs[1]+probs[2], 9*probs[2]])))

def three_card():
    # Exact inclusion-exclusion over disjoint unordered three-card hands.
    def score(cards):
        ranks = sorted(c % 13 for c in cards)
        flush = len({c // 13 for c in cards}) == 1
        straight = ranks[1] == ranks[0]+1 and ranks[2] == ranks[1]+1 or ranks == [0,11,12]
        category = 5 if flush and straight else 4 if len(set(ranks)) == 1 else 3 if straight else 2 if flush else 1 if len(set(ranks)) == 2 else 0
        return category, max(13 if r == 0 else r for r in ranks)
    hands, total, one, two = [], Counter(), defaultdict(Counter), defaultdict(Counter)
    for cards in combinations(range(52), 3):
        s = score(cards)
        hands.append((cards, s))
        total[s] += 1
        for c in cards:
            one[c][s] += 1
        for pair in combinations(cards, 2):
            two[pair][s] += 1
    current = old = no_qual_wins = 0
    for cards, ps in hands:
        for ds, n in total.items():
            count = n-sum(one[c][ds] for c in cards)+sum(two[p][ds] for p in combinations(cards,2))-(1 if ds == ps else 0)
            if ps < ds:
                continue
            if ps == ds:
                pay = old_pay = 4
            elif ds[0] == 0 and ds[1] < 11:
                pay, old_pay = 7, 8
                no_qual_wins += count
            else:
                pay = old_pay = 4*{5:6,4:5,3:3}.get(ps[0],2)
            current += count*pay
            old += count*old_pay
    d = comb(52,3)*comb(49,3)
    return dict(disjoint_hand_pairs=d, current_rtp=float(F(current,4*d)), old_2x_rtp=float(F(old,4*d)),
                no_qual_win_probability=no_qual_wins/d,
                pair_twos_ace_beats_pair_kings_four=score([1,14,0]) > score([12,25,3]),
                wheel_ace23_beats_KQJ=score([0,14,28]) > score([12,24,36]))

result = {'baccarat_current': baccarat_counts(False), 'baccarat_fixed_single_deck': baccarat_counts(True), 'three_card_current_comparator': three_card()}
tables = {}
for name,key in [('wheel','SEGMENTS'),('money_wheel','SEGMENTS'),('risk_wheel','SEGMENTS_LOW'),('risk_wheel','SEGMENTS_MED'),('risk_wheel','SEGMENTS_HIGH')]:
    tables[name+':'+key] = weighted(array(name,key))
for key in ['BUCKET_BPS','LOW_BPS','MED_BPS','HIGH_BPS']:
    tables['plinko:'+key] = weighted(array('plinko',key), [comb(12,k) for k in range(13)])
w = [4,3,3,2,2,1,1]
tables['slots'] = float(F(sum(n**3*p for n,p in zip(w,array('slots','TRIPLE_BPS')))+sum(3*n*n*(16-n)*18000 for n in w),4096*10000))
tables['diamonds'] = float(F(2520*25500+210*300000+7*5000000,16807*10000))
keno = {1:[0,38500],2:[0,5500,130000],3:[0,0,48000,250000],4:[0,0,23000,92000,470000],5:[0,0,0,72000,295000,2950000],6:[0,0,0,32000,130000,970000,9700000]}
for n, values in keno.items():
    tables['keno:'+str(n)] = float(sum(F(comb(10,i)*comb(30,n-i)*v,comb(40,n)*10000) for i,v in enumerate(values)))
sc,pc,yc = [array('ore_refine',key) for key in ['SLAG_CUM','PARTIAL_CUM','YIELD_CUM']]
pp,yp,bp = [array('ore_refine',key) for key in ['PARTIAL_BPS','YIELD_BPS','BONUS_BPS']]
for t in range(5):
    tables['ore:'+str(t+1)] = float(F((pc[t]-sc[t])*pp[t]+(yc[t]-pc[t])*yp[t]+(10000-yc[t])*bp[t],100000000))
q = F(12,13)**52
pa = F(13,25)+F(12,25)*q
tables.update(andar=float(pa*F(188,100)), bahar=float((1-pa)*2), scratch=float(F(97,100)*F(60000,65536)), coinflip=.98, dice_upper_bound=.98, roulette=float(F(36,37)), war=float(F(25,26)), dragon_tiger_main=float(F(33,34)), dragon_tiger_tie=float(F(9,17)), chuck_a_luck=float(F(75*19000+15*37000+120000,216*10000)), red_dog=float(F(2148,2197)), sicbo_smallbig=float(F(210,216)), sicbo_single=float(F(75*2+15*3+4,216)), sicbo_triples=float(F(180,216)), double_dice_under_over=float(F(15*23000,36*10000)), double_dice_seven_double=float(F(6*55000,36*10000)), double_dice_exact=.95, under_over7_main=float(F(15*23200,36*10000)), under_over7_exact=.95)
result['table_rtps_before_payout_unit_flooring'] = tables
result['hilo_before_floors'] = dict(feasible_live_rtp=float(F(98,100)+F(1,13)), blind_legacy_rtp=float(F(12,13)*F(98,100)+F(1,13)), corrected_winner_numerator=117400, live_max_multiplier=11.74)
result['andar_no_match_52_probability'] = float(q)
print(json.dumps(result,indent=2))
