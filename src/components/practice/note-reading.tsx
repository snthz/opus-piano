"use client";

import { useState } from "react";
import { NoteReadingLevels } from "./note-reading-levels";
import { NoteReadingFree } from "./note-reading-free";

type Mode = "levels" | "free";

/**
 * «Leer notas» tiene dos caras: los niveles, que llevan de las cinco notas de
 * la posición de do a las dos claves con alteraciones, y el repaso libre de
 * toda la vida, una cola infinita con los ajustes a mano. Lo primero es para
 * aprender; lo segundo, para mantener.
 */
export function NoteReading() {
  const [mode, setMode] = useState<Mode>("levels");
  const switcher = (
    <div className="flex justify-center gap-1.5">
      {(
        [
          ["levels", "Niveles"],
          ["free", "Repaso libre"],
        ] as [Mode, string][]
      ).map(([id, text]) => (
        <button
          key={id}
          type="button"
          onClick={() => setMode(id)}
          aria-pressed={mode === id}
          className={`pill py-1.5 px-4 text-xs ${mode === id ? "pill-active" : ""}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
  return mode === "levels" ? <NoteReadingLevels switcher={switcher} /> : <NoteReadingFree switcher={switcher} />;
}
