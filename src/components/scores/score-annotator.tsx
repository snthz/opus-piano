"use client";

import { useEffect, useRef } from "react";
import { MAX_CANVAS_PIXELS } from "@/lib/pdf-thumbnail";
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

/**
 * Un lápiz ha escrito aquí alguna vez. A partir de ahí los dedos dejan de
 * dibujar: en un iPad con Pencil, un dedo sobre la hoja es la mano apoyada, y
 * dibujaba donde se posaba. En un móvil sin lápiz esto nunca se enciende, así
 * que ahí se sigue escribiendo con el dedo. Va fuera del componente porque no
 * es de una página, es de cómo se está usando la app.
 */
let penSeen = false;

/**
 * Densidad a la que se pinta el lienzo: la de la pantalla, salvo que la página
 * sea tan grande —con mucho zoom lo es— que el lienzo se pase del tamaño que
 * iOS dibuja. Pasado ese tamaño sale en blanco y sin dar error, que es por lo
 * que lo escrito con mucho zoom no se veía y reaparecía al alejar. Se topa
 * aquí, igual que hace el PDF de debajo, y CSS estira el resto: con mucho zoom
 * el trazo se ve algo más blando, pero se ve.
 */
const density = (width: number, height: number) => {
  const dpr = window.devicePixelRatio || 1;
  const pixels = width * height * dpr * dpr;
  return pixels > MAX_CANVAS_PIXELS ? dpr * Math.sqrt(MAX_CANVAS_PIXELS / pixels) : dpr;
};

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
  /** Punteros apoyados ahora mismo y de qué son: dedo, lápiz o ratón. */
  const down = useRef(new Map<number, string>());
  /** Lápiz apoyado. Mientras lo haya, los dedos son la mano posada y se ignoran. */
  const penId = useRef<number | null>(null);
  /** Puntero dueño del trazo en curso: solo ese lo alarga y lo cierra. */
  const owner = useRef<number | null>(null);

  /** Una digitación centrada justo donde se apunta. */
  const labelAt = (p: [number, number]): Stroke => ({ color, width: fingerSize, label: finger, points: [p] });

  const paint = (extra?: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const d = density(width, height);
    ctx.setTransform(d, 0, 0, d, 0, 0);
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
      // Curva que pasa por los puntos medios y usa cada muestra como tirador:
      // así la línea se dobla en lugar de quebrarse en cada punto, que es lo
      // que se veía como escalones —sobre todo con el delineador, donde el
      // trazo es tan fino que la esquina de cada segmento canta—.
      const px = (i: number) => s.points[i][0] * width;
      const py = (i: number) => s.points[i][1] * height;
      const last = s.points.length - 1;
      ctx.moveTo(px(0), py(0));
      if (last === 0) ctx.lineTo(px(0) + 0.01, py(0));
      for (let i = 1; i < last; i++) ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
      if (last > 0) ctx.lineTo(px(last), py(last));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const d = density(width, height);
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, strokes]);

  // Un dedo puede levantarse fuera del lienzo y su `pointerup` no llegaría
  // aquí: sin esto se quedaría apuntado para siempre y ya no se podría volver
  // a escribir. En la ventana llega siempre, venga de donde venga.
  useEffect(() => {
    const release = (e: PointerEvent) => {
      down.current.delete(e.pointerId);
      if (penId.current === e.pointerId) penId.current = null;
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const toPoint = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  /**
   * Todos los puntos de un movimiento, no solo el último. Un lápiz muestrea
   * mucho más rápido de lo que el navegador entrega eventos y guarda los de
   * en medio aquí: cogerlos es lo que separa una curva de una línea quebrada.
   */
  const pointsOf = (e: React.PointerEvent): [number, number][] => {
    const native = e.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    return (coalesced.length ? coalesced : [native]).map(toPoint);
  };

  /** Cuántos dedos (o el ratón) hay apoyados; el lápiz va aparte. */
  const fingersDown = () => {
    let n = 0;
    for (const kind of down.current.values()) if (kind !== "pen") n++;
    return n;
  };

  const cancelStroke = () => {
    if (!drawing.current) return;
    drawing.current = null;
    owner.current = null;
    paint();
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
    down.current.set(e.pointerId, e.pointerType);
    if (e.pointerType === "pen") {
      // Manda el lápiz. Si la mano se posó antes y empezó un trazo, era la
      // palma: se tira y escribe el lápiz.
      cancelStroke();
      penId.current = e.pointerId;
      penSeen = true;
    } else {
      // Con un lápiz apoyado —o en cuanto se ha usado uno— un dedo sobre la
      // hoja es la mano descansando: ni escribe ni borra lo que hay.
      if (penId.current !== null || penSeen) return;
      // Sin lápiz de por medio, un segundo dedo no es otro trazo: es un
      // pellizco para hacer zoom, así que lo que el primero llevaba tampoco vale.
      if (fingersDown() > 1) {
        cancelStroke();
        return;
      }
    }
    e.preventDefault();
    // Al arrastrar, Safari intenta seleccionar texto aunque el lienzo no sea
    // seleccionable: la selección salta a lo primero que sí lo es —el título de
    // la barra— y se queda resaltado mientras se escribe. Cortarla al empezar
    // el trazo la quita venga de donde venga.
    window.getSelection()?.removeAllRanges();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    owner.current = e.pointerId;
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
    // solo sigue el puntero que empezó el trazo: la mano posada al lado no cuenta
    if (!tool || e.pointerId !== owner.current) return;
    if (tool === "eraser") {
      if (e.buttons) erase(toPoint(e));
      return;
    }
    if (!drawing.current) return;
    if (tool === "finger") {
      // se puede arrastrar para afinar dónde queda antes de soltar
      drawing.current = labelAt(toPoint(e));
    } else {
      drawing.current.points.push(...pointsOf(e));
    }
    paint(drawing.current);
  };

  const onUp = (e: React.PointerEvent) => {
    down.current.delete(e.pointerId);
    if (penId.current === e.pointerId) penId.current = null;
    // el trazo lo cierra quien lo empezó; levantar la mano no lo termina
    if (e.pointerId !== owner.current) return;
    owner.current = null;
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    onChange([...strokes, s]);
  };

  return (
    <canvas
      ref={canvasRef}
      // sin selección ni menú de iOS: apoyar la mano para escribir no debe
      // seleccionar la página ni sacar el «Copiar» encima de la partitura
      style={{
        width,
        height,
        touchAction: tool ? "none" : "auto",
        pointerEvents: tool ? "auto" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      className={`absolute inset-0 ${tool === "eraser" ? "cursor-cell" : tool ? "cursor-crosshair" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden
    />
  );
}
