import { INITIAL_RESERVED_FOOTPRINTS, WATER_LEVEL } from '../config/worldAnchors';
import type { BiomeId, ReservedFootprint } from '../types/game';
import {
  classifyBiomeAt,
  computeTerrainHeight,
  computeTerrainNormal,
  getLavaChannelSample,
  getSkullCaveCoords,
  getTrailDistance,
  isInShallowWater,
  isLavaHazard,
  isPositionWalkable,
} from './terrainMath';

export class TerrainQuery {
  private readonly reserved: ReservedFootprint[] = [];

  constructor() {
    this.resetFootprints();
  }

  public resetFootprints(): void {
    this.reserved.length = 0;
    for (const fp of INITIAL_RESERVED_FOOTPRINTS) {
      this.reserved.push({ ...fp });
    }
  }

  public getTerrainHeight(x: number, z: number): number {
    return computeTerrainHeight(x, z);
  }

  public getTerrainNormal(x: number, z: number): { nx: number; ny: number; nz: number } {
    return computeTerrainNormal(x, z);
  }

  public isWalkable(x: number, z: number): boolean {
    return isPositionWalkable(x, z);
  }

  public isShallowWater(x: number, z: number): boolean {
    return isInShallowWater(x, z);
  }

  public isLavaHazard(x: number, z: number): boolean {
    return isLavaHazard(x, z);
  }

  public getBiomeAt(x: number, z: number): BiomeId {
    return classifyBiomeAt(x, z);
  }

  public getTrailDistance(x: number, z: number): number {
    return getTrailDistance(x, z);
  }

  public getLavaDistance(x: number, z: number): number {
    return getLavaChannelSample(x, z).dist;
  }

  public getSkullCaveCoords(x: number, z: number) {
    return getSkullCaveCoords(x, z);
  }

  public getWaterLevel(): number {
    return WATER_LEVEL;
  }

  public reserveFootprint(fp: ReservedFootprint): void {
    const existingIdx = this.reserved.findIndex((item) => item.id === fp.id);
    if (existingIdx >= 0) {
      this.reserved[existingIdx] = { ...fp };
    } else {
      this.reserved.push({ ...fp });
    }
  }

  public isFootprintReserved(x: number, z: number, extraMargin = 0): boolean {
    for (let i = 0; i < this.reserved.length; i++) {
      const fp = this.reserved[i];
      const r = fp.radius + extraMargin;
      const dx = x - fp.x;
      const dz = z - fp.z;
      if (dx * dx + dz * dz <= r * r) {
        return true;
      }
    }
    return false;
  }

  public getReservedFootprints(): ReadonlyArray<ReservedFootprint> {
    return this.reserved;
  }
}
