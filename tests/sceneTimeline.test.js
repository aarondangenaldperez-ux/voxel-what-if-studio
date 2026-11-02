import test from "node:test";
import assert from "node:assert/strict";
import {
  getBeatAtTime,
  getBeatWindow,
  getCityActorPoseAtTime,
  getEventEnvelope,
  getMotionTime,
  getTimelinePosition
} from "../src/engine/sceneTimeline.js";

const beats = [
  { event: "normal", durationSeconds: 8 },
  { event: "production-stop", durationSeconds: 5 },
  { event: "production-hold", durationSeconds: 14 },
  { event: "production-resume", durationSeconds: 21 },
  { event: "restored", durationSeconds: 8 }
];

test("timeline selection uses stable beat boundaries and returns beat-local time", () => {
  assert.equal(getBeatAtTime(beats, -2), beats[0]);
  assert.equal(getTimelinePosition(beats, 8).beat, beats[1]);
  assert.deepEqual(getTimelinePosition(beats, 10), {
    beat: beats[1], index: 1, startSeconds: 8, endSeconds: 13, elapsedInBeat: 2, progress: 0.4
  });
  assert.equal(getTimelinePosition(beats, 56).beat, beats[4]);
  assert.equal(getBeatAtTime([], 4), null);
});

test("beat windows expose exact absolute start and end times", () => {
  assert.deepEqual(getBeatWindow(beats, "production-stop"), {
    index: 1, startSeconds: 8, endSeconds: 13, durationSeconds: 5
  });
  assert.equal(getBeatWindow(beats, "missing"), null);
});

test("scene time and event envelopes are independent of the order timestamps are visited", () => {
  const timestamps = [0, 8, 8.1, 9, 12.9, 13, 27, 55, 4, 8.1, 27];
  const firstPass = timestamps.map((time) => ({
    position: getTimelinePosition(beats, time),
    envelope: getEventEnvelope(time, 8, 13, 0.5)
  }));
  const secondPass = [...timestamps].reverse().map((time) => ({
    position: getTimelinePosition(beats, time),
    envelope: getEventEnvelope(time, 8, 13, 0.5)
  })).reverse();
  assert.deepEqual(secondPass, firstPass);
  assert.equal(getEventEnvelope(8, 8, 13, 0.5), 0);
  assert.equal(getEventEnvelope(8.5, 8, 13, 0.5), 1);
  assert.equal(getEventEnvelope(13, 8, 13, 0.5), 0);
});

test("paused motion preserves phase through the configured interruption window", () => {
  assert.equal(getMotionTime(4, 8, 27), 4);
  assert.equal(getMotionTime(8, 8, 27), 8);
  assert.equal(getMotionTime(12.5, 8, 27), 8);
  assert.equal(getMotionTime(27, 8, 27), 8);
  assert.equal(getMotionTime(31, 8, 27), 12);
  assert.equal(getMotionTime(31, null, null), 31);
});

const rubberBeats = [
  { event: "normal", durationSeconds: 8 },
  { event: "rubber-loss", durationSeconds: 5 },
  { event: "traffic-paused", durationSeconds: 14 },
  { event: "recovery", durationSeconds: 21 },
  { event: "restored", durationSeconds: 8 }
];

const gravityBeats = [
  { event: "normal", durationSeconds: 8 },
  { event: "gravity-loss", durationSeconds: 5 },
  { event: "gravity-return", durationSeconds: 14 },
  { event: "aftermath", durationSeconds: 21 },
  { event: "restored", durationSeconds: 8 }
];

const electricityBeats = [
  { event: "normal", durationSeconds: 8 },
  { event: "power-loss", durationSeconds: 5 },
  { event: "blackout", durationSeconds: 14 },
  { event: "countdown", durationSeconds: 21 },
  { event: "restored", durationSeconds: 8 }
];

test("city actors retain the authored neutral pose at timeline zero", () => {
  const pose = getCityActorPoseAtTime({
    elapsedSeconds: 0,
    scenarioId: "rubber",
    beats: rubberBeats,
    actorIndex: 1
  });
  assert.equal(pose.wheelScale, 1);
  assert.equal(pose.carTravelDistance, 0);
  assert.equal(pose.carWheelRotation, 0);
  assert.equal(pose.pedestrianArmRotationX[0], 0);
  assert.equal(pose.pedestrianArmRotationX[1], 0);
});

test("city scenario poses are reconstructed from time rather than previous transforms", () => {
  const atTen = getCityActorPoseAtTime({
    elapsedSeconds: 10,
    scenarioId: "rubber",
    beats: rubberBeats,
    actorIndex: 1
  });
  getCityActorPoseAtTime({ elapsedSeconds: 3, scenarioId: "rubber", beats: rubberBeats, actorIndex: 1 });
  getCityActorPoseAtTime({ elapsedSeconds: 31, scenarioId: "rubber", beats: rubberBeats, actorIndex: 1 });
  assert.deepEqual(getCityActorPoseAtTime({
    elapsedSeconds: 10,
    scenarioId: "rubber",
    beats: rubberBeats,
    actorIndex: 1
  }), atTen);
  assert.ok(atTen.wheelScale < 0.01, "rubber should be almost fully absent during the center of the event");

  const pausedCar = getCityActorPoseAtTime({
    elapsedSeconds: 18,
    scenarioId: "rubber",
    beats: rubberBeats,
    actorIndex: 0
  });
  const atPauseStart = getCityActorPoseAtTime({
    elapsedSeconds: 8,
    scenarioId: "rubber",
    beats: rubberBeats,
    actorIndex: 0
  });
  assert.equal(pausedCar.carTravelDistance, atPauseStart.carTravelDistance);
  assert.equal(pausedCar.carWheelRotation, atPauseStart.carWheelRotation);
  assert.ok(Math.abs(getCityActorPoseAtTime({ elapsedSeconds: 4, scenarioId: 'rubber', beats: rubberBeats, actorIndex: 0 }).carTravelDistance) > 1,
    'vehicles should travel a visible distance before the interruption');
  assert.ok(Math.abs(pausedCar.pedestrianArmRotationX[0]) > 0.3,
    'pedestrians should visibly react while traffic is stranded');

  const gravity = getCityActorPoseAtTime({
    elapsedSeconds: 10,
    scenarioId: "gravity",
    beats: gravityBeats,
    actorIndex: 0
  });
  assert.ok(gravity.carPositionY > 0.9);
  assert.ok(gravity.pedestrianPositionY > 0.9);

  const blackout = getCityActorPoseAtTime({
    elapsedSeconds: 20,
    scenarioId: "electricity",
    beats: electricityBeats,
    actorIndex: 0
  });
  const restored = getCityActorPoseAtTime({
    elapsedSeconds: 50,
    scenarioId: "electricity",
    beats: electricityBeats,
    actorIndex: 0
  });
  assert.equal(blackout.powerIntensity, 1);
  assert.equal(restored.powerIntensity, 0);
});
