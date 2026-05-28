# Wipe Day Republish Runbook — Stillness Reset June 25, 2026

**Purpose:** On 2026-06-25, the EVE Frontier Stillness world package is wiped
and republished. Every CradleOS object minted before then becomes orphaned.
This runbook captures the exact sequence to republish the entire CradleOS
lineage clean against the new Stillness world, with `cradleos_voting` as the
first extension to land on the fresh chain.

**Author:** Captain (Reality Anchor)
**Last updated:** 2026-05-28 (pre-publish state of voting package)
**Status:** dry-run only — actual run is 2026-06-25

---

## 0. Wipe-day prerequisites (do FIRST, before any publish)

1. **Confirm new Stillness world package id.** CCP publishes this on the
   Frontier Discord `#announcements` channel and updates
   `https://docs.evefrontier.com/tools/resources`. Both should match. If they
   diverge, follow Discord — docs lag.

2. **Pull the new world Move package.** From the
   `frontier/world-contracts` upstream repo (or whatever CCP-blessed source
   is current). Verify `Published.toml` `[published.testnet_stillness]`
   `published-at` matches the announced id.

3. **Switch DGX env to testnet_stillness.** All publishes happen from DGX
   (`ssh rawdata@100.78.161.126`) because Jetson glibc is too old for the
   Sui CLI.

   ```bash
   ssh rawdata@100.78.161.126
   sui client switch --env testnet_stillness
   sui client active-env  # must print testnet_stillness
   ```

4. **Check deploy wallet gas.** Address
   `0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023`.
   Need ~3 SUI minimum to cover republish chain (cradleos + voting + any
   other extensions). Hit faucet repeatedly if rate-limited:

   ```bash
   curl -X POST https://faucet.testnet.sui.io/v1/gas \
     -H "Content-Type: application/json" \
     -d '{"FixedAmountRequest":{"recipient":"0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023"}}'
   ```

---

## 1. Republish `cradleos` (base package)

This is the trunk. Voting and every other extension depends on it.

**⚠️ CRITICAL findings from the 2026-05-28 failed publish attempt:**

1. **The current production `CRADLEOS_PKG` v14 (`0xb6be32f9...`) is internally linked to the LEGACY testnet world (`0x920e577e...` -> `0x33226d2e...`), NOT to Stillness world.** This was discovered by inspecting v14's linkage table via `sui_tryGetPastObject` with `showBcs=true`. Wipe-day must do a fresh-publish that links cradleos to the NEW Stillness world package (whatever id CCP publishes), not just an upgrade.

2. **Workspace `cradleos/sources/*.move` has drifted from the on-chain v14 bytecode.** A direct publish of voting against on-chain v14 hit `VMVerificationOrDeserializationError` because workspace symbols (TribeVault, TribeRoles, etc.) have signature drift from what's deployed. Wipe-day MUST republish cradleos fresh from workspace source, not try to point voting at the old v14.

3. **The `Published.toml` multi-env pattern is mandatory.** Workspace `cradleos/Published.toml` only had `[published.testnet]` and was stale at v12. Add `[published.testnet_stillness]` and `[published.testnet_utopia]` entries on fresh publish so future builds resolve correctly per env.

**Pre-publish prep (do BEFORE `sui client publish`):**

```bash
# 1. Make sure the new Stillness world package id is in world-contracts/Published.toml [published.testnet_stillness]
# 2. Migrate cradleos/Move.toml to multi-env style: remove the single `published-at` field,
#    let Published.toml handle per-env resolution. Add [environments] block:
#    [environments]
#    testnet_stillness = "4c78adac"
#    testnet_utopia = "4c78adac"
# 3. CLEAR Published.toml — fresh publish writes a new entry. Old [published.testnet] is stale and misleading.
```

**Publish command:**

```bash
ssh rawdata@100.78.161.126
sui client switch --env testnet_stillness  # CRITICAL
~/.local/bin/sui client active-env          # verify
cd ~/cradleos
~/.local/bin/sui client publish --gas-budget 500000000 --skip-dependency-verification
```

Capture from output:
- `published-at` (new `CRADLEOS_PKG`)
- `original-id` (new `CRADLEOS_ORIGINAL`)
- `UpgradeCap` object id (custody to deploy wallet)
- `CharacterRegistry` shared object id (created by `init` fun)

**Verify linkage immediately after publish:**
```bash
# Confirm the new cradleos links to NEW Stillness world, not legacy testnet world
curl -s -X POST https://fullnode.testnet.sui.io:443 -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"sui_tryGetPastObject\",\"params\":[\"<new_cradleos_pkg>\",1,{\"showBcs\":true}]}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d['result']['details']['bcs']['linkageTable'],indent=2))"
# Expected: world entry should map to NEW Stillness world's original-id -> upgraded-id.
# If it links to legacy testnet world (0x920e577e), the publish env was wrong; abort and redo.

---

## 2. Republish `cradleos_voting`

```bash
cd ~/cradleos_voting   # rsync from workspace if needed
~/.local/bin/sui client publish --gas-budget 500000000 --skip-dependency-verification
```

Capture from output:
- `published-at` (new `CRADLEOS_VOTING_PKG`)
- `AdminCap` object id — **MUST be owned by deploy wallet, do not transfer**
- Any module-init shared objects (none expected at v1)

---

## 3. Bootstrap `ExtensionRegistry` singleton

The voting package follows the Move Book Capability pattern — there is no
`init` fun creating the registry. It must be created in a separate tx using
the AdminCap.

```bash
~/.local/bin/sui client call \
  --package <new_CRADLEOS_VOTING_PKG> \
  --module extension \
  --function create_registry \
  --args <AdminCap_object_id> \
  --gas-budget 50000000
