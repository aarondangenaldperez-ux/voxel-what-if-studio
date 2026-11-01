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
