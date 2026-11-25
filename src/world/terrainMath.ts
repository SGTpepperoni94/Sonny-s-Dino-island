import { ISLAND_WORLD_RADIUS, SHALLOW_WATER_FLOOR, WATER_LEVEL } from '../config/worldAnchors';
import type { BiomeId } from '../types/game';
import {
  clamp, classifyRegionByPosition, fbm2D, getJungleRoadDistance, getLavaChannelSample,
  getRuinsRampSample, getSkullCaveCoords, getVolcanoTrailSample, HARBOR_BAY_CENTER_X,
  HARBOR_BAY_CENTER_Z, isLavaHazard, LAGOON_CENTER_X, LAGOON_CENTER_Z, smoothstep,
  VOLCANO_CENTER_X, VOLCANO_CENTER_Z,
} from './terrainTrails';

export * from './terrainTrails';

const ridgeCrag = (x: number, z: number, freq: number): number => 1 - Math.abs(fbm2D(x * freq, z * freq) * 1.45);

function blendChiseledBluff(
  x: number, z: number, h: number,
  cx: number, cz: number, rx: number, rz: number, seed: number,
  outer0: number, outer1: number, top0: number, top1: number,
  baseElev: number, topLift: number, cragAmp: number, cragFreq: number,
  blendMax = 1, keepHigher = true,
): number {
  const ang = Math.atan2(z - cz, x - cx);
  const d =
    Math.hypot((x - cx) / rx, (z - cz) / rz) *
    (1 + 0.12 * Math.sin(ang * 5 + seed) + 0.075 * Math.cos(ang * 9 - seed * 1.7) + 0.08 * fbm2D(x * 0.058, z * 0.058));
  const w = (1 - smoothstep(outer0, outer1, d)) * blendMax;
  if (w <= 0.001) return h;
  const top = 1 - smoothstep(top0, top1, d);
  const target = baseElev + top * topLift + (ridgeCrag(x, z, cragFreq) - 0.48) * cragAmp * (1 - top * 0.68);
  return h * (1 - w) + (keepHigher ? Math.max(h, target) : target) * w;
}

function sculptHarborAndMeadow(x: number, z: number, radial: number, baseH: number): number {
  let h = baseH;
  // Pirate Harbor South Crescent Bay + wide golden beach apron (preserving flat family hubs)
  h -= (1 - smoothstep(0.42, 1.16, Math.hypot((x - HARBOR_BAY_CENTER_X) / 68, (z - HARBOR_BAY_CENTER_Z) / 38))) * 5.2;
  const beachBand = (1 - smoothstep(26, 56, Math.abs(x + 2))) * (1 - smoothstep(10, 24, Math.abs(z - 120)));
  const beachSlope = 1.45 - clamp((z - 120) * 0.068, -0.5, 1.8);
  h = h * (1 - beachBand * 0.78) + beachSlope * (beachBand * 0.78);

  // Chiseled angular Harbor framing headlands: West coastal headland, West bluff & East bluff (pirate-harbor.png)
  h = blendChiseledBluff(x, z, h, -78, 124, 30, 25, 0.7, 0.72, 0.94, 0.50, 0.68, 9.2, 8.4, 2.6, 0.085);
  h = blendChiseledBluff(x, z, h, -60, 96, 21, 20, 2.1, 0.56, 0.84, 0.40, 0.60, 11.4, 2.6, 2.0, 0.09);
  h = blendChiseledBluff(x, z, h, 47, 114, 18.5, 14.5, 3.4, 0.60, 0.86, 0.36, 0.56, 10.4, 3.2, 2.3, 0.095);

  // Sunny Meadow / Future Dino Ranch Plateau + surrounding gentle rolling hills
  const ranchW = 1 - smoothstep(0.56, 1.12, Math.hypot((x - 2) / 46, (z - 76) / 32));
  h = h * (1 - ranchW) + (4.8 + fbm2D(x * 0.025, z * 0.025) * 0.25) * ranchW;
  const midRollMask =
    (1 - smoothstep(0.45, 0.94, radial)) *
    smoothstep(28, 52, Math.hypot(x - 2, z - 76)) *
    smoothstep(24, 46, Math.hypot(x + 2, z - 120));
  if (midRollMask > 0.001) {
    h += midRollMask * (2.4 + Math.sin(x * 0.042 + 0.5) * 2.8 + Math.cos(z * 0.044 - 0.3) * 2.5 + fbm2D(x * 0.03, z * 0.03) * 3.1);
  }
  return h;
}

