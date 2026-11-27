import * as THREE from 'three';
import {
  DINO_SHOWCASE_ACTIONS,
  DINO_SHOWCASE_SPAWNS,
  type DinoSpawnDef,
} from '../config/dinoCatalog';
import type { AssetManifestClient, LoadedDinoAsset } from '../engine/AssetManifestClient';
import type {
  DinoActionName,
  DinoInstanceInfo,
  DinoSpecies,
  DinoStats,
  EngineContext,
  GamePhase,
  IGameSystem,
} from '../types/game';
import type { TerrainQuery } from '../world/TerrainQuery';
import { DINO_TITLE_CULL_DIST, DinoAnimator, shouldCullDinoAtDistance } from './DinoAnimator';
import {
  buildDinoRig,
  createDinoContactShadowBatch,
  disposeClonedSkeletons,
  type DinoContactShadowBatch,
} from './DinoRigFactory';

interface SpawnedDino {
  readonly spawnIndex: number;
  readonly def: DinoSpawnDef;
  readonly root: THREE.Group;
  readonly animator: DinoAnimator;
  readonly scale: number;
  readonly worldPos: THREE.Vector3;
  culled: boolean;
}

const HIDDEN_SHADOW_MAT = new THREE.Matrix4().makeScale(0, 0, 0);

export class DinoSystem implements IGameSystem {
  public readonly id = 'dinos';
  private readonly terrain: TerrainQuery;
  private readonly manifestClient: AssetManifestClient;

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private getPhase: () => GamePhase = () => 'title';
  private aerialCullOverride = false;
  private isSoftwareGl = false;
  private root: THREE.Group | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private shadows: DinoContactShadowBatch | null = null;

  private readonly dinos: SpawnedDino[] = [];
  private failedCount = 0;
  private disposed = false;

  // Pre-allocated scratch objects for zero-GC update(dt)
  private readonly _camPos = new THREE.Vector3();
  private readonly _projScreenMat = new THREE.Matrix4();
  private readonly _frustum = new THREE.Frustum();

  constructor(terrain: TerrainQuery, manifestClient: AssetManifestClient) {
    this.terrain = terrain;
    this.manifestClient = manifestClient;
  }

  public init(ctx: EngineContext): void {
    this.disposed = false;
    this.failedCount = 0;
    this.aerialCullOverride = false;
    this.dinos.length = 0;
    this.scene = ctx.scene;
    this.camera = ctx.camera;
    this.getPhase = ctx.getPhase;
    this.isSoftwareGl = ctx.isSoftwareGl;

    const root = new THREE.Group();
    root.name = 'DinoShowcase';
    this.root = root;
    ctx.scene.add(root);

    const foundTerrain = ctx.scene.getObjectByName('IslandTerrain');
    this.terrainMesh = foundTerrain instanceof THREE.Mesh ? foundTerrain : null;

    this.shadows = createDinoContactShadowBatch(this.terrain, this.terrainMesh);
    root.add(this.shadows.mesh);
    this.spawnAllShowcaseDinos();
    this.syncVisibilityForCamera();
  }

  private spawnAllShowcaseDinos(): void {
    for (let i = 0; i < DINO_SHOWCASE_SPAWNS.length; i++) {
      const def = DINO_SHOWCASE_SPAWNS[i];
      const cached = this.manifestClient.getCachedModel(def.species);
      if (cached) {
        this.attachLoadedDino(i, def, cached);
      } else {
        void this.manifestClient
          .loadModel(def.species)
          .then((loaded) => { if (!this.disposed) this.attachLoadedDino(i, def, loaded); })
          .catch(() => { if (!this.disposed) this.failedCount++; });
      }
    }
  }

  private attachLoadedDino(spawnIndex: number, def: DinoSpawnDef, loaded: LoadedDinoAsset): void {
    if (!this.root || this.disposed) return;
    const built = buildDinoRig(loaded, def, this.terrain, this.isSoftwareGl, this.terrainMesh);
    const animator = new DinoAnimator(
      def.species, built.model, built.animations, def.initialAction, def.phaseOffset, def.timeScale,
    );
    this.root.add(built.root);
    this.dinos.push({
      spawnIndex, def, root: built.root, animator, scale: built.scale,
      worldPos: new THREE.Vector3(def.x, built.groundY, def.z), culled: false,
    });
    this.syncVisibilityForCamera();
  }

  public setAerialCullOverride(active: boolean): void {
    this.aerialCullOverride = active;
  }

