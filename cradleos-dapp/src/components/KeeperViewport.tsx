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

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


// ── Ship model mapping ────────────────────────────────────────────────────────
// Maps ship names (lowercase) to glb files in /models/
const SHIP_MODELS: Record<string, string> = {
  lai: "lai.glb",
  haf: "haf.glb",
  carom: "carom.glb",
  lorha: "lorha.glb",
  tades: "tades.glb",
  maul: "maul.glb",
  wend: "wend.glb",
  usv: "usv.glb",
  reflex: "reflex.glb",
};

// Structure/object models for Keeper's "mind" visualization
const STRUCTURE_MODELS: Record<string, string> = {
  gate: "gate.glb",
  turret: "turret.glb",
  hangar: "hangar.glb",
  asteroid: "asteroid.glb",
  asteroid2: "asteroid2.glb",
  refinery: "refinery.glb",
  assembly: "assembly.glb",
  printer: "printer.glb",
  shipyard: "shipyard.glb",
  silo: "silo.glb",
  tether: "tether.glb",
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
  structureType?: "ssu" | "gate" | "turret" | "node" | "hangar" | "refinery" | "assembly" | "printer" | "shipyard" | "silo" | "tether" | "asteroid" | "asteroid2";
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
  if (wireframe) {
    return new THREE.MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      wireframe: true,
      side: THREE.DoubleSide,
    });
  }
  // Additive emissive fill — glows from within, edges show through
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
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
  capacityPercent,
  points,
  routes,
  height = 200,
}: KeeperViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [noisePhase, setNoisePhase] = useState(0); // increments on mode change to trigger noise

  // Stable refs for animatable state
  const scanLineRef = useRef<number>(0);

  const initScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    const w = mount.clientWidth || 260;
    const h = height ?? (mount.clientHeight > 0 ? mount.clientHeight : 400);

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

    // ── Minimal ambient — edge lines carry the form, not lighting ────────────
    const ambLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambLight);

    // ── Grid (all modes) ──────────────────────────────────────────────────────
    const grid = buildGrid();
    scene.add(grid);

    // Objects to dispose on cleanup
    const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

    // ── Mode-specific scene setup ─────────────────────────────────────────────
    let mainMesh: THREE.Object3D | null = null;
    let particles: THREE.Points | null = null;
    const edgeMaterials: THREE.LineBasicMaterial[] = []; // pulsed in animate loop
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
      // ── Ship: additive glow fill + structural edge lines ─────────────────────
      const wireMat = makeMaterial(PRIMARY, 0.08, true);    // fallback only
      const solidMat = makeMaterial(PRIMARY, 0.10, false);  // additive glow — barely visible volume
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
            // Point cloud — per-mesh, inherits each mesh's local transform
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.visible = false;
                const pos = child.geometry.attributes.position;
                if (!pos) return;
                const step = Math.max(1, Math.floor(pos.count / 5000));
                const localPts: number[] = [];
                for (let i = 0; i < pos.count; i += step) {
                  localPts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                }
                if (localPts.length === 0) return;
                const ptGeo = new THREE.BufferGeometry();
                ptGeo.setAttribute("position", new THREE.Float32BufferAttribute(localPts, 3));
                disposables.push(ptGeo);
                const ptMat = new THREE.PointsMaterial({
                  color: PRIMARY, size: 0.045, opacity: 0.9, transparent: true,
                  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
                });
                edgeMaterials.push(ptMat as unknown as THREE.LineBasicMaterial);
                // Add as sibling with same local transform — inherits model scale/position
                const pts = new THREE.Points(ptGeo, ptMat);
                pts.position.copy(child.position);
                pts.rotation.copy(child.rotation);
                pts.scale.copy(child.scale);
                child.parent?.add(pts);
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

      // (glow sphere removed — keep model visible without occlusion)

    } else if (mode === "structure") {
      // ── Structure: additive glow fill + structural edge lines ────────────────
      const wireMat = makeMaterial(AMBER, 0.08, true);    // fallback only
      const solidMat = makeMaterial(AMBER, 0.10, false);  // additive glow — barely visible volume
      disposables.push(wireMat, solidMat);

      const struct = new THREE.Group();
      scene.add(struct);
      mainMesh = struct;

      const modelFile = structureType ? STRUCTURE_MODELS[structureType] : undefined;
      if (modelFile) {
        const loader = new GLTFLoader();
        const base = import.meta.env.BASE_URL || "/";
        loader.load(
          `${base}models/${modelFile}`,
          (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.0 / maxDim;
            model.scale.setScalar(scale);
            const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
            model.position.sub(center);
            // Point cloud — per-mesh, inherits transform
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.visible = false;
                const pos = child.geometry.attributes.position;
                if (!pos) return;
                const step = Math.max(1, Math.floor(pos.count / 5000));
                const localPts: number[] = [];
                for (let i = 0; i < pos.count; i += step) {
                  localPts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                }
                if (localPts.length === 0) return;
                const ptGeo = new THREE.BufferGeometry();
                ptGeo.setAttribute("position", new THREE.Float32BufferAttribute(localPts, 3));
                disposables.push(ptGeo);
                const ptMat = new THREE.PointsMaterial({
                  color: AMBER, size: 0.045, opacity: 0.9, transparent: true,
                  sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
                });
                edgeMaterials.push(ptMat as unknown as THREE.LineBasicMaterial);
                const pts = new THREE.Points(ptGeo, ptMat);
                pts.position.copy(child.position);
                pts.rotation.copy(child.rotation);
                pts.scale.copy(child.scale);
                child.parent?.add(pts);
              }
            });
            struct.add(model);
          },
          undefined,
          () => {
            // Fallback to procedural
            const geo = buildStructureGeometry(structureType);
            disposables.push(geo);
            const solid = new THREE.Mesh(geo, solidMat);
            const wc = geo.clone();
            disposables.push(wc);
            struct.add(solid, new THREE.Mesh(wc, wireMat));
          }
        );
      } else {
        const geo = buildStructureGeometry(structureType);
        disposables.push(geo);
        const solid = new THREE.Mesh(geo, solidMat);
        const wc = geo.clone();
        disposables.push(wc);
        struct.add(solid, new THREE.Mesh(wc, wireMat));
      }

      // (energy ring sphere removed — keep model visible without occlusion)

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
        // Slow rotation + subtle drift — "data assembling in space"
        mainMesh.rotation.y = t * 0.2;
        mainMesh.rotation.x = Math.sin(t * 0.17) * 0.06;
        mainMesh.position.y = Math.sin(t * 0.3) * 0.04;
      }

      if (mode === "structure" && mainMesh) {
        mainMesh.rotation.y = t * 0.22;
        mainMesh.rotation.z = Math.sin(t * 0.13) * 0.03;
        mainMesh.position.y = Math.sin(t * 0.25) * 0.05;
        if (connectionLines) {
          const lineMat = connectionLines.material as THREE.LineBasicMaterial;
          lineMat.opacity = 0.3 + Math.sin(t * 2.5) * 0.2;
        }
      }

      // Pulse edge lines — slow breath, offset by sin phase
      edgeMaterials.forEach((m, i) => {
        m.opacity = 0.55 + Math.sin(t * 1.2 + i * 0.4) * 0.25;
      });

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
      const newW = mount.clientWidth || 260;
      const newH = height ?? (mount.clientHeight > 0 ? mount.clientHeight : h);
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
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

  // ── Trigger noise burst on mode change ───────────────────────────────────
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setNoisePhase(p => p + 1);
    }
  }, [mode]);

  // ── Noise canvas animation ────────────────────────────────────────────────
  useEffect(() => {
    if (noisePhase === 0) return;
    const canvas = noiseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let elapsed = 0;
    const DURATION = 600; // ms total
    let last = performance.now();

    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      elapsed += dt;
      const t = Math.min(elapsed / DURATION, 1);

      const { width, height: h } = canvas;
      ctx.clearRect(0, 0, width, h);

      if (t < 1) {
        // Intensity curve: peaks at t=0.15, fades to 0 by t=1
        const intensity = t < 0.15
          ? t / 0.15
          : 1 - ((t - 0.15) / 0.85);

        const alpha = intensity * 0.85;
        const blockSize = Math.max(2, Math.floor(4 * (1 - t)));

        // Digital noise blocks
        for (let y = 0; y < h; y += blockSize) {
          for (let x = 0; x < width; x += blockSize) {
            if (Math.random() > 0.45) continue;
            const bright = Math.random();
            // Mix between orange (keeper color) and white
            const r = Math.floor(255);
            const g = Math.floor(bright > 0.7 ? 71 + (bright - 0.7) * 600 : 71 * bright);
            const b = Math.floor(bright > 0.85 ? 200 * (bright - 0.85) / 0.15 : 0);
            ctx.fillStyle = `rgba(${r},${g},${b},${alpha * bright})`;
            ctx.fillRect(x, y, blockSize, blockSize);
          }
        }

        // Horizontal glitch lines
        const numLines = Math.floor(intensity * 6);
        for (let i = 0; i < numLines; i++) {
          const ly = Math.floor(Math.random() * h);
          const lh = Math.floor(Math.random() * 3) + 1;
          const shift = (Math.random() - 0.5) * 20;
          ctx.drawImage(canvas, shift, ly, width, lh, 0, ly, width, lh);
          ctx.fillStyle = `rgba(255,71,0,${alpha * 0.4})`;
          ctx.fillRect(0, ly, width, lh);
        }

        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [noisePhase]);

  // Memoize stable canvas size to avoid re-creating on every render
  const noiseStyle = useMemo<React.CSSProperties>(() => ({
    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 10,
  }), []);

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
        {mode === "structure" && capacityPercent !== undefined ? `CAP ${capacityPercent.toFixed(0)}%` : ""}
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
          height: height !== undefined ? `${height}px` : "100%",
          flex: height !== undefined ? undefined : 1,
          background: BG,
          border: "1px solid rgba(255,71,0,0.25)",
          overflow: "hidden",
          flexShrink: height !== undefined ? 0 : 1,
        }}
      >
        {/* Three.js mount target */}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* Digital noise transition canvas — fires on mode change */}
        <canvas ref={noiseCanvasRef} width={260} height={420} style={noiseStyle} />

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
          {mode === "idle" ? "◆ KEEPER INTERFACE" : mode === "ship" ? `◆ SHIP SCAN${entityName ? ` — ${entityName}` : ""}` : `◆ ${mode.toUpperCase()} SCAN`}
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
