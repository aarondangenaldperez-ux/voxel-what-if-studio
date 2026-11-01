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

This aligns the scene's time input with the application playhead; it does **not** yet make every scene pose a pure function of an absolute timestamp. Several objects still use interpolation from their previous transform, and some environment animations are gated by the playing state. Those need a separate state-at-time refactor and dedicated tests.

Video export remains real-time browser capture. It is not fixed-frame, offline rendering. The Canvas capture `requestFrame()` method allows manual capture requests when supported, but MDN marks that method as limited availability; the existing automatic-rate `captureStream(fps)` fallback is therefore retained. Browser animation callbacks may be paused or throttled while a tab is hidden, so exports still require the tab to remain visible.

### Follow-up priorities

1. Convert history-dependent visual transitions into explicit, timestamp-derived scene state.
2. Exercise the actual production video-export function in an end-to-end browser test, including file type, duration, and non-empty output.
3. Add a clear interruption/error path when the tab becomes hidden during export.
4. Test long exports and real mobile browsers; desktop headless Chromium is not a substitute for Android/iOS device QA.

### References

- [Three.js Clock documentation](https://threejs.org/docs/pages/Clock.html)
- [MDN: HTMLCanvasElement.captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [MDN: CanvasCaptureMediaStreamTrack.requestFrame()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasCaptureMediaStreamTrack/requestFrame)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
