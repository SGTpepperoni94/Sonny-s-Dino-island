import assert from 'node:assert/strict';
import test from 'node:test';
import { ISLAND_WORLD_RADIUS, WORLD_ANCHORS } from '../config/worldAnchors';
import type { AnchorId } from '../types/game';
import {
  classifyBiomeAt,
  computeTerrainHeight,
  computeTerrainNormal,
  isInShallowWater,
  isLavaHazard,
  isPositionWalkable,
  VOLCANO_CENTER_X,
  VOLCANO_CENTER_Z,
  VOLCANO_CRATER_LAVA_Y,
} from './terrainMath';
import { TERRAIN_SIZE } from './terrainSplatBaker';
import { TerrainQuery } from './TerrainQuery';

test('Phase 1B real-scale expansion: ~400m island envelope & character-relative biome spacing', () => {
  assert.ok(ISLAND_WORLD_RADIUS >= 200 && ISLAND_WORLD_RADIUS <= 210, `Radius ${ISLAND_WORLD_RADIUS} in 200..210m`);
  assert.ok(TERRAIN_SIZE >= 430 && TERRAIN_SIZE <= 445, `TERRAIN_SIZE ${TERRAIN_SIZE} in 430..445m`);

  const dist = (a: AnchorId, b: AnchorId) =>
    Math.hypot(WORLD_ANCHORS[a].x - WORLD_ANCHORS[b].x, WORLD_ANCHORS[a].z - WORLD_ANCHORS[b].z);

  const harborToRanch = dist('harborSpawn', 'ranchCenter');
  assert.ok(
    harborToRanch >= 35 && harborToRanch <= 45,
    `harborSpawn -> ranchCenter (${harborToRanch.toFixed(1)}m) must be 35..45m`,
  );

  const biomePairs: ReadonlyArray<readonly [AnchorId, AnchorId]> = [
    ['ranchCenter', 'jungleTrail'],
    ['jungleTrail', 'ruinsTerrace'],
    ['ranchCenter', 'lagoonDock'],
    ['skullCaveMouth', 'lagoonDock'],
    ['lagoonDock', 'volcanoSummit'],
  ];
  for (const [a, b] of biomePairs) {
    const d = dist(a, b);
    assert.ok(d >= 95 && d <= 130, `${a} -> ${b} (${d.toFixed(1)}m) must be 95..130m`);
  }
});

test('all 8 WORLD_ANCHORS have finite heights, are walkable, and match expected biomes', () => {
  const anchorIds = Object.keys(WORLD_ANCHORS) as AnchorId[];
  assert.equal(anchorIds.length, 8);

  for (const id of anchorIds) {
    const a = WORLD_ANCHORS[id];
    const h = computeTerrainHeight(a.x, a.z);
    assert.ok(Number.isFinite(h), `${id} height must be finite`);
    assert.equal(
      isPositionWalkable(a.x, a.z),
      true,
      `${id} at (${a.x}, ${a.z}) h=${h.toFixed(2)} must be walkable`,
    );
    assert.equal(
      isLavaHazard(a.x, a.z),
      false,
      `${id} must not overlap volcano lava hazard`,
    );
    assert.equal(
      classifyBiomeAt(a.x, a.z),
      a.biome,
      `${id} biome should classify as ${a.biome}`,
    );
  }
});

test('volcano crater and recessed lava channel are flagged as non-walkable hazards', () => {
  assert.equal(isLavaHazard(VOLCANO_CENTER_X, VOLCANO_CENTER_Z), true);
  assert.equal(isPositionWalkable(VOLCANO_CENTER_X, VOLCANO_CENTER_Z), false);
  // Mid-channel lava point
  assert.equal(isLavaHazard(51, -66), true);
  assert.equal(isPositionWalkable(51, -66), false);
  // Safe ridge trail anchor overlooking lava must stay walkable
  const summ = WORLD_ANCHORS.volcanoSummit;
  assert.equal(isLavaHazard(summ.x, summ.z), false);
  assert.equal(isPositionWalkable(summ.x, summ.z), true);
});

test('deep ocean is blocked by guardrail while shallow beach water is splashable & walkable', () => {
  assert.equal(isPositionWalkable(0, 215), false);
  assert.equal(isPositionWalkable(-212, 0), false);

  // Sample south beach slope from spawn toward bay water to verify shallow splashable band exists
  const spawn = WORLD_ANCHORS.harborSpawn;
  let foundShallowWalkable = false;
  for (let z = spawn.z; z <= spawn.z + 40; z += 0.5) {
    if (isInShallowWater(spawn.x, z) && isPositionWalkable(spawn.x, z)) {
      foundShallowWalkable = true;
      break;
    }
  }
  assert.equal(foundShallowWalkable, true, 'Pirate Harbor should have a walkable shallow splash zone');
});

