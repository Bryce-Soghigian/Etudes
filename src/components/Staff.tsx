import { useEffect, useRef } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  StaveConnector,
  Accidental,
  Formatter,
  Voice,
} from "vexflow";

type Props = {
  /** treble voice (ascending notes with octaves), or null */
  trebleNotes: string[] | null;
  /** bass voice (ascending notes with octaves), or null */
  bassNotes: string[] | null;
  /** index of the "current" step to highlight; null = none */
  activeIndex: number | null;
};

function noteToKey(n: string): { key: string; acc: string | null } {
  const pc = n.replace(/-?\d+$/, "").toLowerCase();
  const oct = parseInt(n.match(/-?\d+$/)?.[0] ?? "4", 10);
  const accMatch = pc.match(/^[a-g]([#b]+)?/);
  const acc = accMatch?.[1] ?? null;
  return { key: `${pc}/${oct}`, acc };
}

function buildVoice(
  notes: string[],
  activeIndex: number | null,
  clef: "treble" | "bass",
) {
  return notes.map((n, i) => {
    const { key, acc } = noteToKey(n);
    const sn = new StaveNote({ keys: [key], duration: "q", clef });
    if (acc) sn.addModifier(new Accidental(acc), 0);
    const isActive = activeIndex === i;
    const color = isActive ? "#d4a04a" : "rgba(244,234,213,0.92)";
    sn.setStyle({ fillStyle: color, strokeStyle: color });
    return sn;
  });
}

export function Staff({ trebleNotes, bassNotes, activeIndex }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";

    const lengthRef = trebleNotes ?? bassNotes;
    if (!lengthRef || lengthRef.length === 0) return;

    const isGrand = !!trebleNotes && !!bassNotes;
    const width = Math.max(560, lengthRef.length * 56 + 100);
    const height = isGrand ? 260 : 160;

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    context.setFont("Cormorant Garamond", 12);

    const trebleY = 24;
    const bassY = 130;
    const staveX = 20;
    const staveW = width - 40;

    let trebleStave: Stave | null = null;
    let bassStave: Stave | null = null;

    if (trebleNotes) {
      trebleStave = new Stave(staveX, trebleY, staveW);
      trebleStave.addClef("treble");
      trebleStave.setContext(context).draw();
    }
    if (bassNotes) {
      bassStave = new Stave(staveX, isGrand ? bassY : trebleY, staveW);
      bassStave.addClef("bass");
      bassStave.setContext(context).draw();
    }

    if (isGrand && trebleStave && bassStave) {
      new StaveConnector(trebleStave, bassStave)
        .setType(StaveConnector.type.BRACE)
        .setContext(context)
        .draw();
      new StaveConnector(trebleStave, bassStave)
        .setType(StaveConnector.type.SINGLE_LEFT)
        .setContext(context)
        .draw();
      new StaveConnector(trebleStave, bassStave)
        .setType(StaveConnector.type.SINGLE_RIGHT)
        .setContext(context)
        .draw();
    }

    // Recolor stave lines to bone palette
    const svg = host.querySelector("svg");
    if (svg) {
      svg.querySelectorAll("path, line, rect").forEach((el) => {
        const cur = (el as SVGElement).getAttribute("stroke");
        if (cur && cur !== "none") {
          (el as SVGElement).setAttribute("stroke", "rgba(244,234,213,0.55)");
        }
        const fill = (el as SVGElement).getAttribute("fill");
        if (fill && fill !== "none" && fill !== "transparent") {
          (el as SVGElement).setAttribute("fill", "rgba(244,234,213,0.55)");
        }
      });
    }

    if (trebleStave && trebleNotes) {
      const notes = buildVoice(trebleNotes, activeIndex, "treble");
      const voice = new Voice({ num_beats: notes.length, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveW - 80);
      voice.draw(context, trebleStave);
    }
    if (bassStave && bassNotes) {
      const notes = buildVoice(bassNotes, activeIndex, "bass");
      const voice = new Voice({ num_beats: notes.length, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveW - 80);
      voice.draw(context, bassStave);
    }
  }, [trebleNotes, bassNotes, activeIndex]);

  return <div ref={hostRef} className="staff-host" />;
}
