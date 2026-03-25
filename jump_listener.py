#!/usr/bin/env python3
"""
EVE Frontier — JumpEvent Listener
Queries Sui testnet for gate jump events via suix_queryEvents.

Usage:
    python3 jump_listener.py [--watch] [--limit N] [--package-id 0x...]

Dependencies: stdlib + requests (pip install requests)
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import requests

# ─── CONFIG ──────────────────────────────────────────────────────────────────

# World package ID (all world modules live under this address)
# Source: context / docs for EVE Frontier testnet deployment
# Update if CCP redeployments change this.
DEFAULT_PACKAGE_ID = "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107"

SUI_RPC = "https://fullnode.testnet.sui.io:443"

REQUEST_TIMEOUT = 30   # seconds
POLL_INTERVAL   = 5    # seconds (--watch mode)

# ─── RPC HELPERS ─────────────────────────────────────────────────────────────

_req_id = 0

def _rpc(method: str, params: list, timeout: int = REQUEST_TIMEOUT) -> dict:
    global _req_id
    _req_id += 1
    payload = {
        "jsonrpc": "2.0",
        "id": _req_id,
        "method": method,
        "params": params,
    }
    resp = requests.post(SUI_RPC, json=payload, timeout=timeout,
                         headers={"Content-Type": "application/json"})
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error: {data['error']}")
    return data.get("result", {})


# ─── EVENT QUERY ─────────────────────────────────────────────────────────────

def query_jump_events(package_id: str, limit: int, cursor=None) -> dict:
    """
    Query JumpEvent via suix_queryEvents.

    MoveEventType format: {packageId}::{module}::{EventName}
    gate.move declares:  module world::gate;
    So the event type is: {WORLD_PACKAGE_ID}::gate::JumpEvent
    """
    event_type = f"{package_id}::gate::JumpEvent"
    query = {"MoveEventType": event_type}
    params = [
        query,
        cursor,          # cursor (null = from latest)
        limit,
        False,           # descending order → False = oldest-first; True = latest-first
    ]
    return _rpc("suix_queryEvents", params)


def query_gate_module_events(package_id: str, limit: int, cursor=None) -> dict:
    """
    Fallback: query ALL events emitted by the gate module.
    Uses MoveModule filter instead of MoveEventType.
    """
    query = {
        "MoveModule": {
            "package": package_id,
            "module": "gate",
        }
    }
    params = [query, cursor, limit, False]
    return _rpc("suix_queryEvents", params)


# ─── PRETTY-PRINT ─────────────────────────────────────────────────────────────

def fmt_tenant_item_id(tid) -> str:
    """TenantItemId is typically {item_id, tenant} or a plain u64."""
    if isinstance(tid, dict):
        item  = tid.get("item_id") or tid.get("itemId") or "?"
        tenant = tid.get("tenant") or tid.get("tenant_id") or ""
        return f"{item}" + (f" (tenant={tenant})" if tenant else "")
    return str(tid)


def ms_to_utc(ms) -> str:
    try:
        ts = int(ms) / 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        return str(ms)


def print_event(evt: dict, idx: int = 0):
    """Pretty-print a single Sui event dict."""
    sep = "─" * 60
    print(f"\n{sep}")
    print(f"  EVENT #{idx + 1}")
    print(sep)

    # Sui event envelope fields
    tx_digest   = evt.get("id", {}).get("txDigest", "?")
    event_seq   = evt.get("id", {}).get("eventSeq", "?")
    timestamp   = evt.get("timestampMs", None)
    event_type  = evt.get("type", "?")

    print(f"  TX Digest  : {tx_digest}")
    print(f"  Event Seq  : {event_seq}")
    if timestamp:
        print(f"  Timestamp  : {ms_to_utc(timestamp)}  ({timestamp} ms)")
    print(f"  Event Type : {event_type}")

    parsed = evt.get("parsedJson") or evt.get("parsed_json") or {}

    if parsed:
        # JumpEvent fields
        src_gate_id  = parsed.get("source_gate_id", parsed.get("sourceGateId", "?"))
        src_gate_key = parsed.get("source_gate_key", parsed.get("sourceGateKey"))
        dst_gate_id  = parsed.get("destination_gate_id", parsed.get("destinationGateId", "?"))
        dst_gate_key = parsed.get("destination_gate_key", parsed.get("destinationGateKey"))
        char_id      = parsed.get("character_id", parsed.get("characterId", "?"))
        char_key     = parsed.get("character_key", parsed.get("characterKey"))

        print(f"\n  ── Jump Details ──")
        print(f"  Character  : {char_id}")
        if char_key:
            print(f"  Char Key   : {fmt_tenant_item_id(char_key)}")
        print(f"  From Gate  : {src_gate_id}")
        if src_gate_key:
            print(f"  Src Key    : {fmt_tenant_item_id(src_gate_key)}")
        print(f"  To Gate    : {dst_gate_id}")
        if dst_gate_key:
            print(f"  Dst Key    : {fmt_tenant_item_id(dst_gate_key)}")
    else:
        # Raw fallback
        bcs = evt.get("bcs", "")
        print(f"\n  [no parsedJson — raw BCS]: {bcs[:80]}{'...' if len(bcs) > 80 else ''}")
        print(f"  Full event JSON:")
        print(json.dumps(evt, indent=4))

    print(sep)


def print_summary(events: list, label: str = "JumpEvent"):
    if not events:
        print(f"\n[INFO] No {label} events found on testnet.")
    else:
        print(f"\n[INFO] Found {len(events)} {label} event(s).")


# ─── WATCH MODE ───────────────────────────────────────────────────────────────

def watch(package_id: str, limit: int, use_fallback: bool):
    """Poll for new JumpEvents continuously."""
    print(f"[WATCH] Polling for JumpEvents every {POLL_INTERVAL}s …  (Ctrl-C to stop)")
    cursor = None
    seen_seqs = set()

    while True:
        try:
            if use_fallback:
                result = query_gate_module_events(package_id, limit, cursor)
            else:
                result = query_jump_events(package_id, limit, cursor)

            events = result.get("data", [])
            new_events = [e for e in events if e.get("id", {}).get("eventSeq") not in seen_seqs]

            for i, evt in enumerate(new_events):
                seq = evt.get("id", {}).get("eventSeq")
                if seq:
                    seen_seqs.add(seq)
                print_event(evt, i)

            if not new_events and not events:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] No new events …", end="\r")

            # Advance cursor to the last item
            next_cursor = result.get("nextCursor")
            if next_cursor:
                cursor = next_cursor

        except KeyboardInterrupt:
            print("\n[WATCH] Stopped.")
            sys.exit(0)
        except Exception as e:
            print(f"\n[WARN] Query error: {e}")

        time.sleep(POLL_INTERVAL)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    global SUI_RPC
    parser = argparse.ArgumentParser(
        description="EVE Frontier JumpEvent listener on Sui testnet"
    )
    parser.add_argument(
        "--package-id", default=DEFAULT_PACKAGE_ID,
        help="World package ID (default: known testnet deployment)"
    )
    parser.add_argument(
        "--limit", type=int, default=20,
        help="Max events to fetch per query (default: 20)"
    )
    parser.add_argument(
        "--watch", action="store_true",
        help="Continuously poll for new events every 5 seconds"
    )
    parser.add_argument(
        "--fallback", action="store_true",
        help="Use MoveModule filter (all gate events) instead of JumpEvent type filter"
    )
    parser.add_argument(
        "--rpc", default=SUI_RPC,
        help=f"Sui RPC endpoint (default: {SUI_RPC})"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output raw JSON instead of pretty-print"
    )
    args = parser.parse_args()

    SUI_RPC = args.rpc

    pkg = args.package_id
    event_type_str = f"{pkg}::gate::JumpEvent"
    print(f"[INFO] RPC             : {SUI_RPC}")
    print(f"[INFO] Package ID      : {pkg}")
    print(f"[INFO] JumpEvent type  : {event_type_str}")
    print(f"[INFO] Limit           : {args.limit}")
    print(f"[INFO] Mode            : {'WATCH' if args.watch else 'ONE-SHOT'}")
    if args.fallback:
        print("[INFO] Filter          : MoveModule (all gate events — fallback mode)")
    else:
        print(f"[INFO] Filter          : MoveEventType={event_type_str}")

    if args.watch:
        watch(pkg, args.limit, args.fallback)
        return

    # ── One-shot query ────────────────────────────────────────────────────────
    try:
        if args.fallback:
            result = query_gate_module_events(pkg, args.limit)
            label = "gate module"
        else:
            result = query_jump_events(pkg, args.limit)
            label = "JumpEvent"
    except Exception as e:
        print(f"\n[ERROR] Query failed: {e}")
        print("[HINT]  If you get 'no events' with the default filter, try --fallback")
        sys.exit(1)

    events = result.get("data", [])
    has_next = result.get("hasNextPage", False)
    next_cur = result.get("nextCursor")

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_summary(events, label)
        for i, evt in enumerate(events):
            print_event(evt, i)
        if has_next:
            print(f"\n[INFO] More events available. nextCursor: {next_cur}")
            print("[INFO] Re-run with a cursor implementation to page through results.")


if __name__ == "__main__":
    main()
