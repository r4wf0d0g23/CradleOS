import * as THREE from "three";

export const ROOM_BOUNDS = { minX: -19, maxX: 19, minZ: -11, maxZ: 11 };

const FLOOR_COLOR   = 0x0a0a12;
const WALL_COLOR    = 0x111118;
const CEIL_COLOR    = 0x0d0d14;
const ACCENT_ORG    = 0xff4700;
const GOLD          = 0xe8b84b;

export function buildFloor(scene: THREE.Scene): void {
  // ── Ambient + point lights ──
  const ambient = new THREE.AmbientLight(0x202030, 1.2);
  scene.add(ambient);

  const pts: [number, number, number, number][] = [
    [-10, 2.5, 0, 1.8],
    [10, 2.5, 0, 1.8],
    [0, 2.5, -8, 1.6],
  ];
  for (const [x, y, z, intensity] of pts) {
    const pl = new THREE.PointLight(0xffa040, intensity, 28, 1.4);
    pl.position.set(x, y, z);
    scene.add(pl);
  }

  // ── Floor ──
  const floorGeo = new THREE.PlaneGeometry(40, 24);
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR, roughness: 0.9, metalness: 0.3,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ── Walls ──
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 });
  const walls: [number, number, number, number, number, number, number][] = [
    // x, y, z, width, height, depth, rotY
    [0,  2, -12, 40, 4, 0.3, 0],    // back
    [0,  2,  12, 40, 4, 0.3, 0],    // front
    [-20, 2,  0, 0.3, 4, 24, 0],    // left
    [ 20, 2,  0, 0.3, 4, 24, 0],    // right
  ];
  for (const [x, y, z, w, h, d] of walls) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  }

  // ── Ceiling ──
  const ceilGeo = new THREE.PlaneGeometry(40, 24);
  const ceilMat = new THREE.MeshStandardMaterial({ color: CEIL_COLOR, roughness: 0.9 });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4;
  scene.add(ceil);

  // ── Ceiling beams ──
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.8 });
  for (const bx of [-10, 0, 10]) {
    const bGeo = new THREE.BoxGeometry(0.3, 0.25, 24);
    const b = new THREE.Mesh(bGeo, beamMat);
    b.position.set(bx, 3.88, 0);
    scene.add(b);
  }

  // ── Emissive hazard-orange seam strips ──
  const seamMat = new THREE.MeshStandardMaterial({
    color: ACCENT_ORG, emissive: new THREE.Color(ACCENT_ORG), emissiveIntensity: 0.9, roughness: 0.4,
  });
  // floor-wall seams: front, back, left, right
  const seams: [number, number, number, number, number, number][] = [
    [0,   0.04, -11.85, 39.6, 0.08, 0.08],
    [0,   0.04,  11.85, 39.6, 0.08, 0.08],
    [-19.85, 0.04, 0, 0.08, 0.08, 23.6],
    [ 19.85, 0.04, 0, 0.08, 0.08, 23.6],
  ];
  for (const [x, y, z, w, h, d] of seams) {
    const sg = new THREE.BoxGeometry(w, h, d);
    const sm = new THREE.Mesh(sg, seamMat);
    sm.position.set(x, y, z);
    scene.add(sm);
  }

  // ── Gold trim ──
  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.7,
  });
  // doorframe-style trim arches at front/back walls y≈1–2
  const trims: [number, number, number, number, number, number][] = [
    [0,   2, -11.7, 8, 0.12, 0.12],
    [0,   2,  11.7, 8, 0.12, 0.12],
  ];
  for (const [x, y, z, w, h, d] of trims) {
    const tg = new THREE.BoxGeometry(w, h, d);
    const tm = new THREE.Mesh(tg, goldMat);
    tm.position.set(x, y, z);
    scene.add(tm);
  }
}
