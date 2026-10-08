# Native scene proof, not a playable release

Three camera views and an empty-scene control from an original station blockout
using **Carbon Mesh -> native Carbon Trinity DX11** under Wine/FEX. This is not
Blender, Three.js, a browser engine, or a full casino game implementation.

`proof.json` binds the CMF, source scripts and captures. `station-layout.json`
contains the authored geometry/material manifest and 34 terminal positions.
No engine binaries, current-client asset packs, credentials or wallet state are
included. The unchanged production casino is not affected.

Qualified: native scene geometry, separate camera views, foreground vs empty
control, resource cleanup. Not qualified: final materials/lighting, collision,
walking/input, native UI, streaming, concurrency or the EVE embedded browser.

Host-local reproducible workspace remains at:
`.tmp/openclaw-spikes/casino-station-native-20261008/`
with build_station.py, render_station.py, native_scene.py, asset-01/, cmf-01/
and isolated render-01/. It reuses the pinned local native authoring helpers in
`tools/frontier-animation/native-carbon/solstice/`. Do not overwrite run IDs or
clear native cleanup/lock gates to rerun it. No production asset pipeline changed.
