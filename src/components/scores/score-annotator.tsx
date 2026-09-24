"use client";

import { useEffect, useRef } from "react";
import type { Stroke } from "@/lib/scores-db";

export type Tool = "pen" | "liner" | "highlighter" | "eraser" | "finger";

/** Dedos que se pueden escribir como digitación. */
export const FINGERS = ["1", "2", "3", "4", "5"] as const;
export type Finger = (typeof FINGERS)[number];
/**
 * Tamaños del número de digitación, relativos al ancho de la página. El medio
 * es el de una edición impresa: la cifra mide más o menos un espacio de pentagrama.
 */
export const FINGER_SIZES = [
  { id: "small", value: 0.012, label: "Pequeño" },
  { id: "medium", value: 0.016, label: "Medio" },
  { id: "large", value: 0.021, label: "Grande" },
];
export const DEFAULT_FINGER_SIZE = FINGER_SIZES[1].value;

export const PEN_COLORS = [
  { id: "ink", value: "#111114", label: "Negro" },
  { id: "red", value: "#d9534f", label: "Rojo" },
  { id: "blue", value: "#3b6fd6", label: "Azul" },
  { id: "green", value: "#2f9d68", label: "Verde" },
];

/**
 * Colores del subrayador. Se pintan al 35 % sobre la página, así que son tonos
 * saturados: apagados quedarían en nada encima del blanco del papel.
 */
export const HIGHLIGHTER_COLORS = [
  { id: "yellow", value: "#ffd83d", label: "Amarillo" },
  { id: "green", value: "#4ade80", label: "Verde" },
  { id: "pink", value: "#ff6fae", label: "Rosa" },
  { id: "blue", value: "#4cb8ff", label: "Azul" },
  { id: "orange", value: "#ff9542", label: "Naranja" },
];
export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHTER_COLORS[0].value;

/** Grosores del lápiz, relativos al ancho de la página (igual que `Stroke.width`). */
export const PEN_WIDTHS = [
  { id: "fine", value: 0.0025, label: "Fino" },
  { id: "medium", value: 0.004, label: "Medio" },
  { id: "thick", value: 0.007, label: "Grueso" },
];
export const DEFAULT_PEN_WIDTH = PEN_WIDTHS[1].value;

/**
 * Grosores del delineador: por debajo de lo que da el lápiz, para escribir
 * encima del pentagrama sin comerse las líneas. El medio deja poco más de un
 * píxel en una página a tamaño completo, como un rotulador calibrado de 0,3.
 */
export const LINER_WIDTHS = [
  { id: "fine", value: 0.0009, label: "Fino" },
  { id: "medium", value: 0.0014, label: "Medio" },
  { id: "thick", value: 0.0021, label: "Grueso" },
];
export const DEFAULT_LINER_WIDTH = LINER_WIDTHS[1].value;

interface Props {
  width: number;
  height: number;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  /** null = solo se muestran los trazos y el puntero pasa a la página */
  tool: Tool | null;
  color: string;
  /** Color del subrayador; va aparte del lápiz para que cada uno recuerde el suyo. */
  highlightColor?: string;
  /** Grosor del lápiz relativo al ancho de la página; el subrayador tiene el suyo fijo. */
  penWidth?: number;
  /** Grosor del delineador, con su propio juego de medidas más finas. */
  linerWidth?: number;
  /** Dedo que escribe la herramienta de digitación. */
  finger?: Finger;
  /** Tamaño del número, relativo al ancho de la página. */
  fingerSize?: number;
}

/**
 * Lienzo transparente sobre una página. Los trazos se guardan en coordenadas
 * relativas (0–1) para que sirvan a cualquier zoom, y se dibujan escalados.
 */
export function ScoreAnnotator({
  width,
  height,
  strokes,
  onChange,
  tool,
  color,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  penWidth = DEFAULT_PEN_WIDTH,
  linerWidth = DEFAULT_LINER_WIDTH,
  finger = "1",
  fingerSize = DEFAULT_FINGER_SIZE,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  /** Dedos (o punteros) apoyados ahora mismo: más de uno es un pellizco, no un trazo. */
  const down = useRef(new Set<number>());

  /** Una digitación centrada justo donde se apunta. */
  const labelAt = (p: [number, number]): Stroke => ({ color, width: fingerSize, label: finger, points: [p] });

  const paint = (extra?: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of [...strokes, ...(extra ? [extra] : [])]) {
      if (s.points.length === 0) continue;
      if (s.label) {
        // el número va centrado en su punto, con un halo blanco para leerse sobre las líneas del pentagrama
        const [x, y] = s.points[0];
        const size = s.width * width;
        ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 1;
        ctx.lineWidth = size * 0.18;
        ctx.strokeStyle = "#fff";
        ctx.strokeText(s.label, x * width, y * height);
        ctx.fillStyle = s.color;
        ctx.fillText(s.label, x * width, y * height);
        continue;
      }
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.highlighter ? 0.35 : 1;
      ctx.lineWidth = s.width * width;
      ctx.beginPath();
      const [x0, y0] = s.points[0];
      ctx.moveTo(x0 * width, y0 * height);
      if (s.points.length === 1) ctx.lineTo(x0 * width + 0.01, y0 * height);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * width, y * height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, strokes]);

  // Un dedo del pellizco puede levantarse fuera del lienzo y su `pointerup` no
  // llegaría aquí: sin esto se quedaría apuntado para siempre y ya no se podría
  // volver a escribir. En la ventana llega siempre, venga de donde venga.
  useEffect(() => {
    const release = (e: PointerEvent) => down.current.delete(e.pointerId);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const toPoint = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const erase = (p: [number, number]) => {
    const radius = 0.015;
    const keep = strokes.filter(
      (s) =>
        !s.points.some(([x, y]) => Math.hypot((x - p[0]) * (width / height), y - p[1]) < radius * (width / height) + s.width),
    );
    if (keep.length !== strokes.length) onChange(keep);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!tool) return;
    down.current.add(e.pointerId);
    // Un segundo dedo no es otro trazo: es un pellizco para hacer zoom. Lo que
    // el primero llevaba escrito se tira —era el arranque del gesto, no una
    // marca— y no se escribe nada más hasta que se levanten los dos.
    if (down.current.size > 1) {
      if (drawing.current) {
        drawing.current = null;
        paint();
      }
      return;
    }
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toPoint(e);
    if (tool === "eraser") {
      erase(p);
      return;
    }
    if (tool === "finger") {
      drawing.current = labelAt(p);
      paint(drawing.current);
      return;
    }
    drawing.current = {
      color: tool === "highlighter" ? highlightColor : color,
      width: tool === "highlighter" ? 0.02 : tool === "liner" ? linerWidth : penWidth,
      highlighter: tool === "highlighter",
      points: [p],
    };
    paint(drawing.current);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!tool || down.current.size > 1) return;
    if (tool === "eraser") {
      if (e.buttons) erase(toPoint(e));
      return;
    }
    if (!drawing.current) return;
    if (tool === "finger") {
      // se puede arrastrar para afinar dónde queda antes de soltar
      drawing.current = labelAt(toPoint(e));
    } else {
      drawing.current.points.push(toPoint(e));
    }
    paint(drawing.current);
  };

  const onUp = (e: React.PointerEvent) => {
    down.current.delete(e.pointerId);
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    onChange([...strokes, s]);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, touchAction: tool ? "none" : "auto", pointerEvents: tool ? "auto" : "none" }}
      className={`absolute inset-0 ${tool === "eraser" ? "cursor-cell" : tool ? "cursor-crosshair" : ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden
    />
  );
}
