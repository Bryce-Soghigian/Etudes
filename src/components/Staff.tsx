import { useEffect, useRef } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  Accidental,
  Formatter,
  Voice,
} from "vexflow";
import { Note } from "tonal";

type Props = {
  /** ordered scale notes with octaves, e.g. ["C4","D4",...] */
  notes: string[];
  /** index of the "current" note in guided mode; null = none */
  activeIndex: number | null;
};

export function Staff({ notes, activeIndex }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || notes.length === 0) return;
    host.innerHTML = "";

    // Use only the ascending portion for the staff (cleaner read)
    const ascend = notes.slice(0, Math.ceil(notes.length / 2) + 1);

    const width = Math.max(560, ascend.length * 56 + 80);
    const height = 160;

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    context.setFont("Cormorant Garamond", 12);

    const stave = new Stave(20, 24, width - 40);
    stave.addClef("treble");
    stave.setContext(context).draw();

    // Style stave lines
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

    const staveNotes: StaveNote[] = ascend.map((n, i) => {
      const pc = n.replace(/-?\d+$/, "").toLowerCase();
      const oct = parseInt(n.match(/-?\d+$/)?.[0] ?? "4", 10);
      const key = `${pc}/${oct}`;
      const sn = new StaveNote({ keys: [key], duration: "q" });
      const accMatch = pc.match(/^[a-g]([#b]+)?/);
      const acc = accMatch?.[1];
      if (acc) sn.addModifier(new Accidental(acc), 0);
      const isActive = activeIndex === i;
      const color = isActive
        ? "#d4a04a"
        : "rgba(244,234,213,0.92)";
      sn.setStyle({ fillStyle: color, strokeStyle: color });
      return sn;
    });

    const voice = new Voice({
      num_beats: staveNotes.length,
      beat_value: 4,
    });
    voice.setStrict(false);
    voice.addTickables(staveNotes);

    new Formatter().joinVoices([voice]).format([voice], width - 100);
    voice.draw(context, stave);
  }, [notes, activeIndex]);

  // expose note count for layout
  useEffect(() => void Note.midi("C4"), []);

  return <div ref={hostRef} className="staff-host" />;
}
