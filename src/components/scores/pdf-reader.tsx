"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dayKey, scoreSession } from "@/lib/agenda";
import { parseMusicXml, unpackMxl } from "@/lib/music/musicxml";
import { getPageSize } from "@/lib/pdf-thumbnail";
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
import type { PlanState } from "@/lib/study-plan";
import { useJob } from "@/lib/jobs";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { Sheet } from "@/components/ui/sheet";
import { JobIndicator, jobLabel } from "./job-indicator";
import { PdfPage } from "./pdf-page";
import {
  EraserIcon,
  FingerIcon,
  GuideIcon,
  MarkerIcon,
  MinusIcon,
  NoteNamesIcon,
  PenIcon,
  PlanIcon,
  PlayIcon,
  PlusIcon,
  SessionIcon,
  StopIcon,
  UndoIcon,
} from "./reader-icons";
import { DEFAULT_FINGER_SIZE, DEFAULT_PEN_WIDTH, FINGERS, FINGER_SIZES, PEN_COLORS, PEN_WIDTHS, type Finger, type Tool } from "./score-annotator";
import { ScoreSheet } from "./score-sheet";
import { SessionPanel } from "./session-panel";
import { StudyPlanPanel, TeacherChat } from "./study-plan";
import { TranscribePanel } from "./transcribe-panel";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
  onRename: (name: string) => void;
  onPlanChange: (plan: PlanState | undefined) => void;
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

/** Height of the floating toolbars, so the page fits between them with visible breathing room. */
const TOP_BAR = 88;
const BOTTOM_BAR = 88;
const MAX_ZOOM = 4;
/** Starting zoom on desktop: there's width to spare, and bigger reads better. */
const DESKTOP_ZOOM = 1.5;
/** True desktop: wide and mouse-driven. Mobile/tablet start at the full page, however wide the screen. */
const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 48rem) and (pointer: fine)").matches;
/**
 * Wide enough for the side panel (session and analysis) next to the score.
 * Below this, both open as sheets over the page.
 */
const WIDE_QUERY = "(min-width: 64rem)";
/** Tailwind's `sm` from below: where the analysis and play buttons float instead of sitting in the toolbar. */
const NARROW_QUERY = "(max-width: 39.99rem)";
const isWide = () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches;
type PanelTab = "sesion" | "analisis";
/** Gap between carousel pages: nearly touching, so neighbors peek in without stealing space from the centered one. */
const PAGE_GAP = 24;

/* ---------- Toolbar pieces ---------- */

/** Group of related controls, recessed over the bar to separate them without dividers. */
const Group = ({ children }: { children: React.ReactNode }) => (
  <div className="shrink-0 flex items-center gap-0.5 rounded-full bg-surface-2 p-1">{children}</div>
);

