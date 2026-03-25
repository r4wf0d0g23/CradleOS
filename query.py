#!/usr/bin/env python3
"""
EVE Frontier Query Layer
Usage: python3 query.py <command> [args]

Commands:
  system <id>              — Full system info
  region <id>              — Region info + system count
  route <from_id> <to_id>  — Shortest gate route (BFS)
  find sec <class>         — Systems by security class (D1/D2/etc)
  find wh <class_id>       — Systems by wormhole class
  find potential <min>     — Systems with potential >= min
  bp <typeID>              — What blueprints produce this typeID
  bp info <blueprintTypeID>— Full blueprint recipe
  loc <locationID>         — Resolve location → solar system
  stats                    — Universe statistics
"""

import sqlite3, sys, json
from collections import deque

DB = '/home/agent-raw/.openclaw/workspace/frontier/frontier.db'

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def system_info(sid):
    with conn() as c:
        s = c.execute("SELECT * FROM systems WHERE solarSystemID=?", (sid,)).fetchone()
        if not s: return None
        r = dict(s)
        r['jumps_to'] = [dict(j) for j in c.execute(
            "SELECT toSystemID, stargateID, jumpType FROM jumps WHERE fromSystemID=?", (sid,)).fetchall()]
        r['planets'] = [row[0] for row in c.execute(
            "SELECT planetItemID FROM system_planets WHERE solarSystemID=?", (sid,)).fetchall()]
        r['planet_types'] = {row[0]: row[1] for row in c.execute(
            "SELECT planetTypeID, count FROM system_planet_types WHERE solarSystemID=?", (sid,)).fetchall()}
        return r

def region_info(rid):
    with conn() as c:
        r = c.execute("SELECT * FROM regions WHERE regionID=?", (rid,)).fetchone()
        if not r: return None
        result = dict(r)
        result['constellation_count'] = c.execute(
            "SELECT COUNT(*) FROM constellations WHERE regionID=?", (rid,)).fetchone()[0]
        result['system_count'] = c.execute(
            "SELECT COUNT(*) FROM systems WHERE regionID=?", (rid,)).fetchone()[0]
        result['security_breakdown'] = {row[0]: row[1] for row in c.execute(
            "SELECT securityClass, COUNT(*) FROM systems WHERE regionID=? GROUP BY securityClass", (rid,)).fetchall()}
        return result

def route(from_id, to_id):
    """BFS shortest gate route. Returns list of systemIDs or None."""
    if from_id == to_id: return [from_id]
    with conn() as c:
        # Build adjacency from jumps table
        adj = {}
        for row in c.execute("SELECT fromSystemID, toSystemID FROM jumps"):
            adj.setdefault(row[0], []).append(row[1])

    visited = {from_id: None}
    q = deque([from_id])
    while q:
        cur = q.popleft()
        for nb in adj.get(cur, []):
            if nb not in visited:
                visited[nb] = cur
                if nb == to_id:
                    # Reconstruct path
                    path = []
                    node = to_id
                    while node is not None:
                        path.append(node)
                        node = visited[node]
                    return list(reversed(path))
                q.append(nb)
    return None

def find_systems(filter_type, value):
    with conn() as c:
        if filter_type == 'sec':
            rows = c.execute(
                "SELECT solarSystemID, regionID, securityClass, potential FROM systems WHERE securityClass=? LIMIT 50",
                (value,)).fetchall()
        elif filter_type == 'wh':
            rows = c.execute(
                "SELECT solarSystemID, regionID, securityClass, potential FROM systems WHERE wormholeClassID=? LIMIT 50",
                (int(value),)).fetchall()
        elif filter_type == 'potential':
            rows = c.execute(
                "SELECT solarSystemID, regionID, securityClass, potential FROM systems WHERE potential>=? ORDER BY potential DESC LIMIT 50",
                (float(value),)).fetchall()
        else:
            return []
        return [dict(r) for r in rows]

