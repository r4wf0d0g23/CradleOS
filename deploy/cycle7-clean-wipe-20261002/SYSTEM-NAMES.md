# Current-client system names — October 2, 2026

## Evidence and scope

The official local launcher on DGX2 updated from Cycle 6 build 3502403 to the
Cycle 7 resource manifest for **Stillness build 3573151**, branch `//frontier/cycle-7`.
Only payloads matching the new manifest's sizes and MD5 hashes were collected.

- Manifest SHA-256: `66296b931714a33d19498554fd471be808987ba067b598948cadbe4da732b160`
- `localization_fsd_main.pickle`: `85f86041546395e63e9267e838440e31a96f99b2c1064886a9b021749877da81`
- `localization_fsd_en-us.pickle`: `3a359774ae540b588ea31bab1a0f9c0eddecb28f753ca6a2c511613b544fa5e5`
- Names snapshot SHA-256: `1ab219e3f64415e176a1b614d0a2c9144d3fea059a32261d2ac6f93a29204c9f`

The restricted-pickle join follows `Map/SolarSystems` / `solar_system_<id>` labels
to English message IDs. It found 122,041 distinct IDs: 25,337 readable names and
96,704 numeric placeholders. There were 42 duplicate label records but **zero
conflicting names**. Placeholder/conflicting names are excluded. All 11 distinct
system IDs observed in the fresh current-world kill index resolve; an independent
review reproduced the extraction and checked the index's Cycle 7 world identity.

**This is not a list of active/discovered systems.** Only resolve IDs supplied
by current-world records. No coordinates, region membership, gate links or route
graph are imported. No previous-world operational state is restored.

## Implementation and checks

- `src/lib/currentSystemNames.ts`: lazy names-only snapshot, Stillness/world/cycle/
  build namespace checks, shared concurrent fetch, 30-second failure backoff and
  retry; no previous-cycle sessionStorage lookup.
- `resolveSolarSystem` returns the name with null geography. Unknown IDs retain
  numeric fallbacks. The full catalog and retired API remain disabled.
- Keeper Cipher only applies names to current-event-backed expedition selectors
  while the universe catalog is unavailable. Player cards preserve state identity
  on unresolved IDs, preventing a repeated render/lookup loop.
- `public/data/system-names-stillness-cycle7-3573151.json` contains names and source
  provenance; it is not used for map/system enumeration.
- Full build and 109 frontend tests pass. Real local-preview Intel view using the
  live index rendered names at 1440px and 390px without overflow, JS errors, or
  retired universe requests.

Extraction inputs, restricted loaders, join script, independent review evidence
and browser evidence are in the workspace's
`research/cradleos-system-names-20261002/` directory. Raw client binaries, login
profiles and credentials are not included in this repository or deployment.

## Launcher recovery is a separate limitation

Raw unlocked/logged in locally. The launcher repeatedly stalled under FEX/Wine.
Restarting its existing service preserved the saved profile and resource cache.
Generic `--disable-gpu` did not fix it; the launcher-supported `--software` and
`--concurrent-downloads=5` combination recovered the three required data files.
The UI clock subsequently advanced, but the full resource download remained
incomplete and self-update errors were visible. This is not a claim that the
launcher/client is fully repaired or game-ready. No authentication controls were
bypassed and no credentials inspected. The original wrapper is retained in local
research evidence for reversible restoration.
