"use client";

import { useEffect, useRef, useState } from "react";
import { playSequence, unlockAudio, type PlaybackHandle, type SequenceEvent } from "@/lib/audio/synth";
import { useSettings } from "@/lib/settings";

export function PlayButton({
  events,
  bpm = 90,
  label = "Escuchar",
  beatsPerBar,
  metronome = false,
  onEvent,
  className = "",
  size = "md",
}: {
  events: SequenceEvent[];
  bpm?: number;
  label?: string;
  beatsPerBar?: number;
  metronome?: boolean;
  onEvent?: (index: number) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const { settings } = useSettings();
  const [playing, setPlaying] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);

  useEffect(() => () => handle.current?.stop(), []);

  const toggle = async () => {
    if (playing) {
      handle.current?.stop();
      setPlaying(false);
      return;
    }
    await unlockAudio();
    setPlaying(true);
    handle.current = playSequence(events, bpm, { onEvent, beatsPerBar, metronome });
    handle.current.done.then(() => setPlaying(false));
  };

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!settings.sound}
      title={settings.sound ? undefined : "El sonido está desactivado en Ajustes"}
      className={`inline-flex items-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 ${pad} ${
        playing ? "bg-ink text-paper" : "bg-accent text-white hover:brightness-110"
      } ${className}`}
    >
      <span aria-hidden="true">{playing ? "■" : "▶"}</span>
      {playing ? "Detener" : label}
    </button>
  );
}
