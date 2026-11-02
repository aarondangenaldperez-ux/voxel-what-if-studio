import { getBeatAtTime } from "./sceneTimeline.js";
export { getBeatAtTime } from "./sceneTimeline.js";

const RECORDING_FORMATS = [
  { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" }
];

export function chooseRecordingFormat(MediaRecorderClass = globalThis.MediaRecorder) {
  if (typeof MediaRecorderClass !== "function") {
    throw new Error("This browser does not provide MediaRecorder video export.");
  }
  const supported = RECORDING_FORMATS.find(({ mimeType }) => {
    try {
      return typeof MediaRecorderClass.isTypeSupported !== "function" ||
        MediaRecorderClass.isTypeSupported(mimeType);
    } catch {
      return false;
    }
  });
  if (!supported) {
    throw new Error("This browser cannot encode MP4 or WebM video. Try a supported desktop browser.");
  }
  return supported;
}


async function probeCanvasEncoder(mimeType, MediaRecorderClass, signal) {
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function" || signal?.aborted) return false;
  let stream;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.captureStream !== "function") return false;
    stream = canvas.captureStream(0);
    let track = stream.getVideoTracks()[0];
    const manualCapture = typeof track?.requestFrame === "function";
    if (!manualCapture) {
      stream.getTracks().forEach((item) => item.stop());
      stream = canvas.captureStream(12);
      track = null;
    }
    const recorder = new MediaRecorderClass(stream, { mimeType });
    return await new Promise((resolve) => {
      const chunks = [];
      let frameId = 0;
      let timeoutId = 0;
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        if (frameId) cancelAnimationFrame(frameId);
        if (timeoutId) window.clearTimeout(timeoutId);
        signal?.removeEventListener("abort", handleAbort);
        stream.getTracks().forEach((item) => item.stop());
        resolve(success);
      };
      const handleAbort = () => {
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {
          // The track cleanup below still releases the probe stream.
        }
        finish(false);
      };
      signal?.addEventListener("abort", handleAbort, { once: true });
      if (signal?.aborted) {
        finish(false);
        return;
      }
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => finish(false);
      recorder.onstop = () => finish(chunks.some((chunk) => chunk.size > 0));
      try {
        recorder.start(200);
        const startedAt = performance.now();
        let lastFrameAt = -Infinity;
        const draw = (timestamp) => {
          if (settled || recorder.state !== "recording") return;
          const hue = Math.floor((timestamp - startedAt) / 45) % 360;
          context.fillStyle = "hsl(" + hue + " 75% 50%)";
          context.fillRect(0, 0, 48, 48);
          context.fillStyle = "#ffffff";
          context.fillRect(hue % 40, 12, 8, 8);
          if (manualCapture && timestamp - lastFrameAt >= 80) {
            track.requestFrame();
            lastFrameAt = timestamp;
          }
          if (timestamp - startedAt >= 900) {
            recorder.stop();
            return;
          }
          frameId = requestAnimationFrame(draw);
        };
        if (manualCapture) track.requestFrame();
        frameId = requestAnimationFrame(draw);
        timeoutId = window.setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
          else finish(false);
        }, 2500);
      } catch {
        finish(false);
      }
    });
  } catch {
    stream?.getTracks().forEach((item) => item.stop());
    return false;
  }
}

export async function findWorkingRecordingFormat(
  MediaRecorderClass = globalThis.MediaRecorder,
  probe = probeCanvasEncoder,
  { signal } = {}
) {
  const abortError = () => signal?.reason instanceof Error
    ? signal.reason
    : new Error("Video export was interrupted.");

  if (typeof MediaRecorderClass !== "function") {
    throw new Error("This browser does not provide MediaRecorder video export.");
  }
  if (signal?.aborted) throw abortError();

  let advertisedFormats = 0;
  for (const format of RECORDING_FORMATS) {
    let supported = true;
    try {
      if (typeof MediaRecorderClass.isTypeSupported === "function") {
        supported = MediaRecorderClass.isTypeSupported(format.mimeType);
      }
    } catch {
      supported = false;
    }
    if (!supported) continue;
    advertisedFormats += 1;
    try {
      const works = await probe(format.mimeType, MediaRecorderClass, signal);
      if (signal?.aborted) throw abortError();
      if (works) return format;
    } catch (error) {
      if (signal?.aborted) throw abortError();
      // Continue after false-positive capability reports.
    }
  }
  if (signal?.aborted) throw abortError();
  if (advertisedFormats === 0) {
    throw new Error("This browser cannot encode MP4 or WebM video. Try a supported desktop browser.");
  }
  throw new Error("The browser advertised video encoders, but none produced a valid recording. Try another browser.");
}

function drawCaption(context, beat, width, height) {
  if (!beat?.caption) return;
  const gradient = context.createLinearGradient(0, height * 0.73, 0, height);
  gradient.addColorStop(0, "rgba(5, 10, 15, 0)");
  gradient.addColorStop(0.22, "rgba(5, 10, 15, 0.68)");
  gradient.addColorStop(1, "rgba(5, 10, 15, 0.92)");
  context.fillStyle = gradient;
  context.fillRect(0, height * 0.73, width, height * 0.27);

  const fontSize = Math.round(width * 0.048);
  context.font = "600 " + fontSize + "px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0, 0, 0, 0.75)";
  context.shadowBlur = Math.round(fontSize * 0.18);

  const maxWidth = width * 0.84;
  const words = String(beat.caption).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  const visibleLines = lines.slice(-2);
  const lineHeight = fontSize * 1.22;
  const firstY = height - Math.round(height * 0.105) -
    ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((text, index) => {
    context.fillText(text, width / 2, firstY + index * lineHeight, maxWidth);
  });
  context.shadowBlur = 0;
}

