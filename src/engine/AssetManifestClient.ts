import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  DINO_KIT_BASE_URL,
  DINO_KIT_MANIFEST_URL,
  DINO_SPECIES_ORDER,
} from '../config/dinoCatalog';
import type { DinoSpecies } from '../types/game';

export interface DinoManifestEntry {
  readonly species: DinoSpecies;
  readonly file: string;
  readonly url: string;
  readonly height: number;
  readonly triangleCount: number;
  readonly animations: readonly string[];
}

export interface DinoManifestData {
  readonly scaling: string;
  readonly baseUrl: string;
  readonly models: Readonly<Record<DinoSpecies, DinoManifestEntry>>;
}

export interface LoadedDinoAsset {
  readonly species: DinoSpecies;
  readonly entry: DinoManifestEntry;
  readonly gltf: GLTF;
}

export interface AssetManifestClientOptions {
  baseUrl?: string;
  manifestUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  loadGltfFn?: (url: string) => Promise<GLTF>;
}

const DEFAULT_TIMEOUT_MS = 16000;
const MUTABLE_REF_PATTERN = /@(main|master|latest)(\/|$)/i;

/**
 * Resolves a manifest-relative file path against an immutable pinned CDN base URL.
 * Rejects mutable git refs (@main, @master, @latest) to keep asset delivery deterministic.
 */
export function resolvePinnedManifestUrl(baseUrl: string, relativePath: string): string {
  if (!baseUrl || MUTABLE_REF_PATTERN.test(baseUrl)) {
    throw new Error(`Unpinned CDN baseUrl rejected: ${baseUrl}`);
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const trimmed = relativePath.trim();
  if (!trimmed || MUTABLE_REF_PATTERN.test(trimmed)) {
    throw new Error(`Invalid or unpinned manifest path: ${relativePath}`);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    if (!trimmed.startsWith(normalizedBase)) {
      throw new Error(`Manifest URL escapes pinned base: ${trimmed}`);
    }
    return trimmed;
  }
  return `${normalizedBase}${trimmed.replace(/^\/+/, '')}`;
}

/**
 * Parses and validates the quaternius-dinosaur-kit@v1.0.0 manifest schema (top-level "models").
 */
export function parseDinoManifest(raw: unknown, baseUrl = DINO_KIT_BASE_URL): DinoManifestData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid dino manifest payload');
  }
  const obj = raw as Record<string, unknown>;
  const scaling = typeof obj.scaling === 'string' ? obj.scaling : '';
  const rawModels = obj.models;
  if (!rawModels || typeof rawModels !== 'object' || Array.isArray(rawModels)) {
    throw new Error('Dino manifest missing top-level "models" map');
  }
  const modelsRecord = rawModels as Record<string, unknown>;
  const parsed = {} as Record<DinoSpecies, DinoManifestEntry>;

  for (const species of DINO_SPECIES_ORDER) {
    const item = modelsRecord[species];
    if (!item || typeof item !== 'object') {
      throw new Error(`Dino manifest missing species "${species}"`);
    }
    const rec = item as Record<string, unknown>;
    const file = typeof rec.file === 'string' ? rec.file : '';
    const height = typeof rec.height === 'number' ? rec.height : NaN;
    const triangleCount = typeof rec.triangleCount === 'number' ? rec.triangleCount : 0;
    const animations = Array.isArray(rec.animations)
      ? rec.animations.filter((a): a is string => typeof a === 'string')
      : [];
    if (!file || !Number.isFinite(height) || height <= 0) {
      throw new Error(`Invalid manifest entry for "${species}"`);
    }
    parsed[species] = {
      species,
      file,
      url: resolvePinnedManifestUrl(baseUrl, file),
      height,
      triangleCount,
      animations,
    };
  }
  return { scaling, baseUrl, models: parsed };
}

