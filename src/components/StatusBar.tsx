import type { MidiStatus } from "../hooks/useMidi";

type Props = {
  status: MidiStatus;
  onConnect: () => void;
  onSelectInput: (id: string | null) => void;
};



export function StatusBar({ status, onConnect, onSelectInput }: Props) {
  return (
    <div className="statusbar">
      <div className="brand">
        <span className="brand-mark">É</span>
        <div className="brand-text">
          <div className="brand-title">Études</div>
          <div className="brand-sub">A practice console for scales</div>
        </div>
      </div>

      <div className="midi-cluster">
        <div className="midi-pill">
          <span className={`dot dot--${status.kind}`} />
          <span className="midi-label">
            {status.kind === "unsupported" && "MIDI unavailable in this browser"}
            {status.kind === "idle" && "MIDI ready to connect"}
            {status.kind === "requesting" && "Awaiting permission…"}
            {status.kind === "denied" && `Denied — ${status.message}`}
            {status.kind === "ready" &&
              (status.inputs.length === 0
                ? "No devices found"
                : "Device connected")}
          </span>
        </div>

        {status.kind === "ready" && status.inputs.length > 0 && (
          <select
            className="midi-select"
            value={status.activeId ?? ""}
            onChange={(e) => onSelectInput(e.target.value || null)}
          >
            {status.inputs.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name ?? "Unnamed device"}
              </option>
            ))}
          </select>
        )}

        {(status.kind === "idle" ||
          status.kind === "denied" ||
          (status.kind === "ready" && status.inputs.length === 0)) && (
          <button className="midi-connect" onClick={onConnect}>
            Request MIDI access
          </button>
        )}
      </div>
    </div>
  );
}
