# CradleOS Agent Proxy

OpenAI-compatible proxy in front of Nemotron3-Super on the DGX.

## Architecture

```
External users / CradleOS dApp
         │
         ▼
  cradleos-agent-proxy :4403  (this server)
    - Rate limiting (20 req/min/IP)
    - System prompt injection
    - Training data logging
    - Read-only enforcement
         │
         ▼
  vLLM :8001  (Nemotron3-Super local)
         │
         ▼
  Training pipeline (logged to training_logs/*.jsonl)
```

## Running

```bash
npm install
PORT=4403 UPSTREAM=http://localhost:8001 node server.js
```

With auth:
```bash
CRADLEOS_AGENT_KEY=your-key node server.js
```

## Endpoints

- `GET /health` — health check
- `GET /v1/models` — model list (passthrough)
- `POST /v1/chat/completions` — chat (system prompt injected, logged)
- `POST /v1/feedback` — quality label for training sample

## Training Data

Every query/response pair is logged to `training_logs/YYYY-MM-DD.jsonl`.
Format: `{ ts, ip, messages, response, context, quality }`.

Use feedback endpoint to label quality. Export for fine-tuning:
```bash
cat training_logs/*.jsonl | python3 scripts/export_finetune.py > dataset.jsonl
```

## Custom Agent Plugin

Users can point any OpenAI-compatible endpoint here instead of the default.
The same system prompt is injected so their model understands the CradleOS context.
The CradleOS dApp sends `?agent_url=https://your-endpoint` to switch.

## Tailscale Funnel (public access)

```bash
tailscale funnel --bg 4403
# or
tailscale serve --https=443 http://localhost:4403
```
