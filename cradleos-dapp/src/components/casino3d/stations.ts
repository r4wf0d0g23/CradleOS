/**
 * stations.ts — Full casino floor: archetypes + auto-layout from CASINO_CATALOG.
 *
 * Archetypes (primitives only, ≤~600 tris each):
 *   cardTable   — blackjack, hilo, baccarat, three_card_poker, war, video_poker
 *   wheelPlinth — roulette, wheel  (spinning disc tick)
 *   cabinet     — slots, keno, coinflip  (upright box w/ emissive screen)
 *   gridPit     — mines, diamonds, double_dice, sicbo, dice  (low table w/ grid inlay)
 *   tower       — plinko, dragon_tower  (tall board w/ pegs/ledges)
 *   crashPad    — crash, limbo  (angled rail w/ emissive trail)
 *
 * buildStations(scene, catalog) → { stations, zones }
 *   Groups catalog entries by category, places them in zones around the hall.
 */

import * as THREE from "three";
import type { GameEntry } from "../../lib/casinoCatalog";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface Station {
  key: string;
  name: string;
  position: THREE.Vector3;
  radius: number;
  group: THREE.Group;
  label: THREE.Sprite;         // world-sized name label (distance-revealed by Casino3D)
  tick?: (dt: number) => void;
  setNear?: (near: boolean) => void;
  triggerPulse?: () => void;   // 3-second activity surge (feed-driven)
}

export interface ZoneInfo {
  category: string;
  label: string;
  center: THREE.Vector3;
  accent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype map  (key → which archetype mesh to use)
// ─────────────────────────────────────────────────────────────────────────────

type ArchetypeName = "cardTable" | "wheelPlinth" | "cabinet" | "gridPit" | "tower" | "crashPad";

const ARCHETYPE_BY_KEY: Record<string, ArchetypeName> = {
  blackjack:       "cardTable",
  hilo:            "cardTable",
  baccarat:        "cardTable",
  three_card_poker:"cardTable",
  war:             "cardTable",
  video_poker:     "cardTable",
  roulette:        "wheelPlinth",
  wheel:           "wheelPlinth",
  slots:           "cabinet",
  keno:            "cabinet",
  coinflip:        "cabinet",
  mines:           "gridPit",
  diamonds:        "gridPit",
  double_dice:     "gridPit",
  sicbo:           "gridPit",
  dice:            "gridPit",
  plinko:          "tower",
  dragon_tower:    "tower",
  crash:           "crashPad",
  limbo:           "crashPad",
};

// ─────────────────────────────────────────────────────────────────────────────
// Zone configuration  (category → center, label, accent color)
// Hall size: 64×36m  (ROOM_BOUNDS: minX:-32, maxX:32, minZ:-18, maxZ:18)
// Entrance at (0,1.7,14).  Zones avoid the front approach corridor.
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_CONFIG: Record<string, { cx: number; cz: number; label: string; accent: number }> = {
  cards:   { cx: -22, cz:   0, label: "CARDS",   accent: 0xe8c060 },
  dice:    { cx: -14, cz: -10, label: "DICE",     accent: 0xff6020 },
  wheels:  { cx:  -4, cz: -12, label: "WHEELS",   accent: 0xff4700 },
  grid:    { cx:   6, cz: -12, label: "GRID",     accent: 0xffa030 },
  crash:   { cx:  18, cz:  -8, label: "CRASH",    accent: 0xff2010 },
  drop:    { cx:  24, cz:   0, label: "DROP",     accent: 0xe0b840 },
  slots:   { cx:  20, cz:   8, label: "SLOTS",    accent: 0xd09040 },
  duels:   { cx: -20, cz:   8, label: "DUELS",    accent: 0xc07830 },
  lottery: { cx:   0, cz:   8, label: "LOTTERY",  accent: 0xb8c040 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Grid positions for N stations in a zone, spacing S metres. */
function zonePositions(count: number, cx: number, cz: number, S = 5): [number, number][] {
  const cols = count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (out.length >= count) break;
      out.push([
        cx + (c - (cols - 1) / 2) * S,
        cz + (r - (rows - 1) / 2) * S,
      ]);
    }
  }
  return out;
}

/** Floating name sprite — monospace canvas, NO emoji.
 *  sizeAttenuation=true → world-sized label that shrinks with distance.
 *  World width ~1.3 m; height proportional to canvas aspect (320/64 = 5).
 *  transparency + depthWrite=false prevents z-fighting during proximity fades.
 */
function makeLabel(text: string): THREE.Sprite {
  const W = 320; const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(10,10,18,0.86)";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#ff4700";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#f2f2f2";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), W / 2, H / 2);
  const tex = new THREE.CanvasTexture(canvas);
  // sizeAttenuation=true: world-space sprite — perspective-correct, smaller at distance.
  // scale = (worldWidth, worldHeight, 1); aspect = W/H = 5.
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.3, 1.3 * (H / W), 1); // ~1.3 m wide × 0.26 m tall in world space
  return sprite;
}

