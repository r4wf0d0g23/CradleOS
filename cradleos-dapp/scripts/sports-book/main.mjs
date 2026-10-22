import { readFile, rename, mkdir, open, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import { journalRunner } from "../book-keeper/journal.mjs";
import {
  assertCanonicalChain,
  canonicalObject,
  uint,
} from "../book-keeper/engine.mjs";
import { inspect, getMarket, matchFrozen, sha } from "./polymarket.mjs";
import { actionFor, readTerms, retryAt } from "./policy.mjs";
const PUBLIC_GRAPHQL = "https://graphql.testnet.sui.io/graphql";

const fields =
  "address owner{__typename} asMoveObject{contents{type{repr} json}}";
const status = {
  startedAt: new Date().toISOString(),
  mode: "read-only",
  state: "starting",
  submitted: 0,
  paid: 0,
  proofs: 0,
  finalized: 0,
  refunds: 0,
  errors: [],
};
const stateDir = resolve(
  process.env.SPORTS_KEEPER_STATE_DIR ?? "./.sports-keeper",
);
// OS lock is held across the whole process, including signing and journal writes.
await mkdir(stateDir, { recursive: true, mode: 0o700 });
const lockPath = resolve(stateDir, "keeper.lock");
if (!process.argv.includes("--lock-held")) {
  const child = spawnSync(
    "/usr/bin/flock",
    [
      "-n",
      "-F",
      lockPath,
      process.execPath,
      fileURLToPath(import.meta.url),
      "--lock-held",
    ],
    { stdio: "inherit", env: process.env },
  );
  process.exit(child.status ?? 1);
}
const lockStat = await stat(lockPath),
  locks = await readFile("/proc/locks", "utf8");
if (
  !locks.split("\n").some((line) => {
    const p = line.trim().split(/\s+/);
    return (
      p[1] === "FLOCK" &&
      p[4] === String(process.pid) &&
      p[5]?.split(":").at(-1) === String(lockStat.ino)
    );
  })
)
  throw Error("KERNEL_LOCK_REQUIRED");
let cfg, state, client, signer, journal;
const id = (v) => {
  if (typeof v !== "string" || !/^0x[0-9a-f]{64}$/.test(v))
    throw Error("INVALID_OBJECT_ID");
  return v;
};
async function atomic(path, value) {
  const temp = path + ".new";
  const f = await open(temp, "w", 0o600);
  try {
    await f.writeFile(JSON.stringify(value, null, 2));
    await f.sync();
  } finally {
    await f.close();
  }
  await rename(temp, path);
  const d = await open(dirname(path), "r");
  try {
    await d.sync();
  } finally {
    await d.close();
  }
}
async function query(query, variables = {}) {
  const r = await fetch(PUBLIC_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("CHAIN_HTTP_" + r.status);
  const d = await r.json();
  if (d.errors || !d.data) throw Error("CHAIN_QUERY");
  return d.data;
}
async function objects(ids) {
  const result = [];
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25);
    const q =
      "query{" +
      batch
        .map((x, j) => `n${j}:object(address:"${id(x)}"){${fields}}`)
        .join(" ") +
      "}";
    const d = await query(q);
    batch.forEach((_, j) => result.push(d["n" + j]));
  }
  return result;
}
async function loadState() {
  try {
    return JSON.parse(await readFile(resolve(stateDir, "state.json"), "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return {
      bookId: cfg.bookId,
      claimCursors: {},
      sourceState: {},
      marketCursor: 0,
      pending: null,
    };
  }
}
const save = () => atomic(resolve(stateDir, "state.json"), state);
async function submit(action, fn, args) {
  if (status.submitted >= 16) return false;
  if (!cfg.liveEnabled) {
    status.planned = (status.planned ?? 0) + 1;
    return false;
  }
  if (state.pending) throw Error("PENDING_TRANSACTION");
  const tx = new Transaction();
  tx.setSender(signer.toSuiAddress());
  tx.setGasBudget(100_000_000);
  tx.moveCall({
    target: `${cfg.packageId}::sports::${fn}`,
    typeArguments: [cfg.coinType],
    arguments: args(tx),
  });
  const success = await journal.submit(action, tx);
  status.submitted++;
  if (!success) throw Error("CHAIN_TRANSACTION_FAILED");
  return success;
}
async function payouts(f, node) {
  const count = Number(uint(f.claim_count));
  let cursor = state.claimCursors[node.address] ?? 0;
  for (
    let checked = 0;
    cursor < count && checked < 32 && status.submitted < 16;
    cursor++, checked++
  ) {
    const field = deriveDynamicFieldID(
      id(f.claims.id),
      "u64",
      bcs.u64().serialize(cursor).toBytes(),
    );
    const [slot] = await objects([field]);
    const v = slot?.asMoveObject?.contents?.json;
    if (!v || Number(v.name) !== cursor) throw Error("CLAIM_INDEX");
    const [claim] = await objects([id(v.value)]);
    const e = canonicalObject(
      claim,
      `${cfg.packageId}::sports::Entitlement<${cfg.coinType}>`,
    );
    if (
      e.market_id !== node.address ||
      Number(e.index) !== cursor ||
      typeof e.paid !== "boolean" ||
      !["1", "2"].includes(String(e.side)) ||
      uint(e.stake) === 0n
    )
      throw Error("CLAIM_PROVENANCE");
    id(e.bettor);
    if (!e.paid) {
      const paid = await submit("claim:" + claim.address, "claim_for", (tx) => [
        tx.object(node.address),
        tx.object(claim.address),
      ]);
      if (!paid) break;
      status.paid++;
    }
    state.claimCursors[node.address] = cursor + 1;
    await save();
  }
}

async function report(f, node, now) {
  const t = readTerms(f);
  const ss = (state.sourceState[node.address] ??= { next: 0, attempts: 0 });
  const action = actionFor(f, ss, now);
  if (!action) return;
  const terms = Array.from(Buffer.from(sha(t), "hex"));
  async function invalidate(reason, receipt) {
    if (Math.floor(Date.now() / 1000) >= t.deadline) return;
    const hash = sha(receipt);
    await atomic(resolve(stateDir, "receipts", hash + ".json"), receipt);
    ss.invalid = { reason, hash };
    await save();
    if (
      await submit("invalidate:" + node.address, "invalidate", (tx) => [
        tx.object(node.address),
        tx.pure.vector("u8", terms),
        tx.pure.u8(reason),
        tx.pure.vector("u8", Array.from(Buffer.from(hash, "hex"))),
        tx.object("0x6"),
      ])
    )
      status.refunds++;
  }
  if (ss.invalid) {
    await invalidate(ss.invalid.reason, {
      priorReceipt: ss.invalid.hash,
      latched: true,
    });
    return;
  }
  let raw, observedAt;
  try {
    raw = await getMarket(t.marketId);
    observedAt=Math.floor(Date.now()/1000);
    matchFrozen(t, raw, observedAt);
  } catch (e) {
    // Only a complete metadata observation can prove replacement/early start.
    if (
      raw &&
      [
        "SOURCE_TERMS_CHANGED",
        "SOURCE_EARLY_START",
        "SOURCE_TEMPLATE",
        "SOURCE_OUTCOMES",
        "SOURCE_CONDITION",
        "SOURCE_QUESTION_MAPPING",
      ].includes(e.message)
    ) {
      await invalidate(e.message === "SOURCE_EARLY_START" ? 2 : 1, {
        at: observedAt,
        error: e.message,
        raw,
        terms: t,
      });
      return;
    }
    throw e;
  }
  let p;
  try {
    p = await inspect(t);
  } catch (e) {
    if (e.message === "SOURCE_RULE_UPDATE") {
      await invalidate(1, {
        at: Math.floor(Date.now()/1000),
        error: e.message,
        terms: t,
        proof: e.receipt,
      });
      return;
    }
    throw e;
  }
  await atomic(
    resolve(stateDir, "receipts", p.receiptHash + ".json"),
    p.receipt,
  );
  ss.attempts++;
  ss.failures = 0;
  ss.lastReceipt = p.receiptHash;
  const cand = Number(f.candidate),
    at = Number(f.candidate_at);
  if (p.result !== 0 && now >= t.start) {
    const same =
      cand === p.result &&
      Buffer.from(f.tuple_hash, "base64").toString("hex") === p.tupleHash;
    if (
      !same ||
      (p.observedAt >= at + 7200 && p.receipt.block.timestamp >= at + 7200)
    ) {
      if (Math.floor(Date.now() / 1000) >= t.deadline) return;
      const fn = same ? "confirm" : "propose";
      const submitted = await submit(fn + ":" + node.address, fn, (tx) => [
        tx.object(node.address),
        tx.pure.vector("u8", terms),
        ...(same ? [tx.pure.u64(f.revision)] : []),
        tx.pure.u8(p.result),
        tx.pure.vector("u8", Array.from(Buffer.from(p.tupleHash, "hex"))),
        tx.pure.vector("u8", Array.from(Buffer.from(p.receiptHash, "hex"))),
        tx.pure.u64(p.block),
        tx.pure.u64(p.receipt.block.timestamp),
        tx.pure.u64(p.observedAt),
        tx.object("0x6"),
      ]);
      if (submitted) status.proofs++;
    }
  }
  if (now < t.cutoff + 60) ss.next = now + 60;
  else if (now < t.start + 10800 && !cand) ss.next = t.start + 10800;
  else if (cand && now < at + 7260) ss.next = at + 7260;
  else ss.next = now + Math.min(3600, 600 * Math.max(1, ss.attempts));
  await save();
}
async function run() {
  const path = process.env.SPORTS_KEEPER_CONFIG;
  if (!path) throw Error("CONFIG_MISSING");
  cfg = JSON.parse(await readFile(path, "utf8"));
  if (
    cfg.chainId !== "4c78adac" ||
    cfg.tenant !== "stillness" ||
    cfg.coinType !==
      "0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE" ||
    !["reporter", "payout"].includes(cfg.role)
  )
    throw Error("CONFIG_CHAIN");
  for (const k of ["packageId", "bookId", "reporter", "signer"]) id(cfg[k]);
  if (
    (cfg.role === "reporter" && cfg.signer !== cfg.reporter) ||
    (cfg.role === "payout" && cfg.signer === cfg.reporter)
  )
    throw Error("SIGNER_ROLE");
  client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: "https://fullnode.testnet.sui.io:443",
  });
  assertCanonicalChain(
    (await client.core.getChainIdentifier()).chainIdentifier,
  );
  state = await loadState();
  if (state.bookId !== cfg.bookId) throw Error("STATE_BOOK");
  await mkdir(resolve(stateDir, "receipts"), { recursive: true, mode: 0o700 });
  if (cfg.liveEnabled) {
    const key = process.env.SPORTS_KEEPER_KEYSTORE_PATH;
    if (!key) throw Error("SIGNER_MISSING");
    const info = await stat(key);
    if ((info.mode & 0o077) !== 0) throw Error("SIGNER_PERMISSIONS");
    const entries = JSON.parse(await readFile(key, "utf8"));
    if (!Array.isArray(entries) || entries.length !== 1)
      throw Error("DEDICATED_SIGNER_REQUIRED");
    const bytes = Buffer.from(entries[0], "base64");
    if (bytes.length !== 33 || bytes[0] !== 0) throw Error("SIGNER_FORMAT");
    signer = Ed25519Keypair.fromSecretKey(bytes.subarray(1));
    if (
      signer.toSuiAddress() !== cfg.signer ||
      cfg.signer ===
        "0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a"
    )
      throw Error("DEDICATED_SIGNER_REQUIRED");
    status.mode = "live";
    journal = journalRunner({
      client,
      signer,
      bookId: cfg.bookId,
      state,
      save,
    });
    await journal.recover();
  }
  const [book] = await objects([cfg.bookId]);
  const b = canonicalObject(
    book,
    `${cfg.packageId}::sports::Book<${cfg.coinType}>`,
  );
  if (
    uint(b.version) !== 1n ||
    b.tenant !== cfg.tenant ||
    b.reporter !== cfg.reporter ||
    !Array.isArray(b.markets)
  )
    throw Error("BOOK_PROVENANCE");
  const now = Math.floor(Date.now() / 1000),
    start = state.marketCursor % b.markets.length || 0;
  const ids = [...b.markets.slice(start), ...b.markets.slice(0, start)].slice(
    0,
    32,
  );
  let checked = 0;
  for (const n of await objects(ids)) {
    if (status.submitted >= 16) break;
    checked++;
    try {
      const f = canonicalObject(
        n,
        `${cfg.packageId}::sports::Market<${cfg.coinType}>`,
        cfg.bookId,
      );
      if (
        f.tenant !== cfg.tenant ||
        f.reporter !== cfg.reporter ||
        uint(f.version) !== 1n ||
        uint(f.claim_count) > 10000n
      )
        throw Error("MARKET_PROVENANCE");
      const t = readTerms(f);
      if (![0, 1, 2, 3].includes(Number(f.result)))
        throw Error("MARKET_RESULT");
      if (cfg.role === "payout") {
        if (Number(f.result) !== 0) await payouts(f, n);
        else if (
          now >= t.deadline &&
          (await submit("finalize:" + n.address, "finalize", (tx) => [
            tx.object(n.address),
            tx.object("0x6"),
          ]))
        )
          status.finalized++;
      } else if (Number(f.result) === 0 && now < t.deadline)
        await report(f, n, Math.floor(Date.now() / 1000)).catch(async (e) => {
          const ss = (state.sourceState[n.address] ??= {
            next: 0,
            attempts: 0,
          });
          ss.failures = (ss.failures ?? 0) + 1;
          ss.next = retryAt(
            Math.floor(Date.now() / 1000),
            Number(f.cutoff),
            ss.failures,
          );
          await save();
          throw e;
        });
    } catch (e) {
      status.errors.push(String(e.message).slice(0, 100));
      if (state.pending) throw Error("TRANSACTION_PENDING");
    }
  }
  state.marketCursor = start + checked;
  await save();
  status.markets = b.markets.length;
  status.state = status.errors.length ? "degraded" : "healthy";
}
try {
  await run();
} catch (e) {
  status.state = "blocked";
  status.errors.push(String(e.message).slice(0, 100));
  process.exitCode = 1;
}
if (state?.pending)
  status.pending = {
    digest: state.pending.digest,
    action: state.pending.action,
  };
status.finishedAt = new Date().toISOString();
status.errors = [...new Set(status.errors)].slice(0, 20);
try {
  await atomic(resolve(stateDir, "status.json"), status);
} catch {
  process.exitCode = 1;
}
console.log(JSON.stringify(status));
