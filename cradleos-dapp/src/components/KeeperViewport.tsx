/**
 * KeeperViewport — 3D holographic terminal visualization for CradleOS Keeper panel
 *
 * Modes:
 *  - idle:      Rotating octahedron (Keeper diamond) with particle field + grid
 *  - ship:      Wireframe ship silhouette with scan lines and floating stat labels
 *  - structure: Geometric primitive (SSU/gate/turret/node) with pulsing energy field
 *  - map:       Star-system constellation with glowing route lines
 *
 * Uses raw Three.js via useRef + useEffect. No React Three Fiber.
 * All effects are CSS overlays or simple shaders — no heavy post-processing libs.
 */

import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ── Ship model mapping ────────────────────────────────────────────────────────
// Maps ship names (lowercase) to glb files in /models/
const SHIP_MODELS: Record<string, string> = {
  lai: "lai.glb",
  haf: "haf.glb",
  carom: "carom.glb",
  lorha: "lorha.glb",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KeeperViewportProps {
  mode: "idle" | "ship" | "structure" | "map";
  entityName?: string;
  stats?: Record<string, string | number>;
  // Ship mode
  shipClass?: "frigate" | "destroyer" | "hauler" | "shuttle" | "cruiser";
  shipName?: string; // lowercase ship name for model lookup (e.g. "lai", "haf")
  // Structure mode
  structureType?: "ssu" | "gate" | "turret" | "node";
  capacityPercent?: number;
  // Map mode
  points?: Array<{ name: string; x: number; y: number; z: number }>;
  routes?: Array<[number, number]>;
  // Size
  height?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIMARY = 0xff4700;        // #FF4700
const PRIMARY_HEX = "#FF4700";
const AMBER = 0xffc800;          // rgba(255,200,0,0.6) base
const GREEN_ACCENT = 0x00ff96;   // rgba(0,255,150,0.3) base
const BG = "rgba(3,2,1,0.95)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMaterial(color: number, opacity: number, wireframe = false) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    wireframe,
    side: THREE.DoubleSide,
  });
}

function makeLineMaterial(color: number, opacity: number) {
  return new THREE.LineBasicMaterial({ color, opacity, transparent: true });
}

// Build a grid on XZ plane
function buildGrid(size = 6, divisions = 12): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  const step = size / divisions;
  const half = size / 2;
  const verts: number[] = [];

  for (let i = 0; i <= divisions; i++) {
    const t = -half + i * step;
    verts.push(t, -1.5, -half, t, -1.5, half);   // X lines
    verts.push(-half, -1.5, t, half, -1.5, t);   // Z lines
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: PRIMARY,
    opacity: 0.06,
    transparent: true,
  });
  return new THREE.LineSegments(geometry, mat);
}

