# Origins Animated Series — Production Plan v0.1

**Status:** staged for production planning.

**Source series:** *Echoes of Stillness* Parts I–III.

**Creative owner:** Raw.
**Production rule:** animation is built as a layered production from scratch. The
flat comic plates remain canonical still art and are never cut apart or degraded
to fake animation layers.

## 1. Target deliverable

Produce a **90-second proof-of-concept trailer** that establishes the repeatable
pipeline for a later 6–9 minute animated episode.

The trailer adapts three beats:

1. **The Young Rift** — Solstice Whisper enters the unstable Crude Rift.
2. **The Cradle** — the impossible station and suspended Shells are revealed.
3. **The Culling** — stars are removed as the warning reaches the Frontier.

Delivery masters:

- 4K UHD, 3840×2160, 24 fps, 16:9.
- 4K textless master for later recuts and localization.
- 1440p and 1080p web encodes.
- 9:16 and 1:1 social cut-downs made from protected center framing.
- Stereo mix plus separate dialogue, music, ambience, and effects stems.
- Captions and a transcript.

## 2. Visual direction

`STYLE_STANDARD.md` remains authoritative. Animation adds motion rules without
changing the franchise look:

- Warm burnt-orange/umber monochrome; Crude Matter veins are the only restrained
  cool note.
- Monumental near-black silhouettes against internal or rear amber light.
- Dust, particulate, smoke and sensor degradation move continuously; space never
  reads as clean vacuum.
- Camera movement is slow, heavy and intentional. No weightless drone-camera
  orbiting, rapid parallax or glossy sci-fi fly-throughs.
- Shells are bare, unfinished humanoid forms. No spacesuits, helmets, gore or
  individualized faces.
- Existing theme plates are composition/color references, not animation source
  layers.

## 3. Production architecture

Each shot is an independent package:

```text
shots/<sequence>/<shot-id>/
  brief.md             # story beat, duration, camera, canon constraints
  storyboard/          # approved frame(s)
  plates/              # native background/midground/foreground layers
  elements/            # particles, emissives, silhouettes, HUD artifacts
  audio/               # shot-local effects or dialogue reference
  comp/                # compositor project + rendered review versions
  manifest.json        # source provenance, model/tool settings, approvals
```

Shared assets live separately under `assets/` and are versioned:

- Solstice Whisper silhouette and scale sheet.
- Argent Seeker silhouette and scale sheet.
- The Cradle exterior/interior shape language.
- Blank Shell turnaround and pose library.
- Rift, Crude Matter, dust, sensor-noise and typography treatments.

No shot owns or silently mutates a shared design. Shared-asset changes require a
new version and a regression review of every dependent shot.

## 4. Pipeline

### Phase A — pre-production

1. Lock the 90-second trailer script and narration.
2. Create a beat sheet with target seconds per beat.
3. Build a grayscale storyboard using 18–24 frames.
4. Cut an animatic with temp sound; revise pacing before detailed art begins.
5. Approve character/ship/station scale sheets and the color script.

**Gate A:** Raw approves the animatic, voice text, shot list and design sheets.
No production shot starts before this gate.

### Phase B — shot production

For every approved shot:

1. Write a shot brief with exact canon and negative constraints.
2. Generate or paint native layers for the intended camera move.
3. Create depth maps, masks and clean plates as supporting data—not as substitutes
   for correctly lit layers.
4. Animate camera, environmental motion and emissive effects.
5. Composite unified atmosphere, grain and color so layers share one light field.
6. Render a low-resolution review with frame/timecode burn-in.
7. Record approval or revision notes in the shot manifest.

**Gate B:** no cut-out fringe, missing rim light, rubber geometry, drifting ship
identity, spacesuited Shells, unreadable silhouettes or unmotivated camera motion.

### Phase C — editorial and sound

1. Replace the animatic shots only after each shot passes Gate B.
2. Record final narration/dialogue after picture timing is stable.
3. Build the Starsong as a recurring three-note sonic identity.
4. Add low-frequency machinery, Crude Matter resonance and sparse ship detail.
5. Mix for headphones first, then verify phone and television playback.

**Gate C:** picture lock, canon review, caption review, loudness/peak check and
headphone/phone/TV translation pass.

### Phase D — delivery

1. Render image sequences for the master; never render the only master directly
   to a long-GOP video file.
2. Encode delivery variants from the approved master.
3. Run automated checks for resolution, frame count, audio streams, duration,
   black frames and missing frames.
4. Watch every final file end-to-end before publication.
5. Archive source manifests, final image sequence, audio stems and checksums.

## 5. Proof-of-concept shot list

| ID | Seconds | Beat | Required work |
|---|---:|---|---|
| RIFT-010 | 6 | Empty hostile field; young Rift begins to pulse | Rift environment, dust simulation, slow push |
| RIFT-020 | 7 | Solstice Whisper crosses frame toward impossible scale | Ship design, native foreground/midground layers |
| RIFT-030 | 8 | Instruments distort; phrase forms in noise | Diegetic degraded HUD, typography animation |
| RIFT-040 | 7 | Event horizon convulses and takes the ship | Rift deformation, silhouette loss, sound hit |
| CRADLE-010 | 8 | Argent Seeker approaches the megastructure | Second ship design, Cradle exterior, scale pass |
| CRADLE-020 | 9 | Interior corridor reveals suspended Shells | Shell library, zero-g poses, volumetric lighting |
| CRADLE-030 | 8 | Crude Matter core opens like an eye | Core mechanism, emissive animation, Keeper shapes |
| SIGNAL-010 | 8 | Starsong crosses ships and dead stations | Signal rings, three environment variants |
| CULL-010 | 10 | First star is removed, not destroyed | Starfield continuity, absence effect, timing test |
| CULL-020 | 9 | The line of absence advances | Wide-scale environment, protected center framing |
| END-010 | 10 | Title and warning: THE CYCLE IS CULLED | Title system, final sound resolve |

The remaining runtime is allocated to transitions, opening/closing holds and
editorial breathing room.

## 6. First production sprint

The first sprint proves the two highest-risk visual problems before scaling:

1. **RIFT-020 lighting test:** native layered ship silhouette must receive correct
   amber rim bloom from the Rift without the dark fringe seen in the flat-art
   compositing experiment.
2. **CRADLE-020 identity test:** ten or more Shells must remain unsuited,
   anonymous and stable through a slow camera move.
3. Cut both tests into a 12–15 second micro-animatic with provisional sound.
4. Review at full resolution and at Discord/mobile size.

**Sprint exit:** both shots pass visual/canon gates, their manifests are complete,
and the workflow can reproduce a revision without rebuilding the shot manually.
If either test fails, correct the production method before authoring more shots.

## 7. Tracking and acceptance

Track every shot through these states:

`brief → storyboard → animatic-approved → assets → animation → comp → review → final`

Each review records:

- reviewer and timestamp;
- exact version/hash reviewed;
- pass or concrete revision notes;
- canon/style checklist results;
- whether dependent shared assets changed.

The trailer is complete only when all shots are `final`, the four production
gates pass, every published encode has been watched end-to-end, and the archived
source can reproduce the master.

## 8. Decisions needed from Raw before Gate A

These are creative-direction decisions, not implementation choices:

1. Narration format: Raw's recovered logs, an external narrator, or no spoken
   narration.
2. Whether Raw is ever shown physically or remains ship/voice/presence only.
3. Whether the proof ends on **THE CYCLE IS CULLED** or the quieter **DO NOT THINK
   TOGETHER** warning.
4. Whether the first public release is branded *Origins: Echoes of Stillness* or
   simply *Echoes of Stillness*.
