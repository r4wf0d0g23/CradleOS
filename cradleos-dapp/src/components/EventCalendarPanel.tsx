/**
 * EventCalendarPanel — Community event calendar (localStorage-backed).
 *
 * Events are stored under `cradleos:events:{vaultId}` in localStorage.
 * Founders (vault.founder === connected wallet) may add and remove events.
 * Members see the calendar and event list read-only.
 *
 * Note: events are local to this browser. Broadcast through Announcements tab.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchCharacterTribeId, getCachedVaultId, fetchTribeVault, type TribeVaultState } from "../lib";

// ── types ─────────────────────────────────────────────────────────────────────

export type EventType = "CTA" | "Alliance" | "Defense" | "Industry" | "Social";
export type EventVisibility = "public" | "alliance" | "tribe" | "officers";

export type CommunityEvent = {
  id: string;
  title: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM" or ""
  description: string;
  type: EventType;
  visibility: EventVisibility;
  createdBy: string;
  createdAt: number;
};

const VISIBILITY_OPTS: { value: EventVisibility; label: string; desc: string; color: string }[] = [
  { value: "public",    label: "Public",          desc: "Visible to everyone",                color: "#00ff96" },
  { value: "alliance",  label: "Alliance",         desc: "Alliance members only",              color: "#4488ff" },
  { value: "tribe",     label: "Tribe",            desc: "Tribe members only (default)",       color: "#FF4700" },
  { value: "officers",  label: "Officers Only",    desc: "Leadership eyes only",               color: "#ffcc00" },
];

// ── constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES: EventType[] = ["CTA", "Alliance", "Defense", "Industry", "Social"];

const TYPE_COLOR: Record<EventType, string> = {
  CTA:      "#ff4444",
  Alliance: "#ff8c00",
  Defense:  "#ffcc00",
  Industry: "#4488ff",
  Social:   "#00ff96",
};

const TYPE_BG: Record<EventType, string> = {
  CTA:      "rgba(255,68,68,0.12)",
  Alliance: "rgba(255,140,0,0.12)",
  Defense:  "rgba(255,204,0,0.10)",
  Industry: "rgba(68,136,255,0.10)",
  Social:   "rgba(0,255,150,0.08)",
};

const TYPE_BORDER: Record<EventType, string> = {
  CTA:      "rgba(255,68,68,0.25)",
  Alliance: "rgba(255,140,0,0.25)",
  Defense:  "rgba(255,204,0,0.22)",
  Industry: "rgba(68,136,255,0.22)",
  Social:   "rgba(0,255,150,0.18)",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Hackathon schedule (always visible, public, not deletable) ────────────────

const HACKATHON_EVENTS: CommunityEvent[] = [
  { id: "hk-start",    title: "Hackathon Begins",               date: "2026-03-11", time: "", description: "EVE Frontier Hackathon build period opens. All submissions must target Utopia.", type: "Social",   visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-build",    title: "Build Period (Mar 11 – Mar 31)", date: "2026-03-11", time: "", description: "Open build window. Deploy and iterate on Utopia testnet.",                   type: "Industry", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-deadline", title: "Submission Deadline",            date: "2026-03-31", time: "", description: "All hackathon submissions must be in by end of day.",                        type: "CTA",      visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-deploy",   title: "Deploy to Stillness (Optional)", date: "2026-04-01", time: "", description: "Optional: deploy your project into the live Stillness environment (Apr 1–8).", type: "Industry", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-vote",     title: "Community Voting Opens",         date: "2026-04-01", time: "", description: "Community voting period runs April 1–15.",                                   type: "Alliance", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-judging",  title: "Judging Period",                 date: "2026-04-15", time: "", description: "Official judging by CCP. Runs April 15–22.",                                type: "Defense",  visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "hk-winners",  title: "Winners Announced",              date: "2026-04-24", time: "", description: "Hackathon winners revealed on April 24.",                                    type: "Social",   visibility: "public", createdBy: "CCP", createdAt: 0 },
];

const HACKATHON_IDS = new Set(HACKATHON_EVENTS.map(e => e.id));

// ── EVE Fanfest 2026 (Reykjavik, 14–16 May) ───────────────────────────────────
// Source: https://www.eveonline.com/news/view/eve-fanfest-2026-megablog
// All times local Reykjavik (UTC+0 in May). Posted as Social events, public.

export const FANFEST_EVENTS: CommunityEvent[] = [
  // ── Thursday 14 May ────────────────────────────────────────────────────────
  // Norðurljós
  { id: "ff26-thu-nl-1000", title: "Team Security: Taking the War to Bots and RMT",                   date: "2026-05-14", time: "10:00", description: "Norðurljós · 10:00 · FC Arcade, FC Stinger",                                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-nl-1200", title: "EVE For EVEryone Panel",                                          date: "2026-05-14", time: "12:00", description: "Norðurljós · 12:00 · FC Moss, FC Okami, FC Eclipse, Kshal, Tyrion Hekki",                                              type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-nl-1300", title: "Life of a Killmail",                                              date: "2026-05-14", time: "13:00", description: "Norðurljós · 13:00 · Squizz Caphinator",                                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-nl-1400", title: "Alliance Leadership Panel: What Goes Into Running an Alliance?",  date: "2026-05-14", time: "14:00", description: "Norðurljós · 14:00 · FC Swift",                                                                                        type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-nl-1500", title: "From Small-Gang PvPer to YouTube Creator",                        date: "2026-05-14", time: "15:00", description: "Norðurljós · 15:00 · Grunt Kado",                                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-nl-1600", title: "The Frontier: Setting, Story, and World",                         date: "2026-05-14", time: "16:00", description: "Norðurljós · 16:00 · FC Dramaturg, FC Overload, FC Maximum Cats",                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Kaldalön
  { id: "ff26-thu-kl-1000", title: "An Emergency Physician's Perspective",                            date: "2026-05-14", time: "10:00", description: "Kaldalön · 10:00 · Argus Sorn",                                                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-kl-1200", title: "Project Discovery: A Decade of Citizen Science",                  date: "2026-05-14", time: "12:00", description: "Kaldalön · 12:00 · FC Edelweiss, Ryan Brinkman, Attila Szantner, Alex Butyaev",                                            type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-kl-1300", title: "Predicting the Future… Responsibly",                              date: "2026-05-14", time: "13:00", description: "Kaldalön · 13:00 · FC Excluded",                                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-kl-1400", title: "R&D — How the Carbon Engine is Strengthening the Wider EVE Universe", date: "2026-05-14", time: "14:00", description: "Kaldalön · 14:00 · FC Rave, FC Serpent, FC Sasquatch, FC Overload",                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-kl-1500", title: "3rd Party ESI Panel",                                             date: "2026-05-14", time: "15:00", description: "Kaldalön · 15:00 · FC Stroopwafel, FC Pinky, 3rd party developers",                                                    type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-kl-1600", title: "FC ESI Panel: Supporting Developers at Scale",                    date: "2026-05-14", time: "16:00", description: "Kaldalön · 16:00 · FC Stroopwafel, FC Pinky, FC Troglodyte",                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Þríund
  { id: "ff26-thu-th-1000", title: "AT Fleet Composition and Theory",                                 date: "2026-05-14", time: "10:00", description: "Þríund · 10:00 · Kevin Grumman",                                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-th-1200", title: "EVE Orbit: Everything But the Girl",                              date: "2026-05-14", time: "12:00", description: "Þríund · 12:00 · FC Troglodyte, FC Graven, FC Rubik, FC Stroopwafel",                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-th-1300", title: "EVE for EVEryone",                                                date: "2026-05-14", time: "13:00", description: "Þríund · 13:00 · FC Tara",                                                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-th-1400", title: "Exploring the Psychology Behind Risk vs. Reward",                 date: "2026-05-14", time: "14:00", description: "Þríund · 14:00 · Susurrus Synaesthesia",                                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-th-1500", title: "Architects of the Frontier: Stories from Founder Access",         date: "2026-05-14", time: "15:00", description: "Þríund · 15:00 · FC Goodfella, Lacal, Ocky",                                                                            type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-th-1600", title: "EVE Galaxy Conquest & EVE Echoes Panel",                          date: "2026-05-14", time: "16:00", description: "Þríund · 16:00 · FC Bjorn, FC 6-pack, FC Deadweight",                                                                    type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Thursday Special Events
  { id: "ff26-thu-sp-mini", title: "Miniature Painting — Pop Up",                                     date: "2026-05-14", time: "12:00", description: "Special Event · Pop-up sessions at 12:00 & 14:00",                                                                       type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-sp-lava", title: "Lava Tunnel EVE Experience + GIN Pre-Mixer",                      date: "2026-05-14", time: "15:00", description: "Special Event · 15:00–19:30 · Off-site",                                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-thu-sp-char", title: "Charity Dinner",                                                  date: "2026-05-14", time: "18:00", description: "Special Event · 18:00",                                                                                              type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },

  // ── Friday 15 May ──────────────────────────────────────────────────────────
  // Eldborg (Main Stage)
  { id: "ff26-fri-eb-1000", title: "Opening Ceremony",                                                date: "2026-05-15", time: "10:00", description: "Eldborg (Main Stage) · 10:00 · FC Swift, FC Lumi & FC Larrikin",                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1100", title: "Politics, Patches, and Panic — What makes EVE markets move?",     date: "2026-05-15", time: "11:00", description: "Eldborg (Main Stage) · 11:00 · The Oz",                                                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1200", title: "How to Die in Space: A Choose-Your-Own Adventure That You Probably Won't Survive", date: "2026-05-15", time: "12:00", description: "Eldborg (Main Stage) · 12:00 · Paul M. Sutters",                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1300", title: "The Infinite Game",                                               date: "2026-05-15", time: "13:00", description: "Eldborg (Main Stage) · 13:00 · FC Hellmar & Adrian Bolton (Senior Director, DeepMind) · Opening remarks: President of Iceland Halla Tómasdóttir", type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1445", title: "Space is Beautiful. Space is Dangerous. And Space Doesn't Care if You're Ready.", date: "2026-05-15", time: "14:45", description: "Eldborg (Main Stage) · 14:45 · Dr. Beth Healey",                                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1545", title: "Creating Cinematic Content",                                      date: "2026-05-15", time: "15:45", description: "Eldborg (Main Stage) · 15:45 · Warlock Industries",                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-eb-1630", title: "EVE Fanfest Keynote",                                             date: "2026-05-15", time: "16:30", description: "Eldborg (Main Stage) · 16:30",                                                                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Norðurljós (Second Stage)
  { id: "ff26-fri-nl-1100", title: "Travel and Exploration in the EVE Frontier Galaxy",               date: "2026-05-15", time: "11:00", description: "Norðurljós (Second Stage) · 11:00 · FC Relativistic, FC ConCron, FC Kalirha, FC Hex",                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-nl-1200", title: "Data Team Presentation and Panel",                                date: "2026-05-15", time: "12:00", description: "Norðurljós (Second Stage) · 12:00 · FC Larrikin, FC Data, FC 6-pack, FC Esja",                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-nl-1400", title: "Little Things Panel",                                             date: "2026-05-15", time: "14:00", description: "Norðurljós (Second Stage) · 14:00 · FC karkur, FC Masterplan, FC Mercury, FC Kestrel, FC k1p1",                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-nl-1500", title: "Performance on Trial: Incident Management in EVE Online",          date: "2026-05-15", time: "15:00", description: "Norðurljós (Second Stage) · 15:00 · FC Mayday",                                                                            type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Friday Special Events
  { id: "ff26-fri-sp-mini", title: "Miniature Painting — Pop Up",                                     date: "2026-05-15", time: "12:00", description: "Special Event · Pop-up sessions at 12:00 & 14:00",                                                                       type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-fri-sp-pub",  title: "Pub Crawl",                                                       date: "2026-05-15", time: "19:30", description: "Special Event · 19:30 · Reykjavik",                                                                                    type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },

  // ── Saturday 16 May ────────────────────────────────────────────────────────
  // Eldborg (Main Stage)
  { id: "ff26-sat-eb-1000", title: "Vanguard Keynote",                                                date: "2026-05-16", time: "10:00", description: "Eldborg (Main Stage) · 10:00 · FC Collins, FC Rattati, FC Jayess",                                                        type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1100", title: "Blood, Ink, and Immortality: A Capsuleer's Edda",                 date: "2026-05-16", time: "11:00", description: "Eldborg (Main Stage) · 11:00 · Mark Crowther",                                                                            type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1200", title: "Evolving Empires: Four Sides to Every Story",                     date: "2026-05-16", time: "12:00", description: "Eldborg (Main Stage) · 12:00 · FC Diegetic, FC Burger, FC Jayess",                                                        type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1300", title: "New Eden in High Fidelity with EVE's Art Team",                   date: "2026-05-16", time: "13:00", description: "Eldborg (Main Stage) · 13:00 · FC Goggi, FC Seaslug",                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1400", title: "Frontier Keynote",                                                date: "2026-05-16", time: "14:00", description: "Eldborg (Main Stage) · 14:00 · FC Goodfella, FC Maximum Cats, FC Jotunn, FC Bowman, FC Overload",                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1500", title: "[REDACTED] Expansion Unlocked",                                   date: "2026-05-16", time: "15:00", description: "Eldborg (Main Stage) · 15:00 · FC Okami, FC k1p1, FC Nikon, FC Havran, FC Mercury",                                          type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-eb-1600", title: "Closing Ceremony",                                                date: "2026-05-16", time: "16:00", description: "Eldborg (Main Stage) · 16:00 · FC Jotunn, FC Zelus",                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Norðurljós (Second Stage)
  { id: "ff26-sat-nl-1000", title: "Connecting Designers to the Players",                             date: "2026-05-16", time: "10:00", description: "Norðurljós (Second Stage) · 10:00 · FC Blaraka, FC Bituman",                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-nl-1100", title: "Unleashing Fenris",                                               date: "2026-05-16", time: "11:00", description: "Norðurljós (Second Stage) · 11:00 · FC Burger, FC Junison, FC Slingermann",                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-nl-1200", title: "Sui × EVE Frontier",                                              date: "2026-05-16", time: "12:00", description: "Norðurljós (Second Stage) · 12:00 · FC Bowman, FC Raudur · Fireside w. FC Hellmar and Kevin Boon, President of Mysten Labs",  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-nl-1300", title: "Ship Balance Therapy Session",                                    date: "2026-05-16", time: "13:00", description: "Norðurljós (Second Stage) · 13:00 · FC Trash Panda, FC Kestrel, FC Fozzie",                                                  type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  // Saturday Special Events
  { id: "ff26-sat-sp-mini", title: "Miniature Painting — Pop Up",                                     date: "2026-05-16", time: "12:00", description: "Special Event · Pop-up sessions at 12:00 & 14:00",                                                                       type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-sp-mix",  title: "Mixer and Drinks (Powered by WorldLine)",                          date: "2026-05-16", time: "19:00", description: "Special Event · 19:00",                                                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-sp-cre",  title: "Creator Awards",                                                  date: "2026-05-16", time: "19:30", description: "Special Event · 19:30",                                                                                                type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
  { id: "ff26-sat-sp-prty", title: "Party at the Top of the World",                                   date: "2026-05-16", time: "20:00", description: "Special Event · 20:00 · Harpa · Sponsored by Sui",                                                                      type: "Social", visibility: "public", createdBy: "CCP", createdAt: 0 },
];

const FANFEST_IDS = new Set(FANFEST_EVENTS.map(e => e.id));

// ── Built-in event IDs (cannot be deleted by users) ───────────────────────────

const BUILTIN_IDS = new Set<string>([...HACKATHON_IDS, ...FANFEST_IDS]);

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadEvents(vaultId: string): CommunityEvent[] {
  try {
    const raw = localStorage.getItem(`cradleos:events:${vaultId}`);
    const stored: CommunityEvent[] = raw ? (JSON.parse(raw) as CommunityEvent[]) : [];
    // Merge: built-in events always present, user events after, no duplicates
    const userEvents = stored.filter(e => !BUILTIN_IDS.has(e.id));
    return [...HACKATHON_EVENTS, ...FANFEST_EVENTS, ...userEvents];
  } catch { return [...HACKATHON_EVENTS, ...FANFEST_EVENTS]; }
}

function saveEvents(vaultId: string, events: CommunityEvent[]): void {
  try {
    localStorage.setItem(`cradleos:events:${vaultId}`, JSON.stringify(events));
  } catch { /* storage full */ }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── calendar helpers ──────────────────────────────────────────────────────────

