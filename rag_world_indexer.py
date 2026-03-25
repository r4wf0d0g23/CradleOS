#!/usr/bin/env python3
"""
EVE Frontier World API → ChromaDB RAG Indexer
Uses embedded chromadb.PersistentClient (not HTTP server)
"""

import requests
import json
import time
import sys
import chromadb
from chromadb.config import Settings

WORLD_API = "https://world-api-stillness.live.tech.evefrontier.com"
EMBED_URL = "http://localhost:8004/v1/embeddings"
EMBED_MODEL = "nemotron-embed"
CHROMA_PATH = "/home/rawdata/rag/chroma_data"
COLLECTION = "eve_frontier_types"

# Init chroma client
_chroma = chromadb.PersistentClient(
    path=CHROMA_PATH,
    settings=Settings(anonymized_telemetry=False)
)
_col = _chroma.get_or_create_collection(COLLECTION)

def embed(texts: list) -> list:
    resp = requests.post(EMBED_URL, json={"model": EMBED_MODEL, "input": texts}, timeout=120)
    resp.raise_for_status()
    data = resp.json()["data"]
    return [d["embedding"] for d in sorted(data, key=lambda x: x["index"])]

def chroma_upsert(ids, documents, metadatas):
    # Clean metadatas — chroma requires all values to be str/int/float/bool
    clean_metas = []
    for m in metadatas:
        cm = {}
        for k, v in m.items():
            if isinstance(v, (str, int, float, bool)):
                cm[k] = v
            else:
                cm[k] = str(v)
        clean_metas.append(cm)
    embeddings = embed(documents)
    _col.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=clean_metas)

