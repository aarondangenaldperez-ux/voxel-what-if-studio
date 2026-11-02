# Voxel What If Studio

A browser-based 3D scenario studio with a deterministic simulation core and an optional server-backed AI interpreter, built with React, Vite, and Three.js.

## Available in the current prototype

- Prompt-to-storyboard rules for five mapped scenarios: temporary rubber disappearance, temporary loss of gravity, citywide electricity loss, a factory production-line stop, and ocean disappearance
- Five-beat story structure with a 56-second preview timeline
- One app-owned playhead clock shared by scene animation, beat selection, scrubbing, and export timing
- Timestamp-derived transforms for the procedural presenter and airport, school, ocean, space, factory, and nature environment animations
- Procedural city plus airport, school, underwater, space, factory, and natural environments selected from topic keywords
- Environment-specific set pieces and motion: aircraft/terminal, school campus/bus, coral/fish/submersible, planets/satellite, conveyor/robot arm, forest/river/wildlife
- Real 3D scenario events: tire meshes disappear and vehicles lower, vehicles and pedestrians float during the gravity event, city lighting/signals dim during the blackout event, factory conveyor crates and rollers stop/restart, and the underwater surface/fish respond to ocean loss and return
- Camera shot changes between establishing, presenter-led medium/close-up, aftermath, and resolution beats; users can switch to free OrbitControls
- Procedural voxel presenter with separately named head, face, hoodie, and limb parts, animated mouth/eye/brow gestures, and a host visibility toggle
- Continuous 56-second timeline playhead with sub-second scrubbing, keyboard controls, and beat-start seeking
- Live scene-lighting intensity control for hemisphere, key, and fill lights
- 9:16 scene preview with prompt editing, scene selection, playback, and storyboard text export
- Browser-rendered 1080×1920, 30fps video capture with burned-in storyboard captions; each advertised MP4/WebM encoder is tested with a short sample before the Three.js source canvas is upscaled for export, and the first encoder producing data is selected
- Lazy-loaded 3D engine to reduce the initial application bundle
- Mobile-aware WebGL quality cap (maximum 1.25 device pixel ratio on compact viewports) to reduce GPU load, plus an in-scene recovery notice if the browser loses the WebGL context
- Scenario classification tests plus scene-construction/animation smoke tests for all six added environments
- Chromium integration test calls the actual `recordCanvasVideo()` exporter and validates a playable encoded clip, beat timing, rendered captions, completion progress, and capture-track cleanup
- Video export cancels cleanly with a retry message if the browser tab becomes hidden
- Bounded GitHub Pages deployment workflow that runs tests before publishing

## Simulation engine — first registered model

The repository includes the first explicit computational model, `city-traffic-kinematics-v1`, for the mapped five-second tire-loss scenario.

- Each city vehicle has a stable entity ID, position, heading, speed, and motion state.
- Baseline travel and affected travel are calculated separately using bounded constant-deceleration and constant-acceleration kinematics.
- The five-second tire-loss event runs from 00:08 to 00:13. Tires reappear at 00:13 while modeled traffic remains stopped until the storyboard recovery beat at 00:33; braking, stopped, and recovery phases are deterministic and seekable. The calculated state controls actual Three.js car position, body drop, and wheel visibility.
- Results include baseline-vs-scenario mean travel distance, travel-distance shortfall, and stopped vehicle-seconds.
- The model uses **Three.js scene units**, not SI units. It is not a calibrated traffic forecast, vehicle-dynamics model, collision solver, or tire-road friction simulation.

## AI interpretation service

A separate Node server exposes `POST /api/interpret`. It calls a configured OpenAI-compatible chat-completions endpoint from the server, validates returned JSON against a strict allow-listed contract, and rejects unregistered simulation model IDs. Generated text is never treated as executable code.

The browser never receives `AI_API_KEY`. The current AI contract can approve only an explicitly described five-second city tire-disappearance scenario, with exact event and recovery timing. Other prompts must be returned as unsupported until a suitable model exists. It also requires the AI to identify needed simulation systems and disclose missing information/conflicts; a supported plan with unresolved information or unavailable systems is rejected.

### Run locally

Install dependencies, then run the API and Vite in separate terminals:

```bash
npm install
npm run dev:api
npm run dev
```

Configure the API process with server-side environment variables:

- `AI_API_KEY` — provider key; never place this in `VITE_*` variables or commit it.
- `AI_MODEL` — model name supported by the configured provider.
- `AI_API_BASE_URL` — optional HTTPS base URL, defaults to `https://api.openai.com/v1`.
- `APP_ORIGIN` — optional exact browser origin allowed by the API for cross-origin hosting.
- `PORT` — optional API listen port, defaults to `8787`.

For a separately hosted production API, set the public, non-secret `VITE_AI_API_URL` at Vite build time to the API origin. Set the API's `APP_ORIGIN` to the deployed studio origin. In local development, Vite proxies `/api` to `http://127.0.0.1:8787`; override with `AI_API_SERVER_URL` if needed.


## Test and build

```bash
npm test
npm run build
npm run preview
```

## Live preview

https://aarondangenaldperez-ux.github.io/voxel-what-if-studio/

## Honest capability boundary

This is an early simulation-engine foundation, not a general-purpose scientific simulator or AI video generator. The tire-loss traffic model is the only registered quantitative simulation model. The other mapped scene rules (gravity and electricity in the city, production stop in a factory, and ocean disappearance underwater) still use deterministic authored visual effects and must not be presented as quantitative physics or environmental models. Environment selection is keyword-based. The optional AI endpoint performs genuine inference only when server-side provider configuration and a separate API host are available; GitHub Pages alone cannot run that server.

The app-owned playhead is the shared time source for scene animation and storyboard/export timing. Procedural environment and presenter transforms are now assigned from absolute timeline time, and automatic camera/mood transitions use beat-local time rather than accumulated render history. Pixel-identical output across different GPUs/browsers is not guaranteed, and manual OrbitControls remain user-input-driven. Export is still a real-time browser capture, not an offline fixed-frame renderer.

The presenter is procedural geometry animated through pivot groups, not a skinned GLB rig; mouth gestures are not synchronized to audio. The application does not yet include broad-domain AI planning, reusable GLB character animation, general physics simulation, population or fluid models, voice narration, or sound design. The AI service is an implemented, separately deployable integration boundary but is not live on GitHub Pages until an API host and server-side provider configuration are supplied. Video export is an initial browser-based real-time render with burned-in storyboard captions and no audio track. MP4 depends on a successful browser MediaRecorder sample test; WebM is the fallback and is never renamed to MP4. Rendering runs in the active browser tab, so the tab must remain in the foreground; hiding it cancels the export cleanly and requires a retry. Export has not yet passed full-device Android/iOS QA, a full 56-second app-button export test, or long-duration playback validation.
