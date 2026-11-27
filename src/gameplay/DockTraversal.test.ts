import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DECK_TOP, DOCKS, onDockDeck } from '../config/docks';
import { TerrainPointerRaycaster } from '../engine/InputPointer';
import { createPlayerKinematics, stepPlayerKinematics } from './PlayerPhysics';

for (const dock of DOCKS) {
  const point = (along: number, across = 0) => ({
    x: dock.x + along * dock.sin + across * dock.cos,
    z: dock.z + along * dock.cos - across * dock.sin,
  });
  test('walk onto, jump on and return from dock at x=' + dock.x, () => {
    const start = point(-1.5);
    const k = createPlayerKinematics(start.x, start.z, dock.rotY);
    function walkTo(along: number) {
      const goal = point(along);
      for (let frame = 0; frame < 240; frame++) {
        const dx = goal.x - k.x, dz = goal.z - k.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.18) return;
        stepPlayerKinematics(k, { wishX: dx / distance, wishZ: dz / distance,
          jumpHeld: false, jumpJustPressed: false, dt: 1 / 60 });
        if (onDockDeck(k.x, k.z)) {
          assert.ok(k.y >= DECK_TOP - 0.003);
          assert.equal(k.inShallowWater, false);
        }
      }
      assert.fail('Could not reach ' + along);
    }
    walkTo(dock.end - 1);
    for (let i = 0; i < 45; i++) {
      stepPlayerKinematics(k, { wishX: 0, wishZ: 0, jumpHeld: false, jumpJustPressed: false, dt: 1 / 60 });
    }
    let peak = k.y;
    for (let frame = 0; frame < 150; frame++) {
      stepPlayerKinematics(k, { wishX: 0, wishZ: 0, jumpHeld: frame < 12,
        jumpJustPressed: frame === 0, dt: 1 / 60 });
      peak = Math.max(k.y, peak);
    }
    assert.ok(peak > DECK_TOP + 0.5);
    assert.ok(Math.abs(k.y - DECK_TOP) < 0.003);
    assert.equal(k.inShallowWater, false);
    walkTo(-1.5);
  });
  test('water-side approach cannot pop up onto dock at x=' + dock.x, () => {
    const start = point(dock.end - 0.6, 2.8);
    const k = createPlayerKinematics(start.x, start.z, dock.rotY);
    assert.ok(k.y < DECK_TOP - 0.35);
    for (let i = 0; i < 30; i++) {
      stepPlayerKinematics(k, { wishX: -dock.cos, wishZ: dock.sin, jumpJustPressed: false,
        jumpHeld: false, dt: 1 / 60 });
      assert.equal(onDockDeck(k.x, k.z), false);
    }
  });
  test('angled pointer ray chooses the visible dock at x=' + dock.x, () => {
    const at = point(dock.end / 2);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(at.x, 5, at.z + 5);
    camera.lookAt(at.x, DECK_TOP, at.z);
    camera.updateMatrixWorld(true);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial());
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.updateMatrixWorld(true);
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } as HTMLCanvasElement;
    const hit = new TerrainPointerRaycaster().pick(canvas, camera, floor, 50, 50);
    assert.ok(hit.hit && Math.hypot(hit.x - at.x, hit.z - at.z) < 0.001);
    floor.geometry.dispose();
    floor.material.dispose();
  });
}
