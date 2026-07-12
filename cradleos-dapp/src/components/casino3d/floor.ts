/**
 * floor.ts — Cyberpunk industrial bunker casino floor.
 *
 * Iteration 2 (2026-07-12): match card-art aesthetic.
 *   - Hull-panel canvas texture (SRGBColorSpace = canvas pixel IS output pixel)
 *   - MeshBasicMaterial walls + fog:false → texture always visible at full contrast
 *   - Raised ambient/hemi + reduced spotlights → more even dark-metal illumination
 *   - Thick neon strips (0.14m) + MeshBasicMaterial AdditiveBlending glow planes
 *   - Wall-base PointLights for physical neon glow on geometry
 *   - Floor light-spill gradient decals under perimeter strips
 *   - LinearToneMapping + exposure 1.0 (set in Casino3D.tsx)
 *   - Klaxon: pulses neon strips gold on jackpot
 */

import * as THREE from "three";

// ── Hall dimensions ──────────────────────────────────────────────────────────
export const ROOM_BOUNDS = { minX: -32, maxX: 32, minZ: -18, maxZ: 18 };

const HALL_W = 66;
const HALL_D = 38;
const HALL_H = 5.0;

// ── Palette ──────────────────────────────────────────────────────────────────
const CEIL_COLOR   = 0x0d0d10;
const NEON_ORG     = 0xff6600;
const DEEP_AMB     = 0xcc4400;
const GOLD         = 0xe8b84b;

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

export interface FloorControls {
  tick: (dt: number) => void;
  triggerKlaxon: () => void;
}

// ── Hull-panel wall texture ───────────────────────────────────────────────────
// SRGBColorSpace = identity transform: canvas sRGB pixel IS the output sRGB pixel.
// With LinearToneMapping (set in Casino3D.tsx), colors are faithful to the canvas.
// Panel at #3d3628 (~20% sRGB brightness), seam at #060402 (~2.5%), rivets at #484040 (~28%)
function makeHullPanelTex(): THREE.CanvasTexture {
  const W = 256, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;

  // Seam/gap fill: very dark
  ctx.fillStyle = "#060402";
  ctx.fillRect(0, 0, W, H);

  const cols = 2, rows = 2;
  const pw = W / cols, ph = H / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pw, y = r * ph;
      // Panel gradient: top-left lit, bottom-right dark — warm metal
      const grad = ctx.createLinearGradient(x, y, x + pw, y + ph);
      grad.addColorStop(0,   "#3d3628");   // lit corner ~20% sRGB
      grad.addColorStop(0.4, "#302a20");   // mid panel ~17%
      grad.addColorStop(1,   "#22201c");   // dark corner ~13%
      ctx.fillStyle = grad;
      ctx.fillRect(x + 5, y + 5, pw - 10, ph - 10);

      // Horizontal wear marks
      ctx.strokeStyle = "rgba(70,63,48,0.9)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const sy = y + 14 + i * (ph / 4);
        ctx.beginPath(); ctx.moveTo(x + 10, sy); ctx.lineTo(x + pw - 10, sy + 2); ctx.stroke();
      }

      // Upper-left bevel highlight
      ctx.fillStyle = "rgba(62,55,42,0.6)";
      ctx.fillRect(x + 5, y + 5, pw * 0.22, ph * 0.22);
    }
  }

  // Seam border lines: strong dark contrast vs panels
  ctx.strokeStyle = "#040302";
  ctx.lineWidth = 9;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * pw, 0); ctx.lineTo(c * pw, H); ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * ph); ctx.lineTo(W, r * ph); ctx.stroke();
  }

  // Orange neon spill from ceiling strip (top edge)
  const tg = ctx.createLinearGradient(0, 0, 0, 30);
  tg.addColorStop(0,   "rgba(255,90,0,0.30)");
  tg.addColorStop(0.7, "rgba(255,90,0,0.06)");
  tg.addColorStop(1,   "rgba(255,90,0,0)");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, 30);

  // Rivets at seam intersections: ~28% body, ~55% specular
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      ctx.fillStyle = "#040200";
      ctx.beginPath(); ctx.arc(c * pw + 2, r * ph + 2, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#484040";
      ctx.beginPath(); ctx.arc(c * pw, r * ph, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(140,125,95,1.0)";
      ctx.beginPath(); ctx.arc(c * pw - 2.5, r * ph - 2.5, 4.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; // identity with LinearToneMapping
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Shared hull-panel texture (for stations.ts) ───────────────────────────────
let _sharedHullTex: THREE.CanvasTexture | null = null;
export function getSharedHullTex(): THREE.CanvasTexture {
  if (!_sharedHullTex) _sharedHullTex = makeHullPanelTex();
  return _sharedHullTex;
}

// ── Procedural floor plate texture (fallback) ────────────────────────────────
function makeFloorPlateTex(): THREE.CanvasTexture {
  const W = 256, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#0f0d0a"; ctx.fillRect(0, 0, W, H);
  const cols = 2, rows = 2;
  const pw = W / cols, ph = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pw, y = r * ph;
      ctx.fillStyle = "#13100c"; ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
      ctx.fillStyle = "#090806"; ctx.fillRect(x + pw - 5, y + 2, 3, ph - 4);
      ctx.fillRect(x + 2, y + ph - 5, pw - 4, 3);
    }
  }
  ctx.strokeStyle = "#060504"; ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c*pw,0); ctx.lineTo(c*pw,H); ctx.stroke(); }
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0,r*ph); ctx.lineTo(W,r*ph); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Hazard stripe texture ─────────────────────────────────────────────────────
function makeHazardTex(): THREE.CanvasTexture {
  const W = 128, H = 24;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#0d0b09"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#ff6600";
  for (let i = -H; i < W + H; i += 18) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.lineTo(i + H + 9, H); c.lineTo(i + 9, 0);
    c.closePath(); c.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Additive glow plane (fake bloom) ─────────────────────────────────────────
// MeshBasicMaterial + AdditiveBlending + fog:false + depthTest:false
// Positioned in front of neon strips, facing inward. Adds orange halo.
function makeGlowPlane(
  color: THREE.Color, worldW: number, worldH: number, coreOpacity = 0.75,
): THREE.Mesh {
  const W = 128, H = 64;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grad.addColorStop(0,    `rgba(${r},${g},${b},${coreOpacity.toFixed(2)})`);
  grad.addColorStop(0.3,  `rgba(${r},${g},${b},${(coreOpacity * 0.45).toFixed(2)})`);
  grad.addColorStop(0.65, `rgba(${r},${g},${b},${(coreOpacity * 0.12).toFixed(2)})`);
  grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false,
    toneMapped: false, fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), mat);
  mesh.renderOrder = 999;
  return mesh;
}

