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

export function getBeatAtTime(beats, elapsedSeconds) {
  if (!Array.isArray(beats) || beats.length === 0) return null;
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  let boundary = 0;
  for (let index = 0; index < beats.length; index += 1) {
    boundary += Math.max(0, Number(beats[index].durationSeconds) || 0);
    if (elapsed < boundary || index === beats.length - 1) return beats[index];
  }
  return beats[beats.length - 1];
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
  MediaRecorderClass = globalThis.MediaRecorder
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

  const format = chooseRecordingFormat(MediaRecorderClass);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not create the video composition canvas.");

  const drawFrame = (elapsedSeconds) => {
    context.fillStyle = "#080d12";
    context.fillRect(0, 0, width, height);
    context.drawImage(sourceCanvas, 0, 0, width, height);
    drawCaption(context, getBeatAtTime(beats, elapsedSeconds), width, height);
  };

  drawFrame(0);
  const stream = output.captureStream(fps);
  let recorder;
  try {
    recorder = new MediaRecorderClass(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: 8_000_000
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("The browser rejected the selected video format: " + error.message);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let frameId = 0;
    let failure = null;
    let settled = false;
    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      stream.getTracks().forEach((track) => track.stop());
    };
    const fail = (error) => {
      if (settled) return;
      failure = error instanceof Error ? error : new Error(String(error));
      if (recorder.state === "recording") recorder.stop();
      else {
        settled = true;
        cleanup();
        reject(failure);
      }
    };

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
      recorder.start(1000);
      const startedAt = performance.now();
      onTime(0, getBeatAtTime(beats, 0));
      onProgress(0);
      const renderFrame = (timestamp) => {
        if (recorder.state !== "recording") return;
        try {
          const elapsed = Math.min(durationSeconds, Math.max(0, (timestamp - startedAt) / 1000));
          drawFrame(elapsed);
          onTime(elapsed, getBeatAtTime(beats, elapsed));
          onProgress(elapsed / durationSeconds);
          if (elapsed >= durationSeconds) {
            recorder.stop();
          } else {
            frameId = requestAnimationFrame(renderFrame);
          }
        } catch (error) {
          fail(error);
        }
      };
      frameId = requestAnimationFrame(renderFrame);
    } catch (error) {
      fail(error);
    }
  });
}
