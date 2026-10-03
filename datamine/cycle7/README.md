# Cycle 7 Game Data snapshot

Build `3573151`, local Stillness client (`cycle-7`, branch `//frontier/cycle-7`).
Extractor rejects another build until reviewed. Source resource byte sizes and
MD5 values must match the launcher's manifest. SHA-256 provenance is recorded.
The client manifest is checked again before output; a changing client fails.

Run from the repository root:

```sh
python3 datamine/cycle7/extract_game_data.py \
  --client-root '/home/rawdata/frontier-client/launcher/fex-linux/wineprefix/drive_c/CCP/EVE Frontier' \
  --types /path/to/official-types-response.json \
  --api-proof /path/to/official-types-proof.json \
  --out cradleos-dapp/public/data/game-data-cycle7-3573151
```

The type response must be the exact bytes from
`https://world-api-stillness.live.pub.evefrontier.com/v2/types?limit=1000`.
API proof JSON contains `url`, `status:200`, `fetchedAt`, and the SHA-256 of those
bytes. The extractor rejects incomplete pagination, duplicate/invalid IDs, and
mismatched proof. The one blank published name (type95936) is retained; UI labels
it as unnamed rather than guessing.

English localization uses a restricted unpickler (OrderedDict only). Its keys
are **message IDs**, not item type IDs. The old catalogue incorrectly labeled
message1032759 as an item type; official Heavy Storage is type77917 (construction
site91715 is a distinct type). No string-to-item join is inferred by name.
Numeric placeholders and empty strings are omitted; all other message text stays
searchable. Presence in the client is not proof of live availability.

`eventtypes.static` is decoded only for the validated dict/int/single-string
schema and known object layout, with length, offset, header and duplicate checks.
These internal client event IDs are not Sui events. Unknown formats fail closed.
Types/groups/dogma/industry fsdbinary resources are hash-verified but not decoded;
the older partial decoder does not establish field semantics. No guessed
recipes, combat stats, old-world data, or 3D stand-ins are presented as current.

`changes.json` is an editorial **fact summary** of official 0.7.0.0, 0.7.0.1 and
0.7.1.0 notes; it is not generated from those opaque binaries. Quantities not
stated in the notes are not inferred. Each summary links the source. Official
GitHub heads were checked October3. This file is maintained separately from the
extractor. No complete current Industry-planner claim is made.

No new/changed/removed file counts are published: the tracked older launcher
index is an app-only index, not a valid resource-diff baseline. Current patch
summaries replace the old Cycle5→6 delta tab.

Tests: `python3 -m unittest discover -s datamine/cycle7 -p 'test_*.py'`.
Raw client binaries and official response snapshots remain in local research;
only derived data and digests are published. No launcher credentials inspected.
