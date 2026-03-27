# CradleOS dApp — Deployment Standard Operating Procedure

**Last updated:** 2026-03-27
**Maintainer:** Reality Anchor

---

## Pre-Flight Checklist (MANDATORY before every deploy)

### 1. Verify Package ID Is Current

```bash
# Read the CANONICAL source of truth — the Move project's Published.toml
cat ../cradleos/Published.toml
```

Compare against `src/constants.ts`:
- `CRADLEOS_PKG` must match `published-at` from Published.toml
- `CRADLEOS_ORIGINAL` must match `original-id` from Published.toml

**If they don't match → STOP. Fix constants.ts FIRST.**

Sui package ID rules:
| Use case | Which ID | Constant |
|---|---|---|
| `moveCall` targets | published-at | `CRADLEOS_PKG` |
| `MoveEventType` queries | original-id | `CRADLEOS_ORIGINAL` |
| `StructType` filters | original-id | `CRADLEOS_ORIGINAL` |
| Dynamic field `type` keys | original-id | `CRADLEOS_ORIGINAL` |

### 2. Verify No Stale/Archived IDs Leaked Back

```bash
# Search for any OLD package IDs that should NOT appear:
grep -rn "0x97c4350f\|0x7541ac23" src/
# Expected output: ZERO matches (or only inside comments marked ARCHIVED)
```

If matches found → STOP. Fix them.

### 2b. Verify Event Queries Use ORIGINAL (not PKG)

```bash
# Every MoveEventType and StructType filter MUST use CRADLEOS_ORIGINAL.
# CRADLEOS_PKG is ONLY for moveCall targets.
# This catches the #1 recurring bug after package upgrades.

# Find any event/struct queries using the WRONG package ID:
grep -rn "MoveEventType.*CRADLEOS_PKG\|StructType.*CRADLEOS_PKG" src/
# Expected: ZERO matches

# Sanity check — all event queries should reference ORIGINAL:
grep -rn "MoveEventType.*CRADLEOS_ORIGINAL" src/ | wc -l
# Expected: non-zero (confirms events are being queried)
```

**Why this matters:** Sui indexes events and struct types by `original-id` (immutable,
set at first publish). `published-at` changes on every `sui client upgrade`. If an event
query uses `published-at`, it silently returns zero results — the feature looks "not
initialized" but is actually just invisible.

**Rule of thumb:**
| Operation | Which ID | Constant |
|---|---|---|
| `moveCall` target | published-at | `CRADLEOS_PKG` |
| `MoveEventType` query | original-id | `CRADLEOS_ORIGINAL` |
| `StructType` filter | original-id | `CRADLEOS_ORIGINAL` |
| Dynamic field type key | original-id | `CRADLEOS_ORIGINAL` |

If you add a new event query or struct filter anywhere in the codebase, use the
`eventType()` helper from `constants.ts` or reference `CRADLEOS_ORIGINAL` directly.
**Never use `CRADLEOS_PKG` for reads — only for writes.**

### 3. Verify On-Chain Events Resolve

```bash
# Quick smoke test — CoinLaunched events should return data
curl -s https://fullnode.testnet.sui.io:443 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"suix_queryEvents",
       "params":[{"MoveEventType":"<CRADLEOS_ORIGINAL>::tribe_vault::CoinLaunched"},null,1,true]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['data']), 'events')"
# Expected: >= 1 events
```

### 4. TypeScript Compiles Clean

```bash
cd /home/agent-raw/.openclaw/workspace/frontier/cradleos-dapp
npx tsc --noEmit
# Expected: exit code 0, no errors
```

### 5. Git State Is Clean

```bash
git status --short
# Review ALL changed files. Understand every diff.
git diff --stat HEAD
```

---

## Deploy Procedure

### Step 1: Commit
```bash
git add -A
git commit -m "feat/fix: <description>"
```

### Step 2: Push source to both repos
```bash
git push cradleos main          # CradleOS repo — main branch
git push hackathon main:main    # Hackathon repo — main branch (NOT master!)
```

### Step 3: Build for CradleOS (Stillness)
```bash
VITE_BASE="/CradleOS/" npx vite build --outDir dist-ghpages
```

### Step 4: Deploy CradleOS gh-pages
```bash
rm -rf node_modules/.cache/gh-pages
npx gh-pages -d dist-ghpages -r git@github.com:r4wf0d0g23/CradleOS.git -b gh-pages
```

### Step 5: Build for Hackathon (Utopia)
```bash
VITE_BASE="/Reality_Anchor_Eve_Frontier_Hackathon_2026/" npx vite build --outDir dist-hackathon
```

### Step 6: Deploy Hackathon gh-pages
```bash
rm -rf node_modules/.cache/gh-pages
npx gh-pages -d dist-hackathon -r git@github.com:r4wf0d0g23/Reality_Anchor_Eve_Frontier_Hackathon_2026.git -b gh-pages
```

### Step 7: Post-deploy verification
- Hard refresh BOTH live sites
- Check browser console for RPC errors
- Verify vault detection works (connect wallet → tribe tab shows vault, not launch form)

---

## Repository Map

| Repo | Default Branch | gh-pages | VITE_BASE | Live URL |
|---|---|---|---|---|
| `r4wf0d0g23/CradleOS` | `main` | `gh-pages` | `/CradleOS/` | `r4wf0d0g23.github.io/CradleOS/` |
| `r4wf0d0g23/Reality_Anchor_Eve_Frontier_Hackathon_2026` | `main` | `gh-pages` | `/Reality_Anchor_Eve_Frontier_Hackathon_2026/` | `r4wf0d0g23.github.io/Reality_Anchor_Eve_Frontier_Hackathon_2026/` |

