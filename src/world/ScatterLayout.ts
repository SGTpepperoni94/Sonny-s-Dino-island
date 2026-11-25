import type { AssetKey } from '../config/assets';
import {
  applyPalmLeanVariation,
  buildContactShadows,
  buildMidgroundScatter,
  type ContactShadowPlacement,
} from './ScatterMidground';
import type { TerrainQuery } from './TerrainQuery';

export interface ScatterPlacement {
  x: number; y: number; z: number; rotY: number; scale: number;
  scaleY?: number; leanX?: number; leanZ?: number; colorHex?: number; tintShift: number;
}
export interface StructurePlacement { key: AssetKey; x: number; y: number; z: number; rotY: number; }
export interface ScatterLayoutData {
  shipAnchor: { x: number; z: number; rotY: number };
  structures: StructurePlacement[]; ruinsProps: StructurePlacement[];
  palms: ScatterPlacement[]; midgroundTrees: ScatterPlacement[];
  overhangFerns: ScatterPlacement[]; rockOutcrops: ScatterPlacement[];
  rocks: ScatterPlacement[]; bushes: ScatterPlacement[];
  grassTufts: ScatterPlacement[]; pebbles: ScatterPlacement[];
  barrels: ScatterPlacement[]; chests: ScatterPlacement[];
  contactShadows: ContactShadowPlacement[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Well-separated Pirate Harbor village shacks on flat flanks (ny >= 0.97, >= 16.5m apart)
const HARBOR_STRUCTURES: ReadonlyArray<{ key: AssetKey; x: number; z: number; rotY: number }> = [
  { key: 'structure.house1', x: -26, z: 109, rotY: 0.36 },
  { key: 'structure.house2', x: 27, z: 108, rotY: -0.52 },
  { key: 'structure.sawmill', x: -42, z: 114, rotY: 0.48 },
];

const RUINS_BONES: ReadonlyArray<{ key: AssetKey; x: number; z: number; rotY: number }> = [
  { key: 'bones.large', x: -76, z: -86, rotY: 0.8 },
  { key: 'bones.large', x: -81, z: -103, rotY: -1.1 },
  { key: 'bones.skulls', x: -111, z: -83, rotY: 0.35 },
];

const HARBOR_PALMS: ReadonlyArray<readonly [number, number, number]> = [
  [-51, 118, 1.12], [-54, 110, 1.18], [-46, 124, 1.02], [-34, 121, 0.96],
  [-33, 102, 1.08], [-22, 100, 0.95], [-19, 117, 0.94], [-46, 97, 1.12],
  [21, 105, 0.98], [24, 120, 1.02], [35, 115, 1.14], [38, 104, 1.08],
  [28, 96, 0.96], [46, 103, 1.1], [55, 112, 1.04], [61, 119, 0.98],
];

const HARBOR_ROCKS: ReadonlyArray<readonly [number, number, number]> = [
  [-48, 130, 1.48], [-55, 127, 1.64], [-61, 129, 1.56], [-42, 132, 1.18],
  [-58, 119, 1.32], [-66, 122, 1.68], [-36, 129, 1.02], [36, 128, 1.24],
  [42, 126, 1.54], [49, 124, 1.66], [55, 122, 1.44], [34, 119, 1.08],
  [51, 113, 1.35], [62, 126, 1.52], [-23, 102, 0.92], [22, 102, 0.95],
];

const HARBOR_BUSHES: ReadonlyArray<readonly [number, number, number]> = [
  [-20, 112, 1.15], [-21.5, 110.4, 0.85], [-20, 101, 1.2], [-22, 99.5, 0.9],
  [-32, 115, 1.08], [-35, 118, 0.95], [-48, 118, 1.24], [-49.5, 116.5, 0.9],
  [-38, 105, 1.1], [-32, 125, 0.92], [19, 108, 1.18], [20.5, 106.5, 0.86],
  [22, 115, 1.04], [33, 113, 1.16], [35, 107, 1.22], [25, 100, 1.05],
  [40, 112, 1.15], [46, 107, 1.2], [18, 99, 1.12], [-18, 97, 1.06],
  [-17.5, 120.5, 0.88], [-25, 120, 1.02], [20, 121.5, 0.94], [27.5, 118.5, 1.08],
  [37, 120, 1.12], [-43, 122, 1.06], [-29, 96, 1.14], [31, 95, 1.1],
];

const CURATED_BARRELS: ReadonlyArray<readonly [number, number]> = [
  [-29.2, 128.4], [-28.1, 127.6], [-23.0, 129.6], [-22.6, 111.0], [-21.7, 110.0],
  [23.4, 110.2], [24.4, 109.2], [-38.2, 116.2], [-37.2, 115.2], [121.2, 24.4], [122.1, 23.4],
];

const CURATED_CHESTS: ReadonlyArray<readonly [number, number]> = [
  [-30.6, 130.6], [29.8, 110.8], [120.4, 25.0], [-78.5, -80.0],
];

const BORDER_BIOMES = new Set(['harbor', 'ranch', 'jungle']);

function isClearOfStructuresAndDocks(
  x: number, z: number, structures: ReadonlyArray<StructurePlacement>, structMargin: number,
): boolean {
  for (let i = 0; i < structures.length; i++) {
    if (Math.hypot(x - structures[i].x, z - structures[i].z) < structMargin) return false;
  }
  return Math.hypot(x + 25.5, z - 134.5) >= 7.2 && Math.hypot(x - 126.5, z - 20.0) >= 6.8;
}

interface RandomScatterSpec {
  target: number; maxAttempts: number; rangeX: number; rangeZ: number;
  minH: number; maxH: number; minTrail: number; maxTrail?: number;
  reservedMargin: number; structMargin: number; minNy: number;
  yOffset: number; scaleMin: number; scaleRange: number;
  allowVolcano?: boolean; allowedBiomes?: ReadonlySet<string>;
  colorForBiome?: (biome: string) => number;
}

function fillRandomScatter(
  out: ScatterPlacement[], terrain: TerrainQuery, structures: ReadonlyArray<StructurePlacement>,
  rand: () => number, spec: RandomScatterSpec,
): void {
  let attempts = 0;
  while (out.length < spec.target && attempts < spec.maxAttempts) {
    attempts++;
    const x = (rand() * 2 - 1) * spec.rangeX;
    const z = (rand() * 2 - 1) * spec.rangeZ;
    const h = terrain.getTerrainHeight(x, z);
    if (h < spec.minH || h > spec.maxH) continue;
    const biome = terrain.getBiomeAt(x, z);
    if (spec.allowedBiomes && !spec.allowedBiomes.has(biome)) continue;
    if (!spec.allowVolcano && (biome === 'volcano' || biome === 'ocean' || biome === 'skullCave')) continue;
    if (spec.allowVolcano && terrain.isLavaHazard(x, z)) continue;
    const trailDist = terrain.getTrailDistance(x, z);
    if (trailDist < spec.minTrail || (spec.maxTrail !== undefined && trailDist > spec.maxTrail)) continue;
    if (terrain.isFootprintReserved(x, z, spec.reservedMargin)) continue;
    if (!isClearOfStructuresAndDocks(x, z, structures, spec.structMargin)) continue;
    if (spec.minNy > 0 && terrain.getTerrainNormal(x, z).ny < spec.minNy) continue;
    out.push({
      x, y: h + spec.yOffset, z, rotY: rand() * Math.PI * 2,
      scale: spec.scaleMin + rand() * spec.scaleRange,
      colorHex: spec.colorForBiome ? spec.colorForBiome(biome) : undefined,
      tintShift: rand() * 2 - 1,
    });
  }
}

export function generateScatterLayout(terrain: TerrainQuery): ScatterLayoutData {
  const rand = mulberry32(42197);
  const structures = HARBOR_STRUCTURES.filter((s) => !terrain.isFootprintReserved(s.x, s.z, 3.5)).map(
    (s) => ({ ...s, y: terrain.getTerrainHeight(s.x, s.z) }),
  );
  const ruinsProps = RUINS_BONES.filter((r) => !terrain.isFootprintReserved(r.x, r.z, 1.0)).map(
    (r) => ({ ...r, y: terrain.getTerrainHeight(r.x, r.z) }),
  );

  const addCurated = (
    coords: ReadonlyArray<readonly [number, number, number]>,
    minH: number, minTrail: number, resMargin: number, structMargin: number, yOff: number, colorHex?: number,
  ): ScatterPlacement[] => {
    const list: ScatterPlacement[] = [];
    for (const [x, z, scale] of coords) {
      const h = terrain.getTerrainHeight(x, z);
      if (h < minH || h > 26 || terrain.getTrailDistance(x, z) < minTrail) continue;
      if (terrain.isFootprintReserved(x, z, resMargin)) continue;
      if (!isClearOfStructuresAndDocks(x, z, structures, structMargin)) continue;
      list.push({ x, y: h + yOff, z, rotY: rand() * Math.PI * 2, scale, colorHex, tintShift: rand() * 2 - 1 });
    }
    return list;
  };

  const palms = addCurated(HARBOR_PALMS, 0.9, 5.2, 2.5, 7.6, -0.15);
  fillRandomScatter(palms, terrain, structures, rand, {
    target: 120, maxAttempts: 1800, rangeX: 182, rangeZ: 174, minH: 1.1, maxH: 26,
    minTrail: 5.8, reservedMargin: 2.5, structMargin: 8.2, minNy: 0.84, yOffset: -0.15, scaleMin: 0.88, scaleRange: 0.34,
  });

  // Grounded coastal & mid-slope rocks (minNy >= 0.68 prevents stray boulders on steep volcano cliffs)
  const rocks = addCurated(HARBOR_ROCKS, -0.3, 5.2, 2.0, 6.2, -0.25);
  fillRandomScatter(rocks, terrain, structures, rand, {
    target: 100, maxAttempts: 1800, rangeX: 188, rangeZ: 180, minH: -0.2, maxH: 36,
    minTrail: 5.8, reservedMargin: 2.0, structMargin: 6.5, minNy: 0.68, yOffset: -0.25,
    scaleMin: 0.82, scaleRange: 0.58, allowVolcano: true,
  });

  // Doubled tropical bushes: dense Harbor/Meadow/Jungle border pass + island-wide pass
  const bushColor = (b: string) => (b === 'jungle' ? 0x268e23 : b === 'ruins' ? 0x56a825 : 0x4bc22a);
  const bushRand = mulberry32(77351);
  const bushes = addCurated(HARBOR_BUSHES, 1.2, 4.2, 1.5, 5.0, -0.12, 0x3eb429);
  fillRandomScatter(bushes, terrain, structures, bushRand, {
    target: 165, maxAttempts: 4200, rangeX: 168, rangeZ: 158, minH: 1.5, maxH: 25,
    minTrail: 4.1, maxTrail: 17.0, reservedMargin: 1.5, structMargin: 5.2, minNy: 0.78, yOffset: -0.12,
    scaleMin: 0.76, scaleRange: 0.66, allowedBiomes: BORDER_BIOMES, colorForBiome: bushColor,
  });
  fillRandomScatter(bushes, terrain, structures, bushRand, {
    target: 344, maxAttempts: 4200, rangeX: 176, rangeZ: 168, minH: 1.8, maxH: 27,
    minTrail: 4.4, reservedMargin: 1.5, structMargin: 5.4, minNy: 0.80, yOffset: -0.12,
    scaleMin: 0.78, scaleRange: 0.64, colorForBiome: bushColor,
  });

  // Doubled+ varied-size low-poly grass tufts hugging Harbor/Meadow/Jungle borders + trails
  const tuftColor = (b: string) => (b === 'jungle' ? 0x2c9c29 : b === 'ruins' ? 0x62b82a : 0x72d428);
  const tuftRand = mulberry32(99173);
  const grassTufts = addCurated([
    [-19, 122, 1.15], [-23, 121.5, 0.95], [-28, 122, 1.1], [-18, 115, 1.05], [-21, 108, 1.2], [-25, 103, 1.0],
    [20, 122.5, 1.15], [24, 121.5, 0.95], [29, 120.5, 1.12], [21, 114, 1.08], [26, 105, 1.18], [34, 117, 1.1],
  ], 1.2, 3.2, 1.0, 4.2, -0.06, 0x68cc28);
  fillRandomScatter(grassTufts, terrain, structures, tuftRand, {
    target: 350, maxAttempts: 5200, rangeX: 168, rangeZ: 158, minH: 1.55, maxH: 25,
    minTrail: 3.5, maxTrail: 14.5, reservedMargin: 1.0, structMargin: 4.5, minNy: 0.76, yOffset: -0.06,
    scaleMin: 0.72, scaleRange: 0.82, allowedBiomes: BORDER_BIOMES, colorForBiome: tuftColor,
  });
  fillRandomScatter(grassTufts, terrain, structures, tuftRand, {
    target: 720, maxAttempts: 5600, rangeX: 178, rangeZ: 170, minH: 1.85, maxH: 28,
    minTrail: 3.8, reservedMargin: 1.0, structMargin: 4.6, minNy: 0.80, yOffset: -0.06,
    scaleMin: 0.68, scaleRange: 0.84, colorForBiome: tuftColor,
  });

  // Small instanced beach/trail/coastal pebbles along Harbor, Meadow & Jungle borders
  const pebbleColor = (b: string) => (b === 'harbor' ? 0xb8a489 : b === 'jungle' ? 0x8e867a : 0xa59987);
  const pebbleRand = mulberry32(55109);
  const pebbles = addCurated([
    [-20, 126, 0.9], [-24, 124, 0.75], [-18.5, 119, 0.85], [21, 125.5, 0.95], [25, 123, 0.8], [31, 122, 0.9],
  ], 0.45, 3.0, 1.0, 4.0, -0.04, 0xb8a489);
  fillRandomScatter(pebbles, terrain, structures, pebbleRand, {
    target: 210, maxAttempts: 4600, rangeX: 168, rangeZ: 158, minH: 0.45, maxH: 20,
    minTrail: 3.2, maxTrail: 12.5, reservedMargin: 1.0, structMargin: 4.2, minNy: 0.80, yOffset: -0.04,
    scaleMin: 0.48, scaleRange: 0.68, allowedBiomes: BORDER_BIOMES, colorForBiome: pebbleColor,
  });
  fillRandomScatter(pebbles, terrain, structures, pebbleRand, {
    target: 320, maxAttempts: 4000, rangeX: 180, rangeZ: 172, minH: 0.45, maxH: 25,
    minTrail: 3.6, reservedMargin: 1.0, structMargin: 4.4, minNy: 0.80, yOffset: -0.04,
    scaleMin: 0.46, scaleRange: 0.66, colorForBiome: pebbleColor,
  });

  const barrels = CURATED_BARRELS.filter(([x, z]) => !terrain.isFootprintReserved(x, z, 1.0)).map(([x, z]) => ({
    x, y: terrain.getTerrainHeight(x, z) - 0.04, z, rotY: rand() * Math.PI * 2, scale: 0.96 + rand() * 0.1, tintShift: rand() * 2 - 1,
  }));
  const chests = CURATED_CHESTS.filter(([x, z]) => !terrain.isFootprintReserved(x, z, 1.0)).map(([x, z]) => ({
    x, y: terrain.getTerrainHeight(x, z) - 0.04, z, rotY: rand() * Math.PI * 2, scale: 1.0, tintShift: rand() * 2 - 1,
  }));

  const mid = buildMidgroundScatter(terrain, structures, mulberry32(88317));
  palms.push(...mid.extraPalms);
  applyPalmLeanVariation(palms, mulberry32(61409));
  barrels.push(...mid.extraBarrels);
  chests.push(...mid.extraChests);
  const contactShadows = buildContactShadows(terrain, {
    structures, ruinsProps, palms, midgroundTrees: mid.midgroundTrees, rocks,
    rockOutcrops: mid.rockOutcrops, overhangFerns: mid.overhangFerns, bushes, barrels, chests,
  });

  return {
    shipAnchor: { x: -18.5, z: 146.5, rotY: 0.62 },
    structures, ruinsProps, palms, midgroundTrees: mid.midgroundTrees,
    overhangFerns: mid.overhangFerns, rockOutcrops: mid.rockOutcrops,
    rocks, bushes, grassTufts, pebbles, barrels, chests, contactShadows,
  };
}
