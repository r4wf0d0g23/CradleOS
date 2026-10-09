// Aggregate wallet activity only. No signing, transactions, or identity sessions.
import { fromBase58 } from '@mysten/sui/utils';

export const DAY = 86_400_000;
export const WINDOW = 30 * DAY;
export const FRESH_MS = 25 * 60_000;
export const POLL_MS = 10 * 60_000;
export const TRANSACTIONS = `query Activity($pkg: String!, $before: String, $checkpoint: UInt53!) {
  transactions(last: 50, before: $before, filter: {function: $pkg, beforeCheckpoint: $checkpoint}) {
    nodes { digest sender { address } effects { status timestamp } }
    pageInfo { hasPreviousPage startCursor }
  }
}`;
export function address(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(value)) throw new Error('bad_address');
  return `0x${value.slice(2).toLowerCase().padStart(64, '0')}`;
}
const iso = ms => new Date(ms).toISOString();
const day = ms => iso(ms).slice(0, 10);

export function parseProof(body, now) {
  const claimed = address(body?.address);
  if (typeof body.signature !== 'string' || body.signature.length > 20_000 || !body.signature.length) throw new Error('bad_signature');
  if (typeof body.challenge !== 'string' || body.challenge.length > 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.challenge)) throw new Error('bad_challenge');
  const bytes = Buffer.from(body.challenge, 'base64');
  if (bytes.toString('base64') !== body.challenge) throw new Error('bad_challenge');
  const match = /^CradleOS identity verification\nNonce: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\nTimestamp: ([0-9]{13})$/i.exec(bytes.toString('utf8'));
  if (!match) throw new Error('bad_challenge');
  const signedAt = Number(match[2]);
  if (signedAt < now - 5 * 60_000 || signedAt > now + 30_000) throw new Error('expired_challenge');
  return { claimed, bytes, signedAt, signature: body.signature };
}

