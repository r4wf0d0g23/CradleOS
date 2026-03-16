"""
Frontier Intel API
FastAPI service over frontier.db
"""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import subprocess
import time
from contextlib import asynccontextmanager
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.path.join(os.path.dirname(__file__), "frontier.db")

# ── Sui config ────────────────────────────────────────────────────────────────
DEFAULT_PACKAGE_ID = "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107"
SUI_RPC = "https://fullnode.testnet.sui.io:443"
POLL_INTERVAL = 15  # seconds

# CradleOS contract package (V12 = latest)
CRADLEOS_PKG = os.environ.get(
    "CRADLEOS_PKG",
    "0x30557f9ccf881e7dd40c58aaf159d542280d7c42b4ef9b0ec2d7f3b63f7c0fd7",
)

# oracle_tx.mjs path (same directory as this file)
ORACLE_TX_SCRIPT = os.path.join(os.path.dirname(__file__), "oracle_tx.mjs")

# Runtime-mutable package ID (hot-swap via /config/package-id)
_active_package_id: str = os.environ.get("WORLD_PACKAGE_ID", DEFAULT_PACKAGE_ID)


# ── DB helpers ────────────────────────────────────────────────────────────────

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def _ensure_tables():
    """Create jump_events and intel_config tables if they don't exist."""
    con = db()
    con.executescript("""
        CREATE TABLE IF NOT EXISTS jump_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_digest TEXT UNIQUE,
            timestamp_ms INTEGER,
            source_gate_id TEXT,
            destination_gate_id TEXT,
            character_id TEXT,
            character_key TEXT,
            source_gate_key TEXT,
            destination_gate_key TEXT,
            ingested_at INTEGER DEFAULT (strftime('%s','now') * 1000)
        );
        CREATE TABLE IF NOT EXISTS intel_config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    con.commit()
    con.close()


def _config_get(key: str) -> Optional[str]:
    con = db()
    try:
        row = con.execute("SELECT value FROM intel_config WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None
    finally:
        con.close()


def _config_set(key: str, value: str):
    con = db()
    try:
        con.execute(
            "INSERT OR REPLACE INTO intel_config (key, value) VALUES (?, ?)", (key, value)
        )
        con.commit()
    finally:
        con.close()


# ── Sui Poller ────────────────────────────────────────────────────────────────

class SuiPoller:
    """Background asyncio task that polls suix_queryEvents for JumpEvents."""

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._rpc_id = 0

    async def _rpc(self, method: str, params: list) -> dict:
        self._rpc_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self._rpc_id,
            "method": method,
            "params": params,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                SUI_RPC,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"RPC error: {data['error']}")
        return data.get("result", {})

    async def _query_jumps(self, package_id: str, cursor=None) -> dict:
        event_type = f"{package_id}::gate::JumpEvent"
        return await self._rpc(
            "suix_queryEvents",
            [{"MoveEventType": event_type}, cursor, 50, False],
        )

    def _ingest(self, events: list):
        if not events:
            return
        con = db()
        inserted = 0
        for evt in events:
            tx_digest = evt.get("id", {}).get("txDigest")
            if not tx_digest:
                continue
            timestamp_ms = evt.get("timestampMs")
            parsed = evt.get("parsedJson") or {}
            src_gate_id = parsed.get("source_gate_id") or parsed.get("sourceGateId")
            dst_gate_id = parsed.get("destination_gate_id") or parsed.get("destinationGateId")
            char_id = parsed.get("character_id") or parsed.get("characterId")
            char_key = str(parsed.get("character_key") or parsed.get("characterKey") or "")
            src_gate_key = str(parsed.get("source_gate_key") or parsed.get("sourceGateKey") or "")
            dst_gate_key = str(parsed.get("destination_gate_key") or parsed.get("destinationGateKey") or "")
            try:
                con.execute(
                    """INSERT OR IGNORE INTO jump_events
                       (tx_digest, timestamp_ms, source_gate_id, destination_gate_id,
                        character_id, character_key, source_gate_key, destination_gate_key)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (tx_digest, timestamp_ms, src_gate_id, dst_gate_id,
                     char_id, char_key, src_gate_key, dst_gate_key),
                )
                inserted += 1
            except Exception:
                pass
        con.commit()
        con.close()
        if inserted:
            print(f"[SuiPoller] Ingested {inserted} new jump event(s)")

    async def _poll_loop(self):
        global _active_package_id
        print(f"[SuiPoller] Starting — polling every {POLL_INTERVAL}s")
        while True:
            try:
                pkg = _active_package_id
                # Load cursor from DB
                cursor_val = _config_get("jump_cursor")
                result = await self._query_jumps(pkg, cursor_val)
                events = result.get("data", [])
                self._ingest(events)
                # Advance cursor
                next_cursor = result.get("nextCursor")
                if next_cursor and next_cursor != cursor_val:
                    _config_set("jump_cursor", str(next_cursor) if not isinstance(next_cursor, str) else next_cursor)
            except asyncio.CancelledError:
                print("[SuiPoller] Cancelled.")
                return
            except Exception as e:
                print(f"[SuiPoller] Poll error: {e}")
            await asyncio.sleep(POLL_INTERVAL)

    def start(self):
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