function sculptVolcano(x: number, z: number, baseH: number): number {
  let h = baseH;
  const volcDist = Math.hypot(x - VOLCANO_CENTER_X, z - VOLCANO_CENTER_Z);
  if (volcDist < 104) {
    const vAngle = Math.atan2(z - VOLCANO_CENTER_Z, x - VOLCANO_CENTER_X);
    const normR = clamp(volcDist / 104, 0, 1);
    const ribEnv = Math.pow(1 - normR, 1.05) * smoothstep(0.20, 0.35, normR);
    // Sharp triangular V-creased basalt ribs & secondary buttresses (volcano-ridge.png)
    const primaryRibs = Math.pow(1 - Math.abs(Math.sin(vAngle * 4.5 + 0.4 + normR * 0.65)), 1.75) * 12.6 * ribEnv;
    const secRibs = Math.pow(1 - Math.abs(Math.sin(vAngle * 9.0 - 0.55 - normR * 0.85)), 1.55) * 5.0 * ribEnv;
    const strataLedge = Math.sin(normR * 22.0 + vAngle * 2.0) * 1.25 * ribEnv;
    const basaltCrags = (ridgeCrag(x, z, 0.075) - 0.45) * 4.6 * Math.pow(1 - normR, 1.15) * smoothstep(0.18, 0.32, normR);
    let volcH = Math.pow(1 - normR, 1.56) * 84.5 + primaryRibs + secRibs + strataLedge + basaltCrags;

    // Jagged chiseled caldera rim (~72-83m all 360 deg) & recessed fiery bowl (~57m, below lava Y=63.5)
    if (volcDist < 29.0) {
      const crown = 10.6 + (1 - Math.abs(Math.sin(vAngle * 4.5 + 0.35))) * 4.2;
      volcH += Math.exp(-Math.pow((volcDist - 20.0) / 4.4, 2)) * crown;
      const craterBowl = 1 - smoothstep(10.5, 18.5, volcDist);
      volcH = volcH * (1 - craterBowl) + 57.0 * craterBowl;
    }
    const baseAtten = smoothstep(0.0, 0.62, 1 - normR) * 0.65;
    h = h * (1 - baseAtten) + volcH;
  }

  // Safe wide walkable sandy-ochre ridge trail (stops cleanly outside caldera rim crest)
  const vTrail = getVolcanoTrailSample(x, z);
  const rimGuard = smoothstep(19.5, 24.0, volcDist);
  if (vTrail.dist < 13.5 && rimGuard > 0.001) {
    const trailW = (1 - smoothstep(4.5, 10.6, vTrail.dist)) * rimGuard;
    h = h * (1 - trailW * 0.94) + (7.5 + vTrail.t * 48.5) * (trailW * 0.94);
    if (vTrail.dist > 5.4 && vTrail.dist < 13.2) {
      const shW = Math.exp(-Math.pow((vTrail.dist - 8.4) / 2.1, 2)) * rimGuard * smoothstep(0.16, 0.38, vTrail.t);
      h += shW * (ridgeCrag(x, z, 0.12) * 4.8);
    }
  }

  // Deep chiseled basalt lava canyon breaching WSW rim & sitting 9-15m below walkable ridge trail
  const lava = getLavaChannelSample(x, z);
  if (lava.dist < 16.0) {
    const lavaW = 1 - smoothstep(3.4, 8.0, lava.dist);
    const channelFloor = 7.5 + Math.pow(1 - lava.t, 1.42) * 55.5;
    const trailClear = smoothstep(5.4, 8.8, vTrail.dist);
    const cragWall = 0.65 + ridgeCrag(x, z, 0.12) * 1.05;
    const parapet = Math.exp(-Math.pow((lava.dist - 9.4) / 2.5, 2)) * 6.4 * cragWall * smoothstep(0.1, 0.28, lava.t) * trailClear;
    h = h * (1 - lavaW * 0.97) + channelFloor * (lavaW * 0.97) + parapet;
  }
  return h;
}

