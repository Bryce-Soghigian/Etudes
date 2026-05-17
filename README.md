# Études

A practice console for piano scales. Connect a USB MIDI keyboard, pick a scale,
and practice it in one of two modes:

- **Guided** — the next note is lit on the keyboard and staff; play it correctly
  to advance.
- **Play-along** — a metronome counts in, then ticks through the scale. Hit each
  note within the beat to score. Land a run at ≥ 92% accuracy and the tempo bumps
  up automatically.

Covers all 12 tonics across major, the three minors (natural, harmonic, melodic),
all seven modes, and the major/minor pentatonics.

## Stack

- Vite + React + TypeScript
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
  (Chrome / Edge)
- [`tonal`](https://github.com/tonaljs/tonal) for music theory
- [`vexflow`](https://github.com/0xfe/vexflow) for staff notation
- Web Audio API for the metronome (lookahead scheduler)

## Run it

```sh
npm install
npm run dev
```

Open <http://localhost:5173> in Chrome or Edge, click **Request MIDI access**,
choose your device, and pick a scale.

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — type-check and production build
- `npm run preview` — preview the production build
- `npm run typecheck` — type-check only

## Layout

```
src/
  App.tsx                # mode state machine, scoring, tempo progression
  music/
    scales.ts            # scale catalog, sequence builder (tonal wrapper)
    midi.ts              # MIDI number ↔ pitch-class helpers
  hooks/
    useMidi.ts           # Web MIDI access, listener bus, held-notes state
    useMetronome.ts      # Web Audio scheduled clicker
  components/
    Piano.tsx            # custom SVG keyboard (target / held / right / wrong)
    Staff.tsx            # VexFlow renderer
    ControlPanel.tsx     # right-rail controls (tonic, family, mode, tempo)
    StatusBar.tsx        # MIDI connect + device picker
```