  /** Zero-GC visibility & contact-shadow sync for far-side Title distance culling (>160m). */
  public syncVisibilityForCamera(): void {
    if (!this.camera) return;
    this.camera.getWorldPosition(this._camPos);
    const cullEnabled = this.getPhase() === 'title' || this.aerialCullOverride;
    let shadowDirty = false;

    for (let i = 0; i < this.dinos.length; i++) {
      const d = this.dinos[i];
      const culled = cullEnabled && shouldCullDinoAtDistance(this._camPos, d.worldPos, DINO_TITLE_CULL_DIST);
      if (d.culled !== culled) {
        d.culled = culled;
        d.root.visible = !culled;
      }
    }
    const shadows = this.shadows;
    if (shadows) {
      for (let i = 0; i < shadows.worldPos.length; i++) {
        const hide = cullEnabled && shouldCullDinoAtDistance(this._camPos, shadows.worldPos[i], DINO_TITLE_CULL_DIST);
        if (shadows.hidden[i] !== hide) {
          shadows.hidden[i] = hide;
          shadows.mesh.setMatrixAt(i, hide ? HIDDEN_SHADOW_MAT : shadows.baseMatrices[i]);
          shadowDirty = true;
        }
      }
      if (shadowDirty) shadows.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setAction(idOrAll: string, action: DinoActionName): boolean {
    if (this.dinos.length === 0) return false;
    let changed = false;
    for (let i = 0; i < this.dinos.length; i++) {
      const d = this.dinos[i];
      if (idOrAll === 'all' || d.def.id === idOrAll || d.def.species === idOrAll) {
        if (d.animator.playAction(action, 0.15)) changed = true;
      }
    }
    return changed;
  }

  public getStats(): DinoStats {
    const speciesSet = new Set<DinoSpecies>();
    const instances: DinoInstanceInfo[] = [];
    for (let i = 0; i < this.dinos.length; i++) {
      const d = this.dinos[i];
      speciesSet.add(d.def.species);
      instances.push({
        id: d.def.id, species: d.def.species, biome: d.def.biome,
        action: d.animator.getActiveAction(), availableActions: d.animator.getAvailableActions(),
        scale: Math.round(d.scale * 1000) / 1000,
        x: d.def.x, y: Math.round(d.worldPos.y * 100) / 100, z: d.def.z,
        throttled: d.animator.isThrottled(),
      });
    }
    return {
      expectedCount: DINO_SHOWCASE_SPAWNS.length, loadedCount: this.dinos.length,
      failedCount: this.failedCount, speciesLoaded: Array.from(speciesSet),
      ready: this.dinos.length === DINO_SHOWCASE_SPAWNS.length, instances,
    };
  }

  /** Exercises Idle -> Walk -> Run -> Idle clip switching for SelfTestRunner verification. */
  public verifyShowcaseClips(): { ok: boolean; detail: string } {
    if (this.dinos.length === 0) return { ok: false, detail: `0/${DINO_SHOWCASE_SPAWNS.length} dinos loaded` };
    const missing: string[] = [];
    for (let i = 0; i < this.dinos.length; i++) {
      const d = this.dinos[i];
      const prev = d.animator.getActiveAction();
      for (let a = 0; a < DINO_SHOWCASE_ACTIONS.length; a++) {
        const act = DINO_SHOWCASE_ACTIONS[a];
        if (!d.animator.playAction(act, 0)) missing.push(`${d.def.id}:${act}`);
      }
      d.animator.playAction(prev, 0);
    }
    const speciesCount = new Set(this.dinos.map((d) => d.def.species)).size;
    const ok = this.dinos.length === DINO_SHOWCASE_SPAWNS.length && speciesCount === 6 && missing.length === 0;
    return {
      ok,
      detail: ok
        ? `${this.dinos.length}/${DINO_SHOWCASE_SPAWNS.length} dinos (${speciesCount} species), Idle/Walk/Run verified`
        : `loaded=${this.dinos.length}/${DINO_SHOWCASE_SPAWNS.length}, species=${speciesCount}, missing=[${missing.join(',')}]`,
    };
  }

  public update(dt: number, _elapsedTime: number): void {
    if (!this.camera || this.dinos.length === 0) return;
    this.syncVisibilityForCamera();
    this._projScreenMat.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projScreenMat);
    for (let i = 0; i < this.dinos.length; i++) {
      if (!this.dinos[i].culled) {
        this.dinos[i].animator.update(dt, this._camPos, this.dinos[i].worldPos, this._frustum);
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    for (let i = 0; i < this.dinos.length; i++) {
      this.dinos[i].animator.dispose();
      disposeClonedSkeletons(this.dinos[i].root);
    }
    this.dinos.length = 0;
    if (this.root) { this.scene?.remove(this.root); this.root = null; }
    if (this.shadows) {
      this.shadows.geometry.dispose();
      this.shadows.material.dispose();
      this.shadows.texture?.dispose();
      this.shadows = null;
    }
    this.terrainMesh = null;
    this.scene = this.camera = null;
  }
}