function sculptEastCoast(x: number, z: number, baseH: number): number {
  let h = baseH;
  const lagoonDist = Math.hypot((x - LAGOON_CENTER_X) / 40, (z - LAGOON_CENTER_Z) / 36);
  const lagoonCut = 1 - smoothstep(0.42, 1.14, lagoonDist);
  if (lagoonCut > 0.001) {
    h = h * (1 - lagoonCut) + (-0.95 + smoothstep(0.32, 0.95, lagoonDist) * 1.65) * lagoonCut;
  }
  h = blendChiseledBluff(x, z, h, 124, -22, 34, 24, 1.3, 0.56, 0.96, 0.36, 0.60, 22.8, 2.4, 2.6, 0.085, 0.92, true);
  h = blendChiseledBluff(x, z, h, 158, 2, 22, 22, 4.1, 0.54, 0.92, 0.32, 0.56, 14.5, 2.2, 2.4, 0.095, 0.88, false);

  const dockDist = Math.hypot(x - 118, z - 26);
  if (dockDist < 16) {
    const dockW = 1 - smoothstep(5.5, 16, dockDist);
    h = h * (1 - dockW) + 0.95 * dockW;
  }

  // Skull Rock Pirate Cave Headland (chiseled craggy facets) + Smooth Golden Beach Approach & Open Turquoise Inlet
  h = blendChiseledBluff(x, z, h, 104, 97, 34, 29, 2.7, 0.50, 1.04, 0.34, 0.56, 13.5, 9.6, 3.2, 0.095, 1, true);

  const cave = getSkullCaveCoords(x, z);
  if (cave.along > -36 && cave.along < 22 && cave.across > -18 && cave.across < 13) {
    const insideMouth = smoothstep(-16, -6, cave.along);
    const leftEdge = 11.5 - insideMouth * 4.8;
    const rightEdge = 7.4 - insideMouth * 1.0;
    const acrossFade = cave.across < 0
      ? 1 - smoothstep(leftEdge, leftEdge + 4.8, -cave.across)
      : 1 - smoothstep(rightEdge, rightEdge + 4.4, cave.across);
    const alongFade = smoothstep(-35, -24, cave.along) * (1 - smoothstep(14, 22, cave.along));
    const cutW = alongFade * acrossFade;
    if (cutW > 0.001) {
      const chBlend = smoothstep(-0.55, 1.75, cave.across);
      const ledgeY = 0.94 - smoothstep(-10, -2, cave.along) * 0.20;
      const caveFloor = ledgeY * (1 - chBlend) + -0.78 * chBlend;
      h = h * (1 - cutW) + caveFloor * cutW;
    }
  }
  return h;
}

