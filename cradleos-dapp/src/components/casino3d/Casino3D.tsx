import * as THREE from "three";
import { useRef, useEffect, useState } from "react";
import { buildFloor, ROOM_BOUNDS } from "./floor";
import { buildStations } from "./stations";
import type { Station } from "./stations";
import { FloorControls } from "./controls";
import { Casino3DHud } from "./hud";

interface Props {
  onExit: () => void;
  onOpenGame: (key: string) => void;
}

export default function Casino3D({ onExit, onOpenGame }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearStation, setNearStation] = useState<Station | null>(null);
  // stable ref for HUD callbacks to avoid stale closure
  const nearRef = useRef<Station | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──
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

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.Fog(0x050508, 18, 38);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      68,
      container.clientWidth / container.clientHeight,
      0.1,
      60,
    );
    camera.position.set(0, 1.7, 10);
    camera.lookAt(0, 1.5, 0);

    // ── Build world ──
    buildFloor(scene);
    const stations = buildStations(scene);

    // ── Controls ──
    const controls = new FloorControls(camera, renderer.domElement, ROOM_BOUNDS);

    // ── Resize ──
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    // ── Animation loop ──
    let rafId: number;
    let lastTime = performance.now();

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.1);
      lastTime  = now;

      controls.update(dt);

      for (const st of stations) {
        st.tick?.(dt);
      }

      // nearest station check
      const cam2d = new THREE.Vector2(camera.position.x, camera.position.z);
      let nearest: Station | null = null;
      for (const st of stations) {
        const d = cam2d.distanceTo(new THREE.Vector2(st.position.x, st.position.z));
        if (d < st.radius) {
          nearest = st;
          break;
        }
      }
      if (nearest !== nearRef.current) {
        nearRef.current = nearest;
        setNearStation(nearest);
      }

      renderer.render(scene, camera);
    }
    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();

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
        onEnter={() => {
          if (nearRef.current) onOpenGame(nearRef.current.key);
        }}
        onExit={onExit}
      />
    </div>
  );
}
