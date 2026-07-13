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
import { fetchRecentInstantPlays } from "../../lib/casinoGames";
import type { InstantFeedRow } from "../../lib/casinoGames";

// Entrance spawn point
const SPAWN = new THREE.Vector3(0, 1.7, 14);

// ── Feed alias map: feed game key → station key ────────────────────────────
const FEED_ALIAS: Record<string, string> = {
  "tower":        "dragon_tower",
  "dragon tower": "dragon_tower",
  "video poker":  "video_poker",
};
function feedKeyToStationKey(game: string): string {
  return FEED_ALIAS[game] ?? game;
}

// ── Player colour from wallet address hash ──────────────────────────────────
const HOLO_PALETTE = [0xff6820, 0x40e0c0, 0xe8c040] as const;
function playerColor(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return HOLO_PALETTE[h % 3];
}

// ── Hologram pool slot ──────────────────────────────────────────────────────
interface HoloSlot {
  group: THREE.Group;
  bodyMat: THREE.MeshBasicMaterial;
  headMat: THREE.MeshBasicMaterial;
  active: boolean;
  stationKey: string;
  expiresAt: number; // performance.now() ms
}

function buildHologramPool(scene: THREE.Scene, count: number): HoloSlot[] {
  const slots: HoloSlot[] = [];
  for (let i = 0; i < count; i++) {
    // CapsuleGeometry(radius, length, capSegments, radialSegments)
    const bodyGeo = new THREE.CapsuleGeometry(0.14, 0.55, 3, 7);
    const headGeo = new THREE.SphereGeometry(0.12, 7, 5);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xff6820, transparent: true, opacity: 0 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xff6820, transparent: true, opacity: 0 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const head = new THREE.Mesh(headGeo, headMat);
    body.position.y = 0.68;
    head.position.y = 1.26;
    const group = new THREE.Group();
    group.add(body, head);
    group.visible = false;
    scene.add(group);
    slots.push({ group, bodyMat, headMat, active: false, stationKey: "", expiresAt: 0 });
  }
  return slots;
}

