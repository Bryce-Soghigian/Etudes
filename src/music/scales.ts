import { Scale, Note } from "tonal";

export type Hand = "right" | "left" | "both";
export type OctaveCount = 1 | 2 | 3 | 4;

export type ScaleFamily = {
  id: string;
  label: string;
  /** the tonal scale type name, e.g. "major", "minor pentatonic" */
  tonalName: string;
  /** italicized subtitle that appears under the scale title */
  epigram: string;
};

export const SCALE_FAMILIES: ScaleFamily[] = [
  { id: "major", label: "Major", tonalName: "major", epigram: "Ionian. The diatonic standard." },
  { id: "minor", label: "Natural Minor", tonalName: "minor", epigram: "Aeolian. Plaintive, settled." },
  { id: "harmonic-minor", label: "Harmonic Minor", tonalName: "harmonic minor", epigram: "A raised seventh. Pull toward the tonic." },
  { id: "melodic-minor", label: "Melodic Minor", tonalName: "melodic minor", epigram: "Ascending form. The jazz minor." },
  { id: "ionian", label: "Ionian", tonalName: "ionian", epigram: "First mode. Identical to major." },
  { id: "dorian", label: "Dorian", tonalName: "dorian", epigram: "Second mode. Minor with a raised sixth." },
  { id: "phrygian", label: "Phrygian", tonalName: "phrygian", epigram: "Third mode. Spanish, brooding." },
  { id: "lydian", label: "Lydian", tonalName: "lydian", epigram: "Fourth mode. The dreamer's raised fourth." },
  { id: "mixolydian", label: "Mixolydian", tonalName: "mixolydian", epigram: "Fifth mode. Dominant character." },
  { id: "aeolian", label: "Aeolian", tonalName: "aeolian", epigram: "Sixth mode. Natural minor." },
  { id: "locrian", label: "Locrian", tonalName: "locrian", epigram: "Seventh mode. Diminished, restless." },
  { id: "major-pentatonic", label: "Major Pentatonic", tonalName: "major pentatonic", epigram: "Five notes. Open, vernacular." },
  { id: "minor-pentatonic", label: "Minor Pentatonic", tonalName: "minor pentatonic", epigram: "Five notes. The blues skeleton." },
];

export const TONICS = [
  "C", "G", "D", "A", "E", "B", "F#", "C#",
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
] as const;

export type Tonic = (typeof TONICS)[number];

export const OCTAVE_COUNTS: OctaveCount[] = [1, 2, 3, 4];

export type ScaleStep = {
  /** MIDI notes to play simultaneously at this step (1 entry per active hand) */
  midi: number[];
};

export type ScaleSequence = {
  /** pitch-classes ascending, e.g. ["C","D","E","F","G","A","B"] */
  pitchClasses: string[];
  /** ordered steps; each step is a chord of notes to play together */
  steps: ScaleStep[];
  /** treble voice for the staff (ascending only), null when left-only */
  trebleAscending: string[] | null;
  /** bass voice for the staff (ascending only), null when right-only */
  bassAscending: string[] | null;
  /** display title e.g. "C Major" */
  title: string;
  hand: Hand;
  octaves: OctaveCount;
};

/** Build the ascending-only voice for `octaves` octaves starting at startOctave. */
function buildAscending(pcs: string[], startOctave: number, octaves: number): string[] {
  const out: string[] = [];
  let lastChroma = -1;
  let oct = startOctave;
  for (let o = 0; o < octaves; o++) {
    for (const pc of pcs) {
      const chroma = Note.chroma(pc);
      if (chroma === undefined) continue;
      if (chroma <= lastChroma) oct += 1;
      out.push(`${pc}${oct}`);
      lastChroma = chroma;
    }
  }
  // Add the final tonic at the top
  out.push(`${pcs[0]}${oct + 1}`);
  return out;
}

/** Combine ascending + descending (without repeating the top note). */
function ascendingToFull(asc: string[]): string[] {
  return [...asc, ...asc.slice(0, -1).reverse()];
}

/**
 * Build an N-octave ascending-then-descending sequence.
 *   hand = right | left | both (parallel motion, one octave apart)
 *   octaves = how many octaves to span before turning around
 */
export function buildScaleSequence(
  tonic: string,
  familyId: string,
  hand: Hand = "right",
  octaves: OctaveCount = 1,
  startOctave = 4,
): ScaleSequence {
  const family = SCALE_FAMILIES.find((f) => f.id === familyId) ?? SCALE_FAMILIES[0];
  const sc = Scale.get(`${tonic} ${family.tonalName}`);
  const pcs = sc.notes.length ? sc.notes : Scale.get(`C ${family.tonalName}`).notes;

  const rightAsc =
    hand === "right" || hand === "both"
      ? buildAscending(pcs, startOctave, octaves)
      : null;
  const leftAsc =
    hand === "left" || hand === "both"
      ? buildAscending(pcs, startOctave - 1, octaves)
      : null;

  const rightFull = rightAsc ? ascendingToFull(rightAsc) : null;
  const leftFull = leftAsc ? ascendingToFull(leftAsc) : null;

  const stepCount = (rightFull ?? leftFull ?? []).length;
  const steps: ScaleStep[] = [];
  for (let i = 0; i < stepCount; i++) {
    const midis: number[] = [];
    if (rightFull) {
      const m = Note.midi(rightFull[i]);
      if (m != null) midis.push(m);
    }
    if (leftFull) {
      const m = Note.midi(leftFull[i]);
      if (m != null) midis.push(m);
    }
    steps.push({ midi: midis });
  }

  return {
    pitchClasses: pcs,
    steps,
    trebleAscending: rightAsc,
    bassAscending: leftAsc,
    title: `${tonic} ${family.label}`,
    hand,
    octaves,
  };
}

/** Format pitch-classes into a spaced string like "C  D  E  F  G  A  B" */
export function formatPitchClasses(pcs: string[]): string {
  return pcs.join("  ");
}
