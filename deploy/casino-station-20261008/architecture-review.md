# Independent architecture review — walkable casino station

Date: 2026-10-08. Reviewer: inherited native reviewer, not Opus. Read-only source/evidence review; no runtime edits, wallet use, transactions, deployment, native streaming test or in-game browser test.

## Verdict

**Shared architecture is viable with the requirements below. Runtime selection and deployment remain HOLD pending Raw’s explicit choice.** A browser-rendered station using qualified Carbon assets and a native Carbon streaming service are materially different products; neither should be represented as the other. The qualified local frame renderer does not establish a browser backend or production streaming service.

Reviewed PLAN.md, the complete parsed native inventory, current CasinoExperience lifecycle, newly emerging catalog/launch helpers, dormant Casino3D, StructurePanel, metadata transaction builder, and the installed sponsored-transaction SDK. This is an architecture gate, not approval of the concurrently changing implementation.

## Required integration safeguards

### 1. One session writer, explicit suspension

CasinoExperience initializes its own state/current ref from tab-local sessionStorage and commits synchronously before showing a result. Same origin and the same storage key do **not** synchronize two mounted component instances. Never keep a hidden lobby instance while mounting a second station-game instance. Use one owner or unmount/recreate exactly one owner from the committed save. Do not introduce a second station ledger or persistence schema for outcomes.

Define the floor/game transition explicitly: pause future finite-run stakes synchronously; invalidate timer generations; stop presentation audio; clear world input/captures; restore focus to the originating terminal on return. Merely hiding a DOM panel does not fire document.visibilitychange, close the audio context or stop autoplay. World rendering should stop or become low-rate while an opaque game dialog is open.

Separate a resumable paid game from an in-flight wallet request. A pending hand/slot/Scratch/craps roll may return to the floor without settling, canceling, refilling or resampling; it must win over a later terminal request. Active wallet submission/preparation must block every exit path, including outer navigation/Escape, using a synchronous busy guard as well as rendered state. Uncertain donation markers must survive component replacement and must never trigger an automatic retry.

The new launch helper’s practice allowlist, pending-game priority and parked-craps distinction are appropriate. Keep completed table/receipt restoration separate from financial pending state. Ordinary instant-game animations are not all durable resumable timelines: reopening may show their already committed static receipt; do not promise otherwise.

### 2. Assignment cannot blindly reuse the existing manual URL handler

A concrete inherited defect exists in StructurePanel.handleSetUrl: the sponsored request supplies `assembly.item_id = structure.typeId ?? 0`. PlayerStructure separately exposes `gameItemId`, and the installed SDK resolves the actual game item_id, giving a supplied numeric value priority over URL context. A type ID is not an Assembly instance ID.

That handler also catches **every** sponsored error and immediately starts a regular signed transaction. User rejection and uncertain submission are not proof that a second request is safe. Existing quick presets use the direct OwnerCap transaction builder instead; this finding is a reuse hazard, not a claim that a new station preset already has this bug.

For the new assignment path, use exact validated gameItemId with the sponsored API, or explicitly use the current-world direct OwnerCap builder. Capture/revalidate actual current account, Character ownership, selected Assembly/OwnerCap and sender before signing. Do not use query context or development overrides as authorization. Offer a separate explicit fallback only after a known unsupported/not-submitted result; cancellation/unknown outcome stops the attempt. Keep metadata name/description intact and update only URL.

The current deployment environment is fixed Stillness, so its existing primary preset base resolves to cradleos.io. Nevertheless the station preset should explicitly target the chosen primary route, not the dormant alternative GitHub deployment string. Opening a station is read-only; assigning it remains an owner-initiated transaction. Review/dry-run support is not proof of actual owner assignment.

### 3. URL and storage boundaries

Preserve official structure query context in the URL search component through directory/game/floor transitions; do not append it to a fragment that the current exact-match hash router will misparse. Parse allowlisted context fields as data, never authorization or a transaction target without authoritative owner checks. Test hash/direct-path refresh and the actual BASE_URL deployment layout.

