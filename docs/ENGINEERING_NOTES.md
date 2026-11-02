# Engineering notes

## 2026-11-01 — Shared timeline clock

### Finding

The playback timeline previously had three independent time sources:

- React playback advanced `playheadRef` using `performance.now()`.
- `WorldView` advanced scene animation using a private `THREE.Clock`.
- Video capture advanced captions and export progress from its own animation-frame timestamp.

This allowed the storyboard playhead, 3D animation, and exported captions to drift relative to one another. A timeline seek changed the active beat, but did not seek the 3D scene's elapsed-time source.

### Change made

- The app-owned `playheadRef` is now passed to `WorldView` as `timelineRef`.
- The Three.js render loop reads that shared ref each frame instead of starting an independent `THREE.Clock`.
- During export, each `recordCanvasVideo` time callback writes the new elapsed time into the shared ref. React's visible playhead is refreshed at up to 30 updates per second rather than triggering a state render on every capture callback.
- The browser smoke test checks that the scene's reported timeline follows a beat seek, the timeline end, and reset.
- Pull requests now run the existing build and browser checks. Pull-request runs do not deploy GitHub Pages, and Pages write permissions are scoped to the deploy job.

### Verified scope and limitations

This first phase aligned the scene's time input with the application playhead. The follow-up timestamp refactor now assigns procedural actor, environment, presenter, lighting, mood, and automatic-camera transforms from the current absolute timeline time and beat-local transition progress. Stateful factory stop snapshots and ocean interpolation history were removed. Manual OrbitControls remain intentionally driven by user input, and identical pixels across different GPU/browser implementations are not guaranteed.

Video export remains real-time browser capture. It is not fixed-frame, offline rendering. The Canvas capture `requestFrame()` method allows manual capture requests when supported, but MDN marks that method as limited availability; the existing automatic-rate `captureStream(fps)` fallback is therefore retained. Browser animation callbacks may be paused or throttled while a tab is hidden. The exporter now listens for `visibilitychange`, cancels codec probing or recording, stops active capture tracks, and returns a retry message rather than waiting indefinitely. A successful export still requires the Voxel tab to remain in the foreground.

### Follow-up priorities

1. Exercise the actual production video-export button in an end-to-end browser test, including file type, duration, caption boundaries, and non-empty output.
2. Exercise the app's full 56-second export button and download flow; the current function-level integration fixture is intentionally short.
3. Test long exports and real mobile browsers; desktop headless Chromium is not a substitute for Android/iOS device QA.
4. Profile draw calls, shadow-map cost, geometry/material counts, and frame time on a mid-range Android device.

### References

