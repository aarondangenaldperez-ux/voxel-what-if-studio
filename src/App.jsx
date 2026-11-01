import { useMemo, useState } from 'react';
import { Activity, Clapperboard, Download, Film, Layers3, Lightbulb, Play, RotateCcw, Sparkles, WandSparkles } from 'lucide-react';
import WorldView from './WorldView.jsx';

const beats = [
  { time: '00:00', title: 'The ordinary world', note: 'Everything is normal. Establish scale, routine, and a world the viewer recognizes.', mood: 'calm' },
  { time: '00:08', title: 'The disappearance', note: 'The impossible event happens. Let the visual change land before explaining it.', mood: 'shock' },
  { time: '00:18', title: 'First consequences', note: 'Show immediate systems failing and people noticing the change.', mood: 'warning' },
  { time: '00:32', title: 'The chain reaction', note: 'Connect local effects to larger systems. Escalate the scale of the story.', mood: 'chaos' },
  { time: '00:48', title: 'A changed world', note: 'Reveal the long-term result and end with one memorable thought.', mood: 'aftermath' }
];

export default function App() {
  const [question, setQuestion] = useState('What if the oceans suddenly vanished?');
  const [activeBeat, setActiveBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const active = beats[activeBeat];
  const promptLength = useMemo(() => question.trim().length, [question]);

  const reset = () => { setActiveBeat(0); setPlaying(false); };
  const exportBrief = () => {
    const brief = [
      'VOXEL WHAT IF STUDIO — STORYBOARD',
      question,
      '',
      ...beats.map((b, i) => `${b.time}  ${b.title}\n${b.note}`)
    ].join('\n');
    const blob = new Blob([brief], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'voxel-what-if-storyboard.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Voxel What If Studio home">
          <span className="brand-mark"><Layers3 size={19} /></span>
          <span>VOXEL <b>WHAT IF</b> <i>STUDIO</i></span>
        </a>
        <div className="top-status"><span className="status-dot" /> CREATIVE WORKSPACE <span className="version">PROTOTYPE 0.1</span></div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-kicker"><Sparkles size={14} /> STORY ENGINE</div>
          <h1>Imagine the<br /><em>impossible.</em></h1>
          <p className="intro">Turn a single question into a cinematic voxel-world sequence.</p>

          <label className="field-label" htmlFor="whatif">YOUR WHAT IF QUESTION</label>
          <textarea id="whatif" value={question} onChange={e => setQuestion(e.target.value)} maxLength={150} placeholder="What if..." />
          <div className="field-foot"><span>{promptLength}/150 characters</span><span className="ready"><span /> READY TO SHAPE</span></div>

          <div className="divider" />
          <div className="section-kicker"><Film size={14} /> STORY TIMELINE</div>
          <div className="timeline">
            {beats.map((beat, i) => (
              <button key={beat.title} className={`beat ${activeBeat === i ? 'selected' : ''} ${i < activeBeat ? 'passed' : ''}`} onClick={() => { setActiveBeat(i); setPlaying(false); }}>
                <span className="beat-marker">{i < activeBeat ? '✓' : String(i + 1).padStart(2, '0')}</span>
                <span className="beat-copy"><b>{beat.title}</b><small>{beat.time}</small></span>
                {activeBeat === i && <span className="beat-active" />}
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button className="secondary-button" onClick={reset}><RotateCcw size={15} /> Reset sequence</button>
            <button className="export-button" onClick={exportBrief}><Download size={15} /> Export storyboard</button>
          </div>
        </aside>

        <section className="stage-column">
          <div className="stage-heading">
            <div><div className="section-kicker"><Clapperboard size={14} /> SCENE PREVIEW</div><h2>{active.title}</h2></div>
            <div className="scene-counter">SCENE <b>{String(activeBeat + 1).padStart(2, '0')}</b><span>/ 05</span></div>
          </div>
          <div className="viewport">
            <WorldView mood={active.mood} playing={playing} />
            <div className="viewport-top"><span className="live-pill"><span /> LIVE PREVIEW</span><span className="viewport-label">VOXEL ENVIRONMENT / 3D</span></div>
            <div className="viewport-bottom"><span>CAM 01 · ORBIT</span><span>ENVIRONMENT: PROCEDURAL</span></div>
            <div className="viewport-center">
              <span className="crosshair" />
            </div>
          </div>
          <div className="transport">
            <button className="play-button" onClick={() => setPlaying(!playing)}><Play size={15} fill="currentColor" /> {playing ? 'PAUSE PREVIEW' : 'PLAY PREVIEW'}</button>
            <div className="progress-wrap"><div className="progress-track"><span style={{ width: `${(activeBeat + 1) * 20}%` }} /></div><div className="progress-label"><span>{active.time}</span><span>00:56</span></div></div>
            <button className="icon-button" title="Reset" onClick={reset}><RotateCcw size={16} /></button>
          </div>

          <div className="insight-card">
            <div className="insight-icon"><Lightbulb size={17} /></div>
            <div className="insight-copy"><span>DIRECTOR'S NOTE</span><p>{active.note}</p></div>
            <button className="notes-toggle" onClick={() => setShowNotes(!showNotes)}>{showNotes ? 'HIDE' : 'SHOW'}</button>
          </div>
          {showNotes && <div className="production-row">
            <div><Activity size={15} /><span>VISUAL INTENSITY</span><b>{['LOW','RISING','MEDIUM','HIGH','EPIC'][activeBeat]}</b></div>
            <div><WandSparkles size={15} /><span>SCENE MOOD</span><b>{active.mood.toUpperCase()}</b></div>
            <div><Layers3 size={15} /><span>RENDER STYLE</span><b>VOXEL CINEMATIC</b></div>
          </div>}
        </section>
      </section>
      <footer className="footer"><span>VOXEL WHAT IF STUDIO</span><span>BUILT FOR STORIES THAT BEND REALITY.</span><span>0.1.0 · WEB PROTOTYPE</span></footer>
    </main>
  );
}