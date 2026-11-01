const RULES = [
  {
    id: "rubber",
    pattern: /\b(rubber|tires?|tyres?)\b/i,
    label: "RUBBER DISAPPEARS",
    phenomenon: "All rubber disappears for five seconds",
    environment: "urban",
    supported: true,
    eventType: "rubber-loss",
    beats: [
      ["00:00", "A normal city morning", "Cars, pedestrians and traffic move through an ordinary city street.", "The city carries on as usual.", "normal", "establish"],
      ["00:08", "The rubber disappears", "Every tire loses its rubber at the same instant. The change is visible on every vehicle.", "All rubber vanishes. Five seconds begin now.", "rubber-loss", "event"],
      ["00:18", "The street grinds to a halt", "Vehicles settle lower and stop moving while pedestrians react to the sudden change.", "Without tires, traffic has to stop.", "traffic-paused", "detail"],
      ["00:32", "The countdown reaches zero", "The missing material remains absent for the final moments of the event.", "The five seconds are almost over.", "countdown", "aftermath"],
      ["00:48", "Rubber returns", "Tires reappear and the vehicles return to their normal height. Traffic can move again.", "Rubber returns. The city resumes.", "restored", "resolve"]
    ]
  },
  {
    id: "gravity",
    pattern: /\b(gravity|weightless|weightlessness)\b/i,
    label: "GRAVITY DISAPPEARS",
    phenomenon: "Gravity disappears temporarily",
    environment: "urban",
    supported: true,
    eventType: "gravity-loss",
    beats: [
      ["00:00", "A normal day on Earth", "People and vehicles behave normally under everyday gravity.", "Everything stays firmly on the ground.", "normal", "establish"],
      ["00:08", "Gravity switches off", "People, vehicles and loose objects begin to lift from the street.", "Gravity disappears. The world begins to float.", "gravity-loss", "event"],
      ["00:18", "The city becomes weightless", "Pedestrians and vehicles drift gently above their original positions.", "Nothing is being pulled toward the ground.", "weightless", "detail"],
      ["00:32", "Five seconds of weightlessness", "The floating scene holds while the countdown approaches its end.", "Five seconds. Then gravity returns.", "countdown", "aftermath"],
      ["00:48", "Gravity returns", "People and vehicles settle back to their original positions.", "Gravity switches back on.", "restored", "resolve"]
    ]
  },
  {
    id: "electricity",
    pattern: /\b(electricity|power|blackout|electric grid)\b/i,
    label: "POWER DISAPPEARS",
    phenomenon: "Electricity disappears across the city",
    environment: "urban",
    supported: true,
    eventType: "power-loss",
    beats: [
      ["00:00", "A fully powered city", "Building windows, streetlights and traffic signals are illuminated.", "The city runs on electricity.", "normal", "establish"],
      ["00:08", "The power cuts out", "Illuminated windows, streetlights and traffic signals go dark together.", "Electricity disappears across the city.", "power-loss", "event"],
      ["00:18", "The city loses its signals", "Traffic signals and illuminated signs remain dark as vehicles slow and wait.", "The systems people rely on go quiet.", "blackout", "detail"],
      ["00:32", "The blackout continues", "The city remains dim while non-electric daylight and the street environment remain visible.", "The grid is still offline.", "countdown", "aftermath"],
      ["00:48", "Power is restored", "Streetlights, windows and traffic signals illuminate again.", "Electricity returns to the city.", "restored", "resolve"]
    ]
  }
];

export function buildScenarioPlan(prompt) {
  const text = String(prompt || "").trim();
  const rule = RULES.find(function (item) { return item.pattern.test(text); });
  const selected = rule || {
    id: "exploration",
    label: "SCENARIO EXPLORATION",
    phenomenon: "Unmapped What If scenario",
    environment: "urban",
    supported: false,
    eventType: "generic",
    beats: [
      ["00:00", "Establish the world", "A procedural city provides a visual setting for the idea.", "Start with an ordinary city.", "normal", "establish"],
      ["00:08", "Introduce the question", "The selected topic is shown, but no specific physical effect is assumed.", "What changes when this happens?", "unmapped", "event"],
      ["00:18", "Explore the setting", "Inspect the environment while the scenario is awaiting a dedicated rule.", "The scene is ready for a mapped event.", "unmapped", "detail"],
      ["00:32", "Consider the consequences", "This preview does not invent scientific consequences for an unmapped topic.", "A scenario-specific rule is needed here.", "unmapped", "aftermath"],
      ["00:48", "Return to the prompt", "The prompt remains available for a future scenario rule or connected story planner.", "This is an environment preview, not a generated prediction.", "unmapped", "resolve"]
    ]
  };

  const beats = selected.beats.map(function (row, index) {
    return {
      index: index,
      time: row[0],
      title: row[1],
      note: row[2],
      caption: row[3],
      event: row[4],
      camera: row[5],
      mood: ["calm", "shock", "warning", "chaos", "aftermath"][index]
    };
  });

  return {
    id: selected.id,
    prompt: text,
    label: selected.label,
    phenomenon: selected.phenomenon,
    environment: selected.environment,
    supported: selected.supported,
    eventType: selected.eventType,
    durationSeconds: 56,
    beats: beats
  };
}
