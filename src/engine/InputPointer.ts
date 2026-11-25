import * as THREE from 'three';

export interface RaycastGroundHit {
  hit: boolean;
  x: number;
  z: number;
}

/**
 * Zero-GC pointer-to-terrain raycaster reusing internal Vector2 and Intersection[] buffers.
 */
export class TerrainPointerRaycaster {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly hits: THREE.Intersection[] = [];
  private readonly out: RaycastGroundHit = { hit: false, x: 0, z: 0 };

  public pick(
    canvas: HTMLCanvasElement | null,
    camera: THREE.PerspectiveCamera | null,
    target: THREE.Object3D | null,
    clientX: number,
    clientY: number,
  ): Readonly<RaycastGroundHit> {
    this.out.hit = false;
    if (!canvas || !camera || !target) return this.out;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return this.out;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, camera);
    this.hits.length = 0;
    this.raycaster.intersectObject(target, false, this.hits);
    if (this.hits.length > 0) {
      this.out.hit = true;
      this.out.x = this.hits[0].point.x;
      this.out.z = this.hits[0].point.z;
    }
    return this.out;
  }

  public clear(): void {
    this.hits.length = 0;
  }
}