export async function recordCanvasVideo({
  sourceCanvas,
  durationSeconds,
  beats,
  width = 1080,
  height = 1920,
  fps = 30,
  onTime = () => {},
  onProgress = () => {},
  MediaRecorderClass = globalThis.MediaRecorder,
  prepareSourceCanvas = async () => {},
  renderSourceFrame = () => {}
}) {
  if (!sourceCanvas || typeof sourceCanvas.captureStream !== "function") {
    throw new Error("The 3D preview canvas is not ready for video capture.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("The storyboard has no valid video duration.");
  }
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function") {
    throw new Error("Canvas video export is unavailable in this browser context.");
  }

  const interruptionError = new Error(
    "Video export stopped because this browser tab became hidden. Keep Voxel What If Studio in the foreground and try again."
  );
  const abortController = new AbortController();
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden" && !abortController.signal.aborted) {
      abortController.abort(interruptionError);
    }
  };
  const removeVisibilityListener = () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (document.visibilityState === "hidden") {
    removeVisibilityListener();
    throw interruptionError;
  }

  let format;
  let stream;
  let recorder;
  let context;
  try {
    format = await findWorkingRecordingFormat(
      MediaRecorderClass,
      probeCanvasEncoder,
      { signal: abortController.signal }
    );
    if (abortController.signal.aborted) throw interruptionError;

    // Keep expensive source-renderer resizing out of the short codec probe window.
    await prepareSourceCanvas({ signal: abortController.signal });
    if (abortController.signal.aborted) throw interruptionError;

    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    context = output.getContext("2d", { alpha: false });
    if (!context) throw new Error("Could not create the video composition canvas.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const drawFrame = (elapsedSeconds) => {
      context.fillStyle = "#080d12";
      context.fillRect(0, 0, width, height);
      context.drawImage(sourceCanvas, 0, 0, width, height);
      drawCaption(context, getBeatAtTime(beats, elapsedSeconds), width, height);
    };

    drawFrame(0);
    // Use the browser's fixed-rate canvas track. The manual requestFrame path
    // produced fewer encoded frames than the nominal frame cadence on slower
    // WebGL/software renderers, shortening the resulting media duration.
    stream = output.captureStream(fps);

    if (abortController.signal.aborted) throw interruptionError;
    recorder = new MediaRecorderClass(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: 8_000_000
    });

    return await new Promise((resolve, reject) => {
      const chunks = [];
      let frameId = 0;
      let failure = null;
      let settled = false;
      let abortHandler;

      const cleanup = () => {
        if (frameId) cancelAnimationFrame(frameId);
        abortController.signal.removeEventListener("abort", abortHandler);
        removeVisibilityListener();
        stream.getTracks().forEach((track) => track.stop());
      };
      const fail = (error) => {
        if (settled) return;
        failure = error instanceof Error ? error : new Error(String(error));
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
            return;
          } catch {
            // Fall through to immediate cleanup if stopping the recorder fails.
          }
        }
        settled = true;
        cleanup();
        reject(failure);
      };
      abortHandler = () => fail(abortController.signal.reason || interruptionError);
      abortController.signal.addEventListener("abort", abortHandler, { once: true });
      if (abortController.signal.aborted) {
        abortHandler();
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = (event) => {
        fail(event.error || new Error("The browser stopped recording unexpectedly."));
      };
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (failure) {
          reject(failure);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || format.mimeType });
        if (!blob.size) {
          reject(new Error("The browser finished recording but produced an empty video."));
          return;
        }
        onProgress(1);
        resolve(blob);
      };

      try {
        let recordingStartedAt = null;
        const renderFrame = (timestamp) => {
          if (settled || recorder.state !== "recording" || recordingStartedAt === null) return;
          try {
            const elapsed = Math.min(durationSeconds, Math.max(0, (timestamp - recordingStartedAt) / 1000));
            // Render the 3D scene at this exact storyboard timestamp before
            // copying it into the fixed-rate recording canvas.
            renderSourceFrame(elapsed);
            drawFrame(elapsed);
            onTime(elapsed, getBeatAtTime(beats, elapsed));
            onProgress(elapsed / durationSeconds);
            if (elapsed >= durationSeconds) {
              // Give the final canvas frame one browser paint/capture turn before
              // stopping MediaRecorder. Immediate stop can drop a just-requested
              // manual frame or the last automatic-rate capture tick, truncating
              // the encoded container even though the simulation clock reached 56s.
              frameId = requestAnimationFrame(() => {
                frameId = 0;
                if (settled || recorder.state !== "recording") return;
                try {
                  recorder.stop();
                } catch (error) {
                  fail(error);
                }
              });
            } else {
              frameId = requestAnimationFrame(renderFrame);
            }
          } catch (error) {
            fail(error);
          }
        };
        // MediaRecorder.start() returns before recording actually begins. Anchor
        // the storyboard clock to the start event so encoder startup latency
        // cannot silently truncate the exported video.
        recorder.onstart = () => {
          if (settled || abortController.signal.aborted) return;
          recordingStartedAt = performance.now();
          onTime(0, getBeatAtTime(beats, 0));
          onProgress(0);
          frameId = requestAnimationFrame(renderFrame);
        };
        recorder.start(1000);
      } catch (error) {
        fail(error);
      }
    });
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    removeVisibilityListener();
    throw error;
  }
}
