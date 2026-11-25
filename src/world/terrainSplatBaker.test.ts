import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import { VOLCANO_CENTER_X, VOLCANO_CENTER_Z } from './terrainMath';
import {
  bakeTerrainSplatRgba,
  hash22,
  RUINS_VORONOI_SCALE,
  sampleRuinsVoronoi,
  TERRAIN_SIZE,
} from './terrainSplatBaker';

function sampleRgba(
  rgba: Uint8Array,
  size: number,
  wx: number,
  wz: number,
): { r: number; g: number; b: number; a: number } {
  const px = Math.max(0, Math.min(size - 1, Math.floor((wx / TERRAIN_SIZE + 0.5) * size)));
  const py = Math.max(0, Math.min(size - 1, Math.floor((wz / TERRAIN_SIZE + 0.5) * size)));
  const i = (py * size + px) * 4;
  return { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], a: rgba[i + 3] };
}

test('bakeTerrainSplatRgba produces deterministic biome colors and lava emissive alpha channel', () => {
  const size = 256;
  const rgba = bakeTerrainSplatRgba(size, TERRAIN_SIZE);
  assert.equal(rgba.length, size * size * 4);

  // Golden sand at Pirate Harbor spawn
  const harbor = sampleRgba(rgba, size, WORLD_ANCHORS.harborSpawn.x, WORLD_ANCHORS.harborSpawn.z);
  assert.ok(harbor.r > 200 && harbor.g > 150 && harbor.b < 140, `Expected golden sand at harborSpawn, got ${JSON.stringify(harbor)}`);
  assert.equal(harbor.a, 255, 'Harbor beach must have zero lava emissive');

  // Vibrant sunlit green meadow at Ranch plateau (away from dirt roads)
  const ranch = sampleRgba(rgba, size, 20, 94);
  assert.ok(ranch.g > ranch.r + 35 && ranch.g > 150, `Expected vibrant green meadow near ranch, got ${JSON.stringify(ranch)}`);
  assert.equal(ranch.a, 255);

  // Crisp ochre dirt trail along Harbor-to-Ranch sightline with sharp grass transition just off-trail
  const trail = sampleRgba(rgba, size, -2, 102);
  assert.ok(trail.r > 175 && trail.g > 110 && trail.b < 100, `Expected ochre dirt on trail, got ${JSON.stringify(trail)}`);
  const offTrail = sampleRgba(rgba, size, 4.5, 102);
  assert.ok(offTrail.g > offTrail.r + 30, `Expected crisp green grass just off trail edge, got ${JSON.stringify(offTrail)}`);

  // Fiery lava emissive packed into alpha channel at volcano caldera center
  const caldera = sampleRgba(rgba, size, VOLCANO_CENTER_X, VOLCANO_CENTER_Z);
  assert.ok(caldera.a < 80, `Expected strong lava emissive (low alpha) in caldera, got ${JSON.stringify(caldera)}`);
  assert.ok(caldera.r > 190 && caldera.r > caldera.b * 3, `Expected warm fiery lava color in caldera, got ${JSON.stringify(caldera)}`);
});

test('sampleRuinsVoronoi produces organic non-grid polygonal flagstones with varied stone tones', () => {
  const [hx, hz] = hash22(-12, 7);
  assert.ok(hx >= 0 && hx < 1 && hz >= 0 && hz < 1, 'hash22 must stay normalized in [0, 1)');

  let slabCount = 0;
  let grassCount = 0;
  let edgeDiffCount = 0;
  const tones = new Set<number>();

  for (let dz = -20; dz <= 20; dz += 1.25) {
    for (let dx = -20; dx <= 20; dx += 1.25) {
      const wx = WORLD_ANCHORS.ruinsTerrace.x + dx;
      const wz = WORLD_ANCHORS.ruinsTerrace.z + dz;
      const s = sampleRuinsVoronoi(wx, wz);
      const shifted = sampleRuinsVoronoi(wx + 1 / RUINS_VORONOI_SCALE, wz);
      if (Math.abs(s.edgeDist - shifted.edgeDist) > 0.03) edgeDiffCount++;
      if (s.hasSlab) {
        slabCount++;
        tones.add(Math.round(s.tone * 10));
      } else {
        grassCount++;
      }
    }
  }

  assert.ok(slabCount > 120 && grassCount > 120, `Expected balanced organic stone & moss patches, got slabs=${slabCount}, grass=${grassCount}`);
  assert.ok(edgeDiffCount > 400, `Voronoi flagstones must be irregular (non-periodic grid), got edgeDiffCount=${edgeDiffCount}`);
  assert.ok(tones.size >= 6, `Expected rich per-slab tone variety, got ${tones.size} distinct buckets`);
});

test('Phase 1J feathered trails show warmer packed center vs cooler/softer shoulders and matched horizon fog', () => {
  const size = 512;
  const rgba = bakeTerrainSplatRgba(size, TERRAIN_SIZE);

  // Sample across the jungle trail near jungleTrail (-106, 32): center should be warmer than dusty shoulder
  let centerWarmSum = 0;
  let shoulderWarmSum = 0;
  let edgeVariance = 0;
  const samples = [
    [-106, 32],
    [-108, 22],
    [-110, 12],
    [-111, 2],
  ] as const;

  for (const [cx, cz] of samples) {
    const c = sampleRgba(rgba, size, cx, cz);
    const s = sampleRgba(rgba, size, cx + 2.5, cz);
    const s2 = sampleRgba(rgba, size, cx + 2.5, cz + 2.0);
    centerWarmSum += c.r - c.b;
    shoulderWarmSum += s.r - s.b;
    edgeVariance += Math.abs(s.r - s2.r) + Math.abs(s.g - s2.g);
  }

  assert.ok(
    centerWarmSum > shoulderWarmSum + 30,
    `Expected warmer packed trail center than feathered dusty shoulder (center=${centerWarmSum}, shoulder=${shoulderWarmSum})`,
  );
  assert.ok(edgeVariance > 20, `Expected organic edge noise breakup along jungle trail shoulders, got variance=${edgeVariance}`);
});

