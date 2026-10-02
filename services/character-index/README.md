# character-index

Real-time index of EVE Frontier `Character` objects on Sui testnet (Stillness + Utopia), served from DGX2's local fullnode.

## Why

The CradleOS QUERY panel previously walked ~15,000 paginated GraphQL pages on every cold load (30–60s). This service moves that walk off the dApp: SQLite-backed substring search returns in <50ms.

## Architecture

* **Initial backfill** — enumerates current `Character` object IDs via the public Sui GraphQL endpoint (the only API that does `objects-by-type` enumeration). Content for each ID batch is read from the LOCAL fullnode at `127.0.0.1:9000` via `sui_multiGetObjects` (no rate limits).
* **Incremental polling** — every 60s, reads recent `CharacterCreatedEvent` from the LOCAL `suix_queryEvents`. New IDs are content-fetched the same way. A persistent `(txDigest, eventSeq)` watermark prevents reprocessing.
* **Persistent state** — `./data/characters.sqlite`. WAL mode. Crash-safe.
* **HTTP API** — Express on port 8004, served via Tailscale → Cloudflare ingress on DGX1 (`keeper.reapers.shop/index/*`).
* **Wallet ownership compatibility bridge** — `ownership-grpc.js` translates the local Sui gRPC `StateService` into the five legacy `suix_*` owner/coin/balance response shapes consumed by the dApp. `ownership-cache.js` is the persistent recovery tier: it atomically seeds complete wallet snapshots from paid Alchemy, refreshes hot wallets every five minutes, and retains the last complete snapshot for at most 24 hours. Provider order is local gRPC → recovered SQLite snapshot → direct Alchemy fallback in `sui-proxy`.

## Endpoints

| Path | Notes |
|---|---|
| `GET /health` | Liveness + per-server row counts and last-poll timestamps |
| `GET /character-count?server={stillness\|utopia}` | Row count for one server |
| `GET /character-search?q=foo&server=stillness&limit=50` | Substring search on name / character_addr / object_id. `q=*` returns A–Z list capped at `limit`. Sub-50ms. |
| `GET /character-by-id?id=0x...&server=stillness` | Exact lookup |
| `GET /ownership-health` | Wallet-cache count, freshness, error count, and Alchemy configuration status |
| `POST /ownership-rpc` | Loopback-only JSON-RPC adapter for `sui-proxy` |
| `POST /ownership-refresh` | Loopback-only forced wallet refresh (`{"owner":"0x..."}`) |

## Operations

| Action | Command |
|---|---|
| One-shot backfill (initial seed) | `npm run backfill` |
| One-shot poll | `npm run poll-once` |
| Start service | `systemctl --user start character-index` |
| Tail logs | `journalctl --user -u character-index -f` |
| Force wallet recovery | `curl -X POST http://127.0.0.1:8004/ownership-refresh -H 'Content-Type: application/json' -d '{"owner":"0x..."}'` |
| Wallet-cache health | `curl http://127.0.0.1:8004/ownership-health` |

## Files

* `db.js` — SQLite schema + upsert/search helpers
* `indexer.js` — backfill + poll logic
* `server.js` — Express HTTP API
* `ownership-grpc.js` — native local Sui gRPC client and legacy JSON-RPC compatibility translation
* `ownership-cache.js` — Alchemy bootstrap, atomic SQLite replacement, filtering, pagination, and coin/balance projections

## Ownership recovery safety gates

1. Alchemy pagination must finish completely before SQLite changes.
2. `wallet_objects` replacement and `wallet_sync_state` advancement occur in one transaction.
3. Internal RPC/refresh endpoints accept loopback clients only.
4. Proxy routes only the five supported methods to this service.
5. A local error falls directly to Alchemy; generic upstream rotation is not trusted for ownership correctness.
6. Verify object IDs, coin IDs, balances, filters, and pagination against Alchemy before changing routing.

## Tenant config drift

`indexer.js TENANTS` mirrors `cradleos-dapp/src/lib/tenantConfig.ts`. When CCP rotates world package IDs, update both.