```

Capture from output:
- The new shared `ExtensionRegistry` object id (the `Created` object with
  `Shared` owner) → this becomes `CRADLEOS_VOTING_REGISTRY`.

---

## 4. Update dApp constants

Edit `frontier/cradleos-dapp/src/constants.ts`:

```ts
export const CRADLEOS_PKG               = "0x<new>";
export const CRADLEOS_ORIGINAL          = "0x<new>";
export const CRADLEOS_UPGRADE_ORIGIN    = "0x<new>";  // = CRADLEOS_PKG on fresh publish
export const CRADLEOS_EVENT_PKGS = [CRADLEOS_PKG] as const;

export const CRADLEOS_VOTING_PKG        = "0x<new>";
export const CRADLEOS_VOTING_REGISTRY   = "0x<new>";
export const CRADLEOS_VOTING_EVENT_PKGS = [CRADLEOS_VOTING_PKG] as const;
export const CRADLEOS_VOTING_PREVIEW    = false;   // <-- drop the banner
```

Also wipe the legacy upgrade-pkg list at lines 159-163 — that lineage is
dead. Keep it commented out for one release in case we need to inspect
pre-wipe events for postmortem.

---

## 5. Build + deploy dApp

```bash
cd frontier/cradleos-dapp
VITE_BASE="/CradleOS/" npm run build
```

Then follow `DEPLOY.md` — push `dist/` to the `gh-pages` branch of the
`r4wf0d0g23/CradleOS` repo. Verify branch protection is off or be ready to
toggle it (see TOOLS.md "CradleOS dApp Deploy Preflight — Branch Protection").

Verify live bundle hash after `gh-pages` settles:

```bash
curl -s https://r4wf0d0g23.github.io/CradleOS/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
```

Should match the just-built bundle hash in `dist/index.html`.

---

## 6. Verification pass

1. Open dApp, connect Slush. Confirm:
   - Preview banner is GONE on Voting panel.
   - "Active elections" empty list (no `ElectionCreated` events on fresh chain).
   - "+ Create election" wizard opens, all 4 steps render.

2. Create a smoke-test election with the deploy wallet. Confirm:
   - Election object appears in `My elections`.
   - Suiscan renders the election via the Display registration (clean
     metadata, not raw hex).

3. Cast a vote. Confirm Hot Potato proof flow works end-to-end (eligibility
   proof minted → consumed → ballot recorded → proof destroyed in same tx).

4. Update `memory/projects/cradleos.md` with the new package ids and a
   "post-wipe republish complete YYYY-MM-DD" entry.

---

## 7. Post-wipe MEMORY.md cleanup

Strike these from MEMORY.md (they all reference dead objects):

- `CRADLEOS_PKG` v14 = `0xb6be32f9...`
- `CRADLEOS_ORIGINAL` = `0x70d0797b...`
- `CRADLEOS_UPGRADE_ORIGIN` v4 = `0xbf4249b1...`
- All upgrade-origin lineage in `CRADLEOS_EVENT_PKGS`
- TrustlessBountyBoard, KeeperShrine, Reapers collateral vault — all dead
- SSU_ACCESS package + registry + policy ids — dead
- Stillness world pkg `0x28b497559d...` — dead

Replace with the new lineage. Keep the old ids in a "Pre-wipe archive"
section at the bottom of MEMORY.md for historical reference and so I don't
phantom-debug objects that no longer exist.

---

## Known unknowns

- **Will CCP also rotate `EVE_COIN_TYPE`?** Currently
  `0x2a66a89b...::EVE::EVE`. If they republish the EVE coin module, every
  treasury balance check breaks. Re-verify on wipe day.
- **Sui testnet chain-id.** Currently `4c78adac`. CCP wipes the *world
  package*, not the underlying Sui testnet. Chain-id should not change.
  If it does (red flag), the whole approach changes — pause and ask Raw.
- **EVE Vault wallet behavior.** zkLogin sessions may persist across wipe.
  Test in-game OAuth re-flow before assuming Raw's mobile vault still works.
- **Existing CradleOS on-chain state at wipe day** (added 2026-05-28). All
  TribeVaults, FriendlyCharacterSets, HostileCharacterSets, Treasury balances,
  bounty boards, SSU policies, etc. minted under the legacy `CRADLEOS_PKG` v14
  chain become unreachable through the new package's lib helpers. **CRITICAL:
  if any SSU contains items in shared/ethereal inventory namespace, those items
  remain on-chain but USERS LOSE ALL UI ACCESS** — the game client doesn't
  render ethereal-space items, and our new package can't read state from old
  package id. Items effectively limbo. Standing rule: **announce wipe-day
  reset BEFORE wipe day** to give users a chance to retrieve items from
  shared SSUs back to personal storage. Treat this as a pre-wipe user comms
  obligation, not just a technical step.

---

## Time budget

If everything goes smoothly: **45 minutes end-to-end**, of which 30 is
build/deploy plumbing and 15 is smoke testing.

If something breaks (dependency mismatch, faucet rate-limit, branch
protection issue): up to 2 hours. Apply the AGENTS.md Debug Time-Boxing
SOP — 2 hours then escalate to Raw with a decision request.
