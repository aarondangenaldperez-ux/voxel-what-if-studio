import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildVoxelPresenter } from "../src/engine/voxelPresenter.js";

test("voxel presenter builds a reusable articulated character with a readable face", () => {
  const scene = new THREE.Scene();
  const presenter = buildVoxelPresenter(scene, { position: [1, 0, 9], scale: 1.1 });
  let meshCount = 0;
  scene.traverse((object) => { if (object.isMesh) meshCount += 1; });

  assert.ok(meshCount >= 28, "presenter should contain separate editable voxel parts");
  assert.equal(presenter.root.name, "voxel-presenter");
  assert.equal(presenter.head.name, "head-pivot");
  assert.equal(presenter.mouth.name, "mouth");
  assert.equal(presenter.eyes.length, 2);
  assert.equal(presenter.arms.length, 2);
  assert.equal(presenter.legs.length, 2);
  assert.equal(presenter.root.position.x, 1);
  assert.equal(presenter.root.scale.x, 1.1);

  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((item) => item.dispose?.());
  });
});

test("voxel presenter reconstructs an identical face and gesture pose when seeking", () => {
  const scene = new THREE.Scene();
  const presenter = buildVoxelPresenter(scene);
  const idleMouth = presenter.mouth.scale.y;
  const snapshot = () => ({
    rootY: presenter.root.position.y,
    headRotation: presenter.head.rotation.toArray(),
    mouthScale: presenter.mouth.scale.toArray(),
    eyeScales: presenter.eyes.map((eye) => eye.scale.toArray()),
    browRotations: presenter.brows.map((brow) => brow.rotation.toArray()),
    armRotations: presenter.arms.map((arm) => arm.rotation.toArray()),
    forearmRotations: presenter.forearms.map((arm) => arm.rotation.toArray()),
    legRotations: presenter.legs.map((leg) => leg.rotation.toArray())
  });

  presenter.update({ elapsed: 1.4, beat: { mood: "shock" } });
  const firstPose = snapshot();
  assert.ok(presenter.mouth.scale.y > idleMouth);
  assert.notEqual(presenter.head.rotation.y, 0);
  assert.ok(presenter.arms.some((arm) => arm.rotation.z !== 0));
  assert.ok(presenter.brows.some((brow) => brow.rotation.z !== 0));

  presenter.update({ elapsed: 0, beat: { mood: "calm" } });
  assert.equal(presenter.mouth.scale.y, idleMouth);
  presenter.update({ elapsed: 1.4, beat: { mood: "shock" } });
  assert.deepEqual(snapshot(), firstPose, "the same timestamp and beat should reconstruct the same presenter pose");

  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((item) => item.dispose?.());
  });
});
