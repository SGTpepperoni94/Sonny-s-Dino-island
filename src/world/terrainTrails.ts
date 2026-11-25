import type { BiomeId } from '../types/game';

export interface TrailSample {
  dist: number;
  t: number;
}

export interface SkullCaveCoords {
  along: number;
  across: number;
}

export const VOLCANO_CENTER_X = 96;
export const VOLCANO_CENTER_Z = -94;
export const VOLCANO_CRATER_LAVA_Y = 63.5;
export const VOLCANO_SMOKE_ORIGIN_Y = 65.5;
export const VOLCANO_CRATER_RADIUS = 15.5;

export const SKULL_CAVE_ORIGIN_X = 94;
export const SKULL_CAVE_ORIGIN_Z = 110;
export const LAGOON_CENTER_X = 134;
export const LAGOON_CENTER_Z = 16;
export const WATERFALL_ORIGIN_X = 126;
export const WATERFALL_ORIGIN_Z = -6;
export const HARBOR_BAY_CENTER_X = 0;
export const HARBOR_BAY_CENTER_Z = 148;

function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 3; i++) {
    value += amp * (noise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function samplePolyline(
  px: number,
  pz: number,
  pts: ReadonlyArray<readonly [number, number]>,
): TrailSample {
  let bestDist = Infinity;
  let bestT = 0;
  const segCount = pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const lenSq = abx * abx + abz * abz;
    const segT = lenSq > 1e-6 ? clamp(((px - ax) * abx + (pz - az) * abz) / lenSq, 0, 1) : 0;
    const dist = Math.hypot(px - (ax + abx * segT), pz - (az + abz * segT));
    if (dist < bestDist) {
      bestDist = dist;
      bestT = (i + segT) / segCount;
    }
  }
  return { dist: bestDist, t: bestT };
}

// Primary island trails scaled across ~400m landmass (curving smoothly with zero sharp kinks)
export const MAIN_TRAIL: ReadonlyArray<readonly [number, number]> = [
  [-6, 121], [-16, 102], [-28, 82], [-50, 62], [-80, 50], [-106, 32],
  [-112, 0], [-98, -28], [-78, -54], [-80, -72], [-88, -84], [-95, -94],
];

export const JUNGLE_ROAD_POINTS = MAIN_TRAIL.slice(0, 8);

export const RUINS_RAMP_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-98, -28], [-78, -54], [-80, -72], [-88, -84], [-95, -94],
];

export const HARBOR_TO_RANCH_TRAIL: ReadonlyArray<readonly [number, number]> = [
  [-6, 121], [-2, 102], [2, 88], [2, 82], [16, 46], [32, 10], [46, -18], [58, -39], [68, -56], [79, -71],
];

export const HARBOR_ROAD_POINTS = HARBOR_TO_RANCH_TRAIL.slice(0, 5);

export const VOLCANO_TRAIL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [32, 10], [46, -18], [58, -39], [68, -56], [79, -71],
];

export const HARBOR_TO_CAVE_TRAIL: ReadonlyArray<readonly [number, number]> = [
  [-6, 122], [18, 121], [44, 130], [68, 126], [85.8, 118.6], [95.6, 103.2],
];

export const RANCH_TO_LAGOON_TRAIL: ReadonlyArray<readonly [number, number]> = [
  [2, 82], [38, 72], [76, 56], [104, 40], [118, 26],
];

// Volcano lava canyon breaching WSW rim cleanly and descending deeply below the safe ridge trail
export const LAVA_CHANNEL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [80.5, -87.5], [66.0, -78.0], [51.0, -66.0], [37.0, -52.0], [24.0, -37.0],
];

// Skull Rock Pirate Cave local axes (entrance facing SW toward Pirate Harbor)
const CAVE_FWD_X = 0.56;
const CAVE_FWD_Z = -0.8285;
const CAVE_RIGHT_X = 0.8285;
const CAVE_RIGHT_Z = 0.56;

