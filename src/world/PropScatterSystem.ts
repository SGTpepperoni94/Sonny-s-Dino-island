import * as THREE from 'three';
import { ASSET_CATALOG, type AssetKey } from '../config/assets';
import type { AssetManager } from '../engine/AssetManager';
import type { MaterialLibrary } from '../engine/MaterialLibrary';
import type { EngineContext, IGameSystem } from '../types/game';
import { getOceanWaveHeight } from './OceanSystem';
import {
  buildContactShadowGeometry, buildGrassTuftGeometry, buildMidgroundTreeGeometries,
  buildOverhangFernGeometry, buildPebbleClusterGeometry, buildRockOutcropGeometry,
  buildStylizedBushGeometry, buildStylizedPalmGeometries, createContactShadowMaterial,
} from './ScatterGeometry';
import { generateScatterLayout, type ScatterLayoutData, type ScatterPlacement } from './ScatterLayout';
import type { ContactShadowPlacement } from './ScatterMidground';
import type { TerrainQuery } from './TerrainQuery';

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export class PropScatterSystem implements IGameSystem {
  public readonly id = 'props';
  private readonly terrain: TerrainQuery;
  private readonly assets: AssetManager;
  private readonly materials: MaterialLibrary;

  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;
  private shipAnchor: THREE.Group | null = null;
  private fallbackRocks: THREE.InstancedMesh | null = null;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];
  private disposed = false;

  constructor(terrain: TerrainQuery, assets: AssetManager, materials: MaterialLibrary) {
    this.terrain = terrain;
    this.assets = assets;
    this.materials = materials;
  }

  public init(ctx: EngineContext): void {
    this.disposed = false;
    this.scene = ctx.scene;
    const root = new THREE.Group();
    root.name = 'IslandProps';
    this.root = root;
    ctx.scene.add(root);

    const layout = generateScatterLayout(this.terrain);
    const presets = this.materials.getPalettePresets();
    const bushGeo = buildStylizedBushGeometry();
    const tuftGeo = buildGrassTuftGeometry();
    const pebbleGeo = buildPebbleClusterGeometry();
    const fernGeo = buildOverhangFernGeometry();
    const outcropGeo = buildRockOutcropGeometry();
    const treeGeos = buildMidgroundTreeGeometries();
    const palmGeos = buildStylizedPalmGeometries();
    const shadowGeo = buildContactShadowGeometry();
    const contactShadow = createContactShadowMaterial();

    this.ownedGeometries.push(
      bushGeo, tuftGeo, pebbleGeo, fernGeo, outcropGeo,
      treeGeos.trunk, treeGeos.crown, palmGeos.trunk, palmGeos.crown, shadowGeo,
    );
    this.ownedMaterials.push(contactShadow.material);
    this.ownedTextures.push(contactShadow.texture);

    root.add(
      this.createBatch(bushGeo, presets.grassTuftAo, layout.bushes, 'InstancedBushes', true, 0x3eb429, 1.08, 0.92),
      this.createBatch(tuftGeo, presets.grassTuftAo, layout.grassTufts, 'InstancedFerns', false, 0x58c42b, 1.12, 0.96),
      this.createBatch(fernGeo, presets.grassTuftAoDouble, layout.overhangFerns, 'InstancedOverhangFerns', true, 0x299625, 1.08, 1.04),
      this.createBatch(pebbleGeo, presets.rockInstancedAo, layout.pebbles, 'InstancedPebbles', false, 0xa59987, 1.15, 0.62),
      this.createBatch(outcropGeo, presets.rockInstancedAo, layout.rockOutcrops, 'InstancedOutcrops', true, 0x8f8374, 1.05, 0.96),
      this.createBatch(treeGeos.trunk, presets.palmTrunkAo, layout.midgroundTrees, 'InstancedMidgroundTreeTrunks', true, 0xffffff, 1, 1),
      this.createBatch(treeGeos.crown, presets.grassTuftAo, layout.midgroundTrees, 'InstancedMidgroundTreeCrowns', true, 0x1d7023, 1, 1),
      this.createBatch(palmGeos.trunk, presets.palmTrunkAo, layout.palms, 'InstancedPalmTrunks', true, 0xffffff, 1, 1),
      this.createBatch(palmGeos.crown, presets.palmLeafAo, layout.palms, 'InstancedPalmCrowns', true, 0x6ac03a, 1, 1),
      this.createContactShadowBatch(shadowGeo, contactShadow.material, layout.contactShadows),
    );
    this.buildFallbackRocks(root, layout);

    const anchor = new THREE.Group();
    anchor.name = 'PirateShipAnchor';
    anchor.position.set(layout.shipAnchor.x, 0, layout.shipAnchor.z);
    anchor.rotation.y = layout.shipAnchor.rotY;
    this.shipAnchor = anchor;
    root.add(anchor);
    void this.loadQuaterniusProps(layout);
  }

  private createBatch(
    geo: THREE.BufferGeometry, mat: THREE.Material, placements: ReadonlyArray<ScatterPlacement>,
    name: string, castShadow: boolean, fallbackHex: number, xzMul: number, yMul: number,
  ): THREE.InstancedMesh {
    const inst = new THREE.InstancedMesh(geo, mat, placements.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    inst.name = name;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const useOwnColor = name !== 'InstancedMidgroundTreeTrunks' && name !== 'InstancedPalmTrunks';
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.leanX ?? 0, p.rotY, p.leanZ ?? 0);
      dummy.scale.set(p.scale * xzMul, p.scale * (p.scaleY ?? 1) * yMul, p.scale * xzMul);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(useOwnColor ? (p.colorHex ?? fallbackHex) : fallbackHex)
        .offsetHSL(p.tintShift * 0.025, p.tintShift * 0.06, p.tintShift * 0.06);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    return inst;
  }

  private createContactShadowBatch(
    geo: THREE.BufferGeometry, mat: THREE.Material, shadows: ReadonlyArray<ContactShadowPlacement>,
  ): THREE.InstancedMesh {
    const inst = new THREE.InstancedMesh(geo, mat, shadows.length);
    inst.name = 'InstancedContactShadows';
    inst.castShadow = inst.receiveShadow = false;
    inst.renderOrder = 1;
    const dummy = new THREE.Object3D();
    const normal = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < shadows.length; i++) {
      const s = shadows[i];
      dummy.position.set(s.x, s.y, s.z);
      quat.setFromUnitVectors(UP_AXIS, normal.set(s.nx, s.ny, s.nz).normalize());
      dummy.quaternion.copy(quat);
      dummy.scale.set(s.radius, 1, s.radius);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      const tone = 1 - (1 - s.darkness) * 0.35;
      inst.setColorAt(i, color.setRGB(tone, tone, tone));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    return inst;
  }

  private buildFallbackRocks(parent: THREE.Group, layout: ScatterLayoutData): void {
    const presets = this.materials.getPalettePresets();
    const rockGeo = new THREE.IcosahedronGeometry(1.45, 0).translate(0, 0.55, 0);
    this.ownedGeometries.push(rockGeo);
    this.fallbackRocks = this.createBatch(rockGeo, presets.rockInstanced, layout.rocks, 'FallbackRocks', true, 0x8c8277, 1.1, 0.78);
    parent.add(this.fallbackRocks);
  }

  private async loadQuaterniusProps(layout: ScatterLayoutData): Promise<void> {
    if (!this.root) return;
    void this.assets.loadInstance('ship.sloop').then(({ scene }) => {
      if (this.disposed || !this.shipAnchor) return;
      scene.scale.setScalar(ASSET_CATALOG['ship.sloop'].scale);
      this.shipAnchor.add(scene);
    }).catch(() => {});

    for (const s of [...layout.structures, ...layout.ruinsProps]) {
      void this.assets.loadInstance(s.key).then(({ scene }) => {
        if (this.disposed || !this.root) return;
        const entry = ASSET_CATALOG[s.key];
        scene.position.set(s.x, s.y + entry.yOffset, s.z);
        scene.rotation.y = s.rotY;
        scene.scale.setScalar(entry.scale);
        this.root.add(scene);
      }).catch(() => {});
    }

    // Use lean Quaternius rock variants (712-766 tris each; omit 3,072-tri rock.2 outlier)
    const loadedRocks = await this.spawnBucketed(['rock.1', 'rock.3', 'rock.4'], layout.rocks);
    if (!this.disposed && loadedRocks && this.fallbackRocks) {
      this.root.remove(this.fallbackRocks);
      this.fallbackRocks = null;
    }
    void this.spawnInstancedAsset('prop.barrel', layout.barrels).catch(() => {});
    void this.spawnInstancedAsset('prop.chest', layout.chests).catch(() => {});
  }

  private async spawnBucketed(keys: readonly AssetKey[], placements: ReadonlyArray<ScatterPlacement>): Promise<boolean> {
    const buckets: ScatterPlacement[][] = keys.map(() => []);
    placements.forEach((p, idx) => buckets[idx % keys.length].push(p));
    const settled = await Promise.allSettled(keys.map((k, i) => this.spawnInstancedAsset(k, buckets[i])));
    return settled.some((r) => r.status === 'fulfilled' && r.value);
  }

  private async spawnInstancedAsset(assetKey: AssetKey, placements: ReadonlyArray<ScatterPlacement>): Promise<boolean> {
    if (placements.length === 0 || !this.root) return false;
    const submeshes = await this.assets.loadSubmeshesForInstancing(assetKey);
    if (this.disposed || !this.root || submeshes.length === 0) return false;
    const entry = ASSET_CATALOG[assetKey];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (const sub of submeshes) {
      const inst = new THREE.InstancedMesh(sub.geometry, sub.material, placements.length);
      inst.userData.sharedResource = true;
      inst.castShadow = inst.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.leanX ?? 0, p.rotY, p.leanZ ?? 0);
        const s = entry.scale * p.scale;
        dummy.scale.set(s, s * (p.scaleY ?? 1), s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        color.setRGB(1, 1, 1).offsetHSL(p.tintShift * entry.tintRange.h, p.tintShift * entry.tintRange.s, p.tintShift * entry.tintRange.l);
        inst.setColorAt(i, color);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      this.root.add(inst);
    }
    return true;
  }

  public update(_dt: number, elapsedTime: number): void {
    if (!this.shipAnchor) return;
    const waveY = getOceanWaveHeight(this.shipAnchor.position.x, this.shipAnchor.position.z, elapsedTime);
    this.shipAnchor.position.y = waveY - 0.15;
    this.shipAnchor.rotation.z = Math.sin(elapsedTime * 1.35) * 0.045;
    this.shipAnchor.rotation.x = Math.cos(elapsedTime * 1.1) * 0.035;
  }

  public dispose(): void {
    this.disposed = true;
    if (this.root) { this.scene?.remove(this.root); this.root = null; }
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.ownedTextures) t.dispose();
    this.ownedGeometries.length = this.ownedMaterials.length = this.ownedTextures.length = 0;
    this.fallbackRocks = this.shipAnchor = this.scene = null;
  }
}
