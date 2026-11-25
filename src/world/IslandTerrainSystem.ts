import * as THREE from 'three';
import type { MaterialLibrary } from '../engine/MaterialLibrary';
import type { EngineContext, IGameSystem } from '../types/game';
import { clamp, computeTerrainHeight, getLavaGlowWeight, getVolcanoBlend, noise2D } from './terrainMath';
import { bakeTerrainSplatRgba, SPLAT_SIZE, TERRAIN_SIZE } from './terrainSplatBaker';

interface CloudCluster {
  x: number;
  y: number;
  z: number;
  speed: number;
  scale: number;
  lobeCount: number;
}

const TERRAIN_SEGMENTS = 180;

const CLOUD_CONFIGS: readonly CloudCluster[] = [
  { x: -210, y: 108, z: -220, speed: 1.4, scale: 2.2, lobeCount: 4 },
  { x: -60, y: 118, z: -250, speed: 1.15, scale: 2.0, lobeCount: 3 },
  { x: 160, y: 114, z: -215, speed: 1.55, scale: 2.3, lobeCount: 4 },
  { x: 265, y: 106, z: -75, speed: 1.25, scale: 2.05, lobeCount: 3 },
  { x: -265, y: 104, z: -35, speed: 1.45, scale: 2.15, lobeCount: 4 },
  { x: -185, y: 110, z: 165, speed: 1.1, scale: 1.95, lobeCount: 3 },
  { x: 195, y: 108, z: 175, speed: 1.3, scale: 2.15, lobeCount: 4 },
  { x: 25, y: 126, z: -120, speed: 1.2, scale: 1.9, lobeCount: 3 },
  { x: -120, y: 120, z: 35, speed: 1.35, scale: 1.85, lobeCount: 3 },
  { x: 130, y: 122, z: 60, speed: 1.15, scale: 1.95, lobeCount: 3 },
];

export class IslandTerrainSystem implements IGameSystem {
  public readonly id = 'terrain';

  private readonly materials: MaterialLibrary;
  private scene: THREE.Scene | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private splatTexture: THREE.DataTexture | null = null;
  private cloudMesh: THREE.InstancedMesh | null = null;
  private readonly clouds: CloudCluster[] = [];
  private readonly _dummy = new THREE.Object3D();

  constructor(materials: MaterialLibrary) {
    this.materials = materials;
  }

  public getTerrainMesh(): THREE.Mesh | null {
    return this.terrainMesh;
  }

