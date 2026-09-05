"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseMusicXml, unpackMxl } from "@/lib/music/musicxml";
import { analyzePdf, buildMeasureMap, locate, type MeasureMap } from "@/lib/score-layout";
import {
  updateScoreAnnotations,
  updateScoreLinkedXml,
  updateScoreName,
  updateScoreNotes,
  type Annotations,
  type ScoreRecord,
  type Stroke,
} from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { PdfPage } from "./pdf-page";
import { PEN_COLORS, type Tool } from "./score-annotator";
import { ScoreSheet } from "./score-sheet";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
  onRename: (name: string) => void;
}

const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4 9.7 7a13 13 0 0 1-2.5 3.6M6.3 6.3C4.2 7.7 2.9 9.6 2.3 12c1.2 3 4.7 7 9.7 7 1.6 0 3-.4 4.3-1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Eye = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
    <path d="M2.3 12C3.5 9 7 5 12 5s8.5 4 9.7 7c-1.2 3-4.7 7-9.7 7s-8.5-4-9.7-7z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Alto que ocupan las barras flotantes, para que la página quepa entre ellas
 *  dejando un respiro visible entre el menú y la partitura. */
const TOP_BAR = 88;
const BOTTOM_BAR = 128;
const MAX_ZOOM = 4;

type Pair = ArrayLike<{ clientX: number; clientY: number }>;
const touchMid = (t: Pair) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
const touchGap = (t: Pair) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Referencia de un zoom: el punto (u, v) de la página (fracciones de su ancho y
 * alto) que hay bajo el punto (fx, fy) del contenedor, el tamaño de la página al
 * 100 % y dónde está su esquina en el contenido desplazable.
 */
interface Anchor {
  u: number;
  v: number;
  fx: number;
  fy: number;
  baseW: number;
  baseH: number;
  px: number;
  py: number;
}

/** Transform que se ve en pantalla mientras se pellizca o se anima. */
interface Live {
  k: number;
  tx: number;
  ty: number;
}

const setLive = (pg: HTMLElement, l: Live) => {
  pg.style.transformOrigin = "0 0";
  pg.style.willChange = "transform";
  pg.style.zIndex = "1";
  pg.style.transform = `translate(${l.tx}px, ${l.ty}px) scale(${l.k})`;
};
const clearLive = (pg: HTMLElement) => {
  pg.style.transform = "";
  pg.style.transition = "";
  pg.style.willChange = "";
  pg.style.zIndex = "";
};
const sameLive = (a: Live, b: Live) => Math.abs(a.k - b.k) < 0.002 && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5;

/**
 * Lector a pantalla completa. Al 100 % cada página llena la pantalla y se pasa
 * de página deslizando (o con flechas); al ampliar, la página se desplaza
 * libremente. Con un MusicXML vinculado, una guía sigue el sonido sobre el PDF.
 */
