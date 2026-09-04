"use client";

import { useState } from "react";
import { Score } from "./score";
import { PianoKeyboard } from "./piano-keyboard";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { useSettings } from "@/lib/settings";
import { fromDiatonicIndex, diatonicIndex, fullName, toMidi, toEasyScore, MIDDLE_C, type Pitch } from "@/lib/music/pitch";
import { playNote, unlockAudio } from "@/lib/audio/synth";

/**
 * Explorador interactivo: una nota en el pentagrama, su nombre y su tecla.
 * Flechas para subir o bajar de posición; se puede cambiar de clave.
 */
export function NoteExplorer() {
  const { settings } = useSettings();
  const [clef, setClef] = useState<"treble" | "bass">("treble");
  const [pitch, setPitch] = useState<Pitch>(MIDDLE_C);

  const min = clef === "treble" ? diatonicIndex({ letter: "F", accidental: 0, octave: 3 }) : diatonicIndex({ letter: "A", accidental: 0, octave: 1 });
  const max = clef === "treble" ? diatonicIndex({ letter: "E", accidental: 0, octave: 6 }) : diatonicIndex({ letter: "G", accidental: 0, octave: 4 });
  const idx = diatonicIndex(pitch);
  const midi = toMidi(pitch);

  const move = (delta: number) => {
    const next = Math.min(max, Math.max(min, idx + delta));
    const p = fromDiatonicIndex(next);
    setPitch(p);
    if (settings.sound) void unlockAudio().then(() => playNote(toMidi(p), { duration: 0.8, velocity: settings.volume }));
  };

  const switchClef = (c: "treble" | "bass") => {
    setClef(c);
    setPitch(c === "treble" ? MIDDLE_C : { letter: "C", accidental: 0, octave: 3 });
  };

  return (
    <div className="card p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => switchClef("treble")} className={`pill ${clef === "treble" ? "pill-active" : ""}`}>
            Clave de sol
          </button>
          <button type="button" onClick={() => switchClef("bass")} className={`pill ${clef === "bass" ? "pill-active" : ""}`}>
            Clave de fa
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Nota más grave" className="btn-circle w-10 h-10">
            <ChevronIcon dir="down" className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Nota más aguda" className="btn-circle w-10 h-10">
            <ChevronIcon dir="down" className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
        <Score clef={clef} measures={[`${toEasyScore(pitch)}/w`]} width={220} height={150} highlight={0} />
        <div className="text-center md:text-left">
          <p className="text-4xl font-bold tracking-tight">{fullName(pitch, settings.naming)}</p>
          <p className="text-ink-2 text-sm mt-1">
            {settings.naming === "latino" ? fullName(pitch, "anglosajon") : fullName(pitch, "latino")} · MIDI {midi}
          </p>
        </div>
      </div>

      <PianoKeyboard from={clef === "treble" ? 55 : 36} to={clef === "treble" ? 84 : 65} highlight={[midi]} labels="c" onPress={() => {}} />
      <p className="text-xs text-ink-3">Usa las flechas para recorrer el pentagrama de posición en posición. Toca el teclado para escuchar cualquier tecla.</p>
    </div>
  );
}
