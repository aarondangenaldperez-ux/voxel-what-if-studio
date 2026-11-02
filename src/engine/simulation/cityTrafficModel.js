const MODEL_ID = "city-traffic-kinematics-v1";
const DEFAULTS = Object.freeze({
  baselineSpeed: 0.28,
  brakingDeceleration: 0.18,
  recoveryAcceleration: 0.12,
  bodyDrop: 0.22,
  transitionSeconds: 0.45
});

function finiteNumber(value, label, min = -Infinity, max = Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new TypeError(label + " must be a finite number in [" + min + ", " + max + "].");
  }
  return number;
}

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function motionAt(time, config) {
  const { baselineSpeed: speed, brakingDeceleration: brake, recoveryAcceleration: recovery, eventStartSeconds: start, eventEndSeconds: end } = config;
  if (!config.enabled || time < start) {
    return { distance: speed * time, speed, state: "cruising", wheelsPresent: true, bodyDrop: 0 };
  }

  const brakeDuration = speed / brake;
  const brakingElapsed = Math.min(time - start, brakeDuration);
  const brakingDistance = speed * brakingElapsed - 0.5 * brake * brakingElapsed * brakingElapsed;
  const stopDistance = (speed * speed) / (2 * brake);
  const stopTime = start + brakeDuration;
  let distance;
  let currentSpeed;
  let state;

  if (time < stopTime) {
    distance = speed * start + brakingDistance;
    currentSpeed = Math.max(0, speed - brake * (time - start));
    state = "braking";
  } else if (time < end) {
    distance = speed * start + stopDistance;
    currentSpeed = 0;
    state = "stopped";
  } else {
    const recoveryElapsed = time - end;
    const recoveryDuration = speed / recovery;
    const recoveryElapsedCapped = Math.min(recoveryElapsed, recoveryDuration);
    const recoveryDistance = 0.5 * recovery * recoveryElapsedCapped * recoveryElapsedCapped;
    distance = speed * start + stopDistance + recoveryDistance;
    currentSpeed = recovery * recoveryElapsedCapped;
    if (recoveryElapsed > recoveryDuration) {
      distance += speed * (recoveryElapsed - recoveryDuration);
      currentSpeed = speed;
      state = "cruising";
    } else {
      state = "recovering";
    }
  }

  const blendIn = smoothStep((time - start) / config.transitionSeconds);
  const blendOut = smoothStep((end - time) / config.transitionSeconds);
  const eventEnvelope = Math.min(blendIn, blendOut);

  return {
    distance,
    speed: currentSpeed,
    state,
    wheelsPresent: time < start || time >= end,
    bodyDrop: config.bodyDrop * eventEnvelope
  };
}

function validateVehicles(vehicles) {
  if (!Array.isArray(vehicles) || vehicles.length < 1 || vehicles.length > 100) {
    throw new RangeError("The traffic model requires between 1 and 100 vehicles.");
  }
  const ids = new Set();
  return vehicles.map((vehicle, index) => {
    const id = String(vehicle?.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(id) || ids.has(id)) {
      throw new TypeError("Vehicle " + index + " must have a unique, safe identifier.");
    }
    ids.add(id);
    return Object.freeze({
      id,
      x: finiteNumber(vehicle.x, "Vehicle x", -10000, 10000),
      z: finiteNumber(vehicle.z, "Vehicle z", -10000, 10000),
      heading: finiteNumber(vehicle.heading, "Vehicle heading", -Math.PI * 2, Math.PI * 2)
    });
  });
}

/**
 * Deterministic, time-addressable kinematic model for the studio's stylized
 * intersection. Speeds/distances are Three.js scene units, not SI measurements.
 * It models a tire-loss interruption as a bounded braking/hold/recovery event;
 * it is not a calibrated real-world traffic or tire-friction model.
 */
