import type { AnchorId, BiomeId } from '../types/game';

export const SAVE_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'sonny_island_save_v1';

export interface IslandSaveData {
  schemaVersion: number;
  lastAnchor: AnchorId;
  discoveredBiomes: BiomeId[];
  muted: boolean;
  hatchedDinoIds: string[];
  builtPadIds: string[];
  updatedAt: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createDefaultSave(): IslandSaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastAnchor: 'harborSpawn',
    discoveredBiomes: ['harbor'],
    muted: false,
    hatchedDinoIds: [],
    builtPadIds: [],
    updatedAt: Date.now(),
  };
}

export function migrateSave(raw: unknown): IslandSaveData {
  const defaults = createDefaultSave();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const obj = raw as Record<string, unknown>;
  const discovered = Array.isArray(obj.discoveredBiomes)
    ? (obj.discoveredBiomes.filter((b): b is BiomeId => typeof b === 'string') as BiomeId[])
    : defaults.discoveredBiomes;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastAnchor: typeof obj.lastAnchor === 'string' ? (obj.lastAnchor as AnchorId) : defaults.lastAnchor,
    discoveredBiomes: discovered.length > 0 ? Array.from(new Set(discovered)) : defaults.discoveredBiomes,
    muted: typeof obj.muted === 'boolean' ? obj.muted : defaults.muted,
    hatchedDinoIds: Array.isArray(obj.hatchedDinoIds)
      ? obj.hatchedDinoIds.filter((v): v is string => typeof v === 'string')
      : [],
    builtPadIds: Array.isArray(obj.builtPadIds)
      ? obj.builtPadIds.filter((v): v is string => typeof v === 'string')
      : [],
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
  };
}

export class SaveManager {
  private readonly storage: KeyValueStorage | null;
  private state: IslandSaveData;

  constructor(storage?: KeyValueStorage | null) {
    this.storage = storage !== undefined ? storage : this.resolveBrowserStorage();
    this.state = this.load();
  }

  private resolveBrowserStorage(): KeyValueStorage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // Sandboxed iframe without storage access
    }
    return null;
  }

  public load(): IslandSaveData {
    if (!this.storage) {
      this.state = createDefaultSave();
      return this.state;
    }
    try {
      const text = this.storage.getItem(STORAGE_KEY);
      if (!text) {
        this.state = createDefaultSave();
        return this.state;
      }
      this.state = migrateSave(JSON.parse(text));
      return this.state;
    } catch {
      this.state = createDefaultSave();
      return this.state;
    }
  }

  public getState(): Readonly<IslandSaveData> {
    return this.state;
  }

  public save(patch?: Partial<Omit<IslandSaveData, 'schemaVersion'>>): IslandSaveData {
    if (patch) {
      this.state = migrateSave({
        ...this.state,
        ...patch,
        updatedAt: Date.now(),
      });
    } else {
      this.state.updatedAt = Date.now();
    }
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore quota/sandbox write errors
      }
    }
    return this.state;
  }

  public markBiomeDiscovered(biome: BiomeId): boolean {
    if (biome === 'ocean' || this.state.discoveredBiomes.includes(biome)) {
      return false;
    }
    this.save({
      discoveredBiomes: [...this.state.discoveredBiomes, biome],
    });
    return true;
  }

  public reset(): IslandSaveData {
    this.state = createDefaultSave();
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    return this.state;
  }
}
