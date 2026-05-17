import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note } from "tonal";
import { Piano } from "./components/Piano";
import { Staff } from "./components/Staff";
import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { useMidi } from "./hooks/useMidi";
import { useMetronome } from "./hooks/useMetronome";
import { buildScaleSequence, formatPitchClasses } from "./music/scales";
import { sameChroma } from "./music/midi";

type Mode = "guided" | "playalong";

const BPM_STEP_UP = 4;
const ACCURACY_TO_LEVEL_UP = 0.92;

export default function App() {
  const { status, heldNotes, connect, selectInput, subscribe } = useMidi();

  const [tonic, setTonic] = useState("C");
  const [familyId, setFamilyId] = useState("major");
  const [mode, setMode] = useState<Mode>("guided");
  const [bpm, setBpm] = useState(60);
  const [running, setRunning] = useState(false);

  const sequence = useMemo(
    () => buildScaleSequence(tonic, familyId, 4),
    [tonic, familyId],
  );

  const scaleChromas = useMemo(() => {
    const set = new Set<number>();
    for (const pc of sequence.pitchClasses) {
      const c = Note.chroma(pc);
      if (c !== undefined) set.add(c);
    }
    return set;
  }, [sequence.pitchClasses]);

  // ----- guided state -----
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [correctFlash, setCorrectFlash] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<Set<number>>(new Set());

  // ----- play-along state -----
  const [tickIndex, setTickIndex] = useState(-1);
  const tickTargetRef = useRef<{ midi: number; at: number; idx: number } | null>(null);
  const [scoring, setScoring] = useState({
    hits: 0,
    misses: 0,
    timingMs: [] as number[],
    runs: 0,
    lastRunAccuracy: 0,
  });

  const reset = useCallback(() => {
    setGuidedIndex(0);
    setTickIndex(-1);
    tickTargetRef.current = null;
    setCorrectFlash(new Set());
    setWrongFlash(new Set());
    setScoring({ hits: 0, misses: 0, timingMs: [], runs: 0, lastRunAccuracy: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [tonic, familyId, mode, reset]);

  // ---- guided mode listener ----
  useEffect(() => {
    if (mode !== "guided" || !running) return;
    return subscribe((e) => {
      if (e.type !== "noteOn") return;
      const target = sequence.midi[guidedIndex];
      if (target == null) return;
      if (sameChroma(e.note, target)) {
        setCorrectFlash(new Set([e.note]));
        window.setTimeout(() => setCorrectFlash(new Set()), 220);
        setGuidedIndex((i) => {
          if (i + 1 >= sequence.midi.length) {
            window.setTimeout(() => setGuidedIndex(0), 400);
            return i + 1;
          }
          return i + 1;
        });
      } else {
        setWrongFlash(new Set([e.note]));
        window.setTimeout(() => setWrongFlash(new Set()), 220);
      }
    });
  }, [mode, running, sequence.midi, guidedIndex, subscribe]);

  // ---- play-along: each metronome tick advances the target ----
  const handleTick = useCallback(
    (idx: number, when: number) => {
      if (mode !== "playalong") return;
      // First two ticks are a count-in; then we start the scale
      const COUNT_IN = 4;
      if (idx < COUNT_IN) {
        setTickIndex(idx - COUNT_IN);
        return;
      }
      const seqIdx = idx - COUNT_IN;
      if (seqIdx >= sequence.midi.length) {
        const runHits = scoring.hits;
        const runTotal = sequence.midi.length;
        const accuracy = runTotal > 0 ? runHits / runTotal : 0;
        setScoring((s) => ({
          hits: 0,
          misses: 0,
          timingMs: [],
          runs: s.runs + 1,
          lastRunAccuracy: accuracy,
        }));
        if (accuracy >= ACCURACY_TO_LEVEL_UP) {
          setBpm((b) => Math.min(200, b + BPM_STEP_UP));
        }
        setTickIndex(0);
        tickTargetRef.current = {
          midi: sequence.midi[0],
          at: when * 1000,
          idx: 0,
        };
        return;
      }
      setTickIndex(seqIdx);
      tickTargetRef.current = {
        midi: sequence.midi[seqIdx],
        at: when * 1000,
        idx: seqIdx,
      };
    },
    [mode, sequence.midi, scoring.hits],
  );

  const { currentBeat } = useMetronome({
    bpm,
    running: running && mode === "playalong",
    onTick: handleTick,
    beatsPerBar: 4,
  });

  // ---- play-along listener: judge note vs current target ----
  useEffect(() => {
    if (mode !== "playalong" || !running) return;
    return subscribe((e) => {
      if (e.type !== "noteOn") return;
      const tgt = tickTargetRef.current;
      if (!tgt) return;
      const beatMs = (60 / bpm) * 1000;
      const window_ = beatMs * 0.45;
      const delta = Math.abs(e.at - tgt.at);
      const inWindow = delta < window_;
      if (inWindow && sameChroma(e.note, tgt.midi)) {
        setCorrectFlash(new Set([e.note]));
        window.setTimeout(() => setCorrectFlash(new Set()), 160);
        setScoring((s) => ({ ...s, hits: s.hits + 1, timingMs: [...s.timingMs, e.at - tgt.at] }));
        tickTargetRef.current = null; // each tick scored at most once
      } else {
        setWrongFlash(new Set([e.note]));
        window.setTimeout(() => setWrongFlash(new Set()), 160);
        setScoring((s) => ({ ...s, misses: s.misses + 1 }));
      }
    });
  }, [mode, running, bpm, subscribe]);

  const guidedTarget = mode === "guided" && running
    ? sequence.midi[Math.min(guidedIndex, sequence.midi.length - 1)]
    : null;

  const playalongTarget = mode === "playalong" && running && tickIndex >= 0
    ? sequence.midi[tickIndex]
    : null;

  const target = guidedTarget ?? playalongTarget;

  const activeStaffIndex = mode === "guided"
    ? Math.min(guidedIndex, Math.ceil(sequence.midi.length / 2))
    : Math.min(Math.max(tickIndex, 0), Math.ceil(sequence.midi.length / 2));

  const accuracy =
    scoring.hits + scoring.misses === 0
      ? 0
      : scoring.hits / (scoring.hits + scoring.misses);

  return (
    <div className="app">
      <div className="grain" aria-hidden />
      <StatusBar status={status} onConnect={connect} onSelectInput={selectInput} />

      <main className="stage">
        <header className="opus">
          <div className="opus-meta">
            <span className="opus-no">Opus 01 — Scales for the unaccompanied keyboard</span>
            <span className="opus-rule" />
          </div>
          <h1 className="opus-title">
            <span className="title-tonic">{tonic}</span>
            <span className="title-sep">·</span>
            <span className="title-family">
              {sequence.title.replace(`${tonic} `, "")}
            </span>
          </h1>
          <div className="opus-formula">
            <span className="formula-label">notes</span>
            <span className="formula-pcs">
              {formatPitchClasses(sequence.pitchClasses)}
            </span>
          </div>
        </header>

        <section className="hero">
          <div className="staff-card">
            <div className="card-header">
              <span className="card-roman">§ I</span>
              <span className="card-title">Notation</span>
              <span className="card-meta">ascending, one octave</span>
            </div>
            <Staff notes={sequence.notes} activeIndex={running ? activeStaffIndex : null} />
          </div>

          <div className="piano-card">
            <div className="card-header">
              <span className="card-roman">§ II</span>
              <span className="card-title">Keyboard</span>
              <span className="card-meta">C3 — C6</span>
            </div>
            <Piano
              held={heldNotes}
              target={target}
              correct={correctFlash}
              wrong={wrongFlash}
              scaleChromas={scaleChromas}
            />
          </div>

          <ReadoutsRail
            mode={mode}
            running={running}
            guidedIndex={guidedIndex}
            sequenceLength={sequence.midi.length}
            accuracy={accuracy}
            hits={scoring.hits}
            misses={scoring.misses}
            runs={scoring.runs}
            lastRunAccuracy={scoring.lastRunAccuracy}
            bpm={bpm}
            currentBeat={currentBeat}
          />
        </section>
      </main>

      <ControlPanel
        tonic={tonic}
        onTonicChange={setTonic}
        familyId={familyId}
        onFamilyChange={setFamilyId}
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setRunning(false);
        }}
        bpm={bpm}
        onBpmChange={setBpm}
        running={running}
        onToggleRunning={() => setRunning((r) => !r)}
        onReset={reset}
      />

      <footer className="colophon">
        <span>Études · a personal practice console</span>
        <span className="colophon-mid">Web MIDI · VexFlow · Tonal</span>
        <span>
          {status.kind === "ready" && status.activeId
            ? status.inputs.find((i) => i.id === status.activeId)?.name ?? "—"
            : "no device"}
        </span>
      </footer>
    </div>
  );
}

function ReadoutsRail({
  mode,
  running,
  guidedIndex,
  sequenceLength,
  accuracy,
  hits,
  misses,
  runs,
  lastRunAccuracy,
  bpm,
  currentBeat,
}: {
  mode: Mode;
  running: boolean;
  guidedIndex: number;
  sequenceLength: number;
  accuracy: number;
  hits: number;
  misses: number;
  runs: number;
  lastRunAccuracy: number;
  bpm: number;
  currentBeat: number;
}) {
  return (
    <aside className="readouts">
      <div className="readout">
        <div className="readout-label">Mode</div>
        <div className="readout-value">{mode === "guided" ? "GUIDED" : "PLAY-ALONG"}</div>
      </div>
      <div className="readout">
        <div className="readout-label">State</div>
        <div className={`readout-value ${running ? "running" : ""}`}>
          {running ? "ACTIVE" : "STANDBY"}
        </div>
      </div>
      {mode === "guided" ? (
        <>
          <div className="readout">
            <div className="readout-label">Progress</div>
            <div className="readout-value">
              {Math.min(guidedIndex, sequenceLength)}
              <span className="readout-sub">/ {sequenceLength}</span>
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Bar</div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (guidedIndex / Math.max(1, sequenceLength)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="readout">
            <div className="readout-label">Tempo</div>
            <div className="readout-value">
              {bpm}
              <span className="readout-sub">bpm</span>
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Beat</div>
            <div className="beats">
              {[0, 1, 2, 3].map((b) => (
                <span
                  key={b}
                  className={`beat ${currentBeat === b ? "beat--on" : ""} ${b === 0 ? "beat--accent" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Accuracy</div>
            <div className="readout-value">
              {(accuracy * 100).toFixed(0)}
              <span className="readout-sub">%</span>
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Hits / Misses</div>
            <div className="readout-value mono">
              {hits} <span className="readout-sub">·</span> {misses}
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Runs completed</div>
            <div className="readout-value mono">{runs}</div>
          </div>
          {runs > 0 && (
            <div className="readout">
              <div className="readout-label">Last run</div>
              <div className="readout-value mono">
                {(lastRunAccuracy * 100).toFixed(0)}
                <span className="readout-sub">%</span>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