  public init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    this.buildTerrain(ctx);
    this.buildClouds();
  }

  private createSplatTexture(ctx: EngineContext): THREE.DataTexture {
    const rgba = bakeTerrainSplatRgba(SPLAT_SIZE, TERRAIN_SIZE);
    const tex = new THREE.DataTexture(rgba, SPLAT_SIZE, SPLAT_SIZE, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = ctx.isSoftwareGl
      ? 1
      : Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    return tex;
  }

  private buildTerrain(ctx: EngineContext): void {
    const N = TERRAIN_SEGMENTS;
    const stride = N + 1;
    const half = TERRAIN_SIZE * 0.5;
    const cell = TERRAIN_SIZE / N;
    const gxPos = new Float32Array(stride * stride);
    const gyPos = new Float32Array(stride * stride);
    const gzPos = new Float32Array(stride * stride);

    // Organic deterministic XZ jitter (<= 0.30 cell keeps every quad strictly convex & surface-exact)
    for (let gz = 0; gz <= N; gz++) {
      for (let gx = 0; gx <= N; gx++) {
        const idx = gz * stride + gx;
        const border = gx === 0 || gx === N || gz === 0 || gz === N;
        const jx = border ? 0 : (noise2D(gx * 0.77 + 3.1, gz * 0.77 - 7.4) - 0.5) * cell * 0.58;
        const jz = border ? 0 : (noise2D(gx * 0.77 - 9.2, gz * 0.77 + 4.8) - 0.5) * cell * 0.58;
        const vx = -half + gx * cell + jx;
        const vz = -half + gz * cell + jz;
        gxPos[idx] = vx;
        gyPos[idx] = computeTerrainHeight(vx, vz);
        gzPos[idx] = vz;
      }
    }

    const triCount = N * N * 2;
    const positions = new Float32Array(triCount * 9);
    const uvs = new Float32Array(triCount * 6);
    const colors = new Float32Array(triCount * 9);
    let pOff = 0;
    let uOff = 0;
    let cOff = 0;

    const emitTri = (a: number, b: number, c: number) => {
      const ax = gxPos[a], ay = gyPos[a], az = gzPos[a];
      const bx = gxPos[b], by = gyPos[b], bz = gzPos[b];
      const cx = gxPos[c], cy = gyPos[c], cz = gzPos[c];
      positions[pOff++] = ax; positions[pOff++] = ay; positions[pOff++] = az;
      positions[pOff++] = bx; positions[pOff++] = by; positions[pOff++] = bz;
      positions[pOff++] = cx; positions[pOff++] = cy; positions[pOff++] = cz;
      uvs[uOff++] = ax / TERRAIN_SIZE + 0.5; uvs[uOff++] = az / TERRAIN_SIZE + 0.5;
      uvs[uOff++] = bx / TERRAIN_SIZE + 0.5; uvs[uOff++] = bz / TERRAIN_SIZE + 0.5;
      uvs[uOff++] = cx / TERRAIN_SIZE + 0.5; uvs[uOff++] = cz / TERRAIN_SIZE + 0.5;

      // Exact geometric flat facet normal for crisp chiseled low-poly sunlight/shadow contrast
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      let fnx = e1y * e2z - e1z * e2y;
      let fny = e1z * e2x - e1x * e2z;
      let fnz = e1x * e2y - e1y * e2x;
      const nLen = Math.hypot(fnx, fny, fnz) || 1;
      fnx /= nLen; fny /= nLen; fnz /= nLen;

      const mx = (ax + bx + cx) / 3;
      const mz = (az + bz + cz) / 3;
      const steep = clamp((1 - fny) / 0.48, 0, 1);
      const volcW = getVolcanoBlend(mx, mz);
      const lavaGlow = getLavaGlowWeight(mx, mz);
      const keyDot = clamp(fnx * -0.66 + fny * 0.52 + fnz * -0.54, -1, 1);
      const relSun = clamp((keyDot - 0.30) / 0.68, -1, 1);
      const shadowDamp = relSun < 0 ? 1 - clamp((lavaGlow - 0.2) * 0.9, 0, 0.65) : 1;
      const contrast = 0.10 + steep * 0.27 + volcW * steep * 0.12;
      const sunShift = relSun >= 0 ? relSun * contrast * (0.96 + volcW * 0.32) : relSun * contrast * 1.18 * shadowDamp;
      const jitter = (noise2D(mx * 0.61 + 11.3, mz * 0.61 - 5.7) - 0.5) * (0.09 + steep * 0.15);
      const shade = clamp(0.99 + sunShift + jitter, 0.50, 1.42);
      const temp = (0.042 + steep * 0.125 + volcW * 0.065) * shadowDamp;
      const r = clamp(shade * (1 + relSun * temp * (relSun >= 0 ? 1.05 : 0.72)), 0.42, 1.48);
      const g = clamp(shade * (1 + relSun * temp * (relSun >= 0 ? 0.34 : 0.60)), 0.44, 1.38);
      const bl = clamp(shade * (1 - relSun * temp * (relSun >= 0 ? 0.68 : 0.98)), 0.48, 1.32);
      for (let v = 0; v < 3; v++) {
        colors[cOff++] = r; colors[cOff++] = g; colors[cOff++] = bl;
      }
    };

    // Ridge-aligned diagonal split sharpens cliff crests, terraces & volcano basalt ribs
    for (let gz = 0; gz < N; gz++) {
      for (let gx = 0; gx < N; gx++) {
        const i00 = gz * stride + gx;
        const i10 = i00 + 1;
        const i01 = i00 + stride;
        const i11 = i01 + 1;
        const tie = (noise2D(gx * 0.83 + 1.7, gz * 0.83 - 2.9) - 0.5) * 0.12;
        if (Math.abs(gyPos[i00] - gyPos[i11]) + tie <= Math.abs(gyPos[i10] - gyPos[i01])) {
          emitTri(i00, i01, i11);
          emitTri(i00, i11, i10);
        } else {
          emitTri(i00, i01, i10);
          emitTri(i10, i01, i11);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.splatTexture = this.createSplatTexture(ctx);
    const mat = this.materials.setTerrainSplatMap(this.splatTexture);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'IslandTerrain';
    this.terrainMesh = mesh;
    this.scene?.add(mesh);
  }

  private buildClouds(): void {
    this.clouds.push(...CLOUD_CONFIGS);
    let totalLobes = 0;
    for (const c of CLOUD_CONFIGS) totalLobes += c.lobeCount;

    const geo = new THREE.IcosahedronGeometry(5.5, 1);
    const inst = new THREE.InstancedMesh(
      geo,
      this.materials.getPalettePresets().cloudWhite,
      totalLobes,
    );
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.name = 'SkyClouds';
    this.cloudMesh = inst;
    this.updateCloudMatrices(0);
    this.scene?.add(inst);
  }

  private updateCloudMatrices(elapsedTime: number): void {
    if (!this.cloudMesh) return;
    let idx = 0;
    for (let cIdx = 0; cIdx < this.clouds.length; cIdx++) {
      const c = this.clouds[cIdx];
      const wrappedX = ((((c.x + elapsedTime * c.speed + 380) % 760) + 760) % 760) - 380;
      for (let l = 0; l < c.lobeCount; l++) {
        const offX = (l - (c.lobeCount - 1) * 0.5) * 6.8 * c.scale;
        const offY = l === Math.floor(c.lobeCount / 2) ? 1.8 * c.scale : 0;
        const offZ = (l % 2 === 0 ? -1.4 : 1.4) * c.scale;
        const lobeScale = l === Math.floor(c.lobeCount / 2) ? 1.15 : 0.78;
        this._dummy.position.set(wrappedX + offX, c.y + offY, c.z + offZ);
        this._dummy.rotation.set(0, cIdx * 0.7 + l * 0.9, 0);
        this._dummy.scale.set(
          c.scale * lobeScale * 1.35,
          c.scale * lobeScale * 0.58,
          c.scale * lobeScale * 0.95,
        );
        this._dummy.updateMatrix();
        this.cloudMesh.setMatrixAt(idx++, this._dummy.matrix);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  public update(_dt: number, elapsedTime: number): void {
    this.updateCloudMatrices(elapsedTime);
  }

  public dispose(): void {
    if (this.terrainMesh) {
      this.scene?.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      this.terrainMesh = null;
    }
    if (this.splatTexture) {
      this.materials.setTerrainSplatMap(null);
      this.splatTexture.dispose();
      this.splatTexture = null;
    }
    if (this.cloudMesh) {
      this.scene?.remove(this.cloudMesh);
      this.cloudMesh.geometry.dispose();
      this.cloudMesh = null;
    }
    this.clouds.length = 0;
    this.scene = null;
  }
}