def fetch_all(endpoint, limit=100):
    results = []
    offset = 0
    while True:
        resp = requests.get(f"{WORLD_API}{endpoint}", params={"limit": limit, "offset": offset}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        batch = data["data"]
        results.extend(batch)
        total = data["metadata"]["total"]
        offset += len(batch)
        print(f"  {endpoint}: {offset}/{total}", end="\r", flush=True)
        if offset >= total:
            break
        time.sleep(0.05)
    print(f"  {endpoint}: {len(results)} fetched    ")
    return results

def fetch_one(endpoint):
    resp = requests.get(f"{WORLD_API}{endpoint}", timeout=30)
    resp.raise_for_status()
    return resp.json()

# ─── SHIPS ────────────────────────────────────────────────────────────────────
def index_ships():
    print("\n=== SHIPS ===")
    ships = fetch_all("/v2/ships", limit=100)
    ids, docs, metas = [], [], []

    for s in ships:
        detail = fetch_one(f"/v2/ships/{s['id']}")
        name = detail.get("name", "Unknown")
        cls = detail.get("className", "")
        desc = detail.get("description", "")
        health = detail.get("health", {})
        physics = detail.get("physics", {})
        slots = detail.get("slots", {})
        cap = detail.get("capacitor", {})
        resist = detail.get("damageResistances", {})

        doc = f"""Ship: {name}
Class: {cls}
Description: {desc}
Slots: High={slots.get('high',0)} Medium={slots.get('medium',0)} Low={slots.get('low',0)}
Health: Shield={health.get('shield',0)} HP, Armor={health.get('armor',0)} HP, Structure={health.get('structure',0)} HP
Physics: Mass={physics.get('mass',0):,.0f} kg, MaxVelocity={physics.get('maximumVelocity',0)} m/s, InertiaModifier={physics.get('inertiaModifier',0)}
CPU Output: {detail.get('cpuOutput',0)} tf
Powergrid Output: {detail.get('powergridOutput',0)} MW
Fuel Capacity: {detail.get('fuelCapacity',0)} units
Capacitor: Capacity={cap.get('capacity',0)} GJ, RechargeRate={cap.get('rechargeRate',0)} ms
Damage Resistances Structure: EM={resist.get('structure',{}).get('emDamage',0)} Thermal={resist.get('structure',{}).get('thermalDamage',0)} Kinetic={resist.get('structure',{}).get('kineticDamage',0)} Explosive={resist.get('structure',{}).get('explosiveDamage',0)}"""

        ids.append(f"worldapi_ship_{detail['id']}")
        docs.append(doc)
        metas.append({"type": "ship", "name": name, "class": cls, "typeId": detail['id'], "source": "world_api_v2_ships"})
        print(f"  Prepared: {name} ({cls})")

    for i in range(0, len(ids), 5):
        chroma_upsert(ids[i:i+5], docs[i:i+5], metas[i:i+5])
        print(f"  Indexed ships {i+1}-{min(i+5,len(ids))}/{len(ids)}")
    print(f"  DONE: {len(ids)} ships")

# ─── TYPES ────────────────────────────────────────────────────────────────────
def index_types():
    print("\n=== TYPES (all game items) ===")
    types = fetch_all("/v2/types", limit=100)
    ids, docs, metas = [], [], []

    for t in types:
        name = t.get("name", "")
        cat = t.get("categoryName", "")
        grp = t.get("groupName", "")
        desc = (t.get("description", "") or "").strip()
        vol = t.get("volume", 0)
        mass = t.get("mass", 0)

        doc = f"""Game Type: {name}
Category: {cat}
Group: {grp}
Description: {desc}
Volume: {vol} m3
Mass: {mass} kg
Portion Size: {t.get('portionSize',1)}"""

        ids.append(f"worldapi_type_{t['id']}")
        docs.append(doc)
        metas.append({"type": "gametype", "name": name, "category": cat, "group": grp,
                      "typeId": t['id'], "source": "world_api_v2_types"})

    for i in range(0, len(ids), 20):
        chroma_upsert(ids[i:i+20], docs[i:i+20], metas[i:i+20])
        print(f"  Indexed types {i+1}-{min(i+20,len(ids))}/{len(ids)}")
    print(f"  DONE: {len(ids)} types")

# ─── TRIBES ───────────────────────────────────────────────────────────────────
def index_tribes():
    print("\n=== TRIBES ===")
    tribes = fetch_all("/v2/tribes", limit=100)
    ids, docs, metas = [], [], []

    for t in tribes:
        name = t.get("name", "")
        short = t.get("nameShort", "")
        desc = (t.get("description", "") or "").strip()
        tax = t.get("taxRate", 0)
        url = (t.get("tribeUrl", "") or "").strip()

        doc = f"""Tribe: {name} [{short}]
Description: {desc}
Tax Rate: {tax}%
Website: {url}"""

        ids.append(f"worldapi_tribe_{t['id']}")
        docs.append(doc)
        metas.append({"type": "tribe", "name": name, "nameShort": short,
                      "tribeId": t['id'], "taxRate": float(tax), "source": "world_api_v2_tribes"})

    chroma_upsert(ids, docs, metas)
    print(f"  DONE: {len(ids)} tribes")

# ─── CONSTELLATIONS ───────────────────────────────────────────────────────────
def index_constellations():
    print("\n=== CONSTELLATIONS ===")
    constellations = fetch_all("/v2/constellations", limit=1000)
    ids, docs, metas = [], [], []

    for c in constellations:
        name = c.get("name", "")
        cid = c.get("id")
        rid = c.get("regionId", 0)
        loc = c.get("location", {})
        systems = c.get("solarSystems", [])
        sys_names = ", ".join(s.get("name", "") for s in systems[:15])
        if len(systems) > 15:
            sys_names += f" (+{len(systems)-15} more)"

        doc = f"""Constellation: {name}
ID: {cid}
Region ID: {rid}
Solar Systems ({len(systems)}): {sys_names}"""

        ids.append(f"worldapi_constellation_{cid}")
        docs.append(doc)
        metas.append({"type": "constellation", "name": name, "constellationId": cid,
                      "regionId": rid, "systemCount": len(systems),
                      "source": "world_api_v2_constellations"})

    for i in range(0, len(ids), 50):
        chroma_upsert(ids[i:i+50], docs[i:i+50], metas[i:i+50])
        if i % 500 == 0:
            print(f"  Progress: {i}/{len(ids)}...")
    print(f"  DONE: {len(ids)} constellations")

# ─── SOLAR SYSTEMS ────────────────────────────────────────────────────────────
def index_solarsystems():
    print("\n=== SOLAR SYSTEMS (24502 — this will take a few minutes) ===")
    systems = fetch_all("/v2/solarsystems", limit=1000)
    ids, docs, metas = [], [], []

    for s in systems:
        name = s.get("name", "")
        sid = s.get("id")
        loc = s.get("location", {})
        x, y, z = loc.get("x", 0), loc.get("y", 0), loc.get("z", 0)
        cid = s.get("constellationId", 0)
        rid = s.get("regionId", 0)

        doc = f"""Solar System: {name}
ID: {sid}
Constellation ID: {cid}
Region ID: {rid}
Coordinates: x={x} y={y} z={z}"""

        ids.append(f"worldapi_sys_{sid}")
        docs.append(doc)
        metas.append({"type": "solarsystem", "name": name, "systemId": sid,
                      "constellationId": cid, "regionId": rid,
                      "source": "world_api_v2_solarsystems"})

    total = len(ids)
    for i in range(0, total, 100):
        chroma_upsert(ids[i:i+100], docs[i:i+100], metas[i:i+100])
        if i % 1000 == 0:
            print(f"  Progress: {i}/{total}...")
    print(f"  DONE: {total} solar systems")

# ─── GATE LINKS ───────────────────────────────────────────────────────────────
def index_gate_links():
    """Fetch detailed solar systems to find gate link topology"""
    print("\n=== GATE LINKS (detailed scan) ===")
    systems = fetch_all("/v2/solarsystems", limit=1000)
    ids, docs, metas = [], [], []
    found = 0

    for idx, s in enumerate(systems):
        sid = s["id"]
        try:
            detail = fetch_one(f"/v2/solarsystems/{sid}")
        except Exception:
            continue
        gate_links = detail.get("gateLinks", [])
        if gate_links:
            found += 1
            link_strs = []
            for gl in gate_links:
                dest = gl.get("destination", {})
                link_strs.append(f"{gl.get('name','Gate')} to {dest.get('name','Unknown')} (ID:{dest.get('id','')})")

            doc = f"""Gate Links in {detail['name']}:
""" + "\n".join(f"  {l}" for l in link_strs)

            ids.append(f"worldapi_gatelinks_{sid}")
            docs.append(doc)
            metas.append({"type": "gatelinks", "name": detail["name"], "systemId": sid,
                          "gateCount": len(gate_links), "source": "world_api_solarsystems_detail"})

        if idx % 200 == 0:
            print(f"  Scanned {idx}/{len(systems)}, found {found} gated systems...", flush=True)

        if len(ids) >= 50:
            chroma_upsert(ids, docs, metas)
            ids, docs, metas = [], [], []

    if ids:
        chroma_upsert(ids, docs, metas)
    print(f"  DONE: {found} systems with gate links")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("EVE Frontier World API → ChromaDB RAG Indexer")
    print(f"Collection: {COLLECTION} (current count: {_col.count()})")
    print("=" * 50)

    tasks = sys.argv[1:] if len(sys.argv) > 1 else ["ships", "types", "tribes", "constellations", "solarsystems"]

    if "ships" in tasks:
        index_ships()
    if "types" in tasks:
        index_types()
    if "tribes" in tasks:
        index_tribes()
    if "constellations" in tasks:
        index_constellations()
    if "solarsystems" in tasks:
        index_solarsystems()
    if "gatelinks" in tasks:
        index_gate_links()

    print(f"\nFinal collection count: {_col.count()}")
    print("✓ Indexing complete")
