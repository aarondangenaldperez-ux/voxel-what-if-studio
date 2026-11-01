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

    assert.deepEqual(pageErrors, [], "browser should not report uncaught page errors");
  } finally {
    await browser?.close();
    await server.close();
    if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
  }
});
