import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';

const MAX_PAGE_SIZE = 50;

function canonicalType(type) {
  return String(type || '').replace(/0x([0-9a-fA-F]{1,64})/g, (_m, hex) => `0x${hex.replace(/^0+/, '') || '0'}`);
}

function legacyOwner(owner) {
  if (!owner) return null;
  if (owner.AddressOwner) return { AddressOwner: owner.AddressOwner };
  if (owner.ObjectOwner) return { ObjectOwner: owner.ObjectOwner };
  if (owner.Shared) return { Shared: owner.Shared };
  if (owner.Immutable != null) return 'Immutable';
  return owner;
}

function legacyEntry(object) {
  const type = canonicalType(object.type);
  return { data: {
    objectId: object.objectId,
    version: String(object.version),
    digest: object.digest,
    type,
    owner: legacyOwner(object.owner),
    previousTransaction: object.previousTransaction,
    content: object.json == null ? undefined : {
      dataType: 'moveObject', type, fields: object.json,
    },
    display: object.display ?? null,
    bcs: object.objectBcs ? { dataType: 'moveObject', type, bcsBytes: Buffer.from(object.objectBcs).toString('base64') } : undefined,
  }};
}

function typeMatches(type, filter) {
  type = canonicalType(type);
  if (!filter) return true;
  if (filter.StructType) return type === canonicalType(filter.StructType);
  if (filter.Package) return type.startsWith(`${canonicalType(filter.Package)}::`);
  if (filter.MoveModule) return type.startsWith(`${canonicalType(filter.MoveModule.package)}::${filter.MoveModule.module}::`);
  if (filter.MatchAll) return filter.MatchAll.every((f) => typeMatches(type, f));
  if (filter.MatchAny) return filter.MatchAny.some((f) => typeMatches(type, f));
  if (filter.MatchNone) return !filter.MatchNone.some((f) => typeMatches(type, f));
  return false;
}

function project(entry, options = {}) {
  const data = entry.data;
  const out = { objectId: data.objectId, version: data.version, digest: data.digest };
  if (options.showType) out.type = data.type;
  if (options.showOwner) out.owner = data.owner;
  if (options.showPreviousTransaction) out.previousTransaction = data.previousTransaction;
  if (options.showDisplay) out.display = data.display;
  if (options.showContent) out.content = data.content;
  if (options.showBcs) out.bcs = data.bcs;
  return { data: out };
}

function coinFromEntry(entry) {
  const data = entry.data;
  const match = String(data.type || '').match(/^0x2::coin::Coin<(.+)>$/);
  if (!match) return null;
  return {
    coinType: match[1], coinObjectId: data.objectId, version: data.version,
    digest: data.digest, balance: String(data.content?.fields?.balance ?? '0'),
    previousTransaction: data.previousTransaction,
  };
}

export class OwnershipGrpc {
  constructor({ url = process.env.SUI_GRPC_URL || 'http://127.0.0.1:9000', client } = {}) {
    this.url = url;
    if (client) this.client = client;
    else {
      const parsed = new URL(url);
      const secure = parsed.protocol === 'https:';
      this.client = new SuiGrpcClient({
        network: 'testnet',
        transport: new GrpcTransport({
          host: parsed.host,
          channelCredentials: secure ? credentials.createSsl() : credentials.createInsecure(),
        }),
      });
    }
  }

  async allObjects(owner) {
    const objects = [];
    let cursor;
    for (let page = 0; page < 10_000; page++) {
      const result = await this.client.listOwnedObjects({
        owner, cursor, limit: MAX_PAGE_SIZE,
        include: { content: true, previousTransaction: true, objectBcs: true, json: true, display: true },
      });
      objects.push(...result.objects.map(legacyEntry));
      if (!result.hasNextPage) return objects;
      if (!result.cursor) throw new Error('local gRPC pagination missing cursor');
      cursor = result.cursor;
    }
    throw new Error('local gRPC pagination safety cap reached');
  }

  async handle(method, params = []) {
    const owner = params[0];
    if (method === 'suix_getAllBalances' || method === 'suix_getBalance') {
      const [result, owned] = await Promise.all([
        this.client.listBalances({ owner, limit: MAX_PAGE_SIZE }),
        this.allObjects(owner),
      ]);
      if (result.hasNextPage) throw new Error('local gRPC balance pagination exceeded one page');
      const counts = new Map();
      for (const coin of owned.map(coinFromEntry).filter(Boolean)) {
        const type = canonicalType(coin.coinType);
        counts.set(type, (counts.get(type) || 0) + 1);
      }
      const rows = result.balances.map((b) => ({
        coinType: canonicalType(b.coinType), coinObjectCount: counts.get(canonicalType(b.coinType)) || 0,
        totalBalance: String(b.balance), lockedBalance: {},
        fundsInAddressBalance: String(b.addressBalance || '0'),
      }));
      if (method === 'suix_getAllBalances') return rows;
      const wanted = canonicalType(params[1] || '0x2::sui::SUI');
      return rows.find((row) => canonicalType(row.coinType) === wanted) || {
        coinType: wanted, coinObjectCount: 0, totalBalance: '0', lockedBalance: {}, fundsInAddressBalance: '0',
      };
    }

    let rows = await this.allObjects(owner);
    if (method === 'suix_getOwnedObjects') {
      const [query = {}, cursor = null, limit = 50] = params.slice(1);
      rows = rows.filter((entry) => typeMatches(entry.data.type, query.filter));
      if (cursor) { const i = rows.findIndex((entry) => entry.data.objectId === cursor); if (i >= 0) rows = rows.slice(i + 1); }
      const n = Math.min(Math.max(Number(limit) || 50, 1), MAX_PAGE_SIZE);
      const page = rows.slice(0, n);
      return { data: page.map((entry) => project(entry, query.options)), nextCursor: rows.length > n ? page.at(-1).data.objectId : null, hasNextPage: rows.length > n };
    }
    if (method === 'suix_getCoins' || method === 'suix_getAllCoins') {
      rows = rows.map(coinFromEntry).filter(Boolean);
      const coinType = method === 'suix_getCoins' ? canonicalType(params[1] || '0x2::sui::SUI') : null;
      const cursor = method === 'suix_getCoins' ? params[2] : params[1];
      const limit = method === 'suix_getCoins' ? params[3] : params[2];
      if (coinType) rows = rows.filter((coin) => canonicalType(coin.coinType) === coinType);
      if (cursor) { const i = rows.findIndex((coin) => coin.coinObjectId === cursor); if (i >= 0) rows = rows.slice(i + 1); }
      const n = Math.min(Math.max(Number(limit) || 50, 1), MAX_PAGE_SIZE);
      const page = rows.slice(0, n);
      return { data: page, nextCursor: rows.length > n ? page.at(-1).coinObjectId : null, hasNextPage: rows.length > n };
    }
    throw new Error(`unsupported ownership method: ${method}`);
  }
}

export { canonicalType, legacyEntry };
