import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";

test("production app renders WebGL, switches environments, and exports real files", { timeout: 240000 }, async () => {
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
    const mobileRenderScale = await page.locator('.world-view').getAttribute('data-render-pixel-ratio');
    assert.ok(Number(mobileRenderScale) <= 1.25, "mobile preview should cap GPU pixel ratio to protect device performance");
    const hostToggle = page.locator('.camera-mode-button[data-mode="presenter"]');
    await page.waitForFunction(() => document.querySelector('.world-view')?.dataset.presenterVisible === 'true');
    await hostToggle.click();
    await page.waitForFunction(() => document.querySelector('.world-view')?.dataset.presenterVisible === 'false');
    await hostToggle.click();
    await page.waitForFunction(() => document.querySelector('.world-view')?.dataset.presenterVisible === 'true');

    const cameraViewport = page.locator('.world-view');
    assert.equal(await cameraViewport.getAttribute('data-camera-mode'), 'auto');
    assert.equal(await cameraViewport.getAttribute('data-orbit-controls'), 'false');
    await page.locator('.camera-mode-button[data-mode="orbit"]').click();
    await page.waitForFunction(() => {
      const view = document.querySelector('.world-view');
      return view?.dataset.cameraMode === 'orbit' && view?.dataset.orbitControls === 'true';
    });
    await page.locator('.camera-mode-button[data-mode="auto"]').click();
    await page.waitForFunction(() => {
      const view = document.querySelector('.world-view');
      return view?.dataset.cameraMode === 'auto' && view?.dataset.orbitControls === 'false';
    });

    const lightSlider = page.locator('.lighting-slider');
    assert.equal(await lightSlider.inputValue(), '100');
    await lightSlider.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const slider = document.querySelector('.lighting-slider');
      const view = document.querySelector('.world-view');
      return slider?.value === '160' && Number(view?.dataset.keyLightIntensity) >= 4.7;
    });

    const timelineScrubber = page.locator('.timeline-scrubber');
    await page.locator('.beat').nth(1).click();
    await page.waitForFunction(() => document.querySelector('.timeline-scrubber')?.value === '8');
    await page.waitForFunction(() => Number(document.querySelector('.world-view')?.dataset.timelineSeconds) === 8);
    assert.equal(await timelineScrubber.getAttribute('aria-label'), 'Timeline playhead');
    await timelineScrubber.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const slider = document.querySelector('.timeline-scrubber');
      return slider?.value === '56' &&
        Number(document.querySelector('.world-view')?.dataset.timelineSeconds) === 56 &&
        document.querySelector('.scene-caption strong')?.textContent === 'The interruption is over.';
    });
    await timelineScrubber.focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() =>
      document.querySelector('.timeline-scrubber')?.value === '0' &&
      Number(document.querySelector('.world-view')?.dataset.timelineSeconds) === 0
    );

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

    const videoDownloadResult = page.waitForEvent("download", { timeout: 160000 })
      .then((download) => ({ download }))
      .catch((error) => ({ error }));
    await page.locator(".video-export-button").click();
    await page.waitForFunction(
      () => {
        const success = document.querySelector(".video-export-success")?.textContent.includes("VIDEO GENERATED");
        const error = document.querySelector(".video-export-error")?.textContent.trim();
        return Boolean(success || error);
      },
      null,
      { timeout: 160000 }
    );

    const exportErrorLocator = page.locator(".video-export-error");
    const exportErrorCount = await exportErrorLocator.count();
    const exportError = exportErrorCount
      ? (await exportErrorLocator.first().textContent())?.trim()
      : "";
    assert.equal(
      exportErrorCount,
      0,
      "the app's video export failed: " + (exportError || "unknown export error")
    );

    const videoDownloadOutcome = await videoDownloadResult;
    assert.ok(
      videoDownloadOutcome.download,
      "the app reported a successful export but did not trigger a browser download: " +
        (videoDownloadOutcome.error?.message || "no download event")
    );
    const videoDownload = videoDownloadOutcome.download;
    assert.match(
      videoDownload.suggestedFilename(),
      /^voxel-what-if-rubber\.(mp4|webm)$/,
      "the app should download a correctly named MP4 or WebM file"
    );
    assert.equal(await page.locator(".video-export-error").count(), 0,
      "the UI should not show an export error after a successful download");
    assert.equal(await page.locator(".video-export-button").isDisabled(), false,
      "the export control should be re-enabled after rendering");

    const videoPath = join(downloadDirectory, videoDownload.suggestedFilename());
    await videoDownload.saveAs(videoPath);
    const videoBytes = await readFile(videoPath);
    assert.ok(videoBytes.byteLength > 0, "the full app export should produce a non-empty downloadable video");

    // Decode real exported frames: non-empty bytes alone allowed the earlier
    // camera-framing and long-static-shot regressions to pass CI.
    const mediaQuality = await page.evaluate(async ({ base64, mimeType }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error("The exported video could not be decoded."));
      });
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 144;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const times = [2, 10, 16, 24, 30, 36, 44, 52];
      const frames = [];
      for (const time of times) {
        await new Promise((resolve, reject) => {
          const onSeeked = () => resolve();
          video.addEventListener("seeked", onSeeked, { once: true });
          video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1));
          window.setTimeout(() => reject(new Error("Timed out decoding a sampled export frame.")), 10000);
        });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data));
      }
      const differences = [];
      for (let frame = 1; frame < frames.length; frame += 1) {
        let changed = 0;
        let samples = 0;
        for (let pixel = 0; pixel < frames[frame].length; pixel += 4 * 5) {
          const delta = Math.max(
            Math.abs(frames[frame][pixel] - frames[frame - 1][pixel]),
            Math.abs(frames[frame][pixel + 1] - frames[frame - 1][pixel + 1]),
            Math.abs(frames[frame][pixel + 2] - frames[frame - 1][pixel + 2])
          );
          if (delta > 14) changed += 1;
          samples += 1;
        }
        differences.push(changed / samples);
      }
      URL.revokeObjectURL(url);
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        differences
      };
    }, {
      base64: videoBytes.toString("base64"),
      mimeType: videoDownload.suggestedFilename().endsWith(".mp4") ? "video/mp4" : "video/webm"
    });
    assert.equal(mediaQuality.width, 1080, "export should decode at the requested width");
    assert.equal(mediaQuality.height, 1920, "export should decode at the requested portrait height");
    assert.ok(mediaQuality.duration >= 54 && mediaQuality.duration <= 57,
      "export should contain the complete 56-second storyboard");
    assert.ok(mediaQuality.differences.every((ratio) => ratio > 0.002),
      "sampled story sections should contain visible frame changes, not long frozen shots: " +
      mediaQuality.differences.map((value) => value.toFixed(4)).join(", "));

    assert.deepEqual(pageErrors, [], "browser should not report uncaught page errors");
  } finally {
    await browser?.close();
    await server.close();
    if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
  }
});
