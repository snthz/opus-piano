"use client";

import { useEffect, useId, useRef, useState } from "react";
import { loadVexFlow, type VexFlowModule } from "@/lib/vexflow";
import type { RenderContext, StemmableNote } from "vexflow/core";

export type ClefName = "treble" | "bass" | "alto" | "tenor" | "percussion";

export interface ScoreRenderApi {
  vf: VexFlowModule;
  ctx: RenderContext;
  width: number;
  height: number;
}

export interface ScoreProps {
  clef?: ClefName;
  /** "4/4", "3/4", "6/8", "C", "C|" */
  time?: string;
  /** Armadura en notación VexFlow: "G", "Bb", "F#m"… */
  keySignature?: string;
  /**
   * Compases en notación EasyScore, uno por elemento.
   * Ejemplo: ["C4/q, D4, E4, F4", "G4/h, G4"]. Silencios: "B4/q/r".
   */
  measures?: string[];
  /** Segundo pentagrama (mano izquierda) para el gran pentagrama. */
  bassMeasures?: string[];
  bassClef?: ClefName;
  /** Ancho lógico del dibujo; el SVG se escala al contenedor. */
  width?: number;
  /** Unir corcheas con barras automáticamente */
  beams?: boolean;
  /** Etiquetas de texto bajo cada nota del pentagrama superior (en orden) */
  labels?: string[];
  /** Etiquetas para el pentagrama inferior */
  bassLabels?: string[];
  labelPosition?: "above" | "below";
  /** Ligaduras de prolongación entre índices de notas del pentagrama superior: [[0,1],[3,4]] */
  ties?: [number, number][];
  /** Ligaduras de expresión (curvas) entre índices de notas */
  slurs?: [number, number][];
  /** Tresillos: [índice inicial, número de notas]. Por defecto 3 notas en el tiempo de 2. */
  tuplets?: [number, number][];
  /** Índice (entre todas las notas del pentagrama superior) que se resalta */
  highlight?: number;
  highlightColor?: string;
  /** Barra final al terminar */
  endBar?: "single" | "double" | "end" | "repeat" | "none";
  /** Texto accesible que describe el ejemplo */
  title?: string;
  className?: string;
  /** Modo manual: dibuja lo que quieras con la API de VexFlow */
  render?: (api: ScoreRenderApi) => void;
  height?: number;
  /** Se llama con las notas creadas (para animaciones o audio) */
  onNotes?: (notes: StemmableNote[]) => void;
}

const STAVE_HEIGHT = 125;

