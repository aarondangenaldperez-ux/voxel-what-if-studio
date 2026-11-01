# Voxel What If Studio

A browser-based, vertical-first 3D scenario preview and storyboard prototype built with React, Vite, and Three.js.

## Available in the current prototype

- Prompt-to-storyboard rules for three mapped scenarios: temporary rubber disappearance, temporary loss of gravity, and citywide electricity loss
- Five-beat story structure with a 56-second preview timeline
- Procedural city plus airport, school, underwater, space, factory, and natural environments selected from topic keywords
- Environment-specific set pieces and motion: aircraft/terminal, school campus/bus, coral/fish/submersible, planets/satellite, conveyor/robot arm, forest/river/wildlife
- Real 3D scenario events: tire meshes disappear and vehicles lower, vehicles and pedestrians float during the gravity event, and city lighting/signals dim during the blackout event
- Camera shot changes between establishing, event, detail, aftermath, and resolution beats
- 9:16 scene preview with prompt editing, scene selection, playback, and storyboard text export
- Lazy-loaded 3D engine to reduce the initial application bundle
- Scenario unit tests and bounded GitHub Pages deployment workflow

## Run locally

```bash
npm install
npm run dev
```

## Test and build

```bash
npm test
npm run build
npm run preview
```

## Live preview

https://aarondangenaldperez-ux.github.io/voxel-what-if-studio/

## Honest capability boundary

This is an early deterministic 3D production-engine slice, not an AI video generator yet. Only the three documented city scenario rules have scenario-specific effects. Environment selection is keyword-based and does not imply an AI-generated scenario or scientific simulation. Other prompts are labelled as unmapped and receive a general city preview rather than invented consequences.

The application does not yet include AI/LLM story generation, a rigged presenter, reusable GLB character animation, general physics simulation, voice narration, sound design, synchronized caption tracks, or video-file export. The current preview is real-time 3D rendering; the storyboard export is a text file, not MP4/WebM.
