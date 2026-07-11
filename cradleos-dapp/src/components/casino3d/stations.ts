import * as THREE from "three";

export interface Station {
  key: string;
  name: string;
  position: THREE.Vector3;
  radius: number;
  group: THREE.Group;
  tick?: (dt: number) => void;
}

// ── Label sprite ──
function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(10,10,18,0.82)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "#ff4700";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 62);
  ctx.fillStyle = "#e8b84b";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.45, 1);
  return sprite;
}

// ── Signage plane ──
function makeSignage(key: string): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1.6, 1.2);
  const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, fallbackMat);

  const loader = new THREE.TextureLoader();
  loader.load(
    `${import.meta.env.BASE_URL}casino/cards/${key}.webp`,
    (tex) => {
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
      mesh.material = mat;
    },
    undefined,
    () => {
      // silent fail — keep fallback dark material
    },
  );
  return mesh;
}

// ── Blackjack ──
function buildBlackjack(scene: THREE.Scene): Station {
  const group = new THREE.Group();
  const pos = new THREE.Vector3(-10, 0, -4);

  // Table body
  const tableGeo = new THREE.BoxGeometry(2.2, 0.9, 1.2);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = 0.45;
  group.add(table);

  // Felt top
  const feltGeo = new THREE.PlaneGeometry(2.0, 1.0);
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x0a2a0a, roughness: 0.95 });
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = 0.91;
  group.add(felt);

  // Gold rim edges (4 sides)
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe8b84b, emissive: new THREE.Color(0xe8b84b), emissiveIntensity: 0.15, metalness: 0.7, roughness: 0.3,
  });
  const rimPositions: [number, number, number, number, number, number][] = [
    [0,     0.91, -0.6, 2.2, 0.04, 0.04],
    [0,     0.91,  0.6, 2.2, 0.04, 0.04],
    [-1.1,  0.91,  0,   0.04, 0.04, 1.2],
    [ 1.1,  0.91,  0,   0.04, 0.04, 1.2],
  ];
  for (const [x, y, z, w, h, d] of rimPositions) {
    const rg = new THREE.BoxGeometry(w, h, d);
    const rm = new THREE.Mesh(rg, goldMat);
    rm.position.set(x, y, z);
    group.add(rm);
  }

  // Label + signage
  const label = makeLabel("BLACKJACK");
  label.position.set(0, 2.6, 0);
  group.add(label);

  const sign = makeSignage("blackjack");
  sign.position.set(0, 3.2, -0.62);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  return { key: "blackjack", name: "BLACKJACK", position: pos, radius: 2.2, group };
}

// ── Roulette ──
function buildRoulette(scene: THREE.Scene): Station {
  const group = new THREE.Group();
  const pos = new THREE.Vector3(0, 0, 0);

  // Plinth
  const plinthGeo = new THREE.CylinderGeometry(0.9, 1.0, 1.0, 16);
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.5;
  group.add(plinth);

  // Wheel disc
  const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.06, 32);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.5 });
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.position.y = 1.04;
  group.add(wheel);

  // Orange ring
  const ringGeo = new THREE.TorusGeometry(0.78, 0.06, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff4700, emissive: new THREE.Color(0xff4700), emissiveIntensity: 0.7, roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.08;
  group.add(ring);

  // Label + signage
  const label = makeLabel("ROULETTE");
  label.position.set(0, 2.6, 0);
  group.add(label);

  const sign = makeSignage("roulette");
  sign.position.set(0, 3.2, -1.1);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  let rot = 0;
  const tick = (dt: number) => {
    rot += dt * 0.4;
    wheel.rotation.y = rot;
    ring.rotation.z  = rot * 0.5;
  };

  return { key: "roulette", name: "ROULETTE", position: pos, radius: 2.2, group, tick };
}

// ── Plinko ──
function buildPlinko(scene: THREE.Scene): Station {
  const group = new THREE.Group();
  const pos = new THREE.Vector3(10, 0, 4);

  // Board
  const boardGeo = new THREE.BoxGeometry(1.2, 3.0, 0.4);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x0e0e18, roughness: 0.85 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 1.5;
  group.add(board);

  // Pegs (~30 in offset rows)
  const pegGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8);
  const pegMat = new THREE.MeshStandardMaterial({ color: 0xe8b84b, metalness: 0.7, roughness: 0.3 });
  const cols = 5;
  for (let row = 0; row < 6; row++) {
    const offset = (row % 2 === 0) ? 0 : 0.11;
    for (let col = 0; col < cols; col++) {
      const pg = new THREE.Mesh(pegGeo, pegMat);
      pg.rotation.x = Math.PI / 2;
      pg.position.set(
        -0.44 + col * 0.22 + offset,
        2.8 - row * 0.36,
        0.21,
      );
      group.add(pg);
    }
  }

  // Emissive orange ball at bottom
  const ballGeo = new THREE.SphereGeometry(0.08, 12, 8);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xff4700, emissive: new THREE.Color(0xff4700), emissiveIntensity: 1.0, roughness: 0.3,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.set(0, 0.6, 0.21);
  group.add(ball);

  // Label + signage
  const label = makeLabel("PLINKO");
  label.position.set(0, 4.0, 0);
  group.add(label);

  const sign = makeSignage("plinko");
  sign.position.set(0, 4.6, -0.22);
  group.add(sign);

  group.position.copy(pos);
  scene.add(group);

  return { key: "plinko", name: "PLINKO", position: pos, radius: 2.2, group };
}

export function buildStations(scene: THREE.Scene): Station[] {
  return [
    buildBlackjack(scene),
    buildRoulette(scene),
    buildPlinko(scene),
  ];
}
