/**
 * controls.ts — FloorControls stub.
 * Provides pointer-lock / orbit navigation for the 3D casino floor.
 * Minimal stub to unblock build; full implementation pending.
 */
import * as THREE from "three";

interface FloorControlsOptions {
  onClickTarget?: (pos: THREE.Vector3) => void;
}

export class FloorControls {
  private camera: THREE.Camera;
  private _domElement: HTMLElement;
  private _options: FloorControlsOptions;
  private _target: THREE.Vector3;

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    _roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    options: FloorControlsOptions = {},
  ) {
    this.camera = camera;
    this._domElement = domElement;
    this._options = options;
    this._target = new THREE.Vector3(0, 1.7, 0);
    this._domElement.addEventListener("click", this._onClick);
  }

  private _onClick = (e: MouseEvent) => {
    if (this._options.onClickTarget) {
      const pos = new THREE.Vector3(
        (e.offsetX / this._domElement.clientWidth) * 2 - 1,
        0,
        0,
      );
      this._options.onClickTarget(pos);
    }
  };

  /** Smoothly glide camera toward target position. */
  setTarget(pos: THREE.Vector3) {
    this._target.copy(pos);
  }

  /** Called each animation frame with delta time. */
  update(_dt: number) {
    // Lerp camera toward target
    this.camera.position.lerp(this._target, 0.05);
  }

  dispose() {
    this._domElement.removeEventListener("click", this._onClick);
  }
}
