# Native stream implementation — bounded independent review

2026-10-08. Inherited native reviewer. Scope: services/casino-station/server.mjs, motion.mjs, frames.mjs and client.html, including the AV1 addition and server hardening that landed during review. No runtime/config edits, signatures, public routing changes or deployment. Exact source hashes and machine findings: stream-implementation-review.json. Review-only probes: review-probes/.

## Verdict

**Useful local native-stream groundwork; HOLD public/client readiness for the concrete lifecycle gaps below.** Two-client native rendering and AV1 hardware decode were not independently rerun here; do not turn this source review into a production performance claim. Existing browser-only casino/wallet boundaries remain the correct design.

## Findings requiring correction before this client is public

1. **Rapid Join can allocate two sessions.** The guard runs before awaiting codec support. Two clicks while both probes wait see ws=null, then both create sockets; only the second is tracked. The first socket is not closed and can consume the other available slot until expiry. Isolated source-VM probe reproduces two sockets/first still open. Claim a synchronous joining flag/generation before any await; disable Join immediately; invalidate pending admission on Leave/unmount. Check that generation again after every async capability probe.

2. **JPEG decode can paint after Leave or over a replacement session.** paint() has global decoding/next state but no socket generation. Resolve createImageBitmap after closing the socket and it still draws/increments frameCount. The same source-VM probe reproduces one draw after close. Capture generation per decode, reject old results before drawing, always close bitmaps, and make queued work session-local. Catch decode rejection rather than leaving an unhandled rejected promise.

3. **Runtime codec failure is not a functioning fallback.** Unsupported API/profile selection can choose JPEG, but actual decoder error merely records decoderError; configure/decode exceptions are uncaught. A black stream can keep the slot occupied while input continues. On the first runtime codec failure, stop movement, release/invalidate that socket and safely offer or perform one bounded JPEG recovery attempt; prevent fallback loops. Also guard decoder output by generation. Qualify the exact codec emitted by the encoder, not only the hardcoded preliminary support query.

4. **Touch hold ownership is missing.** Two contacts on the same button share one Set key; releasing either deletes the other’s held input. Use one owning pointer per control and release only its own pointer. Also preserve keyboard ownership when touch releases the same action. This is not an escape from world bounds, but it is a practical mobile-control blocker for a public walkable client.

The above apply to client.html as reviewed. If this remains a local-only proof and production uses a different component, the replacement still needs equivalent lifecycle tests; the proof client is not implicitly certified.

## Confirmed hardening / tests

- Initial dispose removed sessions before encoder termination, allowing closing processes to escape the nominal capacity. **Fixed during review:** session/slot stays reserved until encoder close. An isolated gateway with two TERM-resistant fake encoder children (no ffmpeg/GPU/native work) reserves both slots, rejects a third join, kills both by deadline, then accepts a new join. All reviewer child processes were cleaned up.
- Per-connection UUID is generated server-side and checked against native frame header bytes. Frames from an old occupant cannot simply be read by the next occupant of that numbered slot. Native worker writes via replace; readBusy bounds concurrent reads. Closed-session read callbacks do not feed the encoder.
- Encoder contexts are per session. Input schema is strict/finite, limited to four bounded axes, rejects binary/unknown keys, and enforces a message-rate limit. Native movement is server-owned, normalized and dt-clamped; 250ms stale input goes idle. No paths, shell options, wallet requests or outcomes come from clients.
- Latest server gates admission on renderer heartbeat, bounds missing output, excludes closing cameras from IPC, force-terminates lingering WebSockets, limits status sending when buffered, and holds exactly two occupied/draining render slots.
- **4 existing Node tests passed independently:** input validation, movement/bounds/collisions, fragmented JPEG framing/ceiling and four-byte-AUD H.264 framing/ceiling.

## Parser, delivery and operations gates

