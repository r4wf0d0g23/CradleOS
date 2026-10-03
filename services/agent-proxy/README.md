# Shared agent proxy: Keeper retirement

The live proxy is `/home/rawdata/cradleos-agent-proxy/server.js` and runs as
`cradleos-agent.service`. It is NOT dedicated to Keeper. Do not disable it or
the `cloudflared-keeper` tunnel: telemetry, images, indexed reads, Origins media,
and Sui APIs share this infrastructure/domain.

`retired-keeper.mjs` retires Keeper-only HTTP surfaces with 410 Gone before
body parsing or legacy handlers. Public CORS preflights return 204; no request
can reach chat inference, submissions, OCR, RAG queries, or training feedback.
Historical source/data is retained locally, not deleted. Shared model servers
and embeddings remain untouched. On-chain contracts are immutable history;
this removal does not transact, reclaim offerings, or migrate funds.

Deployment:

1. Back up `server.js` to the proxy's local `backups/` directory.
2. Copy `retired-keeper.mjs` beside it; import `retireKeeper` from that module.
3. Mount `app.use(retireKeeper)` immediately after `app.set("trust proxy", 1)`,
   BEFORE `express.json`, limiter, auth, and old routes.
4. Change `/health` to identify Keeper as retired, without advertising a model.
5. Syntax-check, restart only `cradleos-agent.service`, then verify local and
   public retired endpoints return 410 while telemetry and shared APIs work.

Tests: `node --test services/agent-proxy/retired-keeper.test.mjs`.
Rollback: restore the saved `server.js`, restart the same service. No tunnel,
chain, telemetry database, shared image, or Origins configuration changes.
