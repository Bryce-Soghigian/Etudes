import { useCallback, useEffect, useRef, useState } from "react";

export type MidiStatus =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "denied"; message: string }
  | { kind: "ready"; inputs: MIDIInput[]; activeId: string | null };

export type MidiEvent =
  | { type: "noteOn"; note: number; velocity: number; at: number }
  | { type: "noteOff"; note: number; at: number };

export type MidiListener = (e: MidiEvent) => void;

export function useMidi() {
  const [status, setStatus] = useState<MidiStatus>(() =>
    typeof navigator !== "undefined" && "requestMIDIAccess" in navigator
      ? { kind: "idle" }
      : { kind: "unsupported" },
  );
  const [heldNotes, setHeldNotes] = useState<Set<number>>(new Set());
  const listenersRef = useRef<Set<MidiListener>>(new Set());
  const accessRef = useRef<MIDIAccess | null>(null);

  const subscribe = useCallback((fn: MidiListener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const emit = useCallback((e: MidiEvent) => {
    for (const fn of listenersRef.current) fn(e);
  }, []);

  const attach = useCallback(
    (input: MIDIInput) => {
      input.onmidimessage = (msg) => {
        const data = (msg as MIDIMessageEvent).data;
        if (!data) return;
        const [statusByte, data1, data2] = data;
        const cmd = statusByte & 0xf0;
        if (cmd === 0x90 && data2 > 0) {
          setHeldNotes((prev) => {
            const next = new Set(prev);
            next.add(data1);
            return next;
          });
          emit({ type: "noteOn", note: data1, velocity: data2, at: performance.now() });
        } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
          setHeldNotes((prev) => {
            if (!prev.has(data1)) return prev;
            const next = new Set(prev);
            next.delete(data1);
            return next;
          });
          emit({ type: "noteOff", note: data1, at: performance.now() });
        }
      };
    },
    [emit],
  );

  const detachAll = useCallback(() => {
    if (!accessRef.current) return;
    accessRef.current.inputs.forEach((i) => {
      i.onmidimessage = null;
    });
  }, []);

  const selectInput = useCallback(
    (id: string | null) => {
      if (!accessRef.current) return;
      detachAll();
      if (id) {
        const input = accessRef.current.inputs.get(id);
        if (input) attach(input);
      }
      setStatus((prev) =>
        prev.kind === "ready" ? { ...prev, activeId: id } : prev,
      );
    },
    [attach, detachAll],
  );

  const connect = useCallback(async () => {
    if (status.kind === "unsupported") return;
    setStatus({ kind: "requesting" });
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      const inputs = Array.from(access.inputs.values());
      const first = inputs[0] ?? null;
      if (first) attach(first);
      setStatus({ kind: "ready", inputs, activeId: first?.id ?? null });

      access.onstatechange = () => {
        const refreshed = Array.from(access.inputs.values());
        setStatus((prev) => {
          if (prev.kind !== "ready") return prev;
          const stillActive = refreshed.find((i) => i.id === prev.activeId);
          const activeId = stillActive ? prev.activeId : refreshed[0]?.id ?? null;
          if (activeId && activeId !== prev.activeId) {
            const next = refreshed.find((i) => i.id === activeId);
            if (next) attach(next);
          }
          return { kind: "ready", inputs: refreshed, activeId };
        });
      };
    } catch (err) {
      setStatus({
        kind: "denied",
        message: err instanceof Error ? err.message : "Permission denied.",
      });
    }
  }, [attach, status.kind]);

  useEffect(() => {
    return () => detachAll();
  }, [detachAll]);

  return { status, heldNotes, connect, selectInput, subscribe };
}
