import assert from 'node:assert/strict';
import test from 'node:test';
import { getOceanWaveHeight, mapOceanGridCoord } from '../world/OceanSystem';
import { InteractionArbitrator } from './InteractionArbitrator';
import {
  migrateSave,
  SAVE_SCHEMA_VERSION,
  SaveManager,
  type KeyValueStorage,
} from './SaveManager';

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('InteractionArbitrator picks highest-priority facing-cone winner and ignores out-of-range/disabled items', () => {
  const arb = new InteractionArbitrator();
  let triggered = '';

  arb.register({
    id: 'far-egg',
    position: { x: 0, y: 0, z: 20 },
    radius: 3,
    priority: 10,
    icon: 'egg',
    canInteract: () => true,
    onInteract: () => {
      triggered = 'far-egg';
    },
  });
  arb.register({
    id: 'behind-lever',
    position: { x: 0, y: 0, z: -2 },
    radius: 4,
    priority: 10,
    icon: 'lever',
    canInteract: () => true,
    onInteract: () => {
      triggered = 'behind-lever';
    },
  });
  arb.register({
    id: 'front-low',
    position: { x: 0, y: 0, z: 2 },
    radius: 4,
    priority: 1,
    icon: 'barrel',
    canInteract: () => true,
    onInteract: () => {
      triggered = 'front-low';
    },
  });
  arb.register({
    id: 'front-high',
    position: { x: 0.4, y: 0, z: 2.5 },
    radius: 4,
    priority: 5,
    icon: 'egg',
    canInteract: () => true,
    onInteract: () => {
      triggered = 'front-high';
    },
  });

  // Facing +Z (yaw = 0)
  const winner = arb.triggerBest(0, 0, 0, 0);
  assert.equal(winner?.id, 'front-high');
  assert.equal(triggered, 'front-high');
});

test('SaveManager persists, migrates, and recovers cleanly from corrupt JSON', () => {
  const storage = createMemoryStorage();
  const sm = new SaveManager(storage);
  assert.equal(sm.getState().schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(sm.getState().lastAnchor, 'harborSpawn');

  sm.save({ muted: true, lastAnchor: 'skullCaveMouth' });
  sm.markBiomeDiscovered('skullCave');

  const smReloaded = new SaveManager(storage);
  assert.equal(smReloaded.getState().muted, true);
  assert.equal(smReloaded.getState().lastAnchor, 'skullCaveMouth');
  assert.ok(smReloaded.getState().discoveredBiomes.includes('skullCave'));

  storage.setItem('sonny_island_save_v1', '{broken-json');
  const smCorrupt = new SaveManager(storage);
  assert.equal(smCorrupt.getState().schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(smCorrupt.getState().lastAnchor, 'harborSpawn');

  const migrated = migrateSave({ discoveredBiomes: ['harbor', 'harbor', 'lagoon'] });
  assert.deepEqual(migrated.discoveredBiomes, ['harbor', 'lagoon']);
});

test('getOceanWaveHeight is deterministic and bounded within +-0.40m', () => {
  const h1 = getOceanWaveHeight(12.5, -34.2, 4.5);
  const h2 = getOceanWaveHeight(12.5, -34.2, 4.5);
  assert.equal(h1, h2);
  assert.ok(h1 >= -0.41 && h1 <= 0.41, `Wave height ${h1} out of expected bounds`);
});

test('mapOceanGridCoord gives crisp nearshore facet density and reaches horizon monotonically', () => {
  assert.equal(mapOceanGridCoord(0), 0);
  assert.ok(Math.abs(mapOceanGridCoord(1) - 1150) < 0.01);
  assert.ok(Math.abs(mapOceanGridCoord(-1) + 1150) < 0.01);
  let prev = -Infinity;
  for (let i = -20; i <= 20; i++) {
    const val = mapOceanGridCoord(i / 20);
    assert.ok(Number.isFinite(val) && val > prev, `Non-monotonic ocean coord at i=${i}`);
    prev = val;
  }
  const stepMeters = mapOceanGridCoord(2 / 140) - mapOceanGridCoord(0);
  assert.ok(stepMeters >= 2.2 && stepMeters <= 4.0, `Expected crisp ~3.8m nearshore step, got ${stepMeters}`);
});

test('ASSET_CATALOG reserves Phase 2+ family cast and Pirate Bed Ship slots with verified metadata', async () => {
  const { ASSET_CATALOG } = await import('../config/assets');
  assert.equal(ASSET_CATALOG['npc.amy'].packId, 'pirate');
  assert.equal(ASSET_CATALOG['npc.amy'].modelKey, 'Characters_Anne');
  assert.equal(ASSET_CATALOG['npc.amy'].scale, 1.0);
  assert.equal(ASSET_CATALOG['npc.amy'].yOffset, 0);
  assert.equal(ASSET_CATALOG['npc.amy'].reserved, true);
  assert.deepEqual(ASSET_CATALOG['npc.amy'].verifiedClips, ['Idle', 'Wave', 'Yes']);

  assert.equal(ASSET_CATALOG['npc.seahawk'].packId, 'pirate');
  assert.equal(ASSET_CATALOG['npc.seahawk'].reserved, true);
  assert.equal(ASSET_CATALOG['npc.artie'].packId, 'pirate');
  assert.equal(ASSET_CATALOG['npc.artie'].reserved, true);

  assert.equal(ASSET_CATALOG['hero.bedShip'].packId, 'custom-hero');
  assert.equal(ASSET_CATALOG['hero.bedShip'].reserved, true);
});

test('Phase 1F: applyStickDeadzone supports zero-GC out scratch vector and SelfTestRunner enforces budgets', async () => {
  const THREE = await import('three');
  const { applyStickDeadzone } = await import('./InputGamepad');
  const { auditSceneGraph, executeEngineSelfTest } = await import('./SelfTestRunner');
  const { TerrainQuery } = await import('../world/TerrainQuery');

  const scratch = { x: 99, y: 99 };
  const sameRef = applyStickDeadzone(0.05, 0.05, 0.15, scratch);
  assert.equal(sameRef, scratch);
  assert.deepEqual(scratch, { x: 0, y: 0 });
  applyStickDeadzone(0.575, 0, 0.15, scratch);
  assert.ok(Math.abs(scratch.x - 0.5) < 1e-6 && scratch.y === 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.PointLight(0xffaa33, 2, 10));
  const audit = auditSceneGraph(scene);
  assert.equal(audit.nanCount, 0);
  assert.equal(audit.pointLightCount, 1);

  const basePerf = { calls: 32, triangles: 120000, geometries: 25, textures: 4, fps: 60, isSoftwareGl: true };
  const report = executeEngineSelfTest({
    scene,
    terrain: new TerrainQuery(),
    renderFrame: () => {},
    getPerfStats: () => basePerf,
    resetCycle: () => ({ before: basePerf, after: basePerf }),
  });
  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 6);
  assert.ok(report.checks.every((c) => c.passed));

  const heavyPerf = { ...basePerf, triangles: 600000 };
  const heavyReport = executeEngineSelfTest({
    scene,
    terrain: new TerrainQuery(),
    renderFrame: () => {},
    getPerfStats: () => heavyPerf,
    resetCycle: () => ({ before: heavyPerf, after: heavyPerf }),
  });
  assert.equal(heavyReport.passed, false);
  assert.equal(heavyReport.checks.find((c) => c.name === 'trianglesBudget')?.passed, false);
});
