"use client";

import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { expandRepeats, type ParsedScore } from "@/lib/music/musicxml";

/**
 * Dónde está cada compás en las páginas de un PDF, para que una guía pueda
 * seguir la reproducción del MusicXML vinculado.
 *
 * Se analiza la imagen de cada página: los pentagramas son filas con una línea
 * oscura muy larga, y las barras de compás son columnas oscuras que cruzan el
 * sistema entero (las plicas no llegan a cruzar el hueco entre las dos manos).
 * Con eso se cuentan los compases de cada sistema y se cruzan con los del
 * MusicXML. Si las cuentas no cuadran, los compases se reparten por igual
 * entre los sistemas y la guía es aproximada.
 */

/** Todo en coordenadas relativas (0–1) al tamaño de la página. */
export interface SystemLayout {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Barras de compás interiores (sin las de los extremos) */
  barlines: number[];
}

export interface PageLayout {
  systems: SystemLayout[];
}

export interface MeasureBox {
  /** Página, empezando en 1 */
  page: number;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface MeasureMap {
  /** Una caja por compás impreso */
  boxes: MeasureBox[];
  /** Compás impreso (índice en `boxes`) de cada paso de la reproducción, con las repeticiones desplegadas */
  order: number[];
  /** Inicio de cada paso en negras */
  starts: number[];
  /** Duración de cada paso en negras */
  lengths: number[];
  /** true si el recuento de barras no coincidió con el MusicXML */
  approximate: boolean;
}

const ANALYSIS_WIDTH = 1200;

interface Staff {
  top: number;
  bottom: number;
  left: number;
  right: number;
  spacing: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function analyzeCanvas(canvas: HTMLCanvasElement, stavesPerSystem: number): PageLayout {
  const W = canvas.width;
  const H = canvas.height;
  const data = canvas.getContext("2d")!.getImageData(0, 0, W, H).data;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    dark[i] = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114 < 140 ? 1 : 0;
  }

  // Filas que son línea de pentagrama: una racha oscura continua de al menos un tercio del ancho.
  const isLineRow = new Uint8Array(H);
  for (let y = 0; y < H; y++) {
    let run = 0;
    let best = 0;
    for (let x = 0; x < W; x++) {
      run = dark[y * W + x] ? run + 1 : 0;
      if (run > best) best = run;
    }
    isLineRow[y] = best >= W * 0.33 ? 1 : 0;
  }
  // Filas contiguas → una línea, con su centro.
  const lines: number[] = [];
  for (let y = 0; y < H; y++) {
    if (!isLineRow[y]) continue;
    let y1 = y;
    while (y1 + 1 < H && isLineRow[y1 + 1]) y1++;
    lines.push((y + y1) / 2);
    y = y1;
  }

  // Cinco líneas equidistantes → un pentagrama.
  const staves: Staff[] = [];
  for (let i = 0; i + 4 < lines.length; ) {
    const sp = lines[i + 1] - lines[i];
    const ok =
      sp >= 3 &&
      sp <= H / 25 &&
      [1, 2, 3].every((k) => Math.abs(lines[i + k + 1] - lines[i + k] - sp) <= sp * 0.3);
    if (!ok) {
      i++;
      continue;
    }
    // Extremos horizontales: primera y última columna oscura de cada línea (mediana de las cinco).
    const lefts: number[] = [];
    const rights: number[] = [];
    for (let k = 0; k < 5; k++) {
      const y = Math.round(lines[i + k]);
      let l = 0;
      while (l < W && !dark[y * W + l]) l++;
      let r = W - 1;
      while (r > 0 && !dark[y * W + r]) r--;
      lefts.push(l);
      rights.push(r);
    }
    staves.push({ top: lines[i], bottom: lines[i + 4], left: median(lefts), right: median(rights), spacing: sp });
    i += 5;
  }

