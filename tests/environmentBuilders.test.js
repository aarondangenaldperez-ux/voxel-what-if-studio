import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildEnvironment } from '../src/engine/environmentBuilders.js';

const ENVIRONMENTS = ['airport', 'school', 'ocean', 'space', 'factory', 'nature'];

function snapshotPose(scene) {
  const pose = [];
  scene.traverse((object) => {
    if (!object.isObject3D) return;
    pose.push({
      id: object.uuid,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      visible: object.visible
    });
  });
  return pose;
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((item) => item.dispose?.());
  });
}

for (const environment of ENVIRONMENTS) {
  test(`${environment} builder creates a populated 3D scene and reconstructs the same timestamp`, () => {
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

    const updateAt = (elapsed) => built.update({
      elapsed,
      event: 'normal',
      scenario: { id: 'environment-test' },
      beat: { event: 'normal' },
      productionStopStartSeconds: 8,
      productionResumeStartSeconds: 27,
      oceanLossStartSeconds: 8,
      oceanReturnStartSeconds: 27
    });

    updateAt(0);
    const initialPose = snapshotPose(scene);
    assert.doesNotThrow(() => updateAt(9.25));
    const firstPose = snapshotPose(scene);
    updateAt(2.5);
    updateAt(31.75);
    updateAt(9.25);
    assert.deepEqual(snapshotPose(scene), firstPose, `${environment} should produce the same transforms for the same timestamp`);
    updateAt(0);
    assert.deepEqual(snapshotPose(scene), initialPose, `${environment} should preserve its original pose at time zero`);

    disposeScene(scene);
  });
}

test('factory conveyor freezes and resumes using timeline time, independent of prior render history', () => {
  const scene = new THREE.Scene();
  const built = buildEnvironment(scene, 'factory');
  const updateAt = (elapsed) => built.update({
    elapsed,
    productionStopStartSeconds: 8,
    productionResumeStartSeconds: 27
  });
  assert.equal(built.conveyorCrates.length, 5);
  assert.ok(built.conveyorRollers.length >= 8);
  assert.ok(built.robotArm);

  updateAt(8);
  const stoppedPositions = built.conveyorCrates.map((crate) => crate.position.z);
  const stoppedRotations = built.conveyorRollers.map((roller) => roller.rotation.z);
  updateAt(12);
  assert.deepEqual(built.conveyorCrates.map((crate) => crate.position.z), stoppedPositions);
  assert.deepEqual(built.conveyorRollers.map((roller) => roller.rotation.z), stoppedRotations);
  updateAt(27);
  assert.deepEqual(built.conveyorCrates.map((crate) => crate.position.z), stoppedPositions);
  assert.deepEqual(built.conveyorRollers.map((roller) => roller.rotation.z), stoppedRotations);

  updateAt(31);
  const resumedPositions = built.conveyorCrates.map((crate) => crate.position.z);
  updateAt(4);
  updateAt(31);
  assert.deepEqual(built.conveyorCrates.map((crate) => crate.position.z), resumedPositions);
  assert.notDeepEqual(resumedPositions, stoppedPositions);

  disposeScene(scene);
});

test('ocean loss and return are eased from absolute time and restore the underwater scene', () => {
  const scene = new THREE.Scene();
  const built = buildEnvironment(scene, 'ocean');
  const updateAt = (elapsed) => built.update({
    elapsed,
    oceanLossStartSeconds: 8,
    oceanReturnStartSeconds: 27
  });
  assert.equal(built.waterSurface.visible, true);
  assert.equal(built.fishList.length, 4);

  updateAt(9.1);
  assert.equal(built.waterSurface.visible, false);
  assert.ok(built.fishList.every((fish) => fish.position.y < 1.5));
  const vanishedPose = snapshotPose(scene);

  updateAt(3);
  updateAt(18);
  updateAt(9.1);
  assert.deepEqual(snapshotPose(scene), vanishedPose);

  updateAt(28.4);
  assert.equal(built.waterSurface.visible, true);
  assert.ok(built.waterSurface.material.opacity > 0.2);
  assert.ok(built.fishList.every((fish) => fish.position.y > 1.5));

  disposeScene(scene);
});
