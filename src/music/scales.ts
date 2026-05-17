import { Scale, Note } from "tonal";

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

export type ScaleSequence = {
  /** pitch-classes ascending, e.g. ["C","D","E","F","G","A","B"] */
  pitchClasses: string[];
  /** full ascending+descending note list with octaves, e.g. ["C4","D4",...,"C5","B4",...,"C4"] */
  notes: string[];
  /** corresponding MIDI numbers */
  midi: number[];
  /** display key signature, e.g. "C Major" */
  title: string;
};

/**
 * Build an ascending-then-descending one-octave sequence for the given scale,
 * starting at `startOctave` and returning to it.
 */
export function buildScaleSequence(
  tonic: string,
  familyId: string,
  startOctave = 4,
): ScaleSequence {
  const family = SCALE_FAMILIES.find((f) => f.id === familyId) ?? SCALE_FAMILIES[0];
  const sc = Scale.get(`${tonic} ${family.tonalName}`);
  const pcs = sc.notes.length ? sc.notes : Scale.get(`C ${family.tonalName}`).notes;

  // Ascending with octaves
  const ascending: string[] = [];
  let lastChroma = -1;
  let oct = startOctave;
  for (const pc of pcs) {
    const chroma = Note.chroma(pc);
    if (chroma === undefined) continue;
    if (chroma <= lastChroma) oct += 1;
    ascending.push(`${pc}${oct}`);
    lastChroma = chroma;
  }
  // Add octave tonic on top
  ascending.push(`${pcs[0]}${oct + 1}`);

  const descending = [...ascending].slice(0, -1).reverse();
  const notes = [...ascending, ...descending];
  const midi = notes.map((n) => Note.midi(n) ?? 0);

  return {
    pitchClasses: pcs,
    notes,
    midi,
    title: `${tonic} ${family.label}`,
  };
}

/** Format pitch-classes into a comma-separated formula like "C  D  E  F  G  A  B" */
export function formatPitchClasses(pcs: string[]): string {
  return pcs.join("  ");
}