// Particle system — cloud of small points
function buildParticles(count = 80, spread = 3.5): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    pos.push(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: AMBER,
    size: 0.035,
    opacity: 0.4,
    transparent: true,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

// ── Ship geometry builders ────────────────────────────────────────────────────

function buildShipGeometry(cls: KeeperViewportProps["shipClass"]): THREE.BufferGeometry {
  switch (cls) {
    case "frigate":
      // Elongated octahedron — slim and fast
      return new THREE.OctahedronGeometry(0.7, 0);
    case "destroyer":
      // Slightly wider octahedron with a custom scale feel — we'll scale in scene
      return new THREE.OctahedronGeometry(0.8, 0);
    case "hauler":
      // Blocky — box-like
      return new THREE.BoxGeometry(1.4, 0.6, 0.7);
    case "shuttle":
      // Small tetrahedron vibe — cone
      return new THREE.ConeGeometry(0.5, 1.2, 4, 1);
    case "cruiser":
    default:
      // Elongated cone + octahedron blended — use cone
      return new THREE.ConeGeometry(0.5, 1.5, 6, 1);
  }
}

// ── Structure geometry builders ───────────────────────────────────────────────

function buildStructureGeometry(type: KeeperViewportProps["structureType"]): THREE.BufferGeometry {
  switch (type) {
    case "ssu":
      return new THREE.BoxGeometry(1, 1, 1);
    case "gate":
      return new THREE.TorusGeometry(0.8, 0.12, 8, 24);
    case "turret":
      return new THREE.ConeGeometry(0.5, 1.2, 4, 1);
    case "node":
    default:
      return new THREE.IcosahedronGeometry(0.7, 0);
  }
}

// Build a capacity ring — partial torus showing fill %
function buildCapacityRing(percent: number): THREE.Object3D {
  const group = new THREE.Group();

  // Background ring (empty)
  const bgGeo = new THREE.TorusGeometry(1.1, 0.04, 4, 64);
  const bgMat = makeMaterial(PRIMARY, 0.1);
  group.add(new THREE.Mesh(bgGeo, bgMat));

  // Fill arc — we approximate with a partial torus via arc segments
  const fillAngle = (percent / 100) * Math.PI * 2;
  const fillGeo = new THREE.TorusGeometry(1.1, 0.04, 4, 64, fillAngle);
  const fillMat = makeMaterial(GREEN_ACCENT, 0.8);
  const fillMesh = new THREE.Mesh(fillGeo, fillMat);
  fillMesh.rotation.z = -Math.PI / 2;
  group.add(fillMesh);

  return group;
}

// ── Procedural ship fallback ──────────────────────────────────────────────────
function addProceduralShip(
  group: THREE.Group,
  shipClass: KeeperViewportProps["shipClass"],
  wireMat: THREE.Material,
  solidMat: THREE.Material,
  disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture>,
) {
  const geo = buildShipGeometry(shipClass);
  disposables.push(geo);
  const scaleMap: Record<string, [number, number, number]> = {
    frigate: [0.8, 1.4, 0.8],
    destroyer: [1.0, 1.0, 0.9],
    hauler: [1.0, 1.0, 1.0],
    shuttle: [0.8, 1.0, 0.8],
    cruiser: [0.85, 1.0, 0.85],
  };
  const sc = scaleMap[shipClass ?? "cruiser"] ?? [1, 1, 1];
  const solid = new THREE.Mesh(geo, solidMat);
  solid.scale.set(...sc);
  const wireClone = geo.clone();
  disposables.push(wireClone);
  const wire = new THREE.Mesh(wireClone, wireMat);
  wire.scale.set(...sc);
  group.add(solid, wire);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KeeperViewport({
  mode = "idle",
  entityName,
  stats,
  shipClass = "cruiser",
  shipName,
  structureType = "ssu",
  capacityPercent = 0,
  points,
  routes,
  height = 200,
}: KeeperViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // Stable refs for animatable state
  const scanLineRef = useRef<number>(0);

  const initScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    const w = mount.clientWidth;
    const h = height;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene + Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 4);
    camera.lookAt(0, 0, 0);

    // ── Ambient light ─────────────────────────────────────────────────────────
    const ambLight = new THREE.AmbientLight(PRIMARY, 0.3);
    scene.add(ambLight);

    // ── Grid (all modes) ──────────────────────────────────────────────────────
    const grid = buildGrid();
    scene.add(grid);

    // Objects to dispose on cleanup
    const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

    // ── Mode-specific scene setup ─────────────────────────────────────────────
    let mainMesh: THREE.Object3D | null = null;
    let particles: THREE.Points | null = null;
    let energyRing: THREE.Mesh | null = null;
    let capacityRing: THREE.Object3D | null = null;
    let connectionLines: THREE.LineSegments | null = null;
    let starPoints: THREE.Points | null = null;
    let routeLines: THREE.LineSegments | null = null;

    if (mode === "idle") {
      // ── Idle: Keeper diamond + particles + grid ────────────────────────────
      const geo = new THREE.OctahedronGeometry(0.7, 0);
      const wireMat = makeMaterial(PRIMARY, 0.55, true);
      const solidMat = makeMaterial(PRIMARY, 0.06, false);
      disposables.push(geo, wireMat, solidMat);

      const solid = new THREE.Mesh(geo, solidMat);
      const wire = new THREE.Mesh(geo.clone(), wireMat);
      disposables.push(wire.geometry);

      const diamond = new THREE.Group();
      diamond.add(solid, wire);
      scene.add(diamond);
      mainMesh = diamond;

      particles = buildParticles(100, 4);
      disposables.push(particles.geometry, particles.material as THREE.Material);
      scene.add(particles);

    } else if (mode === "ship") {
      // ── Ship: try real glTF model, fall back to procedural wireframe ──────
      const wireMat = makeMaterial(PRIMARY, 0.45, true);
      const solidMat = makeMaterial(PRIMARY, 0.04, false);
      disposables.push(wireMat, solidMat);

      const ship = new THREE.Group();
      ship.rotation.x = -0.25;
      scene.add(ship);
      mainMesh = ship;

      const modelKey = shipName?.toLowerCase();
      const modelFile = modelKey ? SHIP_MODELS[modelKey] : undefined;

      if (modelFile) {
        // Load real ship model
        const loader = new GLTFLoader();
        const base = import.meta.env.BASE_URL || "/";
        loader.load(
          `${base}models/${modelFile}`,
          (gltf) => {
            const model = gltf.scene;
            // Auto-scale to fit viewport
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.0 / maxDim;
            model.scale.setScalar(scale);
            // Center
            const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
            model.position.sub(center);
            // Replace all materials with holographic wireframe
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const wireClone = child.geometry.clone();
                disposables.push(wireClone);
                const wireChild = new THREE.Mesh(wireClone, wireMat);
                wireChild.position.copy(child.position);
                wireChild.rotation.copy(child.rotation);
                wireChild.scale.copy(child.scale);
                child.material = solidMat;
                child.parent?.add(wireChild);
              }
            });
            ship.add(model);
          },
          undefined,
          () => {
            // Failed to load — use procedural fallback
            addProceduralShip(ship, shipClass, wireMat, solidMat, disposables);
          }
        );
      } else {
        // No model file — use procedural geometry
        addProceduralShip(ship, shipClass, wireMat, solidMat, disposables);
      }

      particles = buildParticles(40, 3.5);
      disposables.push(particles.geometry, particles.material as THREE.Material);
      scene.add(particles);

      // Glow sphere around ship
      const glowGeo = new THREE.SphereGeometry(1.1, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: PRIMARY,
        opacity: 0.04,
        transparent: true,
        side: THREE.BackSide,
      });
      disposables.push(glowGeo, glowMat);
      scene.add(new THREE.Mesh(glowGeo, glowMat));

    } else if (mode === "structure") {
      // ── Structure: primitive + energy ring ────────────────────────────────
      const geo = buildStructureGeometry(structureType);
      const wireMat = makeMaterial(AMBER, 0.6, true);
      const solidMat = makeMaterial(AMBER, 0.05, false);
      disposables.push(geo, wireMat, solidMat);

      const solid = new THREE.Mesh(geo, solidMat);
      const wireClone = geo.clone();
      disposables.push(wireClone);
      const wire = new THREE.Mesh(wireClone, wireMat);

      const struct = new THREE.Group();
      struct.add(solid, wire);
      scene.add(struct);
      mainMesh = struct;

      // Energy ring (pulsing sphere)
      const ringGeo = new THREE.SphereGeometry(1.3, 16, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: PRIMARY,
        opacity: 0.07,
        transparent: true,
        wireframe: true,
      });
      disposables.push(ringGeo, ringMat);
      energyRing = new THREE.Mesh(ringGeo, ringMat);
      scene.add(energyRing);

      // Capacity ring
      if (capacityPercent !== undefined) {
        capacityRing = buildCapacityRing(capacityPercent);
        capacityRing.position.y = -0.1;
        scene.add(capacityRing);
      }

      // Connection lines for "node" type
      if (structureType === "node") {
        const lineGeo = new THREE.BufferGeometry();
        const lineVerts: number[] = [];
        const nodeCount = 5;
        for (let i = 0; i < nodeCount; i++) {
          const angle = (i / nodeCount) * Math.PI * 2;
          const r = 1.8;
          lineVerts.push(0, 0, 0, Math.cos(angle) * r, Math.sin(angle) * r * 0.4, Math.sin(angle) * r);
        }
        lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
        const lineMat = makeLineMaterial(GREEN_ACCENT, 0.4);
        disposables.push(lineGeo, lineMat);
        connectionLines = new THREE.LineSegments(lineGeo, lineMat);
        scene.add(connectionLines);
      }

    } else if (mode === "map") {
      // ── Map: star constellation + routes ─────────────────────────────────
      const mapPoints = points && points.length > 0
        ? points
        : [
            { name: "Origin", x: 0, y: 0, z: 0 },
            { name: "Alpha", x: -1.5, y: 0.3, z: -0.5 },
            { name: "Beta", x: 1.2, y: -0.4, z: 0.8 },
            { name: "Gamma", x: 0.5, y: 0.8, z: -1.2 },
          ];

      // Normalize positions into a unit box
      const scale = 1.8;
      const normalizePoints = (pts: typeof mapPoints) => {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const zs = pts.map((p) => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs) || 1;
        const minY = Math.min(...ys), maxY = Math.max(...ys) || 1;
        const minZ = Math.min(...zs), maxZ = Math.max(...zs) || 1;
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const rangeZ = maxZ - minZ || 1;
        return pts.map((p) => ({
          ...p,
          x: ((p.x - minX) / rangeX - 0.5) * scale * 2,
          y: ((p.y - minY) / rangeY - 0.5) * scale,
          z: ((p.z - minZ) / rangeZ - 0.5) * scale * 2,
        }));
      };

      const normPts = normalizePoints(mapPoints);

      // Star dots
      const starGeo = new THREE.BufferGeometry();
      const starPos: number[] = [];
      normPts.forEach((p) => starPos.push(p.x, p.y, p.z));
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: PRIMARY,
        size: 0.12,
        opacity: 0.9,
        transparent: true,
        sizeAttenuation: true,
      });
      disposables.push(starGeo, starMat);
      starPoints = new THREE.Points(starGeo, starMat);
      scene.add(starPoints);

      // Small glow spheres at each point
      normPts.forEach((p) => {
        const sGeo = new THREE.SphereGeometry(0.06, 6, 6);
        const sMat = makeMaterial(PRIMARY, 0.6);
        disposables.push(sGeo, sMat);
        const s = new THREE.Mesh(sGeo, sMat);
        s.position.set(p.x, p.y, p.z);
        scene.add(s);
      });

      // Route lines
      const mapRoutes = routes ?? normPts.map((_, i) => [i, (i + 1) % normPts.length] as [number, number]);
      const routeGeo = new THREE.BufferGeometry();
      const routeVerts: number[] = [];
      mapRoutes.forEach(([a, b]) => {
        if (normPts[a] && normPts[b]) {
          routeVerts.push(normPts[a].x, normPts[a].y, normPts[a].z);
          routeVerts.push(normPts[b].x, normPts[b].y, normPts[b].z);
        }
      });
      if (routeVerts.length > 0) {
        routeGeo.setAttribute("position", new THREE.Float32BufferAttribute(routeVerts, 3));
        const routeMat = makeLineMaterial(AMBER, 0.5);
        disposables.push(routeGeo, routeMat);
        routeLines = new THREE.LineSegments(routeGeo, routeMat);
        scene.add(routeLines);
      }
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let frameId: number;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.01;
      scanLineRef.current = t;

      if (mode === "idle" && mainMesh) {
        mainMesh.rotation.y = t * 0.4;
        mainMesh.rotation.x = Math.sin(t * 0.3) * 0.15;
        if (particles) {
          particles.rotation.y = t * 0.05;
          particles.rotation.x = t * 0.02;
        }
      }

      if (mode === "ship" && mainMesh) {
        mainMesh.rotation.y = t * 0.25;
      }

      if (mode === "structure" && mainMesh) {
        mainMesh.rotation.y = t * 0.3;
        if (energyRing) {
          const pulse = 0.07 + Math.sin(t * 2) * 0.025;
          (energyRing.material as THREE.MeshBasicMaterial).opacity = pulse;
          const sc = 1 + Math.sin(t * 1.5) * 0.03;
          energyRing.scale.setScalar(sc);
        }
        if (connectionLines) {
          const lineMat = connectionLines.material as THREE.LineBasicMaterial;
          lineMat.opacity = 0.3 + Math.sin(t * 2.5) * 0.2;
        }
      }

      if (mode === "map") {
        if (starPoints) starPoints.rotation.y = t * 0.08;
        if (routeLines) {
          routeLines.rotation.y = t * 0.08;
          const mat = routeLines.material as THREE.LineBasicMaterial;
          mat.opacity = 0.4 + Math.sin(t * 2) * 0.2;
        }
      }

      renderer.render(scene, camera);
    };

    animate();
    animRef.current = frameId!;

    // ── Resize handler ────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      camera.aspect = newW / h;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      disposables.forEach((d) => d.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mode, shipClass, shipName, structureType, capacityPercent, points, routes, height]);

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);

  // ── Label overlay: stat labels in ship mode ───────────────────────────────
  const renderStatLabels = () => {
    if (mode !== "ship" || !stats) return null;
    const entries = Object.entries(stats).slice(0, 4);
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "6px 10px",
          boxSizing: "border-box",
          gap: "2px",
        }}
      >
        {entries.map(([key, val]) => (
          <div
            key={key}
            style={{
              fontFamily: "monospace",
              fontSize: "9px",
              letterSpacing: "0.12em",
              color: "rgba(255,71,0,0.75)",
              textShadow: `0 0 6px ${PRIMARY_HEX}`,
              animation: "keeper-fade 2s ease-in-out infinite alternate",
            }}
          >
            <span style={{ color: "rgba(255,200,0,0.5)", marginRight: 4 }}>{key.toUpperCase()}:</span>
            {val}
          </div>
        ))}
      </div>
    );
  };

  // ── Label overlay: entity name ────────────────────────────────────────────
  const renderEntityLabel = () => {
    if (!entityName) return null;
    return (
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: PRIMARY_HEX,
          textShadow: `0 0 8px ${PRIMARY_HEX}`,
          pointerEvents: "none",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        {entityName}
      </div>
    );
  };

  // ── Map point labels ──────────────────────────────────────────────────────
  // (Rendered as simple CSS overlay since 3D canvas text is expensive)
  const renderMapLabels = () => {
    if (mode !== "map" || !points || points.length === 0) return null;
    // Just list them as small legends — true 3D projection would require raycasting
    return (
      <div
        style={{
          position: "absolute",
          bottom: "6px",
          left: "6px",
          pointerEvents: "none",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 10px",
        }}
      >
        {points.slice(0, 6).map((p) => (
          <span
            key={p.name}
            style={{
              fontFamily: "monospace",
              fontSize: "8px",
              letterSpacing: "0.1em",
              color: "rgba(255,200,0,0.7)",
              textShadow: "0 0 4px rgba(255,200,0,0.4)",
            }}
          >
            ◆ {p.name}
          </span>
        ))}
      </div>
    );
  };

  // ── Idle mode "Awaiting signal..." text ───────────────────────────────────
  const renderIdleOverlay = () => {
    if (mode !== "idle") return null;
    return (
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          width: "100%",
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: "8px",
          letterSpacing: "0.22em",
          color: "rgba(255,71,0,0.3)",
          pointerEvents: "none",
          animation: "keeper-pulse 3s ease-in-out infinite",
        }}
      >
        AWAITING SIGNAL...
      </div>
    );
  };

  // ── Capacity label in structure mode ─────────────────────────────────────
  const renderCapacityLabel = () => {
    if (mode !== "structure") return null;
    return (
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "10px",
          fontFamily: "monospace",
          fontSize: "8px",
          letterSpacing: "0.12em",
          color: "rgba(0,255,150,0.7)",
          textShadow: "0 0 6px rgba(0,255,150,0.4)",
          pointerEvents: "none",
        }}
      >
        {capacityPercent !== undefined ? `CAP ${capacityPercent.toFixed(0)}%` : ""}
      </div>
    );
  };

  return (
    <>
      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes keeper-fade {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes keeper-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        @keyframes keeper-scanline {
          0% { top: -8px; }
          100% { top: 100%; }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: `${height}px`,
          background: BG,
          border: "1px solid rgba(255,71,0,0.25)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Three.js mount target */}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* Scanline overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Animated scan line sweep */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            height: "8px",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,71,0,0.12) 50%, transparent 100%)",
            animation: "keeper-scanline 4s linear infinite",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />

        {/* Corner accents */}
        <div style={{ position: "absolute", top: 0, left: 0, width: 12, height: 12, borderTop: `1px solid ${PRIMARY_HEX}`, borderLeft: `1px solid ${PRIMARY_HEX}`, zIndex: 5 }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 12, height: 12, borderTop: `1px solid ${PRIMARY_HEX}`, borderRight: `1px solid ${PRIMARY_HEX}`, zIndex: 5 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 12, height: 12, borderBottom: `1px solid ${PRIMARY_HEX}`, borderLeft: `1px solid ${PRIMARY_HEX}`, zIndex: 5 }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderBottom: `1px solid ${PRIMARY_HEX}`, borderRight: `1px solid ${PRIMARY_HEX}`, zIndex: 5 }} />

        {/* Mode label — top left */}
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "16px",
            fontFamily: "monospace",
            fontSize: "7px",
            letterSpacing: "0.2em",
            color: "rgba(255,71,0,0.4)",
            zIndex: 5,
            pointerEvents: "none",
            textTransform: "uppercase",
          }}
        >
          {mode === "idle" ? "◆ KEEPER INTERFACE" : `◆ ${mode.toUpperCase()} SCAN`}
        </div>

        {/* Content overlays — above vignette */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 6, pointerEvents: "none" }}>
          {renderEntityLabel()}
          {renderStatLabels()}
          {renderIdleOverlay()}
          {renderCapacityLabel()}
          {renderMapLabels()}
        </div>
      </div>
    </>
  );
}
