"use client";

import type { ReactNode } from "react";
import { EraserIcon, FingerIcon, MarkerIcon, PenIcon, UndoIcon } from "./reader-icons";
import {
  FINGERS,
  FINGER_SIZES,
  HIGHLIGHTER_COLORS,
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
  /** El subrayador guarda su color aparte del lápiz. */
  highlightColor: string;
  onHighlightColor: (color: string) => void;
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

/** Una casilla de color de la paleta. */
function Swatch({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
    >
      <span
        className="h-5 w-5 rounded-full transition-transform"
        style={{
          background: color,
          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
          outline: selected ? "2px solid var(--ink)" : "none",
          outlineOffset: "2px",
          transform: selected ? "scale(1.1)" : undefined,
        }}
      />
    </button>
  );
}

/**
 * La paleta de la herramienta puesta y, al final, una casilla para elegir
 * cualquier otro color a mano. Cuando el color elegido no es de la paleta, esa
 * última casilla lo enseña —y queda marcada— en lugar del arcoíris.
 */
function ColorRow({
  colors,
  value,
  onChange,
}: {
  colors: { id: string; value: string; label: string }[];
  value: string;
  onChange: (color: string) => void;
}) {
  const custom = !colors.some((c) => c.value.toLowerCase() === value.toLowerCase());
  return (
    <>
      {colors.map((c) => (
        <Swatch key={c.id} color={c.value} label={c.label} selected={value === c.value} onClick={() => onChange(c.value)} />
      ))}
      <label title="Otro color" className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full">
        <span
          className="h-5 w-5 rounded-full transition-transform"
          style={{
            background: custom
              ? value
              : "conic-gradient(#f43f5e, #f59e0b, #facc15, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)",
            boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
            outline: custom ? "2px solid var(--ink)" : "none",
            outlineOffset: "2px",
            transform: custom ? "scale(1.1)" : undefined,
          }}
        />
        {/* el selector nativo del sistema: en un iPad es la rueda de colores de iPadOS */}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Otro color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </>
  );
}

/** Color, grosor y dedo: solo se enseña lo que la herramienta puesta usa. */
export function AnnotationOptions({ state }: { state: AnnotationState }) {
  const { tool, color, onColor, highlightColor, onHighlightColor, penWidth, onPenWidth, finger, onFinger, fingerSize, onFingerSize } = state;
  if (tool !== "pen" && tool !== "finger" && tool !== "highlighter") return null;

  return (
    <div className="card flex max-w-full items-center gap-1 overflow-x-auto p-1.5 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-serif text-base font-bold transition-colors ${
                finger === f ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
        </>
      )}

      {tool === "highlighter" ? (
        <ColorRow colors={HIGHLIGHTER_COLORS} value={highlightColor} onChange={onHighlightColor} />
      ) : (
        <ColorRow colors={PEN_COLORS} value={color} onChange={onColor} />
      )}

      {tool === "finger" && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
          {FINGER_SIZES.map((z, i) => (
            <button
              key={z.id}
              type="button"
              onClick={() => onFingerSize(z.value)}
              title={z.label}
              aria-label={`Tamaño ${z.label.toLowerCase()}`}
              aria-pressed={fingerSize === z.value}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-serif font-bold leading-none transition-colors ${
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
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
          {PEN_WIDTHS.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onPenWidth(w.value)}
              title={w.label}
              aria-label={`Grosor ${w.label.toLowerCase()}`}
              aria-pressed={penWidth === w.value}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
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
