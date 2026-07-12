#!/usr/bin/env python3
"""Monte-Carlo house-edge simulator for CradleOS on-chain blackjack.

Mirrors the exact rules in sources/blackjack.move so the house-edge figures
shown in the UI are MEASURED, not invented (SOUL: no fake odds).
"""
import random

def card_value_rank(idx):
    r = idx % 13
    if r == 0:
        return 'A'
    if r >= 9:
        return 10
    return r + 1

def hand_total(cards):
    total = 0
    aces = 0
    for c in cards:
        v = card_value_rank(c)
        if v == 'A':
            aces += 1
            total += 11
        else:
            total += v
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return total

def play_hand(stand_on, rng):
    deck = list(range(52))
    rng.shuffle(deck)
    cur = 0
    def draw():
        nonlocal cur
        c = deck[cur]; cur += 1; return c
    player = [draw(), None]
    dealer = [None, None]
    # deal order player,dealer,player,dealer
    player = [deck[0], deck[2]]
    dealer = [deck[1], deck[3]]
    cur = 4
    pt = hand_total(player)
    while pt < stand_on and pt < 21:
        player.append(draw()); pt = hand_total(player)
    player_natural = (len(player) == 2 and pt == 21)
    player_bust = pt > 21
    dt = hand_total(dealer)
    if not player_bust:
        while dt < 17:
            dealer.append(draw()); dt = hand_total(dealer)
    dealer_natural = (len(dealer) == 2 and dt == 21)
    dealer_bust = dt > 21
    stake = 100
    if player_bust:
        return ('L', 0)
    if player_natural and dealer_natural:
        return ('P', stake)
    if player_natural:
        return ('BJ', stake + (stake * 3) // 2)
    if dealer_natural:
        return ('L', 0)
    if dealer_bust:
        return ('W', stake * 2)
    if pt > dt:
        return ('W', stake * 2)
    if pt == dt:
        return ('P', stake)
    return ('L', 0)

def run(stand_on, n, seed):
    rng = random.Random(seed)
    w = p = l = bj = 0
    wagered = 0
    paid = 0
    for _ in range(n):
        outcome, payout = play_hand(stand_on, rng)
        wagered += 100
        paid += payout
        if outcome == 'W': w += 1
        elif outcome == 'P': p += 1
        elif outcome == 'BJ': bj += 1; w += 1
        else: l += 1
    edge = (wagered - paid) / wagered * 100
    return dict(stand_on=stand_on, win=100*w/n, push=100*p/n, loss=100*l/n,
               bj=100*bj/n, edge=edge)

if __name__ == '__main__':
    N = 500_000
    rows = [run(s, N, 12345 + s) for s in range(12, 22)]
    print(f"{'stand_on':>8} {'win%':>7} {'push%':>7} {'loss%':>7} {'bj%':>6} {'HOUSE EDGE%':>12}")
    for r in rows:
        print(f"{r['stand_on']:>8} {r['win']:>7.2f} {r['push']:>7.2f} {r['loss']:>7.2f} {r['bj']:>6.2f} {r['edge']:>12.3f}")
    lo = min(rows, key=lambda r: r['edge'])
    hi = max(rows, key=lambda r: r['edge'])
    print(f"\nLowest edge (best for player):  stand_on={lo['stand_on']}  edge={lo['edge']:.3f}%")
    print(f"Highest edge (worst for player): stand_on={hi['stand_on']}  edge={hi['edge']:.3f}%")
    offered = [r for r in rows if 15 <= r['stand_on'] <= 19]
    emin = min(r['edge'] for r in offered); emax = max(r['edge'] for r in offered)
    allpos = all(r['edge'] > 0 for r in rows)
    print(f"\nUI thresholds 15-19 edge range: {emin:.3f}% .. {emax:.3f}%")
    print(f"House profitable at ALL thresholds 12-21: {allpos}")
