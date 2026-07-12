/**
 * floor.ts — Full casino hall: 64×36m, entrance strip, per-zone accent trim,
 * 5 point lights + ambient. No shadows. Well under 40k tris.
 */

import * as THREE from "three";

// ── Hall dimensions ──────────────────────────────────────────────────────────
export const ROOM_BOUNDS = { minX: -32, maxX: 32, minZ: -18, maxZ: 18 };

const HALL_W = 66;   // slightly wider than bounds so seams sit flush
const HALL_D = 38;
const HALL_H = 5.0;

// ── Palette ──────────────────────────────────────────────────────────────────
const FLOOR_COLOR = 0x080810;
const WALL_COLOR  = 0x0e0e18;
const CEIL_COLOR  = 0x0b0b14;
const ACCENT_ORG  = 0xff4700;
const GOLD        = 0xe8b84b;

// Zone accent trim positions: [x, z, width, depth, rotated?]
// One thin strip per zone, laid flat just above floor as a marker.
const ZONE_TRIM: { x: number; z: number; w: number; d: number; color: number }[] = [
  { x: -22, z:  0,  w: 16, d: 0.08, color: 0xe8c060 }, // cards
  { x: -14, z: -10, w: 12, d: 0.08, color: 0xff6020 }, // dice
  { x:  -4, z: -12, w:  8, d: 0.08, color: 0xff4700 }, // wheels
  { x:   6, z: -12, w:  8, d: 0.08, color: 0xffa030 }, // grid
  { x:  18, z:  -8, w: 10, d: 0.08, color: 0xff2010 }, // crash
  { x:  24, z:   0, w:  0, d: 0.08, color: 0xe0b840 }, // drop (vertical strip)
  { x:  20, z:   8, w:  6, d: 0.08, color: 0xd09040 }, // slots
  { x: -20, z:   8, w:  6, d: 0.08, color: 0xc07830 }, // duels
  { x:   0, z:   8, w:  6, d: 0.08, color: 0xb8c040 }, // lottery
];

// ─────────────────────────────────────────────────────────────────────────────

export interface FloorControls {
  tick: (dt: number) => void;
  triggerKlaxon: () => void;
}