function tagSharedResources(root: THREE.Object3D): void {
  root.traverse((child) => {
    child.userData.sharedResource = true;
    if (child instanceof THREE.Mesh) {
      if (child.geometry) child.geometry.userData.sharedResource = true;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (let i = 0; i < mats.length; i++) if (mats[i]) mats[i].userData.sharedResource = true;
    }
  });
}

function disposeGltfResources(root: THREE.Object3D): void {
  const mats = new Set<THREE.Material>();
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of list) if (m) mats.add(m);
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

export class AssetManifestClient {
  private readonly baseUrl: string;
  private readonly manifestUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly loadGltfFn: (url: string) => Promise<GLTF>;
  private readonly loader = new GLTFLoader();

  private manifestCache: DinoManifestData | null = null;
  private manifestPromise: Promise<DinoManifestData> | null = null;
  private readonly modelCache = new Map<DinoSpecies, LoadedDinoAsset>();
  private readonly loadingPromises = new Map<DinoSpecies, Promise<LoadedDinoAsset>>();
  private disposed = false;

  constructor(options: AssetManifestClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DINO_KIT_BASE_URL;
    this.manifestUrl = options.manifestUrl ?? DINO_KIT_MANIFEST_URL;
    if (MUTABLE_REF_PATTERN.test(this.baseUrl) || MUTABLE_REF_PATTERN.test(this.manifestUrl)) {
      throw new Error('AssetManifestClient requires immutable pinned CDN URLs');
    }
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
    this.loader.setCrossOrigin('anonymous');
    this.loadGltfFn = options.loadGltfFn ?? ((url) => this.loadGltfWithTimeout(url));
  }

  public getCachedModel(species: DinoSpecies): LoadedDinoAsset | null {
    return this.modelCache.get(species) ?? null;
  }

  public async loadManifest(): Promise<DinoManifestData> {
    if (this.manifestCache) return this.manifestCache;
    if (this.manifestPromise) return this.manifestPromise;

    const promise = (async () => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
      try {
        const resp = await this.fetchFn(this.manifestUrl, controller ? { signal: controller.signal } : undefined);
        if (!resp.ok) throw new Error(`Dino manifest HTTP ${resp.status}`);
        const data = parseDinoManifest((await resp.json()) as unknown, this.baseUrl);
        this.manifestCache = data;
        return data;
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    })();

    this.manifestPromise = promise;
    try {
      return await promise;
    } catch (err) {
      if (this.manifestPromise === promise) this.manifestPromise = null;
      throw err;
    }
  }

  public async loadModel(species: DinoSpecies): Promise<LoadedDinoAsset> {
    const cached = this.modelCache.get(species);
    if (cached) return cached;
    const inflight = this.loadingPromises.get(species);
    if (inflight) return inflight;

    const promise = (async () => {
      const entry = (await this.loadManifest()).models[species];
      const gltf = await this.loadGltfFn(entry.url);
      if (this.disposed) {
        disposeGltfResources(gltf.scene);
        throw new Error('AssetManifestClient disposed');
      }
      tagSharedResources(gltf.scene);
      const asset: LoadedDinoAsset = { species, entry, gltf };
      this.modelCache.set(species, asset);
      return asset;
    })();

    this.loadingPromises.set(species, promise);
    try {
      return await promise;
    } catch (err) {
      if (this.loadingPromises.get(species) === promise) this.loadingPromises.delete(species);
      throw err;
    }
  }

  private loadGltfWithTimeout(url: string): Promise<GLTF> {
    return new Promise<GLTF>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout loading ${url}`)), this.timeoutMs);
      this.loader.load(
        url,
        (gltf) => { clearTimeout(timer); resolve(gltf); },
        undefined,
        (err) => { clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); },
      );
    });
  }

  public dispose(): void {
    this.disposed = true;
    for (const loaded of this.modelCache.values()) disposeGltfResources(loaded.gltf.scene);
    this.modelCache.clear();
    this.loadingPromises.clear();
    this.manifestCache = null;
    this.manifestPromise = null;
  }
}
