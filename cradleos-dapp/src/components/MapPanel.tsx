/**
 * CradleOS Starmap — 3D  ·  System Search  ·  Jump Route Planner
 *
 * Jump mechanics — canonical source: ef-map.com/llms-full.txt (verified 2026-03-13):
 *
 *   Heat-limited single hop (max LY per jump):
 *     range_LY = (ΔT × C_eff × M_hull) / (3 × M_current)
 *     ΔT = 150 − current_temp  ·  C_eff = specificHeat × (1 + adaptiveLevel × 0.02)
 *     M_hull = bare hull mass kg  ·  M_current = loaded mass kg
 *
 *   Fuel-limited total trip (max LY with tank):
 *     range_LY = (fuelUnits × fuel_quality) / (FUEL_K × ship_mass_kg)
 *     FUEL_K = 1e-7  (canonical)  ·  VOL_PER_UNIT = 0.28 m³ (cargo calc only)
 *
 *   Fuel quality (canonical, ef-map 2026-02-18):
 *     D1 = 0.10  ·  D2 = 0.15  ·  SOF-40/EU-40 = 0.40  ·  SOF-80 = 0.80  ·  EU-90 = 0.90
 *
 * All ship stats (massKg, fuelCap, specificHeat) — ef-map canonical + in-game screenshots.
 * Galaxy: 24 502 systems  ·  Controls: left-drag orbit · right-drag pan · scroll zoom · hover name
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

const WORLD_API  = "https://world-api-utopia.uat.pub.evefrontier.com";
const CACHE_KEY  = "cradleos:starmap:v5";
const BATCH      = 500;
const CONCURRENT = 10;
const SCALE      = 1 / 3e16;          // world metres → Three.js units
const LY_M       = 9.461e15;          // metres per light year
const MAX_JUMPS  = 500;

// ── Types ─────────────────────────────────────────────────────────────────────

type SolarSystem = {
  id: number; name: string; regionId: number;
  x: number; y: number; z: number;    // metres
  gateLinks?: number[];               // connected system IDs (empty in current UAT build)
};

// ── Ship table — all values confirmed from in-game ATTRIBUTES screenshots ────────
type ShipSpec = {
  id: string; name: string; classLabel: string;
  massKg: number;        // bare hull mass (kg) — confirmed in-game
  fuelCap: number;       // Fuel Capacity (units) — confirmed in-game
  specificHeat: number;  // Specific Heat (C) — confirmed in-game; used in heat formula
  fuels: string[];       // compatible fuel IDs
};

// Fuel compatibility (confirmed by Raw):
//   Shuttle          → D1/D2 only
//   Frigate and above → refined only (EU-40 / SOF-80 / EU-90)
//   Corvette         → D1/D2 only (confirmed by Raw 2026-03-12)
const SHUTTLE_FUELS  = ["d1","d2"];
const REFINED_FUELS  = ["sof40","eu40","sof80","eu90"];
const CORVETTE_FUELS = ["d1","d2"];  // confirmed: D1/D2 only (Raw 2026-03-12)

// All mass/specificHeat values: ef-map.com canonical (2026-02-18) + in-game screenshots
const SHIPS: ShipSpec[] = [
  // Shuttle — D1/D2 only (not in ef-map ship DB; warp-only or basic fuel only)
  { id: "wend",    name: "Wend",   classLabel: "Shuttle",               massKg:    6_800_000, fuelCap:     200, specificHeat:  2.0, fuels: SHUTTLE_FUELS },
  // Frigates — refined only (confirmed)
  { id: "lai",     name: "LAI",    classLabel: "Frigate",               massKg:   18_929_160, fuelCap:   2_400, specificHeat:  2.5, fuels: REFINED_FUELS },
  { id: "usv",     name: "USV",    classLabel: "Frigate",               massKg:   30_266_600, fuelCap:   2_420, specificHeat:  1.8, fuels: REFINED_FUELS },
  { id: "lorha",   name: "LORHA",  classLabel: "Frigate",               massKg:   42_691_330, fuelCap:   2_508, specificHeat:  2.5, fuels: REFINED_FUELS },
  { id: "haf",     name: "HAF",    classLabel: "Frigate",               massKg:   81_883_000, fuelCap:   4_184, specificHeat:  2.5, fuels: REFINED_FUELS },
  { id: "mcf",     name: "MCF",    classLabel: "Frigate",               massKg:   52_313_760, fuelCap:   6_548, specificHeat:  2.5, fuels: REFINED_FUELS },
  // Destroyer and above — refined only
  { id: "tades",   name: "TADES",  classLabel: "Destroyer",             massKg:   74_655_480, fuelCap:   5_972, specificHeat:  2.5, fuels: REFINED_FUELS },
  { id: "maul",    name: "MAUL",   classLabel: "Cruiser",               massKg:  548_435_920, fuelCap:  24_160, specificHeat:  2.5, fuels: REFINED_FUELS },
  { id: "chumaq",  name: "Chumaq", classLabel: "Combat Battlecruiser",  massKg: 1_487_392_000, fuelCap: 270_585, specificHeat: 3.0, fuels: REFINED_FUELS },
  // Corvettes — D1/D2 only (confirmed 2026-03-12); masses ef-map canonical
  { id: "recurve", name: "Recurve",classLabel: "Corvette",              massKg:   10_200_000, fuelCap:     970, specificHeat:  1.0, fuels: CORVETTE_FUELS },
  { id: "reflex",  name: "Reflex", classLabel: "Corvette",              massKg:    9_750_000, fuelCap:   1_750, specificHeat:  3.0, fuels: CORVETTE_FUELS },
  { id: "reiver",  name: "Reiver", classLabel: "Corvette",              massKg:   10_400_000, fuelCap:   1_416, specificHeat:  1.0, fuels: CORVETTE_FUELS },
  { id: "carom",   name: "Carom",  classLabel: "Corvette",              massKg:    7_200_000, fuelCap:   3_000, specificHeat:  8.5, fuels: CORVETTE_FUELS },
  { id: "stride",  name: "Stride", classLabel: "Corvette",              massKg:    7_900_000, fuelCap:   3_200, specificHeat:  8.0, fuels: CORVETTE_FUELS },
];

// ── Fuel specs ────────────────────────────────────────────────────────────────
// Quality values: ef-map.com canonical (2026-02-18).
// D2 API ID still unconfirmed — placeholder 0.
// SOF-40 API ID unconfirmed — placeholder 0.
type FuelSpec = {
  id: string; label: string;
  apiId: number;         // EVE Frontier item ID (0 = unconfirmed)
  massPerUnit: number;   // kg per unit
  volPerUnit: number;    // m³ per unit (0.28 canonical)
  quality: number;       // purity multiplier — ef-map canonical
};

const FUELS: FuelSpec[] = [
  { id: "d1",   label: "D1 — Unstable Fuel", apiId: 77818, massPerUnit: 42, volPerUnit: 0.28, quality: 0.10 },
  { id: "d2",   label: "D2 Fuel",            apiId:     0, massPerUnit:  0, volPerUnit: 0.28, quality: 0.15 },
  { id: "sof40",label: "SOF-40 Fuel",        apiId:     0, massPerUnit: 25, volPerUnit: 0.28, quality: 0.40 },
  { id: "eu40", label: "EU-40 Fuel",         apiId: 78516, massPerUnit: 25, volPerUnit: 0.28, quality: 0.40 },
  { id: "sof80",label: "SOF-80 Fuel",        apiId: 78515, massPerUnit: 30, volPerUnit: 0.28, quality: 0.80 },
  { id: "eu90", label: "EU-90 Fuel",         apiId: 78437, massPerUnit: 30, volPerUnit: 0.28, quality: 0.90 },
];

// ── Jump formulas — ef-map.com canonical (2026-02-18) ─────────────────────────
const MAX_TEMP = 150;
const FUEL_K   = 1e-7;   // canonical trip distance constant

/**
 * Max LY per single jump.
 * range = (ΔT × C_eff × M_hull) / (3 × M_current)
 * C_eff = specificHeat × (1 + adaptiveLevel × 0.02)
 * adaptiveLevel: player skill 0–10 (default 0)
 */
