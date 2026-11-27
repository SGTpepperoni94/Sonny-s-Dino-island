import * as THREE from 'three';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import type { AnchorId, PerfStats, SelfTestCheck, SelfTestReport } from '../types/game';

export const DRAW_CALL_CEILING = 150;
export const TRIANGLE_CEILING = 550000;
export const POINT_LIGHT_CEILING = 6;

export interface TerrainWalkabilityProbe {
  getTerrainHeight(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
}

export interface DinoSelfTestProbe {
  verifyShowcaseClips: () => { ok: boolean; detail: string };
}

export interface SelfTestHarness {
  scene: THREE.Scene;
  terrain: TerrainWalkabilityProbe;
  renderFrame: () => void;
  getPerfStats: () => PerfStats;
  resetCycle: () => { before: PerfStats; after: PerfStats };
  dinoProbe?: DinoSelfTestProbe;
}

export function auditSceneGraph(scene: THREE.Scene): {
  nanCount: number;
  pointLightCount: number;
} {
  let nanCount = 0;
  let pointLightCount = 0;
  scene.traverse((obj) => {
    if (obj instanceof THREE.PointLight) {
      pointLightCount++;
    }
    if (
      !Number.isFinite(obj.position.x) ||
      !Number.isFinite(obj.position.y) ||
      !Number.isFinite(obj.position.z) ||
      !Number.isFinite(obj.scale.x) ||
      !Number.isFinite(obj.scale.y) ||
      !Number.isFinite(obj.scale.z)
    ) {
      nanCount++;
    }
  });
  return { nanCount, pointLightCount };
}

export function executeEngineSelfTest(harness: SelfTestHarness): SelfTestReport {
  harness.renderFrame();
  const perf = harness.getPerfStats();
  const checks: SelfTestCheck[] = [];

  // 1. Draw-call ceiling <= 150 & Phase 2 triangle ceiling <= 550,000
  checks.push({
    name: 'drawCallsBudget',
    passed: perf.calls <= DRAW_CALL_CEILING,
    detail: `${perf.calls} draw calls (ceiling ${DRAW_CALL_CEILING})`,
  });
  checks.push({
    name: 'trianglesBudget',
    passed: perf.triangles <= TRIANGLE_CEILING,
    detail: `${perf.triangles.toLocaleString()} tris (ceiling ${TRIANGLE_CEILING.toLocaleString()})`,
  });

  // 2. All 8 WORLD_ANCHORS have valid finite terrain heights & are walkable
  const anchorIds = Object.keys(WORLD_ANCHORS) as AnchorId[];
  const badAnchors: string[] = [];
  for (const id of anchorIds) {
    const a = WORLD_ANCHORS[id];
    const h = harness.terrain.getTerrainHeight(a.x, a.z);
    const ok = Number.isFinite(h) && harness.terrain.isWalkable(a.x, a.z);
    if (!ok) badAnchors.push(`${id}(h=${h.toFixed(2)})`);
  }
  checks.push({
    name: 'worldAnchorsValidAndWalkable',
    passed: badAnchors.length === 0,
    detail:
      badAnchors.length === 0
        ? `All ${anchorIds.length} anchors valid & walkable`
        : `Failed: ${badAnchors.join(', ')}`,
  });

  // 3. Zero NaN transforms & PointLight budget <= 6
  const { nanCount, pointLightCount } = auditSceneGraph(harness.scene);
  checks.push({
    name: 'zeroNanTransforms',
    passed: nanCount === 0,
    detail: `${nanCount} NaN transforms`,
  });
  checks.push({
    name: 'pointLightsBudget',
    passed: pointLightCount <= POINT_LIGHT_CEILING,
    detail: `${pointLightCount} PointLights (ceiling ${POINT_LIGHT_CEILING})`,
  });

  // 4. Phase 2B: Dinosaurs loaded from CDN & Idle/Walk/Run clips switch cleanly
  if (harness.dinoProbe) {
    const dinoRes = harness.dinoProbe.verifyShowcaseClips();
    checks.push({
      name: 'dinosLoadedAndAnimated',
      passed: dinoRes.ok,
      detail: dinoRes.detail,
    });
  }

  // 5. Zero geometry/texture leak growth across resetCycle & post-reset draw calls <= 150
  const cycle = harness.resetCycle();
  const geoGrowth = cycle.after.geometries - cycle.before.geometries;
  const texGrowth = cycle.after.textures - cycle.before.textures;
  const postCallsOk = cycle.after.calls <= DRAW_CALL_CEILING;
  checks.push({
    name: 'zeroLeakOnResetCycle',
    passed: geoGrowth <= 0 && texGrowth <= 0 && postCallsOk,
    detail: `geoDelta=${geoGrowth}, texDelta=${texGrowth}, postCalls=${cycle.after.calls}`,
  });

  const passed = checks.every((c) => c.passed);
  return { passed, checks, perf: cycle.after };
}
