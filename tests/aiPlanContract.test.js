import test from "node:test";
import assert from "node:assert/strict";
import { validateAIInterpretation } from "../src/engine/ai/planContract.js";

const supportedPlan = {
  schemaVersion: 1,
  classification: "supported",
  title: "Temporary tire loss in city traffic",
  summary: "The scenario matches the registered five-second tire-loss model.",
  simulationModelId: "city-traffic-kinematics-v1",
  event: { type: "rubber-loss", startSeconds: 8, durationSeconds: 5, recoveryStartSeconds: 33 },
  entities: [{ id: "vehicle-1", type: "vehicle", label: "Vehicle" }],
  variables: [{ name: "event duration", value: 5, unit: "seconds" }],
  relationships: ["Missing tires trigger a braking and recovery response."],
  requiredSystems: [{ id: "traffic-kinematics", reason: "The registered model covers the authored vehicle response." }],
  missingInformation: [],
  conflicts: [],
  facts: ["The user specified a five-second duration."],
  assumptions: ["The scene uses the existing three-vehicle intersection."],
  limitations: ["This is not a calibrated tire-road dynamics model."]
};

test("AI plan contract accepts registered model plans and returns a sanitized structure", () => {
  const result = validateAIInterpretation({ ...supportedPlan, injectedCode: "process.exit()" }, "What if rubber disappeared for five seconds?");
  assert.equal(result.simulationModelId, "city-traffic-kinematics-v1");
  assert.equal(result.event.durationSeconds, 5);
  assert.equal("injectedCode" in result, false);
  assert.equal(result.prompt, "What if rubber disappeared for five seconds?");
});

test("AI plan contract rejects unregistered models, modified event windows and executable entity IDs", () => {
  assert.throws(() => validateAIInterpretation({ ...supportedPlan, simulationModelId: "arbitrary-js" }, "What if rubber disappeared for five seconds?"), /not registered/);
  assert.throws(() => validateAIInterpretation({ ...supportedPlan, event: { ...supportedPlan.event, durationSeconds: 9 } }, "What if rubber disappeared for five seconds?"), /event 8.*13/);
  assert.throws(() => validateAIInterpretation({ ...supportedPlan, entities: [{ id: "<script>", type: "vehicle", label: "Vehicle" }] }, "What if rubber disappeared for five seconds?"), /identifiers/);
});

test("unsupported AI plans cannot request a simulation model", () => {
  const plan = {
    schemaVersion: 1, classification: "unsupported", title: "Moon vanishes",
    summary: "No registered model supports this event.", simulationModelId: null, event: null,
    entities: [], variables: [], relationships: [], facts: [],
    assumptions: ["An orbital model would be needed."], limitations: ["No orbital model is registered."]
  };
  assert.equal(validateAIInterpretation(plan, "What if the Moon vanished?").classification, "unsupported");
  assert.throws(() => validateAIInterpretation({ ...plan, simulationModelId: "city-traffic-kinematics-v1" }, "What if the Moon vanished?"), /Unsupported scenarios/);
});

test("AI contract will not execute plans with missing information, conflicts or unavailable systems", () => {
  assert.throws(() => validateAIInterpretation({
    ...supportedPlan,
    missingInformation: ["Initial tire condition is unknown."]
  }, "What if rubber disappeared for five seconds?"), /missing information/);
  assert.throws(() => validateAIInterpretation({
    ...supportedPlan,
    conflicts: ["The prompt specifies both five and ten seconds."]
  }, "What if rubber disappeared for five seconds?"), /conflicting assumptions/);
  assert.throws(() => validateAIInterpretation({
    ...supportedPlan,
    requiredSystems: [
      { id: "traffic-kinematics", reason: "Vehicle movement." },
      { id: "rigid-body-physics", reason: "Collision response." }
    ]
  }, "What if rubber disappeared for five seconds?"), /unavailable simulation systems/);
});

test("AI will not accept the registered model when five seconds were not explicit in the user's prompt", () => {
  assert.throws(() => validateAIInterpretation(supportedPlan, "What if all rubber disappeared?"), /explicitly describe.*five seconds/);
  assert.throws(() => validateAIInterpretation(supportedPlan, "What if rubber disappeared for 10 seconds?"), /explicitly describe.*five seconds/);
});
