import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { WATER_LEVEL } from '../config/worldAnchors';
import type { EngineContext, IGameSystem } from '../types/game';
import {
  bakeCoastMap,
  createOceanSurfaceMaterial,
  createShorelineFoamMaterial,
  getOceanWaveHeight,
  mapOceanGridCoord,
  NEAR_U,
  OCEAN_SEGMENTS,
} from './oceanShaders';
import {
  computeTerrainHeight,
  HARBOR_BAY_CENTER_X,
  HARBOR_BAY_CENTER_Z,
  LAGOON_CENTER_X,
  LAGOON_CENTER_Z,
  SKULL_CAVE_ORIGIN_X,
  SKULL_CAVE_ORIGIN_Z,
} from './terrainMath';
import { TERRAIN_SIZE } from './terrainSplatBaker';

export { getOceanWaveHeight, mapOceanGridCoord };

const FOAM_SEGMENTS = 168;

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export class OceanSystem implements IGameSystem {
  public readonly id = 'ocean';

  private scene: THREE.Scene | null = null;
  private oceanMesh: THREE.Mesh | null = null;
  private foamMesh: THREE.Mesh | null = null;
  private coastTexture: THREE.DataTexture | null = null;
  private oceanUniformTime = { value: 0 };
  private foamUniformTime = { value: 0 };

  public static getWaveHeight(x: number, z: number, time: number): number {
    return getOceanWaveHeight(x, z, time);
  }

  public init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    this.coastTexture = bakeCoastMap();
    this.buildOcean();
    this.buildShorelineFoam();
  }

  private buildOcean(): void {
    if (!this.coastTexture) return;
    const seg = OCEAN_SEGMENTS;
    const baseGeo = new THREE.PlaneGeometry(2, 2, seg, seg);
    baseGeo.rotateX(-Math.PI / 2);

    const bPos = baseGeo.attributes.position;
    const depths = new Float32Array(bPos.count);
    const halfTerrain = TERRAIN_SIZE * 0.5;
    for (let i = 0; i < bPos.count; i++) {
      const u = bPos.getX(i);
      const v = bPos.getZ(i);
      let wx = mapOceanGridCoord(u);
      let wz = mapOceanGridCoord(v);
      if (Math.abs(u) < NEAR_U * 0.96 && Math.abs(v) < NEAR_U * 0.96) {
        const ix = Math.round((u + 1) * seg * 0.5);
        const iz = Math.round((v + 1) * seg * 0.5);
        wx += (hash2D(ix, iz) - 0.5) * 2.1;
        wz += (hash2D(ix + 53, iz + 97) - 0.5) * 2.1;
      }
      bPos.setXYZ(i, wx, 0, wz);
      const th =
        Math.abs(wx) <= halfTerrain && Math.abs(wz) <= halfTerrain ? computeTerrainHeight(wx, wz) : -6;
      depths[i] = Math.max(0, WATER_LEVEL - th);
    }
    baseGeo.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));

    const geo = baseGeo.toNonIndexed();
    baseGeo.dispose();

    const pos = geo.attributes.position;
    const depthAttr = geo.attributes.aDepth;
    const colors = new Float32Array(pos.count * 3);
    const cShallow = new THREE.Color(PALETTE.oceanShallow);
    const cMid = new THREE.Color(PALETTE.oceanMid);
    const cDeep = new THREE.Color(PALETTE.oceanDeep);
    const cTmp = new THREE.Color();

    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const dMean = (depthAttr.getX(i) + depthAttr.getX(i + 1) + depthAttr.getX(i + 2)) / 3;
      const dist = Math.hypot(cx, cz);
      const lagoonT = 1 - THREE.MathUtils.smoothstep(Math.hypot(cx - LAGOON_CENTER_X, cz - LAGOON_CENTER_Z), 14, 48);
      const harborT = 1 - THREE.MathUtils.smoothstep(Math.hypot(cx - HARBOR_BAY_CENTER_X, cz - HARBOR_BAY_CENTER_Z), 16, 66);
      const caveT = 1 - THREE.MathUtils.smoothstep(Math.hypot(cx - SKULL_CAVE_ORIGIN_X, cz - SKULL_CAVE_ORIGIN_Z), 10, 30);
      const shallowDepth = 1 - THREE.MathUtils.smoothstep(dMean, 0.18, 2.3);
      const shallowW = Math.min(1, Math.max(shallowDepth * 0.96, lagoonT * 0.92, harborT * 0.62, caveT * 0.85));
      const deepW = THREE.MathUtils.smoothstep(dist, 175, 420);

      cTmp.copy(cMid).lerp(cDeep, deepW).lerp(cShallow, shallowW);
      const triIdx = i / 3;
      const jitter = hash2D(triIdx * 0.137, Math.floor(cx * 0.5) + Math.floor(cz * 0.5));
      const hueTint = (hash2D(triIdx * 0.291, 17) - 0.5) * 0.045;
      cTmp.offsetHSL(hueTint, 0.05, (jitter - 0.5) * 0.13);

      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = cTmp.r;
        colors[(i + k) * 3 + 1] = cTmp.g;
        colors[(i + k) * 3 + 2] = cTmp.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = createOceanSurfaceMaterial(this.oceanUniformTime, this.coastTexture);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = WATER_LEVEL;
    mesh.receiveShadow = true;
    mesh.name = 'OceanSurface';
    this.oceanMesh = mesh;
    this.scene?.add(mesh);
  }

  private buildShorelineFoam(): void {
    if (!this.coastTexture) return;
    // Sparse coastal ribbon mesh: emit only quads spanning h in [-2.4m, +1.5m] for zero wasted overdraw
    const seg = FOAM_SEGMENTS;
    const stride = seg + 1;
    const half = TERRAIN_SIZE * 0.5;
    const step = TERRAIN_SIZE / seg;
    const hGrid = new Float32Array(stride * stride);

    for (let iz = 0; iz <= seg; iz++) {
      const wz = -half + iz * step;
      for (let ix = 0; ix <= seg; ix++) {
        hGrid[iz * stride + ix] = computeTerrainHeight(-half + ix * step, wz);
      }
    }

    const positions: number[] = [];
    const terrainHs: number[] = [];
    const pushVert = (ix: number, iz: number) => {
      positions.push(-half + ix * step, WATER_LEVEL, -half + iz * step);
      terrainHs.push(hGrid[iz * stride + ix]);
    };

    for (let iz = 0; iz < seg; iz++) {
      for (let ix = 0; ix < seg; ix++) {
        const h00 = hGrid[iz * stride + ix];
        const h10 = hGrid[iz * stride + ix + 1];
        const h01 = hGrid[(iz + 1) * stride + ix];
        const h11 = hGrid[(iz + 1) * stride + ix + 1];
        if (Math.max(h00, h10, h01, h11) < -2.4 || Math.min(h00, h10, h01, h11) > 1.5) continue;
        pushVert(ix, iz);
        pushVert(ix, iz + 1);
        pushVert(ix + 1, iz);
        pushVert(ix + 1, iz);
        pushVert(ix, iz + 1);
        pushVert(ix + 1, iz + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aTerrainH', new THREE.Float32BufferAttribute(terrainHs, 1));

    const mat = createShorelineFoamMaterial(this.foamUniformTime, this.coastTexture);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    mesh.name = 'ShorelineFoam';
    this.foamMesh = mesh;
    this.scene?.add(mesh);
  }

  public update(_dt: number, elapsedTime: number): void {
    this.oceanUniformTime.value = elapsedTime;
    this.foamUniformTime.value = elapsedTime;
  }

  public dispose(): void {
    if (this.oceanMesh) {
      this.scene?.remove(this.oceanMesh);
      this.oceanMesh.geometry.dispose();
      (this.oceanMesh.material as THREE.Material).dispose();
      this.oceanMesh = null;
    }
    if (this.foamMesh) {
      this.scene?.remove(this.foamMesh);
      this.foamMesh.geometry.dispose();
      (this.foamMesh.material as THREE.Material).dispose();
      this.foamMesh = null;
    }
    if (this.coastTexture) {
      this.coastTexture.dispose();
      this.coastTexture = null;
    }
    this.scene = null;
  }
}
