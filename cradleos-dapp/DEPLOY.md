# CradleOS dApp — Deployment Standard Operating Procedure

**Last updated:** 2026-03-25
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

### Step 2: Build for gh-pages
```bash
VITE_BASE="/CradleOS/" npx vite build --outDir dist-ghpages
```

### Step 3: Push to both repos
```bash
git push cradleos main
git push hackathon main
```

### Step 4: Deploy gh-pages
```bash
npx gh-pages -d dist-ghpages -r git@github.com:r4wf0d0g23/CradleOS.git
```

### Step 5: Post-deploy verification
- Hard refresh the live site
- Check browser console for RPC errors
- Verify vault detection works (connect wallet → tribe tab shows vault, not launch form)

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
| v2 (current) | published-at: `0x2e51c867e32537f4b04b53e8efefde559d3b9be3ca430e39957de536173d32b0` | ✅ ACTIVE | Reapers_v2, 2026-03-25 |
| v2 (current) | original-id: `0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3` | ✅ ACTIVE | Used for events/types |
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
