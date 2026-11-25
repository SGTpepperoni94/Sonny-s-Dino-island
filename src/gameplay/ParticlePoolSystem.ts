import * as THREE from 'three';
import type { EngineContext, IGameSystem } from '../types/game';

export type ParticleKind = 'volcanoSmoke' | 'waterfallMist' | 'waterSplash' | 'footstepDust' | 'waveSparkle';

const POOL_CAPACITY = 180;

export class ParticlePoolSystem implements IGameSystem {
  public readonly id = 'particles';

  private scene: THREE.Scene | null = null;
  private mesh: THREE.InstancedMesh | null = null;
  private cursor = 0;

  // Pre-allocated flat typed arrays (Zero-GC update loop)
  private readonly active = new Uint8Array(POOL_CAPACITY);
  private readonly posX = new Float32Array(POOL_CAPACITY);
  private readonly posY = new Float32Array(POOL_CAPACITY);
  private readonly posZ = new Float32Array(POOL_CAPACITY);
  private readonly velX = new Float32Array(POOL_CAPACITY);
  private readonly velY = new Float32Array(POOL_CAPACITY);
  private readonly velZ = new Float32Array(POOL_CAPACITY);
  private readonly gravity = new Float32Array(POOL_CAPACITY);
  private readonly age = new Float32Array(POOL_CAPACITY);
  private readonly maxAge = new Float32Array(POOL_CAPACITY);
  private readonly sizeStart = new Float32Array(POOL_CAPACITY);
  private readonly sizeEnd = new Float32Array(POOL_CAPACITY);
  private readonly rot = new Float32Array(POOL_CAPACITY);

  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();

