/**
 * floor.ts — Cyberpunk industrial bunker / decommissioned-starship gambling den.
 *
 * Art direction (Raw 2026-07-12): match the card-art aesthetic.
 *   - Hull-metal PBR walls/floor: #1a1510–#2a2520, roughness 0.75, metalness 0.85
 *   - Dominant mood: orange neon (#ff6600) emissive strips — floor seam, mid-wall, ceiling edge
 *   - Cold-white SpotLights (#e8f0ff, π/8 angle, penumbra 0.4) — 5 zone pillars
 *   - Warm amber (#cc5500) PointLight fill at table height
 *   - Very dim cold-blue ambient (#111520, 0.6)
 *   - Hazard-chevron decals at zone thresholds (canvas texture, shared material)
 *   - Wall panel seams (vertical dark strips) + rivet dots
 *   - Ceiling ducting (3 horizontal pipe runs — oppressive low feel)
 *   - Faked volumetric cones under spotlights (ConeGeometry, additive blend)
 *   - Klaxon: pulses neon strips gold on jackpot
 */

import * as THREE from "three";

// ── Hall dimensions ──────────────────────────────────────────────────────────
export const ROOM_BOUNDS = { minX: -32, maxX: 32, minZ: -18, maxZ: 18 };

const HALL_W = 66;
const HALL_D = 38;
const HALL_H = 5.0;

// ── Palette ──────────────────────────────────────────────────────────────────
const FLOOR_COLOR  = 0x0d0d0d;    // near-black floor tiles
const WALL_COLOR   = 0x1a1510;    // dark brushed-metal (warm tint)
const METAL_DARK   = 0x0f0e0d;    // panel seam / rivet dark
const CEIL_COLOR   = 0x0d0d10;
const NEON_ORG     = 0xff6600;    // dominant orange neon
const DEEP_AMB     = 0xcc4400;    // deep amber accent
const GOLD         = 0xe8b84b;    // gold trim (klaxon pulse target)

// Zone accent trim strip palette (unchanged from prior version)
const ZONE_TRIM: { x: number; z: number; w: number; d: number; color: number }[] = [
  { x: -22, z:  0,  w: 16, d: 0.08, color: 0xe8c060 },
  { x: -14, z: -10, w: 12, d: 0.08, color: 0xff6020 },
  { x:  -4, z: -12, w:  8, d: 0.08, color: 0xff4700 },
  { x:   6, z: -12, w:  8, d: 0.08, color: 0xffa030 },
  { x:  18, z:  -8, w: 10, d: 0.08, color: 0xff2010 },
  { x:  24, z:   0, w:  0, d: 0.08, color: 0xe0b840 },
  { x:  20, z:   8, w:  6, d: 0.08, color: 0xd09040 },
  { x: -20, z:   8, w:  6, d: 0.08, color: 0xc07830 },
  { x:   0, z:   8, w:  6, d: 0.08, color: 0xb8c040 },
];

// ─────────────────────────────────────────────────────────────────────────────

export interface FloorControls {
  tick: (dt: number) => void;
  triggerKlaxon: () => void;
}