test('Skull Rock Cave has both walkable cobblestone ledge and shallow turquoise inlet channel', () => {
  const mouth = WORLD_ANCHORS.skullCaveMouth;
  const interior = WORLD_ANCHORS.skullCaveInterior;
  assert.equal(isPositionWalkable(mouth.x, mouth.z), true);
  assert.equal(isPositionWalkable(interior.x, interior.z), true);
  const mouthH = computeTerrainHeight(mouth.x, mouth.z);
  assert.ok(mouthH > 0.2 && mouthH < 2.0, `Cave mouth approach ledge should sit low & walkable, got ${mouthH.toFixed(2)}`);
  assert.ok(computeTerrainHeight(interior.x, interior.z) > 0.2, 'Cave walkable ledge stays above water');

  // Offset SE across the cave width from the cobblestone ledge into the right-side water inlet channel
  const inletX = interior.x + 4.2;
  const inletZ = interior.z + 2.8;
  const inletH = computeTerrainHeight(inletX, inletZ);
  assert.ok(inletH < 0.05 && inletH >= -1.15, `Cave inlet should be shallow water, got ${inletH}`);
});

test('TerrainQuery reserved footprint registry and normals behave deterministically', () => {
  const tq = new TerrainQuery();
  const spawn = WORLD_ANCHORS.harborSpawn;
  const n = computeTerrainNormal(spawn.x, spawn.z);
  const len = Math.hypot(n.nx, n.ny, n.nz);
  assert.ok(Math.abs(len - 1) < 1e-5, 'Normal must be unit length');
  assert.ok(n.ny > 0.9, 'Spawn clearing should be gently sloped / flat');

  assert.equal(tq.isFootprintReserved(spawn.x, spawn.z), true);
  // Build 2+ family hubs & connecting sightline stay cleanly reserved and flat
  assert.equal(tq.isFootprintReserved(8, 117), true); // harborSpawn Bed Ship / Seahawk / Artie hub
  assert.equal(tq.isFootprintReserved(-2, 102), true); // harbor -> ranch dirt-path sightline
  assert.equal(tq.isFootprintReserved(2, 88), true); // ranchCenter Mum (Amy) welcome pad
  assert.ok(computeTerrainNormal(8, 117).ny > 0.95, 'Harbor Bed Ship hub pad must be flat');
  assert.ok(computeTerrainNormal(2, 88).ny > 0.95, 'Ranch Amy hub pad must be flat');

  tq.reserveFootprint({ id: 'test-pad', x: -30, z: 30, radius: 5 });
  assert.equal(tq.isFootprintReserved(-28, 30), true);
  assert.equal(tq.isFootprintReserved(-60, 30), false);
});

test('Phase 1B topography: ~70-85m far-NE volcano crater rim contains lava pool and recessed canyon sits below ridge trail', () => {
  const bowlH = computeTerrainHeight(VOLCANO_CENTER_X, VOLCANO_CENTER_Z);
  assert.ok(
    bowlH < VOLCANO_CRATER_LAVA_Y - 2.0,
    `Crater bowl floor (${bowlH.toFixed(2)}) must sit below crater lava pool (${VOLCANO_CRATER_LAVA_Y})`,
  );

  let maxRimH = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rimH = computeTerrainHeight(
      VOLCANO_CENTER_X + Math.cos(a) * 20.0,
      VOLCANO_CENTER_Z + Math.sin(a) * 20.0,
    );
    maxRimH = Math.max(maxRimH, rimH);
    assert.ok(
      rimH >= 70.0 && rimH <= 85.0,
      `Crater rim at ${i * 45}deg (${rimH.toFixed(2)}m) must sit in 70..85m target height`,
    );
  }
  assert.ok(maxRimH >= 74.0 && maxRimH <= 85.0, `Peak volcano rim (${maxRimH.toFixed(2)}m) in 74..85m`);

  const summ = WORLD_ANCHORS.volcanoSummit;
  const ridgeH = computeTerrainHeight(summ.x, summ.z);
  const canyonH = computeTerrainHeight(51.0, -66.0);
  assert.ok(
    ridgeH - canyonH >= 7.0,
    `Lava canyon (${canyonH.toFixed(2)}) must be deeply recessed below ridge trail (${ridgeH.toFixed(2)})`,
  );
  assert.equal(isPositionWalkable(79, -71), true, 'Upper volcano trail lookout must stay walkable');
});

