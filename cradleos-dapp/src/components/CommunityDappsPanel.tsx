// CommunityDappsPanel — discovery surface for community-built EVE Frontier dApps.
//
// First-pass card set seeded from the official Fenris Creations Community Gallery
// (https://evefrontier.com/en/community-gallery, scraped from __NEXT_DATA__
// 2026-05-26). Future iterations can pull dynamically from Contentful or a
// community submission flow.
//
// Pattern: card grid with thumbnail + title + tagline + tags. Clicking a card
// opens the dApp in a new tab. Designed to feel like a curated dApp browser
// (Google Play / App Store) rather than a static link list.

import { useMemo, useState } from "react";

interface DAppCard {
  id: string;
  title: string;
  tagline: string;        // short, ≤140 chars
  url: string;
  image?: string;         // remote thumbnail
  tags: string[];         // ["Governance", "PvP", ...] used for filtering
  author?: string;
  highlight?: boolean;    // pinned/featured
}

// ─── Seed corpus from Fenris Creations Community Gallery (verified 2026-05-26) ────
const SEED_DAPPS: DAppCard[] = [
  {
    id: "cradleos",
    title: "CradleOS",
    tagline:
      "Civilization management — territory, resources, defense, logistics. The dApp you're inside.",
    url: "https://r4wf0d0g23.github.io/CradleOS/",
    image: "https://images.ctfassets.net/nl199sv2jlik/XIoWHJwNYPalwsEN5jYI3/4257e49c1190c0ade3065b0573f6fe14/CradleOS_1.png",
    tags: ["Governance", "Civilization", "Logistics", "Featured"],
    author: "Reality Anchor",
    highlight: true,
  },
  {
    id: "bloodcontract",
    title: "Blood Contract",
    tagline:
      "Bounty system. Place rewards on targets, define hunt conditions, automatic payouts on confirmed kills.",
    url: "https://bloodcontract.space/",
    image: "https://images.ctfassets.net/nl199sv2jlik/AcJohOY6iS55EdECSusqr/0c59c2135f94df5e9bbf64c03f8949a9/Blood_Contract_1.png",
    tags: ["PvP", "Bounties", "Economy"],
  },
  {
    id: "civcontrol",
    title: "Civilization Control",
    tagline:
      "Single-pane control surface for gates, trade routes, and defenses with rules and access management.",
    url: "https://hackathon.civilizationcontrol.pages.dev",
    image: "https://images.ctfassets.net/nl199sv2jlik/5TtybDY3PQi1noj1egabLB/9f023d40257b4a7a485e7665d6fef189/Civilization_Control_1.png",
    tags: ["Governance", "Infrastructure", "Logistics"],
  },
  {
    id: "easyassemblies",
    title: "EasyAssemblies",
    tagline:
      "Beginner-friendly visual configurator for Smart Assemblies — gates, storage, defenses in minutes.",
    url: "https://superchainstage.github.io/EasyAssemblies/",
    image: "https://images.ctfassets.net/nl199sv2jlik/5B1VamSxRrNNFXxSaJKa9E/a61e1c5d0577e13f705a77d03c7a278f/Easy_Assemblies_1.png",
    tags: ["Smart Assemblies", "Tools", "Builder"],
  },
  {
    id: "frontierflow",
    title: "Frontier Flow",
    tagline:
      "Open-source visual editor for Smart Assemblies. Drag-and-connect logic, generates real Sui Move code.",
    url: "https://frontier-flow.scetrov.live/",
    image: "https://images.ctfassets.net/nl199sv2jlik/LDg35sb4UFMh2ptHWONDR/411b329f76aea0f42833c79e90e5f95e/Frontier_Flow.png",
    tags: ["Smart Assemblies", "Tools", "Developer"],
  },
  {
    id: "bazaar",
    title: "Bazaar",
    tagline:
      "Immersive walkable marketplace. Trading turns from a menu into a shared social space.",
    url: "https://evebazaar.netlify.app/",
    image: "https://images.ctfassets.net/nl199sv2jlik/3fgtWkHzwTqn22wobWuNP/db462d45e3f867ac4dfec63c498c9b21/Bazaar.png",
    tags: ["Economy", "Marketplace", "Social"],
  },
  {
    id: "shadowbroker",
    title: "Shadow Broker Protocol",
    tagline:
      "Spycraft and intel as tradeable resource. Buy, sell, weaponize data alongside conventional warfare.",
    url: "https://sb-protocol.com/",
    image: "https://images.ctfassets.net/nl199sv2jlik/2EgmCeuUeNAOS5QdGNmufk/b729782c87fe9b8de05bf2203593e221/Shadow_Broker_Protocol.png",
    tags: ["Intel", "PvP", "Economy"],
  },
  {
    id: "factionalwarfare",
    title: "Frontier Factional Warfare",
    tagline:
      "Live conflict zones with capturable objectives. Faction-driven PvP enforced by in-world structures.",
    url: "https://ef-fw.onrender.com/",
    image: "https://images.ctfassets.net/nl199sv2jlik/3N4ICWi1blM44tmzvurF8d/2fdf1dba37aecfb9d81b1491ca590a04/Frontier_Factional_Warfare.png",
    tags: ["PvP", "Factions", "Territory"],
  },
  // ── Additional well-known community resources ────────────────────────────
  {
    id: "efmap",
    title: "EF-Map",
    tagline:
      "Free 3D starmap and in-browser route planner for 24,000+ systems — WASM routing, Smart Gate edges, and fuel/jump-range optimization. Also embedded as a CradleOS tab.",
    url: "https://ef-map.com/",
    tags: ["Navigation", "Tools", "Map"],
  },
];

