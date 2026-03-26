/**
 * CradleOS Travelling Map — Reachable Systems from Current Position
 *
 * Current system detection (priority order):
 *   1. World API jumps  — fetch /v2/characters/me/jumps?limit=1 with EVE Vault auth token
 *   2. Player structures — fetchPlayerStructures(account.address) → first structure's solarSystemId
 *   3. localStorage     — cradleos:last-system { id, name }
 *   4. Manual search    — user types system name
 *
 * TODO: fetch /v2/characters/me/jumps with EVE Vault session token for real-time location
 *       Currently implemented above — expand to also refresh on focus if token is cached.
 *
 * Jump mechanics — canonical source: ef-map.com/llms-full.txt (verified 2026-03-13):
 *
 *   Fuel-limited total trip (max LY with tank):
 *     range_LY = (fuelUnits × fuel_quality) / (FUEL_K × ship_mass_kg)
 *     FUEL_K = 1e-7  (canonical)
 *
 *   Fuel quality (canonical, ef-map 2026-02-18):
 *     D1 = 0.10  ·  D2 = 0.15  ·  SOF-40/EU-40 = 0.40  ·  SOF-80 = 0.80  ·  EU-90 = 0.90
 *
 * Colour scheme: green (close) → yellow (mid) → red (far edge of range)
 * Current system: bright cyan pulsing marker
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { WORLD_API } from "../constants";
import { fetchPlayerStructures } from "../lib";

const CACHE_KEY     = "cradleos:starmap:v5";
const LS_LAST_SYS   = "cradleos:last-system";
const BATCH         = 500;
const CONCURRENT    = 10;
const SCALE         = 1 / 3e16;
const LY_M          = 9.461e15;

// ── Types ──────────────────────────────────────────────────────────────────────

type SolarSystem = {
  id: number; name: string; regionId: number; regionName?: string;
  x: number; y: number; z: number;
  gateLinks?: number[];
};

type SystemDetail = {
  id: number;
  name: string;
  planets?: Array<{ typeName: string; count?: number }>;
  planetCount?: number;
  connections?: Array<{ id: number; name: string }>;
  securityClass?: string;
  region?: string;
};

// ── Planet type → color mapping ────────────────────────────────────────────────
// Short codes used in planet-index.json (compact static asset)
const PLANET_SHORT: Record<string, { full: string; color: string }> = {
  L: { full: "Lava",       color: "#ff3300" },
  B: { full: "Barren",     color: "#8b7355" },
  I: { full: "Ice",        color: "#44ccff" },
  G: { full: "Gas",        color: "#cc88ff" },
  O: { full: "Oceanic",    color: "#0066ff" },
  S: { full: "Storm",      color: "#ffaa00" },
  T: { full: "Temperate",  color: "#22cc44" },
  P: { full: "Plasma",     color: "#ff44ff" },
  X: { full: "Shattered",  color: "#888888" },
};
const PLANET_COLOR: Record<string, string> = {
  "Planet (Lava)": "#ff3300",
  "Planet (Barren)": "#8b7355",
  "Planet (Ice)": "#44ccff",
  "Planet (Gas)": "#cc88ff",
  "Planet (Oceanic)": "#0066ff",
  "Planet (Storm)": "#ffaa00",
  "Planet (Temperate)": "#22cc44",
  "Planet (Plasma)": "#ff44ff",
  "Planet (Shattered)": "#888888",
};
function planetDot(typeName: string): string {
  return PLANET_COLOR[typeName] ?? "#555";
}
// Planet index: systemId → [[shortCode, count], ...]
type PlanetIndex = Record<string, Array<[string, number]>>;
let _planetIndex: PlanetIndex | null = null;
async function loadPlanetIndex(): Promise<PlanetIndex> {
  if (_planetIndex) return _planetIndex;
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const r = await fetch(`${base}data/planet-index.json`);
    _planetIndex = await r.json() as PlanetIndex;
  } catch { _planetIndex = {}; }
  return _planetIndex!;
}

// ── Ship / Fuel tables ─────────────────────────────────────────────────────────

type ShipSpec = {
  id: string; name: string; classLabel: string;
  massKg: number; fuelCap: number; specificHeat: number;
  fuels: string[];
};

const SHUTTLE_FUELS  = ["d1","d2"];
const REFINED_FUELS  = ["sof40","eu40","sof80","eu90"];
const CORVETTE_FUELS = ["d1","d2"];

const SHIPS: ShipSpec[] = [
  { id:"wend",    name:"Wend",    classLabel:"Shuttle",              massKg:    6_800_000, fuelCap:     200, specificHeat:2.0, fuels:SHUTTLE_FUELS  },
  { id:"lai",     name:"LAI",     classLabel:"Frigate",              massKg:   18_929_160, fuelCap:   2_400, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"usv",     name:"USV",     classLabel:"Frigate",              massKg:   30_266_600, fuelCap:   2_420, specificHeat:1.8, fuels:REFINED_FUELS  },
  { id:"lorha",   name:"LORHA",   classLabel:"Frigate",              massKg:   42_691_330, fuelCap:   2_508, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"haf",     name:"HAF",     classLabel:"Frigate",              massKg:   81_883_000, fuelCap:   4_184, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"mcf",     name:"MCF",     classLabel:"Frigate",              massKg:   52_313_760, fuelCap:   6_548, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"tades",   name:"TADES",   classLabel:"Destroyer",            massKg:   74_655_480, fuelCap:   5_972, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"maul",    name:"MAUL",    classLabel:"Cruiser",              massKg:  548_435_920, fuelCap:  24_160, specificHeat:2.5, fuels:REFINED_FUELS  },
  { id:"chumaq",  name:"Chumaq",  classLabel:"Combat Battlecruiser", massKg:1_487_392_000, fuelCap: 270_585, specificHeat:3.0, fuels:REFINED_FUELS  },
  { id:"recurve", name:"Recurve", classLabel:"Corvette",             massKg:   10_200_000, fuelCap:     970, specificHeat:1.0, fuels:CORVETTE_FUELS },
  { id:"reflex",  name:"Reflex",  classLabel:"Corvette",             massKg:    9_750_000, fuelCap:   1_750, specificHeat:3.0, fuels:CORVETTE_FUELS },
  { id:"reiver",  name:"Reiver",  classLabel:"Corvette",             massKg:   10_400_000, fuelCap:   1_416, specificHeat:1.0, fuels:CORVETTE_FUELS },
  { id:"carom",   name:"Carom",   classLabel:"Corvette",             massKg:    7_200_000, fuelCap:   3_000, specificHeat:8.5, fuels:CORVETTE_FUELS },
  { id:"stride",  name:"Stride",  classLabel:"Corvette",             massKg:    7_900_000, fuelCap:   3_200, specificHeat:8.0, fuels:CORVETTE_FUELS },
];

type FuelSpec = {
  id: string; label: string;
  apiId: number; massPerUnit: number; volPerUnit: number; quality: number;
};

const FUELS: FuelSpec[] = [
  { id:"d1",    label:"D1 — Unstable Fuel", apiId:77818, massPerUnit:42, volPerUnit:0.28, quality:0.10 },
  { id:"d2",    label:"D2 Fuel",            apiId:0,     massPerUnit:0,  volPerUnit:0.28, quality:0.15 },
  { id:"sof40", label:"SOF-40 Fuel",        apiId:0,     massPerUnit:25, volPerUnit:0.28, quality:0.40 },
  { id:"eu40",  label:"EU-40 Fuel",         apiId:78516, massPerUnit:25, volPerUnit:0.28, quality:0.40 },
  { id:"sof80", label:"SOF-80 Fuel",        apiId:78515, massPerUnit:30, volPerUnit:0.28, quality:0.80 },
  { id:"eu90",  label:"EU-90 Fuel",         apiId:78437, massPerUnit:30, volPerUnit:0.28, quality:0.90 },
];

const FUEL_K = 1e-7;

function fuelLimitedRange(ship: ShipSpec, fuelUnits: number, fuel: FuelSpec): number {
  return (fuelUnits * fuel.quality) / (FUEL_K * ship.massKg);
}

// ── Distance-based colour (green → yellow → red) ───────────────────────────────

function distColor(distLY: number, maxRangeLY: number): THREE.Color {
  const t = Math.min(distLY / Math.max(maxRangeLY, 1), 1);
  // Brightness boost for close systems: 1.5x at origin, 0.6x at max range
  const brightness = 1.5 - t * 0.9;
  if (t < 0.5) {
    // green → yellow
    return new THREE.Color(t * 2 * brightness, 1 * brightness, 0);
  } else {
    // yellow → red
    return new THREE.Color(1 * brightness, (1 - (t - 0.5) * 2) * brightness, 0);
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputSx: React.CSSProperties = {
  background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
  borderRadius:"4px", color:"#ddd", fontSize:"11px", padding:"5px 8px",
  outline:"none", width:"100%", boxSizing:"border-box",
};
const labelSx: React.CSSProperties = {
  color:"#444", fontSize:"10px", letterSpacing:"0.06em", marginBottom:"4px", display:"block",
};

// ── World API jump history via EVE Vault postMessage ───────────────────────────

interface JumpRecord {
  id: number; time: string;
  origin:      { id: number; name: string };
  destination: { id: number; name: string };
  ship: { typeId: number; instanceId: number };
}

async function fetchLastJumpSystem(): Promise<{ id: number; name: string } | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 4000);

    const handler = (event: MessageEvent) => {
      const d = event.data as { __from?: string; type?: string; token?: { id_token?: string } };
      if (!d || d.__from !== "Eve Vault") return;
      if ((d.type === "auth_success" || d.type === "AUTH_SUCCESS") && d.token?.id_token) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        const idToken = d.token.id_token;
        // TODO: expand to also cache idToken for subsequent refreshes
        fetch(`${WORLD_API}/v2/characters/me/jumps?limit=1`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then((data: { data: JumpRecord[] } | null) => {
            if (data?.data?.[0]) {
              const dest = data.data[0].destination;
              resolve({ id: dest.id, name: dest.name });
            } else {
              resolve(null);
            }
          })
          .catch(() => resolve(null));
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ __from: "CradleOS", type: "REQUEST_AUTH" }, "*");
  });
}

// ── System detail fetch ────────────────────────────────────────────────────────

async function fetchSystemDetail(id: number): Promise<SystemDetail | null> {
  try {
    const r = await fetch(`${WORLD_API}/v2/solarsystems/${id}`);
    if (!r.ok) return null;
    const d = await r.json() as {
      id?: number; name?: string;
      gateLinks?: number[];
      securityClass?: string;
      regionId?: number;
      region?: { name?: string };
      constellationId?: number;
    };
    // Planet data from static index (World API doesn't include planets)
    const pidx = await loadPlanetIndex();
    const rawPlanets = pidx[String(id)] ?? [];
    const planets = rawPlanets.map(([code, count]) => ({
      typeName: `Planet (${PLANET_SHORT[code]?.full ?? code})`,
      count,
    }));
    const planetCount = rawPlanets.reduce((sum, [, c]) => sum + c, 0);
    // Gate connections
    const gateLinks = d.gateLinks ?? [];
    const connections: Array<{ id: number; name: string }> = [];
    for (const gid of gateLinks.slice(0, 20)) {
      try {
        const gr = await fetch(`${WORLD_API}/v2/solarsystems/${gid}`);
        if (gr.ok) {
          const gd = await gr.json() as { id?: number; name?: string };
          connections.push({ id: gd.id ?? gid, name: gd.name ?? `System ${gid}` });
        }
      } catch { /* skip */ }
    }
    return {
      id: d.id ?? id,
      name: d.name ?? `System ${id}`,
      planets,
      planetCount,
      connections,
      securityClass: d.securityClass,
      region: d.region?.name,
    };
  } catch {
    return null;
  }
}