test('Phase 1B topography: harbor headlands, jungle road embankments, and 4-tier Dino Ruins terraces hold shape', () => {
  // Harbor framing headlands rise prominently while keeping family hub flat
  assert.ok(computeTerrainHeight(-76, 124) >= 15.0, 'West coastal headland should rise >= 15m');
  assert.ok(computeTerrainHeight(46, 118) >= 11.0, 'East harbor bluff should rise >= 11m');
  assert.ok(computeTerrainNormal(8, 117).ny > 0.95, 'Harbor family hub remains flat');

  // Fern Jungle recessed road stays walkable while flanked by raised earthen banks
  const roadH = computeTerrainHeight(-50, 62);
  const bankH = computeTerrainHeight(-57, 67);
  assert.equal(isPositionWalkable(-50, 62), true);
  assert.ok(bankH - roadH >= 1.5, `Jungle road embankment (${bankH.toFixed(2)} vs ${roadH.toFixed(2)})`);

  // Ancient Dino Ruins 4 distinct flat stepped terraces (Tier 1..4)
  const t4 = computeTerrainHeight(-94, -88);
  const t3 = computeTerrainHeight(-73, -88);
  const t2 = computeTerrainHeight(-60, -88);
  const t1 = computeTerrainHeight(-48, -88);
  assert.ok(t4 > t3 + 3.5 && t3 > t2 + 3.5 && t2 > t1 + 3.5, 'Ruins should step down across 4 distinct tiers');
  assert.ok(computeTerrainNormal(-94, -88).ny > 0.92, 'Top Ruins terrace must be flat & walkable');
  assert.ok(computeTerrainNormal(-60, -88).ny > 0.92, 'Mid Ruins terrace must be flat & walkable');
});

test('Phase 1H chiseled cliffs & volcano basalt ribs preserve smooth walkability along all trails', async () => {
  const { MAIN_TRAIL, HARBOR_TO_RANCH_TRAIL, VOLCANO_TRAIL_POINTS, RANCH_TO_LAGOON_TRAIL } = await import('./terrainMath');
  // 1. Volcano basalt ribs show strong angular ridge-to-trough relief around mid-cone (r=48m)
  let minRib = Infinity;
  let maxRib = -Infinity;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const px = VOLCANO_CENTER_X + Math.cos(a) * 48;
    const pz = VOLCANO_CENTER_Z + Math.sin(a) * 48;
    if (isLavaHazard(px, pz)) continue;
    const h = computeTerrainHeight(px, pz);
    minRib = Math.min(minRib, h);
    maxRib = Math.max(maxRib, h);
  }
  assert.ok(maxRib - minRib >= 7.0, `Volcano basalt ribs should show >= 7m relief, got ${(maxRib - minRib).toFixed(2)}m`);

  // 2. Harbor west headland has steep chiseled cliff flanks (ny < 0.72) while flat family hub stays ny > 0.95
  let minCliffNy = 1;
  for (let x = -112; x <= -42; x += 3) {
    minCliffNy = Math.min(minCliffNy, computeTerrainNormal(x, 124).ny);
  }
  assert.ok(minCliffNy < 0.72, `West coastal cliff should have steep chiseled face (ny < 0.72), got ${minCliffNy.toFixed(3)}`);

  // 3. All primary island trails stay walkable along waypoints and midpoints
  const { HARBOR_TO_CAVE_TRAIL, SKULL_CAVE_ORIGIN_X, SKULL_CAVE_ORIGIN_Z } = await import('./terrainMath');
  for (const trail of [MAIN_TRAIL, HARBOR_TO_RANCH_TRAIL, HARBOR_TO_CAVE_TRAIL, VOLCANO_TRAIL_POINTS, RANCH_TO_LAGOON_TRAIL]) {
    for (let i = 0; i < trail.length; i++) {
      const [x, z] = trail[i];
      assert.equal(isPositionWalkable(x, z), true, `Trail point (${x}, ${z}) must stay walkable`);
      if (i + 1 < trail.length) {
        const mx = (x + trail[i + 1][0]) * 0.5;
        const mz = (z + trail[i + 1][1]) * 0.5;
        assert.equal(isPositionWalkable(mx, mz), true, `Trail midpoint (${mx.toFixed(1)}, ${mz.toFixed(1)}) must stay walkable`);
      }
    }
  }

  // 4. Phase 1I: Skull Cave left beach approach has zero sand/grass spike and right inlet stays open below water
  for (const along of [-24, -18, -12, -6]) {
    const lx = SKULL_CAVE_ORIGIN_X + along * 0.56 - 4.0 * 0.8285;
    const lz = SKULL_CAVE_ORIGIN_Z + along * -0.8285 - 4.0 * 0.56;
    const lh = computeTerrainHeight(lx, lz);
    assert.ok(lh >= 0.65 && lh <= 1.45, `Skull Cave approach at along=${along} must be smooth sand (0.65..1.45m), got ${lh.toFixed(2)}m`);
    const rx = SKULL_CAVE_ORIGIN_X + along * 0.56 + 3.2 * 0.8285;
    const rz = SKULL_CAVE_ORIGIN_Z + along * -0.8285 + 3.2 * 0.56;
    const rh = computeTerrainHeight(rx, rz);
    assert.ok(rh < -0.25, `Skull Cave right inlet at along=${along} must stay open below water, got ${rh.toFixed(2)}m`);
  }
});
