# Public candidate — incremental controller and handoff review

2026-10-08. Inherited native reviewer. **PASS for the bounded revised controller/source gate and one-ledger handoff; this is not a public-delivery or unrestricted-production approval.** Hosted rendering is selected; visible join-on-access is accepted under Raw’s updated request. No production/configuration changes or wallet actions performed.

## Earlier findings closed

The obsolete client.html is no longer served. Its bugs are not carried forward as unresolved findings against the replacement.

- StationStream claims joining synchronously before capability awaits and invalidates asynchronous work by generation. Concurrent joins produce one socket; leaving during capability detection produces none.
- Late JPEG results are discarded and ImageBitmap closed after close/rejoin. Late VideoFrames are closed without drawing. Queued JPEG work is bounded to the active decode and one latest frame.
- Decoder/configure/decode failures close the current session and schedule one JPEG attempt; explicit close cancels it. JPEG failure does not create a recovery loop. Keyframe wait is restored after decoder backpressure/reset.
- Station component Help now blocks pointer and keyboard movement; joystick controls are removed while Help is open. Pointer cancel checks its owning ID. Initial hidden documents do not join. Visible automatic entry no longer conflicts with the revised hosting contract.
- H.264 framing now handles both three- and four-byte AUD starts. Independent arbitrary-fragmentation probe passes for three-byte AUD. IVF fragmented header/frame and memory-ceiling probes pass; these are framing checks, not a hardware AV1 decode claim.
- Server keeps draining encoders within the two-slot count, bounds encoded-input correlation queue, applies native UUID/frame freshness checks, caps HTTP connections at32, limits input and encoded packet size, and closes sustained congested streams. stop() now waits for any in-flight camera flush before writing the empty camera list.

## Independent checks performed

Added the explicitly authorized test-only file `src/lib/casinoStationStream.test.ts` (6 tests). These cover rapid/aborted admission, stale JPEG and VideoFrame cleanup, bounded recovery, explicit-close cancellation and zeroed input, decoder keyframe recovery, and latency correlation only at actual presentation. **All6 pass; TypeScript noEmit passes.** No production implementation was edited by the reviewer.

Also independently passed48 existing station-launch/session/spin-run/craps tests and4 service tests. These focused checks do not replace the parent’s full suite.

Actual React browser check at320×568 used isolated mocked video transport with a captured native frame, not the live renderer. It verified:

- Help open → attempted canvas movement produces no nonzero input; Help remains within viewport (x34.8..310,y70..366).
- Directory contains34 games; selecting Craps mounts exactly one CasinoExperience.
- Return removes that owner entirely (count0), then rejoins floor presentation; directory/game entry releases the prior stream.
- No page exceptions in this scoped interaction.

Evidence: review-probes/station-ui.json and station-320-help.png. No native render slots were consumed by this browser probe. This does not independently reproduce the parent’s19fps/2.3Mbps/native latency results or prove broad physical mobile usability.

## Financial and interaction boundary

The station contains no wallet/ledger/outcome logic. It mounts one conditional CasinoExperience; its existing return callback pauses future spins before unmount. A pending paid game still overrides a requested terminal through casinoLaunchGame. Directory/filter/camera state is separate. Opening a game closes the stream and cancels fallback, so a network retry cannot acquire a slot underneath the game.

No donation or testnet activation was added. Existing synchronous chainBusyRef still gates station return during direct donation work. The Assembly preset is the primary station URL and uses the existing direct OwnerCap quick-preset path, not the known sponsored typeId/manual-fallback path. No on-chain assignment was exercised; this review does not certify that inherited manual sponsored handler or future wagering activation.

The17-byte frame header now carries applied-input correlation through native readback/encoder output to presentation. The unit regression confirms arrival alone does not count as presentation latency. This measures the browser-local sent-input-to-presented-frame interval; public network latency still needs its own observation.

## Funnel pilot action boundary

Read-only `tailscale serve status --json` and `tailscale funnel status --json` show existing TCP/Web ports **4174,443,8443**, all with no AllowFunnel entries. Port10000 is absent. Evidence includes a canonical configuration hash, not private handler contents, in review-probes/funnel-prepilot-status.json.

A future authorized pilot may add only the dedicated10000 gateway target. Preserve **all three existing private ports**, not just443/8443; compare their original handlers and public flags before/after. Never use a default443 Funnel operation or a broad reset/replacement. Current service exposes only GET/health and narrowly accepted WebSocket/join; it binds loopback and serves no proof HTML/admin page.

Prior official policy assessment still applies: Funnel10000 is supported but subject to non-configurable bandwidth limits and beta/service constraints. Origin allowlisting is not authentication; this deliberately anonymous two-slot pilot remains susceptible to monopolization. Do not claim unlimited capacity, public latency, an SLA or EVE embedded-browser compatibility from local results.

## Separate gates still required

- Native supervisor/source and shutdown/restart behavior finalized and measured; no unsafe shared runtime cleanup.
- Exactly scoped10000 exposure, private-port invariance, actual external WSS input/video/codec fallback and capacity-full recovery.
- Final application build hashes, responsive native-view/game/return flows and no regression to casino financial/wallet boundaries.
- Actual EVE browser and owner assignment remain explicitly unverified unless separately exercised.

No remaining source blocker was found in the bounded revised controller/handoff review. Public endpoint operation and final release verification remain separate gates.