  // Pentagramas consecutivos y cercanos → un sistema (dos manos al piano).
  const systems: SystemLayout[] = [];
  for (let i = 0; i < staves.length; ) {
    const group = [staves[i]];
    while (
      group.length < stavesPerSystem &&
      i + group.length < staves.length &&
      staves[i + group.length].top - group[group.length - 1].bottom < 5 * (staves[i].bottom - staves[i].top)
    ) {
      group.push(staves[i + group.length]);
    }
    i += group.length;

    const top = group[0].top;
    const bottom = group[group.length - 1].bottom;
    const left = Math.max(...group.map((s) => s.left));
    const right = Math.min(...group.map((s) => s.right));
    const spacing = group[0].spacing;

    // Barras de compás: columnas oscuras casi de arriba abajo del sistema.
    const y0 = Math.round(top);
    const y1 = Math.round(bottom);
    const span = y1 - y0 + 1;
    const raw: number[] = [];
    for (let x = Math.round(left); x <= Math.round(right); x++) {
      let n = 0;
      for (let y = y0; y <= y1; y++) n += dark[y * W + x];
      if (n >= span * 0.85) raw.push(x);
    }
    // Columnas contiguas → una barra; barras muy juntas (doble barra, repetición) → una.
    const bars: number[] = [];
    for (let k = 0; k < raw.length; k++) {
      let end = k;
      while (end + 1 < raw.length && raw[end + 1] - raw[end] <= 1) end++;
      const x = (raw[k] + raw[end]) / 2;
      if (bars.length && x - bars[bars.length - 1] < spacing * 1.5) bars[bars.length - 1] = (bars[bars.length - 1] + x) / 2;
      else bars.push(x);
      k = end;
    }
    const inner = bars.filter((x) => x - left > spacing * 1.5 && right - x > spacing * 1.5);

    systems.push({
      top: (top - spacing) / H,
      bottom: (bottom + spacing) / H,
      left: left / W,
      right: right / W,
      barlines: inner.map((x) => x / W),
    });
  }

  return { systems };
}

export async function analyzePdf(file: Blob, pageCount: number, stavesPerSystem: number): Promise<PageLayout[]> {
  const out: PageLayout[] = [];
  for (let p = 1; p <= pageCount; p++) {
    const { width } = await getPageSize(file, p);
    const canvas = await renderPage(file, p, ANALYSIS_WIDTH / width);
    out.push(analyzeCanvas(canvas, stavesPerSystem));
  }
  return out;
}

/** Cruza los sistemas detectados con los compases de la partitura. */
export function buildMeasureMap(layouts: PageLayout[], score: ParsedScore): MeasureMap {
  const printed = score.measures.map((m) => Math.max(...m.staves.map((ev) => ev.reduce((s, e) => s + e.beats, 0)), 0));
  // La guía sigue el reloj de reproducción, que toca las repeticiones desplegadas.
  const order = expandRepeats(score.measures);
  const lengths = order.map((mi) => printed[mi]);
  const starts: number[] = [];
  let t = 0;
  for (const l of lengths) {
    starts.push(t);
    t += l;
  }
  const total = score.measures.length;

  const systems = layouts.flatMap((l, pi) => l.systems.map((s) => ({ ...s, page: pi + 1 })));
  const detected = systems.map((s) => s.barlines.length + 1);
  const exact = detected.reduce((a, b) => a + b, 0) === total && systems.length > 0;

  const boxes: MeasureBox[] = [];
  if (exact) {
    for (const s of systems) {
      const edges = [s.left, ...s.barlines, s.right];
      for (let k = 0; k + 1 < edges.length; k++) boxes.push({ page: s.page, x0: edges[k], x1: edges[k + 1], top: s.top, bottom: s.bottom });
    }
  } else if (systems.length) {
    // Reparto proporcional a lo detectado (o por igual si no se vio ninguna barra).
    const weights = detected.some((d) => d > 1) ? detected : systems.map(() => 1);
    const sumW = weights.reduce((a, b) => a + b, 0);
    const counts = weights.map((w) => Math.floor((total * w) / sumW));
    let rest = total - counts.reduce((a, b) => a + b, 0);
    for (let i = 0; rest > 0; i = (i + 1) % counts.length, rest--) counts[i]++;
    systems.forEach((s, i) => {
      const n = counts[i];
      for (let k = 0; k < n; k++) {
        const w = (s.right - s.left) / n;
        boxes.push({ page: s.page, x0: s.left + k * w, x1: s.left + (k + 1) * w, top: s.top, bottom: s.bottom });
      }
    });
  }

  return { boxes, order, starts, lengths, approximate: !exact };
}

/** Compás impreso (índice en `boxes`) y fracción dentro de él para una posición en negras de la reproducción. */
export function locate(map: MeasureMap, beats: number): { measure: number; frac: number } | null {
  if (!map.boxes.length || !map.order.length) return null;
  let step = 0;
  while (step + 1 < map.starts.length && map.starts[step + 1] <= beats) step++;
  const measure = map.order[step];
  if (measure === undefined || measure >= map.boxes.length) return null;
  const len = map.lengths[step] || 1;
  return { measure, frac: Math.min(1, Math.max(0, (beats - map.starts[step]) / len)) };
}