**⚠️ Branch rules:**
- Both repos use `main` as the default branch. There is NO `master` branch.
- Always push `main:main`. Never push to `master` — it will create a ghost branch judges can't see.
- Always clear `node_modules/.cache/gh-pages` before each `npx gh-pages` deploy (prevents stale pushes or branch mismatch errors).
- The CradleOS repo `main` has a **different monorepo structure** (flat root with dist + submodules). Do NOT force-push the local working tree to it — only use `npx gh-pages` for dist deploys. Source pushes go to the hackathon repo.

**⚠️ Two builds required:**
- CradleOS build uses `VITE_BASE="/CradleOS/"` → `dist-ghpages/`
- Hackathon build uses `VITE_BASE="/Reality_Anchor_Eve_Frontier_Hackathon_2026/"` → `dist-hackathon/`
- These are DIFFERENT base paths. Using the wrong one breaks all asset loading.

---

## Rebase / Pull Safety

**DANGER ZONE:** `git pull --rebase` or `git rebase` can silently revert fixes when:
- A remote commit has old values
- Your local fix touches nearby (but not identical) lines
- Git auto-resolves without conflict → your fix disappears

**After any rebase:**
1. Re-run the package ID verification (step 1 above)
2. Search for archived IDs (step 2 above)
3. Diff against pre-rebase to confirm critical values survived

---

## Package ID History (Archive)

| Version | ID | Status | Notes |
|---|---|---|---|
| v5 (current) | published-at: `0x38115c0620f5f885529e932c1369cbe10305c9f2de504a6f203ce831941439c4` | ✅ ACTIVE | Turret ext + hostile chars, 2026-03-26 |
| v5 (current) | original-id: `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3` | ✅ ACTIVE | Used for events/types (never changes) |
| v4 (retired) | `0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d` | ❌ ARCHIVED | Trustless bounty + collateral, 2026-03-25 |
| v3 (retired) | `0x2e51c867e32537f4b04b53e8efefde559d3b9be3ca430e39957de536173d32b0` | ❌ ARCHIVED | Reapers_v2, 2026-03-25 |
| v1 (retired) | `0x97c4350fc23fbb18de9fad6ef9de6290c98c4f4e57958325ffa0a16a21b759b4` | ❌ ARCHIVED | Clean-slate 2026-03-24 |
| pre-v1 (retired) | `0x7541ac23fb681e4ea2cb54c0693a0c618c2ab24e69217cf4d0436adcc62ee715` | ❌ ARCHIVED | Legacy, no vaults |

**When upgrading the Move package:**
1. Run `sui client upgrade` 
2. Update `Published.toml` (automatic)
3. Update `CRADLEOS_PKG` in `src/constants.ts` to new `published-at`
4. `CRADLEOS_ORIGINAL` stays the same (it never changes after initial publish)
5. Move the old `published-at` to the archive table above
6. Run full pre-flight checklist
7. Deploy

---

## Recovery

If a bad deploy goes out:
1. `git log --oneline -10` — find last known good commit
2. `git diff <good-commit> -- src/constants.ts` — see what changed
3. Fix constants.ts
4. Re-run full pre-flight
5. Rebuild + redeploy

---

## Lessons Learned

- **2026-03-25:** Deployed 3 times with wrong package ID because:
  - Rebase silently reverted the PKG from v2 back to v1
  - No pre-flight check existed to catch it
  - Mixed up `original-id` vs `published-at` (Sui uses both for different purposes)
  - No documented procedure → relied on memory → memory was wrong

- **2026-03-26:** Deployed 3 times to wrong branch (`-b main` instead of `-b gh-pages`):
  - `npx gh-pages` reports "Published" even when pushing to a non-Pages branch
  - Always verify the Pages config branch matches the `-b` flag (or omit `-b` to use default `gh-pages`)
  - "Published" from `npx gh-pages` only means git push succeeded — NOT that GitHub Pages deployed

- **2026-03-27:** Full QA session pushed source to `master` while GitHub default was `main`:
  - Hackathon repo had both `main` and `master` — all pushes went to `master` (invisible to visitors)
  - Fix: synced `master` → `main`, deleted `master` branch entirely
  - Rule: always check `default_branch` via GitHub API before first push to a repo
  - Rule: if `main` and `master` both exist, delete whichever is NOT the default

- **2026-03-27:** Collateral vault + bounty panel showed "not initialized" after v5 upgrade:
  - Both used `CRADLEOS_PKG` for event queries instead of `CRADLEOS_ORIGINAL`
  - Worked before upgrade because PKG == ORIGINAL on first publish; broke silently on upgrade
  - **This is the most dangerous Sui bug pattern** — it fails silently (zero results, no error)
  - Added pre-flight step 2b to catch this automatically before every deploy
  - Rule: `CRADLEOS_PKG` = writes (moveCall), `CRADLEOS_ORIGINAL` = reads (events, types, filters)

- **2026-03-27:** gh-pages cache caused stale deploys when switching between repos:
  - `node_modules/.cache/gh-pages` retains state from previous deploy target
  - Fix: `rm -rf node_modules/.cache/gh-pages` before EVERY `npx gh-pages` call
  - This is now mandatory in the deploy steps above
