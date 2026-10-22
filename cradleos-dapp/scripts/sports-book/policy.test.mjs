import { test } from "node:test";
import assert from "node:assert/strict";
import { actionFor, readTerms, retryAt } from "./policy.mjs";
import { sha } from "./polymarket.mjs";
import { readFileSync } from "node:fs";
const t = JSON.parse(
  readFileSync(
    new URL(
      "../../../deploy/sports-book-20261021/nba-terms.json",
      import.meta.url,
    ),
  ),
);
const f = {
  terms_json: JSON.stringify(t),
  terms_hash: Buffer.from(sha(t), "hex").toString("base64"),
  condition: Buffer.from(t.condition.slice(2), "hex").toString("base64"),
  source_market: t.marketId,
  league: "1",
  label_a: t.labels[0],
  label_b: t.labels[1],
  starts: String(t.start),
  cutoff: String(t.cutoff),
  proof_deadline: String(t.deadline),
  result: 0,
  candidate: 0,
  candidate_at: "0",
};
test("frozen chain terms", () => assert.deepEqual(readTerms(f), t));
for (const k of [
  "terms_hash",
  "condition",
  "source_market",
  "label_a",
  "starts",
  "cutoff",
  "proof_deadline",
])
  test("reject changed " + k, () =>
    assert.throws(() => readTerms({ ...f, [k]: "0" })),
  );
test("wait until preclose", () =>
  assert.equal(actionFor(f, {}, t.start - 901), null));
test("preclose check", () =>
  assert.equal(actionFor(f, {}, t.start - 900), "preflight"));
test("no inplay constant polling", () =>
  assert.equal(actionFor(f, {}, t.start + 100), null));
test("result checks near finish", () =>
  assert.equal(actionFor(f, {}, t.start + 10800), "result"));
test("backoff", () =>
  assert.equal(actionFor(f, { next: t.start + 12000 }, t.start + 11000), null));
test("fresh candidate confirmation", () =>
  assert.equal(
    actionFor(
      { ...f, candidate: 1, candidate_at: String(t.start + 10000) },
      {},
      t.start + 17260,
    ),
    "confirm",
  ));
test("wait full hold plus finality slack", () =>
  assert.equal(
    actionFor(
      { ...f, candidate: 1, candidate_at: String(t.start + 10000) },
      {},
      t.start + 17199,
    ),
    null,
  ));
test("deadline beats candidate and invalidation", () =>
  assert.equal(
    actionFor({ ...f, candidate: 1 }, { invalid: { reason: 1 } }, t.deadline),
    null,
  ));
test("latched invalidation bypasses backoff", () =>
  assert.equal(
    actionFor(f, { invalid: { reason: 1 }, next: t.deadline }, t.start),
    "invalidate",
  ));
test("terminal winner never rereads", () =>
  assert.equal(actionFor({ ...f, result: 1 }, {}, t.start + 10800), null));

test("bounded failure backoff", () => {
  assert.equal(retryAt(100, 200, 100), 160);
  assert.equal(retryAt(100, 90, 1), 700);
  assert.equal(retryAt(100, 90, 99), 3700);
});