export function PdfReader({ record, onClose, onDelete, onNotesChange, onRename }: Props) {
  const { settings } = useSettings();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [annotations, setAnnotations] = useState<Annotations>(record.annotations ?? {});
  const [chrome, setChrome] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(record.notes);
  const [name, setName] = useState(record.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedXml, setLinkedXml] = useState<Blob | undefined>(record.linkedXml);
  const [askXml, setAskXml] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [view, setView] = useState<"pdf" | "xml">("pdf");
  const [showNames, setShowNames] = useState(true);
  const [guideOn, setGuideOn] = useState(true);
  const [layout, setLayout] = useState<{ of: unknown; map: MeasureMap } | null>(null);
  const [cursor, setCursor] = useState<{ measure: number; frac: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [pinching, setPinching] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const zoomRef = useRef(zoom);
  const viewRef = useRef(view);
  const chromeRef = useRef(chrome);
  const gesture = useRef<
    | ({ kind: "pinch"; el: HTMLElement; gap: number; zoom: number; ratio: number } & Anchor & Live)
    | { kind: "pan"; x: number; y: number; left: number; top: number }
    | null
  >(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  /** Página con un transform que hay que limpiar al fijar la escala real */
  const live = useRef<HTMLElement | null>(null);
  /** Animación de asentamiento en curso (se puede acabar de golpe) */
  const settling = useRef<(() => void) | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xmlInput = useRef<HTMLInputElement>(null);

  const { parsed, error: xmlError } = useParsedXml(linkedXml);
  const player = useScorePlayer(parsed);
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
    pageRef.current = page;
    zoomRef.current = zoom;
    viewRef.current = view;
    chromeRef.current = chrome;
  });

  const map = layout && layout.of === parsed ? layout.map : null;
  const pager = zoom === 1;

  /* ---------- Tamaño del área y navegación ---------- */

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const goTo = (p: number) => {
    const target = Math.min(record.pageCount, Math.max(1, p));
    setPage(target);
    if (zoomRef.current === 1) areaRef.current?.scrollTo({ left: (target - 1) * area.w, behavior: "smooth" });
  };

  // Al deslizar, la página es la celda que ha quedado centrada.
  const onPagerScroll = () => {
    const el = areaRef.current;
    if (!el || !area.w || zoomRef.current !== 1) return;
    const p = Math.round(el.scrollLeft / area.w) + 1;
    if (p !== pageRef.current && p >= 1 && p <= record.pageCount) setPage(p);
  };

  // Al volver al modo de deslizamiento, el carrusel debe estar en la página actual.
  useEffect(() => {
    if (pager && areaRef.current && area.w) areaRef.current.scrollLeft = (page - 1) * area.w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager, area.w, view]);

  /* ---------- Zoom con los dedos ---------- */

  // Mientras dura el pellizco la página solo se escala con un transform CSS (lo
  // compone la GPU, sin re-render ni retrazado). Al soltar se fija la escala real
  // y el desplazamiento en el mismo fotograma en que se quita el transform, para
  // que la partitura no salte ni tiemble.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (el && pending.current) {
      el.scrollLeft = pending.current.x;
      el.scrollTop = pending.current.y;
    }
    pending.current = null;
    if (live.current) clearLive(live.current);
    live.current = null;
  });

  const pageEl = (el: HTMLElement) => el.querySelector<HTMLElement>(`[data-page="${pageRef.current}"]`);

  /** Referencia de la página bajo el punto (fx, fy) del contenedor. */
  const anchorAt = (el: HTMLElement, pg: HTMLElement, fx: number, fy: number): Anchor => {
    const r = el.getBoundingClientRect();
    const p = pg.getBoundingClientRect();
    const z = zoomRef.current;
    return {
      u: (fx + r.left - p.left) / p.width,
      v: (fy + r.top - p.top) / p.height,
      fx,
      fy,
      baseW: p.width / z,
      baseH: p.height / z,
      px: p.left - r.left + el.scrollLeft,
      py: p.top - r.top + el.scrollTop,
    };
  };

  /**
   * Con la escala z y la referencia a: desplazamiento que hay que fijar y esquina
   * de la página respecto al contenedor una vez fijado. Al 100 % la página va
   * centrada en su celda del carrusel; ampliada, en el contenedor con márgenes.
   */
  const target = (el: HTMLElement, z: number, a: Anchor) => {
    const w = a.baseW * z;
    const h = a.baseH * z;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const chrome = chromeRef.current;
    if (z === 1) {
      const top = chrome ? TOP_BAR : 8;
      const bottom = chrome ? BOTTOM_BAR : 8;
      return { sx: (pageRef.current - 1) * cw, sy: 0, left: (cw - w) / 2, top: top + (ch - top - bottom - h) / 2 };
    }
    const top = chrome ? TOP_BAR : 12;
    const bottom = chrome ? BOTTOM_BAR : 12;
    const x = Math.max(0, (cw - w - 24) / 2) + 12;
    const sx = clamp(x + a.u * w - a.fx, 0, Math.max(0, w + 24 - cw));
    const sy = clamp(top + a.v * h - a.fy, 0, Math.max(0, top + h + bottom - ch));
    return { sx, sy, left: x - sx, top: top - sy };
  };

  /**
   * Lleva la página a la escala z dejando la referencia bajo el dedo. Si lo que
   * se ve (cur) no coincide con la posición final, primero se anima el transform
   * hasta ella y solo entonces se fija la escala real: así el cambio de
   * disposición pasa desapercibido.
   */
  const settle = (el: HTMLElement, pg: HTMLElement, a: Anchor, to: number, cur: Live, animate: boolean) => {
    const z = +clamp(to, 1, MAX_ZOOM).toFixed(3);
    const from = zoomRef.current;
    const t = target(el, z, a);
    const next: Live = { k: z / from, tx: t.left - (a.px - el.scrollLeft), ty: t.top - (a.py - el.scrollTop) };
    const commit = () => {
      settling.current = null;
      if (z !== from) {
        zoomRef.current = z;
        pending.current = { x: t.sx, y: t.sy };
        live.current = pg;
        setZoom(z);
      } else {
        el.scrollLeft = t.sx;
        el.scrollTop = t.sy;
        clearLive(pg);
      }
    };
    if (!animate || sameLive(cur, next)) {
      commit();
      return;
    }
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pg.removeEventListener("transitionend", end);
      commit();
    };
    const timer = setTimeout(end, 280);
    pg.addEventListener("transitionend", end);
    pg.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    setLive(pg, next);
    settling.current = end;
  };

  /** Zoom con los botones: se anima alrededor del centro de la pantalla. */
  const zoomTo = (z: number) => {
    const el = areaRef.current;
    const pg = el && pageEl(el);
    if (!el || !pg || settling.current || gesture.current) return;
    settle(el, pg, anchorAt(el, pg, el.clientWidth / 2, el.clientHeight / 2), z, { k: 1, tx: 0, ty: 0 }, true);
  };

  // Al ampliar, el contenedor deja de desplazarse solo (touch-action: none) y el
  // arrastre de un dedo se traduce aquí; con dos dedos se pellizca para ampliar.
  const onTouchStart = (e: React.TouchEvent) => {
    const el = areaRef.current;
    if (!el || settling.current) return;
    if (gesture.current?.kind === "pinch") return;
    if (e.touches.length === 2) {
      const pg = pageEl(el);
      if (!pg) return;
      const r = el.getBoundingClientRect();
      const m = touchMid(e.touches);
      gesture.current = {
        kind: "pinch",
        el: pg,
        gap: touchGap(e.touches),
        zoom: zoomRef.current,
        ratio: 1,
        k: 1,
        tx: 0,
        ty: 0,
        ...anchorAt(el, pg, m.x - r.left, m.y - r.top),
      };
      setPinching(true);
    } else if (e.touches.length === 1 && zoomRef.current > 1 && !tool) {
      gesture.current = { kind: "pan", x: e.touches[0].clientX, y: e.touches[0].clientY, left: el.scrollLeft, top: el.scrollTop };
    } else {
      gesture.current = null;
    }
  };

  // Los oyentes van en window para que el gesto siga vivo aunque el dedo salga
  // del contenedor.
  useEffect(() => {
    const finishPinch = (g: NonNullable<typeof gesture.current> & { kind: "pinch" }) => {
      gesture.current = null;
      setPinching(false);
      const el = areaRef.current;
      if (!el) return clearLive(g.el);
      settle(el, g.el, g, g.zoom * g.ratio, g, true);
    };
    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      const el = areaRef.current;
      if (!g || !el) return;
      if (g.kind === "pan") {
        e.preventDefault();
        el.scrollLeft = g.left - (e.touches[0].clientX - g.x);
        el.scrollTop = g.top - (e.touches[0].clientY - g.y);
        return;
      }
      if (e.touches.length < 2) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const m = touchMid(e.touches);
      g.fx = m.x - r.left;
      g.fy = m.y - r.top;
      g.ratio = touchGap(e.touches) / g.gap;
      const raw = g.zoom * g.ratio;
      // Fuera del rango la escala cede solo un poco, como una goma, y al soltar vuelve.
      const z = raw < 1 ? 1 - (1 - raw) * 0.3 : raw > MAX_ZOOM ? MAX_ZOOM + (raw - MAX_ZOOM) * 0.3 : raw;
      g.k = z / g.zoom;
      g.tx = g.fx - (g.px - el.scrollLeft) - g.u * g.baseW * z;
      g.ty = g.fy - (g.py - el.scrollTop) - g.v * g.baseH * z;
      setLive(g.el, g);
    };
    const onEnd = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "pinch") {
        if (e.touches.length < 2) finishPinch(g);
      } else if (e.touches.length === 0) {
        gesture.current = null;
      }
    };
    // En el trackpad y con Ctrl + rueda se amplía igual que con los dedos.
    const onWheel = (e: WheelEvent) => {
      const el = areaRef.current;
      if (!el || viewRef.current !== "pdf" || !(e.ctrlKey || e.metaKey) || !el.contains(e.target as Node)) return;
      e.preventDefault();
      const pg = pageEl(el);
      if (!pg || settling.current || gesture.current) return;
      const r = el.getBoundingClientRect();
      const a = anchorAt(el, pg, e.clientX - r.left, e.clientY - r.top);
      settle(el, pg, a, zoomRef.current * Math.exp(-e.deltaY / 240), { k: 1, tx: 0, ty: 0 }, false);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (view !== "pdf" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") goTo(pageRef.current + 1);
      if (e.key === "ArrowLeft") goTo(pageRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, view, area.w]);

  /* ---------- Guía de reproducción ---------- */

  // Con MusicXML vinculado se analizan las páginas una vez para situar los compases.
  useEffect(() => {
    if (!parsed || !guideOn || (layout && layout.of === parsed)) return;
    let cancelled = false;
    analyzePdf(record.file, record.pageCount, parsed.clefs.length)
      .then((layouts) => !cancelled && setLayout({ of: parsed, map: buildMeasureMap(layouts, parsed) }))
      .catch(() => !cancelled && setLayout({ of: parsed, map: { boxes: [], starts: [], lengths: [], approximate: true } }));
    return () => {
      cancelled = true;
    };
  }, [parsed, guideOn, layout, record.file, record.pageCount]);

  // Mientras suena, la guía sigue el reloj de audio y pasa de página sola.
  // Con requestAnimationFrame en vez de un intervalo fijo, queda al mismo ritmo
  // que el resaltado de notas y no se nota un desfase entre el sonido y la guía.
  useEffect(() => {
    if (!player.playing || !map || !guideOn) return;
    let raf = 0;
    const tick = () => {
      const pos = playerRef.current.position();
      const loc = pos === null ? null : locate(map, pos);
      setCursor(loc);
      if (loc) {
        const target = map.boxes[loc.measure].page;
        if (target !== pageRef.current) goTo(target);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setCursor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.playing, map, guideOn]);

  /* ---------- Persistencia ---------- */

  const strokesOf = (p: number) => annotations[p] ?? [];
  const setStrokes = (p: number, next: Stroke[]) => {
    const all = { ...annotations, [p]: next };
    setAnnotations(all);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreAnnotations(record.id, all), 600);
  };

  const saveNotes = (v: string) => {
    setNotes(v);
    onNotesChange(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreNotes(record.id, v), 800);
  };

  const commitName = () => {
    const clean = name.trim() || record.name;
    setName(clean);
    if (clean !== record.name) {
      onRename(clean);
      void updateScoreName(record.id, clean);
    }
  };

  const applyXml = async (xml: string) => {
    parseMusicXml(xml); // valida antes de guardar
    const blob = new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
    await updateScoreLinkedXml(record.id, blob);
    setLinkedXml(blob);
    setIssue(null);
    setAskXml(false);
  };

  const linkXml = async (file: File) => {
    try {
      await applyXml(/\.mxl$/i.test(file.name) ? unpackMxl(new Uint8Array(await file.arrayBuffer())) : await file.text());
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const unlinkXml = async () => {
    player.stop();
    await updateScoreLinkedXml(record.id, undefined);
    setLinkedXml(undefined);
    setView("pdf");
  };

  const onPlay = () => {
    if (!linkedXml) {
      setAskXml(true);
      return;
    }
    void player.toggle();
  };

  /* ---------- Vista ---------- */

  const circle = "btn-circle w-10 h-10 shadow-md";
  const toolButton = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool((cur) => (cur === t ? null : t))}
      aria-pressed={tool === t}
      className={`pill text-xs py-1.5 ${tool === t ? "pill-active" : ""}`}
    >
      {label}
    </button>
  );

  const fit = { w: Math.max(0, area.w - 16), h: Math.max(0, area.h - (chrome ? TOP_BAR + BOTTOM_BAR : 16)) };
  const guideFor = (p: number) =>
    cursor && map && map.boxes[cursor.measure]?.page === p ? { box: map.boxes[cursor.measure], frac: cursor.frac } : null;

  const statusLine =
    parsed && guideOn && !map
      ? "Buscando los compases en la página…"
      : map?.approximate && guideOn && view === "pdf"
        ? "Guía aproximada: no se pudieron contar bien las barras de compás."
        : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-surface-2 flex flex-col"
      role="dialog"
      aria-label={name}
      style={{ "--safe-t": "env(safe-area-inset-top, 0px)", "--safe-b": "env(safe-area-inset-bottom, 0px)" } as React.CSSProperties}
    >
      {/* ---- Contenido ---- */}
      {view === "pdf" ? (
        // Un solo contenedor para el carrusel y la vista ampliada: la página
        // actual conserva su nodo (y su lienzo) al cambiar de escala.
        <div
          ref={areaRef}
          onScroll={onPagerScroll}
          onTouchStart={onTouchStart}
          className={pager ? "flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none]" : "flex-1 overflow-auto"}
          style={{ touchAction: pager && !tool && !pinching ? "pan-x" : "none" }}
        >
          {Array.from({ length: record.pageCount }, (_, i) => i + 1).map((p) =>
            pager || p === page ? (
              <div
                key={p}
                className={pager ? "snap-center shrink-0 h-full flex items-center justify-center" : "w-fit mx-auto p-3"}
                style={
                  pager
                    ? { width: area.w, paddingTop: chrome ? TOP_BAR : 8, paddingBottom: chrome ? BOTTOM_BAR : 8 }
                    : { paddingTop: chrome ? TOP_BAR : 12, paddingBottom: chrome ? BOTTOM_BAR : 12 }
                }
              >
                {Math.abs(p - page) <= 1 && area.w > 0 ? (
                  <PdfPage
                    file={record.file}
                    page={p}
                    fit={fit}
                    zoom={zoom}
                    strokes={strokesOf(p)}
                    onStrokes={(s) => setStrokes(p, s)}
                    tool={tool}
                    color={color}
                    guide={guideFor(p)}
                  />
                ) : null}
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div ref={areaRef} className={`flex-1 overflow-auto px-3 ${chrome ? "pt-24 pb-36" : "py-3"}`}>
          <div className="max-w-4xl mx-auto">
            {xmlError && <p className="text-sm text-bad">{xmlError}</p>}
            {parsed ? <ScoreSheet parsed={parsed} active={player.active} showNames={showNames} /> : <p className="text-sm text-ink-2">Leyendo…</p>}
          </div>
        </div>
      )}

      {!chrome && (
        <button
          type="button"
          onClick={() => setChrome(true)}
          className={`${circle} fixed right-3`}
          style={{ top: "calc(0.75rem + var(--safe-t))" }}
          aria-label="Mostrar controles"
        >
          {Eye}
        </button>
      )}

      {chrome && (
        <>
          {/* ---- Barra superior: un único menú centrado, no una franja completa ---- */}
          <div className="fixed inset-x-3 flex justify-center pointer-events-none" style={{ top: "calc(0.75rem + var(--safe-t))" }}>
            <div className="pointer-events-auto card shadow-md flex items-center gap-1 p-1.5 w-full max-w-sm">
              <button type="button" onClick={onClose} className="btn-circle w-9 h-9 shrink-0" aria-label="Volver">
                <ChevronIcon dir="left" className="w-4 h-4" />
              </button>
              <div className="min-w-0 flex-1 px-1.5">
                <p className="font-semibold text-sm truncate">{name}</p>
                <p className="text-[11px] text-ink-2 truncate">
                  {view === "pdf" ? `Página ${page} de ${record.pageCount}` : "Partitura MusicXML vinculada"}
                  {linkedXml && parsed && view === "pdf" ? " · se puede escuchar" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className={`btn-circle w-9 h-9 shrink-0 ${notesOpen ? "" : "!bg-surface !text-ink"}`}
                aria-label="Notas y opciones"
              >
                <span className="text-sm leading-none">✎</span>
              </button>
              <button type="button" onClick={() => { setChrome(false); setNotesOpen(false); }} className="btn-circle w-9 h-9 shrink-0 !bg-surface !text-ink" aria-label="Ocultar controles">
                {EyeOff}
              </button>
            </div>
          </div>

          {/* ---- Panel de notas y opciones ---- */}
          {notesOpen && (
            <div
              className="fixed inset-x-3 card p-3 shadow-md space-y-3 max-w-sm mx-auto"
              style={{ top: "calc(4.25rem + var(--safe-t))" }}
            >
              <label className="block">
                <span className="text-xs text-ink-2">Nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="mt-0.5 w-full rounded-2xl px-3 py-2 text-sm font-semibold bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
              <textarea
                value={notes}
                onChange={(e) => saveNotes(e.target.value)}
                placeholder="Notas personales sobre esta partitura…"
                rows={3}
                className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {linkedXml ? (
                  <button type="button" onClick={() => void unlinkXml()} className="pill py-1">Quitar MusicXML vinculado</button>
                ) : (
                  <button type="button" onClick={() => { setAskXml(true); setNotesOpen(false); }} className="pill py-1">Vincular MusicXML</button>
                )}
                <span className="ml-auto">
                  {!confirmDelete ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="text-bad hover:underline">Eliminar partitura</button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-bad font-semibold">¿Seguro?</span>
                      <button type="button" onClick={onDelete} className="text-bad underline">Sí</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 underline">No</button>
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* ---- Estado ---- */}
          {statusLine && (
            <div className="fixed inset-x-3 flex justify-center pointer-events-none" style={{ bottom: "calc(8.5rem + var(--safe-b))" }}>
              <p className="card px-3 py-1.5 text-[11px] text-ink-2 shadow-md max-w-md text-center">{statusLine}</p>
            </div>
          )}

          {/* ---- Barra inferior ---- */}
          <div className="fixed inset-x-3 flex justify-center pointer-events-none" style={{ bottom: "calc(0.75rem + var(--safe-b))" }}>
            <div className="pointer-events-auto card shadow-md p-2 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
              {view === "pdf" && (
                <>
                  <button type="button" onClick={() => goTo(page - 1)} disabled={page === 1} className="btn-circle w-9 h-9 disabled:opacity-40" aria-label="Página anterior">
                    <ChevronIcon dir="left" className="w-4 h-4" />
                  </button>
                  <span className="text-xs tabular-nums px-1">{page}/{record.pageCount}</span>
                  <button type="button" onClick={() => goTo(page + 1)} disabled={page === record.pageCount} className="btn-circle w-9 h-9 disabled:opacity-40" aria-label="Página siguiente">
                    <ChevronIcon dir="right" className="w-4 h-4" />
                  </button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                  <button type="button" onClick={() => zoomTo(zoom - 0.25)} disabled={zoom === 1} className="btn-circle w-9 h-9 text-sm disabled:opacity-40" aria-label="Reducir">−</button>
                  <button type="button" onClick={() => zoomTo(1)} className="text-xs tabular-nums w-10 text-center" title="Página entera">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => zoomTo(zoom + 0.25)} className="btn-circle w-9 h-9 text-sm" aria-label="Ampliar">+</button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                  {toolButton("pen", "✎")}
                  {toolButton("highlighter", "Sub.")}
                  {toolButton("eraser", "Borr.")}
                  {tool === "pen" &&
                    PEN_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.value)}
                        aria-label={c.label}
                        aria-pressed={color === c.value}
                        className={`w-6 h-6 rounded-full border-2 ${color === c.value ? "border-accent scale-110" : "border-transparent"}`}
                        style={{ background: c.value }}
                      />
                    ))}
                  <button type="button" onClick={() => setStrokes(page, strokesOf(page).slice(0, -1))} disabled={!strokesOf(page).length} className="pill text-xs py-1.5 disabled:opacity-40" aria-label="Deshacer">↶</button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                </>
              )}

              <button
                type="button"
                onClick={onPlay}
                disabled={!settings.sound || (!!linkedXml && !parsed)}
                title={settings.sound ? undefined : "El sonido está desactivado en Ajustes"}
                className={`pill text-xs py-1.5 ${player.playing ? "pill-active" : "bg-accent text-white"} disabled:opacity-50`}
              >
                {player.playing ? "■ Detener" : "▶ Escuchar"}
              </button>
              {linkedXml && (
                <>
                  {view === "pdf" && (
                    <button type="button" onClick={() => setGuideOn((v) => !v)} aria-pressed={guideOn} className={`pill text-xs py-1.5 ${guideOn ? "pill-active" : ""}`}>
                      Guía
                    </button>
                  )}
                  <button type="button" onClick={() => setView((v) => (v === "pdf" ? "xml" : "pdf"))} className="pill text-xs py-1.5">
                    {view === "pdf" ? "Ver con nombres" : "Ver PDF"}
                  </button>
                  {view === "xml" && (
                    <button type="button" onClick={() => setShowNames((v) => !v)} className={`pill text-xs py-1.5 ${showNames ? "pill-active" : ""}`}>
                      Nombres
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-2 px-1">
                    ♩={player.tempo}
                    <input type="range" min={40} max={200} value={player.tempo} onChange={(e) => player.setTempo(Number(e.target.value))} disabled={player.playing} className="accent-(--accent) w-20" aria-label="Tempo" />
                  </label>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- Cómo conseguir la reproducción ---- */}
      {askXml && (
        <div className="fixed inset-0 z-10 bg-ink/40 flex items-end sm:items-center justify-center p-3" onClick={() => setAskXml(false)}>
          <div className="card p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">Escuchar esta partitura</h2>
            <p className="text-sm text-ink-2">
              Un PDF es solo una imagen. Para tocar la pieza, mostrarte los nombres y seguir el sonido con una guía,
              Opus Piano necesita el <strong>MusicXML</strong> de esa misma partitura.
            </p>
            <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
              <p className="text-sm font-semibold">Vincular un MusicXML</p>
              <p className="text-xs text-ink-2">
                En MuseScore: «Archivo → Exportar → MusicXML». En musescore.com y otras webs suele haber descarga .mxl.
              </p>
              <input
                ref={xmlInput}
                type="file"
                accept=".musicxml,.mxl,.xml"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void linkXml(e.target.files[0])}
              />
              <button type="button" onClick={() => xmlInput.current?.click()} className="pill pill-active text-xs py-1.5">
                Elegir archivo
              </button>
            </div>
            {issue && <p className="text-xs text-bad">{issue}</p>}
            <div className="flex justify-end">
              <button type="button" onClick={() => setAskXml(false)} className="pill text-xs py-1.5">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