/** Round icon button. The label doesn't fit visually, so it goes in `title`/aria-label; `active` marks toggled-on tools. */
function ToolButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
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
      className={`w-9 h-9 rounded-full grid place-items-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${
        active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Same, with text: for what no icon explains better than a word. */
function ToolChip({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`h-9 px-3 rounded-full text-xs font-medium tabular-nums whitespace-nowrap transition-colors ${
        active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

type Pair = ArrayLike<{ clientX: number; clientY: number }>;
const touchMid = (t: Pair) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
const touchGap = (t: Pair) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Zoom anchor: the page point (u, v) — as fractions of its width/height —
 * under the container point (fx, fy), the page's size at 100%, and its
 * corner's position in the scrollable content.
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

/** Transform shown on screen while pinching or animating. */
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
 * Fullscreen reader (below the header on desktop). At 100% each page fills
 * the space and pages turn by swiping or arrows; zoomed in — the desktop
 * default — the page pans freely. With a linked MusicXML, a guide follows
 * playback over the PDF.
 */
export function PdfReader({ record, onClose, onDelete, onNotesChange, onRename, onPlanChange }: Props) {
  const { settings } = useSettings();
  const [page, setPage] = useState(1);
  // mobile starts at the full page (carousel); desktop starts zoomed in
  const [zoom, setZoom] = useState(() => (isDesktop() ? DESKTOP_ZOOM : 1));
  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH);
  const [finger, setFinger] = useState<Finger>("1");
  const [fingerSize, setFingerSize] = useState(DEFAULT_FINGER_SIZE);
  const [annotations, setAnnotations] = useState<Annotations>(record.annotations ?? {});
  const [chrome, setChrome] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  // on a wide screen the session and the analysis sit in a panel beside the
  // score, open from the start when the piece has a plan; the session tab first
  // when it's scheduled, since that's what's studied today
  const wide = useMediaQuery(WIDE_QUERY);
  // below `sm`, the actions float as a column of circles and the chat launcher tops it
  const narrow = useMediaQuery(NARROW_QUERY);
  const [panelOpen, setPanelOpen] = useState(() => isWide() && !!record.plan);
  const [panelTab, setPanelTab] = useState<PanelTab>(() => (record.plan?.schedule ? "sesion" : "analisis"));
  const [notes, setNotes] = useState(record.notes);
  const [name, setName] = useState(record.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedXml, setLinkedXml] = useState<Blob | undefined>(record.linkedXml);
  const [askXml, setAskXml] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  // long-running tasks for this score: keep going even with panels closed
  const omrJob = useJob("omr", record.id);
  const planJob = useJob("plan", record.id);
  const [issue, setIssue] = useState<string | null>(null);
  const [view, setView] = useState<"pdf" | "xml">("pdf");
  const [showNames, setShowNames] = useState(true);
  const [guideOn, setGuideOn] = useState(true);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [layout, setLayout] = useState<{ of: unknown; map: MeasureMap } | null>(null);
  const [cursor, setCursor] = useState<{ measure: number; frac: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(0);
  const [pinching, setPinching] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const zoomRef = useRef(zoom);
  const viewRef = useRef(view);
  const chromeRef = useRef(chrome);
  /** Carousel cell width, for gestures that live outside the render. */
  const cellRef = useRef(1);
  const gesture = useRef<
    | ({ kind: "pinch"; el: HTMLElement; gap: number; zoom: number; ratio: number } & Anchor & Live)
    | { kind: "pan"; x: number; y: number; left: number; top: number }
    | null
  >(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  /** Page with a transform that needs clearing once the real scale is committed. */
  const live = useRef<HTMLElement | null>(null);
  /** Settle animation in progress (can be finished instantly). */
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
  // whether there's a session to offer in the narrow layouts (with the side panel it's already on screen)
  const today = useMemo(() => dayKey(new Date()), []);
  const hasSession = useMemo(() => scoreSession(record, today)?.kind === "session", [record, today]);

  /* ---------- Carousel geometry ---------- */

  // the first page's aspect ratio is enough to know how wide it'll be
  useEffect(() => {
    let cancelled = false;
    getPageSize(record.file, 1)
      .then((d) => !cancelled && setRatio(d.width / d.height))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [record.file]);

  const fit = { w: Math.max(0, area.w - 16), h: Math.max(0, area.h - (chrome ? TOP_BAR + BOTTOM_BAR : 16)) };
  /** Page width at 100%: on wide screens, height is the limiting factor. */
  const pageW = ratio ? Math.min(fit.w, fit.h * ratio) : fit.w;
  /** Carousel cell. On desktop, barely wider than the page so neighbors peek in on
   *  the sides with just one centered; on mobile the page already fills the screen. */
  const cell = Math.max(1, Math.min(area.w, pageW + PAGE_GAP));
  /** Padding so the first and last pages can also center. */
  const side = Math.max(0, (area.w - cell) / 2);
  /** Pages visible on each side, and thus needing to be drawn. */
  const near = Math.max(1, Math.ceil((area.w / cell + 1) / 2));

  /* ---------- Area size and navigation ---------- */

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    // the border box, not the content box: the content box shrinks when a scrollbar
    // appears, and it's the page size — measured from here — that decides whether it
    // appears. Measuring it loops: page grows → scrollbar shows → page shrinks →
    // scrollbar hides → … The loop's window grows with the zoom, so it surfaces as
    // shaking at high zoom.
    const ro = new ResizeObserver(([e]) => {
      const box = e.borderBoxSize?.[0];
      const w = box ? box.inlineSize : e.contentRect.width;
      const h = box ? box.blockSize : e.contentRect.height;
      setArea((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const goTo = (p: number) => {
    const target = Math.min(record.pageCount, Math.max(1, p));
    setPage(target);
    if (zoomRef.current === 1) areaRef.current?.scrollTo({ left: (target - 1) * cellRef.current, behavior: "smooth" });
  };

  // when swiping, the page is whichever cell ends up centered
  const onPagerScroll = () => {
    const el = areaRef.current;
    if (!el || !area.w || zoomRef.current !== 1) return;
    const p = Math.round(el.scrollLeft / cellRef.current) + 1;
    if (p !== pageRef.current && p >= 1 && p <= record.pageCount) setPage(p);
  };

  // returning to swipe mode, the carousel must be at the current page
  useEffect(() => {
    cellRef.current = cell;
    if (pager && areaRef.current && area.w) areaRef.current.scrollLeft = (page - 1) * cell;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager, cell, area.w, view]);

  /* ---------- Pinch zoom ---------- */

  // during a pinch, the page only scales via a CSS transform (GPU-composited,
  // no re-render); on release, the real scale and scroll offset commit in the
  // same frame the transform is removed, so the score doesn't jump or flicker
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

  /** Anchor for the page under the container point (fx, fy). */
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
   * Given scale z and anchor a: the scroll offset to commit and the page's
   * corner relative to the container once committed. At 100% the page
   * centers in its carousel cell; zoomed in, it centers in the container with margins.
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
      return { sx: (pageRef.current - 1) * cellRef.current, sy: 0, left: (cw - w) / 2, top: top + (ch - top - bottom - h) / 2 };
    }
    const top = chrome ? TOP_BAR : 12;
    const bottom = chrome ? BOTTOM_BAR : 12;
    const x = Math.max(0, (cw - w - 24) / 2) + 12;
    const sx = clamp(x + a.u * w - a.fx, 0, Math.max(0, w + 24 - cw));
    const sy = clamp(top + a.v * h - a.fy, 0, Math.max(0, top + h + bottom - ch));
    return { sx, sy, left: x - sx, top: top - sy };
  };

  /**
   * Brings the page to scale z, keeping the anchor under the finger. If what's
   * shown (cur) doesn't match the final position, animates the transform there
   * first and only then commits the real scale, so the layout change goes unnoticed.
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

  /** Button zoom: animates around the screen's center. */
  const zoomTo = (z: number) => {
    const el = areaRef.current;
    const pg = el && pageEl(el);
    if (!el || !pg || settling.current || gesture.current) return;
    settle(el, pg, anchorAt(el, pg, el.clientWidth / 2, el.clientHeight / 2), z, { k: 1, tx: 0, ty: 0 }, true);
  };

  // when zoomed in, the container stops auto-scrolling (touch-action: none) and
  // one-finger drag is handled here; two fingers pinch to zoom
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

  // listeners live on window so the gesture keeps tracking even if the finger leaves the container
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
      // outside the range, scale gives only a little, like a rubber band, and snaps back on release
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
    // trackpad pinch or Ctrl+wheel zooms the same as touch
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

  // on mobile the reader is fullscreen: while open, the site header and bottom
  // bar hide (globals.css) so they don't cover the name row or duplicate nav
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-reader", "");
    return () => root.removeAttribute("data-reader");
  }, []);

  // hiding the controls also hides the site header (globals.css), so on
  // desktop the reader then takes up the full screen
  useEffect(() => {
    const root = document.documentElement;
    if (chrome) root.removeAttribute("data-immersive");
    else root.setAttribute("data-immersive", "");
    return () => root.removeAttribute("data-immersive");
  }, [chrome]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // with a panel open, Escape belongs to it; closing the reader here would interrupt it
      if (planOpen || transcribeOpen || askXml) return;
      if (e.key === "Escape") {
        if (notesOpen) setNotesOpen(false);
        else onClose();
        return;
      }
      if (view !== "pdf" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") goTo(pageRef.current + 1);
      if (e.key === "ArrowLeft") goTo(pageRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, view, area.w, planOpen, transcribeOpen, askXml, notesOpen]);

  /* ---------- Playback guide ---------- */

  // with a linked MusicXML, pages are analyzed once to locate the measures
  useEffect(() => {
    if (!parsed || !guideOn || (layout && layout.of === parsed)) return;
    let cancelled = false;
    analyzePdf(record.file, record.pageCount, parsed.clefs.length)
      .then((layouts) => !cancelled && setLayout({ of: parsed, map: buildMeasureMap(layouts, parsed) }))
      .catch(() => !cancelled && setLayout({ of: parsed, map: { boxes: [], order: [], starts: [], lengths: [], approximate: true } }));
    return () => {
      cancelled = true;
    };
  }, [parsed, guideOn, layout, record.file, record.pageCount]);

  // while playing, the guide follows the audio clock and turns pages on its own;
  // requestAnimationFrame (not a fixed interval) keeps it in step with note
  // highlighting so there's no visible lag between sound and guide
  useEffect(() => {
    // an approximate map makes neither the guide nor page turns reliable
    if (!player.playing || !map || map.approximate || !guideOn) return;
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

  /* ---------- Persistence ---------- */

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
    parseMusicXml(xml); // validate before saving
    const blob = new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
    await updateScoreLinkedXml(record.id, blob);
    setLinkedXml(blob);
    setIssue(null);
    setAskXml(false);
  };

  const openTranscribe = () => {
    player.stop();
    setAskXml(false);
    setNotesOpen(false);
    setTranscribeOpen(true);
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

  /* ---------- View ---------- */

  const circle = "btn-circle w-10 h-10 shadow-md";
  const pickTool = (t: Tool) => setTool((cur) => (cur === t ? null : t));
  const showPanel = (tab: PanelTab) => {
    setPanelTab(tab);
    setPanelOpen(true);
  };
  /** Analysis: in the side panel when there's room, else as a sheet. Pressing it again on the panel folds it. */
  const openPlan = () => {
    if (wide) {
      if (panelOpen && panelTab === "analisis") setPanelOpen(false);
      else showPanel("analisis");
      return;
    }
    player.stop();
    setPlanOpen(true);
  };
  const openSession = () => {
    player.stop();
    setSessionOpen(true);
  };
  const planShown = planOpen || (wide && panelOpen && panelTab === "analisis");

  /** Analysis and Play buttons. `floating`: two loose circles (mobile); otherwise pills with text in the toolbar. */
  const renderActions = (floating: boolean) => {
    const planTitle = record.plan ? "Análisis y sesiones de esta partitura" : "Analizar la partitura con IA";
    const playLabel = player.playing ? "Detener" : "Escuchar";
    return (
      <>
        {hasSession && !wide && (
          <button
            type="button"
            onClick={openSession}
            title="Sesión de estudio de esta partitura"
            aria-label={floating ? "Sesión de estudio" : undefined}
            className={`pointer-events-auto inline-flex items-center justify-center font-semibold transition-colors ${
              floating ? "w-12 h-12 rounded-full shadow-md bg-surface text-ink-2 hover:text-ink" : "h-10 px-3.5 gap-1.5 rounded-full text-xs bg-surface-2 text-ink-2 hover:text-ink"
            }`}
          >
            <SessionIcon className={floating ? "w-5 h-5" : "w-4 h-4"} />
            {!floating && <span>Sesión</span>}
          </button>
        )}
        <button
          type="button"
          onClick={openPlan}
          title={planTitle}
          aria-label={floating ? planTitle : undefined}
          className={`pointer-events-auto inline-flex items-center justify-center font-semibold transition-colors ${
            floating ? "w-12 h-12 rounded-full shadow-md" : "h-10 px-3.5 gap-1.5 rounded-full text-xs"
          } ${record.plan ? "bg-ok-soft text-ok" : floating ? "bg-surface text-ink-2 hover:text-ink" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
        >
          <PlanIcon className={floating ? "w-5 h-5" : "w-4 h-4"} />
          {!floating && <span>Análisis</span>}
        </button>
        <button
          type="button"
          onClick={onPlay}
          disabled={!settings.sound || (!!linkedXml && !parsed)}
          title={settings.sound ? (floating ? playLabel : undefined) : "El sonido está desactivado en Ajustes"}
          aria-label={floating ? playLabel : undefined}
          className={`pointer-events-auto inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-40 ${
            floating ? "w-14 h-14 rounded-full shadow-md" : "h-10 px-4 gap-2 rounded-full text-sm"
          } ${player.playing ? "bg-bad text-bg" : "bg-accent text-bg"}`}
        >
          {player.playing ? <StopIcon className={floating ? "w-5 h-5" : "w-4 h-4"} /> : <PlayIcon className={floating ? "w-5 h-5" : "w-4 h-4"} />}
          {!floating && <span>{playLabel}</span>}
        </button>
      </>
    );
  };

  // if barlines didn't match the score, the guide would point at the wrong spot; better to skip it and say so
  const guideFor = (p: number) => {
    if (!cursor || !map || map.approximate) return null;
    const box = map.boxes[cursor.measure];
    return box?.page === p ? { box, frac: cursor.frac } : null;
  };

  const statusLine =
    parsed && guideOn && !map
      ? "Buscando los compases en la página…"
      : map?.approximate && guideOn && view === "pdf"
        ? "Sin guía: no se pudieron cuadrar los compases con la página. Puedes seguir la pieza con los nombres de las notas."
        : null;
  // with its panel closed, the running task is summarized below, in addition to the ring above
  const backgroundJob = !transcribeOpen && !planShown ? [omrJob, planJob].find((j) => j?.status === "running") : undefined;
  const footnote = statusLine ?? (backgroundJob ? `${jobLabel(backgroundJob.kind)} · ${backgroundJob.label}` : null);

  // the reader fills the screen on mobile; on desktop it starts below the
  // header so it doesn't cover navigation. Its controls are inside (absolute).
  return (
    <div
      // z-50: below the header (z-60), whose dropdowns fall over the reader
      className="fixed inset-0 md:top-[var(--header-h)] z-50 bg-surface-2 flex"
      role="dialog"
      aria-label={name}
      style={{ "--safe-t": "env(safe-area-inset-top, 0px)", "--safe-b": "env(safe-area-inset-bottom, 0px)" } as React.CSSProperties}
    >
      {/* ---- The score with its floating controls; on a wide screen the side panel takes the rest ---- */}
      <div className="relative flex-1 min-w-0 flex flex-col">
        {/* ---- Content ---- */}
        {view === "pdf" ? (
          // a single container for both the carousel and the zoomed view: the
          // current page keeps its node (and canvas) across scale changes
          <div
            ref={areaRef}
            onScroll={onPagerScroll}
            onTouchStart={onTouchStart}
            className={pager ? "flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none]" : "flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:var(--surface-3)_transparent]"}
            style={{ touchAction: pager && !tool && !pinching ? "pan-x" : "none" }}
          >
            {pager && side > 0 && <div aria-hidden className="shrink-0 h-full" style={{ width: side }} />}
            {Array.from({ length: record.pageCount }, (_, i) => i + 1).map((p) =>
              pager || p === page ? (
                <div
                  key={p}
                  className={
                    pager
                      ? `snap-center shrink-0 h-full flex items-center justify-center transition-opacity duration-200 ${p !== page ? "cursor-pointer" : ""}`
                      : "w-fit mx-auto p-3"
                  }
                  onClick={pager && p !== page ? () => goTo(p) : undefined}
                  style={
                    pager
                      ? {
                          width: cell,
                          paddingTop: chrome ? TOP_BAR : 8,
                          paddingBottom: chrome ? BOTTOM_BAR : 8,
                          // only the centered one is fully opaque; neighbors are just hinted at
                          opacity: p === page ? 1 : 0.45,
                        }
                      : { paddingTop: chrome ? TOP_BAR : 12, paddingBottom: chrome ? BOTTOM_BAR : 12 }
                  }
                >
                  {Math.abs(p - page) <= near && area.w > 0 ? (
                    // a neighbor is only for looking and tapping: strokes belong to the centered page
                    <div className={pager && p !== page ? "pointer-events-none" : undefined}>
                      <PdfPage
                        file={record.file}
                        page={p}
                        fit={pager ? { w: pageW, h: fit.h } : fit}
                        zoom={zoom}
                        strokes={strokesOf(p)}
                        onStrokes={(s) => setStrokes(p, s)}
                        tool={tool}
                        color={color}
                        penWidth={penWidth}
                        finger={finger}
                        fingerSize={fingerSize}
                        guide={guideFor(p)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null,
            )}
            {pager && side > 0 && <div aria-hidden className="shrink-0 h-full" style={{ width: side }} />}
          </div>
        ) : (
          <div ref={areaRef} className={`flex-1 overflow-auto px-3 [scrollbar-width:thin] [scrollbar-color:var(--surface-3)_transparent] ${chrome ? "pt-24 pb-36" : "py-3"}`}>
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
            className={`${circle} absolute right-3`}
            style={{ top: "calc(0.75rem + var(--safe-t))" }}
            aria-label="Mostrar controles"
          >
            {Eye}
          </button>
        )}

        {chrome && (
          <>
            {/* ---- Barra superior: un único menú centrado, no una franja completa ---- */}
            <div className="absolute inset-x-3 flex justify-center pointer-events-none" style={{ top: "calc(0.75rem + var(--safe-t))" }}>
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
                {omrJob && <JobIndicator job={omrJob} onOpen={openTranscribe} />}
                {planJob && <JobIndicator job={planJob} onOpen={() => { setNotesOpen(false); openPlan(); }} />}
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
                className="absolute inset-x-3 card p-3 shadow-md space-y-3 max-w-sm mx-auto"
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
                  <button type="button" onClick={openTranscribe} className="pill py-1">Transcribir a MusicXML</button>
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

            {/* ---- Lo que se abre sobre la barra: avisos, colores y tempo ----
                 Va fuera del panel para que abrirlo no reordene los botones. */}
            <div
              className="absolute inset-x-3 pr-14 sm:pr-0 flex flex-col items-center gap-2 pointer-events-none"
              style={{ bottom: "calc(4.75rem + var(--safe-b))" }}
            >
              {footnote && <p className="card px-3 py-1.5 text-[11px] text-ink-2 shadow-md max-w-md text-center">{footnote}</p>}

              {tempoOpen && linkedXml && (
                <div className="pointer-events-auto card shadow-md px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-ink-2 tabular-nums whitespace-nowrap">♩ = {player.tempo}</span>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    value={player.tempo}
                    onChange={(e) => player.setTempo(Number(e.target.value))}
                    disabled={player.playing}
                    className="accent-(--accent) w-44 max-w-[45vw] disabled:opacity-40"
                    aria-label="Tempo"
                  />
                </div>
              )}

              {view === "pdf" && (tool === "pen" || tool === "finger") && (
                <div className="pointer-events-auto card shadow-md p-1.5 flex items-center gap-1">
                  {tool === "finger" && (
                    <>
                      {FINGERS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFinger(f)}
                          title={`Dedo ${f}`}
                          aria-label={`Dedo ${f}`}
                          aria-pressed={finger === f}
                          className={`w-8 h-8 rounded-full grid place-items-center font-serif font-bold text-base transition-colors ${
                            finger === f ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                      <span aria-hidden className="w-px h-5 mx-1 bg-line" />
                    </>
                  )}
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      aria-label={c.label}
                      aria-pressed={color === c.value}
                      className="w-8 h-8 rounded-full grid place-items-center"
                    >
                      <span
                        className="w-5 h-5 rounded-full transition-transform"
                        style={{
                          background: c.value,
                          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
                          outline: color === c.value ? "2px solid var(--ink)" : "none",
                          outlineOffset: "2px",
                          transform: color === c.value ? "scale(1.1)" : undefined,
                        }}
                      />
                    </button>
                  ))}
                  {tool === "finger" && (
                    <>
                      <span aria-hidden className="w-px h-5 mx-1 bg-line" />
                      {FINGER_SIZES.map((z, i) => (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => setFingerSize(z.value)}
                          title={z.label}
                          aria-label={`Tamaño ${z.label.toLowerCase()}`}
                          aria-pressed={fingerSize === z.value}
                          className={`w-8 h-8 rounded-full grid place-items-center font-serif font-bold leading-none transition-colors ${
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
                      <span aria-hidden className="w-px h-5 mx-1 bg-line" />
                      {PEN_WIDTHS.map((w, i) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setPenWidth(w.value)}
                          title={w.label}
                          aria-label={`Grosor ${w.label.toLowerCase()}`}
                          aria-pressed={penWidth === w.value}
                          className={`w-8 h-8 rounded-full grid place-items-center transition-colors ${
                            penWidth === w.value ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
                          }`}
                        >
                          <span className="rounded-full bg-current" style={{ width: 6 + i * 4, height: 6 + i * 4 }} />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ---- Zoom: mando aparte, contra el borde ----
                 Se usa a cada rato y no compite por sitio con las herramientas. */}
            {view === "pdf" && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 card shadow-md p-1 flex flex-col items-center">
                <ToolButton label="Ampliar" onClick={() => zoomTo(zoom + 0.25)} disabled={zoom >= MAX_ZOOM}>
                  <PlusIcon />
                </ToolButton>
                <button
                  type="button"
                  onClick={() => zoomTo(1)}
                  disabled={zoom === 1}
                  title="Ver la página entera"
                  className="w-9 py-0.5 text-center text-[10px] tabular-nums text-ink-2 hover:text-ink disabled:text-ink-3 disabled:pointer-events-none"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <ToolButton label="Reducir" onClick={() => zoomTo(zoom - 0.25)} disabled={zoom === 1}>
                  <MinusIcon />
                </ToolButton>
              </div>
            )}

            {/* ---- Panel de herramientas ---- */}
            <div className="absolute inset-x-3 flex justify-center pointer-events-none" style={{ bottom: "calc(0.75rem + var(--safe-b))" }}>
              <div className="pointer-events-auto card shadow-md p-1.5 flex items-center gap-1.5 min-w-0 max-w-full">
                {/* Lo que no cabe se desplaza a un lado; las dos acciones de la
                    derecha se quedan siempre a la vista. */}
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {view === "pdf" && (
                    <>
                      {record.pageCount > 1 && (
                        <Group>
                          <ToolButton label="Página anterior" onClick={() => goTo(page - 1)} disabled={page === 1}>
                            <ChevronIcon dir="left" className="w-4 h-4" />
                          </ToolButton>
                          <span className="px-1 text-xs tabular-nums text-ink-2 select-none">
                            {page}
                            <span className="text-ink-3">/{record.pageCount}</span>
                          </span>
                          <ToolButton label="Página siguiente" onClick={() => goTo(page + 1)} disabled={page === record.pageCount}>
                            <ChevronIcon dir="right" className="w-4 h-4" />
                          </ToolButton>
                        </Group>
                      )}

                      <Group>
                        <ToolButton label="Lápiz" active={tool === "pen"} onClick={() => pickTool("pen")}>
                          <PenIcon />
                        </ToolButton>
                        <ToolButton label="Subrayador" active={tool === "highlighter"} onClick={() => pickTool("highlighter")}>
                          <MarkerIcon />
                        </ToolButton>
                        <ToolButton label="Digitación: toca una nota para escribir el dedo encima" active={tool === "finger"} onClick={() => pickTool("finger")}>
                          <FingerIcon />
                        </ToolButton>
                        <ToolButton label="Borrador" active={tool === "eraser"} onClick={() => pickTool("eraser")}>
                          <EraserIcon />
                        </ToolButton>
                        <ToolButton
                          label="Deshacer lo último"
                          onClick={() => setStrokes(page, strokesOf(page).slice(0, -1))}
                          disabled={!strokesOf(page).length}
                        >
                          <UndoIcon />
                        </ToolButton>
                      </Group>
                    </>
                  )}

                  {linkedXml && (
                    <Group>
                      {view === "pdf" && (
                        <ToolButton
                          label={
                            map?.approximate
                              ? "No hay guía: los compases de este PDF no se pudieron cuadrar con la partitura"
                              : "Guía que sigue el sonido sobre la página"
                          }
                          active={guideOn && !map?.approximate}
                          disabled={!!map?.approximate}
                          onClick={() => setGuideOn((v) => !v)}
                        >
                          <GuideIcon />
                        </ToolButton>
                      )}
                      <ToolButton
                        label={view === "pdf" ? "Ver la partitura con los nombres de las notas" : "Volver al PDF"}
                        active={view === "xml"}
                        onClick={() => setView((v) => (v === "pdf" ? "xml" : "pdf"))}
                      >
                        <NoteNamesIcon />
                      </ToolButton>
                      {view === "xml" && (
                        <ToolChip label="Nombres de las notas" active={showNames} onClick={() => setShowNames((v) => !v)}>
                          Nombres
                        </ToolChip>
                      )}
                      <ToolChip label="Velocidad de reproducción" active={tempoOpen} onClick={() => setTempoOpen((v) => !v)}>
                        ♩={player.tempo}
                      </ToolChip>
                    </Group>
                  )}
                </div>

                {/* En pantallas anchas las dos acciones van dentro de la barra;
                    en móvil salen como botones flotantes aparte (más abajo). */}
                <div className="hidden sm:flex shrink-0 items-center gap-1.5">{renderActions(false)}</div>
              </div>
            </div>

            {/* ---- Móvil: Análisis y Escuchar como botones flotantes ---- */}
            <div
              className="sm:hidden absolute right-3 flex flex-col items-center gap-2 pointer-events-none"
              style={{ bottom: "calc(4.75rem + var(--safe-b))" }}
            >
              {renderActions(true)}
            </div>

            {/* ---- Escritorio: pestaña en el borde para volver a abrir el panel plegado ---- */}
            {/* it fades in once the panel has folded, instead of popping while it's still moving */}
            {wide && (
              <button
                type="button"
                onClick={() => showPanel(panelTab)}
                title="Mostrar la sesión y el análisis"
                aria-label="Mostrar la sesión y el análisis"
                tabIndex={panelOpen ? -1 : 0}
                className={`absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 py-3 pl-2 pr-1.5 rounded-l-2xl bg-surface border border-r-0 border-line shadow-md text-ink-2 hover:text-ink hover:bg-surface-2 transition-[opacity,transform] duration-200 ${
                  panelOpen ? "opacity-0 translate-x-3 pointer-events-none" : "opacity-100 translate-x-0 delay-200"
                }`}
              >
                <ChevronIcon dir="left" className="w-4 h-4" />
                <SessionIcon className="w-5 h-5" />
                <PlanIcon className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {/* ---- Transcripción del PDF a MusicXML: otra hoja, sin salir de la partitura ---- */}
        <Sheet open={transcribeOpen} onClose={() => setTranscribeOpen(false)} title="Transcribir la partitura" subtitle={name}>
          <TranscribePanel scoreId={record.id} scoreName={record.name} pdf={record.file} pageCount={record.pageCount} hasXml={!!linkedXml} onUse={applyXml} />
        </Sheet>

        {/* ---- Cómo conseguir la reproducción ---- */}
        {askXml && (
          <div className="absolute inset-0 z-10 bg-ink/40 flex items-end sm:items-center justify-center p-3" onClick={() => setAskXml(false)}>
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
              <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
                <p className="text-sm font-semibold">O transcribirla desde el PDF</p>
                <p className="text-xs text-ink-2">
                  El servidor lee las páginas y escribe el MusicXML. Tarda unos minutos por página y sale un borrador, con fallos de
                  ritmo aquí y allá, así que Opus Piano te señala los compases que no cuadran.
                </p>
                <button type="button" onClick={openTranscribe} className="pill text-xs py-1.5">
                  Transcribir la partitura
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

      {/* ---- Chat con el profesor, flotando sobre la partitura ----
           On narrow screens the launcher sits on top of the floating column (play 3.5rem,
           analysis 3rem, session 3rem, 0.5rem gaps, from 4.75rem up) and the window opens
           above the toolbar, covering that column. */}
      {record.plan && (
        <TeacherChat
          record={record}
          state={record.plan}
          parsed={parsed}
          launcherBottom={narrow ? (hasSession ? "15.75rem" : "12.25rem") : undefined}
          windowBottom={narrow ? "5.25rem" : undefined}
        />
      )}

      {/* ---- Escritorio: sesión y análisis junto a la partitura ----
           Las dos pestañas quedan montadas: el cronómetro sigue mientras se lee el análisis. */}
      {wide && (
        <aside
          aria-label="Sesión y análisis"
          aria-hidden={!panelOpen}
          inert={!panelOpen}
          className={`shrink-0 overflow-hidden bg-surface border-l transition-[width,border-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            panelOpen ? "w-[34rem] 2xl:w-[38rem] border-line" : "w-0 border-transparent"
          }`}
        >
        {/* full width inside, so nothing reflows while the panel moves */}
        <div className="w-[34rem] 2xl:w-[38rem] h-full flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
              <div role="tablist" aria-label="Sesión o análisis" className="flex-1 flex rounded-full bg-surface-2 p-1">
                {(["sesion", "analisis"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={panelTab === t}
                    onClick={() => setPanelTab(t)}
                    className={`flex-1 h-9 rounded-full text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                      panelTab === t ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {t === "sesion" ? <SessionIcon className="w-4 h-4" /> : <PlanIcon className="w-4 h-4" />}
                    {t === "sesion" ? "Sesión" : "Análisis"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="btn-circle w-9 h-9 shrink-0 !bg-surface-2 !text-ink"
                title="Ocultar el panel"
                aria-label="Ocultar el panel"
              >
                <ChevronIcon dir="right" className="w-4 h-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:var(--surface-3)_transparent] pl-4 pr-2 pt-1 pb-6">
              <div role="tabpanel" hidden={panelTab !== "sesion"}>
                <SessionPanel record={record} onPlanChange={onPlanChange} onOpenAnalysis={() => setPanelTab("analisis")} />
              </div>
              <div role="tabpanel" hidden={panelTab !== "analisis"}>
                <StudyPlanPanel record={record} xml={linkedXml} pdf={record.file} onPlanChange={onPlanChange} />
              </div>
            </div>
        </div>
        </aside>
      )}

      {/* ---- Pantallas estrechas: análisis y sesión como hojas sobre la partitura ---- */}
      {!wide && (
        <>
          <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Análisis de la partitura" subtitle={name}>
            <StudyPlanPanel record={record} xml={linkedXml} pdf={record.file} onPlanChange={onPlanChange} />
          </Sheet>
          <Sheet open={sessionOpen} onClose={() => setSessionOpen(false)} title="Sesión de estudio" subtitle={name}>
            <SessionPanel
              record={record}
              onPlanChange={onPlanChange}
              onOpenAnalysis={() => {
                setSessionOpen(false);
                setPlanOpen(true);
              }}
            />
          </Sheet>
        </>
      )}
    </div>
  );
}