_poller = SuiPoller()


# ── Contract Oracle ───────────────────────────────────────────────────────────

class ContractOracle:
    """
    Watches for ItemMintedEvent and KillmailEvent on-chain.
    Cross-references open CradleOS contracts (cargo, SRP, bounty).
    Auto-submits finalize transactions via oracle_tx.mjs.
    """

    ORACLE_POLL_INTERVAL = 30  # seconds
    # Event types to watch (WORLD_PKG_UTOPIA)
    WORLD_PKG_UTOPIA = "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75"

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._rpc_id = 0
        self._env = self._load_env()

    def _load_env(self) -> dict:
        """Load .env for oracle_tx.mjs subprocess."""
        env = os.environ.copy()
        env_path = os.path.expanduser("~/.openclaw/.env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        env.setdefault(k.strip(), v.strip())
        return env

    async def _rpc(self, method: str, params: list) -> dict:
        self._rpc_id += 1
        payload = {"jsonrpc": "2.0", "id": self._rpc_id, "method": method, "params": params}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(SUI_RPC, json=payload,
                                     headers={"Content-Type": "application/json"})
            resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"RPC error: {data['error']}")
        return data.get("result", {})

    async def _query_objects(self, struct_type: str) -> list:
        """Fetch all shared objects of a given StructType."""
        result = await self._rpc("suix_queryObjects", [
            {"StructType": struct_type},
            None, 50, False,
        ])
        return result.get("data", [])

    async def _get_object_fields(self, object_id: str) -> Optional[dict]:
        """Fetch parsed fields for a Move object."""
        result = await self._rpc("sui_getObject", [
            object_id,
            {"showContent": True, "showType": True},
        ])
        content = result.get("data", {}).get("content", {})
        return content.get("fields")

    async def _submit_tx(self, action: str, args: dict) -> Optional[str]:
        """Call oracle_tx.mjs in a subprocess. Returns digest or None on failure."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "node", ORACLE_TX_SCRIPT, action, json.dumps(args),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self._env,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            out = stdout.decode().strip()
            if proc.returncode != 0:
                print(f"[Oracle] {action} failed: {out or stderr.decode().strip()}")
                return None
            result = json.loads(out)
            if "error" in result:
                print(f"[Oracle] {action} error: {result['error']}")
                return None
            digest = result.get("digest")
            print(f"[Oracle] {action} finalized: {digest}")
            return digest
        except Exception as e:
            print(f"[Oracle] {action} exception: {e}")
            return None

    async def _check_cargo_contracts(self):
        """Find CargoContracts with status=claimed and expired dispute window → finalize."""
        now_ms = int(time.time() * 1000)
        struct_type = f"{CRADLEOS_PKG}::cargo_contract::CargoContract"
        try:
            objects = await self._query_objects(struct_type)
        except Exception as e:
            print(f"[Oracle] cargo query error: {e}")
            return
        for obj in objects:
            obj_id = obj.get("data", {}).get("objectId") or obj.get("objectId")
            if not obj_id:
                continue
            try:
                fields = await self._get_object_fields(obj_id)
                if not fields:
                    continue
                status = int(fields.get("status", 255))
                # status 1 = claimed
                if status != 1:
                    continue
                claim_ms = int(fields.get("claim_submitted_ms", 0))
                dispute_ms = int(fields.get("dispute_window_ms", 86_400_000))
                if claim_ms > 0 and (now_ms - claim_ms) >= dispute_ms:
                    print(f"[Oracle] Finalizing cargo contract {obj_id}")
                    await self._submit_tx("finalize_cargo", {
                        "contract_id": obj_id,
                        "pkg": CRADLEOS_PKG,
                    })
            except Exception as e:
                print(f"[Oracle] cargo finalize error ({obj_id}): {e}")

    async def _check_srp_claims(self):
        """Find SRPClaims with status=pending and expired dispute window → finalize."""
        now_ms = int(time.time() * 1000)
        claim_type = f"{CRADLEOS_PKG}::ship_reimbursement::SRPClaim"
        policy_type = f"{CRADLEOS_PKG}::ship_reimbursement::SRPPolicy"
        try:
            claims = await self._query_objects(claim_type)
            policies = await self._query_objects(policy_type)
        except Exception as e:
            print(f"[Oracle] SRP query error: {e}")
            return

        # Build policy_id → dispute_window_ms map
        policy_windows: dict[str, int] = {}
        for pol in policies:
            pol_id = pol.get("data", {}).get("objectId") or pol.get("objectId")
            if pol_id:
                try:
                    fields = await self._get_object_fields(pol_id)
                    if fields:
                        policy_windows[pol_id] = int(fields.get("dispute_window_ms", 86_400_000))
                except Exception:
                    pass

        for claim in claims:
            claim_id = claim.get("data", {}).get("objectId") or claim.get("objectId")
            if not claim_id:
                continue
            try:
                fields = await self._get_object_fields(claim_id)
                if not fields:
                    continue
                status = int(fields.get("status", 255))
                if status != 0:  # 0 = pending
                    continue
                policy_id = str(fields.get("policy_id", ""))
                if not policy_id:
                    continue
                submitted_ms = int(fields.get("claim_submitted_ms", 0))
                dispute_ms = policy_windows.get(policy_id, 86_400_000)
                if submitted_ms > 0 and (now_ms - submitted_ms) >= dispute_ms:
                    print(f"[Oracle] Finalizing SRP claim {claim_id}")
                    await self._submit_tx("finalize_srp", {
                        "claim_id": claim_id,
                        "policy_id": policy_id,
                        "pkg": CRADLEOS_PKG,
                    })
            except Exception as e:
                print(f"[Oracle] SRP finalize error ({claim_id}): {e}")

    async def _poll_loop(self):
        print(f"[ContractOracle] Starting — polling every {self.ORACLE_POLL_INTERVAL}s")
        while True:
            try:
                await self._check_cargo_contracts()
                await self._check_srp_claims()
            except asyncio.CancelledError:
                print("[ContractOracle] Cancelled.")
                return
            except Exception as e:
                print(f"[ContractOracle] Poll error: {e}")
            await asyncio.sleep(self.ORACLE_POLL_INTERVAL)

    def start(self):
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


_oracle = ContractOracle()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_tables()
    _poller.start()
    _oracle.start()
    yield
    await _poller.stop()
    await _oracle.stop()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Frontier Intel API", version="2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ── System helpers (unchanged) ────────────────────────────────────────────────

def _resolve_system(ident: str) -> Optional[dict]:
    """Find system by name or ID."""
    con = db()
    try:
        try:
            sid = int(ident)
            row = con.execute("""
                SELECT s.solarSystemID, n.name, s.securityClass, s.potential,
                       s.regionID, rn.name as region,
                       s.constellationID, cn.name as constellation,
                       s.nameID
                FROM systems s
                LEFT JOIN names n  ON n.nameID = s.nameID
                LEFT JOIN regions r ON r.regionID = s.regionID
                LEFT JOIN names rn ON rn.nameID = r.nameID
                LEFT JOIN constellations c ON c.constellationID = s.constellationID
                LEFT JOIN names cn ON cn.nameID = c.nameID
                WHERE s.solarSystemID = ?
            """, (sid,)).fetchone()
            if row:
                return dict(row)
        except ValueError:
            pass

        row = con.execute("""
            SELECT s.solarSystemID, n.name, s.securityClass, s.potential,
                   s.regionID, rn.name as region,
                   s.constellationID, cn.name as constellation,
                   s.nameID
            FROM systems s
            LEFT JOIN names n  ON n.nameID = s.nameID
            LEFT JOIN regions r ON r.regionID = s.regionID
            LEFT JOIN names rn ON rn.nameID = r.nameID
            LEFT JOIN constellations c ON c.constellationID = s.constellationID
            LEFT JOIN names cn ON cn.nameID = c.nameID
            WHERE LOWER(n.name) = LOWER(?)
        """, (ident,)).fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def _bfs_route(from_id: int, to_id: int, avoid: List[int] = None) -> Optional[List[int]]:
    """BFS shortest path through jump network."""
    if from_id == to_id:
        return [from_id]
    avoid_set = set(avoid or [])
    con = db()
    try:
        rows = con.execute("SELECT fromSystemID, toSystemID FROM jumps").fetchall()
        graph = {}
        for r in rows:
            a, b = r[0], r[1]
            if a not in graph: graph[a] = []
            if b not in graph: graph[b] = []
            graph[a].append(b)
            graph[b].append(a)

        from collections import deque
        queue = deque([[from_id]])
        visited = {from_id}
        while queue:
            path = queue.popleft()
            node = path[-1]
            for neighbor in graph.get(node, []):
                if neighbor in visited or neighbor in avoid_set:
                    continue
                new_path = path + [neighbor]
                if neighbor == to_id:
                    return new_path
                visited.add(neighbor)
                queue.append(new_path)
        return None
    finally:
        con.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "online", "service": "Frontier Intel API", "version": "2.0"}


@app.get("/oracle/status")
def oracle_status():
    """Settlement oracle status — is it running, what package is it watching."""
    return {
        "running": _oracle._task is not None and not _oracle._task.done(),
        "cradleos_pkg": CRADLEOS_PKG,
        "poll_interval_s": ContractOracle.ORACLE_POLL_INTERVAL,
        "oracle_wallet": "0xe0ab73845a8272d5afbbc7fa0f1461cc1a1f2e0cdc896bb795603cef61ed2757",
        "checks": ["cargo_contracts", "srp_claims"],
    }


@app.get("/system/{ident}")
def get_system(ident: str):
    """Full system profile by name or ID."""
    sys = _resolve_system(ident)
    if not sys:
        raise HTTPException(404, f"System '{ident}' not found")

    sid = sys["solarSystemID"]
    con = db()

    planets = con.execute("""
        SELECT typeName, COUNT(*) as count
        FROM planet_types WHERE solarSystemID=?
        GROUP BY typeName ORDER BY count DESC
    """, (sid,)).fetchall()

    cels = con.execute("""
        SELECT celestialType, COUNT(*) as count
        FROM system_celestials WHERE solarSystemID=?
        GROUP BY celestialType
    """, (sid,)).fetchall()

    gates = con.execute("""
        SELECT j.toSystemID, n.name as toName
        FROM jumps j
        LEFT JOIN systems s ON s.solarSystemID = j.toSystemID
        LEFT JOIN names n ON n.nameID = s.nameID
        WHERE j.fromSystemID = ?
    """, (sid,)).fetchall()

    con.close()
    return {
        **sys,
        "planets": [dict(p) for p in planets],
        "celestials": {r["celestialType"]: r["count"] for r in cels},
        "connections": [{"solarSystemID": g["toSystemID"], "name": g["toName"]} for g in gates],
        "connection_count": len(gates),
    }


@app.get("/route/{origin}/{destination}")
def get_route(
    origin: str,
    destination: str,
    avoid: Optional[str] = Query(None, description="Comma-separated system names/IDs to avoid"),
):
    """Shortest gate route between two systems."""
    src = _resolve_system(origin)
    dst = _resolve_system(destination)
    if not src:
        raise HTTPException(404, f"Origin '{origin}' not found")
    if not dst:
        raise HTTPException(404, f"Destination '{destination}' not found")

    avoid_ids = []
    if avoid:
        for a in avoid.split(","):
            s = _resolve_system(a.strip())
            if s:
                avoid_ids.append(s["solarSystemID"])

    path = _bfs_route(src["solarSystemID"], dst["solarSystemID"], avoid_ids)
    if not path:
        raise HTTPException(200, "No route found — systems may be in different gate clusters")

    con = db()
    named = []
    for sid in path:
        row = con.execute("""
            SELECT s.solarSystemID, n.name, s.securityClass, s.potential
            FROM systems s LEFT JOIN names n ON n.nameID = s.nameID
            WHERE s.solarSystemID = ?
        """, (sid,)).fetchone()
        named.append(dict(row) if row else {"solarSystemID": sid})
    con.close()

    return {
        "from": src["name"],
        "to": dst["name"],
        "jumps": len(path) - 1,
        "path": named,
    }


@app.get("/intel/systems")
def search_systems(
    planet_type: Optional[str] = None,
    security_class: Optional[str] = None,
    region: Optional[str] = None,
    min_potential: Optional[float] = None,
    max_potential: Optional[float] = None,
    min_connections: Optional[int] = None,
    limit: int = 50,
):
    """Filter systems by attributes."""
    con = db()
    clauses = []
    params = []

    if planet_type:
        clauses.append("""s.solarSystemID IN (
            SELECT solarSystemID FROM planet_types WHERE LOWER(typeName) LIKE LOWER(?)
        )""")
        params.append(f"%{planet_type}%")
    if security_class:
        clauses.append("s.securityClass = ?")
        params.append(security_class)
    if region:
        clauses.append("LOWER(rn.name) LIKE LOWER(?)")
        params.append(f"%{region}%")
    if min_potential is not None:
        clauses.append("s.potential >= ?")
        params.append(min_potential)
    if max_potential is not None:
        clauses.append("s.potential <= ?")
        params.append(max_potential)
    if min_connections is not None:
        clauses.append("""(
            SELECT COUNT(*) FROM jumps j WHERE j.fromSystemID = s.solarSystemID
        ) >= ?""")
        params.append(min_connections)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(limit)

    rows = con.execute(f"""
        SELECT s.solarSystemID, n.name, s.securityClass, s.potential,
               rn.name as region,
               (SELECT COUNT(*) FROM jumps j WHERE j.fromSystemID = s.solarSystemID) as connections,
               (SELECT COUNT(*) FROM planet_types pt WHERE pt.solarSystemID = s.solarSystemID) as typed_planets
        FROM systems s
        LEFT JOIN names n  ON n.nameID = s.nameID
        LEFT JOIN regions r ON r.regionID = s.regionID
        LEFT JOIN names rn ON rn.nameID = r.nameID
        {where}
        ORDER BY s.potential DESC
        LIMIT ?
    """, params).fetchall()
    con.close()
    return {"count": len(rows), "systems": [dict(r) for r in rows]}


@app.get("/intel/systems/rich")
def rich_systems(limit: int = 20):
    """Systems with high potential AND multiple planet types — good for industry."""
    con = db()
    rows = con.execute("""
        SELECT s.solarSystemID, n.name, s.securityClass, s.potential,
               rn.name as region,
               COUNT(DISTINCT pt.typeName) as planet_variety,
               COUNT(pt.typeID) as planet_count,
               (SELECT COUNT(*) FROM jumps j WHERE j.fromSystemID = s.solarSystemID) as gates
        FROM systems s
        LEFT JOIN names n  ON n.nameID = s.nameID
        LEFT JOIN regions r ON r.regionID = s.regionID
        LEFT JOIN names rn ON rn.nameID = r.nameID
        LEFT JOIN planet_types pt ON pt.solarSystemID = s.solarSystemID
        GROUP BY s.solarSystemID
        HAVING planet_count > 0
        ORDER BY (s.potential * 0.5 + planet_variety * 0.3 + gates * 0.02) DESC
        LIMIT ?
    """, (limit,)).fetchall()
    con.close()
    return {"count": len(rows), "systems": [dict(r) for r in rows]}


@app.get("/intel/systems/hot")
def hot_systems(limit: int = 20):
    """Gates with most jump activity in the last 1 hour."""
    one_hour_ago_ms = int(time.time() * 1000) - 3_600_000
    con = db()
    rows = con.execute("""
        SELECT source_gate_id,
               COUNT(*) as jump_count,
               MAX(timestamp_ms) as last_seen_ms
        FROM jump_events
        WHERE timestamp_ms >= ?
        GROUP BY source_gate_id
        ORDER BY jump_count DESC
        LIMIT ?
    """, (one_hour_ago_ms, limit)).fetchall()
    con.close()
    return {
        "window": "1h",
        "count": len(rows),
        "hot_gates": [dict(r) for r in rows],
    }


# ── Jump Events endpoints ─────────────────────────────────────────────────────

@app.get("/events/jumps")
def get_jump_events(
    limit: int = Query(50, ge=1, le=500),
    since_ms: int = Query(0, ge=0, description="Filter events with timestamp_ms >= since_ms"),
):
    """Recent gate jump events, optionally filtered by timestamp."""
    con = db()
    if since_ms > 0:
        rows = con.execute(
            """SELECT * FROM jump_events WHERE timestamp_ms >= ?
               ORDER BY timestamp_ms DESC LIMIT ?""",
            (since_ms, limit),
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT * FROM jump_events ORDER BY timestamp_ms DESC LIMIT ?",
            (limit,),
        ).fetchall()
    con.close()
    return {"count": len(rows), "events": [dict(r) for r in rows]}


# ── Config endpoints ──────────────────────────────────────────────────────────

class PackageIdBody(BaseModel):
    package_id: str


@app.get("/config/package-id")
def get_package_id():
    """Return the active world package ID."""
    return {
        "package_id": _active_package_id,
        "source": "env" if os.environ.get("WORLD_PACKAGE_ID") else "default",
    }


@app.post("/config/package-id")
def set_package_id(body: PackageIdBody):
    """Hot-swap the world package ID at runtime (no restart needed)."""
    global _active_package_id
    old = _active_package_id
    _active_package_id = body.package_id
    # Also persist in DB so it survives poller restarts within the process
    _config_set("active_package_id", body.package_id)
    return {
        "ok": True,
        "old_package_id": old,
        "new_package_id": _active_package_id,
    }


# ── Blueprint endpoints ───────────────────────────────────────────────────────

@app.get("/blueprints/search")
def search_blueprints(q: str, limit: int = 20):
    """Search blueprints by product name."""
    con = db()
    rows = con.execute("""
        SELECT b.blueprintTypeID, bt.name as blueprint,
               pp.typeID as productID, pt.name as product,
               pp.quantity, pp.time, b.maxProductionLimit
        FROM blueprints b
        LEFT JOIN types bt ON bt.typeID = b.blueprintTypeID
        LEFT JOIN blueprint_products pp
            ON pp.blueprintTypeID = b.blueprintTypeID AND pp.activity = 'manufacturing'
        LEFT JOIN types pt ON pt.typeID = pp.typeID
        WHERE LOWER(bt.name) LIKE LOWER(?) OR LOWER(pt.name) LIKE LOWER(?)
        LIMIT ?
    """, (f"%{q}%", f"%{q}%", limit)).fetchall()
    con.close()
    return {"count": len(rows), "blueprints": [dict(r) for r in rows]}


@app.get("/blueprints/{blueprint_id}/materials")
def blueprint_materials(blueprint_id: int):
    """Full material chain for a blueprint."""
    con = db()
    bp = con.execute("""
        SELECT b.blueprintTypeID, t.name, b.maxProductionLimit
        FROM blueprints b LEFT JOIN types t ON t.typeID = b.blueprintTypeID
        WHERE b.blueprintTypeID = ?
    """, (blueprint_id,)).fetchone()
    if not bp:
        raise HTTPException(404, f"Blueprint {blueprint_id} not found")

    products = con.execute("""
        SELECT pp.typeID, t.name, pp.quantity, pp.time
        FROM blueprint_products pp LEFT JOIN types t ON t.typeID = pp.typeID
        WHERE pp.blueprintTypeID = ? AND pp.activity = 'manufacturing'
    """, (blueprint_id,)).fetchall()

    materials = con.execute("""
        SELECT bm.typeID, t.name, bm.quantity
        FROM blueprint_materials bm LEFT JOIN types t ON t.typeID = bm.typeID
        WHERE bm.blueprintTypeID = ? AND bm.activity = 'manufacturing'
        ORDER BY bm.quantity DESC
    """, (blueprint_id,)).fetchall()

    con.close()
    return {
        "blueprintTypeID": bp["blueprintTypeID"],
        "name": bp["name"],
        "maxProductionLimit": bp["maxProductionLimit"],
        "products": [dict(p) for p in products],
        "materials": [dict(m) for m in materials],
    }


@app.get("/route/jump-range")
def jump_range(
    origin: str,
    ly: float = Query(6.0, description="Jump range in light-years"),
):
    """Systems reachable via Interstellar Jump Drive from origin."""
    src = _resolve_system(origin)
    if not src:
        raise HTTPException(404, f"System '{origin}' not found")

    sid = src["solarSystemID"]
    con = db()
    orig_pos = con.execute(
        "SELECT cx, cy, cz FROM systems WHERE solarSystemID=?", (sid,)
    ).fetchone()
    if not orig_pos or orig_pos["cx"] is None:
        con.close()
        return {"note": "Position data not available for this system", "systems": []}

    ly_m = ly * 9.461e15
    ox, oy, oz = orig_pos["cx"], orig_pos["cy"], orig_pos["cz"]

    rows = con.execute("""
        SELECT s.solarSystemID, n.name, s.securityClass, s.potential,
               rn.name as region,
               s.cx, s.cy, s.cz,
               (SELECT COUNT(*) FROM jumps j WHERE j.fromSystemID = s.solarSystemID) as gates
        FROM systems s
        LEFT JOIN names n  ON n.nameID = s.nameID
        LEFT JOIN regions r ON r.regionID = s.regionID
        LEFT JOIN names rn ON rn.nameID = r.nameID
        WHERE s.solarSystemID != ? AND s.cx IS NOT NULL
    """, (sid,)).fetchall()
    con.close()

    in_range = []
    for r in rows:
        dx = r["cx"] - ox
        dy = r["cy"] - oy
        dz = r["cz"] - oz
        dist_m = (dx*dx + dy*dy + dz*dz) ** 0.5
        dist_ly = dist_m / 9.461e15
        if dist_ly <= ly:
            d = dict(r)
            d["distance_ly"] = round(dist_ly, 2)
            d.pop("cx"); d.pop("cy"); d.pop("cz")
            in_range.append(d)

    in_range.sort(key=lambda x: x["distance_ly"])
    return {
        "origin": src["name"],
        "jump_range_ly": ly,
        "reachable_count": len(in_range),
        "systems": in_range[:100],
    }


@app.get("/intel/isolated")
def isolated_systems(limit: int = 50):
    """Systems with no stargate connections (jump-drive only access)."""
    con = db()
    rows = con.execute("""
        SELECT s.solarSystemID, n.name, s.securityClass, s.potential, rn.name as region,
               COUNT(pt.typeID) as planet_count
        FROM systems s
        LEFT JOIN names n  ON n.nameID = s.nameID
        LEFT JOIN regions r ON r.regionID = s.regionID
        LEFT JOIN names rn ON rn.nameID = r.nameID
        LEFT JOIN planet_types pt ON pt.solarSystemID = s.solarSystemID
        WHERE s.solarSystemID NOT IN (SELECT DISTINCT fromSystemID FROM jumps)
        GROUP BY s.solarSystemID
        ORDER BY s.potential DESC
        LIMIT ?
    """, (limit,)).fetchall()
    con.close()
    return {"count": len(rows), "systems": [dict(r) for r in rows]}


@app.get("/stats")
def db_stats():
    """DB summary stats."""
    con = db()
    stats = {}
    for table in ["systems", "regions", "constellations", "jumps", "blueprints",
                  "types", "names", "system_celestials", "planet_types",
                  "jump_events", "intel_config"]:
        try:
            row = con.execute(f"SELECT COUNT(*) as c FROM {table}").fetchone()
            stats[table] = row["c"]
        except Exception:
            stats[table] = "missing"
    con.close()
    return stats


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8899, reload=False)