export function createActivity({ db, config, verify, fetchImpl = fetch, now = Date.now, maxPages = 20 }) {
  const packages = Object.values(config.packages).map(address).sort();
  const scope = JSON.stringify({ chainId: config.chainId, packages });
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_wallet_v2(address TEXT, day TEXT, ts INTEGER NOT NULL, PRIMARY KEY(address,day));
    CREATE INDEX IF NOT EXISTS activity_wallet_ts ON activity_wallet_v2(ts);
    CREATE TABLE IF NOT EXISTS activity_chain_v2(pkg TEXT, digest TEXT, address TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(pkg,digest));
    CREATE INDEX IF NOT EXISTS activity_chain_ts ON activity_chain_v2(ts);
    CREATE TABLE IF NOT EXISTS activity_meta_v2(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const getMeta = key => db.prepare('SELECT value FROM activity_meta_v2 WHERE key=?').get(key)?.value;
  const setMeta = (key, value) => db.prepare('INSERT OR REPLACE INTO activity_meta_v2 VALUES (?,?)').run(key, String(value));
  if (!getMeta('wallet_since')) setMeta('wallet_since', iso(now()));
  const storeProof = db.prepare(`INSERT INTO activity_wallet_v2 VALUES (?,?,?) ON CONFLICT(address,day) DO UPDATE SET ts=MAX(ts,excluded.ts)`);
  const saveChain = (rows, snapshot) => {
    db.exec('BEGIN IMMEDIATE');
    try {
    db.prepare('DELETE FROM activity_chain_v2').run();
    const insert = db.prepare('INSERT OR IGNORE INTO activity_chain_v2 VALUES (?,?,?,?)');
    for (const row of rows) insert.run(row.pkg, row.digest, row.address, row.ts);
    setMeta('snapshot', JSON.stringify(snapshot));
    setMeta('scope', scope);
    setMeta('poll_error', '');
    db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };

  async function verifyPing(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    let proof;
    try { proof = parseProof(req.body, now()); }
    catch { return res.status(400).json({ error: 'invalid_or_expired_proof' }); }
    try {
      // address verification must be performed by SDK (including zkLogin aliases).
      await verify(proof.bytes, proof.signature, proof.claimed);
      // Never extend a replay to a new day or timestamp; recheck after async work.
      parseProof(req.body, now());
      storeProof.run(proof.claimed, day(proof.signedAt), proof.signedAt);
      return res.json({ ok: true, verified: true });
    } catch {
      // Unsupported/unavailable verification is NOT a verified wallet.
      return res.status(401).json({ error: 'proof_not_verified', verified: false });
    }
  }

  async function graphql(query, variables = {}) {
    const response = await fetchImpl(config.graphql, { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`graphql_http_${response.status}`);
    const result = await response.json();
    if (result.errors?.length || !result.data) throw new Error('graphql_incomplete_response');
    return result.data;
  }

  let running = null;
  async function scan() {
    const started = now();
    try {
      const root = await graphql('{ chainIdentifier checkpoints(last:1) { nodes { sequenceNumber timestamp } } earliest: checkpoints(first:1) { nodes { timestamp } } }');
      const chainId = Buffer.from(fromBase58(root.chainIdentifier)).subarray(0, 4).toString('hex');
      if (chainId !== config.chainId) throw new Error('chain_mismatch');
      const checkpoint = root.checkpoints?.nodes?.[0];
      const indexedAt = Date.parse(checkpoint?.timestamp);
      if (!Number.isSafeInteger(checkpoint?.sequenceNumber) || !Number.isFinite(indexedAt) || indexedAt > started + 30_000 || indexedAt < started - FRESH_MS) throw new Error('index_not_current');
      const retainedFrom = Date.parse(root.earliest?.nodes?.[0]?.timestamp);
      if (!Number.isFinite(retainedFrom) || retainedFrom > started - WINDOW) throw new Error('history_not_retained');
      const rows = [];
      const packageCounts = {};
      for (const pkg of packages) {
        let before = null, complete = false, total = 0;
        const cursors = new Set();
        for (let page = 0; page < maxPages; page++) {
          const result = await graphql(TRANSACTIONS, {pkg, before, checkpoint: checkpoint.sequenceNumber + 1});
          const connection = result.transactions;
          if (!Array.isArray(connection?.nodes) || typeof connection.pageInfo?.hasPreviousPage !== 'boolean') throw new Error('invalid_page');
          let oldest = Infinity;
          // `last` pages are oldest→newest within each page: process ALL nodes.
          for (const tx of connection.nodes) {
            const ts = Date.parse(tx.effects?.timestamp);
            if (!Number.isFinite(ts) || ts > indexedAt || typeof tx.digest !== 'string' || !tx.digest || !['SUCCESS','FAILURE'].includes(tx.effects?.status)) throw new Error('invalid_transaction');
            oldest = Math.min(oldest, ts);
            if (ts < started - WINDOW || tx.effects.status !== 'SUCCESS') continue;
            rows.push({pkg, digest:tx.digest, address:address(tx.sender?.address), ts});
            total++;
          }
          if (!connection.pageInfo.hasPreviousPage || oldest < started - WINDOW) { complete = true; break; }
          before = connection.pageInfo.startCursor;
          if (!connection.nodes.length || typeof before !== 'string' || !before || cursors.has(before)) throw new Error('pagination_stalled');
          cursors.add(before);
        }
        if (!complete) throw new Error('scan_page_limit');
        packageCounts[pkg] = total;
      }
      if (now() - indexedAt > FRESH_MS) throw new Error('scan_too_old');
      const snapshot = { checked_at: iso(now()), indexed_at: iso(indexedAt), checkpoint:checkpoint.sequenceNumber, package_counts:packageCounts };
      saveChain(rows, snapshot);
      return { ok:true, transactions:rows.length, ...snapshot };
    } catch (error) {
      // Don't let upstream details, wallet addresses or signatures reach public responses.
      setMeta('poll_error', 'scan_incomplete');
      return { ok:false, reason:error instanceof Error ? error.message : 'scan_failed' };
    }
  }
  function poll() {
    if (!running) running = scan().finally(() => { running = null; });
    return running;
  }

  function summary() {
    const at = now(), cutoff = at - WINDOW;
    const snapshot = getMeta('scope') === scope ? JSON.parse(getMeta('snapshot') || 'null') : null;
    const available = snapshot && !getMeta('poll_error') && at - Date.parse(snapshot.indexed_at) <= FRESH_MS;
    const wallet = db.prepare('SELECT COUNT(DISTINCT address) AS n FROM activity_wallet_v2 WHERE ts>=? AND ts<=?').get(cutoff, at).n;
    const dau = db.prepare('SELECT COUNT(DISTINCT address) AS n FROM activity_wallet_v2 WHERE day=? AND ts<=?').get(day(at), at).n;
    const chain = available ? db.prepare('SELECT COUNT(DISTINCT address) AS n FROM activity_chain_v2 WHERE ts>=? AND ts<=?').get(cutoff, at).n : null;
    const combined = available ? db.prepare(`SELECT COUNT(*) AS n FROM (SELECT address FROM activity_wallet_v2 WHERE ts>=? AND ts<=?
      UNION SELECT address FROM activity_chain_v2 WHERE ts>=? AND ts<=?)`).get(cutoff, at, cutoff, at).n : null;
    return { schema_version:2, metric:'verified_wallets', cycle:config.cycle, chain_id:config.chainId, window_days:30,
      since:iso(cutoff), generated_at:iso(at), wallet_mau:wallet, wallet_dau:dau, onchain_mau:chain, combined_mau:combined,
      wallet_coverage_since:getMeta('wallet_since'), onchain_status:available ? 'current' : snapshot ? 'stale' : 'unavailable',
      onchain_indexed_at:snapshot?.indexed_at ?? null, onchain_checked_at:snapshot?.checked_at ?? null,
      packages, note:'Unique verified wallet addresses, not people, visits or game rounds. Successful calls to current-cycle app packages plus fresh identity proofs; repeat wallets count once. Legacy unverified pings excluded. Wallet proofs were not reliably verified before wallet_coverage_since; a full month of site use cannot be reconstructed.' };
  }
  function send(res, payload) { res.setHeader('Cache-Control','no-store'); return res.json(payload); }
  const combined = (_req,res) => send(res, summary());
  const mau = (_req,res) => { const s=summary(); return send(res,{...s,source:'verified_wallet_proofs',mau:s.wallet_mau,dau:s.wallet_dau}); };
  const onchain = (_req,res) => { const s=summary(); return send(res,{...s,source:'successful_package_calls',mau:s.onchain_mau}); };
  let timer;
  function start() { if (timer) return; void poll(); timer=setInterval(() => { void poll(); },POLL_MS); timer.unref?.(); }
  function stop() { clearInterval(timer); timer=null; }
  return { verifyPing, summary, poll, combined, mau, onchain, start, stop };
}
