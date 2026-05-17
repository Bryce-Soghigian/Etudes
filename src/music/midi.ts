import { Note } from "tonal";

/** MIDI number -> scientific pitch e.g. 60 -> "C4" */
export function midiToName(midi: number): string {
  return Note.fromMidi(midi) ?? "";
}

/** Pitch class only, e.g. 61 -> "C#" */
export function midiToPitchClass(midi: number): string {
  const name = midiToName(midi);
  return name.replace(/-?\d+$/, "");
}

/** Compare two notes ignoring octave (enharmonic-safe via chroma). */
export function sameChroma(midiA: number, midiB: number): boolean {
  return ((midiA % 12) + 12) % 12 === ((midiB % 12) + 12) % 12;
}

/** Middle C (60) is the split point between left and right hands. */
export const HAND_SPLIT = 60;

/** Returns "right" for notes >= middle C, "left" otherwise. */
export function handBucket(midi: number): "left" | "right" {
  return midi >= HAND_SPLIT ? "right" : "left";
}

export const MIDI_LOW = 21; // A0
export const MIDI_HIGH = 108; // C8
