/** Deterministic presentation of committed faces. No random or ledger access. */
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const FACES = [
  [0, 0],
  [0, -90],
  [90, 0],
  [-90, 0],
  [0, 90],
  [0, 180],
];
export const DIE_CONTACTS = [0.3, 0.59, 0.83] as const;
/** Authored tray motion: ballistic clearance arcs plus a support-height correction.
 * This is not a rigid-body COM simulation; the correction prevents floor penetration. */
export function dieSupport(rx: number, ry: number, rz: number) {
  const x = (rx * Math.PI) / 180,
    y = (ry * Math.PI) / 180,
    z = (rz * Math.PI) / 180;
  const sx = Math.sin(x),
    cx = Math.cos(x),
    sy = Math.sin(y),
    cy = Math.cos(y),
    sz = Math.sin(z),
    cz = Math.cos(z);
  // CSS Rz * Rx * Ry, projected half-extents in units of the cube half-size.
  return {
    vertical:
      Math.abs(sz * cy + cz * sx * sy) +
      Math.abs(cz * cx) +
      Math.abs(sz * sy - cz * sx * cy),
    horizontal:
      Math.abs(cz * cy - sz * sx * sy) +
      Math.abs(sz * cx) +
      Math.abs(cz * sy + sz * sx * cy),
  };
}
export function diePose(progress: number, face: number, index: number) {
  const p = clamp(progress),
    g = (2 * 66) / (0.3 * 0.3);
  const height =
    p <= 0.3
      ? Math.max(0, 66 - (g * p * p) / 2)
      : p <= 0.59
        ? (g / 2) * (p - 0.3) * (0.59 - p)
        : p <= 0.83
          ? (g / 2) * (p - 0.59) * (0.83 - p)
          : 0;
  // Integrated angular speed loses energy at each impact, then eases to rest.
  const tail = clamp((p - 0.83) / 0.17);
  const integral =
    Math.min(p, 0.3) * 1.7 +
    Math.max(0, Math.min(p - 0.3, 0.29)) * 1.25 +
    Math.max(0, Math.min(p - 0.59, 0.24)) * 0.7 +
    0.35 * 0.17 * (tail - (tail * tail) / 2);
  const turn =
    p === 1
      ? 1
      : integral / (0.3 * 1.7 + 0.29 * 1.25 + 0.24 * 0.7 + (0.35 * 0.17) / 2);
  const [targetX, targetY] = FACES[face - 1] ?? FACES[0];
  const rock = Math.sin(tail * Math.PI * 2) * (1 - tail) ** 2 * 2;
  const rx = turn * (720 + targetX) + rock,
    ry = turn * (1080 + targetY),
    rz = Math.sin(p * Math.PI * 4 + index) * (1 - p) ** 2 * 12;
  const support = dieSupport(rx, ry, rz);
  return {
    x: p === 1 ? 0 : (index - 1) * 3 * (1 - p),
    height,
    rx,
    ry,
    rz,
    support: Math.max(1, support.vertical),
    width: support.horizontal,
    shadow: 0.68 - Math.min(1, height / 66) * 0.48,
    shadowScale: 1 - height / 190,
  };
}
export function dieLight(faceIndex: number, rx: number, ry: number, rz = 0) {
  const normals = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [-1, 0, 0],
    [0, 0, -1],
  ];
  const [x, y, z] = normals[faceIndex];
  const ax = (rx * Math.PI) / 180,
    ay = (ry * Math.PI) / 180;
  // CSS rotateX(...) rotateY(...): Y acts first, then X.
  const xx = x * Math.cos(ay) + z * Math.sin(ay),
    zz = -x * Math.sin(ay) + z * Math.cos(ay);
  const yy = y * Math.cos(ax) - zz * Math.sin(ax),
    z2 = y * Math.sin(ax) + zz * Math.cos(ax);
  const az = (rz * Math.PI) / 180,
    worldX = xx * Math.cos(az) - yy * Math.sin(az),
    worldY = xx * Math.sin(az) + yy * Math.cos(az);
  return 0.63 + Math.max(0, -worldX * 0.3 - worldY * 0.45 + z2 * 0.75) * 0.42;
}
export function tokenPose(progress: number, face: number) {
  const p = clamp(progress),
    flight = clamp(p / 0.76),
    settle = clamp((p - 0.76) / 0.24);
  const end = 1800 + face * 180;
  const damping = (1 - settle) ** 3;
  return {
    angle: end * (1 - (1 - flight) ** 3),
    lift:
      p < 0.76
        ? Math.sin(Math.PI * flight) * 94
        : Math.abs(Math.sin(settle * Math.PI * 3)) * 9 * damping,
    tilt:
      p < 0.76
        ? Math.sin(flight * Math.PI * 2) * 15 * (1 - flight)
        : Math.sin(settle * Math.PI * 6) * 20 * damping,
    floorShift: settle * 36,
    depthTilt:
      p < 0.76
        ? Math.sin(flight * Math.PI) * 24
        : smooth(settle) * 60 + Math.sin(settle * Math.PI * 5) * 26 * damping,
  };
}
/** Ball is captured by the exact selected pocket, then co-rotates with the rotor. */
export function bearingBall(
  progress: number,
  rotor: number,
  finalRotor: number,
) {
  const p = clamp(progress),
    capture = smooth((p - 0.62) / 0.24);
  const flight = -90 + 1080 * (1 - p) ** 3,
    locked = -90 + rotor - finalRotor;
  const theta = ((flight * (1 - capture) + locked * capture) * Math.PI) / 180;
  const impact =
    p > 0.72 && p < 0.86
      ? Math.sin((p - 0.72) * Math.PI * 50) *
        2.3 *
        Math.sin(((p - 0.72) / 0.14) * Math.PI)
      : 0;
  const radius = 145 - 36 * capture + impact;
  return {
    x: 160 + Math.cos(theta) * radius,
    y: 160 + Math.sin(theta) * radius,
  };
}
