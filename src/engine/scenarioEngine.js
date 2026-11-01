import { detectEnvironment } from "./environmentCatalog.js";

const RULES = [
  {
    id: "rubber",
    pattern: /\b(rubber|tires?|tyres?)\b/i,
    label: "RUBBER DISAPPEARS",
    phenomenon: "All rubber disappears for five seconds",
    environment: "urban",
    supported: true,
    beats: [
      ["00:00", "A normal city morning", "Cars, pedestrians and traffic move through an ordinary city street.", "The city carries on as usual.", "normal", "establish", 8],
      ["00:08", "The rubber disappears", "Tires vanish from every vehicle. The interruption is shown for exactly five seconds.", "All rubber vanishes. Five seconds begin now.", "rubber-loss", "event", 5],
      ["00:13", "The tires return", "The missing tires reappear. Vehicles remain stopped briefly as drivers and pedestrians react.", "Five seconds later, the rubber returns.", "traffic-paused", "detail", 14],
      ["00:27", "Traffic begins to recover", "Vehicles begin moving again while the street returns to its ordinary rhythm.", "The city starts moving again.", "recovery", "aftermath", 21],
      ["00:48", "The city resumes", "Traffic, pedestrians and street activity settle into their normal pattern.", "The interruption is over.", "restored", "resolve", 8]
    ]
  },
  {
    id: "gravity",
    pattern: /\b(gravity|weightless|weightlessness)\b/i,
    label: "GRAVITY DISAPPEARS",
    phenomenon: "Gravity disappears temporarily",
    environment: "urban",
    supported: true,
    beats: [
      ["00:00", "A normal day on Earth", "People and vehicles behave normally under everyday gravity.", "Everything stays firmly on the ground.", "normal", "establish", 8],
      ["00:08", "Gravity switches off", "People and vehicles begin to lift from the street for exactly five seconds.", "Gravity disappears. The world begins to float.", "gravity-loss", "event", 5],
      ["00:13", "Gravity returns", "People and vehicles descend toward their original positions as gravity takes effect again.", "Five seconds later, gravity returns.", "gravity-return", "detail", 14],
      ["00:27", "The city reacts", "The environment settles and people regain their footing.", "The city slowly settles back down.", "aftermath", "aftermath", 21],
      ["00:48", "A normal world again", "People and vehicles return to their everyday positions.", "Gravity is back. The world stabilizes.", "restored", "resolve", 8]
    ]
  },
  {
    id: "electricity",
    pattern: /\b(electricity|power|blackout|electric grid)\b/i,
    label: "POWER DISAPPEARS",
    phenomenon: "Electricity disappears across the city",
    environment: "urban",
    supported: true,
    beats: [
      ["00:00", "A fully powered city", "Building windows, streetlights and traffic signals are illuminated.", "The city runs on electricity.", "normal", "establish", 8],
      ["00:08", "The power cuts out", "Illuminated windows, streetlights and traffic signals go dark together.", "Electricity disappears across the city.", "power-loss", "event", 5],
      ["00:13", "The city loses its signals", "Traffic signals and illuminated signs remain dark as vehicles slow and wait.", "The systems people rely on go quiet.", "blackout", "detail", 14],
      ["00:27", "The blackout continues", "The city remains dim while daylight and the street environment remain visible.", "The grid is still offline.", "countdown", "aftermath", 21],
      ["00:48", "Power is restored", "Streetlights, windows and traffic signals illuminate again.", "Electricity returns to the city.", "restored", "resolve", 8]
    ]
  },
  {
    id: "factory",
    pattern: /(?:factory|assembly line|production line).{0,35}(?:stop|stops|stopped|halt|halts|halted|shut down|shutdown)|(?:stop|stops|stopped|halt|halts|halted|shut down|shutdown).{0,35}(?:factory|assembly line|production line)/i,
    label: "FACTORY PRODUCTION STOPS",
    phenomenon: "A factory production line stops unexpectedly",
    environment: "factory",
    supported: true,
    beats: [
      ["00:00", "A factory at full speed", "Conveyor crates move through the line while rollers turn and a robotic arm cycles above the production floor.", "The factory line is running at full speed.", "normal", "establish", 8],
      ["00:08", "Production suddenly stops", "The conveyor motion halts. Crates and rollers stop while the robotic arm moves toward a safe resting position.", "The entire production line stops.", "production-stop", "event", 5],
      ["00:13", "The line remains still", "The conveyor, rollers and robotic arm stay paused while the factory waits for a restart decision.", "The factory remains unusually quiet.", "production-hold", "detail", 14],
      ["00:27", "The line starts moving again", "The conveyor resumes carrying crates, rollers turn, and the robotic arm returns to its operating cycle.", "The production line begins moving again.", "production-resume", "aftermath", 21],
      ["00:48", "Production is restored", "The crates, rollers and robotic arm settle into their regular coordinated motion.", "The factory is back in operation.", "restored", "resolve", 8]
    ]
  },
  {
    id: "ocean",
    pattern: /(?:ocean|oceans|sea|seas|seawater).{0,35}(?:disappear|vanish|evaporat|drain|dry up)|(?:disappear|vanish|evaporat|drain|dry up).{0,35}(?:ocean|oceans|sea|seas|seawater)/i,
    label: "OCEAN DISAPPEARS",
    phenomenon: "The ocean vanishes temporarily",
    environment: "ocean",
    supported: true,
    beats: [
      ["00:00", "A living underwater world", "Fish move above the coral reef while a submarine cruises through the blue water.", "An entire underwater ecosystem depends on the ocean.", "normal", "establish", 8],
      ["00:08", "The ocean disappears", "The water surface vanishes. Fish and the submarine begin descending toward the exposed seabed.", "The ocean disappears in an instant.", "ocean-loss", "event", 5],
      ["00:13", "Marine life is exposed", "The water remains absent while fish settle toward the ocean floor and the submarine loses buoyancy.", "The underwater world is suddenly exposed.", "ocean-hold", "detail", 14],
      ["00:27", "The water returns", "The water surface reappears as fish and the submarine rise back into the water column.", "The ocean rushes back into the scene.", "ocean-return", "aftermath", 21],
      ["00:48", "The reef stabilizes", "Fish resume swimming around the coral and the submarine returns to a steady patrol.", "The underwater ecosystem begins to recover.", "restored", "resolve", 8]
    ]
  },
];

