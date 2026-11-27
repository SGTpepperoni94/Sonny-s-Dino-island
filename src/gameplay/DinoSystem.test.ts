import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  DINO_ALL_ACTIONS,
  DINO_KIT_BASE_URL,
  DINO_SHOWCASE_SPAWNS,
  DINO_SPECIES_ORDER,
  DINO_SPECIES_SPECS,
} from '../config/dinoCatalog';
import {
  AssetManifestClient,
  parseDinoManifest,
  resolvePinnedManifestUrl,
} from '../engine/AssetManifestClient';
import type { DinoSpecies, EngineContext, GamePhase } from '../types/game';
import { TerrainQuery } from '../world/TerrainQuery';
import {
  HARBOR_TO_CAVE_TRAIL,
  JUNGLE_ROAD_POINTS,
  samplePolyline,
  VOLCANO_TRAIL_POINTS,
} from '../world/terrainTrails';
import {
  DINO_ANIM_THROTTLE_DIST,
  DINO_TITLE_CULL_DIST,
  DinoAnimator,
  findExactDinoClip,
  shouldCullDinoAtDistance,
  shouldUpdateDinoMixer,
} from './DinoAnimator';
import { applySunlitDinoMaterialLift, computeDinoUniformScale } from './DinoRigFactory';
import { DinoSystem } from './DinoSystem';

function buildMockManifestJson() {
  const heights: Record<DinoSpecies, number> = {
    TRex: 15.225, Triceratops: 9.433, Stegosaurus: 10.616,
    Velociraptor: 5.514, Apatosaurus: 11.678, Parasaurolophus: 5.979,
  };
  const models: Record<string, unknown> = {};
  for (const species of DINO_SPECIES_ORDER) {
    models[species] = {
      file: `models/${species}.glb`,
      height: heights[species],
      triangleCount: 1500,
      animations: DINO_ALL_ACTIONS.map((a) => `${species}_${a}`),
    };
  }
  return { scaling: 'native-quaternius', models };
}

function createFakeGltf(species: DinoSpecies): GLTF {
  const scene = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ name: 'Purple', color: new THREE.Color('#4c4954') });
  const eyeMat = new THREE.MeshStandardMaterial({ name: 'Black', color: new THREE.Color('#111111') });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat));
  const animations = DINO_ALL_ACTIONS.map(
    (action) =>
      new THREE.AnimationClip(`${species}_${action}`, 1.2, [
        new THREE.NumberKeyframeTrack('.position[y]', [0, 0.6, 1.2], [0, 0.1, 0]),
      ]),
  );
  return {
    scene, scenes: [scene], animations, cameras: [],
    asset: {}, parser: {} as GLTF['parser'], userData: {},
  };
}

test('resolvePinnedManifestUrl resolves relative paths against @v1.0.0 and rejects @main', () => {
  const resolved = resolvePinnedManifestUrl(DINO_KIT_BASE_URL, 'models/TRex.glb');
  assert.equal(resolved, `${DINO_KIT_BASE_URL}models/TRex.glb`);
  assert.ok(resolved.includes('@v1.0.0/'));
  assert.throws(() =>
    resolvePinnedManifestUrl('https://cdn.jsdelivr.net/gh/SGTpepperoni94/quaternius-dinosaur-kit@main/', 'models/TRex.glb'),
  );
  assert.throws(() => resolvePinnedManifestUrl(DINO_KIT_BASE_URL, '@main/models/TRex.glb'));
});

test('parseDinoManifest validates top-level models schema and all 6 species', () => {
  const manifest = parseDinoManifest(buildMockManifestJson(), DINO_KIT_BASE_URL);
  assert.equal(manifest.scaling, 'native-quaternius');
  for (const species of DINO_SPECIES_ORDER) {
    assert.equal(manifest.models[species].file, `models/${species}.glb`);
    assert.equal(manifest.models[species].url, `${DINO_KIT_BASE_URL}models/${species}.glb`);
    assert.ok(manifest.models[species].height > 0);
  }
  assert.throws(() => parseDinoManifest({ assets: {} }, DINO_KIT_BASE_URL));
});

