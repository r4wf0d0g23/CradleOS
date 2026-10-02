const DEFAULT_TTL_MS = Number(process.env.OWNERSHIP_CACHE_TTL_MS || 300_000);
const DEFAULT_MAX_STALE_MS = Number(process.env.OWNERSHIP_CACHE_MAX_STALE_MS || 86_400_000);
const MAX_PAGE_SIZE = 50;

function normalizeAddress(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(raw)) throw new Error('invalid Sui address');
  return `0x${raw.slice(2).padStart(64, '0')}`;
}

async function rpc(url, method, params, timeoutMs = 20_000) {
  if (!url) throw new Error('SUI_ALCHEMY_RPC is not configured');
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Alchemy HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`Alchemy ${method}: ${body.error.message}`);
  return body.result;
}

function typeMatches(type, filter) {
  if (!filter) return true;
  if (filter.StructType) return type === filter.StructType;
  if (filter.Package) return type.startsWith(`${filter.Package}::`);
  if (filter.MoveModule) return type.startsWith(`${filter.MoveModule.package}::${filter.MoveModule.module}::`);
  if (filter.MatchAll) return filter.MatchAll.every((f) => typeMatches(type, f));
  if (filter.MatchAny) return filter.MatchAny.some((f) => typeMatches(type, f));
  if (filter.MatchNone) return !filter.MatchNone.some((f) => typeMatches(type, f));
  return false;
}

function projectObject(entry, options = {}) {
  const data = entry?.data;
  if (!data) return entry;
  const out = { objectId: data.objectId, version: data.version, digest: data.digest };
  if (options.showType) out.type = data.type;
  if (options.showOwner) out.owner = data.owner;
  if (options.showPreviousTransaction) out.previousTransaction = data.previousTransaction;
  if (options.showDisplay) out.display = data.display;
  if (options.showContent) out.content = data.content;
  if (options.showBcs) out.bcs = data.bcs;
  if (options.showStorageRebate) out.storageRebate = data.storageRebate;
  return { data: out };
}

function coinFromEntry(entry) {
  const data = entry?.data;
  const match = String(data?.type || '').match(/^0x0*2::coin::Coin<(.+)>$/);
  if (!match) return null;
  return {
    coinType: match[1], coinObjectId: data.objectId, version: String(data.version),
    digest: data.digest, balance: String(data?.content?.fields?.balance ?? '0'),
    previousTransaction: data.previousTransaction,
  };
}