function heatLimitedRange(ship: ShipSpec, currentTempC: number, loadedMassKg: number, adaptiveLevel = 0): number {
  if (currentTempC >= MAX_TEMP) return 0;
  const dT = MAX_TEMP - currentTempC;
  const cEff = ship.specificHeat * (1 + adaptiveLevel * 0.02);
  return Math.max(0, (dT * cEff * ship.massKg) / (3 * loadedMassKg));
}

/**
 * Total LY achievable on fuelUnits of given fuel type.
 * distance = (fuelUnits × fuel_quality) / (FUEL_K × ship_mass_kg)
 */
function fuelLimitedRange(ship: ShipSpec, fuelUnits: number, fuel: FuelSpec): number {
  return (fuelUnits * fuel.quality) / (FUEL_K * ship.massKg);
}

// ── Distance ──────────────────────────────────────────────────────────────────

function dist3dLY(a: SolarSystem, b: SolarSystem): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz) / LY_M;
}

// ── BFS route finder ──────────────────────────────────────────────────────────
// Spatial acceleration: systems pre-sorted by X/LY; binary-search to narrow candidates.

type RouteResult = {
  path: SolarSystem[];
  fuelPerJump: number[];   // fuel units per hop
  totalFuel: number;
};

function findRoute(
  systems: SolarSystem[],
  sortedByX: { idx: number; xLY: number }[],
  fromIdx: number, toIdx: number,
  rangeLY: number,
  fuelPerJumpFn: (distLY: number) => number,
): RouteResult | null {
  if (fromIdx === toIdx) return { path: [systems[fromIdx]], fuelPerJump: [], totalFuel: 0 };

  const rangeM = rangeLY * LY_M;
  const rangeM2 = rangeM * rangeM;
  const xLYArr = sortedByX.map(e => e.xLY);

  const prev    = new Int32Array(systems.length).fill(-1);
  const visited = new Uint8Array(systems.length);
  const queue: number[] = [fromIdx];
  visited[fromIdx] = 1;

  const neighbors = (ci: number): number[] => {
    const cx = systems[ci].x, cy = systems[ci].y, cz = systems[ci].z;
    const cxLY = cx / LY_M;
    let lo = 0, hi = sortedByX.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xLYArr[m] < cxLY - rangeLY) lo = m + 1; else hi = m; }
    const start = lo;
    lo = 0; hi = sortedByX.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (xLYArr[m] > cxLY + rangeLY) hi = m - 1; else lo = m; }
    const end = lo;
    const out: number[] = [];
    for (let i = start; i <= end; i++) {
      const ni = sortedByX[i].idx;
      if (visited[ni]) continue;
      const dx = systems[ni].x - cx, dy = systems[ni].y - cy, dz = systems[ni].z - cz;
      if (dx*dx + dy*dy + dz*dz <= rangeM2) out.push(ni);
    }
    return out;
  };

  for (let jump = 0; jump < MAX_JUMPS; jump++) {
    const lvl = queue.splice(0, queue.length);
    if (lvl.length === 0) break;
    for (const curr of lvl) {
      for (const ni of neighbors(curr)) {
        visited[ni] = 1;
        prev[ni] = curr;
        if (ni === toIdx) {
          const path: SolarSystem[] = [];
          let c = toIdx;
          while (c !== -1) { path.unshift(systems[c]); c = prev[c]; }
          const fuelPerJump: number[] = [];
          let total = 0;
          for (let j = 0; j < path.length - 1; j++) {
            const u = fuelPerJumpFn(dist3dLY(path[j], path[j + 1]));
            fuelPerJump.push(u);
            total += u;
          }
          return { path, fuelPerJump, totalFuel: total };
        }
        queue.push(ni);
      }
    }
  }
  return null;
}

