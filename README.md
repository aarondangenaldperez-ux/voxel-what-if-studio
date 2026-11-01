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
- Browser-rendered 1080×1920, 30fps video capture with burned-in storyboard captions; MP4 is used only when the browser reports native MP4 recording support, otherwise the real output is WebM
- Lazy-loaded 3D engine to reduce the initial application bundle
- Scenario classification tests plus scene-construction/animation smoke tests for all six added environments
- Bounded GitHub Pages deployment workflow that runs tests before publishing

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

The application does not yet include AI/LLM story generation, a rigged presenter, reusable GLB character animation, general physics simulation, voice narration, or sound design. Video export is an initial browser-based real-time render with burned-in storyboard captions and no audio track. MP4 depends on native browser MediaRecorder support; WebM is the fallback and is never renamed to MP4. Rendering runs in the active browser tab, so the tab must remain open and visible. Export has not yet passed full-device Android/iOS QA or long-duration playback validation.
