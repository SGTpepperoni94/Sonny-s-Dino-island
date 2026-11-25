import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import { isLavaHazard, isPositionWalkable } from '../world/terrainMath';
import {
  applyStickDeadzone,
  createPlayerKinematics,
  stepPlayerKinematics,
} from './PlayerPhysics';

test('applyStickDeadzone zeroes values under 0.15 and rescales smoothly up to 1', () => {
  assert.deepEqual(applyStickDeadzone(0.08, -0.09, 0.15), { x: 0, y: 0 });
  const edge = applyStickDeadzone(1, 0, 0.15);
  assert.ok(Math.abs(edge.x - 1) < 1e-6);
  assert.ok(Math.abs(edge.y) < 1e-6);
});

test('Sonny runs smoothly from harborSpawn, jumps with squash-and-stretch, and lands safely', () => {
  const spawn = WORLD_ANCHORS.harborSpawn;
  const k = createPlayerKinematics(spawn.x, spawn.z, spawn.facingYaw);

  // Move north (-Z) for 1 second
  for (let i = 0; i < 60; i++) {
    stepPlayerKinematics(k, {
      wishX: 0,
      wishZ: -1,
      jumpJustPressed: false,
      jumpHeld: false,
      dt: 1 / 60,
    });
  }
  assert.ok(k.z < spawn.z - 5, `Expected Sonny to run north from z=${spawn.z}, got z=${k.z}`);
  assert.equal(k.grounded, true);

  // Trigger Jump and verify takeoff + eventual landing
  const takeOff = stepPlayerKinematics(k, {
    wishX: 0,
    wishZ: 0,
    jumpJustPressed: true,
    jumpHeld: true,
    dt: 1 / 60,
  });
  assert.equal(takeOff.jumped, true);
  assert.equal(k.grounded, false);
  assert.ok(k.squashY > 1.05, 'Takeoff applies stretch');

  let landed = false;
  for (let i = 0; i < 120; i++) {
    const ev = stepPlayerKinematics(k, {
      wishX: 0,
      wishZ: 0,
      jumpJustPressed: false,
      jumpHeld: false,
      dt: 1 / 60,
    });
    if (ev.landed) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.equal(k.grounded, true);
});

test('invisible guardrails keep Sonny out of deep ocean and volcano lava channel without getting stuck', () => {
  // 1. Push south into deep ocean from Pirate Harbor
  const spawn = WORLD_ANCHORS.harborSpawn;
  const kOcean = createPlayerKinematics(spawn.x, spawn.z, 0);
  for (let i = 0; i < 360; i++) {
    stepPlayerKinematics(kOcean, {
      wishX: 0,
      wishZ: 1,
      jumpJustPressed: false,
      jumpHeld: false,
      dt: 1 / 60,
    });
  }
  assert.equal(isPositionWalkable(kOcean.x, kOcean.z), true, 'Sonny must never enter deep ocean');
  assert.ok(Number.isFinite(kOcean.x) && Number.isFinite(kOcean.y) && Number.isFinite(kOcean.z));

  // 2. Push straight toward volcano lava gully from volcanoSummit
  const summ = WORLD_ANCHORS.volcanoSummit;
  const kVolc = createPlayerKinematics(summ.x, summ.z, summ.facingYaw);
  for (let i = 0; i < 240; i++) {
    stepPlayerKinematics(kVolc, {
      wishX: -0.8,
      wishZ: -0.6,
      jumpJustPressed: false,
      jumpHeld: false,
      dt: 1 / 60,
    });
  }
  assert.equal(isLavaHazard(kVolc.x, kVolc.z), false, 'Sonny must never fall into volcano lava');
  assert.equal(isPositionWalkable(kVolc.x, kVolc.z), true);
});

test('Phase 1F: matchAnimationClipName never confuses Idle with Jump_Idle and stepPlayerKinematics reuses scratch events', async () => {
  const { matchAnimationClipName, selectDesiredAnimState } = await import('./AnimationStateController');
  const clips = ['Jump_Idle', 'Jump', 'Walk', 'Run', 'Idle', 'Wave', 'Jump_Land'];
  assert.equal(matchAnimationClipName(clips, 'Idle'), 4);
  assert.equal(matchAnimationClipName(['Jump_Idle', 'Walk'], 'Idle'), -1);
  assert.equal(matchAnimationClipName(clips, 'Jump_Idle'), 0);

  const spawn = WORLD_ANCHORS.harborSpawn;
  const k = createPlayerKinematics(spawn.x, spawn.z, spawn.facingYaw);
  assert.equal(selectDesiredAnimState(k, 0, 0), 'Idle');
  assert.equal(selectDesiredAnimState(k, 0.5, 0), 'Wave');

  const scratchEvents = { jumped: true, landed: true, splashed: true };
  const returned = stepPlayerKinematics(
    k,
    { wishX: 0, wishZ: 0, jumpJustPressed: false, jumpHeld: false, dt: 1 / 60 },
    scratchEvents,
  );
  assert.equal(returned, scratchEvents);
  assert.equal(scratchEvents.jumped, false);
});