// ── Region colours ────────────────────────────────────────────────────────────

const _rgbCache = new Map<number, [number,number,number]>();
function regionRGB(regionId: number): [number,number,number] {
  if (_rgbCache.has(regionId)) return _rgbCache.get(regionId)!;
  const h = ((_rgbCache.size * 137.508) % 360) / 360;
  const s = 0.6, l = 0.5, q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const c = (t: number) => { if (t<0)t+=1; if(t>1)t-=1; return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p; };
  const rgb: [number,number,number] = [c(h+1/3),c(h),c(h-1/3)];
  _rgbCache.set(regionId, rgb); return rgb;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputSx: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "4px", color: "#ddd", fontSize: "11px", padding: "5px 8px",
  outline: "none", width: "100%", boxSizing: "border-box",
};
const labelSx: React.CSSProperties = {
  color: "#444", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "4px", display: "block",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MapPanel() {
  const mountRef     = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const pointsRef    = useRef<THREE.Points | null>(null);
  const routeGrpRef  = useRef<THREE.Group | null>(null);
  const gateLinesRef  = useRef<THREE.LineSegments | null>(null);
  const reachHaloRef  = useRef<THREE.Points | null>(null);
  const css2dRef      = useRef<CSS2DRenderer | null>(null);
  const haloLabelsRef = useRef<CSS2DObject[]>([]);
  const systemsRef   = useRef<SolarSystem[]>([]);
  const sortedXRef   = useRef<{ idx: number; xLY: number }[]>([]);
  const rafRef       = useRef(0);
  const raycaster    = useRef(new THREE.Raycaster());
  const mouseNDC     = useRef(new THREE.Vector2(-9, -9));
  const mouseDownPos = useRef<{x:number;y:number} | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [loadState, setLoadState]     = useState({ loaded: 0, total: 0, done: false });
  const [tooltip, setTooltip]         = useState<{ x:number; y:number; name:string } | null>(null);
  const [searchQ, setSearchQ]         = useState("");
  const [searchRes, setSearchRes]     = useState<SolarSystem[]>([]);

  // Route planner state
  const [shipId, setShipId]           = useState("usv");   // USV default → eu40 compatible
  const [fuelId, setFuelId]           = useState("eu40");
  const [fuelUnits, setFuelUnits]     = useState<number>(0);      // 0 = full tank
  const [currentTemp, setCurrentTemp] = useState<number>(0);      // °C, 0–149
  const [cargoKt, setCargoKt]         = useState<number>(0);      // extra mass in kilotonnes
  const [fromQ, setFromQ]             = useState("");
  const [fromRes, setFromRes]         = useState<SolarSystem[]>([]);
  const [fromSys, setFromSys]         = useState<SolarSystem | null>(null);
  const [toQ, setToQ]                 = useState("");
  const [toRes, setToRes]             = useState<SolarSystem[]>([]);
  const [toSys, setToSys]             = useState<SolarSystem | null>(null);
  const [routeState, setRouteState]   = useState<RouteResult | "calculating" | "not_found" | null>(null);
  const [manualHopLY, setManualHopLY] = useState<string>("");   // overrides heat formula when set
  const [activeField, setActiveField] = useState<"from" | "to">("from");  // which picker gets map clicks

  const ship = SHIPS.find(s => s.id === shipId) ?? SHIPS[2];
  const fuel = FUELS.find(f => f.id === fuelId) ?? FUELS[1];

  const loadedMassKg   = ship.massKg + cargoKt * 1_000_000;
  const tankUnits      = fuelUnits > 0 ? Math.min(fuelUnits, ship.fuelCap) : ship.fuelCap;
  const heatRangeLY    = useMemo(
    () => heatLimitedRange(ship, currentTemp, loadedMassKg),
    [ship, currentTemp, loadedMassKg]
  );
  const fuelRangeLY    = useMemo(
    () => fuelLimitedRange(ship, tankUnits, fuel),
    [ship, tankUnits, fuel]
  );
  // BFS hop limit: manual override takes precedence over heat formula
  const parsedManual   = parseFloat(manualHopLY);
  const effectiveRange = (!isNaN(parsedManual) && parsedManual > 0) ? parsedManual : heatRangeLY;

  // Pre-load override with fuel-limited max range whenever ship/fuel/tank changes
  useEffect(() => {
    setManualHopLY(Math.round(fuelRangeLY).toString());
  }, [shipId, fuelId, tankUnits]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Three.js init ──────────────────────────────────────────────────────────

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040608);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / (mount.clientHeight || 1), 0.1, 50000);
    camera.position.set(0, 0, 800);
    camera.up.set(0, 1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.screenSpacePanning = true; controls.minDistance = 1; controls.maxDistance = 10000;
    controlsRef.current = controls;

    // CSS2D label renderer (overlays HTML at 3D world positions)
    const css2d = new CSS2DRenderer();
    css2d.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
    css2d.domElement.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";
    mount.appendChild(css2d.domElement);
    css2dRef.current = css2d;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      // Hide CSS2D halo labels when zoomed too far out — reduces clutter and prevents scroll-steal
      const camDist = camera.position.length();
      if (css2dRef.current) {
        css2dRef.current.domElement.style.display = camDist < 600 ? "block" : "none";
      }
      if (camDist < 600) css2d.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h); css2d.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount); setTimeout(onResize, 0);

    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect(); controls.dispose(); renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (mount.contains(css2d.domElement)) mount.removeChild(css2d.domElement);
    };
  }, []);

  // ── Build star cloud ───────────────────────────────────────────────────────

  const buildPoints = useCallback((systems: SolarSystem[]) => {
    const scene = sceneRef.current, camera = cameraRef.current, ctrl = controlsRef.current;
    if (!scene || !camera || !ctrl || !systems.length) return;

    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      (pointsRef.current.material as THREE.Material).dispose();
      pointsRef.current = null;
    }

    const n = systems.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = systems[i];
      pos[i*3]=s.x*SCALE;  pos[i*3+1]=s.z*SCALE;  pos[i*3+2]=-s.y*SCALE;
      const [r,g,b]=regionRGB(s.regionId); col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col,3));
    geo.computeBoundingSphere();

    const mat = new THREE.PointsMaterial({ size:1.5, sizeAttenuation:false, vertexColors:true, transparent:true, opacity:0.9 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts); pointsRef.current = pts;

    // Spatial index
    sortedXRef.current = systems.map((s,idx) => ({ idx, xLY: s.x / LY_M })).sort((a,b) => a.xLY - b.xLY);

    // Gate connection lines
    if (gateLinesRef.current) { scene.remove(gateLinesRef.current); gateLinesRef.current = null; }
    const idToIdx = new Map<number, number>(systems.map((s,i) => [s.id, i]));
    const gatePositions: number[] = [];
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i];
      if (!s.gateLinks?.length) continue;
      for (const targetId of s.gateLinks) {
        const j = idToIdx.get(targetId);
        if (j === undefined || j <= i) continue;  // dedup: only draw A→B when A < B
        gatePositions.push(s.x*SCALE, s.z*SCALE, -s.y*SCALE,
                          systems[j].x*SCALE, systems[j].z*SCALE, -systems[j].y*SCALE);
      }
    }
    if (gatePositions.length > 0) {
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gatePositions), 3));
      const gMat = new THREE.LineBasicMaterial({ color: 0x1a4a6a, transparent: true, opacity: 0.6 });
      const lines = new THREE.LineSegments(gGeo, gMat);
      scene.add(lines);
      gateLinesRef.current = lines;
    }

    // Frame
    const sphere = geo.boundingSphere!, dist = sphere.radius * 2.2;
    camera.up.set(0, 1, 0);
    ctrl.target.copy(sphere.center);
    camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + dist);
    camera.lookAt(sphere.center.x, sphere.center.y, sphere.center.z);
    ctrl.update();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const data: SolarSystem[] = JSON.parse(cached);
          systemsRef.current = data; setLoadState({ loaded: data.length, total: data.length, done: true }); buildPoints(data); return;
        }
      } catch { /* stale */ }

      const first = await fetch(`${WORLD_API}/v2/solarsystems?limit=1`).then(r=>r.json()) as { metadata:{total:number} };
      if (cancelled) return;
      const total = first.metadata.total, pages = Math.ceil(total / BATCH);
      setLoadState({ loaded:0, total, done:false });

      const all: SolarSystem[] = [];
      for (let wave = 0; wave < pages && !cancelled; wave += CONCURRENT) {
        const fns = [];
        for (let p = wave; p < Math.min(wave+CONCURRENT,pages); p++) {
          fns.push(fetch(`${WORLD_API}/v2/solarsystems?limit=${BATCH}&offset=${p*BATCH}`)
            .then(r=>r.json() as Promise<{data:Array<{id:number;name:string;regionId:number;location:{x:number;y:number;z:number}}>}>)
            .then(d=>d.data.map(s=>({ id:s.id, name:s.name, regionId:s.regionId, x:s.location.x, y:s.location.y, z:s.location.z, gateLinks: (s as { gateLinks?: number[] }).gateLinks ?? [] }))));
        }
        const chunks = await Promise.all(fns); if (cancelled) return;
        for (const c of chunks) all.push(...c);
        setLoadState({ loaded:all.length, total, done:false });
      }
      if (cancelled) return;
      systemsRef.current = all; setLoadState({ loaded:all.length, total, done:true }); buildPoints(all);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(all)); } catch { /* quota */ }
    };
    load().catch(console.error);
    return () => { cancelled = true; };
  }, [buildPoints]);

  // ── Camera helpers ─────────────────────────────────────────────────────────

  const flyTo = useCallback((sys: SolarSystem) => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const tx=sys.x*SCALE, ty=sys.z*SCALE, tz=-sys.y*SCALE;
    ctrl.target.set(tx,ty,tz); cam.position.set(tx, ty, tz+60); cam.lookAt(tx,ty,tz); cam.up.set(0,1,0); ctrl.update();
  }, []);

  const handleReset = useCallback(() => {
    const pts=pointsRef.current, cam=cameraRef.current, ctrl=controlsRef.current; if(!pts||!cam||!ctrl) return;
    pts.geometry.computeBoundingSphere();
    const s=pts.geometry.boundingSphere!, d=s.radius*2.2;
    ctrl.target.copy(s.center); cam.position.set(s.center.x, s.center.y, s.center.z+d);
    cam.lookAt(s.center.x, s.center.y, s.center.z); cam.up.set(0,1,0); ctrl.update();
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────

  const search = useCallback((q: string, limit=8) => {
    if (q.length < 2) return [];
    const ql = q.toLowerCase();
    return systemsRef.current.filter(s => s.name.toLowerCase().includes(ql)).slice(0, limit);
  }, []);

  // ── Route overlay ──────────────────────────────────────────────────────────

  const drawRoute = useCallback((path: SolarSystem[]) => {
    const scene = sceneRef.current; if (!scene) return;
    if (routeGrpRef.current) { scene.remove(routeGrpRef.current); routeGrpRef.current = null; }
    if (path.length < 2) return;
    const grp = new THREE.Group();
    const pts = path.map(s => new THREE.Vector3(s.x*SCALE, s.z*SCALE, -s.y*SCALE));
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color:0xffa032, transparent:true, opacity:0.7 })));
    const sg = new THREE.SphereGeometry(2,6,6);
    path.forEach((s,i) => {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: i===0?0x00ff96:i===path.length-1?0xff4444:0x444466 }));
      m.scale.setScalar(i===0||i===path.length-1?2.5:0.4);
      m.position.set(s.x*SCALE, s.z*SCALE, -s.y*SCALE);
      grp.add(m);
    });
    scene.add(grp); routeGrpRef.current = grp;
  }, []);

  // ── Reachable systems halo ────────────────────────────────────────────────────

  // Stable callback passed into drawReachHalo closure for label clicks
  const onSetTo = useCallback((sys: SolarSystem) => {
    setToSys(sys); setToQ(sys.name); setToRes([]);
    setActiveField("to");
  }, []);

  const drawReachHalo = useCallback((origin: SolarSystem, rangeLY: number) => {
    const scene = sceneRef.current; if (!scene) return;

    // Clear old halo + labels
    if (reachHaloRef.current) { scene.remove(reachHaloRef.current); reachHaloRef.current = null; }
    for (const lbl of haloLabelsRef.current) scene.remove(lbl);
    haloLabelsRef.current = [];
    if (rangeLY <= 0) return;

    const systems = systemsRef.current, sorted = sortedXRef.current;
    if (!systems.length) return;

    const rangeM = rangeLY * LY_M, rangeM2 = rangeM * rangeM;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const oxLY = ox / LY_M;
    const xLYArr = sorted.map(e => e.xLY);

    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xLYArr[m] < oxLY - rangeLY) lo = m + 1; else hi = m; }
    const start = lo;
    lo = 0; hi = sorted.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (xLYArr[m] > oxLY + rangeLY) hi = m - 1; else lo = m; }
    const end = lo;

    const pts: number[] = [];
    const inRange: SolarSystem[] = [];
    for (let i = start; i <= end; i++) {
      const s = systems[sorted[i].idx];
      if (s.id === origin.id) continue;
      const dx = s.x - ox, dy = s.y - oy, dz = s.z - oz;
      if (dx*dx + dy*dy + dz*dz <= rangeM2) {
        pts.push(s.x*SCALE, s.z*SCALE, -s.y*SCALE);
        inRange.push(s);
      }
    }

    if (!pts.length) return;

    // Halo point cloud
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    const mat = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, color: 0x00e8ff, transparent: true, opacity: 0.85 });
    const halo = new THREE.Points(geo, mat);
    scene.add(halo);
    reachHaloRef.current = halo;

    // CSS2D name labels — clickable to set TO system
    // Cap at closest 60 systems so the view stays readable when range is large
    const distTo = (s: SolarSystem) => {
      const dx = s.x - origin.x, dy = s.y - origin.y, dz = s.z - origin.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };
    const labelSystems = [...inRange].sort((a, b) => distTo(a) - distTo(b)).slice(0, 60);
    const newLabels: CSS2DObject[] = [];
    for (const s of labelSystems) {
      const div = document.createElement("div");
      div.textContent = s.name;
      div.style.cssText = [
        "color:#00e8ff",
        "font:10px/1 monospace",
        "white-space:nowrap",
        "padding:2px 6px",
        "background:rgba(0,12,20,0.75)",
        "border:1px solid rgba(0,232,255,0.15)",
        "border-radius:3px",
        "pointer-events:auto",
        "cursor:pointer",
        "transform:translate(6px,-50%)",
        "text-shadow:0 0 6px rgba(0,232,255,0.5)",
        "transition:background 0.1s",
      ].join(";");
      div.addEventListener("mouseenter", () => { div.style.background = "rgba(0,50,70,0.9)"; div.style.color = "#fff"; });
      div.addEventListener("mouseleave", () => { div.style.background = "rgba(0,12,20,0.75)"; div.style.color = "#00e8ff"; });
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        onSetTo(s);
      });
      const label = new CSS2DObject(div);
      label.position.set(s.x*SCALE, s.z*SCALE, -s.y*SCALE);
      scene.add(label);
      newLabels.push(label);
    }
    haloLabelsRef.current = newLabels;
  }, [onSetTo]);

  useEffect(() => {
    if (fromSys && effectiveRange > 0) drawReachHalo(fromSys, effectiveRange);
    else if (sceneRef.current) {
      if (reachHaloRef.current) { sceneRef.current.remove(reachHaloRef.current); reachHaloRef.current = null; }
      for (const lbl of haloLabelsRef.current) sceneRef.current.remove(lbl);
      haloLabelsRef.current = [];
    }
  }, [fromSys, effectiveRange, drawReachHalo]);

  // ── Calculate route ────────────────────────────────────────────────────────

  const handleCalc = useCallback(() => {
    if (!fromSys || !toSys) return;
    setRouteState("calculating");
    setTimeout(() => {
      const systems = systemsRef.current, sorted = sortedXRef.current;
      if (!systems.length || !sorted.length) { setRouteState("not_found"); return; }
      const fi = systems.findIndex(s => s.id === fromSys.id);
      const ti = systems.findIndex(s => s.id === toSys.id);
      if (fi < 0 || ti < 0) { setRouteState("not_found"); return; }
      const result = findRoute(systems, sorted, fi, ti, effectiveRange,
        (dLY) => {
          // Fuel consumed per jump ∝ distance / effective_range × fuel_per_jump_baseline
          // Simplified: assume one "jump unit" of fuel per hop; total distance given separately
          return Math.ceil(dLY / Math.max(effectiveRange, 0.1) * (tankUnits / Math.max(fuelRangeLY / Math.max(effectiveRange, 0.1), 1)));
        });
      if (result) { setRouteState(result); drawRoute(result.path); flyTo(fromSys); }
      else setRouteState("not_found");
    }, 20);
  }, [fromSys, toSys, effectiveRange, fuelRangeLY, tankUnits, drawRoute, flyTo]);

  // ── Hover ──────────────────────────────────────────────────────────────────

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mount=mountRef.current, cam=cameraRef.current, pts=pointsRef.current;
    if (!mount||!cam||!pts) return;
    const rect=mount.getBoundingClientRect();
    mouseNDC.current.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.current.params.Points={threshold:3};
    raycaster.current.setFromCamera(mouseNDC.current, cam);
    const hits=raycaster.current.intersectObject(pts);
    if (hits.length>0 && hits[0].index!=null) {
      const sys=systemsRef.current[hits[0].index];
      if (sys) { setTooltip({ x:e.clientX-rect.left+14, y:e.clientY-rect.top-10, name:sys.name }); return; }
    }
    setTooltip(null);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const down = mouseDownPos.current;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.sqrt(dx*dx + dy*dy) > 6) return;  // ignore drag
    }
    const mount = mountRef.current, cam = cameraRef.current, pts = pointsRef.current;
    if (!mount || !cam || !pts) return;
    const rect = mount.getBoundingClientRect();
    const ndx = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
    const ndy = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
    raycaster.current.params.Points = { threshold: 5 };
    raycaster.current.setFromCamera(new THREE.Vector2(ndx, ndy), cam);
    const hits = raycaster.current.intersectObject(pts);
    if (hits.length > 0 && hits[0].index != null) {
      const sys = systemsRef.current[hits[0].index];
      if (!sys) return;
      if (activeField === "from") {
        setFromSys(sys); setFromQ(sys.name); setFromRes([]);
        flyTo(sys);
        setActiveField("to");   // auto-advance to TO after FROM is set
      } else {
        setToSys(sys); setToQ(sys.name); setToRes([]);
      }
    }
  }, [activeField, flyTo]);

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
        <span style={{ color:"#ffa032", fontWeight:700, fontSize:"13px" }}>STARMAP 3D</span>
        <span style={{ color:"#333", fontSize:"11px" }}>
          {loadState.done ? `${loadState.loaded.toLocaleString()} systems`
            : loadState.total > 0 ? `Loading… ${pct}%` : "Connecting…"}
        </span>

        {/* Search */}
        {loadState.done && (
          <div style={{ position:"relative", flex:"1", minWidth:"150px", maxWidth:"240px" }}>
            <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setSearchRes(search(e.target.value)); }}
              placeholder="🔍 Find system…"
              style={{ ...inputSx, padding:"5px 8px" }} />
            {searchRes.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:100, background:"#0a0c14",
                border:"1px solid rgba(255,160,50,0.2)", borderRadius:"4px", marginTop:"2px" }}>
                {searchRes.map(s => (
                  <div key={s.id} onClick={() => { flyTo(s); setSearchQ(s.name); setSearchRes([]); }}
                    style={{ padding:"6px 10px", fontSize:"11px", color:"#bbb", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,160,50,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loadState.done && <>
          <button onClick={handleReset} style={{
            fontSize:"11px", padding:"4px 10px", cursor:"pointer",
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
            color:"#444", borderRadius:"4px",
          }}>⊡ Fit</button>
        </>}

        {!loadState.done && loadState.total > 0 && (
          <div style={{ marginLeft:"auto", width:"110px", height:"3px",
            background:"rgba(255,255,255,0.07)", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"#ffa032", transition:"width 0.2s" }} />
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"flex", minHeight:0, overflow:"hidden" }}>

        {/* 3D viewport */}
        <div ref={mountRef}
          onMouseMove={onMouseMove}
          onMouseLeave={()=>setTooltip(null)}
          onMouseDown={onMouseDown}
          onClick={onMapClick}
          onWheel={e => { e.preventDefault(); }}
          style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0,
            cursor: activeField === "from" ? "crosshair" : "cell" }}>
          {tooltip && (
            <div style={{ position:"absolute", left:tooltip.x, top:tooltip.y, pointerEvents:"none",
              background:"rgba(4,6,12,0.95)", border:"1px solid rgba(255,160,50,0.4)",
              borderRadius:"4px", padding:"4px 10px", fontSize:"11px",
              color:"#ffa032", fontFamily:"monospace", whiteSpace:"nowrap", zIndex:10 }}>
              {tooltip.name}
            </div>
          )}
          {loadState.done && (
            <div style={{ position:"absolute", top:"10px", left:"50%", transform:"translateX(-50%)",
              pointerEvents:"none", zIndex:5 }}>
              <div style={{ background:"rgba(4,6,14,0.85)", border:`1px solid ${activeField==="from"?"rgba(0,255,150,0.5)":"rgba(255,100,50,0.5)"}`,
                borderRadius:"20px", padding:"4px 14px", fontSize:"11px", color: activeField==="from"?"#00ff96":"#ff6432",
                fontFamily:"monospace", letterSpacing:"0.06em" }}>
                {activeField === "from" ? "Click to set FROM" : "Click to set TO"}
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
            LEFT DRAG: ORBIT · RIGHT DRAG: PAN · SCROLL: ZOOM · HOVER: NAME
          </div>
        </div>

        {/* Route planner sidebar */}
        <div style={{ width:"270px", flexShrink:0, background:"rgba(4,6,14,0.97)",
          borderLeft:"1px solid rgba(255,160,50,0.12)",
          display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"14px", flex:1, overflowY:"auto" }}>

              <div style={{ color:"#ffa032", fontWeight:700, fontSize:"13px", marginBottom:"16px" }}>
                Jump Route Planner
              </div>

              {/* Ship selector */}
              <div style={{ marginBottom:"12px" }}>
                <label style={labelSx}>SHIP</label>
                <select value={shipId} onChange={e => {
                    const s = SHIPS.find(sh => sh.id === e.target.value) ?? SHIPS[2];
                    setShipId(e.target.value);
                    setFuelUnits(0);
                    if (!s.fuels.includes(fuelId)) setFuelId(s.fuels[0]);
                  }}
                  style={{ ...inputSx, cursor:"pointer" } as React.CSSProperties}>
                  {["Shuttle","Frigate","Destroyer","Cruiser","Combat Battlecruiser","Corvette"].map(cls => (
                    <optgroup key={cls} label={cls}>
                      {SHIPS.filter(s => s.classLabel === cls).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div style={{ color:"#2a3a2a", fontSize:"10px", marginTop:"3px" }}>
                  Fuel cap: {ship.fuelCap.toLocaleString()} units  ·  Hull: {(ship.massKg/1e6).toFixed(2)} Mt  ·  Spec. heat: {ship.specificHeat} C
                </div>
              </div>

              {/* Fuel type */}
              <div style={{ marginBottom:"12px" }}>
                <label style={labelSx}>FUEL TYPE</label>
                <select value={fuelId} onChange={e => setFuelId(e.target.value)}
                  style={{ ...inputSx, cursor:"pointer" } as React.CSSProperties}>
                  {FUELS.filter(f => ship.fuels.includes(f.id)).map(f => (
                    <option key={f.id} value={f.id}>{f.label} — quality {f.quality}</option>
                  ))}
                </select>
                <div style={{ color:"#333", fontSize:"10px", marginTop:"3px" }}>
                  {fuel.apiId > 0 ? `API id ${fuel.apiId} · ${fuel.massPerUnit} kg/unit` : "⚠ API id not yet confirmed"}
                </div>
              </div>

              {/* Fuel amount */}
              <div style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={{ ...labelSx, marginBottom:0 }}>FUEL LOADED (units)</label>
                  <span style={{ color:"#555", fontSize:"10px", cursor:"pointer" }}
                    onClick={() => setFuelUnits(0)}>full tank</span>
                </div>
                <input type="number" min={0} max={ship.fuelCap} value={fuelUnits === 0 ? ship.fuelCap : fuelUnits}
                  onChange={e => setFuelUnits(Math.min(+e.target.value, ship.fuelCap))}
                  style={inputSx} />
                <div style={{ color:"#333", fontSize:"10px", marginTop:"2px" }}>
                  Max: {ship.fuelCap.toLocaleString()} · click "full tank" to reset
                </div>
              </div>

              {/* Temperature */}
              <div style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={{ ...labelSx, marginBottom:0 }}>CURRENT HEAT (°C)</label>
                  <span style={{ color: currentTemp > 120 ? "#ff4444" : currentTemp > 80 ? "#ffa032" : "#666", fontSize:"10px" }}>
                    {currentTemp} / 150
                  </span>
                </div>
                <input type="range" min={0} max={149} value={currentTemp}
                  onChange={e => setCurrentTemp(+e.target.value)}
                  style={{ width:"100%", accentColor: currentTemp > 100 ? "#ff4444" : "#ffa032" }} />
              </div>

              {/* Extra cargo mass */}
              <div style={{ marginBottom:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={{ ...labelSx, marginBottom:0 }}>EXTRA CARGO MASS (kt)</label>
                  <span style={{ color:"#555", fontSize:"10px" }}>{cargoKt} kt</span>
                </div>
                <input type="range" min={0} max={5000} step={50} value={cargoKt}
                  onChange={e => setCargoKt(+e.target.value)}
                  style={{ width:"100%", accentColor:"#ffa032" }} />
                <div style={{ color:"#333", fontSize:"10px", marginTop:"2px" }}>
                  Total loaded: {((loadedMassKg)/1e6).toFixed(2)} Mt
                </div>
              </div>

              {/* Range summary — two constraints */}
              <div style={{ marginBottom:"12px", padding:"9px 10px",
                background:"rgba(255,160,50,0.05)", border:"1px solid rgba(255,160,50,0.12)", borderRadius:"6px",
                fontSize:"11px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ color:"#444" }}>🌡 Heat formula / hop</span>
                  <span style={{ color: heatRangeLY < 1 ? "#555" : heatRangeLY < 15 ? "#ff6432" : "#ffa032" }}>
                    {heatRangeLY < 0.01 ? "⚠ formula broken for this ship" : heatRangeLY.toFixed(1) + " LY"}
                  </span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"#444" }}>⛽ Fuel-limited / trip</span>
                  <span style={{ color:"#7fb" }}>{fuelRangeLY.toFixed(0)} LY total</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px", paddingTop:"4px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color:"#555" }}>Active hop limit</span>
                  <span style={{ color: effectiveRange > 0 ? "#ffa032" : "#ff4444", fontWeight:700 }}>
                    {effectiveRange > 0 ? effectiveRange.toFixed(1) + " LY" : "— set below"}
                  </span>
                </div>
              </div>

              {/* Manual hop range override */}
              <div style={{ marginBottom:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={labelSx}>MAX HOP RANGE (LY) — override</label>
                  {manualHopLY && (
                    <span style={{ color:"#555", fontSize:"10px", cursor:"pointer" }}
                      onClick={() => setManualHopLY("")}>clear</span>
                  )}
                </div>
                <input type="number" min={1} max={5000}
                  value={manualHopLY}
                  onChange={e => setManualHopLY(e.target.value)}
                  placeholder={heatRangeLY > 0.01 ? heatRangeLY.toFixed(1) : "Enter range (heat formula broken)"}
                  style={{ ...inputSx, borderColor: manualHopLY ? "rgba(255,160,50,0.5)" : undefined } as React.CSSProperties} />
                <div style={{ color:"#2a3a1a", fontSize:"10px", marginTop:"3px" }}>
                  {manualHopLY ? `✓ Using ${effectiveRange.toFixed(1)} LY — reachable halo active` : "Heat constant unconfirmed for heavy ships — set manually"}
                </div>
              </div>

              {/* From */}
              <div style={{ marginBottom:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={{ ...labelSx, marginBottom:0,
                    color: activeField === "from" ? "#00ff96" : "#444" }}>FROM
                    {activeField === "from" && <span style={{ marginLeft:"6px", fontSize:"9px", opacity:0.7 }}>← map click active</span>}
                  </label>
                  <span onClick={() => setActiveField("from")}
                    style={{ fontSize:"10px", color: activeField==="from"?"#00ff96":"#333", cursor:"pointer" }}>
                    {activeField==="from" ? "✓ active" : "set active"}
                  </span>
                </div>
                <div style={{ position:"relative" }}>
                  <input value={fromQ}
                    onFocus={() => setActiveField("from")}
                    onChange={e => { setFromQ(e.target.value); setFromRes(search(e.target.value)); }}
                    placeholder="System name… or click map"
                    style={{ ...inputSx,
                      borderColor: activeField==="from" ? "rgba(0,255,150,0.5)" : fromSys ? "rgba(0,255,150,0.25)" : undefined,
                      boxShadow: activeField==="from" ? "0 0 0 1px rgba(0,255,150,0.2)" : undefined,
                    } as React.CSSProperties} />
                  {fromSys && <span style={{ fontSize:"10px", color:"#00ff96", marginTop:"2px", display:"block" }}>✓ {fromSys.name}</span>}
                  {fromRes.length > 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200,
                      background:"#0a0c14", border:"1px solid rgba(255,160,50,0.2)", borderRadius:"4px", marginTop:"2px" }}>
                      {fromRes.map(s => (
                        <div key={s.id} onClick={() => { setFromSys(s); setFromQ(s.name); setFromRes([]); flyTo(s); }}
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

              {/* To */}
              <div style={{ marginBottom:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <label style={{ ...labelSx, marginBottom:0,
                    color: activeField === "to" ? "#ff6432" : "#444" }}>TO
                    {activeField === "to" && <span style={{ marginLeft:"6px", fontSize:"9px", opacity:0.7 }}>← map click active</span>}
                  </label>
                  <span onClick={() => setActiveField("to")}
                    style={{ fontSize:"10px", color: activeField==="to"?"#ff6432":"#333", cursor:"pointer" }}>
                    {activeField==="to" ? "✓ active" : "set active"}
                  </span>
                </div>
                <div style={{ position:"relative" }}>
                  <input value={toQ}
                    onFocus={() => setActiveField("to")}
                    onChange={e => { setToQ(e.target.value); setToRes(search(e.target.value)); }}
                    placeholder="System name… or click map"
                    style={{ ...inputSx,
                      borderColor: activeField==="to" ? "rgba(255,100,50,0.5)" : toSys ? "rgba(255,68,68,0.35)" : undefined,
                      boxShadow: activeField==="to" ? "0 0 0 1px rgba(255,100,50,0.2)" : undefined,
                    } as React.CSSProperties} />
                  {toSys && <span style={{ fontSize:"10px", color:"#ff6432", marginTop:"2px", display:"block" }}>✓ {toSys.name}</span>}
                  {toRes.length > 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200,
                      background:"#0a0c14", border:"1px solid rgba(255,160,50,0.2)", borderRadius:"4px", marginTop:"2px" }}>
                      {toRes.map(s => (
                        <div key={s.id} onClick={() => { setToSys(s); setToQ(s.name); setToRes([]); }}
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

              {/* Calculate */}
              <button onClick={handleCalc}
                disabled={!fromSys || !toSys || routeState === "calculating"}
                style={{ width:"100%", padding:"9px", borderRadius:"6px", cursor:"pointer",
                  background:"rgba(255,160,50,0.1)", border:"1px solid rgba(255,160,50,0.4)",
                  color:"#ffa032", fontWeight:700, fontSize:"12px", letterSpacing:"0.05em",
                  opacity:(!fromSys || !toSys) ? 0.4 : 1 }}>
                {routeState === "calculating" ? "Calculating…" : "CALCULATE ROUTE"}
              </button>

              {/* Results */}
              {routeState && routeState !== "calculating" && (
                <div style={{ marginTop:"14px" }}>
                  {routeState === "not_found" ? (
                    <div style={{ color:"#ff6432", fontSize:"12px", textAlign:"center", padding:"12px 0" }}>
                      No route within {MAX_JUMPS} jumps at {effectiveRange.toFixed(1)} LY.
                      <div style={{ color:"#333", fontSize:"11px", marginTop:"4px" }}>
                        Increase base range or use higher-grade fuel.
                      </div>
                    </div>
                  ) : (
                    <div style={{ background:"rgba(0,255,150,0.03)", border:"1px solid rgba(0,255,150,0.1)", borderRadius:"6px", padding:"10px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                        <span style={{ color:"#00ff96", fontWeight:700 }}>✓ Route found</span>
                        <span style={{ color:"#666", fontSize:"11px" }}>{routeState.path.length-1} jumps</span>
                      </div>
                      <div style={{ fontSize:"11px", display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                        <span style={{ color:"#444" }}>Est. fuel</span>
                        <span style={{ color:"#ffa032" }}>{routeState.totalFuel} units</span>
                      </div>
                      <div style={{ fontSize:"11px", display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                        <span style={{ color:"#444" }}>Fuel-limited trip</span>
                        <span style={{ color:"#7fb" }}>{fuelRangeLY.toFixed(0)} LY on full tank</span>
                      </div>
                      <div style={{ maxHeight:"200px", overflowY:"auto", marginTop:"8px", fontSize:"10px" }}>
                        {routeState.path.map((s, i) => (
                          <div key={s.id} onClick={() => flyTo(s)}
                            style={{ display:"flex", alignItems:"center", gap:"6px",
                              padding:"3px 4px", cursor:"pointer", borderRadius:"3px",
                              color: i===0 ? "#00ff96" : i===routeState.path.length-1 ? "#ff6432" : "#555" }}
                            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <span style={{ width:"20px", textAlign:"right", color:"#252525" }}>{i}</span>
                            <span>{s.name}</span>
                            {i < routeState.path.length-1 && (
                              <span style={{ marginLeft:"auto", color:"#2a2a2a" }}>
                                {dist3dLY(s, routeState.path[i+1]).toFixed(1)} LY
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
      </div>
    </div>
  );
}
