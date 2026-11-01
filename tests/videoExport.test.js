import test from "node:test";
import assert from "node:assert/strict";
import { chooseRecordingFormat, getBeatAtTime } from "../src/engine/videoExport.js";

const beats = [
  { index: 0, durationSeconds: 8, caption: "Opening" },
  { index: 1, durationSeconds: 5, caption: "Event begins" },
  { index: 2, durationSeconds: 14, caption: "Aftermath" }
];

test("video format prefers native MP4 when the browser reports support", () => {
  class Recorder {
    static isTypeSupported(type) { return type.startsWith("video/mp4"); }
  }
  assert.deepEqual(chooseRecordingFormat(Recorder), {
    mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4"
  });
});

test("video format falls back to WebM without mislabelling the file", () => {
  class Recorder {
    static isTypeSupported(type) { return type.startsWith("video/webm;codecs=vp8"); }
  }
  assert.deepEqual(chooseRecordingFormat(Recorder), {
    mimeType: "video/webm;codecs=vp8", extension: "webm"
  });
});

test("unsupported video recording is reported instead of faking an export", () => {
  class Recorder {
    static isTypeSupported() { return false; }
  }
  assert.throws(() => chooseRecordingFormat(Recorder), /cannot encode MP4 or WebM/);
  assert.throws(() => chooseRecordingFormat(undefined), /does not provide MediaRecorder/);
});

test("caption timing follows storyboard beat boundaries exactly", () => {
  assert.equal(getBeatAtTime(beats, -2).index, 0);
  assert.equal(getBeatAtTime(beats, 7.99).index, 0);
  assert.equal(getBeatAtTime(beats, 8).index, 1);
  assert.equal(getBeatAtTime(beats, 12.99).index, 1);
  assert.equal(getBeatAtTime(beats, 13).index, 2);
  assert.equal(getBeatAtTime(beats, 90).index, 2);
  assert.equal(getBeatAtTime([], 0), null);
});
