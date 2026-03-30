import { useState, useCallback, useEffect } from "react";
import { abbreviateAddress, useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useWallets, useDAppKit } from "@mysten/dapp-kit-react";
import { VerifiedAccountProvider, useVerifiedAccountContext } from "./contexts/VerifiedAccountContext";
import { DevModeProvider, DevRoleToggle } from "./contexts/DevModeContext";
import { ServerMismatchBanner } from "./components/ServerMismatchBanner";
import { StructurePanel } from "./components/StructurePanel";
import { TribeVaultPanel } from "./components/TribeVaultPanel";
import { TurretPolicyPanel } from "./components/TurretPolicyPanel";
import { RegistryPanel } from "./components/RegistryPanel";
import { MapPanel } from "./components/MapPanel";
import { BountyPanel } from "./components/BountyPanel";
import { CargoContractPanel } from "./components/CargoContractPanel";
import { GatePolicyPanel } from "./components/GatePolicyPanel";
import { InheritancePanel } from "./components/InheritancePanel";
import { IntelDashboardPanel } from "./components/IntelDashboardPanel";
import { AnnouncementPanel } from "./components/AnnouncementPanel";
import { RecruitingPanel } from "./components/RecruitingPanel";
import { TribeHierarchyPanel } from "./components/TribeHierarchyPanel";
import { AssetLedgerPanel } from "./components/AssetLedgerPanel";
import { EventCalendarPanel } from "./components/EventCalendarPanel";
import { LoreWikiPanel } from "./components/LoreWikiPanel";
import { ShipFittingPanel } from "./components/ShipFittingPanel";
import { QueryPanel } from "./components/QueryPanel";
import { SRPPanel } from "./components/SRPPanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { KeeperPanel } from "./components/KeeperPanel";
import { UpgradePanel } from "./components/UpgradePanel";
import { DashboardPanel } from "./components/DashboardPanel";
import { LineageWarPanel } from "./components/LineageWarPanel";
import { LinksPanel } from "./components/LinksPanel";
import { IndustryPanel } from "./components/IndustryPanel";
import { getServerEnv, onServerEnvChange, SERVER_ENV, type ServerEnv } from "./constants";

// ── Server status dots ────────────────────────────────────────────────────────
const SERVERS = [
  { label: "STILLNESS", url: "https://world-api-stillness.live.tech.evefrontier.com/v2/tribes?limit=1" },
  { label: "UTOPIA",    url: "https://world-api-utopia.uat.pub.evefrontier.com/v2/tribes?limit=1"    },
];
type ServerStatus = "checking" | "online" | "offline";