// Derive all unique tags for the filter row.
function uniqueTags(cards: DAppCard[]): string[] {
  const set = new Set<string>();
  cards.forEach((c) => c.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

export function CommunityDappsPanel() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => uniqueTags(SEED_DAPPS), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEED_DAPPS.filter((d) => {
      if (activeTag && !d.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.tagline.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)) ||
        (d.author?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, activeTag]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "16px 0",
        color: "rgba(250,250,229,0.88)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(255,71,0,0.14)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,71,0,0.85)",
            fontFamily: "monospace",
          }}
        >
          ◉ Community dApps · {SEED_DAPPS.length} listed
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(220,210,190,0.65)",
            maxWidth: 720,
            lineHeight: 1.5,
          }}
        >
          A curated registry of community-built EVE Frontier dApps. Cards are
          seeded from the official Fenris Creations Community Gallery; new entries can be
          proposed via the EVE Frontier Discord or submitted upstream to Fenris Creations.
          Click any card to open in a new tab.
        </div>
      </div>

      {/* ── Search + tag filter ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          fontFamily: "monospace",
        }}
      >
        <input
          type="text"
          placeholder="search dApps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: "1 1 220px",
            minWidth: 180,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,71,0,0.25)",
            color: "rgba(250,250,229,0.88)",
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            outline: "none",
          }}
        />
        <button
          onClick={() => setActiveTag(null)}
          style={{
            background: activeTag === null ? "rgba(255,71,0,0.2)" : "transparent",
            border: `1px solid rgba(255,71,0,${activeTag === null ? 0.6 : 0.25})`,
            color: activeTag === null ? "#FF4700" : "rgba(220,210,190,0.7)",
            padding: "6px 12px",
            fontSize: 10,
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          all
        </button>
        {tags.map((tag) => {
          const active = activeTag === tag;
          return (
            <button
              key={tag}
              onClick={() => setActiveTag(active ? null : tag)}
              style={{
                background: active ? "rgba(255,71,0,0.2)" : "transparent",
                border: `1px solid rgba(255,71,0,${active ? 0.6 : 0.18})`,
                color: active ? "#FF4700" : "rgba(220,210,190,0.65)",
                padding: "6px 10px",
                fontSize: 10,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "rgba(220,210,190,0.5)",
            fontFamily: "monospace",
            fontSize: 12,
          }}
        >
          no dApps match this filter
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((d) => (
            <DAppCardView key={d.id} card={d} />
          ))}
        </div>
      )}

      {/* ── Footer / submission CTA ──────────────────────────────────────── */}
      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          border: "1px dashed rgba(255,71,0,0.2)",
          background: "rgba(8,5,2,0.4)",
          fontSize: 11,
          color: "rgba(220,210,190,0.7)",
          lineHeight: 1.5,
          fontFamily: "monospace",
        }}
      >
        ▸ Want your dApp listed?{" "}
        <a
          href="https://discord.com/invite/evefrontier"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#FF4700", textDecoration: "none" }}
        >
          Post in the EVE Frontier Discord
        </a>{" "}
        or submit to the{" "}
        <a
          href="https://evefrontier.com/en/community-gallery"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#FF4700", textDecoration: "none" }}
        >
          official Community Gallery
        </a>
        . Verified entries land here on next CradleOS deploy.
      </div>
    </div>
  );
}

// ─── Single card ────────────────────────────────────────────────────────────
function DAppCardView({ card }: { card: DAppCard }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        background: card.highlight
          ? "rgba(255,71,0,0.06)"
          : "rgba(8,5,2,0.55)",
        border: `1px solid rgba(255,71,0,${card.highlight ? 0.45 : 0.18})`,
        overflow: "hidden",
        transition: "transform 0.15s ease, border-color 0.15s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "rgba(255,71,0,0.7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = `rgba(255,71,0,${card.highlight ? 0.45 : 0.18})`;
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "rgba(0,0,0,0.6)",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {card.image && !imgError ? (
          <img
            src={card.image}
            alt={card.title}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,71,0,0.4)",
              fontFamily: "monospace",
              fontSize: 28,
              letterSpacing: "0.15em",
            }}
          >
            ◉ {card.title.charAt(0)}
          </div>
        )}
        {card.highlight && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "2px 8px",
              background: "rgba(255,71,0,0.85)",
              color: "#000",
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            ▣ featured
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "rgba(250,250,229,0.95)",
              letterSpacing: "0.02em",
            }}
          >
            {card.title}
          </div>
          <span
            style={{
              fontSize: 9,
              color: "rgba(255,71,0,0.7)",
              fontFamily: "monospace",
              letterSpacing: "0.1em",
            }}
            title="Opens in new tab"
          >
            ↗
          </span>
        </div>

        <div
          style={{
            fontSize: 11.5,
            color: "rgba(220,210,190,0.7)",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {card.tagline}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 4,
          }}
        >
          {card.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 6px",
                border: "1px solid rgba(255,71,0,0.15)",
                color: "rgba(220,210,190,0.6)",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {card.author && (
          <div
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              color: "rgba(180,160,140,0.55)",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            by {card.author}
          </div>
        )}
      </div>
    </a>
  );
}

export default CommunityDappsPanel;
