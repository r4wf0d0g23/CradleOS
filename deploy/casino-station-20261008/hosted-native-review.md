# Hosted native station — independent architecture review

2026-10-08. Inherited native reviewer, not Opus. Reviewed HOSTED-NATIVE.md and fetched current official Cloudflare documentation/terms. No runtime/config edits, signatures, infrastructure changes or deployment.

## Verdict

**PASS for building the bounded local two-slot native-render/input gate. Public hosting remains gated on measured behavior and a suitable media endpoint, not on another runtime-choice question.** Raw selected hosted rendering. Browser-only casino/wallet ownership, fixed private IPC, bounded admission and no desktop exposure are the correct boundaries. The 120-frame synthetic NVENC result establishes encoder availability, not station frame rate or two-session capacity.

## Public endpoint: material constraint

The current official [Application Services terms](https://www.cloudflare.com/service-specific-terms-application-services/) say under “Content Delivery Network (Free, Pro, or Business)”:

> Unless you are an Enterprise customer, Cloudflare offers specific Paid Services (e.g., the Developer Platform, Images, and Stream) that you must use in order to serve video and other large files via the CDN.

The same paragraph reserves the right to disable/limit access for video or a disproportionate percentage of images/audio/large files without those services. Current [WebSocket documentation](https://developers.cloudflare.com/network/websockets/) confirms technical proxy support on all plans and that server-to-client WebSocket messages count toward outbound bandwidth. It does **not** grant an exception for video wrapped in WebSocket messages. JPEG fallback is still an image/video workload, not a policy workaround. A no-cache header does not establish permission either.

These pages do not conclusively classify the exact account’s Tunnel contract/entitlements. I did not inspect account plan information. Therefore do not call all Tunnel video categorically forbidden, but equally do not approve this use just because an existing HTTP tunnel works. Require explicit applicable plan/service coverage or Cloudflare confirmation before using that route for production video.

**Recommended default:** keep the app at cradleos.io and separate media delivery onto a direct TLS/WSS endpoint, or another explicitly permitted low-latency media relay. A DNS-only hostname routes HTTP/HTTPS directly to the origin, as [Cloudflare documents](https://developers.cloudflare.com/dns/proxy-status/). This requires a genuinely reachable TLS origin/relay; setting a DNS-only record to a Tunnel hostname is not an equivalent direct service. Certificate, ingress protection, rate limiting and bandwidth capacity must be provided there. Expose only the narrow media gateway, not the native process, desktop, IPC, admin port or broader DGX services. No firewall bypass, paid purchase or production routing edit is authorized by this review.

Cloudflare Stream/other named paid products are not automatically compatible with the proposed per-viewer low-latency protocol. Verify the actual service contract and transport before selecting one. Do not silently turn the interactive requirement into a multi-second broadcast.

Official [published-application protocols](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/protocols/) distinguish HTTP/HTTPS from non-HTTP TCP services requiring client-side cloudflared. They do not prove a public browser UDP relay for WebRTC. The design correctly avoids assuming one. Private-network UDP/WARP capabilities are a different deployment from an anonymous in-game browser.

Fetch URLs, response status, content hashes and quoted excerpts are preserved in hosting-policy-evidence.json.

## Required local protocol invariants

### Admission and isolation

- Hard-cap **all** occupied/reserved/starting render slots at two, with atomic acquisition. Also bound unauthenticated sockets, pending handshakes and any waiting queue; otherwise a two-render cap still allows unlimited socket/process growth. Busy clients receive a clear finite retry path and the normal casino remains available.
- Origin allowlisting protects browser cross-origin requests, not hostile non-browser clients that can spoof Origin. Use server-issued unguessable short-lived capabilities bound to one socket/slot generation; do not accept an arbitrary visitor-selected session ID. Add modest connection/request/IP limits using only a trusted proxy’s forwarded address. Keep capability values out of ordinary URL/access logs.
- Slot release is idempotent across disconnect, timeout, explicit leave and renderer error. Reuse increments a generation; reject all old inputs/frames/acks after release. One visitor must never inherit another camera/input state or stale encoded frame.
- A single native scene process may share immutable meshes, but camera, input, frame target/readback and encoder state must be per slot. Tag work with slot+generation+frame sequence before asynchronous capture. Cross-slot mutation/readback races must be tested. A process crash may interrupt both streams; it must not touch browser game saves. Bound restart attempts rather than spawn a retry storm.
- Visitors send a strict small message schema, not filenames, shell options, resource IDs, native expressions or arbitrary URLs. Reject unknown types/oversized JSON, non-finite coordinates, excessive rates and invalid viewport/profile requests. Server clock determines dt; bounded latest input snapshots should replace queued movement rather than accumulate distance. Lost heartbeat/focus/visibility must zero held movement even if key-up never arrives.

### Frames and backpressure

- H.264-over-WS is viable, but ffmpeg stdout read boundaries are **not** video frame boundaries. Frame complete access units and identify codec/config, keyframe, timestamp, resolution and stream generation. Use an actual supported WebCodecs decoder configuration; keyframe/SPS/PPS handling must work on first join, reconnect, resolution change and decoder reset.
- Low latency needs bounded GOP, no uncontrolled B-frame lookahead, and independent encoding state per visitor. Do not alternate cameras through one inter-predicted bitstream and distribute only half its frames to each decoder.
- Bound server encoder input/output queues, socket buffered bytes, and browser decode/presentation queues. Render/capture only the latest useful frame when overloaded. Arbitrarily dropping a dependent P-frame and continuing with later P-frames is unsafe: discard through the next keyframe or reset/request an IDR. JPEG frames are independently droppable; this is a simpler first gate, not proof of the H.264 path.
- Close every VideoFrame/ImageBitmap and revoke fallback object URLs; discard stale async image decodes after a generation change. Slow clients must not stall the other slot or consume unbounded memory. If data already queued on TCP cannot be withdrawn, cap it early and reconnect/resynchronize rather than displaying seconds of stale motion.
- WebSockets/TCP have head-of-line stalls; advertise only measured responsiveness. Document target resolution/FPS/bitrate and degrade to a bounded fallback rather than buffer indefinitely. Measure actual network egress for both encodings. Synthetic NVENC throughput omits native render/readback/copies, per-stream initialization, client decode and WAN delivery.

### Browser and game boundaries

- Negotiate supported codec/API in a secure context; a successful feature check alone is insufficient. Decode failure, GPU/context loss and low throughput must reach JPEG or the ordinary casino without reload/ledger reset. Do not require a codec unavailable in EVE’s embedded browser. Actual embedded-browser support remains unverified until exercised.
- Keep wallet providers, sessionStorage and game outcomes exclusively local to the visitor. Native messages can offer an allowlisted terminal, and the browser must still require explicit Play and honor pending-game priority. A stream message never performs a wager, donation, wallet request, navigation to an arbitrary URL or financial state replacement.
- Pause/zero input when game UI or directory gains focus; stop streaming/render work while hidden. Prefer releasing an expensive slot during lengthy game play, while leaving the browser game intact. Rejoining the floor must never autoplay a saved run or replay a wallet request. Do not make recovery from a capacity/full-stream failure depend on acquiring another GPU slot.
- Maintain one CasinoExperience ledger writer; its return callback must unmount it per the groundwork contract. Stream canvas failure should be isolated from game recovery. Use narrowly scoped WSS/connect-src and JPEG/blob permissions, not an all-origins relaxation. Audio remains separate and user-opted-in.

## Minimum measured acceptance before public exposure

1. Two clients with distinct movement: same geometry, independent camera/input/readback/decoder state. One slow/disconnected client cannot freeze the other or receive the other’s frames.
2. Third client, parallel join burst and incomplete handshake hit bounded admission; close/expiry/crash release capacity exactly once. Old capability/frame/input cannot affect a reused slot.
3. Oversized, malformed, non-finite and high-rate input; missing key-up/heartbeat; rapid focus/visibility changes. No runaway movement, memory, IPC backlog or process growth.
4. H.264 first join, dropped-frame resync, unsupported codec, decoder error, JPEG fallback, slow link and network reconnect. Bound buffered bytes/queue depth throughout.
5. Record actual per-slot rendered/delivered/presented FPS, p50/p95 input-to-visible latency, native/GPU/encoder load, readback/encode cost, memory and egress during a sustained two-client run. Correlate an input sequence with a displayed frame on one browser clock rather than subtract unsynchronized server/browser timestamps.
6. Renderer death, reconnect and slot exhaustion while a paid game is open leave its exact ledger and recovery UI unchanged. Never connect/sign during infrastructure QA.
7. Separate real public WSS video/input test, not merely an HTTPS health response, after endpoint policy/routing review. Cloudflare documents maintenance restarts and idle timeouts terminating WebSockets: handle reconnect explicitly without replaying actions.

No source or delivery approval is implied beyond this bounded architecture gate. Hosted runtime selection is resolved; implementation, public endpoint qualification and final browser/assignment proofs remain the next work.
