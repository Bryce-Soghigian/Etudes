import {
  SCALE_FAMILIES,
  TONICS,
  OCTAVE_COUNTS,
  type Hand,
  type OctaveCount,
} from "../music/scales";

type Mode = "guided" | "playalong";

type Props = {
  tonic: string;
  onTonicChange: (t: string) => void;
  familyId: string;
  onFamilyChange: (id: string) => void;
  hand: Hand;
  onHandChange: (h: Hand) => void;
  octaves: OctaveCount;
  onOctavesChange: (n: OctaveCount) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  bpm: number;
  onBpmChange: (b: number) => void;
  running: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
};

const HAND_OPTIONS: { id: Hand; glyph: string; label: string; hint: string }[] = [
  { id: "right", glyph: "R", label: "Right", hint: "treble · one octave" },
  { id: "left", glyph: "L", label: "Left", hint: "bass · one octave" },
  { id: "both", glyph: "R+L", label: "Both", hint: "parallel, octave apart" },
];

export function ControlPanel({
  tonic,
  onTonicChange,
  familyId,
  onFamilyChange,
  hand,
  onHandChange,
  octaves,
  onOctavesChange,
  mode,
  onModeChange,
  bpm,
  onBpmChange,
  running,
  onToggleRunning,
  onReset,
}: Props) {
  return (
    <aside className="panel">
      <div className="panel-section">
        <div className="panel-label">I.&nbsp;&nbsp;Tonic</div>
        <div className="tonic-grid">
          {TONICS.map((t) => (
            <button
              key={t}
              className={`tonic ${t === tonic ? "tonic--active" : ""}`}
              onClick={() => onTonicChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-label">II.&nbsp;&nbsp;Mode &amp; family</div>
        <div className="family-list">
          {SCALE_FAMILIES.map((f) => (
            <button
              key={f.id}
              className={`family ${f.id === familyId ? "family--active" : ""}`}
              onClick={() => onFamilyChange(f.id)}
            >
              <span className="family-label">{f.label}</span>
              <span className="family-epigram">{f.epigram}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-label">III.&nbsp;&nbsp;Hands</div>
        <div className="hands-grid">
          {HAND_OPTIONS.map((h) => (
            <button
              key={h.id}
              className={`hand ${h.id === hand ? "hand--active" : ""}`}
              onClick={() => onHandChange(h.id)}
            >
              <span className="hand-glyph">{h.glyph}</span>
              <span className="hand-label">{h.label}</span>
              <span className="hand-hint">{h.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-label">IV.&nbsp;&nbsp;Octaves</div>
        <div className="octaves-grid">
          {OCTAVE_COUNTS.map((n) => (
            <button
              key={n}
              className={`octave ${n === octaves ? "octave--active" : ""}`}
              onClick={() => onOctavesChange(n)}
            >
              <span className="octave-num">{n}</span>
              <span className="octave-unit">{n === 1 ? "octave" : "octaves"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-label">V.&nbsp;&nbsp;Practice</div>
        <div className="mode-toggle">
          <button
            className={`mode ${mode === "guided" ? "mode--active" : ""}`}
            onClick={() => onModeChange("guided")}
          >
            <span className="mode-num">01</span>
            <span className="mode-name">Guided</span>
            <span className="mode-hint">play the lit note</span>
          </button>
          <button
            className={`mode ${mode === "playalong" ? "mode--active" : ""}`}
            onClick={() => onModeChange("playalong")}
          >
            <span className="mode-num">02</span>
            <span className="mode-name">Play-along</span>
            <span className="mode-hint">in time with the click</span>
          </button>
        </div>

        <div className="bpm-row">
          <label className="bpm-label">tempo</label>
          <div className="bpm-display">
            <span className="bpm-value">{bpm}</span>
            <span className="bpm-unit">bpm</span>
          </div>
          <input
            className="bpm-slider"
            type="range"
            min={40}
            max={200}
            step={1}
            value={bpm}
            onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
          />
        </div>

        <div className="transport">
          <button className="transport-btn primary" onClick={onToggleRunning}>
            <span className="transport-glyph">{running ? "■" : "▶"}</span>
            <span>{running ? "Halt" : mode === "guided" ? "Begin" : "Count off"}</span>
          </button>
          <button className="transport-btn" onClick={onReset}>
            <span className="transport-glyph">↺</span>
            <span>Reset</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
