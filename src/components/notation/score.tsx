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

export interface MeasureRepeat {
  start?: boolean;
  end?: boolean;
  ending?: { number: number; bracket: "begin" | "mid" | "end" | "both" };
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
  /**
   * Factor máximo de ampliación cuando sobra espacio. Con 1 (por defecto) el
   * dibujo nunca crece más allá de `width`. Con un valor mayor ocupa el ancho
   * disponible hasta `width * scale` y se centra.
   */
  scale?: number;
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
  /** Índices (entre todas las notas del pentagrama superior) que se resaltan */
  highlight?: number | number[];
  /** Ídem para el pentagrama inferior */
  bassHighlight?: number | number[];
  highlightColor?: string;
  /** Ligaduras de prolongación en el pentagrama inferior */
  bassTies?: [number, number][];
  /** Dibujar la indicación de compás en el primer compás (en los sistemas siguientes no se repite) */
  showTime?: boolean;
  /** Colores por índice de nota (p. ej. resultados de un ejercicio) */
  noteStyles?: Record<number, string>;
  /** Barra final al terminar */
  endBar?: "single" | "double" | "end" | "repeat" | "none";
  /** Por compás: barras de repetición que abren o cierran y casilla («1.», «2.») con el tramo de corchete que le toca */
  repeats?: MeasureRepeat[];
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
  scale = 1,
  beams = true,
  labels,
  bassLabels,
  labelPosition = "below",
  ties,
  slurs,
  tuplets,
  highlight,
  bassHighlight,
  highlightColor,
  noteStyles,
  bassTies,
  showTime = true,
  endBar = "none",
  repeats,
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
  const labelsKey = JSON.stringify([labels, bassLabels, ties, bassTies, slurs, tuplets, noteStyles, repeats]);
  const highlightKey = JSON.stringify([highlight, bassHighlight]);

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
              bassHighlight,
              highlightColor: highlightColor ?? getAccentColor(el),
              noteStyles,
              bassTies,
              showTime,
              endBar,
              repeats,
              onNotes,
            });
          }
          const svg = el.querySelector("svg");
          if (svg) {
            // VexFlow deja 40px sobre la primera línea y la clave de sol asoma por
            // debajo de la última: con alturas ajustadas el SVG recortaba el dibujo.
            // Medimos el contenido real y ampliamos la vista si se sale (nunca la
            // encogemos, para no cambiar el tamaño de los ejemplos que ya encajan).
            let top = 0;
            let bottom = computedHeight;
            try {
              const box = (svg as SVGSVGElement).getBBox();
              if (box.height > 0) {
                const pad = 4;
                top = Math.min(top, box.y - pad);
                bottom = Math.max(bottom, box.y + box.height + pad);
              }
            } catch {
              // getBBox falla si el SVG no está en el layout; nos quedamos con la caja pedida.
            }
            svg.setAttribute("viewBox", `0 ${top} ${width} ${bottom - top}`);
            svg.setAttribute("width", String(width));
            svg.setAttribute("height", String(bottom - top));
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
  }, [measuresKey, clef, time, keySignature, width, beams, highlightKey, highlightColor, endBar, computedHeight, render, labelsKey, labelPosition, showTime]);

  return (
    <div className={`score-box ${scale > 1 ? "w-full" : ""} ${className}`}>
      <div
        id={elementId}
        ref={ref}
        style={{ width: "100%", maxWidth: width * scale, marginInline: scale > 1 ? "auto" : undefined }}
      />
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
  highlight?: number | number[];
  bassHighlight?: number | number[];
  highlightColor: string;
  noteStyles?: Record<number, string>;
  bassTies?: [number, number][];
  showTime: boolean;
  endBar: NonNullable<ScoreProps["endBar"]>;
  repeats?: MeasureRepeat[];
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
  const allBass: StemmableNote[] = [];
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
      if (o.time && o.showTime) stave.addTimeSignature(o.time);
    }
    const types = vf.Barline.type;
    const rep = o.repeats?.[index];
    if (index === count - 1 && o.endBar !== "none") {
      stave.setEndBarType(
        o.endBar === "double" ? types.DOUBLE : o.endBar === "end" ? types.END : o.endBar === "repeat" ? types.REPEAT_END : types.SINGLE,
      );
    }
    // Las repeticiones mandan sobre la barra final: «:|» ya es una barra gruesa.
    if (rep?.start) stave.setBegBarType(types.REPEAT_BEGIN);
    if (rep?.end) stave.setEndBarType(types.REPEAT_END);
    if (rep?.ending && collect) {
      const volta = vf.Volta.type;
      const kind = rep.ending.bracket === "begin" ? volta.BEGIN : rep.ending.bracket === "end" ? volta.END : rep.ending.bracket === "both" ? volta.BEGIN_END : volta.MID;
      stave.setVoltaType(kind, `${rep.ending.number}.`, 0);
    }
    if (notesStr && notesStr.trim()) {
      const notes = score.notes(notesStr, { clef: clefName });
      const labelList = collect ? o.labels : o.bassLabels;
      if (labelList) {
        const offset = collect ? allTreble.length : allBass.length;
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
      else allBass.push(...notes);
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
      if (o.beams) {
        const groups = vf.Beam.getDefaultBeamGroups(o.time ?? "4/4");
        beamsToDraw.push(...vf.Beam.generateBeams(notes, { groups }));
      }
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
      if (o.repeats?.[i]?.end) {
        factory.StaveConnector({ topStave: top, bottomStave: bottom, type: "boldDoubleRight" });
      } else if (i === count - 1 && o.endBar !== "none") {
        factory.StaveConnector({
          topStave: top,
          bottomStave: bottom,
          type: o.endBar === "end" ? "boldDoubleRight" : o.endBar === "double" ? "thinDouble" : "singleRight",
        });
      }
    }
    x += w;
  }

  if (o.noteStyles) {
    for (const [idx, color] of Object.entries(o.noteStyles)) {
      const n = allTreble[Number(idx)];
      if (n) n.setStyle({ fillStyle: color, strokeStyle: color });
    }
  }
  const paint = (list: StemmableNote[], which?: number | number[]) => {
    if (which === undefined) return;
    for (const i of Array.isArray(which) ? which : [which]) {
      const n = list[i];
      if (!n) continue;
      n.setStyle({ fillStyle: o.highlightColor, strokeStyle: o.highlightColor });
      if ("setLedgerLineStyle" in n) {
        (n as { setLedgerLineStyle: (s: { strokeStyle: string }) => void }).setLedgerLineStyle({ strokeStyle: o.highlightColor });
      }
    }
  };
  paint(allTreble, o.highlight);
  paint(allBass, o.bassHighlight);

  for (const [a, b] of o.ties ?? []) {
    if (allTreble[a] && allTreble[b]) factory.StaveTie({ from: allTreble[a], to: allTreble[b] });
  }
  for (const [a, b] of o.bassTies ?? []) {
    if (allBass[a] && allBass[b]) factory.StaveTie({ from: allBass[a], to: allBass[b] });
  }
  for (const [a, b] of o.slurs ?? []) {
    if (allTreble[a] && allTreble[b]) factory.Curve({ from: allTreble[a], to: allTreble[b], options: {} });
  }

  factory.draw();
  for (const b of beamsToDraw) b.setContext(ctx).draw();
  o.onNotes?.(allTreble);
}
