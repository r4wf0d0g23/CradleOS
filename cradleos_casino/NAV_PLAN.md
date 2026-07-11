# CradleOS Casino — Navigation Redesign (scales to 100+ games)

**Status:** PLAN (2026-07-11) — required before the catalog crosses ~25 games.
**Problem:** the current casino UI is a single flat row of game tabs (19 buttons, wrapping). At 100+ games a flat tab bar is unusable — players can't scan, discover, or find favorites.

## Target IA (information architecture)

### 1. Casino Lobby (new landing view)
Replace "first tab is auto-selected" with a **Lobby** grid — the front door.
- **Search bar** (fuzzy game-name filter) — top, always visible.
- **Category rail** (the 10 protocol categories A–J): Dice & Number · Wheels · Cards · Drop/Physics · Grid/Reveal · Crash/Multiplier · Slots · Duels · Lottery · EVE-Native.
- **Game cards** in a responsive grid: each card = icon glyph + name + variance badge (L/M/H/VH) + min/max bet + a 1-line hook. Click → opens the game.
- **Rails at top of lobby:**
  - ⭐ **Favorites** (localStorage, per-wallet) — pinned first.
  - ◷ **Recently Played** (localStorage).
  - ▲ **Trending / Hot** (most bets in last 24h from the feed).
  - ✦ **New** (recently launched).
  - ◈ **EVE-Native** (our differentiator, always surfaced).

### 2. In-game view
When a game is open:
- Persistent **back-to-lobby** control + breadcrumb (Lobby › Category › Game).
- **Favorite** toggle (star) on the game header.
- Quick-switch dropdown or a slim "more in this category" rail so players can hop between similar games without returning to the lobby.
- The game panel itself is unchanged (InstantGamePanel / dedicated panels).

### 3. Category browse
Clicking a category rail item → filtered grid of just that category's games (same card layout).

## Data model
- A single **game registry** (`casinoCatalog.ts`): `{ key, name, category, variance, buildClass, minBet, maxBetHint, glyph, hook, status, panel }`. One source of truth that BOTH the lobby grid and the router consume. Adding a game = one registry entry + its panel. This replaces the hardcoded tab array in `CasinoPanel.tsx`.
- Router: `casinoView` state = `{ mode: "lobby" | "game", gameKey? }`. Lobby is default.
- Favorites/recents: localStorage keyed per wallet (mirror the InventoryPanel operator-filter persistence pattern).

## Rollout (incremental, non-breaking)
1. **Phase 1** — build `casinoCatalog.ts` registry from the 19 live games; render a Lobby grid + search + category rail; keep existing panels. Router swaps flat-tabs → lobby/game. (Ships with the next batch.)
2. **Phase 2** — Favorites, Recently Played, per-wallet persistence.
3. **Phase 3** — Trending/Hot (aggregate the provably-fair feeds across games for a 24h bet-count), New rail.
4. **Phase 4** — per-category theming/skins, EVE-native showcase, lobby polish pass (protocol Stage 3 applies to the lobby too — it's the first thing players see).

## Constraints (same as all casino UI)
- Monaco/webview-safe glyphs only (no emoji). Category + game icons use geometric/box glyphs.
- Portal modals, no native `<select>` popouts, no window.prompt/confirm/alert.
- Responsive: grid reflows for mobile + embedded in-game browser.
- Fast: lazy-load game panels (don't mount 100 panels; mount only the open game — same lazy-load-on-intent rule as InventoryPanel).

## Success criteria
- A player can find any game in ≤2 interactions (search or category → card).
- Adding game #101 requires only a registry entry + panel — zero nav rework.
- Lobby loads instantly (no N-RPC fan-out on mount; game data is static registry).
