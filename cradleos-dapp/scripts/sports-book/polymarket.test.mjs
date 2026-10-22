import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalize,
  inspect,
  payout,
  verifyQuestion,
  matchFrozen,
  sha,
  decodeUpdates,
} from "./polymarket.mjs";
const nba = JSON.parse(
  readFileSync(
    new URL(
      "../../../deploy/sports-book-20261021/nba-mapping-proof.json",
      import.meta.url,
    ),
  ),
);
const nfl = JSON.parse(
  readFileSync(
    new URL(
      "../../../deploy/sports-book-20261021/nfl-mapping-proof.json",
      import.meta.url,
    ),
  ),
);
const raw = JSON.parse(
  readFileSync(
    new URL(
      "../../../deploy/sports-book-20261021/fixtures/nba.json",
      import.meta.url,
    ),
  ),
);
const clone = (x) => structuredClone(x);
for (const [name, proof] of [
  ["NBA", nba],
  ["NFL", nfl],
])
  test(
    name + " complete canonical mapping and single pinned block",
    async () => {
      const calls = clone(proof.receipt.calls);
      const got = await inspect(proof.receipt.terms, {
        now: proof.observedAt,
        rpcCall: async (req) => {
          const c = calls.shift();
          assert.deepEqual(req, c.request);
          return c.response;
        },
      });
      assert.equal(got.result, 0);
      assert.equal(calls.length, 0);
    },
  );
test("real normalized fixture frozen", () =>
  assert.deepEqual(normalize(raw), nba.receipt.terms));
for (const [name, mut] of [
  ["v2", (m) => (m.version = "v2")],
  ["negative risk", (m) => (m.negRisk = true)],
  ["prop", (m) => (m.sportsMarketType = "spreads")],
  ["unknown team", (m) => (m.slug = "nba-zzz-phi-2026-10-22")],
  ["flipped outcomes", (m) => (m.outcomes = '["76ers","Cavaliers"]')],
  ["changed condition", (m) => (m.conditionId = "0x" + "ff".repeat(32))],
  ["unsupported rules", (m) => (m.description += "\nRegulation only.")],
  ["third outcome", (m) => (m.outcomes = '["Cavaliers","76ers","Draw"]')],
  ["wrong oracle", (m) => (m.resolvedBy = "0x" + "11".repeat(20))],
  ["different event", (m) => (m.events[0].slug = "other")],
  [
    "wrong scheduled date",
    (m) => (m.events[0].startTime = "2026-10-23T23:00:00Z"),
  ],
  ["missing start", (m) => delete m.events[0].startTime],
])
  test("reject " + name, () => {
    const m = clone(raw);
    mut(m);
    assert.throws(() => normalize(m));
  });
for (const [d, a, b, r] of [
  [0, 0, 0, 0],
  [1, 1, 0, 1],
  [1, 0, 1, 2],
  [2, 1, 1, 3],
  [10, 3, 7, 3],
  [20, 20, 0, 1],
])
  test(`payout ${d}/${a}/${b}`, () => assert.equal(payout(d, a, b), r));
for (const vals of [
  [0, 1, 0],
  [2, 1, 0],
  [-1, 0, 0],
  [1, -1, 2],
])
  test("invalid payout " + vals, () => assert.throws(() => payout(...vals)));
test("postponement retains original terms and cutoff", () => {
  const m = clone(raw);
  m.events[0].startTime = "2026-10-23T23:00:00Z";
  assert.equal(matchFrozen(nba.receipt.terms, m, 0), true);
});
test("early live is invalidation", () => {
  const m = clone(raw);
  m.events[0].live = true;
  assert.throws(() =>
    matchFrozen(nba.receipt.terms, m, nba.receipt.terms.cutoff - 1),
  );
});
test("changed team never rebinds", () => {
  const m = clone(raw);
  m.events[0].gameId++;
  assert.throws(() => matchFrozen(nba.receipt.terms, m, 0));
});
for (const [name, mut] of [
  ["wrong chain", (c) => (c[0].response.result = "0x1")],
  [
    "wrong token",
    (c) =>
      (c.find(
        (x) =>
          x.request.method === "eth_call" &&
          x.response.result.length === 66 &&
          BigInt(x.response.result).toString() === nba.receipt.terms.tokens[0],
      ).response.result = "0x" + "0".repeat(64)),
  ],
  ["stale block", (c) => (c[1].response.result.timestamp = "0x1")],
  [
    "changed block hash",
    (c) => (c.at(-1).response.result.hash = "0x" + "aa".repeat(32)),
  ],
  [
    "rule update",
    (c) => {
      const x = c.find(
        (x) =>
          x.response.result === "0x" + "20".padStart(64, "0") + "0".repeat(64),
      );
      x.response.result = "0x00";
    },
  ],
  ["wrong slots", (c) => (c[2].response.result = "0x03")],
])
  test("reject RPC " + name, async () => {
    const c = clone(nba.receipt.calls);
    mut(c);
    await assert.rejects(
      inspect(nba.receipt.terms, {
        now: nba.observedAt,
        rpcCall: async () => c.shift().response,
      }),
    );
  });
test("question hash binds exact team mapping", () => {
  const q = nba.receipt.calls.find(
    (x) => x.request.method === "eth_call" && x.response.result.length > 1000,
  );
  const t = clone(nba.receipt.terms);
  t.labels.reverse();
  assert.throws(() => verifyQuestion(t, q.response.result));
});

test("extra conflicting event rejected", () => {
  const m = clone(raw);
  m.events.push({ ...m.events[0], gameId: 1 });
  assert.throws(() => matchFrozen(nba.receipt.terms, m, 0));
});
test("noncanonical live timestamp rejected", () => {
  const m = clone(raw);
  m.events[0].startTime = "2026-10-22 23:00:00";
  assert.throws(() => matchFrozen(nba.receipt.terms, m, 0));
});
const w = (x) => BigInt(x).toString(16).padStart(64, "0");
test("valid creator update decoded; malformed is not a rule-change proof", () => {
  assert.deepEqual(decodeUpdates("0x" + w(32) + w(0)), []);
  assert.equal(
    decodeUpdates(
      "0x" +
        w(32) +
        w(1) +
        w(32) +
        w(100) +
        w(64) +
        w(1) +
        "61".padEnd(64, "0"),
    )[0].data,
    "61",
  );
  assert.throws(() => decodeUpdates("0x00"), /SOURCE_UPDATE_ABI/);
});

for (const k of ["outcomes", "description", "conditionId", "clobTokenIds"])
  test("incomplete metadata is not a mutation proof: " + k, () => {
    const m = clone(raw);
    delete m[k];
    assert.throws(
      () => matchFrozen(nba.receipt.terms, m, 0),
      /SOURCE_INCOMPLETE/,
    );
  });

test('same fixture postponed date preserves original deadline',()=>{const m=clone(raw);m.events[0].startTime='2026-10-23T23:00:00Z';m.events[0].eventDate='2026-10-23';assert.equal(matchFrozen(nba.receipt.terms,m,0),true);});
