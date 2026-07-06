// CradleOS Casino — EVE Frontier card theming.
//
// Maps the 4 blackjack suits to EVE Frontier deployable/structure motifs, using
// real game art already on disk in public/. Face cards (J/Q/K) and the Ace use
// ship-class hull art. Everything references public-path assets (served by vite),
// so no imports — just URLs relative to the dApp base.

// Suit → EVE Frontier structure identity. Index matches decodeCard().suit (0..3).
export interface SuitTheme {
  key: string;
  label: string;
  glyph: string;      // monospace-safe fallback glyph (EVE Vault webview has no emoji)
  icon: string;       // public-path image used as the suit pip
  color: string;      // face color for this suit
}

export const SUIT_THEME: SuitTheme[] = [
  { key: "gate",    label: "SMART GATE", glyph: "\u25C8", icon: "game-gate.png",        color: "#FF4700" }, // ◈ red
  { key: "turret",  label: "TURRET",     glyph: "\u2726", icon: "game-turret.png",      color: "#FF4700" }, // ✦ red
  { key: "node",    label: "NODE",       glyph: "\u25C9", icon: "game-networknode.png", color: "#7FC8FF" }, // ◉ blue
  { key: "storage", label: "STORAGE",    glyph: "\u25A3", icon: "game-storage.png",     color: "#7FC8FF" }, // ▣ blue
];

// Ranks 0..12 -> label. 0=Ace,10=J,11=Q,12=K.
export const RANK_LABEL = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// Face-card + Ace ship-class art (EVE Frontier hulls). Higher rank = bigger hull.
export const RANK_SHIP: Record<number, string> = {
  0:  "game-ship-battlecruiser.png", // Ace — flagship
  10: "game-ship-frigate.png",       // Jack
  11: "game-ship-cruiser.png",       // Queen
  12: "game-ship-destroyer.png",     // King
};

// Card back art.
export const CARD_BACK = "cradleos-logo.png";

export function isFace(rank: number): boolean {
  return rank === 0 || rank >= 10;
}
