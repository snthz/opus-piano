"use client";

import { useEffect, useRef } from "react";
import type { Stroke } from "@/lib/scores-db";

export type Tool = "pen" | "highlighter" | "eraser" | "finger";

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
export const HIGHLIGHTER_COLOR = "#ffd83d";

/** Grosores del lápiz, relativos al ancho de la página (igual que `Stroke.width`). */
export const PEN_WIDTHS = [
  { id: "fine", value: 0.0025, label: "Fino" },
  { id: "medium", value: 0.004, label: "Medio" },
  { id: "thick", value: 0.007, label: "Grueso" },
];
export const DEFAULT_PEN_WIDTH = PEN_WIDTHS[1].value;

interface Props {
  width: number;
  height: number;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  /** null = solo se muestran los trazos y el puntero pasa a la página */
  tool: Tool | null;
  color: string;
  /** Grosor del lápiz relativo al ancho de la página; el subrayador tiene el suyo fijo. */
  penWidth?: number;
  /** Dedo que escribe la herramienta de digitación. */
  finger?: Finger;
  /** Tamaño del número, relativo al ancho de la página. */
  fingerSize?: number;
}

/**
 * Lienzo transparente sobre una página. Los trazos se guardan en coordenadas
 * relativas (0–1) para que sirvan a cualquier zoom, y se dibujan escalados.
 */
export function ScoreAnnotator({ width, height, strokes, onChange, tool, color, penWidth = DEFAULT_PEN_WIDTH, finger = "1", fingerSize = DEFAULT_FINGER_SIZE }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);

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
      color: tool === "highlighter" ? HIGHLIGHTER_COLOR : color,
      width: tool === "highlighter" ? 0.02 : penWidth,
      highlighter: tool === "highlighter",
      points: [p],
    };
    paint(drawing.current);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!tool) return;
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

  const onUp = () => {
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
