import { getTimelinePosition, smoothStep01 } from "./sceneTimeline.js";

const DEFAULT_SHOTS = {
  establish: {
    position: [0, 27, 45], target: [0, 1.5, 0],
    motion: { position: [0, 0.4, 0.8], target: [0, 0, 0] }
  },
  event: {
    position: [5, 12, 27], target: [0, 2, 7],
    motion: { position: [0.65, 0.35, -0.8], target: [0, 0, 0] }
  },
  detail: {
    position: [5, 7, 18], target: [0, 2.2, 8],
    motion: { position: [-0.5, 0.3, -0.9], target: [-0.2, 0, 0] }
  },
  aftermath: {
    position: [-11, 20, 38], target: [0, 2, 0],
    motion: { position: [0.8, 1.1, 2.4], target: [0, 0.15, 0] }
  },
  overview: {
    position: [0, 29, 42], target: [0, 0, 0],
    motion: { position: [1.2, 0.8, 0], target: [0, 0, 0] }
  },
  resolve: {
    position: [0, 24, 40], target: [0, 1.5, 0],
    motion: { position: [-0.8, 0.3, 1.5], target: [0, 0, 0] }
  }
};

const RUBBER_SHOTS = {
  establish: {
    position: [0, 25, 43], target: [0, 1.5, 0],
    motion: { position: [0, 0.35, 0.8], target: [0, 0, 0] }
  },
  event: {
    // Keep the disappearing tires and the affected vehicle inside the portrait frame.
    position: [2.8, 9, 21], target: [1.55, 0.9, 8.1],
    motion: { position: [0.55, 0.25, -0.55], target: [0, 0, 0] }
  },
  detail: {
    // A deliberate three-quarter view of the vehicle, not the nearby blank building wall.
    position: [0, 5.1, 14.2], target: [1.55, 0.85, 8.1],
    motion: { position: [-0.2, 0.3, -0.75], target: [-0.12, 0, -0.12] }
  },
  aftermath: {
    position: [0, 19, 35], target: [0, 1.5, 0],
    motion: { position: [-1.2, 1.1, 2.2], target: [0, 0.2, 0] }
  },
  overview: {
    position: [0, 29, 42], target: [0, 0, 0],
    motion: { position: [1.1, 0.7, 0], target: [0, 0, 0] }
  },
  resolve: {
    position: [-7, 17, 31], target: [0, 1.5, 0],
    motion: { position: [1, 0.35, 1.5], target: [0, 0, 0] }
  }
};

function mixVector(from, to, amount) {
  return from.map((value, index) => value + ((to[index] ?? value) - value) * amount);
}

function addMotion(base, delta, amount) {
  return base.map((value, index) => value + (delta?.[index] || 0) * amount);
}

/**
 * Reconstructs a portrait-safe camera pose from absolute storyboard time.
 * Every beat transitions from the previous shot and gets a subtle authored
 * camera move so long beats do not become static holds.
 */
export function getCinematicCameraPose({ beats, elapsedSeconds, scenarioId } = {}) {
  const timeline = getTimelinePosition(beats, elapsedSeconds);
  const currentBeat = timeline.beat || {};
  const previousBeat = beats?.[timeline.index - 1] || currentBeat;
  const shots = scenarioId === "rubber" ? RUBBER_SHOTS : DEFAULT_SHOTS;
  const from = shots[previousBeat.camera] || shots.establish;
  const to = shots[currentBeat.camera] || shots.establish;
  const blend = smoothStep01(timeline.elapsedInBeat / 1.15);
  const drift = Math.sin(Math.PI * timeline.progress);
  const position = mixVector(from.position, to.position, blend);
  const target = mixVector(from.target, to.target, blend);

  return {
    position: addMotion(position, to.motion?.position, drift),
    target: addMotion(target, to.motion?.target, drift),
    shot: currentBeat.camera || "establish",
    beatIndex: timeline.index,
    beatProgress: timeline.progress,
    transitionProgress: blend
  };
}