export class OwnershipCache {
  constructor(db, { alchemyUrl = process.env.SUI_ALCHEMY_RPC, ttlMs = DEFAULT_TTL_MS, maxStaleMs = DEFAULT_MAX_STALE_MS } = {}) {
    this.db = db; this.alchemyUrl = alchemyUrl; this.ttlMs = ttlMs; this.maxStaleMs = maxStaleMs; this.inflight = new Map();
  }
  state(owner) { return this.db.prepare('SELECT * FROM wallet_sync_state WHERE owner=?').get(owner) || null; }
  markAccess(owner) {
    this.db.prepare(`INSERT INTO wallet_sync_state(owner,last_access_ms) VALUES(?,?)
      ON CONFLICT(owner) DO UPDATE SET last_access_ms=excluded.last_access_ms`).run(owner, Date.now());
  }
  async ensureFresh(owner, { force = false } = {}) {
    owner = normalizeAddress(owner); this.markAccess(owner);
    const state = this.state(owner);
    if (!force && state?.last_ok_ms && Date.now() - state.last_ok_ms <= this.ttlMs) return state;
    if (this.inflight.has(owner)) return this.inflight.get(owner);
    const promise = this.refresh(owner).catch((error) => {
      // Availability fallback: retain a complete prior snapshot for a bounded
      // window when Alchemy is temporarily unreachable. Never serve an empty
      // or arbitrarily old cache as healthy.
      const prior = this.state(owner);
      if (prior?.last_ok_ms && Date.now() - prior.last_ok_ms <= this.maxStaleMs) return prior;
      throw error;
    }).finally(() => this.inflight.delete(owner));
    this.inflight.set(owner, promise); return promise;
  }
  async refresh(owner) {
    owner = normalizeAddress(owner); const attemptMs = Date.now();
    this.db.prepare(`INSERT INTO wallet_sync_state(owner,last_attempt_ms,last_access_ms) VALUES(?,?,?)
      ON CONFLICT(owner) DO UPDATE SET last_attempt_ms=excluded.last_attempt_ms,last_access_ms=excluded.last_access_ms,last_error=NULL`)
      .run(owner, attemptMs, attemptMs);
    try {
      const objects = []; let cursor = null;
      for (let page = 0; page < 10_000; page++) {
        const result = await rpc(this.alchemyUrl, 'suix_getOwnedObjects', [owner, {
          options: { showType: true, showOwner: true, showContent: true, showPreviousTransaction: true, showStorageRebate: true }
        }, cursor, MAX_PAGE_SIZE]);
        for (const entry of result?.data || []) if (entry?.data?.objectId) objects.push(entry);
        if (!result?.hasNextPage) break;
        if (!result.nextCursor) throw new Error('Alchemy pagination missing nextCursor');
        cursor = result.nextCursor;
        if (page === 9_999) throw new Error('Alchemy pagination safety cap reached');
      }
      const [checkpointRaw, balances] = await Promise.all([
        rpc(this.alchemyUrl, 'sui_getLatestCheckpointSequenceNumber', []),
        rpc(this.alchemyUrl, 'suix_getAllBalances', [owner]),
      ]);
      const checkpoint = Number(checkpointRaw);
      const now = Date.now();
      const insert = this.db.prepare('INSERT INTO wallet_objects(owner,object_id,type_full,object_json,refreshed_ms) VALUES(?,?,?,?,?)');
      this.db.transaction(() => {
        this.db.prepare('DELETE FROM wallet_objects WHERE owner=?').run(owner);
        for (const entry of objects) insert.run(owner, entry.data.objectId, entry.data.type || '', JSON.stringify(entry), now);
        this.db.prepare(`UPDATE wallet_sync_state SET last_ok_ms=?,last_attempt_ms=?,object_count=?,checkpoint=?,balances_json=?,last_error=NULL WHERE owner=?`)
          .run(now, attemptMs, objects.length, checkpoint, JSON.stringify(balances || []), owner);
      })();
      return this.state(owner);
    } catch (error) {
      this.db.prepare('UPDATE wallet_sync_state SET last_error=? WHERE owner=?').run(String(error.message).slice(0, 500), owner);
      throw error;
    }
  }
  entries(owner) {
    owner = normalizeAddress(owner);
    return this.db.prepare('SELECT object_json FROM wallet_objects WHERE owner=? ORDER BY object_id').all(owner).map((r) => JSON.parse(r.object_json));
  }
  ownedObjects(owner, query = {}, cursor = null, limit = 50) {
    let rows = this.entries(owner).filter((e) => typeMatches(e?.data?.type || '', query?.filter));
    if (cursor) { const i = rows.findIndex((e) => e?.data?.objectId === cursor); if (i >= 0) rows = rows.slice(i + 1); }
    const n = Math.min(Math.max(Number(limit) || 50, 1), MAX_PAGE_SIZE); const page = rows.slice(0, n);
    return { data: page.map((e) => projectObject(e, query?.options || {})), nextCursor: rows.length > n ? page.at(-1)?.data?.objectId || null : null, hasNextPage: rows.length > n };
  }
  coins(owner, coinType = null, cursor = null, limit = 50) {
    let rows = this.entries(owner).map(coinFromEntry).filter(Boolean);
    if (coinType) rows = rows.filter((c) => c.coinType === coinType);
    if (cursor) { const i = rows.findIndex((c) => c.coinObjectId === cursor); if (i >= 0) rows = rows.slice(i + 1); }
    const n = Math.min(Math.max(Number(limit) || 50, 1), MAX_PAGE_SIZE); const page = rows.slice(0, n);
    return { data: page, nextCursor: rows.length > n ? page.at(-1)?.coinObjectId || null : null, hasNextPage: rows.length > n };
  }
  balances(owner, coinType = null) {
    const state = this.state(normalizeAddress(owner));
    let rows = [];
    try { rows = JSON.parse(state?.balances_json || '[]'); } catch { rows = []; }
    return coinType ? rows.filter((row) => row.coinType === coinType) : rows;
  }
  async handle(method, params) {
    const owner = params?.[0]; await this.ensureFresh(owner);
    if (method === 'suix_getOwnedObjects') return this.ownedObjects(owner, params[1], params[2], params[3]);
    if (method === 'suix_getCoins') return this.coins(owner, params[1], params[2], params[3]);
    if (method === 'suix_getAllCoins') return this.coins(owner, null, params[1], params[2]);
    if (method === 'suix_getBalance') return this.balances(owner, params[1])[0] || { coinType: params[1], coinObjectCount: 0, totalBalance: '0', lockedBalance: {}, fundsInAddressBalance: '0' };
    if (method === 'suix_getAllBalances') return this.balances(owner);
    throw new Error(`unsupported ownership method: ${method}`);
  }
  health() {
    const row = this.db.prepare(`SELECT COUNT(*) AS wallets,COALESCE(SUM(object_count),0) AS objects,
      MAX(last_ok_ms) AS latest_ok_ms,SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) AS wallets_with_errors
      FROM wallet_sync_state`).get();
    return { ...row, ttlMs: this.ttlMs, maxStaleMs: this.maxStaleMs, inflight: this.inflight.size, alchemyConfigured: Boolean(this.alchemyUrl) };
  }
}

export { normalizeAddress };