export function getSkullCaveCoords(x: number, z: number): SkullCaveCoords {
  const dx = x - SKULL_CAVE_ORIGIN_X;
  const dz = z - SKULL_CAVE_ORIGIN_Z;
  return {
    along: dx * CAVE_FWD_X + dz * CAVE_FWD_Z,
    across: dx * CAVE_RIGHT_X + dz * CAVE_RIGHT_Z,
  };
}

export function getTrailDistance(x: number, z: number): number {
  return Math.min(
    samplePolyline(x, z, MAIN_TRAIL).dist,
    samplePolyline(x, z, HARBOR_TO_RANCH_TRAIL).dist,
    samplePolyline(x, z, HARBOR_TO_CAVE_TRAIL).dist,
    samplePolyline(x, z, RANCH_TO_LAGOON_TRAIL).dist,
  );
}

export function getJungleRoadDistance(x: number, z: number): number {
  return Math.min(
    samplePolyline(x, z, JUNGLE_ROAD_POINTS).dist,
    samplePolyline(x, z, HARBOR_ROAD_POINTS).dist,
  );
}

export function getRuinsRampSample(x: number, z: number): TrailSample {
  return samplePolyline(x, z, RUINS_RAMP_POINTS);
}

export function getVolcanoTrailSample(x: number, z: number): TrailSample {
  return samplePolyline(x, z, VOLCANO_TRAIL_POINTS);
}

export function getLavaChannelSample(x: number, z: number): TrailSample {
  return samplePolyline(x, z, LAVA_CHANNEL_POINTS);
}

export function isLavaHazard(x: number, z: number): boolean {
  if (Math.hypot(x - VOLCANO_CENTER_X, z - VOLCANO_CENTER_Z) < 16.5) return true;
  return getLavaChannelSample(x, z).dist < 5.6;
}

/**
 * Smooth 0..1 continuous biome weights for zero-sawtooth world-space fragment splat blending.
 */
export function getVolcanoBlend(x: number, z: number): number {
  const d = Math.hypot(x - VOLCANO_CENTER_X, z - VOLCANO_CENTER_Z);
  return 1 - smoothstep(52, 94, d + fbm2D(x * 0.028, z * 0.028) * 10.5);
}

export function getRuinsBlend(x: number, z: number): number {
  const d = Math.hypot((x + 94) / 58, (z + 88) / 50);
  return 1 - smoothstep(0.68, 1.12, d + fbm2D(x * 0.032, z * 0.032) * 0.14);
}

export function getJungleBlend(x: number, z: number): number {
  const d = Math.hypot((x + 106) / 72, (z - 28) / 74);
  return 1 - smoothstep(0.55, 1.05, d + fbm2D(x * 0.026, z * 0.026) * 0.16);
}

export function getLavaGlowWeight(x: number, z: number): number {
  const craterGlow = 1 - smoothstep(13.5, 23.0, Math.hypot(x - VOLCANO_CENTER_X, z - VOLCANO_CENTER_Z));
  const riverGlow = 1 - smoothstep(3.4, 9.2, getLavaChannelSample(x, z).dist);
  return Math.max(craterGlow, riverGlow);
}

export function getCaveCobbleWeight(x: number, z: number): number {
  const cave = getSkullCaveCoords(x, z);
  const alongW = smoothstep(-9.5, -5.5, cave.along) * (1 - smoothstep(14.5, 18.5, cave.along));
  const acrossW = smoothstep(-6.2, -4.6, cave.across) * (1 - smoothstep(0.1, 1.1, cave.across));
  return alongW * acrossW;
}

export function classifyRegionByPosition(x: number, z: number): BiomeId | null {
  const cave = getSkullCaveCoords(x, z);
  if (cave.along > -14 && cave.along < 19 && Math.abs(cave.across) < 11) return 'skullCave';
  if (Math.hypot(x - LAGOON_CENTER_X, z - LAGOON_CENTER_Z) < 42) return 'lagoon';
  return null;
}