/** Parse a "YYYY-MM-DD" string as LOCAL time (not UTC) to avoid timezone day-shift. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns an array of date strings ("YYYY-MM-DD") for a given year+month. */
function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    days.push(`${d.getFullYear()}-${mm}-${dd}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function toDateStr(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ── sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: EventType }) {
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.06em",
      padding: "2px 7px",
      borderRadius: "0",
      background: TYPE_BG[type],
      border: `1px solid ${TYPE_BORDER[type]}`,
      color: TYPE_COLOR[type],
    }}>
      {type}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const opt = VISIBILITY_OPTS.find(o => o.value === visibility) ?? VISIBILITY_OPTS[2];
  const icons: Record<EventVisibility, string> = {
    public:   "◎",
    alliance: "◈",
    tribe:    "◆",
    officers: "▲",
  };
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.05em",
      padding: "2px 7px",
      borderRadius: "0",
      background: `${opt.color}14`,
      border: `1px solid ${opt.color}40`,
      color: opt.color,
    }}>
      {icons[visibility]} {opt.label.toUpperCase()}
    </span>
  );
}

// ── calendar grid for one month ───────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  eventsByDate,
  selectedDate,
  onSelectDate,
  today,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, CommunityEvent[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  today: string;
}) {
  const days = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);

  // Build grid cells: leading blanks + day cells
  const cells: Array<{ date: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null });
  for (const d of days) cells.push({ date: d });

  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: "12px", marginBottom: "8px", letterSpacing: "0.06em" }}>
        {monthLabel(year, month).toUpperCase()}
      </div>

      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "2px" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{
            textAlign: "center", color: "rgba(175,175,155,0.5)",
            fontSize: "10px", letterSpacing: "0.05em", paddingBottom: "4px",
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((cell, i) => {
          if (!cell.date) {
            return <div key={`blank-${i}`} style={{ minHeight: "36px" }} />;
          }
          const evs = eventsByDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const dayNum = parseLocalDate(cell.date).getDate();
          const isWeekend = parseLocalDate(cell.date).getDay() === 0 || parseLocalDate(cell.date).getDay() === 6;

          return (
            <button
              key={cell.date}
              onClick={() => onSelectDate(cell.date!)}
              style={{
                minHeight: "36px",
                padding: "4px 4px 3px",
                background: isSelected
                  ? "rgba(255,71,0,0.15)"
                  : isToday
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.02)",
                border: isSelected
                  ? "1px solid rgba(255,71,0,0.45)"
                  : isToday
                  ? "1px solid rgba(255,255,255,0.14)"
                  : "1px solid rgba(255,255,255,0.04)",
                borderRadius: "0",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                transition: "all 0.1s",
              }}
            >
              <span style={{
                fontSize: "11px",
                color: isToday ? "#fff" : isWeekend ? "rgba(175,175,155,0.55)" : "#888",
                fontWeight: isToday ? 700 : 400,
                lineHeight: 1,
              }}>
                {dayNum}
              </span>

              {/* Event dots */}
              {evs.length > 0 && (
                <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", justifyContent: "center" }}>
                  {evs.slice(0, 4).map((ev, j) => (
                    <div
                      key={j}
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: TYPE_COLOR[ev.type],
                        flexShrink: 0,
                      }}
                    />
                  ))}
                  {evs.length > 4 && (
                    <div style={{ fontSize: "9px", color: "rgba(175,175,155,0.55)", lineHeight: 1 }}>
                      +{evs.length - 4}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── event card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  isFounder,
  onDelete,
}: {
  event: CommunityEvent;
  isFounder: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: TYPE_BG[event.type],
      border: `1px solid ${TYPE_BORDER[event.type]}`,
      borderLeft: `3px solid ${TYPE_COLOR[event.type]}`,
      borderRadius: "0",
      padding: "10px 12px",
      marginBottom: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
            <TypeBadge type={event.type} />
            <VisibilityBadge visibility={event.visibility ?? "tribe"} />
            {HACKATHON_IDS.has(event.id) && (
              <span style={{ fontSize: 10, color: "#FF4700", border: "1px solid #FF470044", padding: "0px 5px", background: "rgba(255,71,0,0.07)" }}>HACKATHON</span>
            )}
            {FANFEST_IDS.has(event.id) && (
              <span style={{ fontSize: 10, color: "#46d6db", border: "1px solid #46d6db44", padding: "0px 5px", background: "rgba(70,214,219,0.07)" }}>FANFEST 2026</span>
            )}
            <span style={{ color: "#c8c8b8", fontSize: "13px", fontWeight: 600 }}>{event.title}</span>
          </div>
          <div style={{ color: "rgba(175,175,155,0.6)", fontSize: "11px" }}>
            {event.date}{event.time ? ` at ${event.time}` : ""}
          </div>
          {event.description && (
            <div style={{ marginTop: "4px" }}>
              {expanded || event.description.length <= 80 ? (
                <span style={{ color: "#999", fontSize: "11px" }}>{event.description}</span>
              ) : (
                <>
                  <span style={{ color: "#999", fontSize: "11px" }}>{event.description.slice(0, 80)}…</span>
                  <button
                    onClick={() => setExpanded(true)}
                    style={{
                      background: "none", border: "none", color: "rgba(175,175,155,0.55)",
                      fontSize: "11px", cursor: "pointer", padding: "0 4px",
                    }}
                  >
                    more
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {isFounder && !BUILTIN_IDS.has(event.id) && (
          <button
            onClick={() => onDelete(event.id)}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(175,175,155,0.4)", borderRadius: "0",
              fontSize: "11px", padding: "2px 8px", cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── add event form ────────────────────────────────────────────────────────────

function AddEventForm({
  onAdd,
  walletAddress,
}: {
  onAdd: (ev: CommunityEvent) => void;
  walletAddress: string;
}) {
  const today = toDateStr(new Date());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>("Social");
  const [visibility, setVisibility] = useState<EventVisibility>("tribe");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(255,71,0,0.08)",
          border: "1px solid rgba(255,71,0,0.25)",
          color: "#FF4700",
          borderRadius: "0",
          fontSize: "12px",
          padding: "7px 18px",
          cursor: "pointer",
          letterSpacing: "0.05em",
          fontWeight: 600,
          marginBottom: "12px",
        }}
      >
        + Add Event
      </button>
    );
  }

  const handleSubmit = () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!date) { setError("Date is required."); return; }
    setError(null);
    onAdd({
      id: uid(),
      title: title.trim(),
      date,
      time,
      description: description.trim(),
      type,
      visibility,
      createdBy: walletAddress,
      createdAt: Date.now(),
    });
    setTitle(""); setDate(today); setTime(""); setDescription(""); setType("Social"); setVisibility("tribe");
    setOpen(false);
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "0",
    color: "#c8c8b8",
    fontSize: "12px",
    padding: "6px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    color: "rgba(175,175,155,0.55)",
    fontSize: "10px",
    letterSpacing: "0.06em",
    marginBottom: "3px",
    display: "block" as const,
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,71,0,0.18)",
      borderRadius: "0",
      padding: "14px 16px",
      marginBottom: "14px",
    }}>
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "11px", letterSpacing: "0.08em", marginBottom: "14px" }}>
        NEW EVENT
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fleet op, mining op, social…"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>DATE</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
        </div>

        <div>
          <label style={labelStyle}>TIME (optional)</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
        </div>

        <div>
          <label style={labelStyle}>TYPE</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>WHO CAN SEE THIS</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {VISIBILITY_OPTS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  border: `1px solid ${visibility === opt.value ? opt.color + "60" : "rgba(255,255,255,0.08)"}`,
                  background: visibility === opt.value ? `${opt.color}10` : "transparent",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                  style={{ accentColor: opt.color }}
                />
                <div>
                  <div style={{ color: visibility === opt.value ? opt.color : "#c8c8b8", fontWeight: 700, letterSpacing: "0.04em" }}>{opt.label}</div>
                  <div style={{ color: "rgba(175,175,155,0.55)", fontSize: "10px" }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>DESCRIPTION (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details, objectives, requirements…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "#ff6432", fontSize: "11px", marginBottom: "8px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSubmit}
          style={{
            background: "rgba(255,71,0,0.12)",
            border: "1px solid rgba(255,71,0,0.35)",
            color: "#FF4700",
            borderRadius: "0",
            fontSize: "12px",
            padding: "6px 18px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add Event
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(175,175,155,0.55)",
            borderRadius: "0",
            fontSize: "12px",
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── public read-only view (no wallet / no vault) ─────────────────────────────

function PublicCalendarView({ loading, noVault }: { loading: boolean; noVault: boolean }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = toDateStr(new Date());

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CommunityEvent[]>();
    for (const ev of HACKATHON_EVENTS) {
      const arr = m.get(ev.date) ?? [];
      arr.push(ev);
      m.set(ev.date, arr);
    }
    return m;
  }, []);

  const months = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() }; // 0-indexed, matches MonthGrid
    });
  }, []);

  const listedEvents = useMemo(() => {
    if (selectedDate) return eventsByDate.get(selectedDate) ?? [];
    return [...HACKATHON_EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDate, eventsByDate]);

  return (
    <div className="card">
      <div style={{ color: "#aaa", fontWeight: 700, fontSize: "16px", marginBottom: "4px", letterSpacing: "0.04em" }}>
        Event Calendar
      </div>
      <div style={{ color: "rgba(175,175,155,0.5)", fontSize: "11px", marginBottom: "12px" }}>
        Public schedule — connect wallet and create a tribe vault to add tribe events
      </div>

      {/* Status hint */}
      {loading && (
        <div style={{ fontSize: 11, color: "rgba(175,175,155,0.45)", marginBottom: 12 }}>Loading vault…</div>
      )}
      {noVault && (
        <div style={{ fontSize: 11, color: "rgba(255,71,0,0.6)", marginBottom: 12, border: "1px solid rgba(255,71,0,0.2)", padding: "6px 10px", background: "rgba(255,71,0,0.04)" }}>
          No tribe vault found — create one in the Tribe Vault tab to unlock tribe events.
        </div>
      )}

      {/* Type legend */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {EVENT_TYPES.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: TYPE_COLOR[t] }} />
            <span style={{ color: "rgba(175,175,155,0.55)", fontSize: "10px", letterSpacing: "0.04em" }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Calendar + Events side by side */}
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 50%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px" }}>
          {months.map(({ year, month }) => (
            <MonthGrid
              key={`${year}-${month}`}
              year={year}
              month={month}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(selectedDate === d ? null : d)}
              today={today}
            />
          ))}
          {selectedDate && (
            <button onClick={() => setSelectedDate(null)} style={{ background: "transparent", border: "none", color: "rgba(175,175,155,0.45)", fontSize: "11px", cursor: "pointer", padding: 0, marginTop: 4 }}>
              ← Show all
            </button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "rgba(175,175,155,0.5)", fontSize: "10px", letterSpacing: "0.08em", marginBottom: "10px", fontWeight: 700 }}>
            {selectedDate ? `EVENTS — ${selectedDate}` : "HACKATHON SCHEDULE"}
          </div>
          {listedEvents.length === 0
            ? <div style={{ color: "rgba(175,175,155,0.4)", fontSize: "12px", padding: "20px 0", textAlign: "center" }}>No events on this date.</div>
            : listedEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} isFounder={false} onDelete={() => {}} />
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ── main inner panel ──────────────────────────────────────────────────────────

function EventCalendarPanelInner({ vault }: { vault: TribeVaultState }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const isFounder = !!account && vault.founder.toLowerCase() === account.address.toLowerCase();

  const [events, setEvents] = useState<CommunityEvent[]>(() => loadEvents(vault.objectId));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = toDateStr(new Date());

  // Build map: date string → events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CommunityEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  // Months to display: current + next 2
  const months = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const handleAdd = (ev: CommunityEvent) => {
    const updated = [ev, ...events];
    setEvents(updated);
    saveEvents(vault.objectId, updated);
    setSelectedDate(ev.date);
  };

  const handleDelete = (id: string) => {
    if (BUILTIN_IDS.has(id)) return; // hackathon and Fanfest events are permanent
    const updated = events.filter((e) => e.id !== id);
    setEvents(updated);
    saveEvents(vault.objectId, updated);
  };

  // Events to show in the list: selected date or all upcoming
  const listedEvents = useMemo(() => {
    if (selectedDate) {
      return eventsByDate.get(selectedDate) ?? [];
    }
    // All upcoming events sorted by date
    return [...events]
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [events, selectedDate, eventsByDate, today]);

  const pastEvents = useMemo(() => {
    if (selectedDate) return [];
    return [...events]
      .filter((e) => e.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events, selectedDate, today]);

  return (
    <div>
      {/* Info banner */}
      <div style={{
        background: "rgba(100,180,255,0.04)",
        border: "1px solid rgba(100,180,255,0.12)",
        borderRadius: "0",
        padding: "8px 14px",
        marginBottom: "16px",
        fontSize: "11px",
        color: "rgba(175,175,155,0.6)",
      }}>
        Events are local to this browser — use the Announcements tab to broadcast to tribe members
      </div>

      {/* Type legend */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {EVENT_TYPES.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: TYPE_COLOR[t] }} />
            <span style={{ color: "rgba(175,175,155,0.55)", fontSize: "10px", letterSpacing: "0.04em" }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Add event button / form */}
      {isFounder && (
        <AddEventForm onAdd={handleAdd} walletAddress={account!.address} />
      )}

      {/* Calendar + Events side by side */}
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>

      {/* LEFT: Calendar grid */}
      <div style={{
        flex: "0 0 50%",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "0",
        padding: "14px 16px",
      }}>
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            eventsByDate={eventsByDate}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(selectedDate === d ? null : d)}
            today={today}
          />
        ))}

        {selectedDate && (
          <div style={{ marginTop: "4px" }}>
            <button
              onClick={() => setSelectedDate(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(175,175,155,0.45)",
                fontSize: "11px",
                cursor: "pointer",
                padding: "0",
              }}
            >
              ← Show all upcoming
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Event list */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: "rgba(175,175,155,0.5)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          marginBottom: "10px",
          fontWeight: 700,
        }}>
          {selectedDate
            ? `EVENTS — ${selectedDate}`
            : `UPCOMING EVENTS`}
        </div>

        {listedEvents.length === 0 ? (
          <div style={{
            color: "rgba(175,175,155,0.4)",
            fontSize: "12px",
            padding: "20px 0",
            textAlign: "center",
          }}>
            {selectedDate
              ? "No events on this date."
              : "No upcoming events. Add one above."}
          </div>
        ) : (
          listedEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              isFounder={isFounder}
              onDelete={handleDelete}
            />
          ))
        )}

        {!selectedDate && pastEvents.length > 0 && (
          <details style={{ marginTop: "16px" }}>
            <summary style={{
              color: "rgba(175,175,155,0.4)",
              fontSize: "10px",
              letterSpacing: "0.06em",
              cursor: "pointer",
              marginBottom: "8px",
              userSelect: "none",
            }}>
              PAST EVENTS ({pastEvents.length})
            </summary>
            {pastEvents.slice(0, 10).map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                isFounder={isFounder}
                onDelete={handleDelete}
              />
            ))}
          </details>
        )}
      </div>{/* end RIGHT: event list */}
      </div>{/* end flex row */}
    </div>
  );
}

// ── public export ─────────────────────────────────────────────────────────────

export function EventCalendarPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;

  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => (account ? fetchCharacterTribeId(account.address) : Promise.resolve(null)),
    enabled: !!account?.address,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      const vaultId = getCachedVaultId(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 30_000,
  });

  // Public view: show hackathon schedule even without wallet/vault
  if (!account || vaultLoading || !vault) {
    return (
      <PublicCalendarView
        loading={!!account && vaultLoading}
        noVault={!!account && !vaultLoading && !vault}
      />
    );
  }

  return (
    <div className="card">
      <div style={{
        color: "#aaa",
        fontWeight: 700,
        fontSize: "16px",
        marginBottom: "4px",
        letterSpacing: "0.04em",
      }}>
        Event Calendar
      </div>
      <div style={{ color: "rgba(175,175,155,0.5)", fontSize: "11px", marginBottom: "16px" }}>
        {vault.coinSymbol || `Tribe #${vault.tribeId}`} — {vault.coinName}
      </div>
      <EventCalendarPanelInner vault={vault} />
    </div>
  );
}
