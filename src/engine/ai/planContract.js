const MAX_TEXT = 500;
const ALLOWED_ENTITY_TYPES = new Set(["vehicle", "tire", "road", "traffic-signal", "pedestrian", "environment"]);
const ALLOWED_MODEL_ID = "city-traffic-kinematics-v1";
const ALLOWED_REQUIRED_SYSTEMS = new Set([
  "traffic-kinematics", "rigid-body-physics", "fluid-dynamics",
  "orbital-mechanics", "agent-based-population", "environmental-dynamics", "unknown"
]);

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
    const recoveryStartSeconds = Number(raw.event.recoveryStartSeconds);
    // The user must explicitly state the supported duration. The model cannot
    // silently fill missing scenario parameters or accept AI-altered timings.
    const mentionsTireLoss = /\b(?:rubber|tires?|tyres?)\b/i.test(prompt);
    const describesDisappearance = /\b(?:disappear(?:ed|s|ing)?|vanish(?:ed|es|ing)?|loss|lost|removed)\b/i.test(prompt);
    const statesFiveSeconds = /\b(?:5|five)\s*-?\s*(?:seconds?|secs?|s)\b/i.test(prompt);
    if (!mentionsTireLoss || !describesDisappearance || !statesFiveSeconds) {
      throw new RangeError("The prompt must explicitly describe tires/rubber disappearing for five seconds.");
    }
    if (startSeconds !== 8 || durationSeconds !== 5 || recoveryStartSeconds !== 33) {
      throw new RangeError("The registered model requires event 8–13 seconds and traffic recovery at 33 seconds.");
    }
    event = { type: "rubber-loss", startSeconds, durationSeconds, recoveryStartSeconds };
  } else if (simulationModelId !== null || raw.event !== null) {
    throw new TypeError("Unsupported scenarios must not request execution of an unregistered model.");
  }

  const requiredSystems = Array.isArray(raw.requiredSystems) ? raw.requiredSystems : [];
  if (requiredSystems.length > 8) throw new RangeError("The AI plan requires too many simulation systems.");
  if (requiredSystems.length === 0) {
    throw new TypeError("The AI plan must identify at least one required simulation system.");
  }
  const seenSystems = new Set();
  const safeRequiredSystems = requiredSystems.map((system, index) => {
    if (!ALLOWED_REQUIRED_SYSTEMS.has(system?.id)) throw new TypeError("Unknown required simulation system at index " + index + ".");
    if (seenSystems.has(system.id)) throw new TypeError("Required simulation system IDs must be unique.");
    seenSystems.add(system.id);
    return Object.freeze({
      id: system.id,
      available: system.id === "traffic-kinematics",
      reason: cleanText(system.reason, "required system reason", 220)
    });
  });
  const missingInformation = textList(raw.missingInformation || [], "missingInformation", 8);
  const conflicts = textList(raw.conflicts || [], "conflicts", 8);
  const rawFacts = Array.isArray(raw.facts) ? raw.facts : [];
  if (rawFacts.length > 8) throw new RangeError("The AI plan contains too many facts.");
  const normalizedPrompt = prompt.toLowerCase().replace(/\\s+/g, " ").trim();
  const facts = rawFacts.map((fact, index) => {
    const statement = cleanText(fact?.statement, "fact statement " + index, 220);
    const evidence = cleanText(fact?.evidence, "fact evidence " + index, 160);
    const normalizedEvidence = evidence.toLowerCase().replace(/\\s+/g, " ").trim();
    if (!normalizedPrompt.includes(normalizedEvidence)) {
      throw new TypeError("Fact evidence must be an exact quote from the user's prompt.");
    }
    return Object.freeze({ statement, evidence });
  });
  if (classification === "supported") {
    if (!safeRequiredSystems.some((system) => system.id === "traffic-kinematics" && system.available)) {
      throw new TypeError("A supported traffic plan must declare the registered traffic-kinematics system.");
    }
    if (safeRequiredSystems.some((system) => !system.available)) {
      throw new TypeError("A supported plan cannot require unavailable simulation systems.");
    }
    if (missingInformation.length || conflicts.length) {
      throw new TypeError("A plan with missing information or conflicting assumptions cannot be executed.");
    }
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
    requiredSystems: Object.freeze(safeRequiredSystems),
    missingInformation: Object.freeze(missingInformation),
    conflicts: Object.freeze(conflicts),
    facts: Object.freeze(facts),
    assumptions: Object.freeze(textList(raw.assumptions || [], "assumptions", 10)),
    limitations: Object.freeze(textList(raw.limitations || [], "limitations", 10))
  });
}

export const AI_PLAN_SCHEMA_VERSION = 1;
export const REGISTERED_SIMULATION_MODELS = Object.freeze([ALLOWED_MODEL_ID]);
