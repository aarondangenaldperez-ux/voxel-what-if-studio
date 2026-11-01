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

    const videoDownloadPromise = page.waitForEvent("download", { timeout: 160000 });
    await page.locator(".video-export-button").click();
    const videoDownload = await videoDownloadPromise;
    assert.match(
      videoDownload.suggestedFilename(),
      /^voxel-what-if-rubber\.(mp4|webm)$/,
      "the app should download a correctly named MP4 or WebM file"
    );
    await page.waitForFunction(
      () => document.querySelector(".video-export-success")?.textContent.includes("VIDEO GENERATED"),
      null,
      { timeout: 10000 }
    );
    assert.equal(await page.locator(".video-export-error").count(), 0,
      "the UI should not show an export error after a successful download");
    assert.equal(await page.locator(".video-export-button").isDisabled(), false,
      "the export control should be re-enabled after rendering");

    const videoPath = join(downloadDirectory, videoDownload.suggestedFilename());
    await videoDownload.saveAs(videoPath);
    const videoBytes = await readFile(videoPath);
    assert.ok(videoBytes.byteLength > 0, "the full app export should produce a non-empty downloadable video");

    assert.deepEqual(pageErrors, [], "browser should not report uncaught page errors");
  } finally {
    await browser?.close();
    await server.close();
    if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
  }
});
