import { describe, it, expect, vi, afterEach } from "vitest";
import { BOOK_DEPLOYMENT } from "./bookDeployment";
import {
  parseEve,
  formatEve,
  objectId,
  parseMarket,
  marketPhase,
  estimatedReturn,
  ticketReturn,
  buildBet,
  buildClaim,
  buildPriceProof,
  PRICE_FEEDS, parsePrice, priceLabel, buildFulfill, buildDeliveryRefund, buildDelivery, parseDelivery, fetchTickets,
  buildFinalize,
  buildCreate,
  bookReceipt,
  U64,
  findBookCharacter,
  type Market,
} from "./bettingBook";
import { queryChain, findCurrentCharacters, listOwnedCurrentObjects } from "./currentWorldRead";
vi.mock("./currentWorldRead", () => ({
  queryChain: vi.fn(),
  findCurrentCharacters: vi.fn(),
  listOwnedCurrentObjects: vi.fn(),
}));
const id = (n: number) => objectId("0x" + n.toString(16));
const cfg = {
  ...BOOK_DEPLOYMENT,
  packageId: id(99),
  bookId: id(100),
  wageringEnabled: true,
  rewardsEnabled: true,
};
function node() {
  return {
    address: id(101),
    owner: { __typename: "Shared" },
    asMoveObject: {
      contents: {
        type: { repr: `${cfg.packageId}::book::Market<${cfg.coinType}>` },
        json: {
          version: "1",
          book_id: cfg.bookId,
          tenant: cfg.tenant, creator: id(9), asset: 1,
          starts: "2000000000", ends: "2000001000", proof_deadline: "2000004600",
          price_feed: btoa(String.fromCharCode(...PRICE_FEEDS[1].feed.match(/../g)!.map(x=>parseInt(x,16)))),
          price_exponent: 8, price_strike: "10000000000", price_value: "0", price_time: "0",
          claim_count: "2", claims: {id:id(88)},
          pool_a: "3",
          pool_b: "2",
          escrow: "5",
          result: 0,
          remaining_winning_stake: "0",
        },
      },
    },
  };
}
const market = () => parseMarket(node(), cfg);
afterEach(() => vi.clearAllMocks());
describe("exact EVE and market reads", () => {
  it("round trips atomic values including u64 max", () => {
    for (const n of [1n, 1_000_000_001n, U64])
      expect(parseEve(formatEve(n))).toBe(n);
  });
  it.each([
    "0",
    "-1",
    "1e3",
    "0.0000000001",
    "Infinity",
    "18446744073.709551616",
  ])("rejects malformed stake %s", (s) => expect(() => parseEve(s)).toThrow());
  it("rejects wrong package, owner, feed, tenant and null numeric state", () => {
    const mutations = [
      (n: ReturnType<typeof node>) =>
        (n.asMoveObject.contents.type.repr = "wrong"),
      (n: ReturnType<typeof node>) => (n.owner.__typename = "AddressOwner"),
      (n: ReturnType<typeof node>) =>
        (n.asMoveObject.contents.json.price_feed = "AA=="),
      (n: ReturnType<typeof node>) =>
        (n.asMoveObject.contents.json.tenant = "utopia"),
      (n: ReturnType<typeof node>) =>
        Object.assign(n.asMoveObject.contents.json, { result: null }),
      (n: ReturnType<typeof node>) =>
        (n.asMoveObject.contents.json.escrow = "6"),
    ];
    for (const mutate of mutations) {
      const n = node();
      mutate(n);
      expect(() => parseMarket(n, cfg)).toThrow();
    }
  });
  it("phases use exclusive cutoffs and actual finalization", () => {
    const m = market();
    expect(marketPhase(m, m.starts - 1)).toBe("Open");
    expect(marketPhase(m, m.starts)).toBe("Live");
    expect(marketPhase(m, m.ends)).toBe("Proofs");
    expect(marketPhase(m, m.proofDeadline)).toBe("Ready to settle");
    expect(marketPhase({ ...m, result: 3 })).toBe("Refund");
  });
  it("estimates new share and refuses overflowing aggregate", () => {
    expect(estimatedReturn(market(), 1, 2n)).toBe(2n);
    expect(() => estimatedReturn(market(), 1, U64)).toThrow();
  });
  it("filters stale transferred character profiles before choosing", async () => {
    vi.mocked(findCurrentCharacters).mockResolvedValue([
      { characterId: id(1), tribeId: 1, version: 3 },
      { characterId: id(2), tribeId: 1, version: 2 },
    ]);
    vi.mocked(queryChain)
      .mockResolvedValueOnce({
        object: {
          asMoveObject: {
            contents: {
              type: { repr: `${cfg.world}::character::Character` },
              json: { character_address: id(4), key: { tenant: cfg.tenant } },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        object: {
          asMoveObject: {
            contents: {
              type: { repr: `${cfg.world}::character::Character` },
              json: { character_address: id(3), key: { tenant: cfg.tenant } },
            },
          },
        },
      });
    expect(await findBookCharacter(id(3), cfg)).toBe(id(2));
  });
});
describe("payout conservation", () => {
  it("all partitions/claim orders conserve pools with <1 atom rounding error", () => {
    for (let a = 1n; a <= 12n; a++)
      for (let b = 1n; b <= 12n; b++)
        for (let first = 1n; first <= a; first++) {
          const m: Market = {
            ...market(),
            poolA: a,
            poolB: b,
            escrow: a + b,
            result: 1,
            remainingWinningStake: a,
          };
          let paid = 0n;
          for (const stake of [first, a - first].filter((v) => v > 0n)) {
            const p = ticketReturn(m, {
              id: id(4),
              marketId: m.id,
              bettor: id(1),
              side: 1,
              stake, entitlementId:id(80), paid:false, payout:0n,
            })!;
            const numerator = stake * (a + b),
              diff = p * a - numerator;
            expect(diff > -a && diff < a).toBe(true);
            paid += p;
            m.remainingWinningStake -= stake;
            m.escrow -= p;
          }
          expect(paid).toBe(a + b);
          expect(m.escrow).toBe(0n);
        }
  });
  it("unknown, losing, refund and foreign tickets differ", () => {
    const m = market(),
      t = {
        id: id(4),
        marketId: m.id,
        bettor: id(1),
        side: 2 as const,
        stake: 2n, entitlementId:id(80), paid:false, payout:0n,
      };
    expect(ticketReturn(m, t)).toBeNull();
    expect(
      ticketReturn({ ...m, result: 1, remainingWinningStake: 3n }, t),
    ).toBe(0n);
    expect(ticketReturn({ ...m, result: 3 }, t)).toBe(2n);
    expect(() => ticketReturn(m, { ...t, marketId: id(9) })).toThrow();
  });
});
describe("transaction construction", () => {
  it("splits exact amounts without merging oversized wallet balances", () => {
    const tx = buildBet(
      market(),
      id(1),
      1,
      4n,
      [
        { id: id(21), balance: U64 },
        { id: id(22), balance: U64 },
      ],
      cfg,
    );
    const commands = tx.getData().commands;
    expect(commands.map((c) => c.$kind)).toEqual(["SplitCoins", "MoveCall"]);
    const call = commands[1].MoveCall!;
    expect(call.function).toBe("place_bet");
    expect(call.package).toBe(cfg.packageId);
    expect(call.typeArguments).toEqual([cfg.coinType]);
  });
  it("rejects disabled wagering, duplicate and insufficient coins", () => {
    const coins = [{ id: id(21), balance: 10n }];
    expect(() =>
      buildBet(market(), id(1), 1, 1n, coins, {
        ...cfg,
        wageringEnabled: false,
      }),
    ).toThrow();
    expect(() =>
      buildBet(market(), id(1), 1, 1n, [...coins, ...coins], cfg),
    ).toThrow();
    expect(() => buildBet(market(), id(1), 1, 11n, coins, cfg)).toThrow();
  });
  it("claim/proof/finalize remain buildable when new wagering disabled", () => {
    const paused = { ...cfg, wageringEnabled: false };
    for (const tx of [
      buildClaim(id(101), id(4), paused),
      buildPriceProof(id(101), new Uint8Array([1]), paused),
      buildFinalize(id(101), paused),
    ])
      expect(tx.getData().commands[0].MoveCall?.package).toBe(cfg.packageId);
  });
  it("cannot target an unconfigured book", () =>
    expect(() =>
      buildClaim(id(1), id(2), { ...cfg, packageId: "" }),
    ).toThrow());
  it("validates fixed creation terms", () => {
    expect(() =>
      buildCreate(
        id(1),
        {
          asset: 3 as 1, strike: 1n, starts: 2000000000, ends: 2000001000,
        },
        cfg,
      ),
    ).toThrow();
    expect(() =>
      buildCreate(
        id(1),
        {
          asset: 1, strike: 1n, starts: 2000000000, ends: 2000000001,
        },
        cfg,
      ),
    ).toThrow();
  });
  it("a digest is not proof of successful settlement", () => {
    expect(() => bookReceipt({ digest: "x" })).toThrow(/unconfirmed/);
    expect(() => bookReceipt({ $kind: "FailedTransaction" })).toThrow(/failed/);
    expect(
      bookReceipt({
        $kind: "Transaction",
        Transaction: { digest: "abc", status: { success: true } },
      }),
    ).toBe("abc");
  });
});
describe("fixed oracle and item terms", () => {
  it("parses USD exactly and rejects open-ended/invalid prices", () => {
    for(const v of [1n,10000000001n,U64]) expect(parsePrice(priceLabel(v).slice(1))).toBe(v);
    for(const v of ["0","-1","1e8","1.000000001", "NaN"]) expect(()=>parsePrice(v)).toThrow();
  });
  const rewardNode=()=>({address:id(200),owner:{__typename:"Shared"},asMoveObject:{contents:{type:{repr:`${cfg.packageId}::delivery::Delivery<${cfg.coinType}>`},json:{book_id:cfg.bookId,tenant:cfg.tenant,title:"Ammo",sponsor:id(7),sponsor_character:id(8),origin:id(9),item_type:"88069",quantity:"10",deadline:"2000000000",reward:"100",reward_amount:"100",status:0,fulfilled_by:id(0),fulfilled_at:"0"}}}});
  it("requires conserved reward escrow and exact origin/type/quantity",()=>{
    const d=parseDelivery(rewardNode(),cfg),items=[{id:id(77),origin:d.origin,itemType:d.itemType,quantity:10n}];
    expect(buildFulfill(d,id(1),items,cfg).getData().commands.slice(-1)[0]?.MoveCall?.function).toBe("fulfill");
    for(const bad of [[{...items[0],quantity:9n}],[{...items[0],origin:id(10)}],[{...items[0],itemType:88070n}],[...items,...items]])expect(()=>buildFulfill(d,id(1),bad,cfg)).toThrow();
    const n=rewardNode();n.asMoveObject.contents.json.reward="99";expect(()=>parseDelivery(n,cfg)).toThrow();
  });
  it("funding splits exact EVE and refund cannot choose a recipient",()=>{
    const tx=buildDelivery(id(1),{title:"Ammo",origin:id(9),itemType:88069n,quantity:10n,deadline:Math.floor(Date.now()/1000)+600,reward:100n},[{id:id(50),balance:U64}],cfg);
    expect(tx.getData().commands.map(c=>c.$kind)).toEqual(["SplitCoins","MoveCall"]);
    const refund=buildDeliveryRefund(id(200),cfg).getData().commands[0].MoveCall!;
    expect(refund.function).toBe("refund");expect(refund.arguments).toHaveLength(2);
    const claim=buildClaim(id(101),id(80),cfg).getData().commands[0].MoveCall!;
    expect(claim.function).toBe("claim_for");expect(claim.arguments).toHaveLength(2);
  });
  it("uses paid shared-entitlement state after automatic payout",async()=>{
    vi.mocked(listOwnedCurrentObjects).mockResolvedValue([{address:id(80),version:1,asMoveObject:{contents:{json:{market_id:id(101),bettor:id(1),side:1,stake:"3",entitlement_id:id(81)}}}}]);
    const claim={address:id(81),owner:{__typename:"Shared"},asMoveObject:{contents:{type:{repr:`${cfg.packageId}::book::Entitlement<${cfg.coinType}>`},json:{market_id:id(101),bettor:id(1),side:1,stake:"3",paid:true,payout:"5"}}}};
    vi.mocked(queryChain).mockResolvedValue({e0:claim});
    const tickets=await fetchTickets(id(1),cfg);expect(tickets[0].paid).toBe(true);expect(ticketReturn({...market(),result:1,remainingWinningStake:0n,escrow:0n},tickets[0])).toBe(5n);
    claim.asMoveObject.contents.json.bettor=id(2);await expect(fetchTickets(id(1),cfg)).rejects.toThrow("Payment status");
  });
});