def bp_produces(type_id):
    """What blueprints produce typeID X?"""
    with conn() as c:
        rows = c.execute(
            "SELECT p.blueprintTypeID, p.activity, p.quantity, p.time, b.maxProductionLimit "
            "FROM blueprint_products p JOIN blueprints b ON p.blueprintTypeID=b.blueprintTypeID "
            "WHERE p.typeID=?", (type_id,)).fetchall()
        return [dict(r) for r in rows]

def bp_info(blueprint_id):
    """Full recipe for a blueprint."""
    with conn() as c:
        bp = c.execute("SELECT * FROM blueprints WHERE blueprintTypeID=?", (blueprint_id,)).fetchone()
        if not bp: return None
        result = dict(bp)
        result['materials'] = [dict(r) for r in c.execute(
            "SELECT activity, typeID, quantity FROM blueprint_materials WHERE blueprintTypeID=?",
            (blueprint_id,)).fetchall()]
        result['products'] = [dict(r) for r in c.execute(
            "SELECT activity, typeID, quantity, time FROM blueprint_products WHERE blueprintTypeID=?",
            (blueprint_id,)).fetchall()]
        return result

def resolve_location(location_id):
    with conn() as c:
        row = c.execute("SELECT solarSystemID FROM locationcache WHERE locationID=?", (location_id,)).fetchone()
        if not row: return None
        sid = row[0]
        s = c.execute("SELECT solarSystemID, regionID, securityClass FROM systems WHERE solarSystemID=?", (sid,)).fetchone()
        return dict(s) if s else {'solarSystemID': sid}

def stats():
    with conn() as c:
        return {
            'regions':       c.execute("SELECT COUNT(*) FROM regions").fetchone()[0],
            'constellations':c.execute("SELECT COUNT(*) FROM constellations").fetchone()[0],
            'systems':       c.execute("SELECT COUNT(*) FROM systems").fetchone()[0],
            'jump_edges':    c.execute("SELECT COUNT(*) FROM jumps").fetchone()[0],
            'blueprints':    c.execute("SELECT COUNT(*) FROM blueprints").fetchone()[0],
            'locations':     c.execute("SELECT COUNT(*) FROM locationcache").fetchone()[0],
            'security_classes': {r[0]: r[1] for r in c.execute(
                "SELECT securityClass, COUNT(*) FROM systems GROUP BY securityClass ORDER BY 2 DESC").fetchall()},
            'wh_classes': {r[0]: r[1] for r in c.execute(
                "SELECT wormholeClassID, COUNT(*) FROM systems GROUP BY wormholeClassID ORDER BY 2 DESC").fetchall()},
            'frontier_regions': c.execute(
                "SELECT COUNT(*) FROM regions WHERE regionID >= 12000000").fetchone()[0],
        }


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    cmd = args[0]

    if cmd == 'system' and len(args) >= 2:
        result = system_info(int(args[1]))
        print(json.dumps(result, indent=2, default=str))

    elif cmd == 'region' and len(args) >= 2:
        result = region_info(int(args[1]))
        print(json.dumps(result, indent=2, default=str))

    elif cmd == 'route' and len(args) >= 3:
        path = route(int(args[1]), int(args[2]))
        if path:
            print(f"Route ({len(path)-1} jumps): {' → '.join(map(str, path))}")
        else:
            print("No route found.")

    elif cmd == 'find' and len(args) >= 3:
        results = find_systems(args[1], args[2])
        for r in results:
            print(f"  {r['solarSystemID']} region={r['regionID']} sec={r['securityClass']} potential={r['potential']:.2f}")

    elif cmd == 'bp' and len(args) >= 2:
        if args[1] == 'info' and len(args) >= 3:
            result = bp_info(int(args[2]))
            print(json.dumps(result, indent=2))
        else:
            results = bp_produces(int(args[1]))
            for r in results:
                print(f"  bp={r['blueprintTypeID']} activity={r['activity']} qty={r['quantity']} time={r['time']}s")

    elif cmd == 'loc' and len(args) >= 2:
        result = resolve_location(int(args[1]))
        print(json.dumps(result, indent=2, default=str))

    elif cmd == 'stats':
        print(json.dumps(stats(), indent=2))

    else:
        print(__doc__)
