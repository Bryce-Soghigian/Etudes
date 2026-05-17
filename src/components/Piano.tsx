import { useMemo } from "react";
import { Note } from "tonal";
import { sameChroma } from "../music/midi";

type Props = {
  low?: number;
  high?: number;
  /** notes the user is currently holding down */
  held: Set<number>;
  /** exact MIDI targets to highlight (1 entry per active hand) */
  targets?: Set<number>;
  /** notes flashed as correct (recently played and right) */
  correct?: Set<number>;
  /** notes flashed as wrong */
  wrong?: Set<number>;
  /** all pitch classes that belong to the current scale — drawn as subtle dots */
  scaleChromas?: Set<number>;
};

const WHITE_W = 30;
const WHITE_H = 168;
const BLACK_W = 18;
const BLACK_H = 104;

function isBlack(midi: number) {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

export function Piano({
  low = 36, // C2
  high = 84, // C6
  held,
  targets,
  correct,
  wrong,
  scaleChromas,
}: Props) {
  const { whites, blacks, width } = useMemo(() => {
    const whites: { midi: number; x: number }[] = [];
    const blacks: { midi: number; x: number }[] = [];
    let x = 0;
    for (let m = low; m <= high; m++) {
      if (!isBlack(m)) {
        whites.push({ midi: m, x });
        x += WHITE_W;
      }
    }
    for (let i = 0; i < whites.length - 1; i++) {
      const w = whites[i];
      const candidate = w.midi + 1;
      if (isBlack(candidate) && candidate <= high) {
        blacks.push({
          midi: candidate,
          x: w.x + WHITE_W - BLACK_W / 2,
        });
      }
    }
    return { whites, blacks, width: whites.length * WHITE_W };
  }, [low, high]);

  const isHeld = (m: number) => held.has(m);
  const isCorrect = (m: number) =>
    correct ? Array.from(correct).some((c) => sameChroma(c, m)) : false;
  const isWrong = (m: number) =>
    wrong ? Array.from(wrong).some((w) => sameChroma(w, m)) : false;
  const isTarget = (m: number) => targets ? targets.has(m) : false;
  const inScale = (m: number) =>
    scaleChromas ? scaleChromas.has(((m % 12) + 12) % 12) : false;

  return (
    <div className="piano-wrap">
      <svg
        className="piano"
        viewBox={`0 0 ${width} ${WHITE_H + 14}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Piano keyboard"
      >
        <rect
          x="0"
          y={WHITE_H + 2}
          width={width}
          height="8"
          fill="url(#bedShadow)"
        />

        {whites.map(({ midi, x }) => {
          const target_ = isTarget(midi);
          const held_ = isHeld(midi);
          const correct_ = isCorrect(midi);
          const wrong_ = isWrong(midi);
          const inScale_ = inScale(midi);
          const name = Note.fromMidi(midi);
          const isC = ((midi % 12) + 12) % 12 === 0;
          return (
            <g key={midi}>
              <rect
                x={x + 0.5}
                y={0}
                width={WHITE_W - 1}
                height={WHITE_H}
                rx={2}
                ry={2}
                className={[
                  "key white",
                  target_ && "target",
                  held_ && "held",
                  correct_ && "correct",
                  wrong_ && "wrong",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              {inScale_ && !target_ && (
                <circle
                  cx={x + WHITE_W / 2}
                  cy={WHITE_H - 18}
                  r={2.2}
                  className="scale-dot"
                />
              )}
              {isC && (
                <text
                  x={x + WHITE_W / 2}
                  y={WHITE_H - 6}
                  className="key-label"
                  textAnchor="middle"
                >
                  {name}
                </text>
              )}
            </g>
          );
        })}

        {blacks.map(({ midi, x }) => {
          const target_ = isTarget(midi);
          const held_ = isHeld(midi);
          const correct_ = isCorrect(midi);
          const wrong_ = isWrong(midi);
          const inScale_ = inScale(midi);
          return (
            <g key={midi}>
              <rect
                x={x}
                y={0}
                width={BLACK_W}
                height={BLACK_H}
                rx={1.5}
                ry={1.5}
                className={[
                  "key black",
                  target_ && "target",
                  held_ && "held",
                  correct_ && "correct",
                  wrong_ && "wrong",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              {inScale_ && !target_ && (
                <circle
                  cx={x + BLACK_W / 2}
                  cy={BLACK_H - 12}
                  r={2}
                  className="scale-dot scale-dot--black"
                />
              )}
            </g>
          );
        })}

        <defs>
          <linearGradient id="bedShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
