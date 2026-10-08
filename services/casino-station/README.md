> **RETIRED 2026-10-08 by Raw.** The walk-in station was rejected and shut down.
> Both units are disabled; public media port 10000 is removed. This source is
> retained only as an archive. Do not restart or redeploy without a new request.
> The supported interface is https://cradleos.io/#/casino.

# Native Carbon station — two-visitor pilot

This service renders an authored interior using the host's qualified native
Carbon/Trinity DX11 runtime under Wine/FEX on DGX2. The browser decodes live
AV1/H.264 or bounded JPEG frames and sends movement only. This is not a browser
port of Carbon, WebRTC, shared desktop, shared wallet, or multiplayer avatars.

## Boundaries

- Two independent camera/encoder slots, including encoders that are draining.
- Origin allowlist (not authentication); anonymous pilot, susceptible to slot
  monopolization. Finite20-minute visit,3-minute input-idle timeout,250ms input
  deadman, heartbeat, native health/frame freshness, sessionUUID binding.
  -32 HTTP connections;5-second headers, bounded512-byte input and45 messages/sec;
  fixed IPC/codec/command arguments. Encoded packet ceiling256KiB, bounded queues,
  disconnect on sustained network backpressure; no unbounded render work queue.
- Entering a browser game/directory, leaving or hiding releases the native slot.
  Exactly one existing CasinoExperience owns practice saves. No ledger formats,
  outcomes, payouts or testnet wager restrictions change. Donations remain seed-only.
- Public media: only dedicated Tailscale Funnel10000. **Never expose/reset443 or
  8443**, which serve private gateway/VNC. Funnel has provider bandwidth limits;
  this is a capped pilot, not an unlimited-capacity or production-SLA claim.
- Native files use fixed private tmpfs IPC, owner-generated isolated jobs and
  qualified cleanup receipts. Retain2 completed runtimes; older service-owned
  generated copies are removed only after verified Wine cleanup, preserving
  receipts. Current render holds the qualified global render lock.

## Runtime

Host prerequisites are already installed, not provisioned by npm: qualified
`/home/rawdata/frontier-client/compat`, NVIDIA NVENC ffmpeg, FEX/Wine, Python/PIL/
NumPy, native Carbon Mesh exporter (authoring only). No proprietary DLLs are
committed. The authored mesh, terminal art and source are under native/.

`npm ci --ignore-scripts` then gateway `node server.mjs /dev/shm/cradle-station-1000`.
Native runner `python3 native/supervise.py`; systemd user units recorded in deploy/.
For local qualification only, STATION_LOCAL=1 permits exact local5320/5318 origins.
Normal release origin is only https://cradleos.io. No service HTML/admin endpoint.
Stop native runner with SIGTERM to let it write shutdown and confirm Wine cleanup;
never kill arbitrary Wine processes. A cleanup-required marker fails closed.

App route `https://cradleos.io/#/casino-station`. The owner can select the Casino
Station Assembly URL preset and sign normally. Query context is not ownership.
Actual EVE embedded-browser and on-chain assignment are unverified until exercised.

## Measured local qualification

2x960x540 views,~19fps each. AV1 around2.3Mbps/view. Applied-input sequence tracked
through GPU readback, encode, transport and browser presentation: two local
200-sample windows p50~165–191ms,p95~216–243ms (not WAN/mobile promises).
H.264 hardware encoder exists; this host's Chromium lacks H.264 decoding.
AV1 browser path and JPEG fallback exercised. See deploy/casino-station-20261008.
