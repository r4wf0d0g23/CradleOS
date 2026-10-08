# Native casino station pilot — release 2026-10-08

Live: **https://cradleos.io/#/casino-station**

- Source: `3f2f4c1d8e9f3b8a79b11be8b468f326b7d2248d`, pushed on `cycle7-vestiges-20261002`.
- Pages production: `91253fe3-fbde-4c53-8bb3-0bc6b6d4ced3`.
- Previous app rollback: `934b20d7-7c3b-428a-9035-c619e4881e42`.
- App bundles match the reviewed build byte-for-byte; see `qualification/live-build.json`.

## Delivered

Native Carbon/Trinity DX11 on DGX2 renders an originally authored 34-terminal
casino. Two visitors receive independent camera/input sessions automatically.
AV1 hardware encoding, WebCodecs display and JPEG fallback use a bounded public
TLS WebSocket route. This is not a browser Carbon port or a shared desktop.

The browser retains all casino games, saved practice state and wallet activity.
Entering a game or directory releases render capacity. The main casino has a
Station entry; generic Assembly owner controls have a Casino Station dApp preset.
No wallet transaction was signed for the release. Testnet wagering HOLD and
seed-only donations are unchanged.

## Actual live verification

Parent qualification used real production HTML/assets and external Funnel
ingress, with no app response fixtures and no MagicDNS shortcut:

- Two independent browser processes received native frames; movement in one did
  not move the other. The final live sample measured 15.3/16.3 fps at 1.84/1.97 Mbps;
  earlier public candidate runs measured approximately 19/20 fps at 2.3/2.4 Mbps.
- Desktop and 390px touch layout, fullscreen enter/exit and native-to-game-to-native
  return passed. Saved Craps escrow remained byte-identical, with no page errors.
- Production bundle hashes match, and all owned test clients closed afterward.
- 318 frontend tests, six service tests and 17 isolated interruption/cleanup
  probes passed; installed renderer stop/verified Wine cleanup/restart passed.
- Source publication, financial-boundary and operational reviews are recorded
  beside this file. A separate live review records independent verification.

This is a **two-visitor pilot**, not a throughput or availability guarantee.
It has no shared multiplayer avatars. Actual EVE embedded-browser behavior and
owner-signed in-game Assembly assignment remain unverified. H.264 encode was
proved, but the host's ARM Chromium cannot decode it; AV1/JPEG were browser-tested.

## Operations

Enabled user units: `cradle-station-render.service` and
`cradle-station-gateway.service`. Source units and supervisor implementation are
included in this release. IPC is private tmpfs; gateway listens only on loopback.
Idle, maximum visit time, input rate, packet/frame size, decoder/encoder queues,
connection count and draining-slot admission are bounded.

The public media route is **only Funnel HTTPS port 10000**. Existing private
4174/443/8443 routes were compared and preserved. Provider bandwidth limitations
apply; no paid service was purchased. Cloudflare hosts the app, not native video.
Initial public TLS registration failure was resolved by re-registering only
the new port 10000 route; no daemon restart, ACL relaxation or route reset.

Media rollback: `tailscale funnel --https=10000 off`, then stop the two station
units if retiring the pilot. Never run an unscoped Funnel reset or alter the
private gateway/VNC routes. Renderer cleanup is fail-closed: investigate any
`.production-cleanup-required` marker rather than deleting it. The app's game
directory remains usable when native streaming is unavailable.

The owned Vite test listener on port 5320 was stopped after deployment.
