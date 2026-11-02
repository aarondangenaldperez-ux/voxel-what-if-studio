import { createServer as createHttpServer } from "node:http";
import { interpretScenarioWithAI } from "./aiProvider.js";

const MAX_BODY_BYTES = 12 * 1024;
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;

function send(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

export function createAppServer({ env = process.env, interpret = interpretScenarioWithAI, now = () => Date.now() } = {}) {
  const rateLimit = new Map();
  const allowedOrigin = String(env.APP_ORIGIN || "").trim();

  return createHttpServer(async (request, response) => {
    const origin = request.headers.origin;
    if (allowedOrigin && origin && origin !== allowedOrigin) {
      send(response, 403, { error: "Origin not allowed." });
      return;
    }
    if (allowedOrigin && origin === allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/api/health") {
      send(response, 200, { status: "ok", aiConfigured: Boolean(env.AI_API_KEY && env.AI_MODEL) });
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/interpret") {
      send(response, 404, { error: "Not found." });
      return;
    }

    const client = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0].trim();
    const current = now();
    const recent = (rateLimit.get(client) || []).filter((timestamp) => current - timestamp < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      send(response, 429, { error: "Too many interpretation requests. Try again in a minute." });
      return;
    }
    recent.push(current);
    rateLimit.set(client, recent);
    if (rateLimit.size > 1000) {
      for (const [ip, entries] of rateLimit) {
        if (entries.every((timestamp) => current - timestamp >= WINDOW_MS)) rateLimit.delete(ip);
      }
    }

    try {
      if (!String(request.headers["content-type"] || "").includes("application/json")) {
        send(response, 415, { error: "Content-Type must be application/json." });
        return;
      }
      const body = await readJson(request);
      const plan = await interpret({ prompt: body?.prompt, env });
      send(response, 200, { plan });
    } catch (error) {
      send(response, error.statusCode || 502, { error: error.message || "AI interpretation failed." });
    }
  });
}