// ── Hazard stripe texture (created once, shared) ─────────────────────────────
function makeHazardTex(): THREE.CanvasTexture {
  const W = 128, H = 24;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#0d0b09";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#ff6600";
  for (let i = -H; i < W + H; i += 18) {
    c.beginPath();
    c.moveTo(i, 0); c.lineTo(i + H, H); c.lineTo(i + H + 9, H); c.lineTo(i + 9, 0);
    c.closePath(); c.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildFloor(scene: THREE.Scene): FloorControls {

  // ── Lighting ──────────────────────────────────────────────────────────────

  // 1. Very dim cold-blue ambient — scene fill only, not the mood.
  const ambient = new THREE.AmbientLight(0x111520, 0.6);
  scene.add(ambient);

  // 2. Minimal hemisphere (barely visible, preserves form in shadows)
  const hemi = new THREE.HemisphereLight(0x0d1525, 0x060504, 0.3);
  hemi.position.set(0, HALL_H, 0);
  scene.add(hemi);

  // 3. Cold-white SpotLights — one per zone cluster, god-ray cones angled straight down.
  //    angle=π/8 (~22.5°), penumbra=0.4 → soft-edged beam.
  const SPOT_DEFS: [number, number][] = [
    [-22,   0],  // cards zone
    [ -8,  -8],  // dice / wheels
    [  6,  -8],  // grid / crash
    [ 22,   0],  // drop / slots
    [  0,  10],  // entrance / lottery
  ];
  for (const [sx, sz] of SPOT_DEFS) {
    const spot = new THREE.SpotLight(0xe8f0ff, 5.5, 22, Math.PI / 8, 0.4, 1.4);
    spot.position.set(sx, HALL_H - 0.25, sz);
    spot.target.position.set(sx, 0, sz);
    scene.add(spot);
    scene.add(spot.target);
  }

  // 4. Warm amber PointLights at table height — gentle upward fill on surfaces.
  const AMBER_DEFS: [number, number, number, number][] = [
    [-22, 0.9,   0,  1.4],
    [ -8, 0.9,  -8,  1.4],
    [  6, 0.9,  -8,  1.4],
    [ 22, 0.9,   0,  1.4],
    [  0, 0.9,  10,  1.2],
  ];
  for (const [ax, ay, az, ai] of AMBER_DEFS) {
    const pl = new THREE.PointLight(DEEP_AMB, ai, 14, 1.8);
    pl.position.set(ax, ay, az);
    scene.add(pl);
  }

  // ── Shared materials ───────────────────────────────────────────────────────
  // Hull-metal — all major structural surfaces
  const wallMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR, roughness: 0.75, metalness: 0.85,
  });
  // Floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR, roughness: 0.88, metalness: 0.30,
  });
  // Panel seam / rivet — slightly darker, same metalness
  const seamDarkMat = new THREE.MeshStandardMaterial({
    color: METAL_DARK, roughness: 0.85, metalness: 0.72,
  });
  // Dominant neon orange emissive (strips, seams)
  const neonMat = new THREE.MeshStandardMaterial({
    color: NEON_ORG, emissive: new THREE.Color(NEON_ORG),
    emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1,
  });
  // Ceiling + beams
  const ceilMat = new THREE.MeshStandardMaterial({ color: CEIL_COLOR, roughness: 0.9 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x0d0c0b, roughness: 0.82 });
  // Ducting (slightly lighter than ceiling)
  const ductMat = new THREE.MeshStandardMaterial({
    color: 0x1c1b1a, roughness: 0.78, metalness: 0.65,
  });
  // Hazard chevrons (shared canvas texture)
  const hazTex = makeHazardTex();
  const hazMat = new THREE.MeshStandardMaterial({
    map: hazTex, roughness: 0.82, metalness: 0.15, transparent: true, opacity: 0.88,
  });
  hazMat.map!.repeat.set(8, 1);
  // Volumetric cone (additive blend, very low opacity — faked god-ray)
  const volConeMat = new THREE.MeshBasicMaterial({
    color: 0xffd0a0, transparent: true, opacity: 0.028,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  // Gold trim (entrance + klaxon target)
  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.22,
    roughness: 0.4, metalness: 0.7,
  });

  // ── Floor ──────────────────────────────────────────────────────────────────
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  // ── Walls ──────────────────────────────────────────────────────────────────
  const wallDefs: [number, number, number, number, number, number][] = [
    [   0, HALL_H/2, -(HALL_D/2), HALL_W, HALL_H, 0.3 ], // back
    [   0, HALL_H/2,  (HALL_D/2), HALL_W, HALL_H, 0.3 ], // front
    [-(HALL_W/2), HALL_H/2, 0, 0.3, HALL_H, HALL_D ],    // left
    [ (HALL_W/2), HALL_H/2, 0, 0.3, HALL_H, HALL_D ],    // right
  ];
  for (const [x, y, z, w, h, d] of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    scene.add(m);
  }

  // ── Wall panel seams — vertical dark strips every ~11 m on long walls ───────
  // Back/front walls (X axis): seams at x = -22, -11, 0, 11, 22
  for (const wz of [-(HALL_D/2 - 0.19), (HALL_D/2 - 0.19)]) {
    for (const sx of [-22, -11, 0, 11, 22]) {
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.06, HALL_H, 0.06), seamDarkMat);
      sm.position.set(sx, HALL_H/2, wz);
      scene.add(sm);
    }
    // Horizontal mid-wall seam
    const hSeam = new THREE.Mesh(new THREE.BoxGeometry(HALL_W - 0.4, 0.06, 0.06), seamDarkMat);
    hSeam.position.set(0, 2.2, wz);
    scene.add(hSeam);
  }
  // Left/right walls (Z axis): seams at z = -12, 0, 12
  for (const wx of [-(HALL_W/2 - 0.19), (HALL_W/2 - 0.19)]) {
    for (const sz of [-12, 0, 12]) {
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.06, HALL_H, 0.06), seamDarkMat);
      sm.position.set(wx, HALL_H/2, sz);
      scene.add(sm);
    }
    const hSeam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, HALL_D - 0.4), seamDarkMat);
    hSeam.position.set(wx, 2.2, 0);
    scene.add(hSeam);
  }

  // ── Rivet dots at panel-seam intersections (back/front walls) ───────────────
  const rivetGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.6, metalness: 0.8 });
  for (const wz of [-(HALL_D/2 - 0.16), (HALL_D/2 - 0.16)]) {
    for (const sx of [-22, -11, 0, 11, 22]) {
      for (const ry of [0.12, 2.2, HALL_H - 0.12]) {
        const rv = new THREE.Mesh(rivetGeo, rivetMat);
        rv.position.set(sx, ry, wz);
        scene.add(rv);
      }
    }
  }

  // ── Ceiling ────────────────────────────────────────────────────────────────
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = HALL_H;
  scene.add(ceil);

  // ── Ceiling beams (5 across, lowered slightly) ─────────────────────────────
  for (const bx of [-20, -10, 0, 10, 20]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, HALL_D), beamMat);
    b.position.set(bx, HALL_H - 0.15, 0);
    scene.add(b);
  }

  // ── Ceiling ducting — 3 horizontal pipe runs (oppressive overhead) ───────
  // Box sections approximating round ducts: 0.35×0.28 cross-section, full hall width/depth.
  const ductRuns: [number, number, number, number, number, number][] = [
    [  0,  HALL_H - 0.52,  -6,  HALL_W - 2, 0.28, 0.35 ], // centre longitudinal
    [-14,  HALL_H - 0.52,   0,  HALL_W - 2, 0.22, 0.28 ], // left lateral (shorter)
    [ 14,  HALL_H - 0.52,   0,  HALL_W - 2, 0.22, 0.28 ], // right lateral
  ];
  for (const [dx, dy, dz, dw, dh, dd] of ductRuns) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), ductMat);
    d.position.set(dx, dy, dz);
    scene.add(d);
  }
  // Duct connector elbow stubs (visual richness at beam intersections)
  for (const bx of [-20, 0, 20]) {
    const el = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), ductMat);
    el.position.set(bx, HALL_H - 0.52, -6);
    scene.add(el);
  }

  // ── Volumetric light cones (faked god-rays under each spotlight) ──────────
  // ConeGeometry default: apex at top, base at bottom. Center at HALL_H/2 → apex at HALL_H, base at 0.
  const coneGeo = new THREE.ConeGeometry(2.1, HALL_H - 0.4, 8, 1, true);
  for (const [cx, cz] of SPOT_DEFS) {
    const cone = new THREE.Mesh(coneGeo, volConeMat);
    cone.position.set(cx, HALL_H / 2, cz);
    scene.add(cone);
  }

  // ── Floor-wall seam strips (dominant neon orange) ─────────────────────────
  const seams: [number, number, number, number, number, number][] = [
    [   0, 0.04, -(HALL_D/2 - 0.05), HALL_W - 0.4, 0.08, 0.08 ],
    [   0, 0.04,  (HALL_D/2 - 0.05), HALL_W - 0.4, 0.08, 0.08 ],
    [-(HALL_W/2 - 0.05), 0.04, 0, 0.08, 0.08, HALL_D - 0.4 ],
    [ (HALL_W/2 - 0.05), 0.04, 0, 0.08, 0.08, HALL_D - 0.4 ],
  ];
  for (const [x, y, z, w, h, d] of seams) {
    const sm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    sm.position.set(x, y, z);
    scene.add(sm);
  }

  // ── Mid-wall horizontal neon strips (eye-level, ~1.6 m) ──────────────────
  const midStrips: [number, number, number, number, number, number][] = [
    [   0, 1.62, -(HALL_D/2 - 0.17), HALL_W - 0.5, 0.06, 0.05 ], // back
    [   0, 1.62,  (HALL_D/2 - 0.17), HALL_W - 0.5, 0.06, 0.05 ], // front
    [-(HALL_W/2 - 0.17), 1.62, 0, 0.05, 0.06, HALL_D - 0.5 ],    // left
    [ (HALL_W/2 - 0.17), 1.62, 0, 0.05, 0.06, HALL_D - 0.5 ],    // right
  ];
  for (const [x, y, z, w, h, d] of midStrips) {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    ms.position.set(x, y, z);
    scene.add(ms);
  }

  // ── Ceiling perimeter neon strips ─────────────────────────────────────────
  const ceilStrips: [number, number, number, number, number, number][] = [
    [   0, HALL_H - 0.18, -(HALL_D/2 - 0.17), HALL_W - 0.5, 0.06, 0.05 ],
    [   0, HALL_H - 0.18,  (HALL_D/2 - 0.17), HALL_W - 0.5, 0.06, 0.05 ],
    [-(HALL_W/2 - 0.17), HALL_H - 0.18, 0, 0.05, 0.06, HALL_D - 0.5 ],
    [ (HALL_W/2 - 0.17), HALL_H - 0.18, 0, 0.05, 0.06, HALL_D - 0.5 ],
  ];
  for (const [x, y, z, w, h, d] of ceilStrips) {
    const cs = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    cs.position.set(x, y, z);
    scene.add(cs);
  }

  // ── Hazard-chevron decals at zone thresholds ──────────────────────────────
  // Thin planes lying flat on the floor at zone entry borders.
  const hazDecals: [number, number, boolean][] = [
    [-22, -4.0,  false],   // cards entry threshold
    [-14, -5.0,  false],   // dice entry
    [ -4, -7.0,  false],   // wheels entry
    [  6, -7.0,  false],   // grid entry
    [ 18, -3.5,  false],   // crash entry
    [ 22,  3.5,  true ],   // drop/slots (perpendicular)
    [-20,  3.5,  true ],   // duels entry (perpendicular)
    [  0,  3.5,  false],   // lottery entry
  ];
  for (const [hx, hz, perp] of hazDecals) {
    const geo = perp
      ? new THREE.PlaneGeometry(0.28, 7.0)
      : new THREE.PlaneGeometry(7.0, 0.28);
    const m = new THREE.Mesh(geo, hazMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(hx, 0.015, hz);
    scene.add(m);
  }
  // Short hazard strip along each long wall at panel seam heights (decor)
  for (const wz of [-(HALL_D/2 - 0.35), (HALL_D/2 - 0.35)]) {
    const wallHaz = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W - 4, 0.22),
      new THREE.MeshStandardMaterial({
        map: (() => { const t = makeHazardTex(); t.repeat.set(12, 1); return t; })(),
        roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.55,
      }),
    );
    wallHaz.rotation.x = Math.PI / 2;   // vertical, facing inward
    wallHaz.rotation.z = Math.PI / 2;
    wallHaz.position.set(0, 0.11, wz);
    scene.add(wallHaz);
  }

  // ── Entrance threshold strips (gold + orange) ─────────────────────────────
  const threshMat = new THREE.MeshStandardMaterial({
    color: NEON_ORG, emissive: new THREE.Color(NEON_ORG), emissiveIntensity: 1.2, roughness: 0.4,
  });
  const thresh1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.06, 0.18), threshMat);
  thresh1.position.set(0, 0.03, 13.5);
  scene.add(thresh1);
  const thresh2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 0.1), threshMat);
  thresh2.position.set(0, 0.02, 14.5);
  scene.add(thresh2);

  // ── Gold wall trims (doorframe accents front/back) ─────────────────────────
  for (const tz of [-(HALL_D/2 - 0.18), (HALL_D/2 - 0.18)]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.12), goldMat);
    trim.position.set(0, 2.4, tz);
    scene.add(trim);
  }

  // ── Per-zone accent floor trim strips ─────────────────────────────────────
  for (const zt of ZONE_TRIM) {
    if (zt.w === 0) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: zt.color, emissive: new THREE.Color(zt.color), emissiveIntensity: 0.55, roughness: 0.4,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(zt.w, 0.04, 0.12), mat);
    strip.position.set(zt.x, 0.02, zt.z + 3.2);
    scene.add(strip);
  }
  // Drop-zone vertical floor strip
  {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0b840, emissive: new THREE.Color(0xe0b840), emissiveIntensity: 0.55, roughness: 0.4,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 8), mat);
    strip.position.set(21.5, 0.02, 0);
    scene.add(strip);
  }

  // ── Klaxon flash controller ────────────────────────────────────────────────
  // On jackpot (payout/wager ≥ 25): neon seam strips pulse gold for 2 s.
  let klaxonTime = 0;
  return {
    triggerKlaxon() { klaxonTime = 2.0; },
    tick(dt: number) {
      if (klaxonTime <= 0) return;
      klaxonTime -= dt;
      if (klaxonTime <= 0) {
        neonMat.color.setHex(NEON_ORG);
        neonMat.emissive.setHex(NEON_ORG);
        neonMat.emissiveIntensity = 2.5;
        return;
      }
      const gold = Math.sin(klaxonTime * 12) > 0;
      neonMat.color.setHex(gold ? GOLD : NEON_ORG);
      neonMat.emissive.setHex(gold ? GOLD : NEON_ORG);
      neonMat.emissiveIntensity = gold ? 3.8 : 2.5;
    },
  };
}
