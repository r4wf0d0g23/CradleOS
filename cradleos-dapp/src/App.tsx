import { useState, useCallback, useEffect } from "react";
import { PlaygroundHarness } from "./playground/PlaygroundHarness";
import { abbreviateAddress, useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useWallets, useDAppKit } from "@mysten/dapp-kit-react";
import { VerifiedAccountProvider, useVerifiedAccountContext } from "./contexts/VerifiedAccountContext";
import { DevModeProvider, DevRoleToggle } from "./contexts/DevModeContext";
import { ServerMismatchBanner } from "./components/ServerMismatchBanner";
import { WipeCountdownBanner } from "./components/WipeCountdownBanner";
import { GameDataPanel } from "./components/GameDataPanel";
import MAUFooterPill from "./components/MAUFooterPill";
import { StructurePanel } from "./components/StructurePanel";
import { TribeVaultPanel } from "./components/TribeVaultPanel";
import { TurretPolicyPanel } from "./components/TurretPolicyPanel";
import { RegistryPanel } from "./components/RegistryPanel";
import { MapPanel } from "./components/MapPanel";
import { EFMapPanel } from "./components/EFMapPanel";
import { CommunityDappsPanel } from "./components/CommunityDappsPanel";
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
// LinksPanel removed — kiosk link controls merged into StructurePanel
import { IndustryPanel } from "./components/IndustryPanel";
import KeeperOrb from "./components/KeeperOrb";
import { FlappyFrontierPanel } from "./components/FlappyFrontierPanel";
import { VotingPanel } from "./components/VotingPanel";
import { KeeperCipherPanel } from "./components/keeperCipher/KeeperCipherPanel";
import { CasinoPanel } from "./components/CasinoPanel";
import { getServerEnv, onServerEnvChange, SERVER_ENV, SUI_TESTNET_RPC, type ServerEnv } from "./constants";
import { isMuted, toggleMuted } from "./lib/sound";

// ── Server status dots ────────────────────────────────────────────────────────
const SERVERS = [
  { label: "STILLNESS", url: "https://world-api-stillness.live.pub.evefrontier.com/v2/tribes?limit=1" },
  // 2026-07-08: Utopia disabled per Raw — not in use for the foreseeable future.
  // Its UAT world-api DNS is also dead (ERR_NAME_NOT_RESOLVED), so the ping only
  // produced console noise. Re-add when Utopia returns:
  // { label: "UTOPIA",    url: "https://world-api-utopia.uat.pub.evefrontier.com/v2/tribes?limit=1"    },
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
    const RPC = SUI_TESTNET_RPC;
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
      <PrivateNodeStatus />
    </div>
  );
}

// ── Private Node Status ──────────────────────────────────────────────────────
// Two-tier visibility on the status of the DGX2-hosted Sui fullnode:
//
//   PUBLIC TIER — tiny 4px dot, no label, no tooltip. Renders only when the
//   node is reachable + enabled. Color encodes health (green=caught up,
//   yellow=syncing close, blue=syncing far). Random visitors don't notice;
//   the maintainer (Raw) recognizes the color instantly.
//
//   MAINTAINER TIER — full PRIVATE NODE [dot] CAUGHT UP / syncing badge with
//   hover tooltip showing local + public checkpoints, gap, latency. Also
//   renders failure states (STATUS UNREACHABLE / OFFLINE) so Raw can see
//   degraded infra at a glance without checking SSH. Gated by:
//     1. Connected wallet matches MAINTAINER_WALLET, or
//     2. localStorage.cradleos_show_node_telemetry === "true"
//
// Polls `/sui-status` on the Cloudflare-fronted sui-proxy every 30s.

interface PrivateNodeStatusValue {
  privateNode: { enabled: boolean; checkpoint: number | null; latencyMs: number | null; url?: string };
  publicNode: { checkpoint: number | null };
  gap: number | null;
  syncing: boolean | null;
  caughtUp: boolean | null;
  ts: number;
}

