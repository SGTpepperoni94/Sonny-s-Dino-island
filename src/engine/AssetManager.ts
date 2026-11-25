import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  ASSET_CATALOG,
  PIRATE_KIT_MANIFEST_URL,
  PIRATE_KIT_MODELS_BASE_URL,
  type AssetKey,
} from '../config/assets';

interface PirateManifest {
  baseUrl?: string;
  assets?: Record<string, string> | string[];
  models?: Record<string, string> | string[];
  files?: Record<string, string> | string[];
}

export interface LoadedAssetInstance {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export interface ExtractedSubmesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const LOAD_TIMEOUT_MS = 14000;

export class AssetManager {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, GLTF>();
  private readonly loadingPromises = new Map<string, Promise<GLTF>>();
  private readonly extractedSubmeshes = new Map<string, ExtractedSubmesh[]>();
  private manifestPromise: Promise<Map<string, string>> | null = null;
  private disposed = false;

  constructor() {
    this.loader.setCrossOrigin('anonymous');
  }

  private async getManifestMap(): Promise<Map<string, string>> {
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      const map = new Map<string, string>();
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
        const resp = await fetch(PIRATE_KIT_MANIFEST_URL, { signal: controller.signal });
        window.clearTimeout(timer);
        if (!resp.ok) {
          throw new Error(`Manifest HTTP ${resp.status}`);
        }
        const manifest = (await resp.json()) as PirateManifest;
        // Pinning Quirk (Section 3.2): Always override baseUrl with immutable pinned commit URL
        const baseUrl = PIRATE_KIT_MODELS_BASE_URL;
        const rawEntries = manifest.assets ?? manifest.models ?? manifest.files;
        if (Array.isArray(rawEntries)) {
          for (const file of rawEntries) {
            const cleanName = file.replace(/^.*\//, '').replace(/\.(glb|gltf)$/i, '');
            const cleanPath = file.replace(/^\/+/, '');
            map.set(cleanName, `${baseUrl}${cleanPath}`);
          }
        } else if (rawEntries && typeof rawEntries === 'object') {
          for (const [key, val] of Object.entries(rawEntries)) {
            if (typeof val === 'string') {
              const cleanPath = val.replace(/^\/+/, '');
              const url = /^https?:\/\//i.test(cleanPath)
                ? `${baseUrl}${cleanPath.replace(/^.*\/models\//, '')}`
                : `${baseUrl}${cleanPath}`;
              map.set(key, url);
            }
          }
        }
      } catch {
        // Fallback: direct pinned model URLs resolve by modelKey + '.gltf'
      }
      return map;
    })();

    return this.manifestPromise;
  }

  private async resolveModelUrl(modelKey: string): Promise<string> {
    const map = await this.getManifestMap();
    const mapped = map.get(modelKey);
    if (mapped) return mapped;
    return `${PIRATE_KIT_MODELS_BASE_URL}${modelKey}.gltf`;
  }

  private async loadRawGltf(modelKey: string): Promise<GLTF> {
    const cached = this.cache.get(modelKey);
    if (cached) return cached;

    const inflight = this.loadingPromises.get(modelKey);
    if (inflight) return inflight;

    const promise = (async () => {
      const url = await this.resolveModelUrl(modelKey);
      return await new Promise<GLTF>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error(`Timeout loading ${modelKey}`));
        }, LOAD_TIMEOUT_MS);

        this.loader.load(
          url,
          (gltf) => {
            window.clearTimeout(timer);
            if (this.disposed) {
              this.disposeGltfTree(gltf.scene);
              reject(new Error('AssetManager disposed'));
              return;
            }
            // Tag all shared GLTF meshes so scene teardown never disposes shared buffers
            gltf.scene.traverse((child) => {
              child.userData.sharedResource = true;
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            this.cache.set(modelKey, gltf);
            resolve(gltf);
          },
          undefined,
          (err) => {
            window.clearTimeout(timer);
            reject(err instanceof Error ? err : new Error(String(err)));
          },
        );
      });
    })();

    this.loadingPromises.set(modelKey, promise);
    try {
      return await promise;
    } catch (err) {
      // Evict failed loadingPromises on timeout/error so retries work cleanly
      this.loadingPromises.delete(modelKey);
      throw err;
    }
  }

  public async loadInstance(assetKey: AssetKey): Promise<LoadedAssetInstance> {
    const entry = ASSET_CATALOG[assetKey];
    const gltf = await this.loadRawGltf(entry.modelKey);
    const isRigged = ('rigged' in entry && entry.rigged) || entry.modelKey.startsWith('Characters_');
    const cloned = isRigged ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);

    cloned.traverse((child) => {
      child.userData.sharedResource = true;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return {
      scene: cloned,
      animations: gltf.animations,
    };
  }

  /**
   * Extracts geometry + material pairs baked into root-local space for InstancedMesh batching.
   */
  public async loadSubmeshesForInstancing(assetKey: AssetKey): Promise<ExtractedSubmesh[]> {
    const entry = ASSET_CATALOG[assetKey];
    const existing = this.extractedSubmeshes.get(entry.modelKey);
    if (existing) return existing;

    const gltf = await this.loadRawGltf(entry.modelKey);
    gltf.scene.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(gltf.scene.matrixWorld).invert();
    const results: ExtractedSubmesh[] = [];

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const baked = child.geometry.clone();
        const localMat = new THREE.Matrix4().multiplyMatrices(rootInv, child.matrixWorld);
        baked.applyMatrix4(localMat);
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (mat) {
          results.push({ geometry: baked, material: mat });
        }
      }
    });

    this.extractedSubmeshes.set(entry.modelKey, results);
    return results;
  }

  private disposeGltfTree(root: THREE.Object3D): void {
    const mats = new Set<THREE.Material>();
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          for (const m of child.material) mats.add(m);
        } else if (child.material) {
          mats.add(child.material);
        }
      }
    });
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.map?.dispose();
        m.normalMap?.dispose();
        m.roughnessMap?.dispose();
        m.metalnessMap?.dispose();
      }
      m.dispose();
    }
  }

  public dispose(): void {
    this.disposed = true;
    for (const list of this.extractedSubmeshes.values()) {
      for (const item of list) {
        item.geometry.dispose();
      }
    }
    this.extractedSubmeshes.clear();

    for (const gltf of this.cache.values()) {
      this.disposeGltfTree(gltf.scene);
    }
    this.cache.clear();
    this.loadingPromises.clear();
    this.manifestPromise = null;
  }
}
