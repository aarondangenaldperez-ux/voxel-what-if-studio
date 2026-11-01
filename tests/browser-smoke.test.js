import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";

test("production app renders WebGL, switches environments, and exports a storyboard", async () => {
  const server = await preview({
    configFile: resolve("vite.config.js"),
    preview: { host: "127.0.0.1", port: 4173, strictPort: true }
  });
  let browser;
  let downloadDirectory;
  const pageErrors = [];

  try {
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
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("http://127.0.0.1:4173/voxel-what-if-studio/", {
      waitUntil: "networkidle"
    });
    assert.equal(response?.status(), 200, "production entry page should load");
    const canvas = page.locator(".world-view canvas");
    await canvas.waitFor({ state: "visible", timeout: 20000 });

    const initialCanvas = await canvas.evaluate((element) => {
      const gl = element.getContext("webgl2") || element.getContext("webgl");
      return {
        width: element.width,
        height: element.height,
        hasWebGL: Boolean(gl)
      };
    });
    assert.ok(initialCanvas.width > 0 && initialCanvas.height > 0, "canvas should have a real render size");
    assert.equal(initialCanvas.hasWebGL, true, "a WebGL context should be created");

    const scenarios = [
      ["airport", "What if an aircraft vanished at an airport?"],
      ["school", "What if a school vanished?"],
      ["ocean", "What if the ocean vanished?"],
      ["space", "What if the Moon vanished?"],
      ["factory", "What if a factory stopped?"],
      ["nature", "What if a forest vanished?"],
      ["urban", "What if all rubber disappeared for 5 seconds?"]
    ];

    for (const [environment, prompt] of scenarios) {
      await page.locator("#whatif").fill(prompt);
      await page.locator(".generate-button").click();
      await page.waitForFunction((expected) => {
        const viewport = document.querySelector(".world-view");
        const canvasElement = viewport?.querySelector("canvas");
        return viewport?.dataset.environment === expected &&
          canvasElement && canvasElement.width > 0 && canvasElement.height > 0;
      }, environment, { timeout: 10000 });

      if (environment === "factory") {
        const mappingStatus = await page.locator(".engine-status").innerText();
        assert.match(mappingStatus, /MAPPED EVENT.*FACTORY PRODUCTION STOPS/);
        await page.locator(".beat").nth(1).click();
        await page.waitForFunction(() =>
          document.querySelector(".scene-caption strong")?.textContent === "The entire production line stops."
        );
      }
      if (environment === "ocean") {
        const mappingStatus = await page.locator(".engine-status").innerText();
        assert.match(mappingStatus, /MAPPED EVENT.*OCEAN DISAPPEARS/);
        await page.locator(".beat").nth(1).click();
        await page.waitForFunction(() =>
          document.querySelector(".scene-caption strong")?.textContent === "The ocean disappears in an instant."
        );
      }
    }


    const recordingCheck = await page.evaluate(async () => {
      const source = document.querySelector(".world-view canvas");
      if (!source || !window.MediaRecorder) {
        return { supported: false, reason: "The live preview canvas or MediaRecorder is unavailable" };
      }

      // Mirror production export: compose the live WebGL frame into a 2D canvas,
      // then record that caption-capable composition canvas.
      const composition = document.createElement("canvas");
      composition.width = 320;
      composition.height = 568;
      const context = composition.getContext("2d");
      if (!context || typeof composition.captureStream !== "function") {
        return { supported: false, reason: "Canvas composition or captureStream is unavailable" };
      }

      const initialStream = composition.captureStream(0);
      let stream = initialStream;
      let captureTrack = stream.getVideoTracks()[0];
      const manualCapture = typeof captureTrack?.requestFrame === "function";
      if (!manualCapture) {
        stream.getTracks().forEach((track) => track.stop());
        stream = composition.captureStream(30);
        captureTrack = null;
      }
      let animationId = 0;
      let lastFrameAt = -Infinity;
      const draw = (timestamp) => {
        context.fillStyle = "#080d12";
        context.fillRect(0, 0, composition.width, composition.height);
        context.drawImage(source, 0, 0, composition.width, composition.height);
        if (manualCapture && timestamp - lastFrameAt >= 1000 / 30) {
          captureTrack.requestFrame();
          lastFrameAt = timestamp;
        }
        animationId = requestAnimationFrame(draw);
      };
      const candidates = [
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4;codecs=avc1.42E01E",
        "video/mp4"
      ];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        cancelAnimationFrame(animationId);
        return { supported: false, reason: "No supported video MIME type" };
      }

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch (error) {
        cancelAnimationFrame(animationId);
        stream.getTracks().forEach((track) => track.stop());
        return { supported: false, reason: error.message, mimeType };
      }
      const chunks = [];
      return await new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        recorder.onerror = (event) => reject(event.error || new Error("MediaRecorder failed"));
        recorder.onstop = () => {
          cancelAnimationFrame(animationId);
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
          resolve({
            supported: true,
            mimeType,
            actualMimeType: recorder.mimeType,
            chunkCount: chunks.length,
            size: blob.size,
            type: blob.type
          });
        };
        recorder.start();
        if (manualCapture) captureTrack.requestFrame();
        animationId = requestAnimationFrame(draw);
        window.setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 1500);
      });
    });
    assert.equal(recordingCheck.supported, true, recordingCheck.reason || "browser should support canvas video recording");
    assert.ok(
      recordingCheck.size > 0,
      "browser should produce a non-empty composed video: " + JSON.stringify(recordingCheck)
    );

    const downloadPromise = page.waitForEvent("download");
    await page.locator(".export-button").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "voxel-what-if-storyboard.txt");

    downloadDirectory = await mkdtemp(join(tmpdir(), "voxel-what-if-"));
    const downloadedPath = join(downloadDirectory, download.suggestedFilename());
    await download.saveAs(downloadedPath);
    const storyboard = await readFile(downloadedPath, "utf8");
    assert.match(storyboard, /VOXEL WHAT IF STUDIO — STORYBOARD/);
    assert.match(storyboard, /What if all rubber disappeared for 5 seconds\?/);
    assert.match(storyboard, /Duration: 00:56/);

    assert.deepEqual(pageErrors, [], "browser should not report uncaught page errors");
  } finally {
    await browser?.close();
    await server.close();
    if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
  }
});