export function buildFloor(scene: THREE.Scene): FloorControls {
  // ── Lights ──────────────────────────────────────────────────────────────────
  // Ambient raised ~2.4x + brighter tint (Raw feedback 2026-07-11: floor too dark in webview).
  const ambient = new THREE.AmbientLight(0x3a3a52, 3.4);
  scene.add(ambient);

  // Hemisphere fill: warm sky, cool ground bounce — lifts overall floor brightness evenly.
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x101018, 1.6);
  hemi.position.set(0, HALL_H, 0);
  scene.add(hemi);

  // 5 point lights spread across the longer hall (intensity ~2.5x + wider falloff range).
  const lights: [number, number, number, number, number][] = [
    [-22, 3.8,  0,   0xffb060, 4.0], // cards zone
    [ -8, 3.8, -8,   0xffc878, 3.6], // dice/wheels
    [  6, 3.8,  -8,  0xffb060, 3.6], // grid/crash
    [ 22, 3.8,  0,   0xffc878, 3.8], // drop/slots
    [  0, 3.8,  10,  0xffc068, 3.4], // entrance area
  ];
  for (const [x, y, z, color, intensity] of lights) {
    const pl = new THREE.PointLight(color, intensity, 44, 1.2);
    pl.position.set(x, y, z);
    scene.add(pl);
  }

  // ── Floor ───────────────────────────────────────────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(HALL_W, HALL_D);
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR, roughness: 0.9, metalness: 0.25,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ── Walls ───────────────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 });
  // [x, y, z, w, h, d]
  const wallDefs: [number, number, number, number, number, number][] = [
    [   0, HALL_H / 2, -(HALL_D / 2), HALL_W, HALL_H, 0.3 ], // back
    [   0, HALL_H / 2,  (HALL_D / 2), HALL_W, HALL_H, 0.3 ], // front
    [-(HALL_W / 2), HALL_H / 2, 0, 0.3, HALL_H, HALL_D ],    // left
    [ (HALL_W / 2), HALL_H / 2, 0, 0.3, HALL_H, HALL_D ],    // right
  ];
  for (const [x, y, z, w, h, d] of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    scene.add(m);
  }

  // ── Ceiling ─────────────────────────────────────────────────────────────────
  const ceilMat = new THREE.MeshStandardMaterial({ color: CEIL_COLOR, roughness: 0.9 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = HALL_H;
  scene.add(ceil);

  // ── Ceiling beams (5 across) ────────────────────────────────────────────────
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x151520, roughness: 0.8 });
  for (const bx of [-20, -10, 0, 10, 20]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, HALL_D), beamMat);
    b.position.set(bx, HALL_H - 0.15, 0);
    scene.add(b);
  }

  // ── Floor-wall seam strips (emissive orange) ─────────────────────────────────
  const seamMat = new THREE.MeshStandardMaterial({
    color: ACCENT_ORG, emissive: new THREE.Color(ACCENT_ORG), emissiveIntensity: 0.9, roughness: 0.4,
  });
  const seams: [number, number, number, number, number, number][] = [
    [   0, 0.04, -(HALL_D / 2 - 0.05), HALL_W - 0.4, 0.08, 0.08 ], // back
    [   0, 0.04,  (HALL_D / 2 - 0.05), HALL_W - 0.4, 0.08, 0.08 ], // front
    [-(HALL_W / 2 - 0.05), 0.04, 0, 0.08, 0.08, HALL_D - 0.4 ],    // left
    [ (HALL_W / 2 - 0.05), 0.04, 0, 0.08, 0.08, HALL_D - 0.4 ],    // right
  ];
  for (const [x, y, z, w, h, d] of seams) {
    const sm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seamMat);
    sm.position.set(x, y, z);
    scene.add(sm);
  }

  // ── Entrance threshold strip ─────────────────────────────────────────────────
  // Wide emissive strip at z≈13 marking the approach to the floor
  const threshMat = new THREE.MeshStandardMaterial({
    color: GOLD, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.55, roughness: 0.4,
  });
  const thresh = new THREE.Mesh(new THREE.BoxGeometry(20, 0.06, 0.18), threshMat);
  thresh.position.set(0, 0.03, 13.5);
  scene.add(thresh);
  // Secondary outer threshold
  const thresh2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 0.1), threshMat);
  thresh2.position.set(0, 0.02, 14.5);
  scene.add(thresh2);

  // ── Gold wall trims (doorframe accents front/back) ──────────────────────────
  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.22,
    roughness: 0.4, metalness: 0.7,
  });
  for (const tz of [-(HALL_D / 2 - 0.18), (HALL_D / 2 - 0.18)]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.12), goldMat);
    trim.position.set(0, 2.4, tz);
    scene.add(trim);
  }

  // ── Per-zone accent floor trim strips ───────────────────────────────────────
  for (const zt of ZONE_TRIM) {
    if (zt.w === 0) continue; // handled separately if needed
    const mat = new THREE.MeshStandardMaterial({
      color: zt.color, emissive: new THREE.Color(zt.color), emissiveIntensity: 0.28, roughness: 0.5,
    });
    // Horizontal strip in front of zone center
    const strip = new THREE.Mesh(new THREE.BoxGeometry(zt.w, 0.04, 0.12), mat);
    strip.position.set(zt.x, 0.02, zt.z + 3.2); // slightly in front of zone
    scene.add(strip);
  }

  // Drop zone: vertical strip (different orientation)
  {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0b840, emissive: new THREE.Color(0xe0b840), emissiveIntensity: 0.28, roughness: 0.5,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 8), mat);
    strip.position.set(21.5, 0.02, 0);
    scene.add(strip);
  }

  // ── Klaxon flash controller (jackpot moment: wall seams pulse gold for 2s)
  let klaxonTime = 0;
  return {
    triggerKlaxon() { klaxonTime = 2.0; },
    tick(dt: number) {
      if (klaxonTime <= 0) return;
      klaxonTime -= dt;
      if (klaxonTime <= 0) {
        seamMat.color.setHex(ACCENT_ORG);
        seamMat.emissive.setHex(ACCENT_ORG);
        seamMat.emissiveIntensity = 0.9;
        return;
      }
      const gold = Math.sin(klaxonTime * 12) > 0;
      seamMat.color.setHex(gold ? GOLD : ACCENT_ORG);
      seamMat.emissive.setHex(gold ? GOLD : ACCENT_ORG);
      seamMat.emissiveIntensity = gold ? 2.2 : 0.9;
    },
  };
}
