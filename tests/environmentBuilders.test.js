import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildEnvironment } from '../src/engine/environmentBuilders.js';

const ENVIRONMENTS = ['airport', 'school', 'ocean', 'space', 'factory', 'nature'];

for (const environment of ENVIRONMENTS) {
  test(`${environment} builder creates a populated 3D scene and updates its animation`, () => {
    const scene = new THREE.Scene();
    const built = buildEnvironment(scene, environment);
    let meshes = 0;
    scene.traverse((object) => {
      if (object.isMesh || object.isPoints) meshes += 1;
    });

    assert.ok(meshes >= 15, `${environment} should contain at least 15 rendered objects; found ${meshes}`);
    assert.ok(Array.isArray(built.cars));
    assert.ok(Array.isArray(built.pedestrians));
    assert.ok(Array.isArray(built.streetlights));
    assert.ok(Array.isArray(built.signalLights));
    assert.equal(typeof built.update, 'function');

    assert.doesNotThrow(() => built.update({
      elapsed: 4.5,
      playing: true,
      event: 'normal',
      scenario: { id: 'environment-test' },
      beat: { event: 'normal' }
    }));

    scene.traverse((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((item) => item.dispose?.());
    });
  });
}

test('factory production-stop event freezes conveyor crates and rollers, then resumes motion', () => {
  const scene = new THREE.Scene();
  const built = buildEnvironment(scene, 'factory');
  assert.equal(built.conveyorCrates.length, 5);
  assert.ok(built.conveyorRollers.length >= 8);
  assert.ok(built.robotArm);

  built.update({ elapsed: 4, playing: true, event: 'normal' });
  const positionsBeforeStop = built.conveyorCrates.map((crate) => crate.position.z);
  const rotationsBeforeStop = built.conveyorRollers.map((roller) => roller.rotation.z);

  built.update({ elapsed: 5, playing: true, event: 'production-stop' });
  const stoppedPositions = built.conveyorCrates.map((crate) => crate.position.z);
  const stoppedRotations = built.conveyorRollers.map((roller) => roller.rotation.z);
  assert.deepEqual(stoppedPositions, positionsBeforeStop);

  built.update({ elapsed: 12, playing: true, event: 'production-hold' });
  assert.deepEqual(built.conveyorCrates.map((crate) => crate.position.z), stoppedPositions);
  assert.deepEqual(built.conveyorRollers.map((roller) => roller.rotation.z), stoppedRotations);

  built.update({ elapsed: 16, playing: true, event: 'production-resume' });
  assert.notDeepEqual(
    built.conveyorCrates.map((crate) => crate.position.z),
    stoppedPositions
  );

  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((item) => item.dispose?.());
  });
});

test('ocean-loss removes the water surface and lowers marine life, then restores the scene', () => {
  const scene = new THREE.Scene();
  const built = buildEnvironment(scene, 'ocean');
  assert.equal(built.waterSurface.visible, true);
  assert.equal(built.fishList.length, 4);

  const startingHeights = built.fishList.map((fish) => fish.position.y);
  built.update({ elapsed: 8, playing: true, event: 'ocean-loss' });
  assert.equal(built.waterSurface.visible, false);
  assert.ok(built.fishList.every((fish, index) => fish.position.y < startingHeights[index]));

  for (let frame = 0; frame < 90; frame += 1) {
    built.update({ elapsed: 8.5 + frame / 30, playing: true, event: 'ocean-hold' });
  }
  assert.ok(built.fishList.every((fish) => fish.position.y < 1.5));

  built.update({ elapsed: 27, playing: true, event: 'ocean-return' });
  assert.equal(built.waterSurface.visible, true);
  for (let frame = 0; frame < 30; frame += 1) {
    built.update({ elapsed: 27.5 + frame / 30, playing: true, event: 'restored' });
  }
  assert.ok(built.fishList.every((fish) => fish.position.y > 1.5));

  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((item) => item.dispose?.());
  });
});