/** Zone label sprite — larger canvas, ~2 m wide world-space.
 *  Always visible (opacity managed externally if needed).
 */
function makeZoneLabel(text: string, accent: number): THREE.Sprite {
  const W = 400; const H = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const r = (accent >> 16) & 0xff;
  const g = (accent >> 8) & 0xff;
  const b = accent & 0xff;
  ctx.fillStyle = `rgba(${r >> 1},${g >> 1},${b >> 1},0.72)`;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
  ctx.font = "bold 30px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), W / 2, H / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 2.0 * (H / W), 1); // ~2 m wide × 0.4 m tall
  return sprite;
}

/** Signage plane: tries to load webp; on error draws glyph on dark plate. */
function makeSignage(key: string, glyph: string): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1.6, 1.2);

  // Glyph fallback canvas
  const fc = document.createElement("canvas");
  fc.width = 160; fc.height = 120;
  const fctx = fc.getContext("2d")!;
  fctx.fillStyle = "#1c1c2e";
  fctx.fillRect(0, 0, 160, 120);
  fctx.fillStyle = "#ffcf5a";
  fctx.font = "bold 52px monospace";
  fctx.textAlign = "center";
  fctx.textBaseline = "middle";
  fctx.fillText(glyph, 80, 60);
  const fallbackTex = new THREE.CanvasTexture(fc);
  // Unlit material — signage/art renders at full texture brightness regardless of scene
  // lighting (Raw feedback 2026-07-11: floating signage images too dark in webview).
  const fallbackMat = new THREE.MeshBasicMaterial({ map: fallbackTex, toneMapped: false });
  const mesh = new THREE.Mesh(geo, fallbackMat);

  new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}casino/cards/${key}.webp`,
    (tex) => {
      mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      fallbackTex.dispose();
    },
    undefined,
    () => { /* keep glyph fallback */ },
  );
  return mesh;
}

/** Flat base ring that pulses when nearest station.
 *  Also supports a 3-second activity surge (feed-driven via triggerPulse).
 */
function makeBaseRing(accent: number): {
  mesh: THREE.Mesh;
  tick: (dt: number) => void;
  setNear: (near: boolean) => void;
  triggerPulse: () => void;
} {
  const geo = new THREE.RingGeometry(1.05, 1.25, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.11,
    roughness: 0.4,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;

  let near = false;
  let phase = 0;
  let pulseTime = 0;   // counts down from 3.0 s
  const setNear = (n: boolean) => { near = n; };
  const triggerPulse = () => { pulseTime = 3.0; };
  const tick = (dt: number) => {
    phase += dt * (near ? 3.2 : 0.6);
    if (pulseTime > 0) {
      pulseTime -= dt;
      mat.emissiveIntensity = 1.3 + 0.5 * Math.sin(pulseTime * 9);
      mat.opacity = 0.98;
      return;
    }
    mat.emissiveIntensity = near
      ? 0.72 + 0.4 * Math.sin(phase)
      : 0.08 + 0.08 * Math.sin(phase * 0.7);
    mat.opacity = near ? 0.92 : 0.45;
  };
  return { mesh, tick, setNear, triggerPulse };
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype builders
// ─────────────────────────────────────────────────────────────────────────────

function buildCardTable(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Table body
  const bodyGeo = new THREE.BoxGeometry(2.2, 0.9, 1.2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.45;
  group.add(body);

  // Felt top — brighter green for readability from distance
  const feltGeo = new THREE.PlaneGeometry(2.0, 1.0);
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x163a16, roughness: 0.95 });
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = 0.91;
  group.add(felt);

  // Orange felt inlay line — thin emissive strip across felt centre
  const inlayMat = new THREE.MeshStandardMaterial({
    color: 0xff6820, emissive: new THREE.Color(0xff6820), emissiveIntensity: 0.5, roughness: 0.35,
  });
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.018, 0.055), inlayMat);
  inlay.position.set(0, 0.912, 0);
  group.add(inlay);

  // Gold rim (4 edges)
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe8b84b, emissive: new THREE.Color(0xe8b84b), emissiveIntensity: 0.12,
    metalness: 0.7, roughness: 0.3,
  });
  const rims: [number, number, number, number, number, number][] = [
    [0, 0.91, -0.6, 2.2, 0.04, 0.04],
    [0, 0.91,  0.6, 2.2, 0.04, 0.04],
    [-1.1, 0.91, 0, 0.04, 0.04, 1.2],
    [ 1.1, 0.91, 0, 0.04, 0.04, 1.2],
  ];
  for (const [x, y, z, w, h, d] of rims) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rimMat);
    m.position.set(x, y, z);
    group.add(m);
  }

  // Accent strip along base
  const stripMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.3, roughness: 0.4,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.06, 1.24), stripMat);
  strip.position.y = 0.03;
  group.add(strip);

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 2.4, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 3.1, -0.65);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => ring.tick(dt),
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildWheelPlinth(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Plinth
  const plinthGeo = new THREE.CylinderGeometry(0.9, 1.0, 1.0, 16);
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.5;
  group.add(plinth);

  // Wheel disc
  const wheelGeo = new THREE.CylinderGeometry(0.83, 0.83, 0.06, 24);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.5 });
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.position.y = 1.04;
  group.add(wheel);

  // Emissive ring on disc
  const discRingGeo = new THREE.TorusGeometry(0.76, 0.055, 6, 24);
  const discRingMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.7, roughness: 0.3,
  });
  const discRing = new THREE.Mesh(discRingGeo, discRingMat);
  discRing.rotation.x = Math.PI / 2;
  discRing.position.y = 1.08;
  group.add(discRing);
  // Pocket ring — second outer ring that slow-pulses for richness
  const pocketGeo = new THREE.TorusGeometry(0.68, 0.03, 4, 20);
  const pocketMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.3, roughness: 0.4,
  });
  const pocket = new THREE.Mesh(pocketGeo, pocketMat);
  pocket.rotation.x = Math.PI / 2;
  pocket.position.y = 1.07;
  group.add(pocket);

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 2.4, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 3.2, -1.05);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  let rot = 0;
  let colorPhase = 0;
  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => {
      rot += dt * 0.45;
      wheel.rotation.y = rot;
      discRing.rotation.z = rot * 0.5;
      // Slow pocket-ring colour pulse between 0.3 and 0.85
      colorPhase += dt * 0.35;
      pocketMat.emissiveIntensity = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(colorPhase));
      ring.tick(dt);
    },
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildCabinet(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Cabinet body
  const cabinetGeo = new THREE.BoxGeometry(1.1, 2.4, 0.55);
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.85 });
  const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
  cabinet.position.y = 1.2;
  group.add(cabinet);

  // Emissive screen panel (front face inset) — brighter base for cabinet readability
  const screenGeo = new THREE.PlaneGeometry(0.8, 0.7);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x060615,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.68,
    roughness: 0.3,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.55, 0.29);
  group.add(screen);

  // Screen border
  const borderMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.25, roughness: 0.4,
  });
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.04), borderMat);
  hb.position.set(0, 1.93, 0.29); group.add(hb);
  const hb2 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.04), borderMat);
  hb2.position.set(0, 1.17, 0.29); group.add(hb2);
  const vb1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.04), borderMat);
  vb1.position.set(-0.42, 1.55, 0.29); group.add(vb1);
  const vb2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.04), borderMat);
  vb2.position.set( 0.42, 1.55, 0.29); group.add(vb2);

  // Top accent bar
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.58), borderMat);
  topBar.position.set(0, 2.44, 0);
  group.add(topBar);

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 2.8, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 3.8, -0.32);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  let phase = 0;
  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => {
      phase += dt * 1.2;
      // Richer flicker: primary wave + faster harmonic
      screenMat.emissiveIntensity = 0.58 + 0.18 * Math.sin(phase) + 0.07 * Math.sin(phase * 3.7);
      ring.tick(dt);
    },
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildGridPit(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Low table
  const tableGeo = new THREE.BoxGeometry(2.4, 0.7, 1.8);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.85 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = 0.35;
  group.add(table);

  // Grid inlay (top face)
  const gridTopGeo = new THREE.PlaneGeometry(2.2, 1.6);
  const gridTopMat = new THREE.MeshStandardMaterial({ color: 0x090912, roughness: 0.9 });
  const gridTop = new THREE.Mesh(gridTopGeo, gridTopMat);
  gridTop.rotation.x = -Math.PI / 2;
  gridTop.position.y = 0.71;
  group.add(gridTop);

  // Grid lines — brighter glow for pit readability from across the hall
  const gridLineMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.58, roughness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const hLine = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.025), gridLineMat);
    hLine.position.set(0, 0.72, -0.6 + i * 0.4);
    group.add(hLine);
  }
  for (let i = 0; i < 5; i++) {
    const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 1.6), gridLineMat);
    vLine.position.set(-1.1 + i * 0.55, 0.72, 0);
    group.add(vLine);
  }

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 2.4, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 3.0, -0.95);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => ring.tick(dt),
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildTower(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Board back-panel
  const boardGeo = new THREE.BoxGeometry(1.3, 3.2, 0.3);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x0d0d18, roughness: 0.85 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 1.6;
  group.add(board);

  // Side supports
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.8 });
  const lSupport = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), supportMat);
  lSupport.position.set(-0.71, 1.7, 0); group.add(lSupport);
  const rSupport = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), supportMat);
  rSupport.position.set( 0.71, 1.7, 0); group.add(rSupport);

  // Peg rows (4 rows × 4 pegs = 16 pegs, ~16 × 12t = 192t)
  const pegMat = new THREE.MeshStandardMaterial({
    color: 0xe8b84b, metalness: 0.7, roughness: 0.3,
  });
  for (let row = 0; row < 4; row++) {
    const offset = (row % 2 === 0) ? 0 : 0.14;
    for (let col = 0; col < 4; col++) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), pegMat);
      pg.position.set(-0.42 + col * 0.28 + offset, 2.9 - row * 0.44, 0.15);
      group.add(pg);
    }
  }

  // Ledge bars (3 horizontal bars) — brighter edge lights
  const ledgeMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.55, roughness: 0.4,
  });
  for (let i = 0; i < 3; i++) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.22), ledgeMat);
    ledge.position.set(0, 1.0 + i * 0.8, 0.12);
    group.add(ledge);
    // Thin front-edge light strip on each ledge
    const edgeMat = new THREE.MeshStandardMaterial({
      color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.85, roughness: 0.3,
    });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.04, 0.03), edgeMat);
    edge.position.set(0, 1.0 + i * 0.8 + 0.02, 0.235);
    group.add(edge);
  }

  // Emissive bottom catch
  const catchMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.8, roughness: 0.3,
  });
  const catchMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.3), catchMat);
  catchMesh.position.set(0, 0.5, 0.12);
  group.add(catchMesh);

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 3.8, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 4.6, -0.2);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => ring.tick(dt),
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildCrashPad(
  key: string, name: string, glyph: string,
  pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const group = new THREE.Group();
  const ring = makeBaseRing(accent);
  group.add(ring.mesh);

  // Angled launch rail (inclined box)
  const railGeo = new THREE.BoxGeometry(0.3, 2.4, 0.25);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 0.8 });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.rotation.z = 0.38; // ~22° incline
  rail.position.set(0, 1.2, 0);
  group.add(rail);

  // Rail frame sides
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x181828, roughness: 0.75 });
  const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), frameMat);
  lFrame.rotation.z = 0.38;
  lFrame.position.set(-0.55, 1.25, 0); group.add(lFrame);
  const rFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), frameMat);
  rFrame.rotation.z = 0.38;
  rFrame.position.set( 0.55, 1.25, 0); group.add(rFrame);

  // Emissive trail strip along rail
  const trailMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.9,
    roughness: 0.3, transparent: true, opacity: 0.85,
  });
  const trail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.1), trailMat);
  trail.rotation.z = 0.38;
  trail.position.set(0, 1.1, 0.14);
  group.add(trail);

  // Launch platform base
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0e0e1c, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.9), baseMat);
  base.position.set(0, 0.08, 0);
  group.add(base);

  // Accent base stripe
  const basestripMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(accent), emissiveIntensity: 0.35, roughness: 0.4,
  });
  const baseStrip = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.04, 0.04), basestripMat);
  baseStrip.position.set(0, 0.16, 0.47);
  group.add(baseStrip);

  const label = makeLabel(glyph + " " + name);
  label.position.set(0, 2.8, 0);
  group.add(label);

  const sign = makeSignage(key, glyph);
  sign.position.set(0, 3.8, -0.15);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  let phase = 0;
  return {
    key, name, position: pos, radius: 2.2, group, label,
    tick: (dt) => {
      phase += dt * 1.8;
      // Brighter trail with sharper flicker for crash-pad drama
      trailMat.emissiveIntensity = 0.82 + 0.38 * Math.abs(Math.sin(phase));
      ring.tick(dt);
    },
    setNear: ring.setNear,
    triggerPulse: ring.triggerPulse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype dispatch
// ─────────────────────────────────────────────────────────────────────────────

function buildStation(
  entry: GameEntry, pos: THREE.Vector3, scene: THREE.Scene, accent: number,
): Station {
  const archetype: ArchetypeName = ARCHETYPE_BY_KEY[entry.key] ?? "cardTable";
  const p = pos.clone();
  switch (archetype) {
    case "cardTable":   return buildCardTable  (entry.key, entry.name, entry.glyph, p, scene, accent);
    case "wheelPlinth": return buildWheelPlinth(entry.key, entry.name, entry.glyph, p, scene, accent);
    case "cabinet":     return buildCabinet    (entry.key, entry.name, entry.glyph, p, scene, accent);
    case "gridPit":     return buildGridPit    (entry.key, entry.name, entry.glyph, p, scene, accent);
    case "tower":       return buildTower      (entry.key, entry.name, entry.glyph, p, scene, accent);
    case "crashPad":    return buildCrashPad   (entry.key, entry.name, entry.glyph, p, scene, accent);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildStations(
  scene: THREE.Scene,
  catalog: GameEntry[],
): { stations: Station[]; zones: ZoneInfo[] } {
  const live = catalog.filter((g) => g.status === "live");

  // Group by category
  const byCategory = new Map<string, GameEntry[]>();
  for (const g of live) {
    const arr = byCategory.get(g.category) ?? [];
    arr.push(g);
    byCategory.set(g.category, arr);
  }

  const stations: Station[] = [];
  const zones: ZoneInfo[] = [];

  for (const [cat, entries] of byCategory) {
    const cfg = ZONE_CONFIG[cat];
    if (!cfg) continue; // eve-native etc — skip unknown zones

    zones.push({
      category: cat,
      label: cfg.label,
      center: new THREE.Vector3(cfg.cx, 0, cfg.cz),
      accent: cfg.accent,
    });

    // Zone label sprite — world-sized, ~2 m wide, placed above zone center
    const zoneLbl = makeZoneLabel(cfg.label, cfg.accent);
    zoneLbl.position.set(cfg.cx, 3.8, cfg.cz);
    scene.add(zoneLbl);

    const positions = zonePositions(entries.length, cfg.cx, cfg.cz, 5);
    for (let i = 0; i < entries.length; i++) {
      const [x, z] = positions[i];
      const pos = new THREE.Vector3(x, 0, z);
      stations.push(buildStation(entries[i], pos, scene, cfg.accent));
    }
  }

  return { stations, zones };
}
