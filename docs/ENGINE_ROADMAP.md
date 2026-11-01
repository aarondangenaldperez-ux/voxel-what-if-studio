# Voxel What If Studio — Engineering Audit & Roadmap

Audit date: 2026-11-01  
Repository: `aarondangenaldperez-ux/voxel-what-if-studio`

## Executive summary

The current repository is a small React + Vite + Three.js prototype. It is a useful starting point, but it is not yet a 3D video production engine. Its most important shortcoming is not visual styling: there is no scenario-to-scene pipeline, no story-driven animation timeline, and no complete video-render/export pipeline.

The immediate publishing blocker was found and corrected: the npm `build` script previously ran `vite`, which starts the Vite development server. It must run `vite build` to generate the production `dist/` directory.


## Implementation status after the first engine upgrade

### Delivered
- **P0 — Build reliability:** The `build` script now runs `vite build`; CI has a 10-minute build timeout, checks the output directory, and runs scenario tests before deployment.
- **P1 — Scenario model (first slice):** A deterministic scenario interpreter now maps rubber, gravity, and electricity prompts into distinct five-beat storyboards. Unsupported prompts are explicitly labelled as unmapped.
- **P2 — Procedural city (first slice):** The city is now assembled from reusable procedural building, vehicle, pedestrian, streetlight, road, sidewalk, and traffic-signal builders.
- **P3 — Event timeline (first slice):** Timeline playback follows the 56-second beat schedule. Scenario events alter real 3D meshes and materials, and camera shot targets change between beats.
- **Mobile preview:** The preview uses a 9:16 aspect ratio and lazy-loads the Three.js scene engine.
- **Tests:** Four Node test cases cover the three mapped scenarios and the honest fallback for unmapped prompts.

### Not yet delivered
P2 still needs multiple environment builders and a reusable GLB asset pipeline. P3 still needs richer animation curves, character rigs/expressions, authored shot transitions and scene continuity. P4 (actual WebM/MP4 export, audio, caption synchronization and file validation) and P5 (protected LLM integration) remain future milestones.

## What exists today

- React 18 application with a responsive, dark production-workspace UI.
- Vite 6 build tooling.
- Three.js procedural urban/village preview with box-based buildings, roof blocks, windows, roads, trees, ground, lighting, and OrbitControls.
- Five hard-coded storyboard beats.
- Editable What If text field.
- Manual selection of storyboard beats and a basic preview toggle.
- Text-file storyboard download.
- GitHub Actions workflow for GitHub Pages.

## Verified limitations

| Area | Current state | Consequence |
|---|---|---|
| Scenario interpretation | No interpreter; sample beats are fixed | Changing the prompt does not change the story |
| Scene generation | One procedural village | No scenario-specific environments |
| Asset library | Geometry is created inline in one component | Reuse and complexity are difficult to scale |
| Characters | No character rig or character animation | No expressive, consistent people |
| Object animation | Preview toggle makes the beacon rotate and buildings subtly bob | Not meaningful cause-and-effect animation |
| Camera direction | User-controlled orbit only | No authored shot language or camera cuts |
| Story timeline | Five static beats; no clocked playback | No actual timed sequence |
| Captions/narration | Not implemented | No synchronized narration/captions |
| Video export | Storyboard text only | No video file is produced |
| Tests | No automated unit, integration, or render tests | Regressions are difficult to detect |
| External AI | No model/API integration | No genuine AI script or asset generation |

## Prioritized implementation plan

### P0 — Make builds and releases reliable

**Objective:** Every code change must produce a deterministic production build or a clear, bounded failure.

- Use `vite build` for production and keep `vite` for development only.
- Put explicit time limits on CI jobs.
- Verify `dist/index.html` and `dist/assets` before uploading.
- Preserve build logs and report failures honestly.

**Acceptance:** GitHub Actions completes build, artifact upload, and Pages deployment successfully.

### P1 — Introduce a scenario and storyboard data model

**Objective:** A user prompt becomes structured, editable story data rather than static UI text.

- Define a typed-by-convention scenario schema: subject, phenomenon, duration, environment, assets, events, beats, captions, and camera cues.
- Add a deterministic rule-based interpreter for a small, clearly documented set of phenomena.
- Keep the interpreter modular so a real LLM-backed planner can replace or augment it later.
- Add clear unsupported-topic handling; never imply that arbitrary natural language is already understood.