// ── Rising activity-pulse ring (3 s, emitted on new feed row) ───────────────
function makeActivityPulse(scene: THREE.Scene, pos: THREE.Vector3): {
  mesh: THREE.Mesh;
  update: (dt: number) => boolean;
} {
  const geo = new THREE.RingGeometry(0.35, 0.55, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff6820, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, 0.06, pos.z);
  scene.add(mesh);
  let age = 0;
  const TTL = 3.0;
  const update = (dt: number): boolean => {
    age += dt;
    const t = age / TTL;
    mesh.position.y = 0.06 + t * 2.2;
    const s = 1 + t * 2.8;
    mesh.scale.set(s, s, 1);
    mat.opacity = (1 - t) * 0.82;
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
    // Linear tone mapping: canvas sRGB pixel = output pixel (identity).
    // Walls use MeshBasicMaterial + SRGBColorSpace + fog:false for guaranteed visibility.
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Art-direction restyle (Raw 2026-07-12): dark bunker + exponential haze
    scene.background = new THREE.Color(0x0a0808);
    scene.fog = new THREE.FogExp2(0x0a0808, 0.028);

    // ── Camera ───────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      68, container.clientWidth / container.clientHeight, 0.1, 70,
    );
    camera.position.copy(SPAWN);
    camera.lookAt(0, 1.5, 0);

    // ── Build world ──────────────────────────────────────────────────────────
    const floorCtrl = buildFloor(scene);
    const { stations, zones } = buildStations(scene, CASINO_CATALOG.filter((g) => !g.disabled));

    // ── Hologram pool (8 slots, allocated once) ──────────────────────────────
    const holoSlots = buildHologramPool(scene, 8);

    // ── Feed state ───────────────────────────────────────────────────────────
    // Key: txDigest, so we fire once per unique row
    const seenDigests = new Set<string>();
    // Most-recent row per stationKey (for hologram placement)
    const latestByStation = new Map<string, InstantFeedRow>();
    const HOLO_TTL = 10 * 60 * 1000; // 10 min in ms

    // Station key → Station object (fast lookup)
    const stationByKey = new Map<string, Station>();
    for (const st of stations) stationByKey.set(st.key, st);

    // Activity pulse rings (rising orange ring on new play)
    const activityPulses: ReturnType<typeof makeActivityPulse>[] = [];

    function updateHolograms() {
      const now = performance.now();
      let active = 0;
      for (const slot of holoSlots) {
        if (!slot.active) continue;
        if (now > slot.expiresAt) {
          // fade-out: just hide
          slot.active = false;
          slot.group.visible = false;
          latestByStation.delete(slot.stationKey);
        } else {
          active++;
        }
      }
      return active;
    }

    function placeHologram(row: InstantFeedRow, station: Station) {
      // Find a free slot (or steal oldest)
      let slot: HoloSlot | null = null;
      for (const s of holoSlots) {
        if (!s.active) { slot = s; break; }
      }
      if (!slot) {
        // All 8 busy — steal slot assigned to same station or the one expiring soonest
        let earliest = Infinity;
        for (const s of holoSlots) {
          if (s.stationKey === station.key) { slot = s; break; }
          if (s.expiresAt < earliest) { earliest = s.expiresAt; slot = s; }
        }
      }
      if (!slot) return;

      const col = playerColor(row.player);
      slot.bodyMat.color.setHex(col);
      slot.bodyMat.opacity = 0.35;
      slot.headMat.color.setHex(col);
      slot.headMat.opacity = 0.35;
      // Stand slightly offset from station centre so multiple holograms don't overlap
      const angle = (performance.now() * 0.001) % (Math.PI * 2);
      slot.group.position.set(
        station.position.x + Math.cos(angle) * 1.4,
        0,
        station.position.z + Math.sin(angle) * 1.4,
      );
      slot.group.visible = true;
      slot.active = true;
      slot.stationKey = station.key;
      slot.expiresAt = performance.now() + HOLO_TTL;
    }

    async function pollFeed() {
      let rows: InstantFeedRow[];
      try { rows = await fetchRecentInstantPlays(20); } catch { return; }
      const newLatest = new Map<string, InstantFeedRow>();

      for (const row of rows) {
        const stKey = feedKeyToStationKey(row.game);
        const station = stationByKey.get(stKey);
        if (!station) continue;

        // Track latest row per station
        const cur = newLatest.get(stKey);
        if (!cur || row.ts > cur.ts) newLatest.set(stKey, row);

        // Fire activity pulse for unseen rows
        if (row.txDigest && !seenDigests.has(row.txDigest)) {
          seenDigests.add(row.txDigest);
          station.triggerPulse?.();
          activityPulses.push(makeActivityPulse(scene, station.position));

          // Jackpot klaxon: payout/wager >= 25
          if (row.wager > 0 && row.payout / row.wager >= 25) {
            floorCtrl.triggerKlaxon();
          }
        }
      }

      // Update holograms: place/refresh for latest row per station (within TTL)
      for (const [stKey, row] of newLatest) {
        const station = stationByKey.get(stKey);
        if (!station) continue;
        const prev = latestByStation.get(stKey);
        if (!prev || row.txDigest !== prev.txDigest) {
          latestByStation.set(stKey, row);
          placeHologram(row, station);
        }
      }

      // Cull digests set if it grows large (keep last 500)
      if (seenDigests.size > 500) {
        const arr = [...seenDigests];
        for (let i = 0; i < arr.length - 200; i++) seenDigests.delete(arr[i]);
      }
    }

    // Initial poll immediately, then every 15 s
    void pollFeed();
    const feedInterval = setInterval(() => void pollFeed(), 15_000);

    // ── Controls ─────────────────────────────────────────────────────────────
    // Active target rings (alive list, updated each frame)
    const activeRings: ReturnType<typeof makeTargetRing>[] = [];

    const controls = new FloorControls(camera, renderer.domElement, ROOM_BOUNDS, {
      onClickTarget: (pos: THREE.Vector3) => {
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

      // Tick activity pulse rings
      for (let i = activityPulses.length - 1; i >= 0; i--) {
        const alive = activityPulses[i].update(dt);
        if (!alive) activityPulses.splice(i, 1);
      }

      // Expire holograms + tick floor (klaxon)
      updateHolograms();
      floorCtrl.tick(dt);

      // Nearest station + zone — check every 5 frames
      if (frameIdx % 5 === 0) {
        cam2d.set(camera.position.x, camera.position.z);

        // ── Distance-reveal constants ──────────────────────────────────────
        const LABEL_FULL = 7;   // m — fully opaque inside this radius
        const LABEL_HIDE = 13;  // m — invisible beyond this radius
        const LABEL_BASE_W = 1.3; // world-space sprite width
        const LABEL_BASE_H = 1.3 * (64 / 320); // height proportional to canvas

        // Nearest station (full scan)
        let nearestSt: Station | null = null;
        let nearestStDist = Infinity;
        for (let i = 0; i < stations.length; i++) {
          const st = stations[i];
          const dx = cam2d.x - st.position.x;
          const dz = cam2d.y - st.position.z;
          const d  = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestStDist) {
            nearestStDist = d;
            nearestSt     = st;
          }
        }

        // Update setNear flags (only when changed; based on interaction radius)
        const inRadius = nearestSt && nearestStDist < (nearestSt?.radius ?? 0);
        const activeSt = inRadius ? nearestSt : null;
        if (activeSt !== nearStRef.current) {
          nearStRef.current?.setNear?.(false);
          activeSt?.setNear?.(true);
          nearStRef.current = activeSt;
          setNearStation(activeSt);
        }

        // ── Per-station label visibility + opacity ─────────────────────────
        for (let i = 0; i < stations.length; i++) {
          const st = stations[i];
          const lbl = st.label;
          const dx = cam2d.x - st.position.x;
          const dz = cam2d.y - st.position.z;
          const d  = Math.sqrt(dx * dx + dz * dz);

          if (d >= LABEL_HIDE) {
            lbl.visible = false;
          } else {
            lbl.visible = true;
            const mat = lbl.material as THREE.SpriteMaterial;
            const isNearest = st === nearestSt;
            if (d <= LABEL_FULL) {
              mat.opacity = 1.0;
              // Slight emphasis on nearest station
              const w = isNearest ? LABEL_BASE_W * 1.15 : LABEL_BASE_W;
              const h = isNearest ? LABEL_BASE_H * 1.15 : LABEL_BASE_H;
              lbl.scale.set(w, h, 1);
            } else {
              // Linear fade 7 → 13 m
              const t = (d - LABEL_FULL) / (LABEL_HIDE - LABEL_FULL);
              mat.opacity = 1.0 - t;
              lbl.scale.set(LABEL_BASE_W, LABEL_BASE_H, 1);
            }
          }
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
      clearInterval(feedInterval);
      ro.disconnect();
      controls.dispose();
      recallRef.current = null;

      // Dispose all active rings
      for (const r of activeRings) {
        scene.remove(r.mesh);
      }

      // Dispose activity pulses
      for (const r of activityPulses) {
        scene.remove(r.mesh);
      }

      // Dispose hologram pool
      for (const slot of holoSlots) {
        scene.remove(slot.group);
        slot.bodyMat.dispose();
        slot.headMat.dispose();
        // geometries are shared via traverse below
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
