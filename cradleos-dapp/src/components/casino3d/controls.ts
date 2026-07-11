import * as THREE from "three";

export interface Bounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export class FloorControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private bounds: Bounds;

  private target = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;

  private isDragging = false;
  private dragPixels = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();

  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp:   (e: PointerEvent) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, bounds: Bounds) {
    this.camera = camera;
    this.domElement = domElement;
    this.bounds = bounds;

    // init target to camera position (xz)
    this.target.set(camera.position.x, 1.7, camera.position.z);
    camera.position.y = 1.7;

    // extract initial yaw/pitch from camera quaternion
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    this.yaw   = euler.y;
    this.pitch = euler.x;

    this.onPointerDown = this._onPointerDown.bind(this);
    this.onPointerMove = this._onPointerMove.bind(this);
    this.onPointerUp   = this._onPointerUp.bind(this);

    domElement.addEventListener("pointerdown", this.onPointerDown);
    domElement.addEventListener("pointermove", this.onPointerMove);
    domElement.addEventListener("pointerup",   this.onPointerUp);
    domElement.addEventListener("pointercancel", this.onPointerUp);
    domElement.style.touchAction = "none";
  }

  private _onPointerDown(e: PointerEvent) {
    this.isDragging   = true;
    
    
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragPixels   = 0;
    this.domElement.setPointerCapture(e.pointerId);
  }

  private _onPointerMove(e: PointerEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragPixels += Math.sqrt(dx * dx + dy * dy);

    // drag-look: rotate yaw/pitch
    this.yaw   -= dx * 0.003;
    this.pitch -= dy * 0.003;
    const MAX_PITCH = (35 * Math.PI) / 180;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    this._applyRotation();
  }

  private _onPointerUp(e: PointerEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // if drag < 6px treat as click-to-move
    if (this.dragPixels < 6) {
      this._clickMove(e.clientX, e.clientY);
    }
    try { this.domElement.releasePointerCapture(e.pointerId); } catch {}
  }

  private _clickMove(clientX: number, clientY: number) {
    const rect = this.domElement.getBoundingClientRect();
    const ndcX =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top)   / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, hit)) {
      const { minX, maxX, minZ, maxZ } = this.bounds;
      hit.x = Math.max(minX, Math.min(maxX, hit.x));
      hit.z = Math.max(minZ, Math.min(maxZ, hit.z));
      this.target.set(hit.x, 1.7, hit.z);
    }
  }

  private _applyRotation() {
    const q = new THREE.Quaternion();
    const yawQ   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    q.multiplyQuaternions(yawQ, pitchQ);
    this.camera.quaternion.copy(q);
  }

  update(dt: number) {
    const lerpSpeed = 1 - Math.pow(0.01, dt);
    this.camera.position.lerp(this.target, lerpSpeed);
    this.camera.position.y = 1.7; // enforce eye height
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerup",   this.onPointerUp);
    this.domElement.removeEventListener("pointercancel", this.onPointerUp);
  }
}
