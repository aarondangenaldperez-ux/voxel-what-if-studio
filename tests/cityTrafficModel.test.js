import test from "node:test";
import assert from "node:assert/strict";
import { createCityTrafficSimulation, runCityTrafficStudy } from "../src/engine/simulation/cityTrafficModel.js";

const vehicles = [
  { id: "vehicle-1", x: -1.65, z: -8.2, heading: 0 },
  { id: "vehicle-2", x: 1.55, z: 8.1, heading: Math.PI },
  { id: "vehicle-3", x: -8.2, z: 1.55, heading: Math.PI / 2 }
];

test("traffic simulation preserves baseline motion before the event and applies bounded braking", () => {
  const simulation = createCityTrafficSimulation({ vehicles });
  const before = simulation.sampleAt(7.99);
  const eventStart = simulation.sampleAt(8);
  const afterBrake = simulation.sampleAt(10);

  assert.equal(before.eventActive, false);
  assert.equal(before.vehicles[0].state, "cruising");
  assert.ok(Math.abs(before.vehicles[0].travelDistance - 0.28 * 7.99) < 1e-10);
  assert.equal(eventStart.eventActive, true);
  assert.equal(eventStart.vehicles[0].wheelsPresent, false);
  assert.equal(eventStart.vehicles[0].state, "braking");
  assert.equal(afterBrake.vehicles[0].state, "stopped");
  assert.equal(afterBrake.vehicles[0].speed, 0);
});

test("five-second tire-loss interval has exact boundaries and deterministic recovery", () => {
  const simulation = createCityTrafficSimulation({ vehicles });
  assert.equal(simulation.sampleAt(12.999).vehicles[0].wheelsPresent, false);
  assert.equal(simulation.sampleAt(13).vehicles[0].wheelsPresent, true);
  assert.equal(simulation.sampleAt(13).vehicles[0].state, "recovering");
  const first = simulation.sampleAt(22.4);
  simulation.sampleAt(1.2);
  const second = simulation.sampleAt(22.4);
  assert.deepEqual(second, first);
});

test("scenario results compare against an unchanged baseline and quantify stopped time", () => {
  const simulation = createCityTrafficSimulation({ vehicles });
  const report = simulation.summary;
  assert.equal(report.vehicleCount, 3);
  assert.equal(report.affectedVehicleCount, 3);
  assert.ok(report.meanTravelDistanceShortfall > 0);
  assert.ok(report.stoppedVehicleSeconds > 0);
  assert.equal(report.eventDurationSeconds, 5);
  assert.match(report.units, /not SI/);
});

test("baseline mode produces no event effects or travel-distance shortfall", () => {
  const simulation = createCityTrafficSimulation({ vehicles, enabled: false });
  const frame = simulation.sampleAt(20);
  assert.equal(frame.eventActive, false);
  assert.ok(frame.vehicles.every((vehicle) => vehicle.wheelsPresent && vehicle.state === "cruising"));
  assert.equal(simulation.summary.meanTravelDistanceShortfall, 0);
  assert.equal(simulation.summary.stoppedVehicleSeconds, 0);
});

test("study produces bounded, ordered, reproducible samples", () => {
  const study = runCityTrafficStudy({ vehicles, sampleStepSeconds: 0.5 });
  assert.equal(study.samples[0].timeSeconds, 0);
  assert.equal(study.samples.at(-1).timeSeconds, 56);
  assert.ok(study.samples.every((sample, index) =>
    index === 0 || sample.timeSeconds > study.samples[index - 1].timeSeconds
  ));
  assert.equal(study.samples.length, 113);
});

test("invalid entity IDs, duplicate vehicles, invalid event windows and excessive sample counts are rejected", () => {
  assert.throws(() => createCityTrafficSimulation({ vehicles: [{ id: "../unsafe", x: 0, z: 0, heading: 0 }] }), /identifier/);
  assert.throws(() => createCityTrafficSimulation({ vehicles: [vehicles[0], vehicles[0]] }), /unique/);
  assert.throws(() => createCityTrafficSimulation({ vehicles, eventStartSeconds: 54, eventDurationSeconds: 5 }), /fit inside/);
  assert.throws(() => runCityTrafficStudy({
    vehicles, durationSeconds: 600, sampleStepSeconds: 1 / 120
  }), /72,000/);
});
