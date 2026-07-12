/**
 * Casino3D.tsx — Full 3D casino floor with auto-layout from CASINO_CATALOG.
 *
 * Wires:
 *   - buildStations(scene, CASINO_CATALOG) → all 20 stations in 9 zones
 *   - Nearest station + zone computed every 5 frames (cheap: no allocations)
 *   - Target ring: small orange ring mesh spawned on click, fades out
 *   - Recall to entrance: glides camera to spawn point via controls.setTarget()
 *   - Full dispose on unmount (scene.traverse + renderer)
 */

import * as THREE from "three";
import { useRef, useEffect, useState, useCallback } from "react";
import { buildFloor, ROOM_BOUNDS } from "./floor";
import { buildStations } from "./stations";
import type { Station, ZoneInfo } from "./stations";
import { FloorControls } from "./controls";
import { Casino3DHud } from "./hud";
import { CASINO_CATALOG } from "../../lib/casinoCatalog";

// Entrance spawn point
const SPAWN = new THREE.Vector3(0, 1.7, 14);

interface Props {
  onExit:      () => void;
  onOpenGame:  (key: string) => void;
}

// ── Target ring helper ──────────────────────────────────────────────────────

function makeTargetRing(scene: THREE.Scene, pos: THREE.Vector3): {
  mesh: THREE.Mesh;
  update: (dt: number) => boolean; // returns true while alive
} {
  const geo = new THREE.RingGeometry(0.25, 0.38, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff4700, emissive: new THREE.Color(0xff4700), emissiveIntensity: 1.0,
    roughness: 0.3, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, 0.03, pos.z);
  scene.add(mesh);

  let age = 0;
  const TTL = 1.2; // seconds to fade
  const update = (dt: number): boolean => {
    age += dt;
    const t = Math.min(1, age / TTL);
    // expand + fade
    const scale = 1 + t * 1.8;
    mesh.scale.set(scale, scale, scale);
    mat.opacity = (1 - t) * 0.9;
    if (age >= TTL) {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
      return false;
    }
    return true;
  };
  return { mesh, update };
}

// ────────────────────────────────────────────────────────────────────────────

export default function Casino3D({ onExit, onOpenGame }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearStation, setNearStation] = useState<Station | null>(null);
  const [nearZone,    setNearZone   ] = useState<ZoneInfo | null>(null);

  // Stable refs so HUD callbacks avoid stale closures
  const nearStRef  = useRef<Station | null>(null);
  const recallRef  = useRef<(() => void) | null>(null);

  const handleRecall = useCallback(() => {
    recallRef.current?.();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "default" });
    } catch {
      onExit();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040408);
    scene.fog = new THREE.Fog(0x040408, 24, 52);

    // ── Camera ───────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      68, container.clientWidth / container.clientHeight, 0.1, 70,
    );
    camera.position.copy(SPAWN);
    camera.lookAt(0, 1.5, 0);

    // ── Build world ──────────────────────────────────────────────────────────
    buildFloor(scene);
    const { stations, zones } = buildStations(scene, CASINO_CATALOG);

    // ── Controls ─────────────────────────────────────────────────────────────
    // Active target rings (alive list, updated each frame)
    const activeRings: ReturnType<typeof makeTargetRing>[] = [];

    const controls = new FloorControls(camera, renderer.domElement, ROOM_BOUNDS, {
      onClickTarget: (pos) => {
        activeRings.push(makeTargetRing(scene, pos));
      },
    });

    // Recall to entrance
    recallRef.current = () => controls.setTarget(SPAWN);

    // ── Resize ───────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    // ── Animation loop ───────────────────────────────────────────────────────
    let rafId: number;
    let lastTime  = performance.now();
    let frameIdx  = 0;

    // Reusable cam2d vector (allocated once, reused — no per-frame allocation)
    const cam2d = new THREE.Vector2();

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.1);
      lastTime  = now;
      frameIdx++;

      controls.update(dt);

      // Tick all stations
      for (let i = 0; i < stations.length; i++) {
        stations[i].tick?.(dt);
      }

      // Tick target rings (iterate in reverse to splice safely)
      for (let i = activeRings.length - 1; i >= 0; i--) {
        const alive = activeRings[i].update(dt);
        if (!alive) activeRings.splice(i, 1);
      }

      // Nearest station + zone — check every 5 frames
      if (frameIdx % 5 === 0) {
        cam2d.set(camera.position.x, camera.position.z);

        // Nearest station
        let nearestSt: Station | null = null;
        let nearestStDist = Infinity;
        for (let i = 0; i < stations.length; i++) {
          const st = stations[i];
          const dx = cam2d.x - st.position.x;
          const dz = cam2d.y - st.position.z;
          const d  = Math.sqrt(dx * dx + dz * dz);
          if (d < st.radius && d < nearestStDist) {
            nearestStDist = d;
            nearestSt     = st;
          }
        }

        // Update setNear flags (only when changed)
        if (nearestSt !== nearStRef.current) {
          nearStRef.current?.setNear?.(false);
          nearestSt?.setNear?.(true);
          nearStRef.current = nearestSt;
          setNearStation(nearestSt);
        }

        // Nearest zone (by proximity to zone center, within 12m)
        let nearestZone: ZoneInfo | null = null;
        let nearestZoneDist = 12; // max zone-label range (m)
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          const dx = cam2d.x - z.center.x;
          const dz = cam2d.y - z.center.z;
          const d  = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestZoneDist) {
            nearestZoneDist = d;
            nearestZone     = z;
          }
        }
        setNearZone(nearestZone);
      }

      renderer.render(scene, camera);
    }
    animate();

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      recallRef.current = null;

      // Dispose all active rings
      for (const r of activeRings) {
        scene.remove(r.mesh);
      }

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              (m as THREE.MeshStandardMaterial).map?.dispose();
              m.dispose();
            });
          } else {
            (obj.material as THREE.MeshStandardMaterial).map?.dispose();
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
      />
      <Casino3DHud
        nearStation={nearStation}
        nearZone={nearZone}
        onEnter={() => {
          if (nearStRef.current) onOpenGame(nearStRef.current.key);
        }}
        onExit={onExit}
        onRecall={handleRecall}
      />
    </div>
  );
}
