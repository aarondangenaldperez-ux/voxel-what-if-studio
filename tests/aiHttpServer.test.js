import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../server/httpServer.js";

async function withServer(options, run) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("AI server exposes configuration status without disclosing credentials", async () => {
  await withServer({ env: { AI_API_KEY: "private", AI_MODEL: "configured" } }, async (base) => {
    const response = await fetch(base + "/api/health");
    const body = await response.json();
    assert.equal(body.aiConfigured, true);
    assert.equal(JSON.stringify(body).includes("private"), false);
  });
});

test("AI endpoint validates requests and surfaces missing server configuration", async () => {
  await withServer({ env: {} }, async (base) => {
    const invalid = await fetch(base + "/api/interpret", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "no" })
    });
    assert.equal(invalid.status, 400);
    const missing = await fetch(base + "/api/interpret", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What if the Moon vanished?" })
    });
    assert.equal(missing.status, 503);
    assert.match((await missing.json()).error, /not configured/);
  });
});

test("AI endpoint returns validated plans and enforces configured origin policy", async () => {
  const validPlan = {
    schemaVersion: 1, classification: "unsupported", title: "Moon vanished",
    summary: "No registered model can calculate this event.", simulationModelId: null, event: null,
    entities: [], variables: [], relationships: [], facts: [],
    assumptions: ["An orbital dynamics model is required."], limitations: ["Not currently supported."]
  };
  await withServer({
    env: { APP_ORIGIN: "https://studio.example" },
    interpret: async ({ prompt }) => ({ ...validPlan, prompt })
  }, async (base) => {
    const forbidden = await fetch(base + "/api/health", { headers: { Origin: "https://evil.example" } });
    assert.equal(forbidden.status, 403);
    const response = await fetch(base + "/api/interpret", {
      method: "POST",
      headers: { Origin: "https://studio.example", "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What if the Moon vanished?" })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.plan.classification, "unsupported");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://studio.example");
  });
});
