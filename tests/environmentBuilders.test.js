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
