"use client";

import type { ReactNode } from "react";
import { EraserIcon, FingerIcon, MarkerIcon, PenIcon, UndoIcon } from "./reader-icons";
import {
  FINGERS,
  FINGER_SIZES,
  PEN_COLORS,
  PEN_WIDTHS,
  type Finger,
  type Tool,
} from "./score-annotator";

/**
 * Los mandos de escribir sobre una partitura: lápiz, subrayador, digitación,
 * borrador y deshacer, y debajo las opciones de lo que esté elegido.
 *
 * Son los mismos en un PDF y en un MusicXML, así que viven aquí y no dentro
 * del lector de PDF: lo que cambia entre uno y otro es dónde se pinta, no con
 * qué se pinta.
 */

/** Grupo de mandos relacionados, hundido sobre la barra para separarlos sin líneas. */
export const Group = ({ children }: { children: ReactNode }) => (
  <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-2 p-1">{children}</div>
);

/** Botón redondo de icono. El rótulo no cabe, así que va en `title`/aria-label; `active` marca la herramienta puesta. */
export function ToolButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-25 ${
        active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export interface AnnotationState {
  tool: Tool | null;
  onTool: (tool: Tool) => void;
  color: string;
  onColor: (color: string) => void;
  penWidth: number;
  onPenWidth: (width: number) => void;
  finger: Finger;
  onFinger: (finger: Finger) => void;
  fingerSize: number;
  onFingerSize: (size: number) => void;
}

/** Lápiz, subrayador, digitación, borrador y deshacer. */
export function AnnotationTools({
  state,
  onUndo,
  canUndo,
}: {
  state: AnnotationState;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const { tool, onTool } = state;
  return (
    <Group>
      <ToolButton label="Lápiz" active={tool === "pen"} onClick={() => onTool("pen")}>
        <PenIcon />
      </ToolButton>
      <ToolButton label="Subrayador" active={tool === "highlighter"} onClick={() => onTool("highlighter")}>
        <MarkerIcon />
      </ToolButton>
      <ToolButton label="Digitación: toca una nota para escribir el dedo encima" active={tool === "finger"} onClick={() => onTool("finger")}>
        <FingerIcon />
      </ToolButton>
      <ToolButton label="Borrador" active={tool === "eraser"} onClick={() => onTool("eraser")}>
        <EraserIcon />
      </ToolButton>
      <ToolButton label="Deshacer lo último" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon />
      </ToolButton>
    </Group>
  );
}

/** Color, grosor y dedo: solo se enseña lo que la herramienta puesta usa. */
export function AnnotationOptions({ state }: { state: AnnotationState }) {
  const { tool, color, onColor, penWidth, onPenWidth, finger, onFinger, fingerSize, onFingerSize } = state;
  if (tool !== "pen" && tool !== "finger") return null;

  return (
    <div className="card flex items-center gap-1 p-1.5 shadow-md">
      {tool === "finger" && (
        <>
          {FINGERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFinger(f)}
              title={`Dedo ${f}`}
              aria-label={`Dedo ${f}`}
              aria-pressed={finger === f}
              className={`grid h-8 w-8 place-items-center rounded-full font-serif text-base font-bold transition-colors ${
                finger === f ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        </>
      )}

      {PEN_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onColor(c.value)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={color === c.value}
          className="grid h-8 w-8 place-items-center rounded-full"
        >
          <span
            className="h-5 w-5 rounded-full transition-transform"
            style={{
              background: c.value,
              boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
              outline: color === c.value ? "2px solid var(--ink)" : "none",
              outlineOffset: "2px",
              transform: color === c.value ? "scale(1.1)" : undefined,
            }}
          />
        </button>
      ))}

      {tool === "finger" && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          {FINGER_SIZES.map((z, i) => (
            <button
              key={z.id}
              type="button"
              onClick={() => onFingerSize(z.value)}
              title={z.label}
              aria-label={`Tamaño ${z.label.toLowerCase()}`}
              aria-pressed={fingerSize === z.value}
              className={`grid h-8 w-8 place-items-center rounded-full font-serif font-bold leading-none transition-colors ${
                fingerSize === z.value ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              <span style={{ fontSize: 10 + i * 3 }}>{finger}</span>
            </button>
          ))}
        </>
      )}

      {tool === "pen" && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          {PEN_WIDTHS.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onPenWidth(w.value)}
              title={w.label}
              aria-label={`Grosor ${w.label.toLowerCase()}`}
              aria-pressed={penWidth === w.value}
              className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                penWidth === w.value ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              <span className="rounded-full bg-current" style={{ width: 6 + i * 4, height: 6 + i * 4 }} />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