export function Score({
  clef = "treble",
  time,
  keySignature,
  measures = [],
  bassMeasures,
  bassClef = "bass",
  width = 520,
  beams = true,
  labels,
  bassLabels,
  labelPosition = "below",
  ties,
  slurs,
  tuplets,
  highlight,
  highlightColor,
  endBar = "none",
  title,
  className = "",
  render,
  height,
  onNotes,
}: ScoreProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const elementId = `score-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const grand = !!bassMeasures;
  const computedHeight = height ?? (render ? 160 : grand ? STAVE_HEIGHT * 2 + 40 : STAVE_HEIGHT + 30);
  const measuresKey = JSON.stringify([measures, bassMeasures]);
  const labelsKey = JSON.stringify([labels, bassLabels, ties, slurs, tuplets]);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    loadVexFlow()
      .then((vf) => {
        if (cancelled || !ref.current) return;
        el.innerHTML = "";
        try {
          if (render) {
            const renderer = new vf.Renderer(el, vf.Renderer.Backends.SVG);
            renderer.resize(width, computedHeight);
            const ctx = renderer.getContext();
            render({ vf, ctx, width, height: computedHeight });
          } else {
            drawMeasures(vf, {
              elementId,
              clef,
              time,
              keySignature,
              measures,
              bassMeasures,
              bassClef,
              width,
              height: computedHeight,
              beams,
              labels,
              bassLabels,
              labelPosition,
              ties,
              slurs,
              tuplets,
              highlight,
              highlightColor: highlightColor ?? getAccentColor(el),
              endBar,
              onNotes,
            });
          }
          const svg = el.querySelector("svg");
          if (svg) {
            svg.setAttribute("viewBox", `0 0 ${width} ${computedHeight}`);
            svg.setAttribute("width", String(width));
            svg.setAttribute("height", String(computedHeight));
            svg.setAttribute("role", "img");
            if (title) svg.setAttribute("aria-label", title);
          }
          setError(null);
        } catch (e) {
          console.error(e);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuresKey, clef, time, keySignature, width, beams, highlight, highlightColor, endBar, computedHeight, render, labelsKey, labelPosition]);

  return (
    <div className={`score-box ${className}`}>
      <div id={elementId} ref={ref} style={{ width: "100%", maxWidth: width }} />
      {error && <p className="text-xs text-bad mt-1">No se pudo dibujar la partitura: {error}</p>}
    </div>
  );
}

function getAccentColor(el: HTMLElement): string {
  const c = getComputedStyle(el).getPropertyValue("--accent").trim();
  return c || "#c26a08";
}

interface DrawOptions {
  elementId: string;
  clef: ClefName;
  time?: string;
  keySignature?: string;
  measures: string[];
  bassMeasures?: string[];
  bassClef: ClefName;
  width: number;
  height: number;
  beams: boolean;
  labels?: string[];
  bassLabels?: string[];
  labelPosition: "above" | "below";
  ties?: [number, number][];
  slurs?: [number, number][];
  tuplets?: [number, number][];
  highlight?: number;
  highlightColor: string;
  endBar: NonNullable<ScoreProps["endBar"]>;
  onNotes?: (notes: StemmableNote[]) => void;
}

function drawMeasures(vf: VexFlowModule, o: DrawOptions) {
  const factory = new vf.Factory({
    renderer: { elementId: o.elementId, width: o.width, height: o.height, backend: vf.Renderer.Backends.SVG },
  });
  const score = factory.EasyScore({ throwOnError: true });
  const ctx = factory.getContext();

  const count = Math.max(o.measures.length, o.bassMeasures?.length ?? 0, 1);
  const left = 10;
  const usable = o.width - left - 10;
  // El primer compás lleva clave/armadura/compás: necesita más espacio.
  const firstExtra = Math.min(70, usable * 0.18);
  const base = (usable - firstExtra) / count;

  const allTreble: StemmableNote[] = [];
  let bassCount = 0;
  const beamsToDraw: InstanceType<VexFlowModule["Beam"]>[] = [];

  const buildStave = (
    x: number,
    y: number,
    w: number,
    index: number,
    clefName: ClefName,
    notesStr: string | undefined,
    collect: boolean,
  ) => {
    const stave = factory.Stave({ x, y, width: w });
    if (index === 0) {
      stave.addClef(clefName);
      if (o.keySignature) stave.addKeySignature(o.keySignature);
      if (o.time) stave.addTimeSignature(o.time);
    }
    if (index === count - 1 && o.endBar !== "none") {
      const types = vf.Barline.type;
      stave.setEndBarType(
        o.endBar === "double" ? types.DOUBLE : o.endBar === "end" ? types.END : o.endBar === "repeat" ? types.REPEAT_END : types.SINGLE,
      );
    }
    if (notesStr && notesStr.trim()) {
      const notes = score.notes(notesStr, { clef: clefName });
      const labelList = collect ? o.labels : o.bassLabels;
      if (labelList) {
        const offset = collect ? allTreble.length : bassCount;
        notes.forEach((n, i) => {
          const text = labelList[offset + i];
          if (!text) return;
          const ann = new vf.Annotation(text);
          ann.setFont("Academico", 13);
          ann.setVerticalJustification(
            o.labelPosition === "above" ? vf.Annotation.VerticalJustify.TOP : vf.Annotation.VerticalJustify.BOTTOM,
          );
          n.addModifier(ann, 0);
        });
      }
      const startIndex = allTreble.length;
      if (collect) allTreble.push(...notes);
      else bassCount += notes.length;
      if (collect && o.tuplets) {
        for (const [from, n] of o.tuplets) {
          const local = from - startIndex;
          if (local >= 0 && local + n <= notes.length) {
            score.tuplet(notes.slice(local, local + n), { numNotes: n, notesOccupied: n === 3 ? 2 : n - 1 });
          }
        }
      }
      // Voz en modo SOFT: permite compases incompletos o ejemplos sin compás estricto.
      const voice = factory.Voice({ time: o.time ?? "4/4" });
      voice.setMode(vf.Voice.Mode.SOFT);
      voice.addTickables(notes);
      if (o.beams) beamsToDraw.push(...vf.Beam.generateBeams(notes));
      factory.Formatter().joinVoices([voice]).formatToStave([voice], stave);
    }
    return stave;
  };

  let x = left;
  for (let i = 0; i < count; i++) {
    const w = i === 0 ? base + firstExtra : base;
    const top = buildStave(x, 20, w, i, o.clef, o.measures[i], true);
    if (o.bassMeasures) {
      const bottom = buildStave(x, 20 + STAVE_HEIGHT, w, i, o.bassClef, o.bassMeasures[i], false);
      if (i === 0) {
        factory.StaveConnector({ topStave: top, bottomStave: bottom, type: "brace" });
      }
      factory.StaveConnector({ topStave: top, bottomStave: bottom, type: "singleLeft" });
      if (i === count - 1 && o.endBar !== "none") {
        factory.StaveConnector({
          topStave: top,
          bottomStave: bottom,
          type: o.endBar === "end" ? "boldDoubleRight" : o.endBar === "double" ? "thinDouble" : "singleRight",
        });
      }
    }
    x += w;
  }

  if (o.highlight !== undefined && allTreble[o.highlight]) {
    const n = allTreble[o.highlight];
    n.setStyle({ fillStyle: o.highlightColor, strokeStyle: o.highlightColor });
    if ("setLedgerLineStyle" in n) {
      (n as { setLedgerLineStyle: (s: { strokeStyle: string }) => void }).setLedgerLineStyle({ strokeStyle: o.highlightColor });
    }
  }

  for (const [a, b] of o.ties ?? []) {
    if (allTreble[a] && allTreble[b]) factory.StaveTie({ from: allTreble[a], to: allTreble[b] });
  }
  for (const [a, b] of o.slurs ?? []) {
    if (allTreble[a] && allTreble[b]) factory.Curve({ from: allTreble[a], to: allTreble[b], options: {} });
  }

  factory.draw();
  for (const b of beamsToDraw) b.setContext(ctx).draw();
  o.onNotes?.(allTreble);
}