// ── SystemOrrery — 3D planetary orrery for the detail panel ───────────────────

type OrreryPlanet = { typeName: string; count?: number };

function SystemOrrery({ planets }: { planets: OrreryPlanet[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Use a stable string key so the effect only re-runs when planet data actually changes
  const planetKey = JSON.stringify(planets);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let rafId = 0;
    const width  = mount.clientWidth  || 192;
    const height = mount.clientHeight || 220;

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera — angled top-down ─────────────────────────────────────────────
    const maxOrbit = planets.length > 0 ? 3 + (planets.length - 1) * 2 : 4;
    const camDist  = Math.max(maxOrbit * 2.0, 12);
    const camera   = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
    camera.position.set(0, camDist * 0.9, camDist * 0.5);
    camera.lookAt(0, 0, 0);

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x040608, 1);
    mount.appendChild(renderer.domElement);

    // ── Lighting ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const starLight = new THREE.PointLight(0xff9933, 3.0, 80);
    scene.add(starLight);

    // ── Orbit group (auto-rotates for a living feel) ─────────────────────────
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    // ── Star — K7 Orange, emissive glow ──────────────────────────────────────
    const starGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const starMat = new THREE.MeshStandardMaterial({
      color:             0xff8822,
      emissive:          new THREE.Color(0xff6600),
      emissiveIntensity: 1.0,
      roughness:         0.9,
      metalness:         0.0,
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    orbitGroup.add(starMesh);

    // Soft outer halo (additive-like feel with BackSide transparent sphere)
    const haloGeo = new THREE.SphereGeometry(2.0, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color:       0xff7700,
      transparent: true,
      opacity:     0.08,
      side:        THREE.BackSide,
    });
    orbitGroup.add(new THREE.Mesh(haloGeo, haloMat));

    // ── Planet color map ──────────────────────────────────────────────────────
    const colorMap: Record<string, string> = {
      "Planet (Lava)":      "#ff3300",
      "Planet (Barren)":    "#8b7355",
      "Planet (Ice)":       "#44ccff",
      "Planet (Gas)":       "#cc88ff",
      "Planet (Oceanic)":   "#0066ff",
      "Planet (Storm)":     "#ffaa00",
      "Planet (Temperate)": "#22cc44",
      "Planet (Plasma)":    "#ff44ff",
      "Planet (Shattered)": "#888888",
    };

    // ── Planet animation data ─────────────────────────────────────────────────
    const planetData: Array<{
      mesh: THREE.Mesh;
      orbitRadius: number;
      speed: number;
      angle: number;
    }> = [];

    planets.forEach((planet, idx) => {
      const orbitRadius = 3 + idx * 2;
      const isGas       = planet.typeName.includes("Gas");
      const sphereSize  = isGas ? 0.45 : 0.3;
      const colorStr    = colorMap[planet.typeName] ?? "#555555";
      const count       = Math.max(1, planet.count ?? 1);
      // Kepler-ish: inner planets orbit faster
      const speed = 0.45 / Math.sqrt(orbitRadius);

      // Orbit ring
      const ringPts: THREE.Vector3[] = [];
      for (let k = 0; k <= 80; k++) {
        const a = (k / 80) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const ringMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
      orbitGroup.add(new THREE.Line(ringGeo, ringMat));

      // Planet spheres (count > 1 → evenly spread around orbit)
      for (let j = 0; j < count; j++) {
        const startAngle = (j / count) * Math.PI * 2;
        const pGeo = new THREE.SphereGeometry(sphereSize, 14, 14);
        const pMat = new THREE.MeshStandardMaterial({
          color:    new THREE.Color(colorStr),
          roughness: 0.75,
          metalness: 0.05,
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(
          Math.cos(startAngle) * orbitRadius,
          0,
          Math.sin(startAngle) * orbitRadius,
        );
        orbitGroup.add(pMesh);
        planetData.push({ mesh: pMesh, orbitRadius, speed, angle: startAngle });
      }
    });

    // ── Animation loop ────────────────────────────────────────────────────────
    let autoRotate = 0;
    let starPulse  = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // Slow auto-rotation of the whole system for a living feel
      autoRotate += 0.003;
      orbitGroup.rotation.y = autoRotate;

      // Orbit planets around the star
      for (const p of planetData) {
        p.angle += p.speed * 0.016;
        p.mesh.position.set(
          Math.cos(p.angle) * p.orbitRadius,
          0,
          Math.sin(p.angle) * p.orbitRadius,
        );
      }

      // Gentle star pulse
      starPulse += 0.04;
      starMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(starPulse);

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize observer ───────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.dispose();
      scene.clear();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planetKey]);

  return (
    <div
      ref={mountRef}
      style={{
        width:        "100%",
        height:       "220px",
        borderRadius: "4px",
        border:       "1px solid rgba(255,255,255,0.06)",
        background:   "rgba(4,6,14,0.9)",
        overflow:     "hidden",
        flexShrink:   0,
        marginBottom: "10px",
      }}
    />
  );
}

// ── Star texture for celestial point rendering ─────────────────────────────────
function createStarTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,200,100,0.8)");
  g.addColorStop(0.5, "rgba(255,100,50,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// ── Component ──────────────────────────────────────────────────────────────────

type SortKey = "distance" | "name" | "region";

export function MapPanel() {
  const account = useCurrentAccount();

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mountRef       = useRef<HTMLDivElement>(null);
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef    = useRef<OrbitControls | null>(null);
  const bgPointsRef    = useRef<THREE.Points | null>(null);
  const reachPointsRef = useRef<THREE.Points | null>(null);
  const currentMarkerRef = useRef<THREE.Mesh | null>(null);
  const gateLineRef    = useRef<THREE.LineSegments | null>(null);
  const rangeGroupRef  = useRef<THREE.Group | null>(null);
  const rafRef         = useRef(0);
  const raycaster      = useRef(new THREE.Raycaster());
  const mouseDownPos   = useRef<{x:number;y:number} | null>(null);
  const systemsRef     = useRef<SolarSystem[]>([]);
  const sortedXRef     = useRef<{ idx: number; xLY: number }[]>([]);
  const pulseRef       = useRef(0);

  // ── State ──────────────────────────────────────────────────────────────────
  const [loadState, setLoadState]     = useState({ loaded: 0, total: 0, done: false });
  const [currentSys,  setCurrentSys]  = useState<SolarSystem | null>(null);
  const [targetSys,   setTargetSys]   = useState<SolarSystem | null>(null);
  const [locationSrc, setLocationSrc] = useState<string>("");
  const [locating,    setLocating]    = useState(false);
  const [planetIdx,   setPlanetIdx]   = useState<PlanetIndex>({});
  const [manualSearchQ, setManualSearchQ] = useState("");
  const [manualResults, setManualResults] = useState<SolarSystem[]>([]);
  const [changeCurrentQ, setChangeCurrentQ] = useState("");
  const [changeCurrentResults, setChangeCurrentResults] = useState<SolarSystem[]>([]);
  const [showChangeCurrentInput, setShowChangeCurrentInput] = useState(false);

  // Reachable systems
  const [reachableSystems, setReachableSystems] = useState<Array<SolarSystem & { distLY: number }>>([]);

  // Ship / fuel
  const [shipId,    setShipId]    = useState("usv");
  const [fuelId,    setFuelId]    = useState("eu40");
  const [fuelUnits, setFuelUnits] = useState<number>(0);

  // Sidebar
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sortKey,       setSortKey]       = useState<SortKey>("distance");
  const [selectedSys,   setSelectedSys]   = useState<SolarSystem & { distLY: number } | null>(null);
  const [systemDetail,  setSystemDetail]  = useState<SystemDetail | null>(null);
  const [detailCache,   setDetailCache]   = useState<Map<number, SystemDetail>>(new Map());
  const [detailLoading, setDetailLoading] = useState(false);
  const [tooltip,       setTooltip]       = useState<{ x:number; y:number; name:string } | null>(null);

  // Clipboard feedback
  const [copied, setCopied] = useState<string>("");

  const ship = SHIPS.find(s => s.id === shipId) ?? SHIPS[2];
  const fuel = FUELS.find(f => f.id === fuelId) ?? FUELS[1];
  const tankUnits  = fuelUnits > 0 ? Math.min(fuelUnits, ship.fuelCap) : ship.fuelCap;
  const maxRangeLY = useMemo(() => fuelLimitedRange(ship, tankUnits, fuel), [ship, tankUnits, fuel]);

  // ── Derived list (filtered + sorted) ──────────────────────────────────────
  const displayList = useMemo(() => {
    let list = reachableSystems;
    if (sidebarSearch.trim().length >= 2) {
      const q = sidebarSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || (s.regionName ?? "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortKey === "distance") return a.distLY - b.distLY;
      if (sortKey === "name")     return a.name.localeCompare(b.name);
      return (a.regionName ?? "").localeCompare(b.regionName ?? "");
    });
  }, [reachableSystems, sidebarSearch, sortKey]);

  // ── Three.js init ──────────────────────────────────────────────────────────
  // Load planet index once on mount
  useEffect(() => { loadPlanetIndex().then(setPlanetIdx); }, []);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040608);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / (mount.clientHeight || 1), 0.1, 50000);
    camera.position.set(0, 0, 800);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.screenSpacePanning = true; controls.minDistance = 1; controls.maxDistance = 10000;
    // Limit vertical rotation — keep "up" as up (40° from pole = ~0.7 rad to ~2.44 rad)
    controls.minPolarAngle = 0.7;   // ~40° from top
    controls.maxPolarAngle = 2.44;  // ~40° from bottom
    controlsRef.current = controls;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      // Subtle glimmer on current system marker (slightly larger, gentle opacity shimmer)
      if (currentMarkerRef.current) {
        pulseRef.current += 0.02;
        currentMarkerRef.current.scale.setScalar(1.0);  // no scale change, just opacity glimmer
        const mat = currentMarkerRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.75 + 0.15 * Math.sin(pulseRef.current);  // gentle shimmer: 0.60–0.90
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount); setTimeout(onResize, 0);

    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect(); controls.dispose(); renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // ── Fetch all systems ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: SolarSystem[] = JSON.parse(cached);
          systemsRef.current = data;
          sortedXRef.current = data.map((s,i) => ({ idx:i, xLY:s.x/LY_M })).sort((a,b) => a.xLY-b.xLY);
          setLoadState({ loaded:data.length, total:data.length, done:true });
          buildBgPoints(data);
          return;
        }
      } catch { /* stale */ }

      const first = await fetch(`${WORLD_API}/v2/solarsystems?limit=1`).then(r=>r.json()) as { metadata:{total:number} };
      if (cancelled) return;
      const total = first.metadata.total, pages = Math.ceil(total / BATCH);
      setLoadState({ loaded:0, total, done:false });

      const all: SolarSystem[] = [];
      for (let wave = 0; wave < pages && !cancelled; wave += CONCURRENT) {
        const fns = [];
        for (let p = wave; p < Math.min(wave+CONCURRENT, pages); p++) {
          fns.push(
            fetch(`${WORLD_API}/v2/solarsystems?limit=${BATCH}&offset=${p*BATCH}`)
              .then(r => r.json() as Promise<{ data: Array<{
                id:number; name:string; regionId:number;
                location:{x:number;y:number;z:number};
                gateLinks?: number[];
              }> }>)
              .then(d => d.data.map(s => ({
                id: s.id, name: s.name, regionId: s.regionId,
                x: s.location.x, y: s.location.y, z: s.location.z,
                gateLinks: s.gateLinks ?? [],
              })))
          );
        }
        const chunks = await Promise.all(fns); if (cancelled) return;
        for (const c of chunks) all.push(...c);
        setLoadState({ loaded:all.length, total, done:false });
      }
      if (cancelled) return;
      systemsRef.current = all;
      sortedXRef.current = all.map((s,i) => ({ idx:i, xLY:s.x/LY_M })).sort((a,b) => a.xLY-b.xLY);
      setLoadState({ loaded:all.length, total, done:true });
      buildBgPoints(all);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(all)); } catch { /* quota */ }
    };
    load().catch(console.error);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build dim background star cloud ───────────────────────────────────────
  function buildBgPoints(systems: SolarSystem[]) {
    const scene = sceneRef.current; if (!scene) return;
    if (bgPointsRef.current) { scene.remove(bgPointsRef.current); bgPointsRef.current = null; }
    const n = systems.length;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = systems[i];
      pos[i*3] = s.x*SCALE; pos[i*3+1] = s.z*SCALE; pos[i*3+2] = -s.y*SCALE;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    const starTex = createStarTexture();
    const mat = new THREE.PointsMaterial({ size:2.5, sizeAttenuation:false, color:0x556688, transparent:true, opacity:0.6, map:starTex, blending:THREE.AdditiveBlending, depthWrite:false });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts); bgPointsRef.current = pts;

    // Frame view
    geo.computeBoundingSphere();
    const sp = geo.boundingSphere!, dist = sp.radius * 2.2;
    const ctrl = controlsRef.current, cam = cameraRef.current;
    if (ctrl && cam) {
      ctrl.target.copy(sp.center);
      cam.position.set(sp.center.x, sp.center.y + dist * 0.5, sp.center.z + dist * 0.7);
      cam.lookAt(sp.center.x, sp.center.y, sp.center.z);
      ctrl.update();
    }
  }

  // ── Auto-detect current system ─────────────────────────────────────────────
  useEffect(() => {
    if (!loadState.done) return;
    detectCurrentSystem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState.done, account?.address]);

  const detectCurrentSystem = useCallback(async () => {
    setLocating(true);

    // 1. World API jumps via EVE Vault token
    try {
      const jump = await fetchLastJumpSystem();
      if (jump) {
        const sys = systemsRef.current.find(s => s.id === jump.id);
        if (sys) {
          setCurrentAndStore(sys, "EVE Vault (last jump)");
          setLocating(false);
          return;
        }
      }
    } catch { /* fall through */ }

    // 2. Player structures
    if (account?.address) {
      try {
        const groups = await fetchPlayerStructures(account.address);
        for (const g of groups) {
          if (g.solarSystemId) {
            const sys = systemsRef.current.find(s => s.id === g.solarSystemId);
            if (sys) {
              setCurrentAndStore(sys, "structures");
              setLocating(false);
              return;
            }
          }
        }
      } catch { /* fall through */ }
    }

    // 3. localStorage
    try {
      const stored = localStorage.getItem(LS_LAST_SYS);
      if (stored) {
        const { id } = JSON.parse(stored) as { id: number; name: string };
        const sys = systemsRef.current.find(s => s.id === id);
        if (sys) {
          setCurrentSys(sys);
          setLocationSrc("last known (localStorage)");
          setLocating(false);
          return;
        }
      }
    } catch { /* fall through */ }

    // 4. Manual — no source found
    setLocating(false);
    setLocationSrc("");
  }, [account?.address]);

  function setCurrentAndStore(sys: SolarSystem, src: string) {
    setCurrentSys(sys);
    setLocationSrc(src);
    try { localStorage.setItem(LS_LAST_SYS, JSON.stringify({ id: sys.id, name: sys.name })); } catch { /* quota */ }
  }

  // ── Calculate reachable systems when current or range changes ─────────────
  useEffect(() => {
    if (!currentSys || maxRangeLY <= 0 || !loadState.done) return;

    const systems = systemsRef.current;
    const sorted  = sortedXRef.current;
    if (!systems.length) return;

    const rangeM  = maxRangeLY * LY_M;
    const rangeM2 = rangeM * rangeM;
    const ox = currentSys.x, oy = currentSys.y, oz = currentSys.z;
    const oxLY = ox / LY_M;
    const xLYArr = sorted.map(e => e.xLY);

    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) { const m = (lo+hi)>>1; if (xLYArr[m] < oxLY - maxRangeLY) lo=m+1; else hi=m; }
    const start = lo;
    lo = 0; hi = sorted.length - 1;
    while (lo < hi) { const m=(lo+hi+1)>>1; if (xLYArr[m] > oxLY + maxRangeLY) hi=m-1; else lo=m; }
    const end = lo;

    const reachable: Array<SolarSystem & { distLY: number }> = [];
    for (let i = start; i <= end; i++) {
      const s = systems[sorted[i].idx];
      if (s.id === currentSys.id) continue;
      const dx = s.x-ox, dy = s.y-oy, dz = s.z-oz;
      if (dx*dx + dy*dy + dz*dz <= rangeM2) {
        const distLY = Math.sqrt(dx*dx+dy*dy+dz*dz) / LY_M;
        reachable.push({ ...s, distLY });
      }
    }

    setReachableSystems(reachable);
    buildReachPoints(currentSys, reachable, maxRangeLY);
    flyTo(currentSys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSys, maxRangeLY, loadState.done]);

  // ── Build reachable point cloud ────────────────────────────────────────────
  const buildReachPoints = useCallback((
    origin: SolarSystem,
    reachable: Array<SolarSystem & { distLY: number }>,
    rangeLY: number,
  ) => {
    const scene = sceneRef.current; if (!scene) return;

    // Remove old
    if (reachPointsRef.current) { scene.remove(reachPointsRef.current); reachPointsRef.current = null; }
    if (currentMarkerRef.current) { scene.remove(currentMarkerRef.current); currentMarkerRef.current = null; }
    if (gateLineRef.current) { scene.remove(gateLineRef.current); gateLineRef.current = null; }

    // Reachable points coloured by distance — close systems are brighter + larger
    const n = reachable.length;
    if (n > 0) {
      const pos = new Float32Array(n*3), col = new Float32Array(n*3), sizes = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const s = reachable[i];
        pos[i*3] = s.x*SCALE; pos[i*3+1] = s.z*SCALE; pos[i*3+2] = -s.y*SCALE;
        const c = distColor(s.distLY, rangeLY);
        col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
        // Size: 10 at origin → 4 at max range
        const t = Math.min(s.distLY / Math.max(rangeLY, 1), 1);
        sizes[i] = 10 - t * 6;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
      geo.setAttribute("color", new THREE.BufferAttribute(col,3));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes,1));
      const reachStarTex = createStarTexture();
      // Custom shader for per-point sizes
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: reachStarTex } },
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying vec3 vColor;
          void main() {
            vec4 texColor = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor * texColor.rgb, texColor.a);
          }
        `,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      reachPointsRef.current = pts;
    }

    // Gate connection lines between reachable systems
    const reachableIds = new Set(reachable.map(s => s.id));
    reachableIds.add(origin.id);
    const idToReachable = new Map<number, SolarSystem>(reachable.map(s => [s.id, s]));
    idToReachable.set(origin.id, origin);
    const gatePositions: number[] = [];
    for (const s of reachable) {
      if (!s.gateLinks?.length) continue;
      for (const tid of s.gateLinks) {
        if (!reachableIds.has(tid)) continue;
        const t = idToReachable.get(tid);
        if (!t || t.id < s.id) continue;
        gatePositions.push(
          s.x*SCALE, s.z*SCALE, -s.y*SCALE,
          t.x*SCALE, t.z*SCALE, -t.y*SCALE,
        );
      }
    }
    if (gatePositions.length > 0) {
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gatePositions),3));
      const gMat = new THREE.LineBasicMaterial({ color:0x1a4a6a, transparent:true, opacity:0.5 });
      gateLineRef.current = new THREE.LineSegments(gGeo, gMat);
      scene.add(gateLineRef.current);
    }

    // Current system marker — visible cyan sphere with gentle glimmer (larger hitbox than visual)
    const sg = new THREE.SphereGeometry(1.5, 8, 8);
    const sm = new THREE.MeshBasicMaterial({ color:0x00e8ff, transparent:true, opacity:0.9 });
    const marker = new THREE.Mesh(sg, sm);
    marker.position.set(origin.x*SCALE, origin.z*SCALE, -origin.y*SCALE);
    scene.add(marker);
    currentMarkerRef.current = marker;

    // ── Clean up old range visuals ──
    if (rangeGroupRef.current) { scene.remove(rangeGroupRef.current); rangeGroupRef.current = null; }
    const rangeGroup = new THREE.Group();

    // ── Range shells: concentric wireframe spheres at 25/50/75/100% of range ──
    const ox = origin.x*SCALE, oy = origin.z*SCALE, oz = -origin.y*SCALE;
    const rangeMetre = rangeLY * LY_M;
    const shellAlphas = [0.12, 0.10, 0.08, 0.06]; // inner→outer
    const shellColors = [0x00ff66, 0xaaff00, 0xffaa00, 0xff3300]; // green→yellow→orange→red
    for (let i = 0; i < 4; i++) {
      const frac = (i + 1) / 4;
      const r = rangeMetre * SCALE * frac;
      const shellGeo = new THREE.SphereGeometry(r, 32, 16);
      const shellMat = new THREE.MeshBasicMaterial({
        color: shellColors[i], transparent: true, opacity: shellAlphas[i],
        wireframe: true, depthWrite: false,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.position.set(ox, oy, oz);
      rangeGroup.add(shell);
    }

    // ── Reference grid plane through origin for orientation ──
    const gridRadius = rangeMetre * SCALE;
    const gridDiv = 8;
    const gridGeo = new THREE.BufferGeometry();
    const gridVerts: number[] = [];
    for (let i = -gridDiv; i <= gridDiv; i++) {
      const t = (i / gridDiv) * gridRadius;
      // X lines
      gridVerts.push(ox - gridRadius, oy, oz + t, ox + gridRadius, oy, oz + t);
      // Z lines
      gridVerts.push(ox + t, oy, oz - gridRadius, ox + t, oy, oz + gridRadius);
    }
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridVerts, 3));
    const gridMat = new THREE.LineBasicMaterial({ color: 0x112233, transparent: true, opacity: 0.12, depthWrite: false });
    rangeGroup.add(new THREE.LineSegments(gridGeo, gridMat));

    scene.add(rangeGroup);
    rangeGroupRef.current = rangeGroup;
  }, []);

  // ── Camera helpers ─────────────────────────────────────────────────────────
  const flyTo = useCallback((sys: SolarSystem) => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const tx = sys.x*SCALE, ty = sys.z*SCALE, tz = -sys.y*SCALE;
    ctrl.target.set(tx,ty,tz);
    // Slightly elevated view to show galaxy disc (matches in-game map perspective)
    cam.position.set(tx, ty + 60, tz + 40);
    cam.lookAt(tx,ty,tz); cam.up.set(0,1,0); ctrl.update();
  }, []);

  // ── Hover & click ──────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mount = mountRef.current, cam = cameraRef.current;
    const pts = reachPointsRef.current;
    if (!mount || !cam || !pts) return;
    const rect = mount.getBoundingClientRect();
    const ndx = ((e.clientX-rect.left)/rect.width)*2-1;
    const ndy = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.current.params.Points = { threshold: 3 };
    raycaster.current.setFromCamera(new THREE.Vector2(ndx,ndy), cam);
    const hits = raycaster.current.intersectObject(pts);
    // Pick the closest hit to camera (not just first in buffer order)
    if (hits.length > 0) {
      hits.sort((a, b) => a.distanceToRay! - b.distanceToRay!);
      const best = hits[0];
      if (best.index != null) {
        const sys = reachableSystems[best.index];
        if (sys) { setTooltip({ x:e.clientX-rect.left+14, y:e.clientY-rect.top-10, name:`${sys.name}  ${sys.distLY.toFixed(1)} LY` }); return; }
      }
    }
    // Also check current system marker (mesh)
    if (currentMarkerRef.current) {
      const markerHits = raycaster.current.intersectObject(currentMarkerRef.current);
      if (markerHits.length > 0 && currentSys) {
        setTooltip({ x:e.clientX-rect.left+14, y:e.clientY-rect.top-10, name:`⊙ ${currentSys.name} (current)` });
        return;
      }
    }
    setTooltip(null);
  }, [reachableSystems, currentSys]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownPos.current = { x:e.clientX, y:e.clientY };
  }, []);

  const onMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const down = mouseDownPos.current;
    if (down) {
      const dx = e.clientX-down.x, dy = e.clientY-down.y;
      if (Math.sqrt(dx*dx+dy*dy) > 6) return;
    }
    const mount = mountRef.current, cam = cameraRef.current, pts = reachPointsRef.current;
    if (!mount || !cam || !pts) return;
    const rect = mount.getBoundingClientRect();
    const ndx = ((e.clientX-rect.left)/rect.width)*2-1;
    const ndy = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.current.params.Points = { threshold: 4 };
    raycaster.current.setFromCamera(new THREE.Vector2(ndx,ndy), cam);
    const hits = raycaster.current.intersectObject(pts);
    if (hits.length > 0) {
      // Pick closest to cursor ray, not closest to camera
      hits.sort((a, b) => a.distanceToRay! - b.distanceToRay!);
      const best = hits[0];
      if (best.index != null) {
        const sys = reachableSystems[best.index];
        if (sys) handleSelectSystem(sys);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachableSystems]);

  // ── System selection ───────────────────────────────────────────────────────
  const handleSelectSystem = useCallback((sys: SolarSystem & { distLY: number }) => {
    setSelectedSys(sys);
    const cached = detailCache.get(sys.id);
    if (cached) { setSystemDetail(cached); setDetailLoading(false); flyTo(sys); return; }
    setSystemDetail(null);
    flyTo(sys);
    setDetailLoading(true);
    fetchSystemDetail(sys.id)
      .then(d => {
        setSystemDetail(d);
        if (d) setDetailCache(prev => new Map(prev).set(sys.id, d));
      })
      .finally(() => setDetailLoading(false));
  }, [flyTo, detailCache]);

  // ── Manual system search ───────────────────────────────────────────────────
  const handleManualSearch = useCallback((q: string) => {
    setManualSearchQ(q);
    if (q.length < 2) { setManualResults([]); return; }
    const ql = q.toLowerCase();
    setManualResults(systemsRef.current.filter(s => s.name.toLowerCase().includes(ql)).slice(0, 8));
  }, []);

  const handleChangeCurrentSearch = useCallback((q: string) => {
    setChangeCurrentQ(q);
    if (q.length < 2) { setChangeCurrentResults([]); return; }
    const ql = q.toLowerCase();
    setChangeCurrentResults(systemsRef.current.filter(s => s.name.toLowerCase().includes(ql)).slice(0, 8));
  }, []);

  // ── Export helpers ─────────────────────────────────────────────────────────
  function systemLink(s: SolarSystem): string {
    return `<a href="showinfo:5//${s.id}">${s.name}</a>`;
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    });
  }

  const exportAll = useCallback(() => {
    const text = reachableSystems.map(s => systemLink(s)).join("\n");
    copyToClipboard(text, "all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachableSystems]);

  const exportSelected = useCallback(() => {
    if (!selectedSys) return;
    copyToClipboard(systemLink(selectedSys), "selected");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSys]);

  // ── Pre-load fuel override when ship/fuel changes ──────────────────────────
  useEffect(() => { setFuelUnits(0); }, [shipId, fuelId]);

  const pct = loadState.total > 0 ? Math.round((loadState.loaded / loadState.total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Toolbar */}
      <div style={{
        display:"flex", alignItems:"center", gap:"10px", flexShrink:0, flexWrap:"wrap",
        padding:"7px 12px", background:"rgba(0,0,0,0.6)",
        borderBottom:"1px solid rgba(255,160,50,0.12)",
      }}>
        <span style={{ color:"#ffa032", fontWeight:700, fontSize:"13px" }}>TRAVELLING MAP</span>
        <span style={{ color:"#333", fontSize:"11px" }}>
          {loadState.done
            ? `${reachableSystems.length.toLocaleString()} reachable · ${loadState.loaded.toLocaleString()} total`
            : loadState.total > 0 ? `Loading… ${pct}%` : "Connecting…"}
        </span>

        {/* Current system pill */}
        {currentSys && (
          <div style={{
            background:"rgba(0,232,255,0.08)", border:"1px solid rgba(0,232,255,0.25)",
            borderRadius:"12px", padding:"3px 10px", fontSize:"11px",
            color:"#00e8ff", fontFamily:"monospace",
          }}>
            ⊙ {currentSys.name}
            {locationSrc && <span style={{ color:"#336", marginLeft:"6px", fontSize:"10px" }}>via {locationSrc}</span>}
          </div>
        )}

        {/* Target system pill */}
        {targetSys && (
          <div style={{
            background:"rgba(255,71,0,0.08)", border:"1px solid rgba(255,71,0,0.25)",
            borderRadius:"12px", padding:"3px 10px", fontSize:"11px",
            color:"#FF4700", fontFamily:"monospace", display:"flex", alignItems:"center", gap:"6px",
          }}>
            ⊕ {targetSys.name}
            {currentSys && <span style={{ color:"#663", fontSize:"10px" }}>
              {(Math.sqrt((targetSys.x-currentSys.x)**2+(targetSys.y-currentSys.y)**2+(targetSys.z-currentSys.z)**2) / LY_M).toFixed(1)} LY
            </span>}
            <span onClick={() => setTargetSys(null)} style={{ cursor:"pointer", color:"rgba(255,71,0,0.5)", fontSize:"13px", lineHeight:1 }} title="Clear target">✕</span>
          </div>
        )}

        {locating && <span style={{ color:"#444", fontSize:"11px" }}>locating…</span>}

        {/* Re-detect button */}
        {loadState.done && (
          <button onClick={detectCurrentSystem} style={{
            fontSize:"10px", padding:"3px 8px", cursor:"pointer",
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
            color:"#444", borderRadius:"4px",
          }}>⟳ Locate me</button>
        )}

        {/* Export buttons */}
        {reachableSystems.length > 0 && (
          <>
            <button onClick={exportAll} style={{
              fontSize:"10px", padding:"3px 8px", cursor:"pointer",
              background:"rgba(255,160,50,0.07)", border:"1px solid rgba(255,160,50,0.2)",
              color: copied==="all" ? "#ffa032" : "#666", borderRadius:"4px", marginLeft:"auto",
            }}>{copied==="all" ? "✓ Copied!" : `Export All (${reachableSystems.length})`}</button>
            {selectedSys && (
              <button onClick={exportSelected} style={{
                fontSize:"10px", padding:"3px 8px", cursor:"pointer",
                background:"rgba(0,232,255,0.07)", border:"1px solid rgba(0,232,255,0.2)",
                color: copied==="selected" ? "#00e8ff" : "#555", borderRadius:"4px",
              }}>{copied==="selected" ? "✓ Copied!" : "Export Selected"}</button>
            )}
          </>
        )}

        {!loadState.done && loadState.total > 0 && (
          <div style={{ marginLeft:"auto", width:"110px", height:"3px",
            background:"rgba(255,255,255,0.07)", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"#ffa032", transition:"width 0.2s" }} />
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:"flex", minHeight:0, overflow:"hidden" }}>

        {/* Left sidebar — system list */}
        <div style={{
          width:"240px", flexShrink:0, background:"rgba(4,6,14,0.97)",
          borderRight:"1px solid rgba(255,160,50,0.10)",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}>
          {/* Current system selector / manual search */}
          {!currentSys && loadState.done && (
            <div style={{ padding:"12px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color:"#ffa032", fontSize:"11px", marginBottom:"8px" }}>Set current system</div>
              <div style={{ position:"relative" }}>
                <input
                  value={manualSearchQ}
                  onChange={e => handleManualSearch(e.target.value)}
                  placeholder="Search system name…"
                  style={inputSx}
                />
                {manualResults.length > 0 && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200,
                    background:"#0a0c14", border:"1px solid rgba(255,160,50,0.2)", borderRadius:"4px", marginTop:"2px" }}>
                    {manualResults.map(s => (
                      <div key={s.id}
                        onClick={() => { setCurrentAndStore(s, "manual"); setManualSearchQ(""); setManualResults([]); }}
                        style={{ padding:"5px 10px", fontSize:"11px", color:"#bbb", cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(255,160,50,0.08)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {s.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Change current system (when already set) */}
          {currentSys && loadState.done && (
            <div style={{ padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showChangeCurrentInput ? "6px" : "0" }}>
                <span style={{ color:"#00e8ff", fontSize:"10px", fontFamily:"monospace" }}>⊙ {currentSys.name}</span>
                <button
                  onClick={() => { setShowChangeCurrentInput(v => !v); setChangeCurrentQ(""); setChangeCurrentResults([]); }}
                  style={{ fontSize:"9px", padding:"2px 6px", cursor:"pointer",
                    background:"rgba(0,232,255,0.06)", border:"1px solid rgba(0,232,255,0.2)",
                    color:"#00e8ff", borderRadius:"3px" }}>
                  {showChangeCurrentInput ? "✕" : "change"}
                </button>
              </div>
              {showChangeCurrentInput && (
                <div style={{ position:"relative" }}>
                  <input
                    value={changeCurrentQ}
                    onChange={e => handleChangeCurrentSearch(e.target.value)}
                    placeholder="Type system name…"
                    autoFocus
                    style={inputSx}
                  />
                  {changeCurrentResults.length > 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200,
                      background:"#0a0c14", border:"1px solid rgba(0,232,255,0.2)", borderRadius:"4px", marginTop:"2px" }}>
                      {changeCurrentResults.map(s => (
                        <div key={s.id}
                          onClick={() => {
                            setCurrentAndStore(s, "manual");
                            setChangeCurrentQ(""); setChangeCurrentResults([]);
                            setShowChangeCurrentInput(false);
                          }}
                          style={{ padding:"5px 10px", fontSize:"11px", color:"#bbb", cursor:"pointer" }}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(0,232,255,0.08)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          {s.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ship / fuel compact selector */}
          <div style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
            <div style={{ display:"flex", gap:"6px", marginBottom:"6px" }}>
              <div style={{ flex:1 }}>
                <label style={labelSx}>SHIP</label>
                <select value={shipId} onChange={e => {
                    const s = SHIPS.find(sh => sh.id===e.target.value) ?? SHIPS[2];
                    setShipId(e.target.value);
                    if (!s.fuels.includes(fuelId)) setFuelId(s.fuels[0]);
                  }}
                  style={{ ...inputSx, cursor:"pointer" } as React.CSSProperties}>
                  {["Shuttle","Frigate","Destroyer","Cruiser","Combat Battlecruiser","Corvette"].map(cls => (
                    <optgroup key={cls} label={cls}>
                      {SHIPS.filter(s => s.classLabel===cls).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <label style={labelSx}>FUEL</label>
                <select value={fuelId} onChange={e => setFuelId(e.target.value)}
                  style={{ ...inputSx, cursor:"pointer" } as React.CSSProperties}>
                  {FUELS.filter(f => ship.fuels.includes(f.id)).map(f => (
                    <option key={f.id} value={f.id}>{f.id.toUpperCase()} ({f.quality})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <label style={{ ...labelSx, marginBottom:2 }}>FUEL LOADED</label>
                <input type="number" min={0} max={ship.fuelCap}
                  value={fuelUnits===0 ? ship.fuelCap : fuelUnits}
                  onChange={e => setFuelUnits(Math.min(+e.target.value, ship.fuelCap))}
                  style={{ ...inputSx, width:"90px" }} />
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#444", fontSize:"10px" }}>Max range</div>
                <div style={{ color:"#7fb", fontSize:"13px", fontWeight:700 }}>{maxRangeLY.toFixed(0)} LY</div>
              </div>
            </div>
          </div>

          {/* Search + sort controls */}
          {reachableSystems.length > 0 && (
            <div style={{ padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
              <input
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                placeholder="🔍 Filter systems…"
                style={{ ...inputSx, marginBottom:"6px" }}
              />
              <div style={{ display:"flex", gap:"4px" }}>
                {(["distance","name","region"] as SortKey[]).map(k => (
                  <button key={k} onClick={() => setSortKey(k)} style={{
                    flex:1, fontSize:"9px", padding:"3px 4px", cursor:"pointer",
                    background: sortKey===k ? "rgba(255,160,50,0.15)" : "rgba(255,255,255,0.03)",
                    border:`1px solid ${sortKey===k ? "rgba(255,160,50,0.4)" : "rgba(255,255,255,0.07)"}`,
                    color: sortKey===k ? "#ffa032" : "#444", borderRadius:"3px", letterSpacing:"0.04em",
                  }}>{k.toUpperCase()}</button>
                ))}
              </div>
            </div>
          )}

          {/* System list */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {!currentSys && loadState.done && (
              <div style={{ padding:"20px 12px", color:"#333", fontSize:"11px", textAlign:"center" }}>
                Set your current system above<br/>to see reachable destinations.
              </div>
            )}
            {displayList.map(s => {
              const isSelected = selectedSys?.id === s.id;
              return (
                <div key={s.id}
                  onClick={() => handleSelectSystem(s)}
                  style={{
                    padding:"7px 12px", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.03)",
                    background: isSelected ? "rgba(0,232,255,0.07)" : "transparent",
                    borderLeft: isSelected ? "2px solid #00e8ff" : "2px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ color: isSelected ? "#00e8ff" : "#bbb", fontSize:"11px", fontWeight: isSelected ? 700 : 400 }}>
                      {s.name}
                    </span>
                    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                      <span style={{ fontSize:"10px", color: distColor(s.distLY, maxRangeLY).getStyle() }}>
                        {s.distLY.toFixed(1)} LY
                      </span>
                      <span
                        title={`Copy EVE link for ${s.name}`}
                        onClick={e => { e.stopPropagation(); copyToClipboard(systemLink(s), `sys-${s.id}`); }}
                        style={{ cursor:"pointer", color: copied===`sys-${s.id}` ? "#ffa032" : "#2a2a3a", fontSize:"11px", lineHeight:1 }}>
                        {copied===`sys-${s.id}` ? "✓" : "⧉"}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"3px", marginTop:"2px", flexWrap:"wrap" }}>
                    {s.regionName && (
                      <span style={{ color:"#2a3545", fontSize:"10px", marginRight:2 }}>{s.regionName}</span>
                    )}
                    {/* Planet type dots from static index */}
                    {(planetIdx[String(s.id)] ?? []).map(([code, cnt], i) => {
                      const info = PLANET_SHORT[code];
                      return info ? (
                        <span key={i} title={`${info.full} ×${cnt}`} style={{
                          display:"inline-block", width:6, height:6, borderRadius:"50%",
                          background: info.color, opacity: 0.85,
                        }} />
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3D viewport */}
        <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0 }}>
          <div ref={mountRef}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setTooltip(null)}
            onMouseDown={onMouseDown}
            onClick={onMapClick}
            style={{ width:"100%", height:"100%", position:"absolute", inset:0 }}
          />

          {tooltip && (
            <div style={{ position:"absolute", left:tooltip.x, top:tooltip.y, pointerEvents:"none",
              background:"rgba(4,6,12,0.95)", border:"1px solid rgba(255,160,50,0.4)",
              borderRadius:"4px", padding:"4px 10px", fontSize:"11px",
              color:"#ffa032", fontFamily:"monospace", whiteSpace:"nowrap", zIndex:10 }}>
              {tooltip.name}
            </div>
          )}

          {/* Legend */}
          {currentSys && reachableSystems.length > 0 && (
            <div style={{ position:"absolute", bottom:"10px", left:"10px", pointerEvents:"none",
              background:"rgba(4,6,14,0.90)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:"6px", padding:"12px 16px", fontSize:"12px" }}>
              <div style={{ color:"#556", marginBottom:"6px", letterSpacing:"0.08em", fontWeight:600 }}>DISTANCE</div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ width:"80px", height:"6px", borderRadius:"3px",
                  background:"linear-gradient(to right, #00ff00, #ffff00, #ff0000)" }} />
                <span style={{ color:"#667" }}>0 → {maxRangeLY.toFixed(0)} LY</span>
              </div>
              <div style={{ marginTop:"6px", display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#00e8ff" }} />
                <span style={{ color:"#667" }}>Current position</span>
              </div>
              <div style={{ color:"#556", marginTop:"10px", marginBottom:"4px", letterSpacing:"0.08em", fontWeight:600 }}>RANGE SHELLS</div>
              <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                {[["25%","#00ff66"],["50%","#aaff00"],["75%","#ffaa00"],["100%","#ff3300"]].map(([label, color]) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                    <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", border:`1.5px solid ${color}`, opacity:0.7 }} />
                    <span style={{ color:"#556", fontSize:"10px" }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ color:"#556", marginTop:"10px", marginBottom:"6px", letterSpacing:"0.08em", fontWeight:600 }}>PLANETS</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"4px 14px" }}>
                {Object.entries(PLANET_SHORT).map(([code, info]) => (
                  <div key={code} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                    <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background: info.color, flexShrink:0 }} />
                    <span style={{ color:"#667", fontSize:"11px" }}>{info.full}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadState.done && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
              justifyContent:"center", color:"#1e2030", fontSize:"13px", pointerEvents:"none" }}>
              {loadState.total===0 ? "Connecting…" : `Loading star chart…  ${pct}%`}
            </div>
          )}

          <div style={{ position:"absolute", bottom:"10px", right:"14px", color:"#131620",
            fontSize:"10px", letterSpacing:"0.06em", textAlign:"right", pointerEvents:"none" }}>
            LEFT DRAG: ORBIT · RIGHT DRAG: PAN · SCROLL: ZOOM · CLICK: SELECT
          </div>
        </div>

        {/* Right panel — system detail */}
        {selectedSys && (
          <div style={{
            width:"220px", flexShrink:0, background:"rgba(4,6,14,0.97)",
            borderLeft:"1px solid rgba(255,160,50,0.10)",
            display:"flex", flexDirection:"column", overflow:"hidden",
          }}>
            <div style={{ padding:"14px", flex:1, overflowY:"auto" }}>
              {/* 3D Planetary Orrery */}
              <SystemOrrery planets={systemDetail?.planets ?? []} />

              <div style={{ color:"#00e8ff", fontWeight:700, fontSize:"13px", marginBottom:"4px" }}>
                {selectedSys.name}
              </div>
              <div style={{ color: distColor(selectedSys.distLY, maxRangeLY).getStyle(), fontSize:"12px", marginBottom:"12px" }}>
                {selectedSys.distLY.toFixed(2)} LY from {currentSys?.name ?? "origin"}
              </div>

              {/* Copy EVE link */}
              <button onClick={() => copyToClipboard(systemLink(selectedSys), "detail")} style={{
                width:"100%", padding:"6px", borderRadius:"4px", cursor:"pointer", marginBottom:"12px",
                background: copied==="detail" ? "rgba(255,160,50,0.15)" : "rgba(255,255,255,0.04)",
                border:`1px solid ${copied==="detail" ? "rgba(255,160,50,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: copied==="detail" ? "#ffa032" : "#555", fontSize:"11px",
              }}>
                {copied==="detail" ? "✓ Copied EVE link!" : "⧉ Copy EVE Link"}
              </button>

              {detailLoading && (
                <div style={{ color:"#2a3545", fontSize:"11px" }}>Loading details…</div>
              )}

              {systemDetail && !detailLoading && (
                <>
                  {systemDetail.region && (
                    <div style={{ marginBottom:"8px" }}>
                      <div style={{ ...labelSx }}>REGION</div>
                      <div style={{ color:"#888", fontSize:"11px" }}>{systemDetail.region}</div>
                    </div>
                  )}

                  {systemDetail.securityClass && (
                    <div style={{ marginBottom:"8px" }}>
                      <div style={{ ...labelSx }}>SECURITY CLASS</div>
                      <div style={{ color:"#888", fontSize:"11px" }}>{systemDetail.securityClass}</div>
                    </div>
                  )}

                  <div style={{ marginBottom:"8px" }}>
                    <div style={{ ...labelSx }}>PLANETS ({systemDetail.planetCount ?? 0})</div>
                    {(systemDetail.planets ?? []).length > 0 ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                        {systemDetail.planets!.map((p, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"10px" }}>
                            <span style={{
                              display:"inline-block", width:8, height:8, borderRadius:"50%",
                              background: planetDot(p.typeName), flexShrink:0,
                            }} />
                            <span style={{ color:"#aaa", flex:1 }}>{p.typeName.replace("Planet (", "").replace(")", "")}</span>
                            <span style={{ color:"#555" }}>×{p.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color:"#333", fontSize:"10px" }}>No planet data</div>
                    )}
                  </div>

                  {(systemDetail.connections ?? []).length > 0 && (
                    <div style={{ marginBottom:"8px" }}>
                      <div style={{ ...labelSx }}>GATE CONNECTIONS ({systemDetail.connections!.length})</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:"2px", maxHeight:"80px", overflowY:"auto" }}>
                        {systemDetail.connections!.map(c => (
                          <div key={c.id} style={{ fontSize:"10px", color:"#445" }}>{c.name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Set as current / target */}
              <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", gap:"6px" }}>
                <button
                  onClick={() => {
                    setTargetSys(selectedSys);
                  }}
                  style={{
                    width:"100%", padding:"6px", borderRadius:"4px", cursor:"pointer",
                    background: targetSys?.id === selectedSys.id ? "rgba(255,71,0,0.15)" : "rgba(255,71,0,0.06)",
                    border:"1px solid rgba(255,71,0,0.3)",
                    color:"#FF4700", fontSize:"11px",
                  }}>
                  {targetSys?.id === selectedSys.id ? "✓ Current target" : "⊕ Set as target"}
                </button>
                <button
                  onClick={() => {
                    setCurrentAndStore(selectedSys, "manual");
                    setSelectedSys(null);
                  }}
                  style={{
                    width:"100%", padding:"6px", borderRadius:"4px", cursor:"pointer",
                    background:"rgba(0,232,255,0.06)", border:"1px solid rgba(0,232,255,0.2)",
                    color:"#00e8ff", fontSize:"11px",
                  }}>
                  ⊙ Set as current system
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
