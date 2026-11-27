import { DOCKS, PLANK_CENTRE_Y, PLANK_DEPTH, PLANK_SPACING, PLANK_THICKNESS, PLANK_WIDTH } from '../config/docks';
import * as THREE from 'three';
import type { MaterialLibrary } from '../engine/MaterialLibrary';
import type { ParticlePoolSystem } from '../gameplay/ParticlePoolSystem';
import type { EngineContext, IGameSystem } from '../types/game';
import { buildSkullRockPirateCave } from './SkullRockCaveBuilder';
import {
  VOLCANO_CENTER_X,
  VOLCANO_CENTER_Z,
  VOLCANO_SMOKE_ORIGIN_Y,
  WATERFALL_ORIGIN_X,
  WATERFALL_ORIGIN_Z,
} from './terrainMath';
import { buildVolcanoDrama } from './VolcanoBuilder';
import {
  buildCrystalWaterfall,
  WATERFALL_PLUNGE_LOCAL_Z,
  WATERFALL_ROT_Y,
} from './WaterfallLagoonBuilder';

const WATERFALL_MIST_WORLD_X =
  WATERFALL_ORIGIN_X + Math.sin(WATERFALL_ROT_Y) * WATERFALL_PLUNGE_LOCAL_Z;
const WATERFALL_MIST_WORLD_Z =
  WATERFALL_ORIGIN_Z + Math.cos(WATERFALL_ROT_Y) * WATERFALL_PLUNGE_LOCAL_Z;

export class LandmarkSystem implements IGameSystem {
  public readonly id = 'landmarks';

  private readonly materials: MaterialLibrary;
  private readonly particles: ParticlePoolSystem;
  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];

  private readonly sharedUniformTime = { value: 0 };
  private readonly torchLights: THREE.PointLight[] = [];
  private smokeTimer = 0;
  private mistTimer = 0;

  constructor(materials: MaterialLibrary, particles: ParticlePoolSystem) {
    this.materials = materials;
    this.particles = particles;
  }

  public init(ctx: EngineContext): void {
    this.scene = ctx.scene;
    const root = new THREE.Group();
    root.name = 'IslandLandmarks';
    this.root = root;

    const presets = this.materials.getPalettePresets();
    const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
      this.ownedGeometries.push(geo);
      return geo;
    };
    const trackMat = <T extends THREE.Material>(mat: T): T => {
      this.ownedMaterials.push(mat);
      return mat;
    };

    buildSkullRockPirateCave(root, {
      presets, trackGeo, trackMat, timeUniform: this.sharedUniformTime, torchLights: this.torchLights,
    });
    buildCrystalWaterfall(root, {
      presets, trackGeo, trackMat, timeUniform: this.sharedUniformTime,
    });
    buildVolcanoDrama(root, {
      basaltMat: presets.volcanoBasaltAo,
      timeUniform: this.sharedUniformTime,
      trackGeo,
      trackMat,
    });
    this.buildHarborAndLagoonDocks(root, trackGeo);
    this.preseedAmbientParticles();

    ctx.scene.add(root);
  }

  private preseedAmbientParticles(): void {
    for (let i = 0; i < 6; i++) {
      this.particles.spawn('volcanoSmoke', VOLCANO_CENTER_X + i * 1.4, VOLCANO_SMOKE_ORIGIN_Y + i * 3.6, VOLCANO_CENTER_Z - i * 0.6, 1);
    }
    for (let i = 0; i < 5; i++) {
      this.particles.spawn('waterfallMist', WATERFALL_MIST_WORLD_X + (i - 2) * 1.6, 0.5 + (i % 3) * 0.4, WATERFALL_MIST_WORLD_Z, 1);
    }
  }

  private buildHarborAndLagoonDocks(
    parent: THREE.Group,
    trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  ): void {
    const presets = this.materials.getPalettePresets();
    const totalPlanks = DOCKS.reduce((sum, d) => sum + d.planks, 0);
    const plankInst = new THREE.InstancedMesh(trackGeo(new THREE.BoxGeometry(PLANK_WIDTH, PLANK_THICKNESS, PLANK_DEPTH)), presets.woodDock, totalPlanks);
    const postInst = new THREE.InstancedMesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 6)), presets.palmTrunk, DOCKS.length * 6);
    plankInst.castShadow = true;
    plankInst.receiveShadow = true;
    postInst.castShadow = true;

    const dummy = new THREE.Object3D();
    let pIdx = 0;
    let postIdx = 0;
    for (const d of DOCKS) {
      const cos = Math.cos(d.rotY);
      const sin = Math.sin(d.rotY);
      for (let i = 0; i < d.planks; i++) {
        const localZ = i * PLANK_SPACING;
        dummy.position.set(d.x + sin * localZ, PLANK_CENTRE_Y, d.z + cos * localZ);
        dummy.rotation.set(0, d.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        plankInst.setMatrixAt(pIdx++, dummy.matrix);
      }
      for (let s = 0; s < 3; s++) {
        const localZ = s * ((d.planks - 1) * 0.42);
        for (const side of [-1.6, 1.6]) {
          dummy.position.set(d.x + sin * localZ + cos * side, 0.0, d.z + cos * localZ - sin * side);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          postInst.setMatrixAt(postIdx++, dummy.matrix);
        }
      }
    }
    plankInst.instanceMatrix.needsUpdate = true;
    postInst.instanceMatrix.needsUpdate = true;
    parent.add(plankInst, postInst);
  }

  public update(dt: number, elapsedTime: number): void {
    this.sharedUniformTime.value = elapsedTime;
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = i === 0 ? 22 : 26;
      this.torchLights[i].intensity = base + Math.sin(elapsedTime * 7.5 + i * 2.1) * 3.8;
    }
    this.smokeTimer += dt;
    if (this.smokeTimer >= 0.28) {
      this.smokeTimer = 0;
      this.particles.spawn('volcanoSmoke', VOLCANO_CENTER_X, VOLCANO_SMOKE_ORIGIN_Y, VOLCANO_CENTER_Z, 1);
    }
    this.mistTimer += dt;
    if (this.mistTimer >= 0.16) {
      this.mistTimer = 0;
      this.particles.spawn('waterfallMist', WATERFALL_MIST_WORLD_X, 0.45, WATERFALL_MIST_WORLD_Z, 1);
    }
  }

  public dispose(): void {
    if (this.root) {
      this.scene?.remove(this.root);
      this.root = null;
    }
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.torchLights.length = 0;
    this.scene = null;
  }
}
