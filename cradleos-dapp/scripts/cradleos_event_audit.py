#!/usr/bin/env python3
"""Audit CradleOS event-type queries: find the defining package for every
event struct used in the dApp, and verify it's in CRADLEOS_EVENT_PKGS."""
import json
import urllib.request
import sys

RPC = "https://fullnode.testnet.sui.io:443"

# Known CradleOS package ids across all upgrade history (and earlier
# clean-slate lineages). Anything that defines a struct must be in this list.
KNOWN_CRADLEOS_PKGS = [
    # Live-chain UpgradeCap lineage (most recent first)
    ("v14", "0xb6be32f915bb8ffead4a721207d9e43d2bedc7a60acdb08af60af84e1915ba93"),
    ("v13", "0x443e4730c58b29096b5289ad700740e08e4925f5d0486ec07a0c645ef75617d6"),
    ("v12", "0xa9c899be21e47d30882cb5da021780ccc35421e9181518ae8161b09f7c92b11f"),
    ("v11_orphan", "0xe468d971c0705da10c8a8a7849c36adc4e64e6de2592326b50d1888a298312e1"),
    ("v10", "0x756cfe9bbb446f014434926169b5a83b8aab02882aa92ab30dda6e692d86fd66"),
    ("v9",  "0x955d7ffb4c0bf6abc4caea3041f982ae7e9b21eb4b9c1ea500bb404609faf0ce"),
    ("v5",  "0x38115c0620f5f885529e932c1369cbe10305c9f2de504a6f203ce831941439c4"),
    ("v4_upgrade_origin", "0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d"),
    ("v1_original", "0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3"),
]

# Currently in CRADLEOS_EVENT_PKGS (after v14 deploy)
CURRENT_LIST = {"0xb6be32f9...", "0x443e4730...", "0xbf4249b1...", "0x38115c06...", "0x70d0797b..."}

# Every event struct queried by the dApp. Format: (module, struct).
EVENTS_QUERIED = [
    ("announcement_board", "AnnouncementPosted"),
    ("announcement_board", "BoardCreated"),
    ("cargo_contract",    "ContractCreated"),
    ("collateral_vault",  "CollateralVaultCreated"),
    ("defense_policy",    "PolicyCreated"),
    ("defense_policy",    "PassageLogged"),
    ("defense_policy",    "PlayerRelationSet"),
    ("defense_policy",    "PlayerRelationRemoved"),
    ("defense_policy",    "HostileCharacterSet"),
    ("defense_policy",    "FriendlyCharacterSet"),
    ("gate_policy",       "GatePolicyCreated"),
    ("gate_profile",      "GateProfileCreated"),
    ("inheritance",       "WillCreated"),
    ("inheritance",       "WillRevoked"),
    ("keeper_shrine",     "OfferingMade"),
    ("lore_wiki",         "ArticlePublished"),
    ("lore_wiki",         "ArticleDeleted"),
    ("recruiting_terminal","TerminalCreated"),
    ("recruiting_terminal","ApplicationSubmitted"),
    ("treasury",          "TreasuryCreated"),
    ("treasury",          "DepositRecord"),
    ("treasury",          "WithdrawRecord"),
    ("tribe_dex",         "OrderFilled"),
    ("tribe_dex",         "DexCreated"),
    ("tribe_roles",       "TribeRolesCreated"),
    ("tribe_roles",       "RoleGranted"),
    ("tribe_roles",       "RoleRevoked"),
    ("tribe_vault",       "CoinIssued"),
    ("tribe_vault",       "CoinLaunched"),
    ("tribe_vault",       "CoinBurned"),
    ("tribe_vault",       "InfraRegistered"),
    ("tribe_vault",       "InfraDeregistered"),
    ("trustless_bounty",  "BountyPosted"),
    ("turret_ext",        "ConfigCreated"),
    # v14 gate events
    ("gate_policy",       "GateFriendlyCharacterSet"),
    ("gate_policy",       "GateHostileCharacterSet"),
    ("gate_policy",       "GatePermitIssued"),
]

def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

# Cache: pkg_id -> {module: set_of_structs}
module_cache = {}
def get_module_structs(pkg, module):
    key = (pkg, module)
    if key in module_cache: return module_cache[key]
    try:
        res = rpc("sui_getNormalizedMoveModule", [pkg, module])
        if res.get("error"): module_cache[key] = None; return None
        r = res.get("result")
        if not r: module_cache[key] = None; return None
        module_cache[key] = set(r.get("structs", {}).keys())
        return module_cache[key]
    except Exception as e:
        module_cache[key] = None
        return None

print("CradleOS event-type defining-package audit")
print("=" * 72)

# For each event struct, find every package that defines it; the EARLIEST
# (oldest tx) is the canonical type address. We approximate "earliest" as the
# oldest entry in KNOWN_CRADLEOS_PKGS that has the struct. Since the live
# UpgradeCap chain ALSO covers the v9/v10/v11 entries that share the same
# original-id, the earliest matching package in the live chain is the answer.
results = []
for module, struct in EVENTS_QUERIED:
    defining = []
    for label, pkg in reversed(KNOWN_CRADLEOS_PKGS):  # oldest first
        structs = get_module_structs(pkg, module)
        if structs is None:
            continue  # module doesn't exist at this pkg version
        if struct in structs:
            defining.append((label, pkg))
            break  # earliest hit = canonical type address
    if not defining:
        results.append((module, struct, "MISSING", None))
    else:
        label, pkg = defining[0]
        in_list = pkg[:10] + "..." in CURRENT_LIST
        results.append((module, struct, label, pkg, in_list))

# Print table
print(f"{'module::struct':50s}  {'defining pkg':18s}  {'status'}")
print("-" * 72)
missing_pkgs = set()
unknown = []
for r in results:
    if r[2] == "MISSING":
        unknown.append(r)
        print(f"{r[0]+'::'+r[1]:50s}  ??? unknown defining package")
        continue
    module, struct, label, pkg, in_list = r
    short = pkg[:10] + "..."
    flag = "OK" if in_list else "*** MISSING FROM LIST ***"
    print(f"{module+'::'+struct:50s}  {label:8s} {short}  {flag}")
    if not in_list:
        missing_pkgs.add(pkg)

print()
print("=" * 72)
if missing_pkgs:
    print("Packages to ADD to CRADLEOS_EVENT_PKGS:")
    for pkg in sorted(missing_pkgs):
        print(f"  {pkg}")
else:
    print("All defining packages already present in CRADLEOS_EVENT_PKGS.")

if unknown:
    print()
    print("Events with NO defining package found in any known CradleOS pkg:")
    for r in unknown:
        print(f"  {r[0]}::{r[1]}  (struct may have been removed, or pkg id list is incomplete)")
