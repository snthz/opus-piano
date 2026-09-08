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
  /** Key signature in VexFlow notation: "G", "Bb", "F#m"… */
  keySignature?: string;
  /**
   * Measures in EasyScore notation, one per element.
   * Example: ["C4/q, D4, E4, F4", "G4/h, G4"]. Rests: "B4/q/r".
   */
  measures?: string[];
  /** Second staff (left hand) for the grand staff. */
  bassMeasures?: string[];
  bassClef?: ClefName;
  /** Logical drawing width; the SVG scales to its container. */
  width?: number;
  /**
   * Max scale factor when there's extra space. At 1 (default) the drawing
   * never grows past `width`. Above 1, it fills up to `width * scale` and centers.
   */
  scale?: number;
  /** Auto-beam eighth notes. */
  beams?: boolean;
  /** Text labels under each top-staff note (in order). */
  labels?: string[];
  /** Labels for the bottom staff. */
  bassLabels?: string[];
  labelPosition?: "above" | "below";
  /** Ties between top-staff note indices: [[0,1],[3,4]]. */
  ties?: [number, number][];
  /** Slurs (curves) between note indices. */
  slurs?: [number, number][];
  /** Tuplets: [start index, note count]. Defaults to 3 notes in the time of 2. */
  tuplets?: [number, number][];
  /** Indices (across all top-staff notes) to highlight. */
  highlight?: number | number[];
  /** Same, for the bottom staff. */
  bassHighlight?: number | number[];
  highlightColor?: string;
  /**
   * A background band behind the highlighted note, on top of the color.
   * With note names shown, color alone doesn't stand out; the band shows
   * playback position at a glance.
   */
  highlightBand?: boolean;
  /** Ties on the bottom staff. */
  bassTies?: [number, number][];
  /** Draw the time signature on the first measure (not repeated on later systems). */
  showTime?: boolean;
  /** Colors by note index (e.g. exercise results). */
  noteStyles?: Record<number, string>;
  /** Final barline. */
  endBar?: "single" | "double" | "end" | "repeat" | "none";
  /** Per measure: opening/closing repeat barlines and ending ("1.", "2.") with its bracket segment. */
  repeats?: MeasureRepeat[];
  /** Accessible text describing the example. */
  title?: string;
  className?: string;
  /** Manual mode: draw anything with the VexFlow API. */
  render?: (api: ScoreRenderApi) => void;
  height?: number;
  /** Called with the notes created (for animation or audio). */
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
  highlightBand = false,
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
              highlightBand,
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
            // VexFlow leaves 40px above the first line and the treble clef pokes
            // below the last one, so tight heights clipped the drawing. Measure the
            // real content and expand the view if it overflows (never shrink it,
            // to keep already-fitting examples the same size).
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
              // getBBox fails if the SVG isn't in the layout yet; fall back to the requested box
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
  }, [measuresKey, clef, time, keySignature, width, beams, highlightKey, highlightColor, highlightBand, endBar, computedHeight, render, labelsKey, labelPosition, showTime]);

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
  highlightBand: boolean;
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
  // the first measure carries clef/key/time, so it needs more room
  const firstExtra = Math.min(70, usable * 0.18);
  const base = (usable - firstExtra) / count;

  const allTreble: StemmableNote[] = [];
  const allBass: StemmableNote[] = [];
  const beamsToDraw: InstanceType<VexFlowModule["Beam"]>[] = [];
  const asSet = (which?: number | number[]) => new Set(which === undefined ? [] : Array.isArray(which) ? which : [which]);
  const lit = { treble: asSet(o.highlight), bass: asSet(o.bassHighlight) };

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
    // repeats override the final barline: ":|" is already a heavy barline
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
          // the note currently sounding gets its label bolded in the highlight color
          const on = (collect ? lit.treble : lit.bass).has(offset + i);
          const ann = new vf.Annotation(text);
          ann.setFont("Academico", on ? 15 : 13, on ? "bold" : "normal");
          if (on) ann.setStyle({ fillStyle: o.highlightColor, strokeStyle: o.highlightColor });
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
      // SOFT mode voice: allows incomplete measures or examples without a strict meter
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
  if (o.highlightBand) {
    drawBands(o, [...pick(allTreble, o.highlight), ...pick(allBass, o.bassHighlight)], vf.Annotation.CATEGORY);
  }
  o.onNotes?.(allTreble);
}

function pick(list: StemmableNote[], which?: number | number[]): StemmableNote[] {
  if (which === undefined) return [];
  return (Array.isArray(which) ? which : [which]).map((i) => list[i]).filter(Boolean);
}

const SVG_NS = "http://www.w3.org/2000/svg";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Drawn box of a VexFlow element, or null if not laid out yet. */
function boxOf(el: { getSVGElement(suffix?: string): SVGElement | undefined }): Box | null {
  try {
    const g = el.getSVGElement();
    if (!g || !("getBBox" in g)) return null;
    const b = (g as SVGGraphicsElement).getBBox();
    return b.width > 0 && b.height > 0 ? b : null;
  } catch {
    return null;
  }
}

function union(boxes: (Box | null)[]): Box | null {
  const list = boxes.filter((b): b is Box => !!b);
  if (!list.length) return null;
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  const right = Math.max(...list.map((b) => b.x + b.width));
  const bottom = Math.max(...list.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Colored band behind the highlighted notes, wrapping their label if any.
 * Inserted at the start of the SVG so it sits below the drawing (SVG paints
 * earlier elements first).
 */
function drawBands(o: DrawOptions, notes: StemmableNote[], labelCategory: string) {
  const svg = document.getElementById(o.elementId)?.querySelector("svg");
  if (!svg) return;
  for (const n of notes) {
    // the label draws outside the note's group, so its box is merged in by hand
    const box = union([n, ...n.getModifiersByType(labelCategory)].map(boxOf));
    if (!box) continue;
    const pad = 5;
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(box.x - pad));
    rect.setAttribute("y", String(box.y - pad));
    rect.setAttribute("width", String(box.width + pad * 2));
    rect.setAttribute("height", String(box.height + pad * 2));
    rect.setAttribute("rx", "5");
    rect.setAttribute("fill", o.highlightColor);
    rect.setAttribute("opacity", "0.16");
    svg.insertBefore(rect, svg.firstChild);
  }
}