// Hardcoded maintainer wallet (Raw's Stillness zkLogin address). Single
// hardcoded address is fine for the inconspicuous-telemetry use case; if
// we need multi-maintainer support later, lift to a Set.
const MAINTAINER_WALLET = "0x33559741bbc3d4d0c2b8c06f9caf59ec1007e53aa9dc8500f7ed63aa0ad5ce4f";

function isMaintainer(walletAddress: string | null | undefined): boolean {
  if (walletAddress && walletAddress.toLowerCase() === MAINTAINER_WALLET.toLowerCase()) return true;
  // Fallback: set localStorage.cradleos_show_node_telemetry = "true" on any
  // device Raw uses to see the full badge without connecting first.
  try {
    if (typeof localStorage !== "undefined" &&
        localStorage.getItem("cradleos_show_node_telemetry") === "true") return true;
  } catch {
    // localStorage unavailable (some sandboxed iframes) — silently fall through
  }
  return false;
}

function PrivateNodeStatus() {
  const account = useCurrentAccount();
  const [status, setStatus] = useState<PrivateNodeStatusValue | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const STATUS_URL = "https://keeper.reapers.shop/sui-status";
    const load = async () => {
      try {
        const r = await fetch(STATUS_URL, { method: "GET", cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const v = (await r.json()) as PrivateNodeStatusValue;
        if (cancelled) return;
        setStatus(v);
        setUnreachable(false);
      } catch {
        if (cancelled) return;
        setUnreachable(true);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const maintainer = isMaintainer(account?.address);

  // ── PUBLIC TIER ───────────────────────────────────────────────────────────
  // Tiny inconspicuous dot, no label, no tooltip. Random visitors don't notice
  // it; Raw recognizes the color instantly.
  if (!maintainer) {
    if (unreachable || !status || !status.privateNode.enabled) return null;
    let publicColor: string;
    if (status.caughtUp === true) publicColor = "#00ff96";
    else if (status.syncing === true && status.gap !== null && status.gap < 1000) publicColor = "#ffcc00";
    else publicColor = "#5599ff";
    return (
      <span
        style={{
          display: "inline-block", width: 4, height: 4, borderRadius: "50%",
          background: publicColor,
          opacity: 0.55,
          verticalAlign: "middle",
        }}
      />
    );
  }

  // ── MAINTAINER TIER ──────────────────────────────────────────────────────
  // Full badge with hover tooltip showing checkpoint numbers, gap, latency.
  // Renders even on failure states (unreachable / OFFLINE) so Raw can see at a
  // glance when infra is degraded without checking SSH.
  if (unreachable) {
    return (
      <span
        title={"Sui status endpoint unreachable\n\n/sui-status returned an error or timed out.\nDGX1 sui-proxy may be down."}
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        <span style={{ color: "rgba(180,160,140,0.45)" }}>PRIVATE NODE</span>
        <span
          style={{
            display: "inline-block", width: 5, height: 5, borderRadius: "50%",
            background: "#ff4040",
            boxShadow: "0 0 4px #ff4040",
            verticalAlign: "middle",
          }}
        />
        <span style={{ color: "#ff4040" }}>STATUS UNREACHABLE</span>
      </span>
    );
  }
  if (!status) return null;

  const gap = status.gap;
  const caughtUp = status.caughtUp === true;
  const syncing = status.syncing === true;
  const enabled = status.privateNode.enabled;

  let color: string;
  let label: string;
  if (!enabled) {
    color = "#ff4040";
    label = "OFFLINE";
  } else if (caughtUp) {
    color = "#00ff96";
    label = "CAUGHT UP";
  } else if (syncing && gap !== null && gap < 1000) {
    color = "#ffcc00";
    label = `syncing (${gap.toLocaleString()})`;
  } else if (syncing && gap !== null) {
    color = "#5599ff";
    label = `syncing (gap ${gap.toLocaleString()})`;
  } else {
    color = "#5599ff";
    label = "syncing";
  }

  const lat = status.privateNode.latencyMs;
  const tooltipLines = [
    `Private node: ${enabled ? (caughtUp ? "caught up" : "syncing") : "OFFLINE"}`,
    gap !== null ? `Gap behind public testnet: ${gap.toLocaleString()} checkpoints` : null,
    status.privateNode.checkpoint !== null ? `Local checkpoint: ${status.privateNode.checkpoint.toLocaleString()}` : null,
    status.publicNode.checkpoint !== null ? `Public checkpoint: ${status.publicNode.checkpoint.toLocaleString()}` : null,
    lat !== null ? `Probe latency: ${lat}ms` : null,
    "",
    "DGX2 fullnode operated by Reality Anchor (CradleOS)",
    "",
    "[maintainer-only badge]",
  ].filter(Boolean).join("\n");

  return (
    <span
      title={tooltipLines}
      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      <span style={{ color: "rgba(180,160,140,0.45)" }}>PRIVATE NODE</span>
      <span
        style={{
          display: "inline-block", width: 5, height: 5, borderRadius: "50%",
          background: color,
          boxShadow: `0 0 4px ${color}`,
          verticalAlign: "middle",
        }}
      />
      <span style={{ color }}>{label}</span>
    </span>
  );
}

type Tab = "structures" | "inventory" | "tribe" | "defense" | "registry" | "map" | "efmap" | "dapps" | "bounties" | "srp" | "cargo" | "gates" | "succession" | "intel" | "announcements" | "recruiting" | "hierarchy" | "assets" | "calendar" | "wiki" | "fitting" | "query" | "keeper" | "cipher" | "dashboard" | "industry" | "flappy" | "voting" | "gamedata" | "casino";

// ── Hash routing ───────────────────────────────────────────────────────────────
// Defined at module level so they are stable references (no re-creation per render).
// 2026-06-08 panel slimming: routes for hidden panels (structures, registry,
// bounties, srp, cargo, succession, announcements, recruiting, hierarchy,
// assets, wiki, fitting, map, efmap, keeper, cipher, flappy) intentionally
// removed so old hash deep-links fall back to dashboard via getHashTab() null.
const ROUTE_MAP: Record<string, Tab> = {
  "defense":       "defense",
  "storage":       "inventory",
  "inventory":     "inventory",
  "dashboard":     "dashboard",
  "industry":      "industry",
  "gates":         "gates",
  "tribe":         "tribe",
  "intel":         "intel",
  "dapps":         "dapps",
  "community":     "dapps",
  "apps":          "dapps",
  "query":         "query",
  "calendar":      "calendar",
  "voting":        "voting",
  "vote":          "voting",
  "elections":     "voting",
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
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  // 2026-06-08 panel slimming: removed map/efmap/wiki/fitting/cipher from public set
  // (panels hidden from nav). Remaining public tabs: dapps, query, intel, industry.
  const PUBLIC_TABS = new Set<Tab>(["dapps", "query", "intel", "industry"]);
  // Default landing tab:
  //   - hash override always wins (e.g. linked-from kiosk URL with #/cipher)
  //   - otherwise: dashboard for the user-facing landing page (wallet gate prompts to connect)
  //   - if no wallet at all on first paint, the wallet-gate UI in the panel area renders
  //     a clear "Connect EVE Vault" CTA, which is the correct first-touch experience
  const [activeTab, setActiveTab] = useState<Tab>(() => getHashTab() ?? "dashboard");
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
    efmap: {
      title: "EF-Map — embedded community starmap with Smart Gate routing",
      steps: [
        "3D star map of 24 000+ solar systems, powered by ef-map.com",
        "WASM Dijkstra route optimization across the galaxy",
        "Smart Gate routing combines ship jumps + player-deployed gates",
        "Canonical source for jump range, fuel quality, and temperature math",
        "Click ↗ OPEN FULL for the full ef-map.com UI in a new tab",
      ],
    },
    dapps: {
      title: "Community dApps — curated registry of player-built tools and apps",
      steps: [
        "Cards seeded from Fenris Creations' official Community Gallery",
        "Filter by tag (Governance, PvP, Smart Assemblies, Tools, …)",
        "Search by title, tagline, author, or tag",
        "Click any card to open the dApp in a new tab",
        "Submit new entries via the EVE Frontier Discord or the official Community Gallery",
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
    // links tab removed — merged into StructurePanel KIOSK section
    // war tab removed 2026-05-22 — LineageWar panel hidden pending refresh
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
    flappy: {
      title: "Flappy Frontier — dev only",
      steps: ["Navigate your ship through Smart Gates", "Click or Space to warp", "Don't die"],
    },
    cipher: {
      title: "Keeper Cipher — daily encrypted Keeper transmission with optional in-game expeditions",
      steps: [
        "A Keeper fragment is broadcast each UTC day, encoded as a substitution cipher",
        "Click any glyph, then assign a letter; free hints are pre-filled",
        "Decoded text updates live; solve = unlock the transcript",
        "Some fragments carry an EXPEDITION ORDER — the Keeper picks a real solar system",
        "Travel there in EVE Frontier and anchor a Network Node to complete the mission",
        "Verification scans on-chain LocationRevealedEvents — no extra contracts required",
        "Daily seed combines UTC date + latest killmail tx digest — same puzzle for everyone",
      ],
    },
    voting: {
      title: "Elections — generic, plug-in, reproducible on-chain voting",
      steps: [
        "Browse Active elections you might be eligible to vote in",
        "Open the Create wizard — pick eligibility / weight / method / privacy / gas",
        "All 5 eligibility sources, all 6 methods, all 5 weight modes, all privacy modes are exposed (versatility is the product)",
        "Cast a ballot — PTB chains eligibility-proof + weight-proof + cast in one tx",
        "After close: anyone can compute_tally; results page re-runs the tally locally to verify the chain",
        "Sponsored gas is default — voters pay zero when creators sponsor (Enoki relayer)",
      ],
    },
    gamedata: {
      title: "Game Data — viewport of extracted Sanctuary client static data",
      steps: [
        "Catalogue: curated typeID groups (structures, turrets, shells, refuge, ecosystem dungeons) read straight from the Sanctuary build",
        "Strings: searchable index of ~217k human-readable game strings (typeID + display name)",
        "Cycle Deltas: every new and rotated staticdata file vs Cycle 5 / Stillness 0.5.1",
        "Event Types: canonical event-type table the on-chain world emits",
        "3D Preview: roadmap slot — carbonengine/mesh WASM port plus three.js will land ship/structure hulls here",
      ],
    },
    casino: {
      title: "Cradle Casino — provably-fair Blackjack, settled in $EVE on-chain",
      steps: [
        "Every hand is one atomic transaction using Sui's on-chain randomness (0x8)",
        "Set your bet in $EVE and your stand-on threshold; the house edge for each threshold is MEASURED, not invented",
        "Shuffle, deal, and settlement all resolve together — no re-rolling a loss, no house cheating",
        "Blackjack pays 3:2; wins pay even money; ties push",
        "The provably-fair feed shows every recent hand — verifiable on-chain",
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
      map: "map", efmap: "efmap", dapps: "dapps", query: "query", announcements: "announcements",
      recruiting: "recruiting", hierarchy: "hierarchy", assets: "assets",
      calendar: "calendar", keeper: "keeper", cipher: "cipher", industry: "industry", flappy: "flappy", gamedata: "gamedata", casino: "casino",
      voting: "voting",
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
      {/* ── Kiosk-mode navigation bar ──
          When the dApp is opened from an in-game structure URL (e.g.
          #/defense, #/gates, #/tribe), the full chrome (topbar, title,
          tab nav) is hidden so the panel fills the in-game iframe.
          Without navigation, kiosk users were trapped on whatever page
          the in-game URL pointed at and had no way to reach other
          CradleOS panels.

          This bar provides full cross-kiosk navigation:
            - "← Dashboard" pill on the left (one-tap return to home),
              hidden when already on dashboard.
            - Horizontally scrollable tab strip with all kiosk-reachable
              tabs. Active tab gets the accent border and color. Strip
              scrolls horizontally on narrow iframes; no row break so
              the bar stays slim.
            - Public tabs visible without a wallet (PUBLIC_TABS); gated
              tabs hidden until the user connects a wallet, matching
              the desktop tab strip behavior.
          Tab order matches the desktop tab strip so the mental model
          carries over from main app to kiosk view. */}
      {kioskMode && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "rgba(5,3,2,0.94)",
          borderBottom: "1px solid rgba(255,71,0,0.28)",
          fontFamily: "monospace",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          {/* Back-to-dashboard pill (hidden on dashboard itself) */}
          {activeTab !== "dashboard" && (
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              title="Back to structure dashboard"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid rgba(255,71,0,0.5)",
                color: "#FF4700",
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ← Home
            </button>
          )}

          {/* Horizontally-scrolling tab strip */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              gap: 2,
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
            }}
            // Hide the scrollbar in webkit while keeping scroll. The thin
            // scrollbar above is for Firefox; the inline className-less
            // approach keeps this self-contained.
          >
            {((): Tab[] => {
              // 2026-06-08 panel slimming: focused tab set for pre-wipe push.
              // Hidden: structures, registry, bounties, srp, cargo, succession,
              // announcements, recruiting, hierarchy, assets, wiki, fitting,
              // map, efmap, keeper, cipher, flappy. Re-enable by adding back to
              // ORDER (and KIOSK_PUBLIC if it should work without a wallet).
              // "defense" temporarily removed 2026-06-24 — see comment on
              // the main tab strip above. Re-add when turrets return.
              // "gamedata" added 2026-06-24 (public tab, Sanctuary viewport).
              // 'industry' tab hidden 2026-06-27: extracted recipe/blueprint catalog
              // only covers ~57% of referenced type ids (43% render as 'Unknown'),
              // and the genBlueprints FSD blob hasn't been decoded into the simple
              // recipe form the panel expects — so the Supply Chain Calculator
              // produces misleading trees for most products. Will resurface once
              // the Sanctuary genBlueprints decode is finished and industry.json
              // is regenerated with full type-name coverage. Panel + data file
              // intentionally kept on disk for fast revival.
              const ORDER: Tab[] = [
                "casino",
                "dashboard", "inventory", "tribe",
                "gates", "intel", "calendar", "voting",
                "query", "gamedata", "dapps",
              ];
              const KIOSK_PUBLIC = new Set<Tab>([
                "dapps", "query", "intel", "gamedata",
              ]);
              return ORDER.filter(t => account || KIOSK_PUBLIC.has(t));
            })().map(tab => {
              const active = activeTab === tab;
              // Compact labels — monospace, all caps, brief.
              const label =
                tab === "dashboard"  ? "DASH"
                : tab === "inventory"  ? "INV"
                : tab === "tribe"      ? "TRIBE"
                : tab === "defense"    ? "DEFENSE"
                : tab === "bounties"   ? "BOUNTY"
                : tab === "srp"        ? "SRP"
                : tab === "cargo"      ? "CARGO"
                : tab === "gates"      ? "GATES"
                : tab === "succession" ? "WILL"
                : tab === "intel"      ? "INTEL"
                : tab === "recruiting" ? "RECRUIT"
                : tab === "hierarchy"  ? "ROLES"
                : tab === "assets"     ? "ASSETS"
                : tab === "calendar"   ? "CAL"
                : tab === "wiki"       ? "WIKI"
                : tab === "fitting"    ? "FIT"
                : tab === "map"        ? "MAP"
                : tab === "efmap"      ? "EF-MAP"
                : tab === "dapps"      ? "DAPPS"
                : tab === "query"      ? "QUERY"
                : tab === "industry"   ? "IND"
                : tab === "gamedata"   ? "GAMEDATA"
                : tab === "cipher"     ? "CIPHER"
                : tab === "voting"     ? "VOTE"
                : tab === "casino"     ? "CASINO"
                : tab.toUpperCase();
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  title={`Go to ${label}`}
                  style={{
                    flexShrink: 0,
                    background: active ? "rgba(255,71,0,0.15)" : "transparent",
                    border: active
                      ? "1px solid rgba(255,71,0,0.7)"
                      : "1px solid rgba(255,71,0,0.18)",
                    color: active ? "#FF4700" : "rgba(250,250,229,0.72)",
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <span style={{ fontSize: compact ? "7px" : "9px", fontFamily: "monospace", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(180,160,140,0.45)" }}>CYCLE 6: SANCTUARY</span>
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
          {/* Sound mute toggle */}
          <button
            onClick={() => setMutedState(toggleMuted())}
            title={muted ? "Sound muted — click to unmute" : "Sound on — click to mute"}
            style={{
              background: "transparent", border: "1px solid rgba(255,71,0,0.25)", borderRadius: 0,
              padding: "4px 8px", fontSize: "11px", fontFamily: "inherit", cursor: "pointer",
              color: muted ? "rgba(175,175,155,0.55)" : "#FF4700",
              letterSpacing: "0.08em",
            }}
            aria-label={muted ? "Unmute UI sounds" : "Mute UI sounds"}
          >{muted ? "\u{1F507}" : "\u{1F50A}"}</button>
          <div style={{
            border: "1px solid rgba(255,71,0,0.25)", borderRadius: "0",
            padding: "6px 12px", fontSize: "11px", fontFamily: "inherit",
            color: account ? "#FF4700" : "rgba(175,175,155,0.7)", letterSpacing: "0.08em",
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
                href="https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip"
                target="_blank" rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  padding: "7px 14px", borderRadius: "0", fontSize: "11px", fontWeight: 700,
                  background: "rgba(5,3,2,0.88)", border: "1px solid rgba(255,71,0,0.5)",
                  color: "#FF4700", textDecoration: "none", letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >⬇ Install EVE Vault</a>
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
            color: "rgba(175,175,155,0.8)", marginBottom: "14px", fontFamily: "inherit",
            fontWeight: 400,
          }}>
            EVE FRONTIER &nbsp;·&nbsp; SUI TESTNET &nbsp;·&nbsp; HACKATHON 2026 WINNER
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"20px", margin:"0 0 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <KeeperOrb size={48} onClick={() => setActiveTab("keeper")} title="Open Keeper" />
              <h1 style={{
                fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 800, letterSpacing: "0.06em",
                color: "#FF4700", margin: 0,
              }}>
                C<span style={{ textTransform: "lowercase", letterSpacing: "0.04em" }}>radle</span>OS
              </h1>
              <KeeperOrb size={48} onClick={() => setActiveTab("keeper")} title="Open Keeper" />
            </div>
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
          {/* 2026-07-07 banner simplification: feature list now mirrors the
              live tab set only (panel slimming 2026-06-08 + defense removal
              2026-06-24 + industry hide 2026-06-27). Dropped: Defense,
              Bounties, Cargo, Succession, Recruiting, Wiki, Ship Fitting,
              Starmap. Restore lines here when those panels return. */}
          <p style={{
            fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(175,175,155,0.65)", fontFamily: "inherit", margin: "0 0 10px", fontWeight: 400,
          }}>
            Tribe Economy &nbsp;·&nbsp; Gates &nbsp;·&nbsp; Intel &nbsp;·&nbsp; Inventory &nbsp;·&nbsp; Voting &nbsp;·&nbsp; Calendar &nbsp;·&nbsp; Casino
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

      {/* Cycle 6 / Sanctuary wipe countdown — visible above all tabs, including
          before wallet connect. Auto-hides 24h after gates open. */}
      {!kioskMode && <WipeCountdownBanner />}

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
            color: briefOpen ? "#FF4700" : "rgba(175,175,155,0.5)",
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
                <li key={i} style={{ color: "rgba(175,175,155,0.6)", fontSize: "12px", lineHeight: 1.5 }}>{s}</li>
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

      {/* Main nav tabs — CCP design system: sharp, uppercase, red active indicator.

          Contrast tuning: against the dot-grid GIF background, low-alpha text
          (rgba 160,150,130,0.7) was disappearing into the noise. Boosted
          inactive label to high-alpha pale neutral (rgba 250,250,229,0.92),
          raised cell background opacity to 0.88 so labels sit on a stable
          plate, and added a small dark text-shadow for legibility against
          any background pixels that bleed through during transitions. */}
      {!kioskMode && <div style={{
        display: "flex", flexWrap: "wrap", gap: "0", marginBottom: "20px",
        borderBottom: "1px solid rgba(255,71,0,0.2)",
        background: "transparent",
      }}>
        {/* 2026-06-08 panel slimming: focused tab set for pre-wipe push.
            Hidden: structures, registry, bounties, srp, cargo, succession,
            announcements, recruiting, hierarchy, assets, wiki, fitting,
            map, efmap, keeper, cipher, flappy. Panels themselves still
            render below if active tab is set programmatically; only the
            nav buttons are removed. Re-enable by adding tab id back to
            this list (and PUBLIC_TABS if public-without-wallet). */}
        {/* "defense" temporarily removed 2026-06-24 — next wipe ships without
            turrets, so the TurretPolicyPanel has nothing to act on. Re-add
            (here AND in the kiosk ORDER below) once Fenris restores turrets.
            "gamedata" added 2026-06-24 — Sanctuary viewport of extracted client
            static data; public, no wallet required. */}
        {/* Industry tab hidden 2026-06-27 — see comment above ORDER array */}
        {(["dashboard", "inventory", "tribe", "gates", "intel", "calendar", "voting", "casino", "query", "gamedata", "dapps"] as Tab[]).filter(tab => {
          // Public tabs visible without a wallet
          const PUBLIC_TABS = new Set(["dapps", "query", "intel", "gamedata"]);
          return account || PUBLIC_TABS.has(tab);
        }).map(tab => {
          const active = activeTab === tab;
          // Centralized colors so hover handlers stay in sync with rest state.
          const inactiveColor = "rgba(250,250,229,0.92)";
          const inactiveBg = "rgba(8,5,2,0.88)";
          const hoverColor = "#FF4700";
          const hoverBg = "rgba(20,12,6,0.94)";
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                padding: compact ? "5px 7px 6px" : "10px 14px 11px",
                border: "none",
                borderBottom: active ? "2px solid #FF4700" : "2px solid transparent",
                borderRight: "1px solid rgba(255,71,0,0.1)",
                background: active ? "rgba(20,12,6,0.94)" : inactiveBg,
                color: active ? "#FF4700" : inactiveColor,
                cursor: "pointer",
                fontSize: compact ? "8px" : "11px",
                fontWeight: 700,
                letterSpacing: compact ? "0.06em" : "0.14em",
                textTransform: "uppercase",
                textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                transition: "color 0.1s, background 0.1s, border-color 0.1s",
                marginBottom: "-1px",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = hoverColor; (e.currentTarget as HTMLButtonElement).style.background = hoverBg; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = inactiveColor; (e.currentTarget as HTMLButtonElement).style.background = inactiveBg; } }}
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
                  : tab === "efmap"      ? "EF-Map"
                  : tab === "dapps"      ? "DApps"
                  : tab === "keeper"     ? "◆"
                  : tab === "industry"  ? "Industry"
                  : tab === "gamedata"  ? "Game Data"
                  : tab === "cipher"    ? "⊕ Cipher"
                  : tab === "voting"    ? "Vote"
                  : tab === "casino"    ? "◆ BJ"
                  : tab === "flappy"    ? "🚀"
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
                  : tab === "efmap"         ? "⬡ EF-Map"
                  : tab === "dapps"         ? "⧫ Community DApps"
                  : tab === "keeper"        ? "◆ Keeper"
                  : tab === "gamedata"      ? "◇ Game Data"
                  : tab === "dashboard"     ? "Dashboard"
                  : tab === "industry"      ? "⚙ Industry"
                  : tab === "cipher"        ? "⊕ Keeper Cipher"
                  : tab === "voting"        ? "◣ Elections"
                  : tab === "casino"        ? "◆ Casino"
                  : tab === "flappy"        ? "🚀 Flappy Frontier"
                  :                          "Starmap")}
            </button>
          );
        })}
      </div>}

      <ServerMismatchBanner />

      {/* Wallet gate — show connect prompt for protected tabs without wallet */}
      {!account && !PUBLIC_TABS.has(activeTab) && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(175,175,155,0.6)" }}>
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
      {(account || PUBLIC_TABS.has(activeTab)) && activeTab === "efmap" && (
        <div style={{ background: "transparent" }} className="content-panel"><EFMapPanel /></div>
      )}
      {(account || PUBLIC_TABS.has(activeTab)) && activeTab === "dapps" && (
        <div style={{ background: "transparent" }} className="content-panel"><CommunityDappsPanel /></div>
      )}
      {(account || PUBLIC_TABS.has(activeTab)) && activeTab !== "map" && activeTab !== "efmap" && activeTab !== "dapps" && (
        <div style={{ background: "transparent", padding: "0" }}>
          {activeTab === "structures" && <div style={{ background: "transparent" }} className="content-panel"><StructurePanel    onTxSuccess={setLastDigest} /></div>}
          {activeTab === "dashboard"  && <div style={{ background: "transparent" }} className="content-panel"><DashboardPanel /></div>}
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
          {activeTab === "industry"      && <div style={{ background: "transparent" }} className="content-panel"><IndustryPanel /></div>}
          {activeTab === "gamedata"      && <div style={{ background: "transparent" }} className="content-panel"><GameDataPanel /></div>}
          {activeTab === "cipher"       && <div style={{ background: "transparent" }} className="content-panel"><KeeperCipherPanel /></div>}
          {activeTab === "voting"        && <div style={{ background: "transparent" }} className="content-panel"><VotingPanel /></div>}
          {activeTab === "casino"        && <div style={{ background: "transparent" }} className="content-panel"><CasinoPanel /></div>}
          {activeTab === "flappy"        && isDev && <div style={{ background: "transparent" }} className="content-panel"><FlappyFrontierPanel /></div>}
        </div>
      )}
      {/* Hidden upgrade panel — access via #upgrade */}
      {window.location.hash === "#upgrade" && <UpgradePanel />}
      {/* DEV-only role toggle bar — fixed bottom bar, production builds strip this */}
      <DevRoleToggle />
      {/* Live CradleOS MAU pill (fixed bottom-right, hidden when zero) */}
      <MAUFooterPill />
    </main>
  );
}

function App() {
  // Playground harness short-circuit. When the URL has ?playground=<key>
  // we render an isolated UI exploration page without wallet/dApp-kit
  // providers loaded. The production app is unaffected.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("playground")) {
      return <PlaygroundHarness />;
    }
  }
  return (
    <DevModeProvider>
      <VerifiedAccountProvider>
        <AppInner />
      </VerifiedAccountProvider>
    </DevModeProvider>
  );
}

export default App;
