const RULES = [
  ["airport", /\b(airport|airplane|aircraft|flight|runway|terminal|pilot|jet)\b/i],
  ["school", /\b(school|classroom|student|teacher|campus|playground|schoolbus|school bus)\b/i],
  ["ocean", /\b(ocean|underwater|sea floor|seafloor|seawater|submarine|coral|marine|deep sea|shipwreck)\b/i],
  ["space", /\b(space|moon|mars|planet|asteroid|astronaut|orbit|satellite|galaxy)\b/i],
  ["factory", /\b(factory|industrial|manufacturing|assembly line|warehouse|power plant|refinery)\b/i],
  ["nature", /\b(forest|jungle|mountain|desert|volcano|river|waterfall|wildlife|savanna|canyon)\b/i]
];

export function detectEnvironment(prompt) {
  const text = String(prompt || "");
  const match = RULES.find(([, pattern]) => pattern.test(text));
  return match?.[0] || "urban";
}

export const ENVIRONMENT_LABELS = Object.freeze({
  urban: "CITY", airport: "AIRPORT", school: "SCHOOL",
  ocean: "UNDERWATER", space: "SPACE", factory: "FACTORY", nature: "NATURE"
});
