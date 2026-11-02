import test from "node:test";
import assert from "node:assert/strict";
import { buildScenarioPlan } from "../src/engine/scenarioEngine.js";
import { getCinematicCameraPose } from "../src/engine/cameraDirector.js";

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test("rubber scenario camera frames the affected vehicle instead of a nearby building wall", () => {
  const scenario = buildScenarioPlan("What if all rubber disappeared for 5 seconds?");
  const event = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 10, scenarioId: scenario.id
  });
  const detail = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 16, scenarioId: scenario.id
  });

  assert.equal(event.shot, "event");
  assert.equal(detail.shot, "detail");
  assert.ok(distance(detail.position, detail.target) > 6.5,
    "detail shot must keep enough distance to show the vehicle, not crop into a wall");
  assert.ok(distance(detail.position, detail.target) < 9,
    "detail shot should still read as a deliberate vehicle close-up");
  assert.ok(Math.abs(detail.target[0] - 1.55) < 0.3);
  assert.ok(Math.abs(detail.target[2] - 5.86) < 0.3);
});

test("long rubber beats contain authored camera movement instead of static holds", () => {
  const scenario = buildScenarioPlan("What if all rubber disappeared for 5 seconds?");
  const first = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 15, scenarioId: scenario.id
  });
  const later = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 18, scenarioId: scenario.id
  });
  const movement = distance(first.position, later.position) +
    distance(first.target, later.target);
  assert.ok(movement > 0.15, "the camera should move during a long beat");
});

test("camera motion is continuous across adjacent storyboard beat boundaries", () => {
  const scenario = buildScenarioPlan("What if all rubber disappeared for 5 seconds?");
  const before = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 19.999, scenarioId: scenario.id
  });
  const after = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 20, scenarioId: scenario.id
  });
  assert.ok(distance(before.position, after.position) < 0.02,
    "camera position must not jump when the next shot begins");
  assert.ok(distance(before.target, after.target) < 0.02,
    "camera aim must not jump when the next shot begins");
});

test("rubber story has a wide traffic-jam overview and a resolved closing shot", () => {
  const scenario = buildScenarioPlan("What if all rubber disappeared for 5 seconds?");
  const overview = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 30, scenarioId: scenario.id
  });
  const closing = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 52, scenarioId: scenario.id
  });
  assert.equal(overview.shot, "overview");
  assert.ok(distance(overview.position, overview.target) > 45);
  assert.equal(closing.shot, "resolve");
  assert.ok(closing.position.every(Number.isFinite));
  assert.ok(closing.target.every(Number.isFinite));
});

test("other mapped environments keep a valid default camera path", () => {
  const scenario = buildScenarioPlan("What if gravity vanished temporarily?");
  const pose = getCinematicCameraPose({
    beats: scenario.beats, elapsedSeconds: 10, scenarioId: scenario.id
  });
  assert.equal(pose.shot, "event");
  assert.ok(pose.position.every(Number.isFinite));
  assert.ok(pose.target.every(Number.isFinite));
  assert.ok(distance(pose.position, pose.target) > 10);
});
