# Frontier casino station — implementation / release plan

Request: a walkable EVE Frontier-themed casino station that an owner can assign
as an Assembly dApp, reusing the current games. All casino accounting, wagers,
wallet boundaries and save semantics remain owned by the existing casino.

## Evidence and architectural decision (pending Raw's runtime choice)

- Carbon Trinity upstream main checked 2026-10-08:
  `c4fd6af4fcda38416cdd6a044a04740f6e06aad6`.
  https://github.com/carbonengine/trinity
  README documents native DX11, DX12 and Metal; no supported browser backend.
- Current local Carbon/Trinity DX11 pipeline under Wine/FEX is qualified for
  native asset scenes and frame output, not browser execution or multi-user
  streaming. Carbon Mesh is mesh/animation serialization, not a web renderer.
- Current client 3573151 includes hangar scenes and modular meshes. Availability
  in its manifest is not proof that each model renders with our native runtime.
- https://docs.evefrontier.com/dapps/connecting-in-game.md confirms Assembly
  owners can set a custom dApp URL through sponsored metadata transactions.
  Visitors launch it from the game's browser; ownership is required to assign.
- The dormant Casino3D component uses Three.js and a stub walking controller;
  it is not a functioning Carbon casino and will not be relabeled as one.

Choice presented to Raw: (A) ordinary browser dApp using Carbon-rendered assets
and an explicitly identified browser renderer; (B) native Carbon station with
per-visitor render/input streaming. No dependent deployment before this choice.
Native streaming needs a separate session isolation/resource budget, GPU runtime,
WebRTC/TURN/auth, timeout cleanup and browser compatibility proof. Wallet actions
must remain in the visitor's browser, never a shared remote browser session.

## Shared station/game contract (both choices)

- Fictional reclaimed station: airlock -> central concourse -> slot galleries,
  card lounge, probability tables and salvage arcade; observation/hangar vista.
- Dark graphite industrial hull, burnt-orange guide lighting, ivory signage,
  restrained teal control lighting, original EVE Frontier iconography.
- Short visual signage and a searchable directory, not a wall of tutorial copy.
  A help drawer exposes controls. Mobile analog movement + drag-look; keyboard
  WASD/arrows + drag-look. No mandatory pointer lock in embedded browsers.
- All 34 current practice games reachable; inactive/quarantined wagering is not
  exposed by the old 3D catalog. No simulated player activity labeled as live.
- Walk -> approach terminal -> explicit Play -> existing CasinoExperience panel.
  No outcome/RNG/balance logic in the world. Existing game UI remains accessible
  without 3D, including assistive technology and low-end/mobile devices.
- Same origin, same tab-scoped Session ledger. A pending paid round takes
  priority over a newly requested terminal. No wager duplication on remount.
- Returning to the floor must pause future spins; no hidden auto-play, balance
  changes or unwanted audio. Active/paid rounds must remain resumable; wallet
  transactions cannot be abandoned by an active exit control.
- Dedicated public station URL; incoming structure query context preserved but
  never interpreted as authorization. Assignment preset uses the existing
  owner-signed metadata transaction flow. No automatic on-chain assignment.

## Acceptance / release gates

1. Catalog parity with current 34 practice games and pending-game restoration.
2. Collision-safe reachable terminals, bounded movement, reset on blur/hidden,
   touch pointer cancellation, no walking underneath game/directory dialogs.
3. Directory and normal casino usable with WebGL unavailable or context lost.
4. No financial code or storage formats changed; existing casino tests pass.
5. Mobile portrait/landscape + desktop: visual inspection, actual approach/play/
   return, resume, fullscreen fallback, reduced motion and sound off.
6. Independent architecture and source review, Origins guard, IOC scan, TS/build.
7. Publish only cradleos.io after choice and completed gates; verify live bytes,
   route, real game interactions, and changed assets. Actual EVE embedded browser
   and owner-signed assignment remain explicitly unverified unless exercised.

Baseline: runtime cd5a509 / receipt 52d5a7c, Pages 934b20d7 (rollback).
No contract changes, funding, new service purchase, or testnet activation.

## Groundwork status — 2026-10-08

- Centralized practice presentation catalog (34 entries); optional terminal launch
  preserves paid pending-game priority. Optional return callback pauses future
  auto-spins and uses a synchronous wallet-busy guard. The future station parent
  MUST unmount the single CasinoExperience when returning (not CSS-hide it),
  and keep all other exits subject to the same wallet-busy ownership contract.
- Five added launch-boundary tests; full suite 311 tests passes, TypeScript passes.
  No URL route, renderer integration, assignment change or deployment is enabled.
- Original native station blockout: 34 terminals, 24,720 triangles, Carbon Mesh
  export validated, three actual Trinity DX11 captures. Native cleanup verified.
  See native-proof/proof.json. Materials are a grayscale blockout, not final art;
  no interactive client, live input, streaming or browser execution demonstrated.
- Current-client generic hangar scene loads as EveSpaceScene but contains no
  objects by itself: do not treat it as a complete interior.
- Architecture review identifies one-writer/lifecycle and inherited assignment
  risks; see architecture-review.md. No assignment transactions were attempted.
- Waiting on Raw's requested runtime choice; original live casino remains intact.