test('AssetManifestClient deduplicates in-flight promises and evicts failed promises for retry', async () => {
  let manifestCalls = 0, glbCalls = 0, failNextManifest = true, failNextGlb = true;
  const client = new AssetManifestClient({
    fetchFn: (async () => {
      manifestCalls++;
      if (failNextManifest) { failNextManifest = false; throw new Error('simulated network blip'); }
      return { ok: true, status: 200, json: async () => buildMockManifestJson() } as unknown as Response;
    }) as typeof fetch,
    loadGltfFn: async () => {
      glbCalls++;
      await new Promise((r) => setTimeout(r, 10));
      if (failNextGlb) { failNextGlb = false; throw new Error('simulated glb failure'); }
      return createFakeGltf('TRex');
    },
  });

  await assert.rejects(() => client.loadManifest());
  const [m1, m2] = await Promise.all([client.loadManifest(), client.loadManifest()]);
  assert.equal(m1, m2);
  assert.equal(manifestCalls, 2);

  await assert.rejects(() => client.loadModel('TRex'));
  const [g1, g2] = await Promise.all([client.loadModel('TRex'), client.loadModel('TRex')]);
  assert.equal(g1, g2);
  assert.equal(glbCalls, 2);
  assert.equal(client.getCachedModel('TRex'), g1);
  assert.equal(g1.gltf.scene.userData.sharedResource, true);
  client.dispose();
});

test('All Phase 2B dino showcase spawns are flat-grounded, walkable, dry, non-lava, and clear of trails/footprints', () => {
  const terrain = new TerrainQuery();
  const represented = new Set<DinoSpecies>();
  assert.equal(DINO_SHOWCASE_SPAWNS.length, 9);

  for (const s of DINO_SHOWCASE_SPAWNS) {
    represented.add(s.species);
    const h = terrain.getTerrainHeight(s.x, s.z);
    const n = terrain.getTerrainNormal(s.x, s.z);
    const minNy = s.biome === 'volcano' ? 0.88 : 0.90;
    assert.ok(Number.isFinite(h) && h > 0.3, `${s.id} not on dry ground (h=${h})`);
    assert.ok(n.ny >= minNy, `${s.id} slope too steep (ny=${n.ny.toFixed(3)} < ${minNy})`);
    assert.equal(terrain.isWalkable(s.x, s.z), true, `${s.id} is not walkable`);
    assert.equal(terrain.isLavaHazard(s.x, s.z), false, `${s.id} overlaps lava hazard`);
    assert.equal(terrain.isFootprintReserved(s.x, s.z, s.clearance), false, `${s.id} breaches reserved footprint`);

    if (s.biome === 'jungle') {
      assert.ok(samplePolyline(s.x, s.z, JUNGLE_ROAD_POINTS).dist >= 4.5, `${s.id} blocks jungle trail`);
    } else if (s.biome === 'volcano') {
      assert.ok(samplePolyline(s.x, s.z, VOLCANO_TRAIL_POINTS).dist >= 3.6, `${s.id} blocks volcano trail`);
    } else if (s.biome === 'skullCave') {
      assert.ok(samplePolyline(s.x, s.z, HARBOR_TO_CAVE_TRAIL).dist >= 4.0, `${s.id} blocks skull-cave approach`);
    }
  }
  assert.equal(represented.size, 6, 'All 6 dinosaur species must be spawned across the island');
});

test('computeDinoUniformScale and exact-name clip lookup work for all 6 species and 6 actions', () => {
  const manifest = parseDinoManifest(buildMockManifestJson(), DINO_KIT_BASE_URL);
  for (const species of DINO_SPECIES_ORDER) {
    const spec = DINO_SPECIES_SPECS[species];
    const scale = computeDinoUniformScale(spec.targetHeightMeters, manifest.models[species].height);
    assert.ok(Math.abs(scale * manifest.models[species].height - spec.targetHeightMeters) < 1e-6);
    const fake = createFakeGltf(species);
    const decoy = new THREE.AnimationClip(`${species}_Idle_Broken`, 1, []);
    const clips = [decoy, ...fake.animations];
    for (const action of DINO_ALL_ACTIONS) {
      assert.equal(findExactDinoClip(clips, species, action)?.name, `${species}_${action}`);
    }
    assert.equal(findExactDinoClip([decoy], species, 'Idle'), null);
  }
});

