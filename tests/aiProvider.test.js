import test from "node:test";
import assert from "node:assert/strict";
import { interpretScenarioWithAI } from "../server/aiProvider.js";

const plan = {
  schemaVersion: 1, classification: "supported", title: "Tire loss",
  summary: "A five-second tire-loss event in the city traffic model.",
  simulationModelId: "city-traffic-kinematics-v1",
  event: { type: "rubber-loss", startSeconds: 8, durationSeconds: 5, recoveryStartSeconds: 33 },
  entities: [{ id: "car", type: "vehicle", label: "City vehicle" }],
  variables: [{ name: "duration", value: 5, unit: "seconds" }],
  relationships: ["Tire loss initiates braking."],
  requiredSystems: [{ id: "traffic-kinematics", reason: "The registered model uses bounded kinematics." }],
  missingInformation: [],
  conflicts: [],
  facts: ["The user asked for tire loss."],
  assumptions: ["The current city scene is used."],
  limitations: ["No tire-road friction model is available."]
};

test("AI provider sends the secret only in server-side authorization and validates its JSON plan", async () => {
  let request;
  const result = await interpretScenarioWithAI({
    prompt: "What if rubber disappeared for five seconds?",
    env: { AI_API_KEY: "server-secret", AI_MODEL: "test-model", AI_API_BASE_URL: "https://provider.example/v1" },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) } }] }) };
    }
  });
  assert.equal(request.url, "https://provider.example/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer server-secret");
  assert.equal(result.classification, "supported");
  assert.equal(result.simulationModelId, "city-traffic-kinematics-v1");
  assert.equal(result.requiredSystems[0].available, true);
});

test("AI provider refuses to run without server-side key and model configuration", async () => {
  await assert.rejects(
    interpretScenarioWithAI({ prompt: "What if the Moon vanished?", env: {} }),
    (error) => error.statusCode === 503 && /not configured/.test(error.message)
  );
});

test("AI provider rejects malformed or unsafe model output instead of executing it", async () => {
  await assert.rejects(
    interpretScenarioWithAI({
      prompt: "What if rubber disappeared for five seconds?",
      env: { AI_API_KEY: "server-secret", AI_MODEL: "test-model" },
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"schemaVersion":1,"classification":"supported","simulationModelId":"run-this-code"}' } }] }) })
    }),
    /title|not registered/
  );
});

test("AI provider rejects unencrypted configured endpoints", async () => {
  await assert.rejects(
    interpretScenarioWithAI({
      prompt: "What if rubber disappeared for five seconds?",
      env: { AI_API_KEY: "server-secret", AI_MODEL: "test-model", AI_API_BASE_URL: "http://insecure.example/v1" }
    }),
    /HTTPS/
  );
});
