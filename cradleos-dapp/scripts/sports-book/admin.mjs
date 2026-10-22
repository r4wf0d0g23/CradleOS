// Explicit deployment/listing CLI; never invoked by the reporter or public UI.
import { dirname } from "node:path";
import { readFile, writeFile, open } from "node:fs/promises";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { assertCanonicalChain, receipt } from "../book-keeper/engine.mjs";
import {
  normalize,
  getMarket,
  inspect,
  matchFrozen,
  sha,
} from "./polymarket.mjs";
const [operation, configFile, output, ...params] = process.argv.slice(2);
const cfg = JSON.parse(await readFile(configFile, "utf8"));
const PUBLISHER =
  "0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a";
if (
  cfg.publisher !== PUBLISHER ||
  cfg.coinType !==
    "0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE"
)
  throw Error("CONFIG");
const client = new SuiGrpcClient({
  network: "testnet",
  baseUrl: "https://fullnode.testnet.sui.io:443",
});
assertCanonicalChain((await client.core.getChainIdentifier()).chainIdentifier);
const tx = new Transaction();
tx.setSender(PUBLISHER);
tx.setGasBudget(150_000_000);
let proof;
if (operation === "bootstrap")
  tx.moveCall({
    target: `${cfg.packageId}::sports::create_book`,
    typeArguments: [cfg.coinType],
    arguments: [tx.object(cfg.bootstrapCap), tx.pure.address(cfg.reporter)],
  });
else if (operation === "fund") {
  for (const addr of [cfg.reporter, cfg.payout]) {
    if (!/^0x[0-9a-f]{64}$/.test(addr) || addr === PUBLISHER)
      throw Error("SIGNER");
    const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(250_000_000)]);
    tx.transferObjects([c], tx.pure.address(addr));
  }
} else if (operation === "list") {
  const raw = await getMarket(params[0]),
    t = normalize(raw),
    now = Math.floor(Date.now() / 1000);
  matchFrozen(t, raw, now);
  if (
    t.start < now + 600 ||
    t.start > now + 604800 ||
    raw.closed !== false ||
    raw.active !== true ||
    raw.events[0].live === true ||
    raw.events[0].ended === true
  )
    throw Error("FIXTURE_NOT_UPCOMING");
  proof = await inspect(t);
  if (proof.result !== 0) throw Error("ALREADY_RESOLVED");
  tx.moveCall({
    target: `${cfg.packageId}::sports::create_market`,
    typeArguments: [cfg.coinType],
    arguments: [
      tx.object(cfg.bookId),
      tx.object(cfg.adminCap),
      tx.pure.u8(t.league === "nba" ? 1 : 2),
      tx.pure.string(t.labels[0]),
      tx.pure.string(t.labels[1]),
      tx.pure.string(t.marketId),
      tx.pure.vector(
        "u8",
        Array.from(Buffer.from(t.condition.slice(2), "hex")),
      ),
      tx.pure.string(JSON.stringify(t)),
      tx.pure.u64(t.start),
      tx.object("0x6"),
    ],
  });
} else throw Error("UNKNOWN_OPERATION");
const bytes = await tx.build({ client });
const simulated = await client.simulateTransaction({
  transaction: bytes,
  include: { effects: true },
});
if (!simulated.Transaction?.status?.success) throw Error("SIMULATION_FAILED");
await writeFile(
  output + ".simulation.json",
  JSON.stringify(simulated, null, 2),
);
if (proof)
  await writeFile(output + ".source.json", JSON.stringify(proof, null, 2));
if (process.env.SPORTS_ADMIN_SIGN !== "1") {
  console.log(JSON.stringify({ operation, simulation: true, signed: false }));
  process.exit(0);
}
const journal = await open(output + ".pending.json", "wx", 0o600); // never blindly resend after unknown outcome
const keys = JSON.parse(
  await readFile(process.env.SPORTS_ADMIN_KEYSTORE, "utf8"),
);
let signer;
for (const k of keys) {
  const b = Buffer.from(k, "base64");
  if (b.length === 33 && b[0] === 0) {
    const s = Ed25519Keypair.fromSecretKey(b.subarray(1));
    if (s.toSuiAddress() === PUBLISHER) signer = s;
  }
}
if (!signer) throw Error("PUBLISHER_NOT_FOUND");
const signed = await signer.signTransaction(bytes),
  digest = await tx.getDigest();
try {
  await journal.writeFile(
    JSON.stringify({
      operation,
      digest,
      bytes: Buffer.from(bytes).toString("base64"),
      signature: signed.signature,
    }),
  );
  await journal.sync();
} finally {
  await journal.close();
}
const directory = await open(dirname(output), "r");
try { await directory.sync(); } finally { await directory.close(); }
const result = await client.executeTransaction({
  transaction: bytes,
  signatures: [signed.signature],
  include: { effects: true, objectTypes: true },
});
await writeFile(output + ".json", JSON.stringify(result, null, 2));
const r = receipt(result);
if (r.digest !== digest) throw Error("DIGEST_MISMATCH");
if (!r.success) throw Error("CONFIRMED_FAILURE");
console.log(
  JSON.stringify({ operation, ...r, source: proof?.receipt.terms.marketId }),
);
