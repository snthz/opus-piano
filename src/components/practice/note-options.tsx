"use client";

import { OptionButton } from "./exercise-shell";
import { letterLabel } from "@/lib/practice/naming";
import { LETTERS, type Letter } from "@/lib/music/pitch";
import { useSettings } from "@/lib/settings";

/**
 * Los siete botones de respuesta, compartidos por los dos modos de «Leer
 * notas». Cada uno lleva su atajo de teclado en una esquina: la tecla está
 * siempre ahí, y verla es lo que hace que se use.
 */
export function NoteOptions({
  accidental,
  chosen,
  correct,
  revealed,
  onChoose,
}: {
  /** Alteración elegida, para que el botón enseñe «do♯» y no «do». */
  accidental: number;
  chosen: Letter | null;
  /** La letra correcta; solo se mira cuando `revealed`. */
  correct: Letter;
  revealed: boolean;
  onChoose: (letter: Letter) => void;
}) {
  const { settings } = useSettings();
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {LETTERS.map((l, i) => {
        let state: "idle" | "correct" | "wrong" | "dim" = "idle";
        if (revealed) {
          if (l === correct) state = "correct";
          else if (l === chosen) state = "wrong";
          else state = "dim";
        }
        const label = letterLabel(l, accidental, settings);
        return (
          <OptionButton
            key={l}
            onClick={() => onChoose(l)}
            state={state}
            disabled={revealed}
            className="relative leading-tight"
          >
            <span className="block">{label.main}</span>
            {label.alt && <span className="block text-[0.65rem] opacity-60">{label.alt}</span>}
            <span className="hidden sm:block absolute top-1 right-2 text-[0.6rem] font-semibold opacity-40" aria-hidden="true">
              {i + 1}
            </span>
          </OptionButton>
        );
      })}
    </div>
  );
}

const ACCIDENTAL_GLYPH: Record<number, string> = { [-1]: "", 0: "", 1: "" };
const ACCIDENTAL_NAME: Record<number, string> = { [-1]: "bemol", 0: "natural", 1: "sostenido" };
const ACCIDENTAL_KEY: Record<number, string> = { [-1]: "↓", 0: "0", 1: "↑" };

export function AccidentalPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (accidental: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex justify-center gap-2">
      {[-1, 0, 1].map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          disabled={disabled}
          aria-pressed={value === a}
          aria-label={ACCIDENTAL_NAME[a]}
          className={`pill w-14 justify-center gap-1 ${value === a ? "pill-active" : ""}`}
        >
          <span className="smufl-text text-lg">{ACCIDENTAL_GLYPH[a]}</span>
          <span className="hidden sm:inline text-[0.6rem] font-semibold opacity-40" aria-hidden="true">
            {ACCIDENTAL_KEY[a]}
          </span>
        </button>
      ))}
    </div>
  );
}

/** La chuleta de atajos. Solo en pantallas con sitio: en el móvil no hay teclas. */
export function KeyboardHint({ accidentals }: { accidentals: boolean }) {
  return (
    <p className="hidden sm:block text-center text-[0.7rem] text-ink-3">
      Con el teclado: <strong>1-7</strong> para do…si, o las letras <strong>C-B</strong>
      {accidentals && (
        <>
          {" "}
          · <strong>↑</strong> sostenido, <strong>↓</strong> bemol, <strong>0</strong> natural
        </>
      )}
    </p>
  );
}
