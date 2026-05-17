import { useEffect, useRef, useState } from "react";

type Options = {
  bpm: number;
  running: boolean;
  onTick?: (tickIndex: number, scheduledTime: number) => void;
  /** beats per bar for the visual indicator */
  beatsPerBar?: number;
};

/**
 * Web Audio scheduled metronome. Uses a lookahead loop so timing doesn't
 * drift even when the tab is throttled.
 */
export function useMetronome({ bpm, running, onTick, beatsPerBar = 4 }: Options) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const tickIndexRef = useRef(0);
  const onTickRef = useRef(onTick);
  const [currentBeat, setCurrentBeat] = useState(-1);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!running) {
      setCurrentBeat(-1);
      return;
    }

    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const interval = 60 / bpm;
    nextTimeRef.current = ctx.currentTime + 0.08;
    tickIndexRef.current = 0;

    const lookahead = 25; // ms
    const scheduleAhead = 0.12; // s
    let raf: number | null = null;

    const schedule = () => {
      while (nextTimeRef.current < ctx.currentTime + scheduleAhead) {
        const t = nextTimeRef.current;
        const i = tickIndexRef.current;
        playClick(ctx, t, i % beatsPerBar === 0);
        const idx = i;
        const when = t;
        const delayMs = Math.max(0, (when - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          setCurrentBeat(idx % beatsPerBar);
          onTickRef.current?.(idx, when);
        }, delayMs);
        nextTimeRef.current += interval;
        tickIndexRef.current += 1;
      }
      raf = window.setTimeout(schedule, lookahead) as unknown as number;
    };

    schedule();
    return () => {
      if (raf !== null) window.clearTimeout(raf);
    };
  }, [bpm, running, beatsPerBar]);

  return { currentBeat };
}

function playClick(ctx: AudioContext, time: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1500 : 950;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.08);
}