- **H.264 parser is a fixed-encoder contract, not general Annex-B support.** It detects only 00 00 00 01 09 AUD boundaries. A valid stream using 00 00 01 09 produced zero frames and retained 72 bytes in an independent probe. Either explicitly qualify the pinned encoder’s four-byte AUD output, or accept both forms. The NAL parser’s support for both forms does not fix access-unit framing by itself.
- AV1 IVF parsing is bounded and uses all-intra encoding. Before claiming independent recovery, decode a later packet in a fresh decoder and after reset; verify required sequence headers accompany it. Test fragmented IVF headers/frame lengths and oversize rejection. I did not independently validate AV1 on a hardware browser here. H.264 being unsupported in one ARM Chromium does not mean all clients lack H.264.
- Socket/encoder thresholds are useful but not strict maximum packet sizes: bufferedAmount is checked before sending another encoded frame, whose permitted parser size is up to4MiB. Measure peak queue bytes and latency under a slow client. Hold byte caps explicit and disconnect/resync when already-buffered TCP data becomes stale. H.264 recovery must resume at a real keyframe/config, not a dropped dependent frame.
- Current inputSequence in state messages is server input state, not the applied sequence attached to a displayed video frame. Native IPC carries the applied sequence but the gateway strips that metadata before encoding. Do not use state-message arrival as input-to-visible latency evidence. Carry correlation through encode/delivery or independently measure actual changed pixels.
- Origin allowlisting and a global200ms join gap are not authentication or full abuse protection. Non-browser clients can spoof Origin. Bound unauthenticated HTTP/upgrading sockets as well as encoder slots; consider a pilot admission capability/rate limit before advertising the two-slot endpoint broadly. Current anonymous limits can be monopolized even though native process count stays bounded.
- Serialize stop() with an already-running flush(): both use cameras.next and may write/rename the same temporary file concurrently. An in-flight old flush must not overwrite the empty shutdown camera set or reject shutdown midway. No exploit repro performed for this small shutdown race; it follows from the shared asynchronous temp path.
- Browser hidden/blur resets movement, but the proof keeps receiving/rendering video until expiry. Public integration should suspend/release unnecessary GPU work while hidden/in a game. Keep ordinary casino/recovery usable without a slot. Reconnect never replays financial action.

## Tailscale Funnel assessment — port10000 only

Official sources fetched during review, preserved with excerpts/hashes in funnel-policy-evidence.json:

- [Funnel documentation](https://tailscale.com/docs/features/tailscale-funnel): available on all plans, currently beta; only tailnet *.ts.net DNS names; TLS only; allowed listener ports **443,8443,10000**; **non-configurable bandwidth limits**. No numerical throughput guarantee is stated in the reviewed page.
- The same document explicitly says a port cannot simultaneously be private Serve and public Funnel; its latest configuration determines visibility. Therefore any pilot must use **only10000**, leave private443 gateway and8443 VNC handlers unchanged, and avoid default-port commands or broad reset/replacement. Snapshot/read-compare the actual Serve/Funnel configuration and verify443/8443 remain private before/after any separately authorized change.
- [Terms](https://tailscale.com/terms) and [AUP](https://tailscale.com/tailscale-aup) prohibit disruption/undue burden. I found no specific video prohibition in the reviewed pages; that absence is not permission for unlimited streaming or a capacity guarantee. Respect the service’s limits rather than working around them.

**Assessment:** an isolated10000 Funnel is a plausible narrowly capped pilot route for ordinary TLS WebSockets, subject to actual end-to-end upgrade/video/input tests and the remaining implementation fixes. It does not establish production quality, a reserved bandwidth allocation, an SLA, or support for two continuous video clients. Keep the app on cradleos.io and use only the exact WSS Funnel hostname/port in the browser configuration/CSP and server Origin policy. The current local proof Origin configuration must not be broadened to wildcard. Actual EVE embedded-browser access to the nonstandard TLS port remains unverified.

Do not expose a desktop/admin endpoint or reuse the existing443/8443 handlers. No Tailscale state was inspected or changed in this review, and no public load/bandwidth test was performed.

## Next bounded gate

Recheck fixed client lifecycle with rapid Join/Leave, stale bitmap/decoder callbacks, real duplicate touches and forced runtime decode failure; test codec resync plus sustained two-slot queue/resource behavior. Then separately qualify the exact public endpoint and prove private services remain private. This report is not approval to expose the reviewed implementation publicly.
