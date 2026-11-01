import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { resolve } from "node:path";

test("production video export records a playable clip through recordCanvasVideo", { timeout: 90000 }, async () => {
  const server = await createServer({
    configFile: resolve("vite.config.js"),
    server: {
      host: "127.0.0.1",
      port: 4174,
      strictPort: true
    }
  });

  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-webgl"
      ]
    });

    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto("http://127.0.0.1:4174/voxel-what-if-studio/", {
      waitUntil: "networkidle"
    });
    assert.equal(response?.status(), 200, "Vite should serve the application test page");

    const result = await page.evaluate(async () => {
      const { recordCanvasVideo } = await import("/voxel-what-if-studio/src/engine/videoExport.js");
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = 320;
      sourceCanvas.height = 568;
      const sourceContext = sourceCanvas.getContext("2d");
      if (!sourceContext || typeof sourceCanvas.captureStream !== "function") {
        throw new Error("This Chromium build does not support canvas video capture.");
      }

      const drawSource = () => {
        const gradient = sourceContext.createLinearGradient(0, 0, sourceCanvas.width, sourceCanvas.height);
        gradient.addColorStop(0, "#12324a");
        gradient.addColorStop(1, "#d18a45");
        sourceContext.fillStyle = gradient;
        sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
        sourceContext.fillStyle = "#ffffff";
        sourceContext.font = "bold 24px Arial";
        sourceContext.fillText("VOXEL EXPORT TEST", 18, 42);
      };
      drawSource();

      const streams = [];
      class TrackingMediaRecorder extends MediaRecorder {
        constructor(stream, options) {
          super(stream, options);
          streams.push(stream);
        }
        static isTypeSupported(type) {
          return MediaRecorder.isTypeSupported(type);
        }
      }

      const beats = [
        { index: 0, durationSeconds: 0.45, caption: "OPENING FRAME" },
        { index: 1, durationSeconds: 0.5, caption: "SCENARIO EVENT" },
        { index: 2, durationSeconds: 0.55, caption: "RESOLUTION FRAME" }
      ];
      const durationSeconds = beats.reduce((sum, beat) => sum + beat.durationSeconds, 0);
      const visitedBeats = new Set();
      const times = [];
      const progress = [];
      const renderedCaptions = new Set();
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      const expectedCaptions = beats.map((beat) => beat.caption);
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (expectedCaptions.includes(String(text))) renderedCaptions.add(String(text));
        return originalFillText.call(this, text, ...args);
      };

      let blob;
      try {
        blob = await recordCanvasVideo({
          sourceCanvas,
          durationSeconds,
          beats,
          width: 320,
          height: 568,
          fps: 15,
          MediaRecorderClass: TrackingMediaRecorder,
          onTime: (elapsed, beat) => {
            times.push(elapsed);
            if (beat) visitedBeats.add(beat.index);
          },
          onProgress: (value) => progress.push(value)
        });
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }

      const blobUrl = URL.createObjectURL(blob);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = blobUrl;
      const metadata = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The exported video metadata did not load.")), 10000);
        video.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
          });
        };
        video.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("The browser could not decode the exported video."));
        };
      });
      URL.revokeObjectURL(blobUrl);

      return {
        size: blob.size,
        type: blob.type,
        durationSeconds,
        metadata,
        visitedBeats: [...visitedBeats].sort(),
        renderedCaptions: [...renderedCaptions].sort(),
        firstTime: times[0],
        lastTime: times.at(-1),
        finalProgress: progress.at(-1),
        allCaptureTracksStopped: streams.length > 0 && streams.every((stream) =>
          stream.getTracks().every((track) => track.readyState === "ended")
        ),
        recorderCount: streams.length
      };
    });

    assert.ok(result.size > 0, "the production exporter should produce non-empty video data");
    assert.match(result.type, /^video\/(webm|mp4)/, "the blob should have a real video MIME type");
    assert.ok(result.metadata.duration >= 1.1 && result.metadata.duration <= 2.2,
      "the encoded clip should be close to its requested duration");
    assert.equal(result.metadata.width, 320);
    assert.equal(result.metadata.height, 568);
    assert.deepEqual(result.visitedBeats, [0, 1, 2],
      "the export timeline should visit all caption beats in order");
    assert.deepEqual(result.renderedCaptions.sort(),
      ["OPENING FRAME", "RESOLUTION FRAME", "SCENARIO EVENT"],
      "the production compositor should draw every storyboard caption");
    assert.equal(result.firstTime, 0);
    assert.ok(result.lastTime >= result.durationSeconds - (1 / 15),
      "the final callback should reach the end of the requested timeline");
    assert.equal(result.finalProgress, 1);
    assert.equal(result.allCaptureTracksStopped, true,
      "probe and export capture tracks should be stopped after recording");
    assert.deepEqual(pageErrors, [], "the browser should not report uncaught page errors");
  } finally {
    await browser?.close();
    await server.close();
  }
});
