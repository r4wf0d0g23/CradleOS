# REMOVAL PROPOSAL — UpgradePanel.tsx + upgrade-bytecode.json

**Date:** 2026-07-27
**Origin:** FABLE_AUDIT_2026-07-27.md findings H-2 ("UpgradePanel is a loaded
footgun bundled into production") and C-3 (stale dead-world build artifacts).
**Status:** PROPOSAL ONLY — deleting a shipped component is a product decision.
Nothing has been deleted. **REQUIRES OPERATOR (Raw) sign-off.**

---

## What is proposed for deletion

1. `src/components/UpgradePanel.tsx` (one-shot in-browser package-upgrade panel,
   reachable at URL hash `#upgrade`)
2. `src/upgrade-bytecode.json` (56,971 bytes; prebuilt upgrade payload:
   22 base64 modules + dependency list + digest, built 2026-04-08)
3. The two references in `src/App.tsx` (import + hash route — see "References"
   below)

---

## Evidence (each audit claim re-verified 2026-07-27 against the actual files)

### Claim 1: hardcodes a gate owner whose key is destroyed — VERIFIED

`src/components/UpgradePanel.tsx:11-12`:
```
11:const UPGRADE_CAP = "0xe9710eaa4507ad2004bb9e395ea857447f97146abcc08dcd0fdae45617f3c5dc";
12:const CAP_OWNER = "0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023";
```
The panel gates the SIGN & UPGRADE button on
`account.address === CAP_OWNER` (`isOwner`, :26). `0xc80fe7d6…` is the deploy
wallet whose key was destroyed in the DGX1 reformat (per TOOLS.md /
FABLE_AUDIT C-4's orphaned-lineage list — that wallet's UpgradeCap lineage is
one of the three orphans). **No wallet can ever satisfy the gate.** The panel
can never execute successfully; it is permanently dead UI.

### Claim 2: passes `BYTECODE.dependencies[0]` as `package`, which is MoveStdlib, not a CradleOS package — VERIFIED

`src/components/UpgradePanel.tsx:50`:
```
50:        package: BYTECODE.dependencies[0],
```
Actual contents of `src/upgrade-bytecode.json` `dependencies` (extracted
2026-07-27):
```
['0x0000000000000000000000000000000000000000000000000000000000000001',   # MoveStdlib
 '0x0000000000000000000000000000000000000000000000000000000000000002',   # Sui framework
 '0x920e577e1bf078bad19385aaa82e7332ef92b4973dcf8534797b129f9814d631']   # DEAD world
```
`dependencies[0]` is `0x…0001` = MoveStdlib. The `tx.upgrade({ package: … })`
parameter must be the id of the package being upgraded; passing MoveStdlib is
simply wrong. Even if the destroyed key existed, the tx would target the wrong
package.

### Claim 3: ships a dead-world bytecode payload to every user — VERIFIED

Decoded all 22 base64 modules in `src/upgrade-bytecode.json` and scanned the
concatenated bytecode hex (2026-07-27):
```
contains dead world 920e577e…d631 : True
contains live world 8b8a46ed…      : False
```
The dependency list also names the dead world `0x920e577e…` explicitly (above).
The JSON is imported at module scope (`UpgradePanel.tsx:15: import BYTECODE
from "../upgrade-bytecode.json"`), and UpgradePanel is statically imported by
`App.tsx:33` — so the ~57 KB payload is **bundled into the production JS
served to every user**, and it is exactly the artifact class that static check
S-6 exists to catch (S-6 flags this file today).

### References — where the component is wired (grep across src/, 2026-07-27)

```
$ grep -rn "UpgradePanel\|upgrade-bytecode" src/
src/App.tsx:33:import { UpgradePanel } from "./components/UpgradePanel";
src/App.tsx:1472:      {window.location.hash === "#upgrade" && <UpgradePanel />}
src/components/UpgradePanel.tsx:15:import BYTECODE from "../upgrade-bytecode.json";
```
No other file references either artifact. Removal surface is exactly:
- delete `src/components/UpgradePanel.tsx`
- delete `src/upgrade-bytecode.json`
- remove `App.tsx:33` (import) and the `#upgrade` hash route at `App.tsx:1472`
  (plus its comment line at :1471)

---

## Risk assessment

- **Functionality lost:** none that works. The panel cannot succeed (destroyed
  key gate + wrong `package` arg + dead-world payload). Any future in-place
  upgrade would be executed via `sui client upgrade` per FRESH_DEPLOY_PROTOCOL
  anyway, never via an in-browser signer with a checked-in payload.
- **Bundle size:** −~57 KB pre-gzip from the shipped bundle.
- **Safety:** removes a checked-in bytecode artifact containing the dead world
  id `0x920e577e…` (S-6 violation) and removes the precedent of shipping
  publish/upgrade machinery to end users.
- **Historical value:** the payload is recoverable from git history if ever
  needed; no information is lost by deletion.

## Execution plan (once approved — NOT executed)

```bash
cd frontier/cradleos-dapp
git rm src/components/UpgradePanel.tsx src/upgrade-bytecode.json
# edit src/App.tsx: remove line 33 (import) and lines 1471-1472 (#upgrade route)
npx tsc --noEmit          # must pass
# re-run S-6 (dead-id sweep) — the upgrade-bytecode.json hit must be gone
./deploy-both.sh          # ship via canonical path
```

**Decision needed from Raw:** approve deletion (recommended), or keep with an
explicit justification recorded here.
