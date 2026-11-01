import test from "node:test";
import assert from "node:assert/strict";
import {
  getBeatAtTime,
  getBeatWindow,
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
