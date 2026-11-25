import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import { MaterialLibrary } from '../engine/MaterialLibrary';
import {
  buildSkullRockPirateCave,
  SKULL_CAVE_FACE_ANGLE,
  SKULL_FLANK_PILLARS,
} from './SkullRockCaveBuilder';
import {
  SKULL_CAVE_ORIGIN_X,
  SKULL_CAVE_ORIGIN_Z,
  WATERFALL_ORIGIN_X,
  WATERFALL_ORIGIN_Z,
} from './terrainMath';
import {
  buildCrystalWaterfall,
  WATERFALL_CLIFF_PILLARS,
  WATERFALL_ROT_Y,
} from './WaterfallLagoonBuilder';
import { buildVolcanoDrama, computeVolcanoBasaltPlacements } from './VolcanoBuilder';
import { getVolcanoTrailSample } from './terrainMath';

test('SkullRockCaveBuilder, WaterfallLagoonBuilder & VolcanoBuilder respect PointLight budget, resource tracking & finite vertices', () => {
  const matLib = new MaterialLibrary();
  const presets = matLib.getPalettePresets();
  const root = new THREE.Group();
  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();
  const sharedPresetMats = new Set<THREE.Material>(Object.values(presets));
  const torchLights: THREE.PointLight[] = [];
  const timeUniform = { value: 0 };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    trackedGeos.add(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    trackedMats.add(m);
    return m;
  };

  buildSkullRockPirateCave(root, { presets, trackGeo, trackMat, timeUniform, torchLights });
  buildCrystalWaterfall(root, { presets, trackGeo, trackMat, timeUniform });
  buildVolcanoDrama(root, { basaltMat: presets.volcanoBasaltAo, timeUniform, trackGeo, trackMat });

  assert.ok(torchLights.length >= 1 && torchLights.length <= 3, `Skull Cave PointLights (${torchLights.length}) must be 1..3`);

  let pointLightCount = 0;
  let meshCount = 0;
  root.traverse((obj) => {
    if (obj instanceof THREE.PointLight) pointLightCount++;
    if (obj instanceof THREE.Mesh) {
      meshCount++;
      assert.ok(trackedGeos.has(obj.geometry), `Untracked geometry on mesh ${obj.name || 'unnamed'}`);
      const mat = obj.material as THREE.Material;
      assert.ok(
        trackedMats.has(mat) || sharedPresetMats.has(mat),
        `Untracked material on mesh ${obj.name || 'unnamed'}`,
      );
      const pos = obj.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)), 'Vertex must be finite');
      }
    }
  });

  assert.equal(pointLightCount, torchLights.length);
  assert.ok(pointLightCount <= 6, `Total landmark PointLights (${pointLightCount}) <= 6`);
  assert.ok(meshCount >= 23, `Rich composite landmark geometry expected, got ${meshCount} meshes`);

  for (const g of trackedGeos) g.dispose();
  for (const m of trackedMats) m.dispose();
  matLib.dispose();
});

test('Landmark cliff buttresses & volcano basalt borders never obstruct anchors or walkable trail centerlines', () => {
  const cosC = Math.cos(SKULL_CAVE_FACE_ANGLE);
  const sinC = Math.sin(SKULL_CAVE_FACE_ANGLE);
  const caveAnchors = [WORLD_ANCHORS.skullCaveMouth, WORLD_ANCHORS.skullCaveInterior];

  for (const [lx, lz, rTop, baseY] of SKULL_FLANK_PILLARS) {
    if (baseY >= 7.5) continue; // overhead headland crown mounds sit well above vaulted tunnel roof
    const wx = SKULL_CAVE_ORIGIN_X + lx * cosC + lz * sinC;
    const wz = SKULL_CAVE_ORIGIN_Z - lx * sinC + lz * cosC;
    const footRadius = rTop * 1.24;
    for (const a of caveAnchors) {
      const dist = Math.hypot(a.x - wx, a.z - wz);
      assert.ok(
        dist > footRadius + 1.5,
        `Skull cliff pillar at (${wx.toFixed(1)}, ${wz.toFixed(1)}) infringes ${a.id} (dist=${dist.toFixed(1)}, r=${footRadius.toFixed(1)})`,
      );
    }
  }

  const cosW = Math.cos(WATERFALL_ROT_Y);
  const sinW = Math.sin(WATERFALL_ROT_Y);
  const dock = WORLD_ANCHORS.lagoonDock;
  for (const [lx, lz, rTop] of WATERFALL_CLIFF_PILLARS) {
    const wx = WATERFALL_ORIGIN_X + lx * cosW + lz * sinW;
    const wz = WATERFALL_ORIGIN_Z - lx * sinW + lz * cosW;
    const dist = Math.hypot(dock.x - wx, dock.z - wz);
    assert.ok(
      dist > rTop * 1.25 + 4.0,
      `Waterfall cliff pillar at (${wx.toFixed(1)}, ${wz.toFixed(1)}) infringes lagoonDock (dist=${dist.toFixed(1)})`,
    );
  }

  const basaltBorders = computeVolcanoBasaltPlacements();
  assert.ok(basaltBorders.length >= 30, `Expected >= 30 jagged basalt volcano borders, got ${basaltBorders.length}`);
  const summit = WORLD_ANCHORS.volcanoSummit;
  for (const b of basaltBorders) {
    const trailDist = getVolcanoTrailSample(b.x, b.z).dist;
    assert.ok(trailDist >= 4.0, `Basalt border (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) too close to volcano trail (${trailDist.toFixed(2)}m)`);
    assert.ok(Math.hypot(b.x - summit.x, b.z - summit.z) >= 4.0, 'Basalt border must not obstruct volcanoSummit');
  }
});
