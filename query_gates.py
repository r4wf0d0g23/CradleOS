#!/usr/bin/env python3
"""
EVE Frontier — Gate Object Query (GraphQL)
Queries all deployed Gate objects on Sui testnet by struct type.

Returns per gate: gate ID, owner, linked gate ID, type_id, location hash,
and status (online/offline).

Usage:
    python3 query_gates.py [--package-id 0x...] [--limit N]

Dependencies: stdlib + requests (pip install requests)
"""

import argparse
import json
import sys

import requests

# ─── CONFIG ──────────────────────────────────────────────────────────────────

DEFAULT_PACKAGE_ID = "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107"

GRAPHQL_ENDPOINT = "https://graphql.testnet.sui.io/graphql"
REQUEST_TIMEOUT  = 30

# ─── GraphQL QUERIES ──────────────────────────────────────────────────────────

# Query all Gate objects by their Move type
GATE_OBJECTS_QUERY = """
query GetGateObjects($type: String!, $after: String, $first: Int) {
  objects(
    filter: { type: $type }
    first: $first
    after: $after
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      address
      version
      asMoveObject {
        owner {
          ... on AddressOwner {
            address { address }
          }
          ... on Shared {
            initialSharedVersion
          }
          ... on Immutable {
            __typename
          }
        }
        contents {
          type { repr }
          json
        }
      }
    }
  }
}
"""

# Simpler fallback: query by package ID (all objects from that package)
PACKAGE_OBJECTS_QUERY = """
query GetPackageObjects($package: SuiAddress!) {
  object(address: $package) {
    asMovePackage {
      modules {
        nodes {
          name
          fileFormatVersion
        }
      }
    }
  }
}
"""

# Query GateConfig shared object by type
GATE_CONFIG_QUERY = """
query GetGateConfig($type: String!) {
  objects(filter: { type: $type }, first: 5) {
    nodes {
      address
      asMoveObject {
        owner {
          ... on Shared {
            initialSharedVersion
          }
          ... on AddressOwner {
            address { address }
          }
        }
        contents {
          json
        }
      }
    }
  }
}
"""


# ─── GraphQL HELPERS ──────────────────────────────────────────────────────────

