/**
 * controls.ts — Walk controls: click-to-move + drag-look.
 *
 * Feel pass (Iteration 1):
 *   - Velocity-based movement: smooth acceleration + natural braking curve.
 *   - Max speed: 4.5 m/s. No head-bob (webview motion sickness).
 *   - onClickTarget callback: caller can spawn a target ring at the clicked point.
 *   - Pitch clamp ±35°, eye height locked to 1.7m.
 */

import * as THREE from "three";

export interface Bounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export interface FloorControlsOptions {
  /** Called with floor-hit position when a click-to-move occurs. */
  onClickTarget?: (pos: THREE.Vector3) => void;
}

export class FloorControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private bounds: Bounds;
  private opts: FloorControlsOptions;

  // Movement
  private target  = new THREE.Vector3();
  private vel     = new THREE.Vector3(); // current XZ velocity (Y unused)
  private readonly MAX_SPEED = 4.5;     // m/s

  // Look
  private yaw   = 0;
  private pitch = 0;

  // Drag tracking
  private isDragging = false;
  private dragPixels = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster  = new THREE.Raycaster();

  // Bound listeners
  private _onPointerDown: (e: PointerEvent) => void;
  private _onPointerMove: (e: PointerEvent) => void;
  private _onPointerUp:   (e: PointerEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    bounds: Bounds,
    opts: FloorControlsOptions = {},
  ) {
    this.camera     = camera;
    this.domElement = domElement;
    this.bounds     = bounds;
    this.opts       = opts;

    // Sync target to camera start position
    this.target.set(camera.position.x, 1.7, camera.position.z);
    camera.position.y = 1.7;

    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    this.yaw   = euler.y;
    this.pitch = euler.x;

    this._onPointerDown = this.handlePointerDown.bind(this);
    this._onPointerMove = this.handlePointerMove.bind(this);
    this._onPointerUp   = this.handlePointerUp.bind(this);

    domElement.addEventListener("pointerdown",   this._onPointerDown);
    domElement.addEventListener("pointermove",   this._onPointerMove);
    domElement.addEventListener("pointerup",     this._onPointerUp);
    domElement.addEventListener("pointercancel", this._onPointerUp);
    domElement.style.touchAction = "none";
  }

  private handlePointerDown(e: PointerEvent) {
    this.isDragging   = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragPixels   = 0;
    this.domElement.setPointerCapture(e.pointerId);
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragPixels += Math.sqrt(dx * dx + dy * dy);

    // Drag-look
    this.yaw   -= dx * 0.003;
    this.pitch -= dy * 0.003;
    const MAX_PITCH = (35 * Math.PI) / 180;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    this.applyRotation();
  }

  private handlePointerUp(e: PointerEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.dragPixels < 6) {
      this.clickMove(e.clientX, e.clientY);
    }
    try { this.domElement.releasePointerCapture(e.pointerId); } catch {}
  }

  private clickMove(clientX: number, clientY: number) {
    const rect = this.domElement.getBoundingClientRect();
    const ndcX =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top)   / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, hit)) return;

    const { minX, maxX, minZ, maxZ } = this.bounds;
    hit.x = Math.max(minX + 0.5, Math.min(maxX - 0.5, hit.x));
    hit.z = Math.max(minZ + 0.5, Math.min(maxZ - 0.5, hit.z));
    hit.y = 1.7;

    this.target.copy(hit);
    this.opts.onClickTarget?.(hit.clone());
  }

  private applyRotation() {
    const yawQ   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    this.camera.quaternion.multiplyQuaternions(yawQ, pitchQ);
  }

  /** Glide camera to a world position immediately (for recall-to-entrance). */
  setTarget(pos: THREE.Vector3) {
    this.target.set(pos.x, 1.7, pos.z);
    this.vel.set(0, 0, 0);
  }

  update(dt: number) {
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const tarX = this.target.x;
    const tarZ = this.target.z;

    const dx   = tarX - camX;
    const dz   = tarZ - camZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.03) {
      // Desired speed: ramp up (0→2m: linear), plateau (2→dist-1m), brake (last 1m)
      const accelZone = Math.min(1.0, dist / 2.0);         // ease-in
      const brakeZone = Math.min(1.0, dist / 1.2);         // ease-out (brake near target)
      const desiredSpeed = this.MAX_SPEED * accelZone * brakeZone;

      // Desired XZ velocity vector
      const invDist  = 1 / dist;
      const desVelX  = dx * invDist * desiredSpeed;
      const desVelZ  = dz * invDist * desiredSpeed;

      // Smoothly steer current velocity toward desired (acceleration)
      const steer = Math.min(1, 10 * dt);
      this.vel.x += (desVelX - this.vel.x) * steer;
      this.vel.z += (desVelZ - this.vel.z) * steer;

      this.camera.position.x += this.vel.x * dt;
      this.camera.position.z += this.vel.z * dt;
    } else {
      // Snap and stop
      this.camera.position.x = tarX;
      this.camera.position.z = tarZ;
      this.vel.x = 0;
      this.vel.z = 0;
    }

    this.camera.position.y = 1.7; // enforce eye height
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown",   this._onPointerDown);
    this.domElement.removeEventListener("pointermove",   this._onPointerMove);
    this.domElement.removeEventListener("pointerup",     this._onPointerUp);
    this.domElement.removeEventListener("pointercancel", this._onPointerUp);
  }
}
