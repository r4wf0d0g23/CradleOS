// Unsigned simulation only. Does not load keys or submit a transaction.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../cradleos-dapp/package.json", import.meta.url),
);
const { SuiGrpcClient } = require("@mysten/sui/grpc"),
  { Transaction } = require("@mysten/sui/transactions");
const build = JSON.parse(
  readFileSync(new URL("package-build.json", import.meta.url)),
);
const custody =
  "0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a";
const client = new SuiGrpcClient({
  network: "testnet",
  baseUrl: "https://fullnode.testnet.sui.io:443",
});
const tx = new Transaction();
tx.setSender(custody);
tx.setGasBudget(500000000);
const cap = tx.publish(build);
tx.transferObjects([cap], custody);
const result = await client.core.simulateTransaction({
  transaction: tx,
  checksEnabled: true,
  include: { effects: true, objectTypes: true },
});
writeFileSync(
  new URL("publish-simulation.json", import.meta.url),
  JSON.stringify(
    result,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
assert.equal(result.$kind, "Transaction");
console.log(
  JSON.stringify({
    status: result.$kind,
    digest: result.Transaction.digest,
    dependencies: build.dependencies,
    signed: false,
    submitted: false,
    custody,
  }),
);