**Acceptance:** At least the rubber-disappearance and temporary-gravity scenarios produce distinct beat plans and event parameters.

### P2 — Build a reusable procedural asset library

**Objective:** Replace the single hard-coded village with reusable scene modules.

- Separate city blocks, roads, sidewalks, intersections, buildings, windows, street furniture, vehicles, trees, and pedestrians into reusable factories.
- Reuse geometries/materials; dispose scene resources predictably.
- Use deterministic seeds so a storyboard can reproduce the same scene.
- Add environment profiles (urban street, residential area, coast/ocean, interior, industrial, and space) in stages.

**Acceptance:** Multiple scene layouts can be built from data using shared assets, not copied code.

### P3 — Create a real animation and camera timeline

**Objective:** Animate story events, not merely decorative motion.

- Use one time source and beat-relative event curves.
- Support object visibility, transforms, interactions, and state restoration.
- Add authored camera shot presets and interpolated camera paths.
- Add simple procedural pedestrian locomotion/reactions first; reserve skeletal GLTF animation for rigs that need it.

**Acceptance:** A scenario visibly changes the world in the relevant beat, restores or resolves the change, and uses multiple intentional camera shots.

### P4 — Add a vertical video render pipeline

**Objective:** Turn the deterministic timeline into an exportable vertical video.

- Provide a dedicated 9:16 render target and 1080×1920 quality preset.
- Capture complete frames at a controlled cadence; do not confuse a live preview with a completed render.
- Start with browser-supported WebM export using MediaRecorder where available.
- Add audio mixing and caption timing as separate tracks.
- Investigate MP4 transcoding only after checking actual browser/platform support; an external encoder or server may be required.

**Acceptance:** Export metadata and playback checks confirm non-zero duration, continuous frames, expected dimensions, and synchronized optional audio/captions.

### P5 — Integrate genuine AI planning and asset sourcing

**Objective:** Expand beyond deterministic templates without pretending to be generative.

- Add a server-side API boundary for an LLM storyboard planner.
- Keep API keys off the browser and out of the repository.
- Validate model output against the scenario schema.
- Use licensed GLB assets or original procedural assets; track asset provenance and licenses.

**Acceptance:** A real configured service generates a schema-valid storyboard; API outages and quota errors are surfaced clearly.

## Recommended architecture

```text
src/
  app/                 UI and workflow state
  engine/
    scenarios/         scenario schema, interpreter, rules
    storyboard/        beats, captions, timing
    environments/      city, nature, interior, space builders
    assets/             reusable meshes/materials/models
    characters/         rigs and procedural actions
    animation/          timeline, event curves, mixers
    camera/             shot presets and camera paths
    rendering/          preview and export targets
    audio/              narration and sound track timing
    export/             MediaRecorder and validation
```

Keep the renderer independent of the UI. The storyboard should be serializable so it can be edited, replayed, tested, and rendered consistently.

## Dependency and product decisions

- Keep Three.js as the rendering foundation; the present scene is already built with it.
- Do not add a physics engine until a specific scenario needs robust collisions or rigid-body simulation.
- Use GLTF/GLB and AnimationMixer for complex reusable characters; use procedural animation for simple stylized pedestrians.
- Use MediaRecorder as the first browser export path, with WebM as the dependable target. MP4 is not universally available in browser MediaRecorder.
- Use an LLM only through a protected backend when natural-language understanding is required. No API key or paid AI integration is currently configured.

## Current release boundary

The current release is a visual prototype. It does **not** yet generate complete What If videos, provide AI narrative generation, generate arbitrary scenario-specific worlds, animate rigged characters, or export MP4. Those capabilities are future milestones and must pass the acceptance checks above before being advertised as available.


## Phase 2 — Procedural environment library

- Added procedural builders for airport, school, underwater, space, factory, and natural environments alongside the original city.
- Added keyword-based environment routing with unit tests; unsupported physical effects remain explicitly unmapped.
- Added environment-specific animated set pieces: taxiing aircraft, school bus and pedestrians, swimming fish and submersible, satellite/spacecraft, factory conveyor and robotic arm, and moving wildlife.
- These are deterministic procedural environments, not AI-generated 3D assets, general scientific simulation, or MP4 production.


### Phase 2 verification expansion

- Added Node smoke tests that instantiate every added environment, count actual Three.js renderable objects, and execute each environment update callback.
- These tests are not a substitute for device/browser visual QA, frame-rate profiling, or a completed recorded-video inspection.