export function createCityTrafficSimulation({
  vehicles,
  durationSeconds = 56,
  eventStartSeconds = 8,
  eventDurationSeconds = 5,
  enabled = true,
  baselineSpeed = DEFAULTS.baselineSpeed,
  brakingDeceleration = DEFAULTS.brakingDeceleration,
  recoveryAcceleration = DEFAULTS.recoveryAcceleration,
  bodyDrop = DEFAULTS.bodyDrop,
  transitionSeconds = DEFAULTS.transitionSeconds
} = {}) {
  const entities = validateVehicles(vehicles);
  const duration = finiteNumber(durationSeconds, "durationSeconds", 0.1, 600);
  const eventStart = finiteNumber(eventStartSeconds, "eventStartSeconds", 0, duration);
  const eventDuration = finiteNumber(eventDurationSeconds, "eventDurationSeconds", 0.1, duration);
  if (eventStart + eventDuration > duration) {
    throw new RangeError("The event window must fit inside the simulation duration.");
  }

  const config = Object.freeze({
    enabled: Boolean(enabled),
    baselineSpeed: finiteNumber(baselineSpeed, "baselineSpeed", 0.001, 10),
    brakingDeceleration: finiteNumber(brakingDeceleration, "brakingDeceleration", 0.001, 10),
    recoveryAcceleration: finiteNumber(recoveryAcceleration, "recoveryAcceleration", 0.001, 10),
    bodyDrop: finiteNumber(bodyDrop, "bodyDrop", 0, 5),
    transitionSeconds: finiteNumber(transitionSeconds, "transitionSeconds", 0.01, 5),
    eventStartSeconds: eventStart,
    eventEndSeconds: eventStart + eventDuration
  });

  function sampleAt(seconds) {
    const time = finiteNumber(seconds, "time", 0, duration);
    const motion = motionAt(time, config);
    const baselineDistance = config.baselineSpeed * time;
    const vehiclesAtTime = entities.map((entity) => {
      const directionX = Math.sin(entity.heading);
      const directionZ = Math.cos(entity.heading);
      return {
        id: entity.id,
        x: entity.x + directionX * motion.distance,
        z: entity.z + directionZ * motion.distance,
        heading: entity.heading,
        speed: motion.speed,
        travelDistance: motion.distance,
        baselineTravelDistance: baselineDistance,
        travelDistanceShortfall: Math.max(0, baselineDistance - motion.distance),
        state: motion.state,
        wheelsPresent: motion.wheelsPresent,
        bodyDrop: motion.bodyDrop
      };
    });
    return {
      modelId: MODEL_ID,
      timeSeconds: time,
      eventActive: config.enabled && time >= config.eventStartSeconds && time < config.eventEndSeconds,
      vehicles: vehiclesAtTime
    };
  }

  const finalState = sampleAt(duration);
  const stopDurationPerVehicle = config.enabled
    ? Math.max(0, eventDuration - Math.min(eventDuration, config.baselineSpeed / config.brakingDeceleration))
    : 0;
  const baselineMeanDistance = config.baselineSpeed * duration;
  const scenarioMeanDistance = finalState.vehicles.reduce((sum, vehicle) => sum + vehicle.travelDistance, 0) / entities.length;
  const summary = Object.freeze({
    modelId: MODEL_ID,
    durationSeconds: duration,
    eventStartSeconds: config.eventStartSeconds,
    eventDurationSeconds: config.enabled ? eventDuration : 0,
    vehicleCount: entities.length,
    affectedVehicleCount: config.enabled ? entities.length : 0,
    baselineMeanTravelDistance: baselineMeanDistance,
    scenarioMeanTravelDistance: scenarioMeanDistance,
    meanTravelDistanceShortfall: Math.max(0, baselineMeanDistance - scenarioMeanDistance),
    stoppedVehicleSeconds: stopDurationPerVehicle * entities.length,
    units: "Three.js scene units; illustrative, not SI",
    assumptions: Object.freeze([
      "Each vehicle starts at a constant authored scene speed of " + config.baselineSpeed + " scene units per second.",
      "The tire-loss event triggers a constant deceleration of " + config.brakingDeceleration + " scene units per second squared.",
      "Vehicles remain stationary after deceleration until the event ends, then recover at " + config.recoveryAcceleration + " scene units per second squared.",
      "All vehicles share the same simplified response; collision avoidance, road capacity and driver variation are not modeled."
    ]),
    limitations: "This is a deterministic kinematic scenario model, not a calibrated traffic forecast or a tire/road contact physics simulation."
  });

  return Object.freeze({
    modelId: MODEL_ID,
    durationSeconds: duration,
    eventStartSeconds: config.eventStartSeconds,
    eventEndSeconds: config.eventEndSeconds,
    entities,
    sampleAt,
    summary
  });
}

export function runCityTrafficStudy(options = {}) {
  const simulation = createCityTrafficSimulation(options);
  const sampleStepSeconds = finiteNumber(options.sampleStepSeconds ?? 0.25, "sampleStepSeconds", 1 / 120, 1);
  const sampleCount = Math.ceil(simulation.durationSeconds / sampleStepSeconds) + 1;
  if (sampleCount > 72000) {
    throw new RangeError("The requested study exceeds the 72,000-sample resource limit.");
  }
  const samples = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const time = Math.min(simulation.durationSeconds, index * sampleStepSeconds);
    samples.push(simulation.sampleAt(time));
  }
  if (samples.at(-1).timeSeconds !== simulation.durationSeconds) {
    samples.push(simulation.sampleAt(simulation.durationSeconds));
  }
  return Object.freeze({
    modelId: simulation.modelId,
    samples: Object.freeze(samples),
    summary: simulation.summary
  });
}