export function computeTerrainHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const coastWarp =
    1 + 0.06 * Math.sin(angle * 3 + 0.6) + 0.04 * Math.cos(angle * 5 - 0.8) + 0.025 * fbm2D(x * 0.016, z * 0.016);
  const radial = Math.hypot(x / (192 * coastWarp), z / (184 * coastWarp));
  let h = sculptHarborAndMeadow(x, z, radial, (1 - smoothstep(0.68, 1.04, radial)) * 8.4 - 2.8);

  // Whispering Fern Jungle rolling emerald hills (fern-jungle.png)
  const jungleW = 1 - smoothstep(0.42, 1.05, Math.hypot((x + 106) / 68, (z - 28) / 72));
  if (jungleW > 0.001) {
    h +=
      jungleW *
      (5.8 + Math.sin(x * 0.052 + 0.35) * 3.6 + Math.cos(z * 0.054 - 0.2) * 3.2 + fbm2D(x * 0.032, z * 0.032) * 3.2);
  }

  // Ancient Dino Ruins 4-tier stepped mossy-stone terraces + walkable ochre ramp (dino-ruins.png)
  const ruinsAngle = Math.atan2(z + 88, x + 94);
  const ruinsDist = Math.hypot((x + 94) / 56, (z + 88) / 48) * (1 + 0.045 * Math.cos(ruinsAngle * 4 - 0.4) + 0.025 * Math.sin(ruinsAngle * 7 + 0.8));
  const ruinsOuterW = 1 - smoothstep(0.92, 1.06, ruinsDist);
  if (ruinsOuterW > 0.001) {
    const tierHeight =
      10.0 +
      5.0 * (1 - smoothstep(0.70, 0.75, ruinsDist)) +
      5.0 * (1 - smoothstep(0.48, 0.53, ruinsDist)) +
      5.0 * (1 - smoothstep(0.25, 0.30, ruinsDist));
    h = h * (1 - ruinsOuterW) + Math.max(h, tierHeight) * ruinsOuterW;
  }
  const ruinsRamp = getRuinsRampSample(x, z);
  if (ruinsRamp.dist < 11.5) {
    const rampW = 1 - smoothstep(4.2, 11.5, ruinsRamp.dist);
    h = h * (1 - rampW * 0.94) + (9.2 + smoothstep(0.0, 0.78, ruinsRamp.t) * 15.8) * (rampW * 0.94);
  }

  h = sculptEastCoast(x, z, sculptVolcano(x, z, h));

  // Recessed earthen embankments & smooth roadbed along Fern Jungle / Meadow trails (fern-jungle.png)
  const roadDist = getJungleRoadDistance(x, z);
  const notNearHubs =
    smoothstep(12, 20, Math.hypot(x + 6, z - 122)) *
    smoothstep(12, 20, Math.hypot(x - 8, z - 117)) *
    smoothstep(14, 24, Math.hypot(x - 2, z - 84)) *
    smoothstep(0.88, 1.08, ruinsDist);
  if (roadDist < 14.5 && notNearHubs > 0.01 && h > 2.4) {
    const bankWave = Math.exp(-Math.pow((roadDist - 7.4) / 2.4, 2)) * 2.35 * notNearHubs;
    const roadCut = (1 - smoothstep(2.8, 5.2, roadDist)) * 0.95 * notNearHubs;
    h += bankWave - roadCut;
    if (roadDist < 5.0) {
      h -= fbm2D(x * 0.038, z * 0.038) * 1.15 * (1 - smoothstep(2.6, 5.0, roadDist)) * notNearHubs;
    }
  }

  // Flat reserved Pirate Harbor & Ranch family hubs
  const spawnDist = Math.hypot(x + 6, z - 122);
  if (spawnDist < 12) h = h * smoothstep(5, 12, spawnDist) + 1.35 * (1 - smoothstep(5, 12, spawnDist));
  const familyDist = Math.hypot(x - 8, z - 117);
  if (familyDist < 12) h = h * smoothstep(5.5, 12, familyDist) + 1.42 * (1 - smoothstep(5.5, 12, familyDist));
  const amyDist = Math.hypot(x - 2, z - 88);
  if (amyDist < 12) h = h * smoothstep(5.5, 12, amyDist) + 4.72 * (1 - smoothstep(5.5, 12, amyDist));
  return Number.isFinite(h) ? h : 0;
}

export function computeTerrainNormal(x: number, z: number): { nx: number; ny: number; nz: number } {
  const eps = 0.85;
  const nx = computeTerrainHeight(x - eps, z) - computeTerrainHeight(x + eps, z);
  const ny = 2 * eps;
  const nz = computeTerrainHeight(x, z - eps) - computeTerrainHeight(x, z + eps);
  const len = Math.hypot(nx, ny, nz) || 1;
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

export function classifyBiomeAt(x: number, z: number): BiomeId {
  const special = classifyRegionByPosition(x, z);
  if (special) return special;
  const h = computeTerrainHeight(x, z);
  if (h < SHALLOW_WATER_FLOOR - 0.15) return 'ocean';
  if (Math.hypot(x - VOLCANO_CENTER_X, z - VOLCANO_CENTER_Z) < 82) return 'volcano';
  if (Math.hypot(x + 94, z + 88) < 58) return 'ruins';
  if (Math.hypot((x - 2) / 46, (z - 76) / 32) < 1.0) return 'ranch';
  if (x < -38 && z > -36 && z < 96) return 'jungle';
  if (z > 100 && Math.abs(x) < 84) return 'harbor';
  return h < WATER_LEVEL - 0.8 ? 'ocean' : 'ranch';
}

export function isPositionWalkable(x: number, z: number): boolean {
  if (Math.hypot(x, z) > ISLAND_WORLD_RADIUS) return false;
  if (isLavaHazard(x, z)) return false;
  if (computeTerrainHeight(x, z) < SHALLOW_WATER_FLOOR) return false;
  const cave = getSkullCaveCoords(x, z);
  if (cave.along > -7 && cave.along < 15 && cave.across > -6.0 && cave.across < 4.5) return true;
  return computeTerrainNormal(x, z).ny >= 0.62;
}

export function isInShallowWater(x: number, z: number): boolean {
  const h = computeTerrainHeight(x, z);
  return h < WATER_LEVEL + 0.08 && h >= SHALLOW_WATER_FLOOR;
}
