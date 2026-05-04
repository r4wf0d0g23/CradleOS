# CradleOS v13 — Friendly Fire Fix

**Released:** 2026-05-04
**Live at:** https://r4wf0d0g23.github.io/CradleOS/
**Package:** `0x443e4730c58b29096b5289ad700740e08e4925f5d0486ec07a0c645ef75617d6`

---

## TL;DR

Tribe turrets stopped shooting friendlies. The "Player Relations" panel never worked — turrets ignored it. v13 replaces it with **Friendly Characters**, which actually does what it says.

If you previously marked anyone as friendly and they still got shot — that's why. Re-add them in the new panel and they'll be safe.

---

## What Was Broken (v12 and earlier)

The Defense panel had a **Player Relations** section where you could add a wallet address and toggle them FRIENDLY or HOSTILE. It looked like it worked — the transaction succeeded, the entry appeared in the list, the on-chain state updated.

**It did absolutely nothing.**

Tribe turrets only see in-game character IDs, not wallet addresses. The Player Relations data was stored on chain but the targeting code never read it. Tribemates you marked FRIENDLY got shot anyway.

The only thing actually preventing tribe friendly-fire in v12 was an automatic "same-tribe protection" rule. If that wasn't catching someone (e.g. the turret had no CradleOS extension authorized, or the tribemate's on-chain Character had a different tribe id than yours), nothing else helped.

---

## What's Fixed (v13)

### 1. Friendly Characters panel (the real fix)

The Defense panel now has a green **"Friendly Characters (Cross-Tribe Override)"** section. You enter an in-game **character ID** (a number, not a wallet) and turrets will skip that character regardless of their tribe.

This is the inverse of the existing Hostile Characters panel. Same UX, opposite effect.

### 2. Legacy Player Relations is read-only with a warning

If you previously added entries in the old Player Relations panel, they're still visible in a yellow **"⚠ Legacy Player Relations (display only)"** section. Each entry is tagged `(unenforced)` with a clear migration note. Founders can clear them out as cleanup.

This section is hidden entirely if you have no legacy entries.

### 3. Reassign Turret Configs widget

A new blue **"↻ Reassign Turret Configs (v13 migration)"** section appears in the Defense panel **only if you own turret configs**. It auto-discovers all TurretConfigs you've created and lets you bulk-retarget them at any policy id in a single signed transaction.

Most tribes won't need this — your existing turrets keep working without intervention because they reference the policy by object id (which doesn't change on upgrade). It's there for cleanup if you ever recreated your policy or want to consolidate stale references.

### 4. Bug fix: removed legacy entries actually disappear now

When you removed a Player Relations entry in v12, the contract didn't emit a removal event so the dApp never noticed it was gone. v13 emits `PlayerRelationRemoved` properly. Legacy entries you remove will actually vanish from the UI.

---

## How to Use Friendly Characters (Tribe Founders)

### One-time setup per friend

1. **Get the character ID.** This is the in-game character ID number, NOT a wallet address. You can find it on the player's CradleOS profile page or by clicking their character on the map.
2. **Open the Defense panel** in CradleOS.
3. Scroll to the green **"Friendly Characters (Cross-Tribe Override)"** section.
4. Type the character ID in the input field.
5. Click **"+ Add Friendly"**.
6. Confirm the wallet transaction.

The character is now safe from your tribe's turrets. Effective on the next behavior change (typically within seconds when they enter turret range).

### Removing a friendly entry

Click the **"Remove"** button next to the character row. Sign the transaction. They're back to default behavior (which means same-tribe protection still applies if they're in your tribe; otherwise turrets treat them like anyone else).

### Migrating from Legacy Player Relations

If you have entries in the yellow **"⚠ Legacy Player Relations"** section:

1. For each entry that should stay friendly, look up that wallet's in-game character ID.
2. Add the character ID to **Friendly Characters** (steps above).
3. Click **"Remove"** on the legacy wallet entry. Sign.

You're done. Same effect, but now actually enforced.

---

## How Friendly/Hostile Logic Now Works

When a turret considers a target, it checks in this order:

1. **Same tribe?** → Skip, unless that character is on your **Hostile Characters** list (KOS override).
2. **On the Friendly Characters list?** → Skip. ← **NEW in v13**
3. **Their tribe is on your Friendly Tribes list?** → Skip.
4. **Out-of-class ship?** → Skip (autocannon won't waste shots on a cruiser, etc).
5. **Security level / aggression mode says skip non-aggressors?** → Skip if not flagged as aggressor.
6. **Otherwise** → Engage.

So:
- Same-tribe member: protected automatically. Add to Hostile Characters to override.
- Cross-tribe ally: add to **Friendly Characters** by character ID.
- Whole allied tribe: add to **Tribe Relations** as Friendly.

---

## Do I Need to Reassign My Turrets?

**Probably not.** Your existing TurretConfigs reference your TribeDefensePolicy by object id, which is unchanged across the v13 upgrade. The fix activates immediately on existing on-chain state.

You only need the Reassign Turrets widget if:
- You recreated your TribeDefensePolicy at some point and your turrets still point at the old (deleted) policy
- You want to consolidate multiple turret configs onto a single canonical policy
- A specific turret stopped reading from any policy and you need to re-link it

If the widget shows turret configs marked **`⚠ stale`**, those are pointing at a policy id that doesn't match your active tribe policy. Click "Select stale" → "Retarget X configs on-chain" to fix them all at once.

---

## Nothing Else Changes

- All your existing tribe relations carry over.
- All your existing hostile characters carry over.
- Security level (GREEN/YELLOW/RED) and aggression mode settings carry over.
- Aircraft ship-class targeting presets carry over.
- TribeVault, treasury, gates, recruiting, lore wiki, all other CradleOS state — completely unchanged.

This is a focused bug fix release. The only behavior change is "Friendly toggles now actually do something."

---

## Reporting Issues

If turrets are still firing on someone you've added as a Friendly Character:

1. Confirm the character ID is correct (numeric, in-game character id, not wallet).
2. Confirm the Friendly Characters panel shows them with the green FRIENDLY badge after the transaction confirmed.
3. Confirm your turret has a TurretConfig pointing at your policy (visible in the Reassign Turret Configs widget — it should show your policy id, not a stale one).
4. If all three check out and they're still being shot, that's a real bug — report it with the turret object id, your vault id, and the affected character id.

---

## Technical Notes (for tribe leaders who want to know)

- **On-chain primitive:** `FriendlyCharacterKey<u32>` dynamic field on `TribeDefensePolicy`, mirrors the existing `HostileCharacterKey<u32>` pattern.
- **Enforcement:** new branch in `turret_ext::get_target_priority_list` after same-tribe protection, before tribe-FRIENDLY check. Reads `defense_policy::is_friendly_character`.
- **Why character_id and not wallet:** the `TargetCandidate` struct passed by the world contract to turret extensions exposes `character_id: u32` and `character_tribe: u32` but NOT owner wallet address. Wallet-keyed lookups are structurally impossible for turret targeting.
- **Why this wasn't caught earlier:** the dApp wrote to chain successfully, the data appeared in the UI, the events emitted. Everything looked correct except the targeting kernel never consulted that data path. Classic "tested write, didn't test read" gap.

---

## Credit

Reported by **Xcelon** (REAP) on 2026-05-04: tribemate set to FRIENDLY in policy was still being shot by tribe turrets. Diagnosis traced through the contract → UI → enforcement path showed Player Relations was decorative. Fix designed and shipped same-day.