test('applySunlitDinoMaterialLift lifts muted colors idempotently while keeping dark accents crisp', () => {
  const fake = createFakeGltf('Triceratops');
  const bodyMesh = fake.scene.children[0] as THREE.Mesh;
  const eyeMesh = fake.scene.children[1] as THREE.Mesh;
  const bodyMat = bodyMesh.material as THREE.MeshStandardMaterial;
  const eyeMat = eyeMesh.material as THREE.MeshStandardMaterial;
  const before = { h: 0, s: 0, l: 0 };
  const after1 = { h: 0, s: 0, l: 0 };
  bodyMat.color.getHSL(before, THREE.SRGBColorSpace);
  const eyeBeforeHex = eyeMat.color.getHex();

  applySunlitDinoMaterialLift(fake.scene);
  bodyMat.color.getHSL(after1, THREE.SRGBColorSpace);
  assert.ok(after1.l > before.l + 0.1, 'body lightness should lift for sunlit readability');
  assert.ok(after1.s > before.s + 0.1, 'body saturation should lift for tropical palette');
  assert.equal(bodyMat.roughness, 0.85);
  assert.equal(bodyMat.metalness, 0);
  assert.equal(bodyMat.userData.sharedResource, true);
  assert.equal(bodyMat.userData.sunlitLifted, true);
  assert.equal(eyeMat.color.getHex(), eyeBeforeHex, 'dark eye/claw accent must stay dark');

  // Calling a second time must be strictly idempotent (zero double-brightening)
  const hexAfterFirst = bodyMat.color.getHex();
  applySunlitDinoMaterialLift(fake.scene);
  assert.equal(bodyMat.color.getHex(), hexAfterFirst);
});

test('DinoAnimator switches clips cleanly and throttles mixers beyond 90m; Title distance culling hides far dinos >160m', async () => {
  const fake = createFakeGltf('TRex');
  const animator = new DinoAnimator('TRex', fake.scene, fake.animations, 'Idle', 0.3, 1.0);
  assert.equal(animator.playAction('Walk', 0.15), true);
  assert.equal(animator.playAction('Run', 0.15), true);
  assert.equal(animator.playAction('Idle', 0.15), true);
  const camPos = new THREE.Vector3(0, 10, 0);
  assert.equal(shouldUpdateDinoMixer(camPos, new THREE.Vector3(0, 10, DINO_ANIM_THROTTLE_DIST - 10), 5), true);
  assert.equal(shouldUpdateDinoMixer(camPos, new THREE.Vector3(0, 10, DINO_ANIM_THROTTLE_DIST + 25), 5), false);
  assert.equal(shouldCullDinoAtDistance(camPos, new THREE.Vector3(0, 10, DINO_TITLE_CULL_DIST - 5)), false);
  assert.equal(shouldCullDinoAtDistance(camPos, new THREE.Vector3(0, 10, DINO_TITLE_CULL_DIST + 5)), true);
  animator.dispose();

  // Verify DinoSystem aerial title distance culling & full restoration on playing
  const client = new AssetManifestClient({
    fetchFn: (async () => ({ ok: true, status: 200, json: async () => buildMockManifestJson() }) as unknown as Response) as typeof fetch,
    loadGltfFn: async (url) => createFakeGltf((url.split('/').pop() ?? 'TRex.glb').replace('.glb', '') as DinoSpecies),
  });
  await Promise.all(DINO_SPECIES_ORDER.map((sp) => client.loadModel(sp)));

  let phase: GamePhase = 'title';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.25, 1400);
  camera.position.set(-10.6, 27.5, 209.6);
  camera.updateMatrixWorld(true);

  const dinoSys = new DinoSystem(new TerrainQuery(), client);
  dinoSys.init({
    scene, camera, renderer: {} as THREE.WebGLRenderer, isSoftwareGl: true, elapsedTime: 0,
    getPhase: () => phase,
  } as EngineContext);

  assert.equal(dinoSys.getStats().loadedCount, 9);
  assert.equal(dinoSys.verifyShowcaseClips().ok, true);
  const showcase = scene.getObjectByName('DinoShowcase')!;
  const dinoGroups = showcase.children.filter((c) => c.name.startsWith('Dino_'));
  const hiddenDuringTitle = dinoGroups.filter((g) => !g.visible).length;
  assert.ok(hiddenDuringTitle >= 5, `expected far-side dinos culled in title (got ${hiddenDuringTitle})`);

  phase = 'playing';
  dinoSys.syncVisibilityForCamera();
  assert.equal(dinoGroups.every((g) => g.visible), true, 'all dinos must restore visibility in playing phase');
  dinoSys.dispose();
  client.dispose();
});