function ServerStatusDots({ compact }: { compact: boolean }) {
  const [statuses, setStatuses] = useState<ServerStatus[]>(SERVERS.map(() => "checking"));
  useEffect(() => {
    SERVERS.forEach((s, i) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      // mode: 'no-cors' returns an opaque response — we can't read status,
      // but the promise resolves if the server is reachable and rejects if not.
      fetch(s.url, { method: "HEAD", mode: "no-cors", signal: controller.signal })
        .then(() => setStatuses(prev => { const n = [...prev]; n[i] = "online"; return n; }))
        .catch(() => setStatuses(prev => { const n = [...prev]; n[i] = "offline"; return n; }))
        .finally(() => clearTimeout(timer));
    });
  }, []);
  return (
    <div style={{ display: "flex", gap: compact ? "6px" : "10px", alignItems: "center" }}>
      {SERVERS.map((s, i) => {
        const st = statuses[i];
        const color = st === "online" ? "#00ff96" : st === "offline" ? "#ff4444" : "rgba(180,160,140,0.4)";
        return (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "4px" }}
               title={`${s.label}: ${st.toUpperCase()}`}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color,
                          boxShadow: st === "online" ? `0 0 4px ${color}` : "none" }} />
            {!compact && <span style={{ fontSize: "9px", fontFamily: "monospace",
                                        color: "rgba(180,160,140,0.5)", letterSpacing: "0.06em" }}>
              {s.label}
            </span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Chain Health Strip ────────────────────────────────────────────────────────

interface ChainMetrics {
  checkpoint: number | null;
  checkpointAgeMs: number | null;
  epoch: number | null;
  validators: number | null;
  gasPrice: number | null;
  latencyMs: number | null;
}

function ChainHealth() {
  const [metrics, setMetrics] = useState<ChainMetrics>({
    checkpoint: null, checkpointAgeMs: null, epoch: null,
    validators: null, gasPrice: null, latencyMs: null,
  });

  useEffect(() => {
    let cancelled = false;
    const RPC = "https://fullnode.testnet.sui.io:443";
    const post = async (method: string, params: unknown[] = []) => {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      return (await r.json()).result;
    };

    const load = async () => {
      try {
        const t0 = Date.now();
        const seqStr = await post("sui_getLatestCheckpointSequenceNumber");
        const latencyMs = Date.now() - t0;
        const seq = parseInt(seqStr, 10);

        const [cp, committee, gasStr] = await Promise.all([
          post("sui_getCheckpoint", [String(seq)]),
          post("suix_getCommitteeInfo"),
          post("suix_getReferenceGasPrice"),
        ]);

        if (cancelled) return;
        setMetrics({
          checkpoint: seq,
          checkpointAgeMs: cp?.timestampMs ? Date.now() - parseInt(cp.timestampMs, 10) : null,
          epoch: committee?.epoch ? parseInt(committee.epoch, 10) : null,
          validators: committee?.validators?.length ?? null,
          gasPrice: gasStr ? parseInt(gasStr, 10) : null,
          latencyMs,
        });
      } catch { /* silent — chain unreachable */ }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const ageColor = metrics.checkpointAgeMs === null ? "rgba(180,160,140,0.4)"
    : metrics.checkpointAgeMs < 5_000 ? "#00ff96"
    : metrics.checkpointAgeMs < 15_000 ? "#ffcc00"
    : "#ff4444";

  const latColor = metrics.latencyMs === null ? "rgba(180,160,140,0.4)"
    : metrics.latencyMs < 400 ? "#00ff96"
    : metrics.latencyMs < 1000 ? "#ffcc00"
    : "#ff4444";

  const fmt = (n: number | null, suffix = "") =>
    n === null ? <span style={{ color: "rgba(180,160,140,0.3)" }}>—</span>
    : <span>{n.toLocaleString()}{suffix}</span>;

  const fmtAge = (ms: number | null) => {
    if (ms === null) return <span style={{ color: "rgba(180,160,140,0.3)" }}>—</span>;
    if (ms < 1000) return <span>{ms}ms ago</span>;
    return <span>{(ms / 1000).toFixed(1)}s ago</span>;
  };

  const dot = (color: string) => (
    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%",
      background: color, boxShadow: color !== "rgba(180,160,140,0.4)" ? `0 0 4px ${color}` : "none",
      marginRight: 4, verticalAlign: "middle" }} />
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "16px", flexWrap: "wrap",
      fontFamily: "IBM Plex Mono, monospace", fontSize: "8px",
      letterSpacing: "0.08em", color: "rgba(180,160,140,0.55)",
      padding: "5px 12px",
      borderTop: "1px solid rgba(255,71,0,0.08)",
      background: "rgba(3,2,1,0.4)",
    }}>
      <span title="Sui testnet chain">SUI TESTNET</span>
      <span title="Latest checkpoint sequence number">
        {dot(ageColor)}CP #{fmt(metrics.checkpoint)}
      </span>
      <span title="Time since last checkpoint" style={{ color: ageColor }}>
        {fmtAge(metrics.checkpointAgeMs)}
      </span>
      <span title="Current epoch">EPOCH {fmt(metrics.epoch)}</span>
      <span title="Active validators">{fmt(metrics.validators)} VALIDATORS</span>
      <span title="Reference gas price in MIST">GAS {fmt(metrics.gasPrice)} MIST</span>
      <span title="RPC round-trip latency" style={{ color: latColor }}>
        {metrics.latencyMs !== null ? `${metrics.latencyMs}ms` : "—"} RPC
      </span>
    </div>
  );
}

type Tab = "structures" | "inventory" | "tribe" | "defense" | "registry" | "map" | "bounties" | "srp" | "cargo" | "gates" | "succession" | "intel" | "announcements" | "recruiting" | "hierarchy" | "assets" | "calendar" | "wiki" | "fitting" | "query" | "keeper" | "dashboard" | "war" | "links" | "industry";

// ── Hash routing ───────────────────────────────────────────────────────────────
// Defined at module level so they are stable references (no re-creation per render).
const ROUTE_MAP: Record<string, Tab> = {
  "defense":       "defense",
  "storage":       "inventory",
  "inventory":     "inventory",
  "structures":    "structures",
  "dashboard":     "dashboard",
  "war":           "war",
  "links":         "links",
  "industry":      "industry",
  "bounties":      "bounties",
  "srp":           "srp",
  "cargo":         "cargo",
  "gates":         "gates",
  "tribe":         "tribe",
  "registry":      "registry",
  "intel":         "intel",
  "succession":    "succession",
  "wiki":          "wiki",
  "fitting":       "fitting",
  "map":           "map",
  "query":         "query",
  "announcements": "announcements",
  "recruiting":    "recruiting",
  "hierarchy":     "hierarchy",
  "assets":        "assets",
  "calendar":      "calendar",
  "keeper":        "keeper",
};

function getHashTab(): Tab | null {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase().trim();
  return ROUTE_MAP[hash] ?? null;
}

// ── Faucet button ─────────────────────────────────────────────────────────────
function FaucetButton({ address, compact }: { address: string; compact: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  const requestGas = async () => {
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("https://faucet.testnet.sui.io/v1/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FixedAmountRequest: { recipient: address } }),
      });
      if (res.ok) {
        setState("ok");
        setMsg("Gas sent!");
        setTimeout(() => { setState("idle"); setMsg(""); }, 4000);
      } else {
        const text = await res.text().catch(() => "");
        if (res.status === 429) {
          // Rate limited — fall back to web faucet so the button is always useful
          window.open(`https://faucet.sui.io/?network=testnet&address=${encodeURIComponent(address)}`, "_blank");
          setState("idle");
          setMsg("");
        } else {
          setState("err");
          setMsg(text.slice(0, 60) || `HTTP ${res.status}`);
          setTimeout(() => { setState("idle"); setMsg(""); }, 5000);
        }
      }
    } catch {
      // CORS or network error — fall back to opening the web faucet
      window.open(`https://faucet.sui.io/?network=testnet`, "_blank");
      setState("idle");
    }
  };

  const colors: Record<string, string> = {
    idle: "rgba(0,200,255,0.6)",
    loading: "rgba(255,200,0,0.7)",
    ok: "#00ff96",
    err: "#ff6b6b",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={requestGas}
        disabled={state === "loading"}
        title="Request testnet SUI gas — opens web faucet if rate limited"
        style={{
          padding: compact ? "4px 8px" : "5px 12px",
          fontSize: compact ? "8px" : "10px",
          fontWeight: 700,
          fontFamily: "inherit",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          background: "rgba(0,200,255,0.06)",
          border: `1px solid ${colors[state]}`,
          color: colors[state],
          cursor: state === "loading" ? "wait" : "pointer",
          transition: "all 0.15s",
        }}
      >
        {state === "loading" ? "⏳" : state === "ok" ? "✓ GAS" : "🚰 GAS"}
      </button>
      {msg && (
        <span style={{ fontSize: "9px", fontFamily: "monospace", color: colors[state] }}>
          {msg}
        </span>
      )}
    </div>
  );
}