def graphql(query: str, variables: dict = None, timeout: int = REQUEST_TIMEOUT) -> dict:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(
        GRAPHQL_ENDPOINT,
        json=payload,
        timeout=timeout,
        headers={"Content-Type": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {json.dumps(data['errors'], indent=2)}")
    return data.get("data", {})


# ─── DISPLAY ──────────────────────────────────────────────────────────────────

def fmt_owner(owner_node) -> str:
    """owner_node is the object from asMoveObject.owner."""
    if not owner_node:
        return "unknown"
    # AddressOwner: { address: { address: "0x..." } }
    if "address" in owner_node and isinstance(owner_node["address"], dict):
        return f"address:{owner_node['address'].get('address', '?')}"
    # Shared: { initialSharedVersion: N }
    if "initialSharedVersion" in owner_node:
        return f"shared (v{owner_node['initialSharedVersion']})"
    if owner_node.get("__typename") == "Immutable":
        return "immutable"
    return str(owner_node)


def print_gate(node: dict, idx: int):
    sep = "─" * 60
    print(f"\n{sep}")
    print(f"  GATE #{idx + 1}")
    print(sep)
    print(f"  Object ID  : {node.get('address', '?')}")
    print(f"  Version    : {node.get('version', '?')}")

    move_obj = node.get("asMoveObject") or {}
    owner_node = move_obj.get("owner")
    print(f"  Owner      : {fmt_owner(owner_node)}")
    contents_node = move_obj.get("contents") or {}
    obj_type = (contents_node.get("type") or {}).get("repr", "?")
    print(f"  Type       : {obj_type}")

    contents = contents_node.get("json")
    if contents:
        if isinstance(contents, str):
            try:
                contents = json.loads(contents)
            except Exception:
                pass

        if isinstance(contents, dict):
            # Gate fields from gate.move
            linked = contents.get("linked_gate_id") or contents.get("linkedGateId")
            type_id = contents.get("type_id") or contents.get("typeId")
            location = contents.get("location")
            status = contents.get("status")
            key = contents.get("key")
            energy = contents.get("energy_source_id") or contents.get("energySourceId")

            if type_id is not None:
                print(f"  Type ID    : {type_id}")
            if key:
                print(f"  Key        : {json.dumps(key)}")
            if linked:
                lval = linked.get("Some") or linked.get("some") or linked
                print(f"  Linked Gate: {lval}")
            else:
                print(f"  Linked Gate: (none)")
            if location:
                loc_hash = location.get("hash") or location.get("location_hash") or location
                print(f"  Location   : {loc_hash}")
            if status:
                is_online = status.get("is_online") or status.get("isOnline") or "?"
                print(f"  Online     : {is_online}")
            if energy:
                eval_ = energy.get("Some") or energy.get("some") or energy
                print(f"  Energy Src : {eval_}")
        else:
            print(f"  Contents   : {str(contents)[:200]}")
    else:
        print(f"  Contents   : (unavailable)")

    print(sep)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    global GRAPHQL_ENDPOINT
    parser = argparse.ArgumentParser(
        description="EVE Frontier Gate object query via Sui GraphQL"
    )
    parser.add_argument(
        "--package-id", default=DEFAULT_PACKAGE_ID,
        help="World package ID (default: known testnet deployment)"
    )
    parser.add_argument(
        "--limit", type=int, default=20,
        help="Max Gate objects to fetch (default: 20)"
    )
    parser.add_argument(
        "--endpoint", default=GRAPHQL_ENDPOINT,
        help=f"GraphQL endpoint (default: {GRAPHQL_ENDPOINT})"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output raw JSON"
    )
    parser.add_argument(
        "--inspect-package", action="store_true",
        help="Query package modules (to verify deployment)"
    )
    args = parser.parse_args()

    GRAPHQL_ENDPOINT = args.endpoint

    pkg = args.package_id
    gate_type  = f"{pkg}::gate::Gate"
    config_type = f"{pkg}::gate::GateConfig"

    print(f"[INFO] GraphQL Endpoint : {GRAPHQL_ENDPOINT}")
    print(f"[INFO] Package ID       : {pkg}")
    print(f"[INFO] Gate type        : {gate_type}")

    # ── Optional package module inspection ──
    if args.inspect_package:
        print(f"\n[INFO] Inspecting package modules …")
        try:
            data = graphql(PACKAGE_OBJECTS_QUERY, {"package": pkg})
            pkg_obj = data.get("object") or {}
            move_pkg = pkg_obj.get("asMovePackage") or {}
            modules = (move_pkg.get("modules") or {}).get("nodes", [])
            if modules:
                print(f"[INFO] Modules in package ({len(modules)}):")
                for m in modules:
                    print(f"       - {m.get('name')} (v{m.get('fileFormatVersion')})")
            else:
                print("[WARN] Package not found or has no modules on testnet.")
                print("[HINT] The Utopia testnet deploys on March 11, 2026.")
        except Exception as e:
            print(f"[ERROR] Package inspection failed: {e}")

    # ── Query GateConfig (shared singleton) ──
    print(f"\n[INFO] Querying GateConfig objects …")
    try:
        cfg_data = graphql(GATE_CONFIG_QUERY, {"type": config_type})
        cfg_nodes = (cfg_data.get("objects") or {}).get("nodes", [])
        if cfg_nodes:
            print(f"[INFO] Found {len(cfg_nodes)} GateConfig object(s):")
            for n in cfg_nodes:
                move_obj = n.get("asMoveObject") or {}
                owner = move_obj.get("owner")
                print(f"       ID: {n.get('address')}  Owner: {fmt_owner(owner)}")
                contents = move_obj.get("contents") or {}
                cfg_json = contents.get("json")
                if cfg_json:
                    print(f"       Contents: {json.dumps(cfg_json)[:300]}")
        else:
            print("[INFO] No GateConfig objects found (package may not be deployed yet).")
    except Exception as e:
        print(f"[WARN] GateConfig query error: {e}")

    # ── Query Gate objects ──
    print(f"\n[INFO] Querying Gate objects (type={gate_type}) …")
    all_gates = []
    cursor = None
    page = 0

    while True:
        page += 1
        try:
            data = graphql(
                GATE_OBJECTS_QUERY,
                {"type": gate_type, "first": min(args.limit, 50), "after": cursor},
            )
        except Exception as e:
            print(f"[ERROR] GraphQL query failed (page {page}): {e}")
            break

        objects = data.get("objects") or {}
        nodes   = objects.get("nodes", [])
        page_info = objects.get("pageInfo", {})

        all_gates.extend(nodes)

        if not page_info.get("hasNextPage") or len(all_gates) >= args.limit:
            break
        cursor = page_info.get("endCursor")

    # ── Output ──
    if args.json:
        print(json.dumps(all_gates, indent=2))
        return

    if not all_gates:
        print("[INFO] No Gate objects found on testnet.")
        print("[HINT] The EVE Frontier Utopia sandbox launches March 11, 2026.")
        print("[HINT] Try --inspect-package to verify the package exists.")
    else:
        print(f"\n[INFO] Found {len(all_gates)} Gate object(s):\n")
        for i, node in enumerate(all_gates):
            print_gate(node, i)


if __name__ == "__main__":
    main()
