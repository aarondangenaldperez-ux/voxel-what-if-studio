export function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function smoothStep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function getTimelinePosition(beats, elapsedSeconds) {
  if (!Array.isArray(beats) || beats.length === 0) {
    return { beat: null, index: -1, startSeconds: 0, endSeconds: 0, elapsedInBeat: 0, progress: 0 };
  }

  const time = Math.max(0, Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : 0);
  let cursor = 0;

  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    const duration = Math.max(0, Number(beat?.durationSeconds) || 0);
    const endSeconds = cursor + duration;
    if (time < endSeconds || index === beats.length - 1) {
      const elapsedInBeat = Math.max(0, Math.min(duration, time - cursor));
      return {
        beat,
        index,
        startSeconds: cursor,
        endSeconds,
        elapsedInBeat,
        progress: duration > 0 ? clamp01(elapsedInBeat / duration) : 1
      };
    }
    cursor = endSeconds;
  }

  const lastIndex = beats.length - 1;
  return {
    beat: beats[lastIndex],
    index: lastIndex,
    startSeconds: cursor,
    endSeconds: cursor,
    elapsedInBeat: 0,
    progress: 1
  };
}

export function getBeatAtTime(beats, elapsedSeconds) {
  return getTimelinePosition(beats, elapsedSeconds).beat;
}

export function getBeatWindow(beats, eventName) {
  if (!Array.isArray(beats) || !eventName) return null;
  let cursor = 0;
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    const duration = Math.max(0, Number(beat?.durationSeconds) || 0);
    if (beat?.event === eventName) {
      return {
        index,
        startSeconds: cursor,
        endSeconds: cursor + duration,
        durationSeconds: duration
      };
    }
    cursor += duration;
  }
  return null;
}

export function getBeatStartSeconds(beats, eventName) {
  return getBeatWindow(beats, eventName)?.startSeconds ?? null;
}

export function getMotionTime(elapsedSeconds, pauseStartSeconds, resumeSeconds) {
  const time = Math.max(0, Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : 0);
  const start = Number(pauseStartSeconds);
  const resume = Number(resumeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(resume) || resume <= start || time < start) {
    return time;
  }
  if (time < resume) return start;
  return time - (resume - start);
}

export function getEventEnvelope(elapsedSeconds, startSeconds, endSeconds, transitionSeconds = 0.25) {
  const time = Number(elapsedSeconds);
  const start = Number(startSeconds);
  const end = Number(endSeconds);
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (time < start || time >= end) return 0;
  const transition = Math.max(0, Number(transitionSeconds) || 0);
  if (transition === 0) return 1;
  const entering = smoothStep01((time - start) / transition);
  const leaving = smoothStep01((end - time) / transition);
  return Math.min(entering, leaving);
}
export function getCityActorPoseAtTime({ elapsedSeconds, scenarioId, beats, actorIndex = 0 } = {}) {
  const time = Math.max(0, Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : 0);
  const index = Math.max(0, Number(actorIndex) || 0);
  const rubberWindow = getBeatWindow(beats, "rubber-loss");
  const gravityWindow = getBeatWindow(beats, "gravity-loss");
  const powerWindow = getBeatWindow(beats, "power-loss");
  const powerRestoreWindow = getBeatWindow(beats, "restored");
  const rubberRecoverySeconds = getBeatStartSeconds(beats, "recovery");

  const rubberIntensity = scenarioId === "rubber" && rubberWindow
    ? getEventEnvelope(time, rubberWindow.startSeconds, rubberWindow.endSeconds, 0.28)
    : 0;
  const gravityIntensity = scenarioId === "gravity" && gravityWindow
    ? getEventEnvelope(time, gravityWindow.startSeconds, gravityWindow.endSeconds, 0.35)
    : 0;
  const powerIntensity = scenarioId === "electricity" && powerWindow && powerRestoreWindow
    ? getEventEnvelope(time, powerWindow.startSeconds, powerRestoreWindow.startSeconds, 0.45)
    : 0;

  const motionTime = scenarioId === "rubber"
    ? getMotionTime(time, rubberWindow?.startSeconds, rubberRecoverySeconds)
    : time;
  const swing = (Math.sin(time * 4.2 + index * 1.4) - Math.sin(index * 1.4)) * 0.34;
  const gravityFloat = 0.95 + (index * 0.18) + Math.sin(time * 2.1 + index) * 0.2;

  return {
    wheelScale: 1 - (0.999 * rubberIntensity),
    carPositionY: (-0.22 * rubberIntensity) + (gravityFloat * gravityIntensity),
    carPositionZOffset: (Math.sin(motionTime * 0.8 + index * 1.7) - Math.sin(index * 1.7)) * 0.22,
    carRotationX: (index % 2 === 0 ? -0.055 : 0.055) * rubberIntensity,
    carRotationZ: Math.sin(time * 6 + index) * 0.045 * rubberIntensity,
    pedestrianArmRotationX: [
      swing + (-0.48 - swing) * gravityIntensity,
      -swing + (0.48 + swing) * gravityIntensity
    ],
    pedestrianLegRotationX: [
      (-swing * 0.8) + (0.12 + swing * 0.8) * gravityIntensity,
      (swing * 0.8) + (-0.12 - swing * 0.8) * gravityIntensity
    ],
    pedestrianArmRotationZ: [
      -0.82 * rubberIntensity,
      0.82 * rubberIntensity
    ],
    pedestrianRootRotationZ: (index % 2 === 0 ? 0.045 : -0.045) * rubberIntensity,
    pedestrianPositionY: gravityIntensity * (0.95 + Math.sin(time * 2.1 + index) * 0.2),
    powerIntensity
  };
}