function AppInner() {
  const [winWidth, setWinWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const compact = winWidth < 600;
  const { handleDisconnect, hasEveVault, isConnected } = useConnection();
  const account = useCurrentAccount();
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const { isVerified, isVerifying, verificationError } = useVerifiedAccountContext();
  const [lastDigest, setLastDigest] = useState<string | undefined>();
  const [connectError, setConnectError] = useState<string | undefined>();
  const PUBLIC_TABS = new Set<Tab>(["map", "wiki", "fitting", "query", "intel", "war", "industry"]);
  const [activeTab, setActiveTab] = useState<Tab>(() => getHashTab() ?? "war"); // default to war — visible without wallet
  const [briefOpen, setBriefOpen] = useState(true);
  const [kioskMode, setKioskMode] = useState<boolean>(() => getHashTab() !== null);
  // Dev env toggle — only shown in dev mode
  const isDev = import.meta.env.DEV;
  const [currentEnv, setCurrentEnv] = useState<ServerEnv>(getServerEnv());
  useEffect(() => onServerEnvChange(() => setCurrentEnv(getServerEnv())), []);

  const TAB_BRIEF: Record<Tab, { title: string; steps: string[] }> = {
    map: {
      title: "Interactive starmap — all 24 502 EVE Frontier solar systems",
      steps: [
        "Scroll to zoom in and out",
        "Drag to pan across the galaxy",
        "Hover over any dot to see the system name",
        "Dots are colour-coded by region",
        "Hit ⊡ Fit to reset the view",
      ],
    },
    dashboard: {
      title: "Structure topology — your nodes, attached structures, and energy grid",
      steps: [
        "Connect EVE Vault — your wallet address must own the structures",
        "Systems view shows all solar systems where you have deployed structures",
        "Drill in to see Network Nodes and the structures attached to each node",
        "Bring Online / Take Offline with a single click — direct on-chain tx",
        "Batch Online brings up all affordable structures within the node's energy budget",
        "Rename any structure with the ✎ button — writes on-chain metadata",
        "Apply Tribe Policy delegates turret or gate control to your tribe's defense settings",
      ],
    },
    structures: {
      title: "Structure Panel — manage all your deployed structures",
      steps: [
        "Connect EVE Vault — your wallet address must own the structures",
        "Structures are grouped by solar system",
        "Bring All Online sends a single batched transaction within energy limits",
        "Rename any structure with the ✎ button — writes on-chain",
        "Turrets: Apply Tribe Policy to delegate defense targeting to your tribe policy",
        "Gates: Apply Tribe Policy to enforce your tribe's access control rules",
      ],
    },
    inventory: {
      title: "SSU inventory browser — view items across your storage units (withdraw disabled)",
      steps: [
        "All your online and offline SSUs shown",
        "Items resolved to names via World API",
        "Quantities summed across all inventory slots",
      ],
    },
    tribe: {
      title: "Tribe Vault — launch and manage your tribe's on-chain economy",
      steps: [
        "Connect EVE Vault — your tribe ID is read from your character on-chain",
        "Launch a tribe token by setting a name and symbol — backed by EVE",
        "Deposit EVE into your vault to collateralise the tribe economy",
        "Issue tribe tokens to members as contribution rewards (founder only)",
        "Activity log shows all issuance events on-chain",
      ],
    },
    defense: {
      title: "Defense & Turret Policy — control who your turrets target",
      steps: [
        "Founder: create a defense policy for your tribe vault",
        "Set security relations: mark tribes as GREEN (safe), YELLOW (caution), or RED (hostile)",
        "Add specific character IDs to the hostile override list for KOS targeting",
        "Same-tribe pilots are always safe by default — overrides only apply to outsiders",
        "Members: apply your tribe's policy to your own turrets from this tab",
        "Passage events from your turrets are logged on-chain and shown here",
      ],
    },
    registry: {
      title: "Contest tribe ownership — challenge and claim vaults with proof",
      steps: [
        "Register a claim for your tribe ID before creating a vault",
        "Claims are epoch-stamped — first on-chain claim wins",
        "Attestor can verify and issue earlier-epoch proofs to legitimate founders",
        "Challenge + Take Vault is atomic — claim and ownership transfer in one tx",
        "Attestor can invalidate fraudulent claims",
      ],
    },
    bounties: {
      title: "Post kill bounties backed by EVE escrow",
      steps: [
        "Set a target by EVE character ID and escrow EVE as reward",
        "On-chain killmails verify kills automatically — no trusted attestor required",
        "Claim a bounty by presenting a matching killmail object from the Sui chain",
        "Poster or anyone can cancel an expired bounty to reclaim EVE",
      ],
    },
    srp: {
      title: "Ship Reimbursement Plans and Combat Insurance",
      steps: [
        "Sponsor funds an SRP pool with EVE — tribal ops or personal coverage",
        "Pilot loses a ship in-game — Killmail object is created on-chain",
        "Submit your Killmail object ID as proof of loss to claim reimbursement",
        "Sponsor has a dispute window to verify the Killmail via GraphQL",
        "After the dispute window: anyone can finalize — EVE pays out automatically",
        "Sponsor can top up the pool or drain it when the op is over",
      ],
    },
    cargo: {
      title: "Trustless cargo delivery contracts with EVE escrow",
      steps: [
        "Post a delivery contract — describe cargo, set destination, escrow EVE",
        "Leave carrier blank for open contracts, or specify an address",
        "Carrier accepts and transits — attestor confirms delivery to release reward",
        "Shipper can cancel open contracts; carrier can dispute missed deadlines",
      ],
    },
    gates: {
      title: "Publish your tribe gate policy for others to discover",
      steps: [
        "Create a gate profile declaring your access policy and toll",
        "Policies: Open, Tribe Only, Whitelist, or Closed",
        "Add tribe IDs to your whitelist for selective access",
        "Browse all tribes' gate profiles in the discovery feed",
      ],
    },
    succession: {
      title: "Will & Testament — secure tribe leadership succession with time-locked deeds",
      steps: [
        "Create a testament naming your heir and an inactivity timeout",
        "Check in periodically to keep the deed locked",
        "If you go inactive beyond the timeout, your heir can execute succession",
        "Revoke the deed at any time while you are active",
      ],
    },
    intel: {
      title: "Intelligence — on-chain kill feed, infrastructure map, security heatmap",
      steps: [
        "Kill Feed: all on-chain killmails — filter by SHIP or STRUCTURE, search by name or system",
        "Infrastructure: structure distribution, node density, and location intel from chain events",
        "Security: activity heatmaps by system and hour — identify hot zones and patrol gaps",
        "Data is pulled live from Sui — no third-party indexer required",
      ],
    },
    announcements: {
      title: "Announcements — tribe broadcast board (coming soon)",
      steps: [
        "Founder creates an announcement board linked to the tribe vault",
        "Post, edit, pin, and delete announcements on-chain",
        "Pinned posts appear at the top of the feed",
        "Members see a read-only feed of all tribe announcements",
      ],
    },
    recruiting: {
      title: "Open recruiting terminal — find and evaluate new members",
      steps: [
        "Founder creates a recruiting terminal and sets requirements",
        "Toggle the terminal open or closed to control applications",
        "Applicants submit name, message, and infra count",
        "Founder reviews and accepts or rejects each application",
      ],
    },
    hierarchy: {
      title: "Tribe structure — members, infrastructure, and activity",
      steps: [
        "Overview shows your tribe token, founder, and infra count",
        "Member roster shows all holders with on-chain balances and pilot names",
        "Infrastructure shows all registered structures and energy credits",
        "Founder can transfer leadership from this tab",
        "Not in a tribe? Use the Tribe Explorer to look up any tribe by vault ID",
      ],
    },
    assets: {
      title: "Tribe asset ledger — infra, token supply, treasury, DEX",
      steps: [
        "Registered infra and energy credits form your EVE collateral basis",
        "Token supply shows total tribe tokens in circulation and last DEX price",
        "Treasury shows EVE reserves and deposit/withdraw history",
        "DEX section shows pool depth, current price, and recent trades",
      ],
    },
    calendar: {
      title: "Community event calendar — schedule and track tribe operations",
      steps: [
        "Hackathon schedule is built-in and visible to everyone",
        "Custom events save locally per tribe vault",
        "Add events with type, date, and description",
        "Calendar grid highlights days with scheduled events",
        "Use the Announcements tab to broadcast events to tribe members",
      ],
    },
    wiki: {
      title: "Community lore wiki — on-chain knowledge base for EVE Frontier",
      steps: [
        "Browse articles by category: Lore, Mechanics, Locations, Factions, Ships, History",
        "Search articles by title or content",
        "Any connected wallet can publish an article",
        "Articles are stored on-chain — permanent, permissionless, uncensorable",
      ],
    },
    fitting: {
      title: "Ship Fitting — EVE-style fitting tool with real module stats",
      steps: [
        "Select a ship and fit modules into HIGH, MID, and LOW slots",
        "Real CPU/PG fitting pressure shown — overfitted loadouts are flagged",
        "Damage profile shows DPS breakdown by module and ammo type",
        "Jump range calculator: configure fuel load, cargo mass, and calibration level",
        "Fleet comparison table shows all ships side by side with jump range and fuel cost",
      ],
    },
    query: {
      title: "Chain Query — search characters and tribes by name",
      steps: [
        "Switch between Character and Tribe mode",
        "Type a name, ticker, or wallet address to search",
        "Click any result to see full on-chain and World API details",
        "Character view shows tribe membership, CradleOS vault, and wallet address",
        "Tribe view shows all on-chain members, token info, and description",
      ],
    },
    keeper: {
      title: "Keeper — ancient intelligence beyond known space",
      steps: [
        "Ask about the world chain, structures, blueprints, tribal economies",
        "The Keeper perceives your wallet, tribe, and on-chain state",
        "Your data stays on Sui — the Keeper reads only what the lattice reveals",
      ],
    },
    war: {
      title: "The Genesis War — live territory control",
      steps: [
        "Live countdown to next tick (60-minute intervals on live chain)",
        "Scoreboard tracks control points per tribe in real time from on-chain data",
        "Contest a system by deploying the required Assembly type shown on each system card",
        "Commitment ledger shows every on-chain tick result with snapshot hashes",
        "Data sourced directly from lineagewar.xyz verifier — refreshes every 30 seconds",
      ],
    },
    links: {
      title: "Structure Links — attach services to your infrastructure",
      steps: [
        "Select any of your deployed structures to attach a CradleOS service",
        "Links are stored on-chain in the structure's metadata URL field",
        "Linked services are visible to anyone who queries the structure",
        "Detach at any time — no cooldown, just a transaction",
        "Some attachments unlock additional capabilities",
      ],
    },
    industry: {
      title: "Industry — supply chain calculator for EVE Frontier manufacturing",
      steps: [
        "Search for any buildable item by name, category, or group",
        "Set quantity to scale all material requirements",
        "Expand the supply chain tree to see every intermediate product",
        "⚙ = intermediate item (craftable), 🪨 = raw material (mine/buy)",
        "Raw Materials card aggregates your full shopping list",
        "Time Summary shows total manufacturing time per level",
      ],
    },
  };

  const brief = TAB_BRIEF[activeTab];

  // Sync tab → hash and handle browser back/forward
  useEffect(() => {
    const reverseMap: Record<Tab, string> = {
      defense: "defense", inventory: "storage", structures: "structures",
      dashboard: "dashboard",
      bounties: "bounties", srp: "srp", cargo: "cargo", gates: "gates",
      tribe: "tribe", registry: "registry", intel: "intel",
      succession: "succession", wiki: "wiki", fitting: "fitting",
      map: "map", query: "query", announcements: "announcements",
      recruiting: "recruiting", hierarchy: "hierarchy", assets: "assets",
      calendar: "calendar", keeper: "keeper", war: "war", links: "links", industry: "industry",
    };
    const slug = reverseMap[activeTab] ?? activeTab;
    // Only push hash if we're in kiosk mode or if a hash is already present
    if (kioskMode || window.location.hash) {
      window.location.hash = `/${slug}`;
    }
  }, [activeTab, kioskMode]);

  useEffect(() => {
    const onHashChange = () => {
      const tab = getHashTab();
      if (tab) {
        setActiveTab(tab);
        setKioskMode(true);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setBriefOpen(true);
  }, []);


  const handleConnect = async () => {
    const wallet = wallets.find(w => w.name.includes("Eve Vault")) || wallets[0];
    if (!wallet) { setConnectError("No wallet found"); return; }
    setConnectError(undefined);
    try {
      await dAppKit.connectWallet({ wallet });
    } catch (err: any) {
      console.error("[CradleOS] connect error:", err);
      setConnectError(err?.message || String(err));
    }
  };

  return (
    <main className="app-shell">
      {/* ── Topbar: era/cycle left, wallet right ── */}
      {!kioskMode && <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: compact ? "4px 10px" : "6px 20px",
        background: "rgba(3,2,1,0.92)",
        borderBottom: "1px solid rgba(255,71,0,0.15)",
        flexWrap: "wrap", gap: "6px",
      }}>
        {/* Era / Cycle */}
        <div style={{ display: "flex", gap: compact ? "8px" : "16px", alignItems: "center" }}>
          <span style={{ fontSize: compact ? "7px" : "9px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,71,0,0.8)" }}>ERA 6: AWAKENING</span>
          <span style={{ fontSize: compact ? "7px" : "9px", fontFamily: "monospace", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(180,160,140,0.45)" }}>CYCLE 5: SHROUD OF FEAR</span>
          <ServerStatusDots compact={compact} />
          {import.meta.env.DEV && <span style={{ fontSize: "7px", fontFamily: "monospace", color: "#00ff96", border: "1px solid rgba(0,255,150,0.25)", padding: "0 4px" }}>DEV</span>}
        </div>
        {/* Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {connectError && (
            <span style={{ fontSize:"10px", color:"#ff6b6b", fontFamily:"monospace" }}>
              ERR: {connectError.slice(0,40)}
            </span>
          )}
          <div style={{
            border: "1px solid rgba(255,71,0,0.25)", borderRadius: "0",
            padding: "6px 12px", fontSize: "11px", fontFamily: "inherit",
            color: account ? "#FF4700" : "rgba(107,107,94,0.7)", letterSpacing: "0.08em",
            fontWeight: 700, background: "#111111",
            textTransform: "uppercase",
          }}>
            {account ? abbreviateAddress(account.address) : "NO WALLET"}
          </div>
          {/* Testnet faucet button */}
          {account && <FaucetButton address={account.address} compact={compact} />}
          {/* Identity verification badge */}
          {account && (
            isVerifying ? (
              <div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "monospace", letterSpacing: "0.08em", border: "1px solid rgba(167,139,250,0.3)", padding: "3px 8px", background: "rgba(167,139,250,0.06)" }}>
                VERIFYING…
              </div>
            ) : isVerified ? (
              <div style={{ fontSize: 10, color: "#00ff96", fontFamily: "monospace", letterSpacing: "0.08em", border: "1px solid rgba(0,255,150,0.3)", padding: "3px 8px", background: "rgba(0,255,150,0.06)" }}>
                ✓ VERIFIED
              </div>
            ) : (
              <div style={{ fontSize: 10, color: "#FF4700", fontFamily: "monospace", letterSpacing: "0.08em", border: "1px solid rgba(255,71,0,0.3)", padding: "3px 8px", background: "rgba(255,71,0,0.06)" }}
                title={verificationError && verificationError !== "declined" ? verificationError : undefined}>
                CONNECTED
              </div>
            )
          )}
          {!hasEveVault && !isConnected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end" }}>
              <div style={{ fontSize: "10px", color: "#FF4700", letterSpacing: "0.12em", fontWeight:700, textTransform:"uppercase" }}>⚠ EVE VAULT NOT DETECTED</div>
              <a
                href="https://github.com/evefrontier/evevault/releases/download/v0.0.6/eve-vault-chrome.zip"
                target="_blank" rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  padding: "7px 14px", borderRadius: "0", fontSize: "11px", fontWeight: 700,
                  background: "rgba(5,3,2,0.88)", border: "1px solid rgba(255,71,0,0.5)",
                  color: "#FF4700", textDecoration: "none", letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >⬇ Install EVE Vault v0.0.6</a>
            </div>
          ) : (
            <button className="accent-button" style={{ padding: "7px 18px", fontSize: "12px" }}
              onClick={() => (isConnected ? handleDisconnect() : handleConnect())}>
              {isConnected ? "Disconnect" : "Connect EVE Vault"}
            </button>
          )}
        </div>
      </div>}

      {/* ── Title panel ── */}
      {!kioskMode && <header className="hud-panel" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", position: "relative", padding: compact ? "10px 12px 8px" : "22px 24px 18px",
        marginBottom: "0",
        background: "rgba(5,3,2,0.88)",
        borderColor: "rgba(255,71,0,0.3)",
        borderBottom: "2px solid #FF4700",
        boxShadow: "0 4px 40px rgba(255,71,0,0.08)",
      }}>
        <div style={{ maxWidth: "600px" }}>
          <p style={{
            fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(107,107,94,0.8)", marginBottom: "14px", fontFamily: "inherit",
            fontWeight: 400,
          }}>
            EVE FRONTIER &nbsp;·&nbsp; SUI TESTNET &nbsp;·&nbsp; HACKATHON 2026
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"20px", margin:"0 0 14px" }}>
            <img src="cradleos-logo.png" alt="CradleOS"
              style={{ height:"clamp(56px,7vw,88px)", width:"auto", imageRendering:"auto", filter:"drop-shadow(0 0 18px rgba(255,71,0,0.7)) drop-shadow(0 0 6px rgba(255,71,0,0.4))" }} />
            <h1 style={{
              fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 800, letterSpacing: "0.06em",
              color: "#FF4700", margin: 0,
            }}>
              C<span style={{ textTransform: "lowercase", letterSpacing: "0.04em" }}>radle</span>OS <span style={{ fontSize: "0.4em", verticalAlign: "super", opacity: 0.6, letterSpacing: "0.08em" }}>v2</span>
            </h1>
            <button
              onClick={() => window.location.reload()}
              title="Reload"
              style={{
                position: "absolute", top: 8, right: 10,
                background: "none", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.35)", fontSize: "13px", padding: "3px 8px",
                cursor: "pointer", borderRadius: "2px", fontFamily: "monospace",
              }}
            >↻</button>
          </div>
          <p style={{
            fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(107,107,94,0.65)", fontFamily: "inherit", margin: "0 0 4px", fontWeight: 400,
          }}>
            Tribe Economy &nbsp;·&nbsp; Defense &nbsp;·&nbsp; Intel &nbsp;·&nbsp; Bounties &nbsp;·&nbsp; Cargo
          </p>
          <p style={{
            fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(107,107,94,0.45)", fontFamily: "inherit", margin: "0 0 10px", fontWeight: 400,
          }}>
            Gates &nbsp;·&nbsp; Succession &nbsp;·&nbsp; Recruiting &nbsp;·&nbsp; Wiki &nbsp;·&nbsp; Ship Fitting &nbsp;·&nbsp; Starmap
          </p>
          {/* EVE FRONTIER wordmark — official launcher asset */}
          <img src="ef-wordmark.svg" alt="EVE FRONTIER"
            style={{ height: 20, width: "auto", opacity: 0.3 }} />
          <div style={{ marginTop: 10 }}>
            <ChainHealth />
          </div>
          {isDev && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>ENV</span>
              <div
                style={{
                  display: "flex", borderRadius: 0, overflow: "hidden",
                  border: "1px solid rgba(255,71,0,0.3)",
                }}
              >
                {(["stillness", "utopia"] as ServerEnv[]).map(env => (
                  <button
                    key={env}
                    onClick={() => {
                      if (import.meta.env.DEV) localStorage.setItem("cradleos_dev_env", env);
                      window.location.reload();
                    }}
                    style={{
                      padding: "3px 12px", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                      background: currentEnv === env ? "#FF4700" : "rgba(5,3,2,0.9)",
                      color: currentEnv === env ? "#000" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {env}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,71,0,0.4)" }}>⟳ reloads · active: {SERVER_ENV}</span>
            </div>
          )}
        </div>
      </header>}

      {/* Collapsible context brief */}
      {!kioskMode && <div style={{
        marginBottom: "12px",
        border: "1px solid rgba(255,71,0,0.15)",
        borderRadius: "2px",
        overflow: "hidden",
        background: "#101010",
      }}>
        <button
          onClick={() => setBriefOpen(o => !o)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
            color: briefOpen ? "#FF4700" : "rgba(107,107,94,0.5)",
          }}
        >
          <span style={{ fontSize: "11px", letterSpacing: "0.07em", fontWeight: 700 }}>
            {briefOpen ? "▾" : "▸"}&nbsp;&nbsp;{brief.title.toUpperCase()}
          </span>
          {lastDigest && !briefOpen && (
            <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#00ff96" }}>
              ✓ {lastDigest.slice(0, 10)}…
            </span>
          )}
        </button>
        {briefOpen && (
          <div style={{ padding: "4px 14px 12px 28px", borderTop: "1px solid rgba(255,71,0,0.08)" }}>
            <ol style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {brief.steps.map((s, i) => (
                <li key={i} style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px", lineHeight: 1.5 }}>{s}</li>
              ))}
            </ol>
            {lastDigest && (
              <div style={{ marginTop: "10px", fontSize: "11px", color: "#00ff96", fontFamily: "monospace" }}>
                ✓ Last tx: {lastDigest}
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Main nav tabs — CCP design system: sharp, uppercase, red active indicator */}
      {!kioskMode && <div style={{
        display: "flex", flexWrap: "wrap", gap: "0", marginBottom: "20px",
        borderBottom: "1px solid rgba(255,71,0,0.2)",
        background: "transparent",
      }}>
        {(["war", "dashboard", "inventory", "tribe", "defense", "bounties", "srp", "cargo", "gates", "succession", "intel", "recruiting", "hierarchy", "assets", "calendar", "wiki", "fitting", "map", "query", "industry"] as Tab[]).filter(tab => {
          // Public tabs visible without a wallet
          const PUBLIC_TABS = new Set(["map", "wiki", "fitting", "query", "intel", "war", "industry"]);
          return account || PUBLIC_TABS.has(tab);
        }).map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                padding: compact ? "5px 7px 6px" : "10px 14px 11px",
                border: "none",
                borderBottom: active ? "2px solid #FF4700" : "2px solid transparent",
                borderRight: "1px solid rgba(255,71,0,0.1)",
                background: active ? "rgba(20,12,6,0.92)" : "rgba(8,5,2,0.60)",
                color: active ? "#FF4700" : "rgba(160,150,130,0.7)",
                cursor: "pointer",
                fontSize: compact ? "8px" : "11px",
                fontWeight: 700,
                letterSpacing: compact ? "0.06em" : "0.14em",
                textTransform: "uppercase",
                transition: "color 0.1s, background 0.1s, border-color 0.1s",
                marginBottom: "-1px",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,71,0,0.8)"; (e.currentTarget as HTMLButtonElement).style.background = "#151515"; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = "rgba(160,150,130,0.7)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,5,2,0.60)"; } }}
            >
              {compact
                ? (tab === "structures" ? "Structs"
                  : tab === "inventory"  ? "Inv"
                  : tab === "tribe"      ? "Tribe"
                  : tab === "defense"    ? "Defense"
                  : tab === "registry"   ? "Contest"
                  : tab === "bounties"   ? "Bounties"
                  : tab === "srp"        ? "SRP"
                  : tab === "cargo"      ? "Cargo"
                  : tab === "gates"      ? "Gates"
                  : tab === "succession" ? "Succsn"
                  : tab === "intel"      ? "Intel"
                  : tab === "announcements" ? "News"
                  : tab === "recruiting" ? "Recruit"
                  : tab === "hierarchy"  ? "Roles"
                  : tab === "assets"     ? "Assets"
                  : tab === "calendar"   ? "Cal"
                  : tab === "wiki"       ? "Wiki"
                  : tab === "fitting"    ? "Fitting"
                  : tab === "query"      ? "Query"
                  : tab === "links"      ? "🔗"
                  : tab === "war"        ? "⚔"
                  : tab === "keeper"     ? "◆"
                  : tab === "industry"  ? "Industry"
                  :                       "Map")
                : (tab === "structures" ? "Structures"
                  : tab === "inventory"  ? "Inventory"
                  : tab === "tribe"      ? "Tribe Vault"
                  : tab === "defense"    ? "Defense"
                  : tab === "registry"   ? "Contest"
                  : tab === "bounties"   ? "Bounties"
                  : tab === "srp"        ? "Insurance & SRP"
                  : tab === "cargo"      ? "Cargo"
                  : tab === "gates"      ? "Gates"
                  : tab === "succession"    ? "Will & Testament"
                  : tab === "intel"         ? "Intel"
                  : tab === "recruiting"    ? "Recruiting"
                  : tab === "hierarchy"     ? "Hierarchy"
                  : tab === "assets"        ? "Assets"
                  : tab === "calendar"      ? "Calendar"
                  : tab === "wiki"          ? "Wiki"
                  : tab === "fitting"       ? "Ship Fitting"
                  : tab === "query"         ? "Query"
                  : tab === "links"         ? "🔗 Links"
                  : tab === "war"           ? "⚔ War"
                  : tab === "keeper"        ? "◆ Keeper"
                  : tab === "dashboard"     ? "Dashboard"
                  : tab === "industry"      ? "⚙ Industry"
                  :                          "Starmap")}
            </button>
          );
        })}
      </div>}

      <ServerMismatchBanner />

      {/* Wallet gate — show connect prompt for protected tabs without wallet */}
      {!account && !PUBLIC_TABS.has(activeTab) && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(107,107,94,0.6)" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⚓</div>
          <div style={{ fontSize: 14, color: "rgba(200,190,170,0.7)", marginBottom: 8 }}>Wallet required</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>Connect EVE Vault to access tribe features.</div>
          <button
            onClick={handleConnect}
            style={{ background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.4)", color: "#FF4700",
              borderRadius: 3, padding: "8px 20px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >Connect EVE Vault</button>
        </div>
      )}

      {(account || PUBLIC_TABS.has(activeTab)) && activeTab === "map" && (
        <div style={{ height: "75vh", minHeight: "480px", border: "1px solid rgba(255,71,0,0.12)", borderRadius: "0", overflow: "hidden" }}>
          <MapPanel />
        </div>
      )}
      {(account || PUBLIC_TABS.has(activeTab)) && activeTab !== "map" && (
        <div style={{ background: "transparent", padding: "0" }}>
          {activeTab === "structures" && <div style={{ background: "transparent" }} className="content-panel"><StructurePanel    onTxSuccess={setLastDigest} /></div>}
          {activeTab === "dashboard"  && <div style={{ background: "transparent" }} className="content-panel"><DashboardPanel onNavigate={(tab) => setActiveTab(tab as Tab)} /></div>}
          {activeTab === "inventory"  && <div style={{ background: "transparent" }} className="content-panel"><InventoryPanel /></div>}
          {activeTab === "tribe"      && <div style={{ background: "transparent" }} className="content-panel"><TribeVaultPanel   onTxSuccess={setLastDigest} /></div>}
          {activeTab === "defense"    && <div style={{ background: "transparent" }} className="content-panel"><TurretPolicyPanel /></div>}
          {activeTab === "registry"   && <div style={{ background: "transparent" }} className="content-panel"><RegistryPanel /></div>}
          {activeTab === "bounties"   && <div style={{ background: "transparent" }} className="content-panel"><BountyPanel /></div>}
          {activeTab === "srp"        && <div style={{ background: "transparent" }} className="content-panel"><SRPPanel /></div>}
          {activeTab === "cargo"      && <div style={{ background: "transparent" }} className="content-panel"><CargoContractPanel /></div>}
          {activeTab === "gates"      && <div style={{ background: "transparent" }} className="content-panel"><GatePolicyPanel /></div>}
          {activeTab === "succession"    && <div style={{ background: "transparent" }} className="content-panel"><InheritancePanel /></div>}
          {activeTab === "intel"         && <div style={{ background: "transparent" }} className="content-panel"><IntelDashboardPanel /></div>}
          {activeTab === "announcements" && <div style={{ background: "transparent" }} className="content-panel"><AnnouncementPanel /></div>}
          {activeTab === "recruiting"    && <div style={{ background: "transparent" }} className="content-panel"><RecruitingPanel /></div>}
          {activeTab === "hierarchy"     && <div style={{ background: "transparent" }} className="content-panel"><TribeHierarchyPanel /></div>}
          {activeTab === "assets"        && <div style={{ background: "transparent" }} className="content-panel"><AssetLedgerPanel /></div>}
          {activeTab === "calendar"      && <div style={{ background: "transparent" }} className="content-panel"><EventCalendarPanel /></div>}
          {activeTab === "wiki"          && <div style={{ background: "transparent", height: "calc(100vh - 260px)", minHeight: 500, display: "flex", flexDirection: "column" }}><LoreWikiPanel /></div>}
          {activeTab === "fitting"       && <div style={{ background: "transparent" }} className="content-panel"><ShipFittingPanel /></div>}
          {activeTab === "query"         && <div style={{ background: "transparent" }} className="content-panel"><QueryPanel /></div>}
          {activeTab === "keeper"        && <div style={{ background: "transparent" }} className="content-panel"><KeeperPanel /></div>}
          {activeTab === "war"           && <div style={{ background: "transparent" }} className="content-panel"><LineageWarPanel /></div>}
          {activeTab === "links"         && <div style={{ background: "transparent" }} className="content-panel"><LinksPanel /></div>}
          {activeTab === "industry"      && <div style={{ background: "transparent" }} className="content-panel"><IndustryPanel /></div>}
        </div>
      )}
      {/* Hidden upgrade panel — access via #upgrade */}
      {window.location.hash === "#upgrade" && <UpgradePanel />}
      {/* DEV-only role toggle bar — fixed bottom bar, production builds strip this */}
      <DevRoleToggle />
    </main>
  );
}

function App() {
  return (
    <DevModeProvider>
      <VerifiedAccountProvider>
        <AppInner />
      </VerifiedAccountProvider>
    </DevModeProvider>
  );
}

export default App;
