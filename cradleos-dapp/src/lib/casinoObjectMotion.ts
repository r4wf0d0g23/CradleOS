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
export function diePose(progress: number, face: number, index: number) {
  const p = clamp(progress),
    side = index % 2 ? 1 : -1;
  const keys = [
    [0, -side * 34, 95],
    [0.3, side * 28, 0],
    [0.46, side * 12, 26],
    [0.59, -side * 10, 0],
    [0.7, -side * 4, 8],
    [0.83, 0, 0],
    [1, 0, 0],
  ];
  const k = Math.max(
    0,
    keys.findIndex((_, i) => i < keys.length - 1 && p <= keys[i + 1][0]),
  );
  const a = keys[k],
    b = keys[k + 1],
    u = clamp((p - a[0]) / (b[0] - a[0]));
  const height =
    a[2] + (b[2] - a[2]) * (b[2] > a[2] ? 1 - (1 - u) ** 2 : u ** 2);
  const turn = 1 - (1 - clamp(p / 0.88)) ** 2;
  const [rx, ry] = FACES[face - 1] ?? FACES[0];
  const settle =
    p > 0.83 ? Math.sin((p - 0.83) * Math.PI * 24) * (1 - p) ** 2 * 170 : 0;
  return {
    x: a[1] + (b[1] - a[1]) * smooth(u),
    height,
    rx: turn * (720 + rx) + settle,
    ry: turn * (1080 + ry),
    rz: Math.sin(p * Math.PI * 4 + index) * (1 - p) * 17,
    shadow: 0.65 - Math.min(1, height / 100) * 0.47,
    shadowScale: 1 - height / 190,
  };
}
export function dieLight(faceIndex: number, rx: number, ry: number) {
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
  return 0.63 + Math.max(0, -xx * 0.3 - yy * 0.45 + z2 * 0.75) * 0.42;
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