const UNMAPPED_BEATS = [
  ["00:00", "Establish the world", "A procedural city provides a visual setting for the idea.", "Start with an ordinary city.", "normal", "establish", 8],
  ["00:08", "Introduce the question", "The selected topic is shown, but no specific physical effect is assumed.", "What changes when this happens?", "unmapped", "event", 5],
  ["00:13", "Explore the setting", "Inspect the environment while the scenario is awaiting a dedicated rule.", "The scene is ready for a mapped event.", "unmapped", "detail", 14],
  ["00:27", "Consider the consequences", "This preview does not invent scientific consequences for an unmapped topic.", "A scenario-specific rule is needed here.", "unmapped", "aftermath", 21],
  ["00:48", "Return to the prompt", "The prompt remains available for a future scenario rule or connected story planner.", "This is an environment preview, not a generated prediction.", "unmapped", "resolve", 8]
];

function buildBeats(rows) {
  return rows.map(function (row, index) {
    return {
      index: index,
      time: row[0],
      title: row[1],
      note: row[2],
      caption: row[3],
      event: row[4],
      camera: row[5],
      durationSeconds: row[6],
      mood: ["calm", "shock", "warning", "chaos", "aftermath"][index]
    };
  });
}

export function buildScenarioPlan(prompt) {
  const text = String(prompt || "").trim();
  const rule = RULES.find(function (item) { return item.pattern.test(text); });
  const detectedEnvironment = detectEnvironment(text);
  const selected = (rule && detectedEnvironment === rule.environment) ? rule : {
    id: "exploration",
    label: "SCENARIO EXPLORATION",
    phenomenon: "Unmapped What If scenario",
    environment: "urban",
    supported: false,
    beats: UNMAPPED_BEATS
  };
  const beats = buildBeats(selected.beats);
  const durationSeconds = beats.reduce(function (total, beat) {
    return total + beat.durationSeconds;
  }, 0);

  return {
    id: selected.id,
    prompt: text,
    label: selected.label,
    phenomenon: selected.phenomenon,
    environment: detectedEnvironment,
    supported: selected.supported,
    durationSeconds: durationSeconds,
    eventDurationSeconds: selected.id === "rubber" || selected.id === "gravity" ? 5 : null,
    beats: beats
  };
}
