# Hosted native station — selected direction

Raw (2026-10-08 16:33 CT): host a render server and let visitors join when they
access the dApp. Proceed with native streaming; supersedes the pending renderer
choice in PLAN.md. No further runtime-choice confirmation is needed.

## Hosting contract

- DGX2 hosts the existing native Carbon/Trinity DX11 runtime. A live ffmpeg
  H.264 NVENC encode passed (120 synthetic 720p frames at 14.1x realtime); this
  establishes encoder availability, NOT concurrent casino/player capacity.
- One isolated native scene process may render separate camera slots, sharing
  immutable geometry but not input, camera, wallet, casino state or session IDs.
- Admission is bounded. Start with two render slots and measure actual latency,
  resource usage and disconnect cleanup before choosing a public capacity.
- The web dApp handles wallet and game UI locally with the reviewed one-writer
  session adapter. Native messages may request an allowlisted nearby terminal,
  never a wager, wallet transaction, outcome or arbitrary URL.
- Public browser transport initially evaluates TLS WebSocket H.264/WebCodecs,
  plus a lower-rate JPEG fallback for clients without that codec/API. This works
  over existing HTTPS tunnels, unlike assuming a Cloudflare HTTP tunnel relays
  WebRTC UDP. WebRTC can be added once ICE/TURN routing is actually proven.
- A visible station route automatically requests a slot on entry; background tabs do not join. Rejoin is explicit after interruption; browser audio remains opt-in.
  Slots release on disconnect, idle expiry or bounded session duration; game UI
  stays recoverable when stream/renderer fails. No shared desktop exposure.
- No shell parameters/paths come from visitors. Strict size/rate/input bounds,
  server-assigned opaque session IDs, Origin allowlist, finite slot count and
  frame queue/backpressure bounds. Local renderer IPC is private and fixed-path.
- Browser alone cannot assert owner authority from Assembly URL context. The
  separate assignment action remains user-initiated and current-owner signed.

## First operational gate

Prove: browser joins local native stream -> movement changes the actual native
camera -> a second client has independent movement -> disconnect/expiry frees
capacity -> invalid/rate-excess input fails without process growth. Measure
frames/input latency using actual captures, not synthetic encoder throughput.
No public endpoint, production hostname, paid service or wagering change until
this gate and an independent implementation review pass.

## Public delivery gate

Retain cradleos.io as the app origin. Use a narrowly routed streaming backend
behind the existing managed tunnel only after inspecting remote route config;
never overwrite existing routes or expose a desktop/admin socket. Test actual
public video and input (including fallback), not only HTTPS health. Cloudflare
plan/streaming policy and bandwidth must be checked for the selected delivery.
If infrastructure cannot safely support the public stream, report the exact
blocker; no paid service purchase or firewall bypass implied.
