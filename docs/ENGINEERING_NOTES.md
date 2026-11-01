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

Video export remains real-time browser capture. It is not fixed-frame, offline rendering. The Canvas capture `requestFrame()` method allows manual capture requests when supported, but MDN marks that method as limited availability; the existing automatic-rate `captureStream(fps)` fallback is therefore retained. Browser animation callbacks may be paused or throttled while a tab is hidden, so exports still require the tab to remain visible.

### Follow-up priorities

1. Exercise the actual production video-export button in an end-to-end browser test, including file type, duration, caption boundaries, and non-empty output.
2. Add a clear interruption/error path when the tab becomes hidden during export.
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

