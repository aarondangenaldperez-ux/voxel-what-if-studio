import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Clapperboard, Download, Film, Layers3, Lightbulb, Play,
  RotateCcw, Sparkles, Video, WandSparkles
} from 'lucide-react';
import { getBeatAtTime, recordCanvasVideo } from './engine/videoExport.js';
const WorldView = lazy(() => import('./WorldView.jsx'));
import { buildScenarioPlan } from './engine/scenarioEngine.js';
import SimulationInsights from './SimulationInsights.jsx';
import AIInterpretation from './AIInterpretation.jsx';
import { validateAIInterpretation } from './engine/ai/planContract.js';
import { ENVIRONMENT_LABELS } from './engine/environmentCatalog.js';

function waitForAnimationFrames(signal, frameCount = 2) {
  return new Promise((resolve, reject) => {
    let remaining = frameCount;
    let frameId = 0;
    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : new Error('Video export was interrupted.'));
    };
    const onFrame = () => {
      frameId = 0;
      if (signal.aborted) {
        onAbort();
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        cleanup();
        resolve();
        return;
      }
      frameId = requestAnimationFrame(onFrame);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    frameId = requestAnimationFrame(onFrame);
  });
}

export default function App() {
  const [question, setQuestion] = useState('What if all rubber disappeared for 5 seconds?');
  const [scenario, setScenario] = useState(() => buildScenarioPlan('What if all rubber disappeared for 5 seconds?'));
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cameraMode, setCameraMode] = useState('auto');
  const [lighting, setLighting] = useState(100);
  const [presenterVisible, setPresenterVisible] = useState(true);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const playheadRef = useRef(0);
  const [showNotes, setShowNotes] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const [simulationReport, setSimulationReport] = useState(null);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const captureRef = useRef(null);

  const beats = scenario.beats;
  const active = beats[activeBeatIndex] || beats[0];
  const beatDurationsMs = useMemo(
    () => beats.map((beat) => beat.durationSeconds * 1000),
    [beats]
  );
  const totalDurationMs = beatDurationsMs.reduce((sum, duration) => sum + duration, 0);
  const totalSeconds = Math.round(totalDurationMs / 1000);
  const progress = totalSeconds > 0 ? Math.min(100, Math.max(0, (playheadSeconds / totalSeconds) * 100)) : 0;
  const currentWholeSeconds = Math.floor(playheadSeconds);
  const currentLabel = `${String(Math.floor(currentWholeSeconds / 60)).padStart(2, '0')}:${String(currentWholeSeconds % 60).padStart(2, '0')}`;
  const totalLabel = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const promptLength = useMemo(() => question.trim().length, [question]);

  useEffect(() => {
    if (!playing || exporting) return undefined;
    const startedAt = window.performance.now();
    const startOffset = playheadRef.current;
    const timer = window.setInterval(() => {
      const nextSeconds = Math.min(totalSeconds, startOffset + (window.performance.now() - startedAt) / 1000);
      playheadRef.current = nextSeconds;
      setPlayheadSeconds(nextSeconds);
      const beat = getBeatAtTime(beats, nextSeconds);
      if (beat) setActiveBeatIndex((current) => current === beat.index ? current : beat.index);
      if (nextSeconds >= totalSeconds) setPlaying(false);
    }, 33);
    return () => window.clearInterval(timer);
  }, [playing, exporting, beats, totalSeconds]);

  const seekTo = (seconds) => {
    const nextSeconds = Math.min(totalSeconds, Math.max(0, Number(seconds) || 0));
    playheadRef.current = nextSeconds;
    setPlayheadSeconds(nextSeconds);
    const beat = getBeatAtTime(beats, nextSeconds);
    if (beat) setActiveBeatIndex(beat.index);
    setPlaying(false);
  };

  const generateStory = () => {
    const nextScenario = buildScenarioPlan(question);
    setScenario(nextScenario);
    setAiPlan(null);
    setAiError('');
    playheadRef.current = 0;
    setPlayheadSeconds(0);
    setActiveBeatIndex(0);
    setPlaying(false);
  };

  const analyzeWithAI = async () => {
    const prompt = question.trim();
    setAiBusy(true);
    setAiError('');
    setAiPlan(null);
    try {
      const aiApiBase = import.meta.env.VITE_AI_API_URL || '';
      const response = await fetch(aiApiBase + '/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI interpretation service is unavailable.');
      const plan = validateAIInterpretation(payload.plan, prompt);
      const nextScenario = buildScenarioPlan(prompt);
      if (plan?.classification === 'supported') {
        const eventIndex = nextScenario.beats.findIndex((item) => item.event === plan.event?.type);
        const eventStart = eventIndex < 0
          ? -1
          : nextScenario.beats.slice(0, eventIndex).reduce((sum, item) => sum + item.durationSeconds, 0);
        if (nextScenario.id !== 'rubber' ||
          plan.simulationModelId !== 'city-traffic-kinematics-v1' ||
          eventStart !== plan.event.startSeconds ||
          nextScenario.beats[eventIndex]?.durationSeconds !== plan.event.durationSeconds ||
          nextScenario.beats.findIndex((item) => item.event === 'recovery') < 0 ||
          nextScenario.beats.slice(0, nextScenario.beats.findIndex((item) => item.event === 'recovery'))
            .reduce((sum, item) => sum + item.durationSeconds, 0) !== plan.event.recoveryStartSeconds) {
          throw new Error('The AI plan does not match the registered local simulation contract. It was not executed.');
        }
      }
      setScenario(nextScenario);
      playheadRef.current = 0;
      setPlayheadSeconds(0);
      setActiveBeatIndex(0);
      setPlaying(false);
      setAiPlan(plan);
    } catch (error) {
      setAiError(error?.message || 'AI interpretation failed. The deterministic simulation remains available.');
    } finally {
      setAiBusy(false);
    }
  };

  const reset = () => {
    playheadRef.current = 0;
    setPlayheadSeconds(0);
    setActiveBeatIndex(0);
    setPlaying(false);
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playheadRef.current >= totalSeconds) {
      playheadRef.current = 0;
      setPlayheadSeconds(0);
      setActiveBeatIndex(0);
    }
    setPlaying(true);
  };

  const exportBrief = () => {
    const lines = [
      'VOXEL WHAT IF STUDIO — STORYBOARD',
      'Prompt: ' + scenario.prompt,
      'Scenario: ' + scenario.phenomenon,
      'Scenario mapping: ' + (scenario.supported ? 'supported deterministic rule' : 'unmapped exploratory preview'),
      'Duration: ' + totalLabel,
      '',
      ...beats.map((beat) => [
        beat.time + '  ' + beat.title + ' (' + beat.durationSeconds + 's)',
        'Caption: ' + beat.caption,
        'Director note: ' + beat.note,
        'Event: ' + beat.event + ' | Camera: ' + beat.camera
      ].join('\n'))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'voxel-what-if-storyboard.txt';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  const exportVideo = async () => {
    const target = captureRef.current;
    if (!target?.canvas) {
      setExportError('The 3D renderer is not ready. Wait for the scene to load, then retry.');
      return;
    }

    setExportError('');
    setExportMessage('Checking browser video encoder…');
    setExportProgress(0);
    const previousCameraMode = cameraMode;
    setCameraMode('auto');
    setExporting(true);
    setPlaying(true);
    playheadRef.current = 0;
    setPlayheadSeconds(0);
    setActiveBeatIndex(0);

    try {
      let lastBeatIndex = -1;
      let lastProgressPercent = -1;
      let lastUiTime = -Infinity;
      const blob = await recordCanvasVideo({
        sourceCanvas: target.canvas,
        renderSourceFrame: (elapsed) => target.renderAtTime(elapsed),
        prepareSourceCanvas: async ({ signal }) => {
          setExportMessage("Preparing 1080 × 1920 video render…");
          target.setOutputSize(1080, 1920);
          await waitForAnimationFrames(signal, 2);
        },
        durationSeconds: scenario.durationSeconds,
        beats,
        width: 1080,
        height: 1920,
        fps: 30,
        onTime: (elapsed, beat) => {
          const timelineTime = Math.max(0, Math.min(scenario.durationSeconds, elapsed));
          playheadRef.current = timelineTime;
          if (beat && beat.index !== lastBeatIndex) {
            lastBeatIndex = beat.index;
            setActiveBeatIndex(beat.index);
          }
          if (timelineTime - lastUiTime >= (1 / 30) || timelineTime >= scenario.durationSeconds) {
            lastUiTime = timelineTime;
            setPlayheadSeconds(timelineTime);
          }
        },
        onProgress: (value) => {
          const percent = Math.min(100, Math.floor(value * 100));
          if (percent !== lastProgressPercent) {
            lastProgressPercent = percent;
            setExportProgress(percent / 100);
          }
        }
      });

      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = 'voxel-what-if-' + scenario.id + '.' + extension;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportMessage('VIDEO GENERATED · ' + extension.toUpperCase() + ' · 1080 × 1920 · 30 FPS · CAPTIONS INCLUDED');
    } catch (error) {
      setExportError(error?.message || 'The video render failed. No video file was produced.');
      setExportMessage('');
    } finally {
      try { target.resetOutputSize(); } catch { /* renderer may have been disposed */ }
      setPlaying(false);
      setExporting(false);
      setCameraMode(previousCameraMode);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Voxel What If Studio home">
          <span className="brand-mark"><Layers3 size={19} /></span>
          <span>VOXEL <b>WHAT IF</b> <i>STUDIO</i></span>
        </a>
        <div className="top-status">
          <span className="status-dot" />
          SCENARIO PREVIEW
          <span className="version">PROCEDURAL ENVIRONMENTS · PHASE 2</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-kicker"><Sparkles size={14} /> STORY ENGINE</div>
          <h1>Imagine the<br /><em>impossible.</em></h1>
          <p className="intro">Turn a What If question into a structured, scenario-aware 3D preview.</p>

          <label className="field-label" htmlFor="whatif">YOUR WHAT IF QUESTION</label>
          <textarea
            id="whatif"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setAiPlan(null);
              setAiError('');
            }}
            disabled={exporting}
            maxLength={150}
            placeholder="What if..."
          />
          <div className="field-foot">
            <span>{promptLength}/150 characters</span>
            <span className="ready"><span /> READY TO PLAN</span>
          </div>
          <button className="generate-button" onClick={generateStory} disabled={exporting}>
            <WandSparkles size={15} /> GENERATE STORYBOARD
          </button>
          <button className="ai-analyze-button" onClick={analyzeWithAI} disabled={exporting || aiBusy || !question.trim()}>
            <Sparkles size={15} /> {aiBusy ? 'ANALYZING WITH AI…' : 'INTERPRET WITH AI'}
          </button>
          <AIInterpretation plan={aiPlan} error={aiError} busy={aiBusy} />
          <div className="engine-status">
            <span className={scenario.supported ? 'engine-indicator mapped' : 'engine-indicator'} />
            <span>{scenario.supported ? 'MAPPED EVENT · ' + scenario.label : 'UNMAPPED · ' + (ENVIRONMENT_LABELS[scenario.environment] || 'CITY') + ' ENVIRONMENT'}</span>
          </div>

          <div className="divider" />
          <div className="section-kicker"><Film size={14} /> STORY TIMELINE</div>
          <div className="timeline">
            {beats.map((beat, index) => (
              <button
                key={beat.title}
                className={'beat ' + (activeBeatIndex === index ? 'selected ' : '') + (index < activeBeatIndex ? 'passed' : '')}
                disabled={exporting}
                onClick={() => seekTo(beatDurationsMs.slice(0, index).reduce((sum, duration) => sum + duration, 0) / 1000)}
              >
                <span className="beat-marker">{index < activeBeatIndex ? '✓' : String(index + 1).padStart(2, '0')}</span>
                <span className="beat-copy"><b>{beat.title}</b><small>{beat.time} · {beat.durationSeconds}s</small></span>
                {activeBeatIndex === index && <span className="beat-active" />}
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button className="secondary-button" onClick={reset} disabled={exporting}><RotateCcw size={15} /> Reset sequence</button>
            <button className="export-button" onClick={exportBrief} disabled={exporting}><Download size={15} /> Export storyboard</button>
          </div>
        </aside>

        <section className="stage-column">
          <div className="stage-heading">
            <div>
              <div className="section-kicker"><Clapperboard size={14} /> SCENE PREVIEW</div>
              <h2>{active.title}</h2>
            </div>
            <div className="scene-counter">SCENE <b>{String(activeBeatIndex + 1).padStart(2, '0')}</b><span>/ {String(beats.length).padStart(2, '0')}</span></div>
          </div>

          <div className="viewport">
            <Suspense fallback={<div className="viewport-loading">LOADING 3D SCENE ENGINE…</div>}>
              <WorldView scenario={scenario} beat={active} playing={playing} cameraMode={cameraMode} lighting={lighting} presenterVisible={presenterVisible} captureRef={captureRef} timelineRef={playheadRef} onSimulationReport={setSimulationReport} />
            </Suspense>
            <div className="viewport-top">
              <span className="live-pill"><span /> 3D SCENE</span>
              <span className="viewport-label">REAL-TIME / VERTICAL SCENE</span>
            </div>
            <div className="scene-caption" aria-live="polite">
              <span>{scenario.label}</span>
              <strong>{active.caption}</strong>
              {(active.event === 'rubber-loss' || active.event === 'gravity-loss') && <small>EVENT WINDOW · FIVE SECONDS</small>}
            </div>
            <div className="camera-mode-controls" role="group" aria-label="Camera mode">
              <button type="button" className="camera-mode-button" data-mode="auto" aria-pressed={cameraMode === 'auto'} onClick={() => setCameraMode('auto')}>AUTO SHOTS</button>
              <button type="button" className="camera-mode-button" data-mode="orbit" aria-pressed={cameraMode === 'orbit'} onClick={() => setCameraMode('orbit')}>FREE ORBIT</button>
              <button type="button" className="camera-mode-button" data-mode="presenter" aria-pressed={presenterVisible} onClick={() => setPresenterVisible((visible) => !visible)}>HOST {presenterVisible ? 'ON' : 'OFF'}</button>
              {cameraMode === 'orbit' && <span className="camera-mode-hint">DRAG · PAN · ZOOM</span>}
            </div>
            <div className="viewport-bottom"><span>CAMERA · {active.camera.toUpperCase()}</span><span>ENVIRONMENT · {scenario.environment.toUpperCase()}</span></div>
          </div>

          <div className="lighting-controls">
            <label className="lighting-label" htmlFor="lighting-intensity"><span>LIGHTING RIG</span><strong>{lighting}%</strong></label>
            <input className="lighting-slider" id="lighting-intensity" type="range" min="30" max="160" step="5" value={lighting} aria-label="Scene lighting intensity" disabled={exporting} onChange={(event) => setLighting(Number(event.target.value))} />
          </div>
          <div className="transport">
            <button className="play-button" onClick={togglePlayback} disabled={exporting}>
              <Play size={15} fill="currentColor" /> {playing ? 'PAUSE PREVIEW' : 'PLAY STORY PREVIEW'}
            </button>
            <div className="progress-wrap">
              <input
                className="timeline-scrubber"
                type="range"
                min="0"
                max={totalSeconds}
                step="0.1"
                value={Math.min(totalSeconds, playheadSeconds)}
                style={{ '--playhead': progress + '%' }}
                aria-label="Timeline playhead"
                disabled={exporting}
                onChange={(event) => seekTo(event.target.value)}
              />
              <div className="progress-label"><span>{currentLabel}</span><span>{totalLabel} · STORYBOARD</span></div>
            </div>
            <button className="icon-button" title="Reset sequence" onClick={reset}><RotateCcw size={16} /></button>
          </div>

          <div className="video-export-panel">
            <button className="video-export-button" onClick={exportVideo} disabled={exporting}>
              <Video size={16} />
              {exporting ? 'RENDERING VIDEO · ' + Math.round(exportProgress * 100) + '%' : 'RENDER FULL VERTICAL VIDEO'}
            </button>
            <div className="video-export-meta">1080 × 1920 · 30 FPS · STORY CAPTIONS · MP4 WHEN SUPPORTED, OTHERWISE WEBM</div>
            {exporting && <div className="video-export-track"><span style={{ width: Math.round(exportProgress * 100) + '%' }} /></div>}
            {exporting && <div className="video-export-meta">Keep this tab open and visible while the real-time render runs.</div>}
            {exportMessage && <div className="video-export-success">{exportMessage}</div>}
            {exportError && <div className="video-export-error" role="alert">{exportError}</div>}
          </div>
          <SimulationInsights report={simulationReport} />
          <div className="insight-card">
            <div className="insight-icon"><Lightbulb size={17} /></div>
            <div className="insight-copy">
              <span>DIRECTOR'S NOTE</span>
              <p>{active.note}</p>
            </div>
            <button className="notes-toggle" onClick={() => setShowNotes(!showNotes)}>{showNotes ? 'HIDE' : 'SHOW'}</button>
          </div>
          {showNotes && <div className="production-row">
            <div><Activity size={15} /><span>VISUAL INTENSITY</span><b>{['LOW', 'RISING', 'MEDIUM', 'HIGH', 'EPIC'][activeBeatIndex]}</b></div>
            <div><WandSparkles size={15} /><span>SCENARIO RULE</span><b>{scenario.supported ? scenario.id.toUpperCase() : 'UNMAPPED'}</b></div>
            <div><Layers3 size={15} /><span>RENDER STYLE</span><b>VOXEL CITY</b></div>
          </div>}
          {!scenario.supported && <p className="limitation-note">This topic has no dedicated visual rule yet. The preview intentionally avoids inventing scenario-specific effects.</p>}
        </section>
      </section>
      <footer className="footer">
        <span>VOXEL WHAT IF STUDIO</span>
        <span>REAL-TIME 3D SCENARIO PREVIEW</span>
        <span>PROCEDURAL ENVIRONMENTS · VERTICAL PREVIEW</span>
      </footer>
    </main>
  );
}
