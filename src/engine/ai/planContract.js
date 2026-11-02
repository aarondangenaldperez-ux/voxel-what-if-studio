const MAX_TEXT = 500;
const ALLOWED_ENTITY_TYPES = new Set(["vehicle", "tire", "road", "traffic-signal", "pedestrian", "environment"]);
const ALLOWED_MODEL_ID = "city-traffic-kinematics-v1";

function cleanText(value, label, maxLength = MAX_TEXT) {
  if (typeof value !== "string") throw new TypeError(label + " must be text.");
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > maxLength) throw new RangeError(label + " must contain 1 to " + maxLength + " characters.");
  return cleaned;
}

function textList(value, label, maximum = 8) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(label + " must be an array with at most " + maximum + " items.");
  return value.map((item, index) => cleanText(item, label + "[" + index + "]", 300));
}

/**
 * Treat all LLM output as untrusted data. Only a registered simulation model
 * and a tightly bounded event contract can cross into the computation layer.
 */
export function validateAIInterpretation(raw, originalPrompt) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("The AI response must be a JSON object.");
  }
  if (raw.schemaVersion !== 1) throw new RangeError("Unsupported AI plan schema version.");
  const prompt = cleanText(originalPrompt, "prompt", 280);
  const classification = raw.classification;
  if (classification !== "supported" && classification !== "unsupported") {
    throw new TypeError("classification must be supported or unsupported.");
  }

  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  if (entities.length > 20) throw new RangeError("The AI plan contains too many entities.");
  const seenIds = new Set();
  const safeEntities = entities.map((entity, index) => {
    const id = cleanText(entity?.id, "entity id", 48);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || seenIds.has(id)) {
      throw new TypeError("AI entity identifiers must be unique and contain only letters, numbers, underscores, or hyphens.");
    }
    seenIds.add(id);
    if (!ALLOWED_ENTITY_TYPES.has(entity?.type)) throw new TypeError("Unsupported AI entity type.");
    return { id, type: entity.type, label: cleanText(entity.label, "entity label", 80) };
  });

  const variables = Array.isArray(raw.variables) ? raw.variables : [];
  if (variables.length > 20) throw new RangeError("The AI plan contains too many variables.");
  const safeVariables = variables.map((variable, index) => {
    const value = Number(variable?.value);
    if (!Number.isFinite(value) || Math.abs(value) > 1e9) {
      throw new TypeError("AI variable " + index + " must have a finite, bounded numeric value.");
    }
    return {
      name: cleanText(variable.name, "variable name", 64),
      value,
      unit: cleanText(variable.unit || "unspecified", "variable unit", 40)
    };
  });

  const simulationModelId = raw.simulationModelId === null ? null : cleanText(raw.simulationModelId, "simulationModelId", 64);
  let event = null;
  if (classification === "supported") {
    if (simulationModelId !== ALLOWED_MODEL_ID) {
      throw new TypeError("The AI selected a simulation model that is not registered.");
    }
    if (!raw.event || raw.event.type !== "rubber-loss") {
      throw new TypeError("The registered traffic model currently requires a rubber-loss event.");
    }
    const startSeconds = Number(raw.event.startSeconds);
    const durationSeconds = Number(raw.event.durationSeconds);
    // This is the currently authored and tested event window. The planner may
    // identify it, but cannot silently alter the model's scientific contract.
    if (startSeconds !== 8 || durationSeconds !== 5) {
      throw new RangeError("The current tire-loss model supports only the validated 8-to-13-second event window.");
    }
    event = { type: "rubber-loss", startSeconds, durationSeconds };
  } else if (simulationModelId !== null || raw.event !== null) {
    throw new TypeError("Unsupported scenarios must not request execution of an unregistered model.");
  }

  return Object.freeze({
    schemaVersion: 1,
    prompt,
    classification,
    title: cleanText(raw.title, "title", 100),
    summary: cleanText(raw.summary, "summary", 600),
    simulationModelId,
    event,
    entities: Object.freeze(safeEntities),
    variables: Object.freeze(safeVariables),
    relationships: Object.freeze(textList(raw.relationships || [], "relationships", 12)),
    facts: Object.freeze(textList(raw.facts || [], "facts", 8)),
    assumptions: Object.freeze(textList(raw.assumptions || [], "assumptions", 10)),
    limitations: Object.freeze(textList(raw.limitations || [], "limitations", 10))
  });
}

export const AI_PLAN_SCHEMA_VERSION = 1;
export const REGISTERED_SIMULATION_MODELS = Object.freeze([ALLOWED_MODEL_ID]);
