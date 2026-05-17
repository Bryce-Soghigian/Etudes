import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note } from "tonal";
import { Piano } from "./components/Piano";
import { Staff } from "./components/Staff";
import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { useMidi } from "./hooks/useMidi";
import { useMetronome } from "./hooks/useMetronome";
import {
  buildScaleSequence,
  formatPitchClasses,
  type Hand,
  type OctaveCount,
} from "./music/scales";
import { sameChroma, handBucket } from "./music/midi";

type Mode = "guided" | "playalong";

const BPM_STEP_UP = 4;
const ACCURACY_TO_LEVEL_UP = 0.92;

/**
 * Does a played note "cover" a target?
 *   - single-hand modes: chroma match in any octave (forgiving)
 *   - both-hand mode: chroma match AND on the correct side of middle C
 */
function matchesTarget(played: number, target: number, hand: Hand): boolean {
  if (!sameChroma(played, target)) return false;
  if (hand === "both") return handBucket(played) === handBucket(target);
  return true;
}

export default function App() {
  const { status, heldNotes, connect, selectInput, subscribe } = useMidi();

  const [tonic, setTonic] = useState("C");
  const [familyId, setFamilyId] = useState("major");
  const [hand, setHand] = useState<Hand>("right");
  const [octaves, setOctaves] = useState<OctaveCount>(1);
  const [mode, setMode] = useState<Mode>("guided");
  const [bpm, setBpm] = useState(60);
  const [running, setRunning] = useState(false);

  const sequence = useMemo(
    () => buildScaleSequence(tonic, familyId, hand, octaves),
    [tonic, familyId, hand, octaves],
  );

  /** Auto-fit the piano range to the actual notes in the sequence (rounded to C boundaries). */
  const pianoRange = useMemo(() => {
    const all = sequence.steps.flatMap((s) => s.midi);
    if (all.length === 0) return { low: 36, high: 84 };
    const minN = Math.min(...all);
    const maxN = Math.max(...all);
    const low = Math.max(21, Math.floor((minN - 5) / 12) * 12);
    const high = Math.min(108, Math.ceil((maxN + 5) / 12) * 12);
    return { low, high };
  }, [sequence.steps]);

  const scaleChromas = useMemo(() => {
    const set = new Set<number>();
    for (const pc of sequence.pitchClasses) {
      const c = Note.chroma(pc);
      if (c !== undefined) set.add(c);
    }
    return set;
  }, [sequence.pitchClasses]);

  // ----- shared state -----
  const [stepIndex, setStepIndex] = useState(0);
  const [stepMatched, setStepMatched] = useState<Set<number>>(new Set());
  const [correctFlash, setCorrectFlash] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<Set<number>>(new Set());

  // ----- play-along state -----
  const tickTargetRef = useRef<{
    midis: number[];
    matched: Set<number>;
    at: number;
    idx: number;
  } | null>(null);
  const [scoring, setScoring] = useState({
    hits: 0,
    misses: 0,
    runs: 0,
    lastRunAccuracy: 0,
  });

  const reset = useCallback(() => {
    setStepIndex(0);
    setStepMatched(new Set());
    tickTargetRef.current = null;
    setCorrectFlash(new Set());
    setWrongFlash(new Set());
    setScoring({ hits: 0, misses: 0, runs: 0, lastRunAccuracy: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [tonic, familyId, hand, octaves, mode, reset]);

  // ---- guided mode listener ----
  useEffect(() => {
    if (mode !== "guided" || !running) return;
    return subscribe((e) => {
      if (e.type !== "noteOn") return;
      const step = sequence.steps[stepIndex];
      if (!step) return;

      // Find an unmatched target this note covers
      const matchedTarget = step.midi.find(
        (t) => !stepMatched.has(t) && matchesTarget(e.note, t, hand),
      );

      if (matchedTarget !== undefined) {
        setCorrectFlash(new Set([e.note]));
        window.setTimeout(() => setCorrectFlash(new Set()), 220);

        const nextMatched = new Set(stepMatched);
        nextMatched.add(matchedTarget);

        if (nextMatched.size >= step.midi.length) {
          setStepMatched(new Set());
          setStepIndex((i) => {
            if (i + 1 >= sequence.steps.length) {
              window.setTimeout(() => setStepIndex(0), 400);
            }
            return i + 1;
          });
        } else {
          setStepMatched(nextMatched);
        }
      } else {
        setWrongFlash(new Set([e.note]));
        window.setTimeout(() => setWrongFlash(new Set()), 220);
      }
    });
  }, [mode, running, sequence.steps, stepIndex, stepMatched, hand, subscribe]);

  // ---- play-along: each metronome tick advances the target chord ----
  const handleTick = useCallback(
    (idx: number, when: number) => {
      if (mode !== "playalong") return;
      const COUNT_IN = 4;
      if (idx < COUNT_IN) {
        setStepIndex(idx - COUNT_IN);
        return;
      }
      const seqIdx = idx - COUNT_IN;
      if (seqIdx >= sequence.steps.length) {
        const stepCount = sequence.steps.length;
        const expected = stepCount * (sequence.steps[0]?.midi.length ?? 1);
        const accuracy = expected > 0 ? scoring.hits / expected : 0;
        setScoring((s) => ({
          hits: 0,
          misses: 0,
          runs: s.runs + 1,
          lastRunAccuracy: accuracy,
        }));
        if (accuracy >= ACCURACY_TO_LEVEL_UP) {
          setBpm((b) => Math.min(200, b + BPM_STEP_UP));
        }
        setStepIndex(0);
        tickTargetRef.current = {
          midis: sequence.steps[0].midi,
          matched: new Set(),
          at: when * 1000,
          idx: 0,
        };
        return;
      }
      setStepIndex(seqIdx);
      tickTargetRef.current = {
        midis: sequence.steps[seqIdx].midi,
        matched: new Set(),
        at: when * 1000,
        idx: seqIdx,
      };
    },
    [mode, sequence.steps, scoring.hits],
  );

  const { currentBeat } = useMetronome({
    bpm,
    running: running && mode === "playalong",
    onTick: handleTick,
    beatsPerBar: 4,
  });

  // ---- play-along listener: judge each played note vs current chord target ----
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
      const matchedTarget = tgt.midis.find(
        (m) => !tgt.matched.has(m) && matchesTarget(e.note, m, hand),
      );
      if (inWindow && matchedTarget !== undefined) {
        tgt.matched.add(matchedTarget);
        setCorrectFlash(new Set([e.note]));
        window.setTimeout(() => setCorrectFlash(new Set()), 160);
        setScoring((s) => ({ ...s, hits: s.hits + 1 }));
      } else {
        setWrongFlash(new Set([e.note]));
        window.setTimeout(() => setWrongFlash(new Set()), 160);
        setScoring((s) => ({ ...s, misses: s.misses + 1 }));
      }
    });
  }, [mode, running, bpm, hand, subscribe]);

  const guidedTargets =
    mode === "guided" && running
      ? new Set(sequence.steps[Math.min(stepIndex, sequence.steps.length - 1)]?.midi ?? [])
      : new Set<number>();

  const playalongTargets =
    mode === "playalong" && running && stepIndex >= 0
      ? new Set(sequence.steps[stepIndex]?.midi ?? [])
      : new Set<number>();

  const activeTargets =
    guidedTargets.size > 0 ? guidedTargets : playalongTargets;

  /**
   * Map the (full) sequence stepIndex onto its position in the ascending-only
   * staff array. Descending positions mirror back to their ascending twin so the
   * same note lights up on the way down as on the way up.
   */
  const ascLen =
    sequence.trebleAscending?.length ?? sequence.bassAscending?.length ?? 1;
  const activeStaffIndex = (() => {
    const i = Math.max(0, stepIndex);
    if (i < ascLen) return i;
    return Math.max(0, 2 * (ascLen - 1) - i);
  })();

  const totalScored = scoring.hits + scoring.misses;
  const accuracy = totalScored === 0 ? 0 : scoring.hits / totalScored;

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
            <span className="formula-hand">
              {hand === "right" && "right hand"}
              {hand === "left" && "left hand"}
              {hand === "both" && "both hands · parallel"}
              {" · "}
              {octaves} {octaves === 1 ? "octave" : "octaves"}
            </span>
          </div>
        </header>

        <section className="hero">
          <div className="staff-card">
            <div className="card-header">
              <span className="card-roman">§ I</span>
              <span className="card-title">Notation</span>
              <span className="card-meta">
                {hand === "both" ? "grand staff" : "ascending, one octave"}
              </span>
            </div>
            <Staff
              trebleNotes={sequence.trebleAscending}
              bassNotes={sequence.bassAscending}
              activeIndex={running ? activeStaffIndex : null}
            />
          </div>

          <div className="piano-card">
            <div className="card-header">
              <span className="card-roman">§ II</span>
              <span className="card-title">Keyboard</span>
              <span className="card-meta">
                {Note.fromMidi(pianoRange.low)} — {Note.fromMidi(pianoRange.high)}
              </span>
            </div>
            <Piano
              low={pianoRange.low}
              high={pianoRange.high}
              held={heldNotes}
              targets={activeTargets}
              correct={correctFlash}
              wrong={wrongFlash}
              scaleChromas={scaleChromas}
            />
          </div>

          <ReadoutsRail
            mode={mode}
            running={running}
            stepIndex={stepIndex}
            stepCount={sequence.steps.length}
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
        hand={hand}
        onHandChange={setHand}
        octaves={octaves}
        onOctavesChange={setOctaves}
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
  stepIndex,
  stepCount,
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
  stepIndex: number;
  stepCount: number;
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
              {Math.min(stepIndex, stepCount)}
              <span className="readout-sub">/ {stepCount}</span>
            </div>
          </div>
          <div className="readout">
            <div className="readout-label">Bar</div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (stepIndex / Math.max(1, stepCount)) * 100)}%`,
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
