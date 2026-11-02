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
      ["00:00", "City traffic in motion", "Cars flow through a compact city street while pedestrians move along the sidewalks.", "An ordinary day in the city.", "normal", "establish", 8],
      ["00:08", "Every tire vanishes", "All vehicle tires disappear during an exact five-second interruption. The vehicles drop onto their axles.", "Every tire vanishes. Vehicles slam to a stop.", "rubber-loss", "event", 5],
      ["00:13", "The tires return — traffic stays stranded", "The tires reappear, but the vehicles remain stationary while drivers assess the sudden stoppage.", "The tires return. The traffic remains stranded.", "traffic-paused", "detail", 7],
      ["00:20", "Drivers react", "Pedestrians step back and drivers gesture as the intersection remains blocked.", "Drivers react as the junction locks up.", "traffic-paused", "aftermath", 7],
      ["00:27", "A citywide traffic jam", "A high, wide view reveals stationary vehicles and a queue forming around the intersection.", "The entire junction is at a standstill.", "traffic-paused", "overview", 6],
      ["00:33", "Traffic cautiously restarts", "Cars begin rolling again after the interruption. Movement resumes carefully.", "Traffic begins to move, slowly.", "recovery", "event", 7],
      ["00:40", "The gridlock clears", "Vehicles travel through the junction again as pedestrians return to their routes.", "The queue starts to clear.", "recovery", "aftermath", 8],
      ["00:48", "Normal service resumes", "The city returns to everyday traffic and pedestrian movement.", "The interruption is over.", "restored", "resolve", 8]
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
  ["00:00", "A familiar world", "Establish the everyday setting before exploring the hypothetical.", "Everyday life, in a familiar place.", "normal", "establish", 8],
  ["00:08", "Imagine the impossible", "The question introduces a possibility, but this build does not simulate its physical effects.", "What would change first?", "unmapped", "event", 5],
  ["00:13", "Look closer", "Explore details of the environment without inventing scenario-specific outcomes.", "Every detail shapes the world around us.", "unmapped", "detail", 14],
  ["00:27", "Consider the possibilities", "The consequences remain open until a dedicated scenario simulation exists.", "What might change—and what might stay the same?", "unmapped", "aftermath", 21],
  ["00:48", "A question worth exploring", "This concept preview is a visual setting, not a generated prediction.", "The possibilities begin with one question.", "unmapped", "resolve", 8]
];

function buildBeats(rows, scenarioSupported = true) {
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
      scenarioSupported: Boolean(scenarioSupported),
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
  const beats = buildBeats(selected.beats, selected.supported);
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
