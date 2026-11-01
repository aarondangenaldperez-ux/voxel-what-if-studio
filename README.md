# Voxel What If Studio

A browser-based, vertical-first 3D scenario preview and storyboard prototype built with React, Vite, and Three.js.

## Available in the current prototype

- Prompt-to-storyboard rules for five mapped scenarios: temporary rubber disappearance, temporary loss of gravity, citywide electricity loss, a factory production-line stop, and ocean disappearance
- Five-beat story structure with a 56-second preview timeline
- One app-owned playhead clock shared by scene animation, beat selection, scrubbing, and export timing
- Procedural city plus airport, school, underwater, space, factory, and natural environments selected from topic keywords
- Environment-specific set pieces and motion: aircraft/terminal, school campus/bus, coral/fish/submersible, planets/satellite, conveyor/robot arm, forest/river/wildlife
- Real 3D scenario events: tire meshes disappear and vehicles lower, vehicles and pedestrians float during the gravity event, city lighting/signals dim during the blackout event, factory conveyor crates and rollers stop/restart, and the underwater surface/fish respond to ocean loss and return
- Camera shot changes between establishing, presenter-led medium/close-up, aftermath, and resolution beats; users can switch to free OrbitControls
- Procedural voxel presenter with separately named head, face, hoodie, and limb parts, animated mouth/eye/brow gestures, and a host visibility toggle
- Continuous 56-second timeline playhead with sub-second scrubbing, keyboard controls, and beat-start seeking
- Live scene-lighting intensity control for hemisphere, key, and fill lights
- 9:16 scene preview with prompt editing, scene selection, playback, and storyboard text export
- Browser-rendered 1080×1920, 30fps video capture with burned-in storyboard captions; each advertised MP4/WebM encoder is tested with a short sample before full render, and the first encoder producing data is selected
- Lazy-loaded 3D engine to reduce the initial application bundle
- Mobile-aware WebGL quality cap (maximum 1.25 device pixel ratio on compact viewports) to reduce GPU load, plus an in-scene recovery notice if the browser loses the WebGL context
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

This is an early rule-based 3D production-engine slice, not an AI video generator yet. Only the five documented scenario rules (rubber, gravity and electricity in the city, plus production stop in a factory and ocean disappearance underwater) have scenario-specific effects. Environment selection is keyword-based and does not imply an AI-generated scenario or scientific simulation. Other prompts are labelled as unmapped and use their keyword-selected environment preview rather than invented consequences.

The app-owned playhead is the shared time source for scene animation and storyboard/export timing. Some visual transitions still use interpolation, so seeking from different playback histories is not yet guaranteed to reproduce pixel-identical poses. Export is a real-time browser capture, not an offline fixed-frame renderer.

The presenter is procedural geometry animated through pivot groups, not a skinned GLB rig; mouth gestures are not synchronized to audio. The application does not yet include AI/LLM story generation, reusable GLB character animation, general physics simulation, voice narration, or sound design. Video export is an initial browser-based real-time render with burned-in storyboard captions and no audio track. MP4 depends on a successful browser MediaRecorder sample test; WebM is the fallback and is never renamed to MP4. Rendering runs in the active browser tab, so the tab must remain open and visible. Export has not yet passed full-device Android/iOS QA or long-duration playback validation.
