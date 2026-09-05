"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { transcribePdf } from "@/lib/ai/openai-omr";
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

/** Alto que ocupan las barras flotantes, para que la página quepa entre ellas. */
const TOP_BAR = 64;
const BOTTOM_BAR = 128;

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
  const [ai, setAi] = useState<{ running: boolean; status: string }>({ running: false, status: "" });
  const [layout, setLayout] = useState<{ of: unknown; map: MeasureMap } | null>(null);
  const [cursor, setCursor] = useState<{ measure: number; frac: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const areaRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xmlInput = useRef<HTMLInputElement>(null);

  const { parsed, error: xmlError } = useParsedXml(linkedXml);
  const player = useScorePlayer(parsed);
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
    pageRef.current = page;
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
    pagerRef.current?.scrollTo({ left: (target - 1) * area.w, behavior: "smooth" });
  };

  // Al deslizar, la página es la celda que ha quedado centrada.
  const onPagerScroll = () => {
    const el = pagerRef.current;
    if (!el || !area.w) return;
    const p = Math.round(el.scrollLeft / area.w) + 1;
    if (p !== pageRef.current && p >= 1 && p <= record.pageCount) setPage(p);
  };

  // Al volver al modo de deslizamiento, el carrusel debe estar en la página actual.
  useEffect(() => {
    if (pager && pagerRef.current && area.w) pagerRef.current.scrollLeft = (page - 1) * area.w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager, area.w, view]);

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
  useEffect(() => {
    if (!player.playing || !map || !guideOn) return;
    const id = window.setInterval(() => {
      const pos = playerRef.current.position();
      const loc = pos === null ? null : locate(map, pos);
      setCursor(loc);
      if (loc) {
        const target = map.boxes[loc.measure].page;
        if (target !== pageRef.current) goTo(target);
      }
    }, 80);
    return () => {
      window.clearInterval(id);
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

  const runAi = async () => {
    if (!settings.openaiKey) return;
    setAi({ running: true, status: "Empezando…" });
    setIssue(null);
    try {
      const xml = await transcribePdf(record.file, {
        apiKey: settings.openaiKey,
        model: settings.openaiModel || "gpt-4o",
        onProgress: (status) => setAi({ running: true, status }),
      });
      await applyXml(xml);
      setAi({ running: false, status: "Transcripción lista. Es un borrador: si algo suena raro, revísala." });
    } catch (e) {
      setAi({ running: false, status: "" });
      setIssue(e instanceof Error ? e.message : "La transcripción falló.");
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
    ai.running || ai.status
      ? ai.status
      : parsed && guideOn && !map
        ? "Buscando los compases en la página…"
        : map?.approximate && guideOn && view === "pdf"
          ? "Guía aproximada: no se pudieron contar bien las barras de compás."
          : null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-2 flex flex-col" role="dialog" aria-label={name}>
      {/* ---- Contenido ---- */}
      {view === "pdf" ? (
        pager ? (
          <div
            ref={(el) => {
              (areaRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              (pagerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            onScroll={onPagerScroll}
            className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none]"
            style={{ touchAction: tool ? "none" : "pan-x" }}
          >
            {Array.from({ length: record.pageCount }, (_, i) => i + 1).map((p) => (
              <div
                key={p}
                className="snap-center shrink-0 h-full flex items-center justify-center"
                style={{ width: area.w, paddingTop: chrome ? TOP_BAR : 8, paddingBottom: chrome ? BOTTOM_BAR : 8 }}
              >
                {Math.abs(p - page) <= 1 && area.w > 0 ? (
                  <PdfPage
                    file={record.file}
                    page={p}
                    fit={fit}
                    zoom={1}
                    strokes={strokesOf(p)}
                    onStrokes={(s) => setStrokes(p, s)}
                    tool={tool}
                    color={color}
                    guide={guideFor(p)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div ref={areaRef} className="flex-1 overflow-auto">
            <div className="w-fit mx-auto p-3" style={{ paddingTop: chrome ? TOP_BAR : 12, paddingBottom: chrome ? BOTTOM_BAR : 12 }}>
              {area.w > 0 && (
                <PdfPage
                  file={record.file}
                  page={page}
                  fit={fit}
                  zoom={zoom}
                  strokes={strokesOf(page)}
                  onStrokes={(s) => setStrokes(page, s)}
                  tool={tool}
                  color={color}
                  guide={guideFor(page)}
                />
              )}
            </div>
          </div>
        )
      ) : (
        <div ref={areaRef} className={`flex-1 overflow-auto px-3 ${chrome ? "pt-16 pb-36" : "py-3"}`}>
          <div className="max-w-4xl mx-auto">
            {xmlError && <p className="text-sm text-bad">{xmlError}</p>}
            {parsed ? <ScoreSheet parsed={parsed} active={player.active} showNames={showNames} /> : <p className="text-sm text-ink-2">Leyendo…</p>}
          </div>
        </div>
      )}

      {!chrome && (
        <button type="button" onClick={() => setChrome(true)} className={`${circle} fixed top-3 right-3`} aria-label="Mostrar controles">
          {Eye}
        </button>
      )}

      {chrome && (
        <>
          {/* ---- Barra superior ---- */}
          <div className="fixed top-3 left-3 right-3 flex items-center gap-2">
            <button type="button" onClick={onClose} className={circle} aria-label="Volver">
              <ChevronIcon dir="left" className="w-5 h-5" />
            </button>
            <div className="card flex-1 min-w-0 px-4 py-2 shadow-md">
              <p className="font-semibold text-sm truncate">{name}</p>
              <p className="text-[11px] text-ink-2 truncate">
                {view === "pdf" ? `Página ${page} de ${record.pageCount}` : "Partitura MusicXML vinculada"}
                {linkedXml && parsed && view === "pdf" ? " · se puede escuchar" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setNotesOpen((v) => !v)} className={`${circle} ${notesOpen ? "" : "!bg-surface !text-ink"}`} aria-label="Notas y opciones">
              <span className="text-base leading-none">✎</span>
            </button>
            <button type="button" onClick={() => { setChrome(false); setNotesOpen(false); }} className={`${circle} !bg-surface !text-ink`} aria-label="Ocultar controles">
              {EyeOff}
            </button>
          </div>

          {/* ---- Panel de notas y opciones ---- */}
          {notesOpen && (
            <div className="fixed top-16 left-3 right-3 card p-3 shadow-md space-y-3 max-w-lg ml-auto">
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
                  <button type="button" onClick={() => { setAskXml(true); setNotesOpen(false); }} className="pill py-1">Escuchar / transcribir</button>
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
            <div className="fixed bottom-[8.5rem] inset-x-3 flex justify-center pointer-events-none">
              <p className="card px-3 py-1.5 text-[11px] text-ink-2 shadow-md max-w-md text-center">{statusLine}</p>
            </div>
          )}

          {/* ---- Barra inferior ---- */}
          <div className="fixed bottom-3 inset-x-3 flex justify-center pointer-events-none">
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
                  <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom === 1} className="btn-circle w-9 h-9 text-sm disabled:opacity-40" aria-label="Reducir">−</button>
                  <button type="button" onClick={() => setZoom(1)} className="text-xs tabular-nums w-10 text-center" title="Página entera">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="btn-circle w-9 h-9 text-sm" aria-label="Ampliar">+</button>
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
                disabled={!settings.sound || (!!linkedXml && !parsed) || ai.running}
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
        <div className="fixed inset-0 z-10 bg-ink/40 flex items-end sm:items-center justify-center p-3" onClick={() => !ai.running && setAskXml(false)}>
          <div className="card p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">Escuchar esta partitura</h2>
            <p className="text-sm text-ink-2">
              Un PDF es solo una imagen. Para tocar la pieza, mostrarte los nombres y seguir el sonido con una guía,
              Etude Piano necesita el <strong>MusicXML</strong> de esa misma partitura. Hay dos caminos:
            </p>
            <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
              <p className="text-sm font-semibold">1. Transcribirlo con IA</p>
              {settings.openaiKey ? (
                <>
                  <p className="text-xs text-ink-2">
                    Se envían las páginas a OpenAI ({settings.openaiModel || "gpt-4o"}). Tarda un minuto por página, consume crédito de tu
                    cuenta y el resultado es un borrador que conviene revisar.
                  </p>
                  <button type="button" onClick={() => void runAi()} disabled={ai.running} className="pill pill-active text-xs py-1.5 disabled:opacity-50">
                    {ai.running ? "Transcribiendo…" : "Transcribir con IA"}
                  </button>
                  {ai.running && <p className="text-xs text-ink-2">{ai.status}</p>}
                </>
              ) : (
                <p className="text-xs text-ink-2">
                  Añade tu clave de la API de OpenAI en{" "}
                  <Link href="/ajustes" className="text-accent underline">Ajustes</Link> y este botón aparecerá aquí.
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
              <p className="text-sm font-semibold">2. Vincular un MusicXML que ya tengas</p>
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
              <button type="button" onClick={() => xmlInput.current?.click()} disabled={ai.running} className="pill text-xs py-1.5 disabled:opacity-50">
                Elegir archivo
              </button>
            </div>
            {issue && <p className="text-xs text-bad">{issue}</p>}
            <div className="flex justify-end">
              <button type="button" onClick={() => setAskXml(false)} disabled={ai.running} className="pill text-xs py-1.5 disabled:opacity-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