A session remains per-tab practice state, not wallet/account persistence. An embedded browser may partition, disable or discard sessionStorage. Failed writes must keep rejecting play without replacing the existing save. Renderer failure, context loss or asset fallback must not unmount a financial owner unexpectedly or clear storage. Returning to the ordinary casino on the same origin should preserve the same tab ledger; another tab or immutable-preview origin is intentionally distinct.

## Native asset and renderer qualification

Inventory contains **487 available entries, 197,834,272 bytes (~188.7 MiB): 160 CMF and 327 BLACK**. It lists no texture files. The largest mesh is ~35 MB; generic hangar geometry is ~23 MB. These numbers describe the listed native resources, not a complete runtime payload or browser download budget. Availability/manifest MD5 proves neither dependency closure nor suitability for an interior scene. Generic/inherited resources present in the current client are not automatically active Frontier environments.

Qualify a small set before committing to scene breadth: mesh/material/texture/shader dependencies, units/up-axis, bounds, transforms, UVs, normals, useful LOD, transparent surfaces and lighting. Keep original resource/build/hash provenance and derivative hashes, with existing attribution policy. BLACK audio controllers are not sound clips. Visual meshes are not automatically safe collision geometry: author simple reviewed collision/navigation proxies with bounded movement and accessible terminal distances.

For a browser choice, identify the actual browser renderer and derivative pipeline honestly; bound initial bytes, texture dimensions/VRAM, draw calls and pixel ratio. Lazy-load optional vistas. A coherent small concourse with distinct wings and directory access is more useful than loading all native hangars.

For native streaming, first prove one isolated visitor session end-to-end before expanding the floor: supported GPU/OS/runtime, codec decode, latency, audio policy, embedded-browser WebRTC/TURN, disconnect/reconnect and resource teardown. Establish concurrency/cost limits and idle cleanup; the local Wine/FEX frame pipeline alone proves none of these. Do not provision services or select this architecture implicitly while Raw’s choice is pending.

Wallet providers, practice saves and all casino UI remain in the visitor’s browser. Native/stream messages may request an allowlisted terminal, not a wager, wallet action, outcome or arbitrary URL. Validate origin/session and bound input rate/coordinates; separate visitors’ render state and input, and never render another visitor’s wallet/browser session. Review CSP/network permissions needed by the selected transport without broad origin permissions.

## Bounded acceptance additions

- One active writer across repeated floor→game→floor, normal casino navigation, rapid terminal clicks and renderer crashes; storage-failure round remains unchanged.
- Open terminal B with saved paid slot/free feature, classic spin, Scratch, blackjack split/table and pending craps A: A takes priority. Parked craps remains intact while B is visited. Stop/paused finite runs never resume from walking, hidden state, reload or reconnect alone.
- Return during payout animation, finite-run gap and each wallet preparation/submission phase. No new stake/audio after return and no duplicated submission. Recycled round IDs/refill do not replay celebration.
- Fullscreen/Escape/dialog/blur/visibility/context-loss transitions clear movement and pointer captures. A second touch cannot release the first owner; keyboard focus in game controls does not walk the avatar. Restore terminal focus and expose directory/navigation without WebGL.
- Test both renderer failure at startup and context loss while a paid game is open, not only a successful walk-through. Scene errors must leave the game/save recovery reachable.
- Exact 34-game allowlist/parity, including new Craps and nine slots; old live-feed/hologram polling and quarantined catalog entries are not inherited from dormant Casino3D. Any decorative crowd is clearly fictional, not live participation.
- Assignment tests: differing typeId/gameItemId; wrong-owner/world; switched account; canceled/uncertain sponsored result; one submission per gesture; metadata fields preserved. Actual EVE embedded-browser launch and owner assignment remain explicitly unverified until separately exercised.

## Confidence and scope

High confidence in the integration hazards above because they follow from current source and SDK contracts. Native/browser performance, asset fidelity, streaming feasibility and actual in-game launch remain unverified. No full regression suite was rerun for this architecture-only pass; implementation and post-deployment gates remain separate.