- [Three.js Clock documentation](https://threejs.org/docs/pages/Clock.html)
- [MDN: HTMLCanvasElement.captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [MDN: CanvasCaptureMediaStreamTrack.requestFrame()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasCaptureMediaStreamTrack/requestFrame)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

## 2026-11-01 — Timestamp-derived scene poses

### Finding

A shared clock alone was not sufficient. Several scene updates still depended on previous rendered transforms or on whether the preview was currently playing. Examples included the ocean fish/submarine interpolation, factory conveyor stop-state snapshots, city actor transform lerps, and presenter gesture lerps. Those implementations could produce different poses when the user scrubbed backward and forward.

### Change made

- Added `src/engine/sceneTimeline.js` for beat-window lookup, beat-local timeline state, fixed-time event envelopes, and pause-adjusted motion time.
- Made the airport, school, ocean, space, factory, and nature environment-builder animations assign transforms from the supplied absolute timestamp.
- Replaced the factory's captured stop positions with a pause-adjusted motion clock derived from the production-stop and production-resume beat boundaries.
- Replaced the ocean's accumulated fish/submarine movement with explicit loss and return transition curves.
- Changed the presenter to assign body, face, blink, and gesture transforms directly from timeline time and mood.
- Extracted city actor pose calculations into a pure function so rubber, gravity, and blackout states can be tested without WebGL.
- Changed automatic camera and mood transitions to derive from the current beat's elapsed time and the previous/current beat definitions.
- Added tests that revisit timestamps in different orders and compare the resulting transforms/pose data.

### Verification boundary

The pure timeline, city-actor, environment-builder, and presenter tests establish that these calculations return the same values for the same inputs. The production-browser smoke test still needs to run against this exact updated PR head. These tests do not establish pixel-identical rendering on different GPUs or prove that the full production export creates a valid complete video file.

### References

- [Three.js Object3D documentation](https://threejs.org/docs/pages/Object3D.html)
- [Three.js matrix transformations manual](https://threejs.org/manual/pages/matrix-transformations.html)

## 2026-11-02 — Full-app encoder probe ordering

### Finding

The standalone exporter integration fixture passed, but the full application export failed during codec probing. The UI was calling `target.setOutputSize(1080, 1920)` before entering `recordCanvasVideo()`. That made the continuously running Three.js renderer switch to a large software-rendered WebGL buffer while the exporter was performing its short MediaRecorder capability probes. The standalone fixture did not run that expensive full-resolution scene render, which explained the difference between the two test paths.

### Change made

- Added a `prepareSourceCanvas` callback to `recordCanvasVideo()`, invoked only after a working MediaRecorder format has been selected and before the final composition canvas begins capturing.
- Moved the app's 1080×1920 renderer resize and two-frame settling step into that callback. Encoder probing now happens while the interactive preview remains at its normal render size.
- Kept the exporter's existing visibility-change cancellation around both probing and source preparation.
- Extended the browser exporter integration test to assert that source preparation occurs after the probe recorders have stopped and released their tracks.

### Verification boundary

The ordering is covered by the function-level Chromium integration test. The full app-button export test must pass on the updated PR head to establish that the original CI failure is resolved. This does not replace real Android/iOS testing or long-duration device profiling.
## 2026-11-01 — Production video-export integration test

### Finding

The earlier browser smoke test recorded a hand-written canvas/MediaRecorder sample that only resembled the production exporter. It could prove that Chromium supported basic canvas recording, but it did not execute `recordCanvasVideo()`, verify the project's caption compositor, or check that the exporter's own capture tracks were stopped.

### Change made

- Added `tests/video-export-browser.test.js`, which loads and calls the actual `recordCanvasVideo()` module in Chromium.
- The test uses a short 1.5-second fixture at 320×568 to keep CI practical while exercising the real format-probe, composition-canvas, caption, MediaRecorder, timing, progress, and cleanup code paths.
- It decodes the resulting Blob with a browser video element and verifies non-empty data, video MIME type, duration bounds, dimensions, all three storyboard beats, all three rendered captions, final timeline/progress callbacks, and stopped capture tracks.
- Removed the previous duplicated manual MediaRecorder sample from `tests/browser-smoke.test.js`.
- Updated `npm run test:browser` to run the UI smoke test and exporter integration test sequentially.

### Verification boundary

This test exercises the real export function, but with a short low-resolution fixture. It does not yet click the app's full 56-second export button or prove long-duration 1080×1920 performance on Android/iOS hardware. Those remain separate integration and device-QA tasks.
## 2026-11-01 — Export interruption when the tab is hidden

### Finding

The Page Visibility API reports when a tab becomes hidden. Browsers commonly throttle or pause animation-frame callbacks in hidden tabs, which can stall a real-time canvas capture loop.

### Change made

- Added a document visibility listener before encoder probing begins.
- Passed an abort signal through encoder selection and its short MediaRecorder capability probes.
- If the document becomes hidden during probing or recording, the exporter stops the recorder and all capture tracks, removes its listeners, and rejects with an actionable foreground-tab retry message.
- Kept the automatic-rate `captureStream(fps)` fallback for browsers that do not expose manual `requestFrame()`.

### Verification

A unit test checks that encoder selection propagates cancellation. The Chromium integration test simulates a hidden document while the production recorder is active, verifies the clear interruption message, and confirms that probe and export tracks are stopped.

### Reference

- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: Document visibilitychange event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)



## 2026-11-02 — VWS-ENGINE-001 first simulation and AI service slice

### Repository audit finding

The application is a static React/Vite/Three.js client deployed to GitHub Pages. Scenario plans are selected by regular expressions and environment keywords. Several visual effects are time-derived, but there was no shared entity-state schema, quantitative result comparison, general physics solver, AI service, or server runtime.

### Implemented

- Added `src/engine/simulation/cityTrafficModel.js`, a deterministic time-addressable kinematic model for the three city vehicles in the five-second tire-loss scenario.
- The model evaluates a no-event baseline and a braking/hold/recovery scenario, then reports mean travel distance, travel-distance shortfall, and stopped vehicle-seconds.
- Stable entity IDs are assigned by `cityEnvironment.js`. `WorldView.jsx` samples the model on each timeline render and applies its vehicle position, body drop, and wheel-presence state to the matching Three.js groups.
- `SimulationInsights.jsx` and `AIInterpretation.jsx` show computed results and AI interpretation separately from the scene.
- Added a protected Node API service in `server/`, a strict plan contract in `src/engine/ai/planContract.js`, and server-only provider configuration. Only the registered traffic model and exact authored event window can be approved for execution.
- Added unit and HTTP tests for model calculations, model validation, provider handling, and server request behavior.

### Verification boundary and blockers

- AI inference is real when the server is configured, but this repository has no API key, model choice, or separate production server host configured. No secret was added to the browser or repository. The AI control will report unavailable until the service is configured.
- The quantitative traffic model uses Three.js scene units and explicit illustrative acceleration parameters. It is deterministic and testable, but not a calibrated road-traffic, tire-friction, collision, or real-world speed model.
- Gravity, electricity, factory, and ocean scene effects have not yet been upgraded to quantitative simulation models.
- The existing full-app video-export Chromium test remains a separate release check; this engine milestone does not change or waive its acceptance criteria.


## 2026-11-02 — Tightened scenario and AI execution gates

- The tire-loss map now requires both a tire/rubber subject, a disappearance/loss action, and an explicit five-second duration. A prompt about changing tires every five seconds or an unspecified duration no longer triggers the quantitative model.
- The AI plan validator applies the same prompt requirements and exact 8–13 second event / 33 second recovery contract.
- AI plans must name at least one recognized simulation system. Supported plans must identify the registered traffic-kinematics model, and are blocked if they require unavailable systems, omit necessary information, or report conflicting assumptions.
- The visualization uses model-computed wheel rotation from travel distance and wheel radius; tire restoration at 13 seconds is distinct from traffic restart at 33 seconds.


## 2026-11-02 — Fixed-rate export capture

### Finding

The full-app Chromium test measured an encoded 56-second scene at 52.642 seconds while the standalone exporter fixture passed. The full application uses a costly 1080×1920 Three.js scene in software-rendered Chromium. The manual `CanvasCaptureMediaStreamTrack.requestFrame()` path did not maintain the nominal cadence under that rendering load; the encoded file contained fewer sequential frames and therefore a shorter media timeline.

### Change

- The composition canvas now uses `captureStream(fps)` rather than a zero-rate stream driven by manual `requestFrame()` calls.
- The Three.js scene and caption compositor remain timestamp-driven; the browser capture track samples the changing composition canvas at the requested fixed rate.
- The product's export preset is now 1080×1920 at 24fps, a standard video cadence with a lower capture/rendering budget than 30fps.
- The exporter allows one extra animation-frame turn after the final composition frame before stopping the recorder, so the final canvas update can be captured.

### Verification boundary

The exact full-app encoded duration and 1080×1920 dimensions must pass in Chromium. This does not establish 24fps performance or image quality on Android/iOS devices; real-device QA remains outstanding.


## 2026-11-02 — Balanced 1080p output render scale

The full-app export test reached 53.851 seconds with a fixed-rate 24fps canvas track, improving over the earlier manual-capture result but still below the 56-second acceptance window on software-rendered Chromium. To reduce WebGL pixel cost without changing the final portrait aspect ratio or encoded file dimensions, the balanced export preset now renders the scene at 900×1600 and scales it into the 1080×1920 composition canvas using high-quality canvas image smoothing. The encoded dimensions remain 1080×1920. This is a deliberate render-resolution trade-off, not native 1080p scene detail, and must be assessed on real target devices.