// ── Floor light-spill plane (orange gradient puddle under wall neon) ──────────
function makeFloorSpill(length: number, width: number, color: THREE.Color): THREE.Mesh {
  const W = 128, H = 32;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.18)`);
  grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false,
    toneMapped: false, fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 998;
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────

const SPOT_DEFS: [number, number][] = [
  [-22,  0], [-8, -8], [6, -8], [22, 0], [0, 10],
];

// ─────────────────────────────────────────────────────────────────────────────

export function buildFloor(scene: THREE.Scene): FloorControls {

  // ── Lighting ──────────────────────────────────────────────────────────────
  // Raised ambient so dark metal reads as ~#1a1a1a not #000.
  const ambient = new THREE.AmbientLight(0x2d1a06, 2.8);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x2a1504, 0x060402, 1.1);
  hemi.position.set(0, HALL_H, 0);
  scene.add(hemi);

  // Reduced-intensity spotlights (so they don't dominate the warm-metal feel)
  for (const [sx, sz] of SPOT_DEFS) {
    const spot = new THREE.SpotLight(0xffe8c0, 3.5, 22, Math.PI / 6, 0.5, 1.4);
    spot.position.set(sx, HALL_H - 0.25, sz);
    spot.target.position.set(sx, 0, sz);
    scene.add(spot);
    scene.add(spot.target);
  }

  // Warm amber PointLights at table height
  const AMBER_DEFS: [number, number, number, number][] = [
    [-22, 0.9, 0, 2.0], [-8, 0.9, -8, 2.0], [6, 0.9, -8, 2.0], [22, 0.9, 0, 2.0], [0, 0.9, 10, 1.6],
  ];
  for (const [ax, ay, az, ai] of AMBER_DEFS) {
    const pl = new THREE.PointLight(DEEP_AMB, ai, 16, 1.6);
    pl.position.set(ax, ay, az);
    scene.add(pl);
  }

  // ── Wall-base neon PointLights (physical glow effect) ────────────────────
  const NEON_PL = NEON_ORG;
  for (const wz of [-(HALL_D / 2 - 0.2), (HALL_D / 2 - 0.2)]) {
    for (const px of [-26, -13, 0, 13, 26]) {
      const pl = new THREE.PointLight(NEON_PL, 3.5, 8.0, 2.0);
      pl.position.set(px, 0.18, wz);
      scene.add(pl);
    }
  }
  for (const wx of [-(HALL_W / 2 - 0.2), (HALL_W / 2 - 0.2)]) {
    for (const pz of [-14, 0, 14]) {
      const pl = new THREE.PointLight(NEON_PL, 3.5, 8.0, 2.0);
      pl.position.set(wx, 0.18, pz);
      scene.add(pl);
    }
  }

  // ── Textures ───────────────────────────────────────────────────────────────
  const procFloorTex = makeFloorPlateTex();
  procFloorTex.repeat.set(HALL_W / 3, HALL_D / 3);

  // ── Shared materials ───────────────────────────────────────────────────────
  // Wall material: MeshBasicMaterial + fog:false = texture always at full contrast.
  // SRGBColorSpace + LinearToneMapping = canvas pixel IS the output pixel.
  const makeWallMat = (repX: number, repY: number) => {
    const t = makeHullPanelTex();
    t.repeat.set(repX, repY);
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false, fog: false });
  };

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: procFloorTex,
    roughness: 0.88, metalness: 0.25,
    emissive: new THREE.Color(0x120e08), emissiveIntensity: 1.2, toneMapped: false,
  });

  const ceilMat = new THREE.MeshStandardMaterial({
    color: CEIL_COLOR, roughness: 0.90,
    emissive: new THREE.Color(0x131210), emissiveIntensity: 1.0, toneMapped: false,
  });

  const seamDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0f0e0d, roughness: 0.85, metalness: 0.72,
    emissive: new THREE.Color(0x080706), emissiveIntensity: 0.2,
  });

  const neonMat = new THREE.MeshStandardMaterial({
    color: NEON_ORG, emissive: new THREE.Color(NEON_ORG),
    emissiveIntensity: 4.5, roughness: 0.2, metalness: 0.0, toneMapped: false,
  });

  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x0d0c0b, roughness: 0.82,
    emissive: new THREE.Color(0x0a0908), emissiveIntensity: 0.2,
  });

  const ductMat = new THREE.MeshStandardMaterial({
    color: 0x1c1b1a, roughness: 0.78, metalness: 0.65,
    emissive: new THREE.Color(0x161514), emissiveIntensity: 0.25,
  });

  const hazTex = makeHazardTex();
  const hazMat = new THREE.MeshStandardMaterial({
    map: hazTex, roughness: 0.82, metalness: 0.15, transparent: true, opacity: 0.88,
  });
  hazMat.map!.repeat.set(8, 1);

  const volConeMat = new THREE.MeshBasicMaterial({
    color: 0xffd0a0, transparent: true, opacity: 0.04,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD, emissive: new THREE.Color(GOLD),
    emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.7,
  });

  const rivetMat = new THREE.MeshStandardMaterial({
    color: 0x3a3830, roughness: 0.55, metalness: 0.85,
    emissive: new THREE.Color(0x1a1710), emissiveIntensity: 0.2,
  });

  // ── Floor ──────────────────────────────────────────────────────────────────
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  // Try loading the real floor texture
  new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}casino/textures/floor_plate.jpg`,
    (loaded) => {
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      loaded.repeat.set(HALL_W / 3, HALL_D / 3);
      floorMesh.material = new THREE.MeshStandardMaterial({
        map: loaded, color: 0xffffff, roughness: 0.88, metalness: 0.25,
        emissive: new THREE.Color(0x120e08), emissiveIntensity: 1.2, toneMapped: false,
      });
    },
  );

  // ── Walls ──────────────────────────────────────────────────────────────────
  // 3 tiles × 2-panel grid = 6 panels across 66m back wall (~11m per panel)
  const wallMatBF = makeWallMat(3, 1);  // back/front walls
  const wallMatLR = makeWallMat(2, 1);  // left/right walls
  const wallDefs: [number, number, number, number, number, number][] = [
    [   0, HALL_H/2, -(HALL_D/2), HALL_W, HALL_H, 0.3],
    [   0, HALL_H/2,  (HALL_D/2), HALL_W, HALL_H, 0.3],
    [-(HALL_W/2), HALL_H/2, 0, 0.3, HALL_H, HALL_D],
    [ (HALL_W/2), HALL_H/2, 0, 0.3, HALL_H, HALL_D],
  ];
  const wallMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < wallDefs.length; i++) {
    const [x, y, z, w, h, d] = wallDefs[i];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i < 2 ? wallMatBF : wallMatLR);
    m.position.set(x, y, z);
    scene.add(m);
    wallMeshes.push(m);
  }
  // Optionally swap to real wall texture
  new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}casino/textures/wall_panel.jpg`,
    (loaded) => {
      for (let i = 0; i < wallMeshes.length; i++) {
        const isLR = i >= 2;
        const clone = loaded.clone();
        clone.wrapS = THREE.RepeatWrapping;
        clone.wrapT = THREE.RepeatWrapping;
        clone.repeat.set(isLR ? 2 : 3, 1);
        clone.needsUpdate = true;
        (wallMeshes[i].material as THREE.MeshBasicMaterial).map = clone;
        (wallMeshes[i].material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
    },
  );

  // ── Wall panel seams (vertical dark strips) ────────────────────────────────
  for (const wz of [-(HALL_D/2 - 0.19), (HALL_D/2 - 0.19)]) {
    for (const sx of [-22, -11, 0, 11, 22]) {
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.06, HALL_H, 0.06), seamDarkMat);
      sm.position.set(sx, HALL_H/2, wz);
      scene.add(sm);
    }
    const hSeam = new THREE.Mesh(new THREE.BoxGeometry(HALL_W - 0.4, 0.06, 0.06), seamDarkMat);
    hSeam.position.set(0, 2.2, wz); scene.add(hSeam);
  }
  for (const wx of [-(HALL_W/2 - 0.19), (HALL_W/2 - 0.19)]) {
    for (const sz of [-12, 0, 12]) {
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.06, HALL_H, 0.06), seamDarkMat);
      sm.position.set(wx, HALL_H/2, sz); scene.add(sm);
    }
    const hSeam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, HALL_D - 0.4), seamDarkMat);
    hSeam.position.set(wx, 2.2, 0); scene.add(hSeam);
  }

  // ── Rivet dots ────────────────────────────────────────────────────────────
  const rivetGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  for (const wz of [-(HALL_D/2 - 0.16), (HALL_D/2 - 0.16)]) {
    for (const sx of [-22, -11, 0, 11, 22]) {
      for (const ry of [0.12, 2.2, HALL_H - 0.12]) {
        const rv = new THREE.Mesh(rivetGeo, rivetMat);
        rv.position.set(sx, ry, wz); scene.add(rv);
      }
    }
  }

  // ── Ceiling ────────────────────────────────────────────────────────────────
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_D), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = HALL_H;
  scene.add(ceil);

  for (const bx of [-20, -10, 0, 10, 20]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, HALL_D), beamMat);
    b.position.set(bx, HALL_H - 0.15, 0); scene.add(b);
  }

  const ductRuns: [number, number, number, number, number, number][] = [
    [0, HALL_H - 0.52, -6, HALL_W - 2, 0.28, 0.35],
    [-14, HALL_H - 0.52, 0, HALL_W - 2, 0.22, 0.28],
    [14,  HALL_H - 0.52, 0, HALL_W - 2, 0.22, 0.28],
  ];
  for (const [dx, dy, dz, dw, dh, dd] of ductRuns) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), ductMat);
    d.position.set(dx, dy, dz); scene.add(d);
  }
  for (const bx of [-20, 0, 20]) {
    const el = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), ductMat);
    el.position.set(bx, HALL_H - 0.52, -6); scene.add(el);
  }

  // ── Volumetric light cones ────────────────────────────────────────────────
  const coneGeo = new THREE.ConeGeometry(3.2, HALL_H - 0.4, 10, 1, true);
  for (const [cx, cz] of SPOT_DEFS) {
    const cone = new THREE.Mesh(coneGeo, volConeMat);
    cone.position.set(cx, HALL_H / 2, cz); scene.add(cone);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Neon strips: thick geometry + glow planes + floor spill ──────────────
  // ─────────────────────────────────────────────────────────────────────────
  const NEON_COLOR = new THREE.Color(NEON_ORG);
  const NEON_H = 0.14; // strip height (2.3× original)

  // Floor-wall seam strips
  const floorSeams: [number, number, number, number, number, number, boolean][] = [
    [   0, 0.07, -(HALL_D/2 - 0.05), HALL_W - 0.4, NEON_H, 0.14, false],
    [   0, 0.07,  (HALL_D/2 - 0.05), HALL_W - 0.4, NEON_H, 0.14, false],
    [-(HALL_W/2 - 0.05), 0.07, 0, 0.14, NEON_H, HALL_D - 0.4, true],
    [ (HALL_W/2 - 0.05), 0.07, 0, 0.14, NEON_H, HALL_D - 0.4, true],
  ];
  for (const [x, y, z, w, h, d, vert] of floorSeams) {
    const sm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    sm.position.set(x, y, z); scene.add(sm);

    // Glow plane — face inward, additive blend
    const glowW = vert ? HALL_D - 1 : HALL_W - 1;
    const gp = makeGlowPlane(NEON_COLOR, glowW, 5.0, 0.80);
    if (!vert) {
      gp.rotation.y = z < 0 ? 0 : Math.PI;
      gp.position.set(x, y + 2.0, z + (z < 0 ? 0.5 : -0.5));
    } else {
      gp.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      gp.position.set(x + (x < 0 ? 0.5 : -0.5), y + 2.0, z);
    }
    scene.add(gp);

    // Floor light-spill
    const spillLen = vert ? HALL_D - 1 : HALL_W - 1;
    const spill = makeFloorSpill(spillLen, 5.0, NEON_COLOR);
    if (vert) {
      spill.rotation.z = Math.PI / 2;
      spill.position.set(x + (x < 0 ? 2.5 : -2.5), 0.02, z);
    } else {
      spill.position.set(x, 0.02, z + (z < 0 ? 2.5 : -2.5));
    }
    scene.add(spill);
  }

  // Mid-wall horizontal neon strips
  const midStrips: [number, number, number, number, number, number, boolean][] = [
    [   0, 1.62, -(HALL_D/2 - 0.17), HALL_W - 0.5, NEON_H, 0.10, false],
    [   0, 1.62,  (HALL_D/2 - 0.17), HALL_W - 0.5, NEON_H, 0.10, false],
    [-(HALL_W/2 - 0.17), 1.62, 0, 0.10, NEON_H, HALL_D - 0.5, true],
    [ (HALL_W/2 - 0.17), 1.62, 0, 0.10, NEON_H, HALL_D - 0.5, true],
  ];
  for (const [x, y, z, w, h, d, vert] of midStrips) {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    ms.position.set(x, y, z); scene.add(ms);

    const glowW = vert ? HALL_D - 1 : HALL_W - 1;
    const gp = makeGlowPlane(NEON_COLOR, glowW, 7.0, 0.70);
    if (!vert) {
      gp.rotation.y = z < 0 ? 0 : Math.PI;
      gp.position.set(x, y, z + (z < 0 ? 0.5 : -0.5));
    } else {
      gp.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      gp.position.set(x + (x < 0 ? 0.5 : -0.5), y, z);
    }
    scene.add(gp);
  }

  // Ceiling perimeter neon strips
  const ceilStrips: [number, number, number, number, number, number, boolean][] = [
    [   0, HALL_H - 0.18, -(HALL_D/2 - 0.17), HALL_W - 0.5, NEON_H, 0.10, false],
    [   0, HALL_H - 0.18,  (HALL_D/2 - 0.17), HALL_W - 0.5, NEON_H, 0.10, false],
    [-(HALL_W/2 - 0.17), HALL_H - 0.18, 0, 0.10, NEON_H, HALL_D - 0.5, true],
    [ (HALL_W/2 - 0.17), HALL_H - 0.18, 0, 0.10, NEON_H, HALL_D - 0.5, true],
  ];
  for (const [x, y, z, w, h, d, vert] of ceilStrips) {
    const cs = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
    cs.position.set(x, y, z); scene.add(cs);

    const glowW = vert ? HALL_D - 1 : HALL_W - 1;
    const gp = makeGlowPlane(NEON_COLOR, glowW, 7.0, 0.65);
    if (!vert) {
      gp.rotation.y = z < 0 ? 0 : Math.PI;
      gp.position.set(x, y - 2.0, z + (z < 0 ? 0.5 : -0.5));
    } else {
      gp.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      gp.position.set(x + (x < 0 ? 0.5 : -0.5), y - 2.0, z);
    }
    scene.add(gp);
  }

  // ── Hazard-chevron decals ──────────────────────────────────────────────────
  const hazDecals: [number, number, boolean][] = [
    [-22, -4.0, false], [-14, -5.0, false], [-4, -7.0, false],
    [6, -7.0, false], [18, -3.5, false], [22, 3.5, true],
    [-20, 3.5, true], [0, 3.5, false],
  ];
  for (const [hx, hz, perp] of hazDecals) {
    const geo = perp ? new THREE.PlaneGeometry(0.28, 7.0) : new THREE.PlaneGeometry(7.0, 0.28);
    const m = new THREE.Mesh(geo, hazMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(hx, 0.015, hz); scene.add(m);
  }

  // ── Entrance threshold strips ──────────────────────────────────────────────
  const threshMat = new THREE.MeshStandardMaterial({
    color: NEON_ORG, emissive: new THREE.Color(NEON_ORG),
    emissiveIntensity: 3.0, roughness: 0.3, toneMapped: false,
  });
  const thresh1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.10, 0.22), threshMat);
  thresh1.position.set(0, 0.05, 13.5); scene.add(thresh1);
  const thresh2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 0.12), threshMat);
  thresh2.position.set(0, 0.025, 14.5); scene.add(thresh2);
  // Entrance glow plane
  const thrGP = makeGlowPlane(NEON_COLOR, 22, 2.5, 0.60);
  thrGP.rotation.x = -Math.PI / 2;
  thrGP.position.set(0, 0.3, 13.5); scene.add(thrGP);

  // ── Gold wall trims ────────────────────────────────────────────────────────
  for (const tz of [-(HALL_D/2 - 0.18), (HALL_D/2 - 0.18)]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.12), goldMat);
    trim.position.set(0, 2.4, tz); scene.add(trim);
  }

  // ── Per-zone accent floor strips ──────────────────────────────────────────
  for (const zt of ZONE_TRIM) {
    if (zt.w === 0) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: zt.color, emissive: new THREE.Color(zt.color),
      emissiveIntensity: 1.2, roughness: 0.35, toneMapped: false,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(zt.w, 0.06, 0.14), mat);
    strip.position.set(zt.x, 0.03, zt.z + 3.2); scene.add(strip);
  }
  {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0b840, emissive: new THREE.Color(0xe0b840),
      emissiveIntensity: 1.2, roughness: 0.35, toneMapped: false,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 8), mat);
    strip.position.set(21.5, 0.03, 0); scene.add(strip);
  }

  // ── Klaxon flash controller ────────────────────────────────────────────────
  let klaxonTime = 0;
  return {
    triggerKlaxon() { klaxonTime = 2.0; },
    tick(dt: number) {
      if (klaxonTime <= 0) return;
      klaxonTime -= dt;
      if (klaxonTime <= 0) {
        neonMat.color.setHex(NEON_ORG); neonMat.emissive.setHex(NEON_ORG); neonMat.emissiveIntensity = 4.5;
        return;
      }
      const gold = Math.sin(klaxonTime * 12) > 0;
      neonMat.color.setHex(gold ? GOLD : NEON_ORG);
      neonMat.emissive.setHex(gold ? GOLD : NEON_ORG);
      neonMat.emissiveIntensity = gold ? 6.0 : 4.5;
    },
  };
}
