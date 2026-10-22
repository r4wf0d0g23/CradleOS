import { createHash } from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";
export const SOURCE = Object.freeze({
  chain: 137,
  ctf: "0x4d97dcd97ec945f40cf65f87097ace5ea0476045",
  oracle: "0x65070be91477460d8a7aeeb94ef92fe056c2f2a7",
  collateral: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  version: "v1",
  adapter: 1,
});
export const sha = (x) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
const keccak = (x) => "0x" + Buffer.from(keccak_256(x)).toString("hex");
const word = (x) => BigInt(x).toString(16).padStart(64, "0");
const hex = (x, n) => {
  if (
    typeof x !== "string" ||
    !new RegExp("^0x[0-9a-fA-F]{" + n * 2 + "}$").test(x)
  )
    throw Error("SOURCE_HEX");
  return x.toLowerCase();
};
const dec = (x) => {
  if (!/^[1-9][0-9]{0,77}$/.test(String(x))) throw Error("SOURCE_ID");
  return String(x);
};
const arr = (x) => (typeof x === "string" ? JSON.parse(x) : x);
const check = (ok, error) => {
  if (!ok) throw Error(error);
};
const TEAMS = {
  nba: {
    atl: "Hawks",
    bos: "Celtics",
    bkn: "Nets",
    cha: "Hornets",
    chi: "Bulls",
    cle: "Cavaliers",
    dal: "Mavericks",
    den: "Nuggets",
    det: "Pistons",
    gsw: "Warriors",
    hou: "Rockets",
    ind: "Pacers",
    lac: "Clippers",
    lal: "Lakers",
    mem: "Grizzlies",
    mia: "Heat",
    mil: "Bucks",
    min: "Timberwolves",
    nop: "Pelicans",
    nyk: "Knicks",
    okc: "Thunder",
    orl: "Magic",
    phi: "76ers",
    phx: "Suns",
    por: "Trail Blazers",
    sac: "Kings",
    sas: "Spurs",
    tor: "Raptors",
    uta: "Jazz",
    was: "Wizards",
  },
  nfl: {
    ari: "Cardinals",
    atl: "Falcons",
    bal: "Ravens",
    buf: "Bills",
    car: "Panthers",
    chi: "Bears",
    cin: "Bengals",
    cle: "Browns",
    dal: "Cowboys",
    den: "Broncos",
    det: "Lions",
    gb: "Packers",
    hou: "Texans",
    ind: "Colts",
    jax: "Jaguars",
    kc: "Chiefs",
    lac: "Chargers",
    lar: "Rams",
    lv: "Raiders",
    mia: "Dolphins",
    min: "Vikings",
    ne: "Patriots",
    no: "Saints",
    nyg: "Giants",
    nyj: "Jets",
    phi: "Eagles",
    pit: "Steelers",
    sea: "Seahawks",
    sf: "49ers",
    tb: "Buccaneers",
    ten: "Titans",
    was: "Commanders",
  },
};
export function normalize(m) {
  check(
    m?.version === "v1" &&
      m.negRisk === false &&
      m.sportsMarketType === "moneyline",
    "SOURCE_VERSION",
  );
  const e = m.events?.[0];
  check(
    m.events?.length === 1 && e?.version === "v1" && e.negRisk === false,
    "SOURCE_EVENT",
  );
  const slug = /^(nba|nfl)-([a-z]{2,3})-([a-z]{2,3})-(\d{4}-\d{2}-\d{2})$/.exec(
    m.slug,
  );
  check(slug && e.slug === m.slug, "SOURCE_FIXTURE");
  const [, league, a, b, date] = slug;
  check(a !== b && TEAMS[league][a] && TEAMS[league][b], "SOURCE_TEAMS");
  const labels = arr(m.outcomes),
    tokens = arr(m.clobTokenIds);
  check(
    Array.isArray(labels) &&
      labels.length === 2 &&
      labels[0] === TEAMS[league][a] &&
      labels[1] === TEAMS[league][b],
    "SOURCE_OUTCOMES",
  );
  check(
    Array.isArray(tokens) && tokens.length === 2 && tokens[0] !== tokens[1],
    "SOURCE_TOKENS",
  );
  tokens.forEach(dec);
  check(
    m.question === labels.join(" vs. ") &&
      m.resolutionSource ===
        (league === "nba"
          ? "https://www.nba.com/"
          : "https://www.nfl.com/scores"),
    "SOURCE_RULES",
  );
  check(
    typeof m.description === "string" && m.description.length < 3000,
    "SOURCE_RULES",
  );
  const start = Date.parse(e.startTime) / 1000;
  check(
    Number.isSafeInteger(start) &&
      new Date(start * 1000).toISOString() ===
        e.startTime.replace(/\.000Z$/, "Z").replace(/Z$/, ".000Z"),
    "SOURCE_START",
  );
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(start * 1000))
      .map((x) => [x.type, x.value]),
  );
  const when = `${parts.month} ${parts.day} at ${parts.hour}:${parts.minute}${parts.dayPeriod} ET`;
  const nba = `In the upcoming NBA game, scheduled for ${when}:\nIf the ${labels[0]} win, the market will resolve to "${labels[0]}".\nIf the ${labels[1]} win, the market will resolve to "${labels[1]}".\nIf the game is postponed, this market will remain open until the game has been completed.\nIf the game is canceled entirely, with no make-up game, this market will resolve 50-50.\nThe result will be determined based on the final score including any overtime periods.`;
  const nfl = `In the upcoming NFL football game between ${labels[0]} and ${labels[1]}, scheduled for ${when}:\nThis market will resolve to "${labels[0]}" if ${labels[0]} win the game.\nThis market will resolve to "${labels[1]}" if ${labels[1]} win the game.\nOvertime is included if played.\nIf the game ends in a tie, this market will resolve 50-50.\nIf the game is postponed, this market will remain open until the game has been completed.\nIf the game is canceled entirely, with no make-up game, this market will resolve 50-50.\n`;
  check(
    m.description.trimEnd() === (league === "nba" ? nba : nfl).trimEnd(),
    "SOURCE_TEMPLATE",
  );
  check(
    (e.eventDate === date ||
      e.eventDate ===
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(start * 1000))) &&
      Number.isSafeInteger(Number(e.gameId)) &&
      Number(e.gameId) > 0,
    "SOURCE_GAME",
  );
  const oracle = hex(m.resolvedBy, 20),
    question = hex(m.questionID, 32),
    condition = hex(m.conditionId, 32);
  check(
    oracle === SOURCE.oracle &&
      keccak(
        Buffer.from(oracle.slice(2) + question.slice(2) + word(2), "hex"),
      ) === condition,
    "SOURCE_CONDITION",
  );
  return {
    adapter: 1,
    chain: 137,
    ctf: SOURCE.ctf,
    oracle,
    collateral: SOURCE.collateral,
    version: "v1",
    league,
    gameId: dec(e.gameId),
    eventId: dec(e.id),
    marketId: dec(m.id),
    slug: m.slug,
    teams: [a, b],
    labels,
    tokens,
    condition,
    question,
    description: m.description,
    rulesHash: sha(m.description),
    start,
    cutoff: start - 300,
    deadline: start + 172800,
    hold: 7200,
  };
}
export function payout(denominator, a, b) {
  const d = BigInt(denominator),
    x = BigInt(a),
    y = BigInt(b);
  check(d >= 0n && x >= 0n && y >= 0n, "SOURCE_PAYOUT");
  if (d === 0n) {
    check(x === 0n && y === 0n, "SOURCE_PAYOUT");
    return 0;
  }
  check(x + y === d, "SOURCE_PAYOUT");
  return x === d && y === 0n ? 1 : y === d && x === 0n ? 2 : 3;
}
export function questionData(raw) {
  const bytes = Buffer.from(hex(raw, (raw.length - 2) / 2).slice(2), "hex");
  const u = (offset) => {
    check(offset >= 0 && offset + 32 <= bytes.length, "SOURCE_ABI");
    return BigInt("0x" + bytes.subarray(offset, offset + 32).toString("hex"));
  };
  check(u(0) === 32n, "SOURCE_ABI");
  const base = 32,
    off = Number(u(base + 11 * 32));
  check(off === 384, "SOURCE_ABI");
  const n = Number(u(base + off));
  check(
    n > 0 && n <= 8139 && base + off + 32 + n <= bytes.length,
    "SOURCE_ABI",
  );
  const ancillary = bytes.subarray(base + off + 32, base + off + 32 + n);
  return {
    ancillary,
    text: new TextDecoder("utf-8", { fatal: true }).decode(ancillary),
    creator:
      "0x" +
      bytes.subarray(base + 10 * 32 + 12, base + 11 * 32).toString("hex"),
    paused: u(base + 6 * 32) !== 0n,
    flagged: u(base + 4 * 32) !== 0n,
  };
}
export function verifyQuestion(t, raw) {
  const q = questionData(raw);
  check(keccak(q.ancillary) === t.question, "SOURCE_QUESTION_HASH");
  const prefix = `q: title: ${t.labels.join(" vs. ")}, description: ${t.description} market_id: ${t.marketId} res_data: p1: 0, p2: 1, p3: 0.5. Where p1 corresponds to ${t.labels[1]}, p2 to ${t.labels[0]}, p3 to unknown/50-50.`;
  const notice =
    " Updates made by the question creator via the bulletin board at 0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7 as described by https://polygonscan.com/tx/0xa14f01b115c4913624fc3f508f960f4dea252758e73c28f5f07f8e19d7bca066 should be considered.";
  check(
    q.text === prefix + notice + ",initializer:" + q.creator.slice(2),
    "SOURCE_QUESTION_MAPPING",
  );
  check(!q.paused && !q.flagged, "SOURCE_QUESTION_PAUSED");
  return q;
}
export function decodeUpdates(raw) {
  check(
    typeof raw === "string" && /^0x(?:[0-9a-fA-F]{64})+$/.test(raw),
    "SOURCE_UPDATE_ABI",
  );
  const b = Buffer.from(raw.slice(2), "hex");
  const u = (off) => {
    check(
      Number.isSafeInteger(off) && off >= 0 && off + 32 <= b.length,
      "SOURCE_UPDATE_ABI",
    );
    const n = BigInt("0x" + b.subarray(off, off + 32).toString("hex"));
    check(n <= BigInt(Number.MAX_SAFE_INTEGER), "SOURCE_UPDATE_ABI");
    return Number(n);
  };
  check(u(0) === 32, "SOURCE_UPDATE_ABI");
  const n = u(32);
  check(n <= 100, "SOURCE_UPDATE_ABI");
  let end = 64 + n * 32;
  const out = [];
  for (let i = 0; i < n; i++) {
    check(u(64 + i * 32) === end - 64, "SOURCE_UPDATE_ABI");
    const timestamp = u(end);
    check(timestamp > 0 && u(end + 32) === 64, "SOURCE_UPDATE_ABI");
    const length = u(end + 64);
    check(length <= 8192 && end + 96 + length <= b.length, "SOURCE_UPDATE_ABI");
    out.push({
      timestamp,
      data: b.subarray(end + 96, end + 96 + length).toString("hex"),
    });
    end += 96 + Math.ceil(length / 32) * 32;
  }
  check(end === b.length, "SOURCE_UPDATE_ABI");
  return out;
}
export async function boundedJSON(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  check(r.ok, "SOURCE_HTTP_" + r.status);
  const reader = r.body.getReader();
  let n = 0,
    parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      check(n <= 8_000_000, "SOURCE_SIZE");
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
export async function getMarket(id) {
  dec(id);
  const rows=await boundedJSON("https://gamma-api.polymarket.com/markets?id="+id);
  check(Array.isArray(rows)&&rows.length===1&&String(rows[0].id)===String(id),'SOURCE_MARKET_LOOKUP');
  return rows[0];
}
export async function inspect(
  t,
  { rpcCall, now = Math.floor(Date.now() / 1000) } = {},
) {
  const calls = [];
  const rpc = async (method, params) => {
    const request = { jsonrpc: "2.0", id: calls.length + 1, method, params };
    const response = rpcCall
      ? await rpcCall(request)
      : await boundedJSON("https://polygon-bor-rpc.publicnode.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
    calls.push({ request, response });
    check(!response.error && response.result !== undefined, "SOURCE_RPC");
    return response.result;
  };
  check((await rpc("eth_chainId", [])) === "0x89", "SOURCE_CHAIN");
  const block = await rpc("eth_getBlockByNumber", ["finalized", false]);
  hex(block.hash, 32);
  const blockTime = Number(BigInt(block.timestamp));
  check(blockTime <= now + 30 && now - blockTime <= 300, "SOURCE_STALE_BLOCK");
  const call = (to, sig, args) =>
    rpc("eth_call", [
      { to, data: keccak(new TextEncoder().encode(sig)).slice(0, 10) + args },
      block.number,
    ]);
  check(
    BigInt(
      await call(t.ctf, "getOutcomeSlotCount(bytes32)", t.condition.slice(2)),
    ) === 2n,
    "SOURCE_SLOTS",
  );
  check(
    (await call(t.oracle, "ctf()", "")).slice(-40).toLowerCase() ===
      SOURCE.ctf.slice(2),
    "SOURCE_ORACLE",
  );
  const q = verifyQuestion(
    t,
    await call(t.oracle, "getQuestion(bytes32)", t.question.slice(2)),
  );
  const updates = await call(
    t.oracle,
    "getUpdates(bytes32,address)",
    t.question.slice(2) + q.creator.slice(2).padStart(64, "0"),
  );
  if (decodeUpdates(updates).length > 0) {
    const err = Error("SOURCE_RULE_UPDATE");
    err.receipt = {
      observedAt: now,
      block: { number: block.number, hash: block.hash },
      terms: t,
      calls,
    };
    throw err;
  }
  for (let i = 0; i < 2; i++) {
    const collection = await call(
      t.ctf,
      "getCollectionId(bytes32,bytes32,uint256)",
      word(0) + t.condition.slice(2) + word(1 << i),
    );
    hex(collection, 32);
    const token = await call(
      t.ctf,
      "getPositionId(address,bytes32)",
      t.collateral.slice(2).padStart(64, "0") + collection.slice(2),
    );
    check(BigInt(token).toString() === t.tokens[i], "SOURCE_TOKEN_MAPPING");
  }
  const d = await call(
    t.ctf,
    "payoutDenominator(bytes32)",
    t.condition.slice(2),
  );
  const nums = [];
  for (let i = 0; i < 2; i++)
    nums.push(
      await call(
        t.ctf,
        "payoutNumerators(bytes32,uint256)",
        t.condition.slice(2) + word(i),
      ),
    );
  const again = await rpc("eth_getBlockByNumber", [block.number, false]);
  check(again.hash === block.hash, "SOURCE_BLOCK_CHANGED");
  const result = payout(d, ...nums),
    tuple = {
      termsHash: sha(t),
      condition: t.condition,
      denominator: BigInt(d).toString(),
      numerators: nums.map((x) => BigInt(x).toString()),
      result,
    };
  const receipt = {
    observedAt: now,
    block: { number: block.number, hash: block.hash, timestamp: blockTime },
    terms: t,
    tuple,
    calls,
  };
  return {
    result,
    tupleHash: sha(tuple),
    receiptHash: sha(receipt),
    receipt,
    block: Number(BigInt(block.number)),
    observedAt: now,
  };
}

function completeObservation(m) {
  try {
    check(
      m &&
        typeof m === "object" &&
        [
          "id",
          "version",
          "sportsMarketType",
          "slug",
          "question",
          "resolutionSource",
          "description",
          "conditionId",
          "questionID",
          "resolvedBy",
        ].every((k) => typeof m[k] === "string" && m[k].length > 0) &&
        typeof m.negRisk === "boolean",
      "SOURCE_INCOMPLETE",
    );
    const outcomes = arr(m.outcomes),
      tokens = arr(m.clobTokenIds);
    check(
      Array.isArray(outcomes) &&
        outcomes.length >= 2 &&
        outcomes.length <= 32 &&
        outcomes.every((x) => typeof x === "string" && x.length > 0) &&
        Array.isArray(tokens) &&
        tokens.length === outcomes.length &&
        tokens.every((x) => /^[1-9][0-9]{0,77}$/.test(x)),
      "SOURCE_INCOMPLETE",
    );
    check(
      Array.isArray(m.events) && m.events.length === 1,
      "SOURCE_INCOMPLETE",
    );
    const e = m.events[0];
    check(
      e &&
        ["id", "slug", "startTime", "eventDate", "version"].every(
          (k) => typeof e[k] === "string" && e[k].length > 0,
        ) &&
        Number.isSafeInteger(Number(e.gameId)) &&
        Number(e.gameId) > 0 &&
        typeof e.negRisk === "boolean" &&
        (e.live === undefined || typeof e.live === "boolean") &&
        (e.ended === undefined || typeof e.ended === "boolean"),
      "SOURCE_INCOMPLETE",
    );
    hex(m.conditionId, 32);
    hex(m.questionID, 32);
    hex(m.resolvedBy, 20);
  } catch {
    throw Error("SOURCE_INCOMPLETE");
  }
}
export function matchFrozen(t, m, now) {
  completeObservation(m);
  const e = m.events?.[0];
  check(e && m.events.length === 1, "SOURCE_EVENT");
  const next = Date.parse(e.startTime) / 1000;
  check(
    Number.isSafeInteger(next) &&
      new Date(next * 1000).toISOString() ===
        e.startTime.replace(/\.000Z$/, "Z").replace(/Z$/, ".000Z"),
    "SOURCE_START",
  );
  check(next >= t.cutoff, "SOURCE_EARLY_START");
  check(
    !(now < t.cutoff && (e.live === true || e.ended === true)),
    "SOURCE_EARLY_START",
  );
  const day=s=>new Date(s*1000).toISOString().slice(0,10);
  const etDay=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s*1000));
  check([day(t.start),etDay(t.start),day(next),etDay(next)].includes(e.eventDate),'SOURCE_GAME');
  const original = {
    ...m,
    events: [{ ...e, startTime: new Date(t.start * 1000).toISOString(), eventDate:day(t.start) }],
  };
  check(sha(normalize(original)) === sha(t), "SOURCE_TERMS_CHANGED");
  return true;
}