  public init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.78,
      metalness: 0.0,
    });
    const inst = new THREE.InstancedMesh(geo, mat, POOL_CAPACITY);
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.name = 'ParticlePool';

    this._dummy.scale.setScalar(0.0001);
    this._dummy.updateMatrix();
    this._color.setHex(0xffffff);
    for (let i = 0; i < POOL_CAPACITY; i++) {
      this.active[i] = 0;
      inst.setMatrixAt(i, this._dummy.matrix);
      inst.setColorAt(i, this._color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    this.mesh = inst;
    this.scene.add(inst);
  }

  public spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    z: number,
    count = 1,
  ): void {
    if (!this.mesh) return;
    for (let n = 0; n < count; n++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % POOL_CAPACITY;
      this.active[idx] = 1;
      this.age[idx] = 0;
      this.rot[idx] = Math.random() * Math.PI * 2;

      if (kind === 'volcanoSmoke') {
        this.posX[idx] = x + (Math.random() - 0.5) * 4.2;
        this.posY[idx] = y + Math.random() * 1.2;
        this.posZ[idx] = z + (Math.random() - 0.5) * 4.2;
        this.velX[idx] = 1.6 + Math.random() * 1.5;
        this.velY[idx] = 4.6 + Math.random() * 2.2;
        this.velZ[idx] = -0.7 + (Math.random() - 0.5) * 1.4;
        this.gravity[idx] = 0.25;
        this.maxAge[idx] = 4.2 + Math.random() * 1.8;
        this.sizeStart[idx] = 1.9;
        this.sizeEnd[idx] = 5.4;
        this._color.setHex(Math.random() > 0.3 ? 0xf5f0f8 : 0xffdfca);
      } else if (kind === 'waterfallMist') {
        const ang = Math.random() * Math.PI * 2;
        this.posX[idx] = x + Math.cos(ang) * (1.2 + Math.random() * 4.0);
        this.posY[idx] = y + Math.random() * 1.1;
        this.posZ[idx] = z + Math.sin(ang) * (1.2 + Math.random() * 3.0);
        this.velX[idx] = Math.cos(ang) * (1.2 + Math.random() * 1.6);
        this.velY[idx] = 1.6 + Math.random() * 2.0;
        this.velZ[idx] = Math.sin(ang) * (1.2 + Math.random() * 1.6);
        this.gravity[idx] = -2.8;
        this.maxAge[idx] = 0.85 + Math.random() * 0.45;
        this.sizeStart[idx] = 0.65;
        this.sizeEnd[idx] = 1.55;
        this._color.setHex(Math.random() > 0.4 ? 0xf0fcff : 0x7ff2ff);
      } else if (kind === 'waterSplash') {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.6 + Math.random() * 2.6;
        this.posX[idx] = x + (Math.random() - 0.5) * 0.4;
        this.posY[idx] = y + 0.12;
        this.posZ[idx] = z + (Math.random() - 0.5) * 0.4;
        this.velX[idx] = Math.cos(ang) * spd;
        this.velY[idx] = 2.8 + Math.random() * 2.4;
        this.velZ[idx] = Math.sin(ang) * spd;
        this.gravity[idx] = -12.0;
        this.maxAge[idx] = 0.48 + Math.random() * 0.24;
        this.sizeStart[idx] = 0.26;
        this.sizeEnd[idx] = 0.04;
        this._color.setHex(Math.random() > 0.35 ? 0xe8fdff : 0x3ce6f5);
      } else if (kind === 'footstepDust') {
        const ang = Math.random() * Math.PI * 2;
        this.posX[idx] = x + (Math.random() - 0.5) * 0.35;
        this.posY[idx] = y + 0.1;
        this.posZ[idx] = z + (Math.random() - 0.5) * 0.35;
        this.velX[idx] = Math.cos(ang) * 0.9;
        this.velY[idx] = 0.9 + Math.random() * 0.8;
        this.velZ[idx] = Math.sin(ang) * 0.9;
        this.gravity[idx] = -1.5;
        this.maxAge[idx] = 0.38 + Math.random() * 0.18;
        this.sizeStart[idx] = 0.22;
        this.sizeEnd[idx] = 0.03;
        this._color.setHex(0xf5dfaa);
      } else {
        // waveSparkle
        const ang = Math.random() * Math.PI * 2;
        this.posX[idx] = x + Math.cos(ang) * 0.6;
        this.posY[idx] = y + 1.4 + Math.random() * 0.5;
        this.posZ[idx] = z + Math.sin(ang) * 0.6;
        this.velX[idx] = Math.cos(ang) * 1.8;
        this.velY[idx] = 2.1 + Math.random() * 1.4;
        this.velZ[idx] = Math.sin(ang) * 1.8;
        this.gravity[idx] = -2.2;
        this.maxAge[idx] = 0.72 + Math.random() * 0.25;
        this.sizeStart[idx] = 0.2;
        this.sizeEnd[idx] = 0.02;
        this._color.setHex(Math.random() > 0.5 ? 0xffe047 : 0x56f0ff);
      }

      this.mesh.setColorAt(idx, this._color);
    }
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  public update(dt: number): void {
    if (!this.mesh) return;
    let dirty = false;

    for (let i = 0; i < POOL_CAPACITY; i++) {
      if (this.active[i] === 0) continue;
      dirty = true;
      this.age[i] += dt;
      const t = this.age[i] / this.maxAge[i];

      if (t >= 1) {
        this.active[i] = 0;
        this._dummy.position.set(0, -50, 0);
        this._dummy.scale.setScalar(0.0001);
        this._dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      this.velY[i] += this.gravity[i] * dt;
      this.posX[i] += this.velX[i] * dt;
      this.posY[i] += this.velY[i] * dt;
      this.posZ[i] += this.velZ[i] * dt;
      this.rot[i] += dt * 1.4;

      const fadeScale = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      const s = Math.max(0.01, (this.sizeStart[i] + (this.sizeEnd[i] - this.sizeStart[i]) * t) * fadeScale);

      this._dummy.position.set(this.posX[i], this.posY[i], this.posZ[i]);
      this._dummy.rotation.set(this.rot[i], this.rot[i] * 0.7, 0);
      this._dummy.scale.setScalar(s);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.mesh) {
      this.scene?.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    this.scene = null;
  }
}
