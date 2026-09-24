"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { PomodoroFloatingButton, PomodoroPanel, TomatoIcon } from "./pomodoro-panel";
import {
  GuideIcon,
  MinusIcon,
  NoteNamesIcon,
  PlanIcon,
  PlayIcon,
  PlusIcon,
  SessionIcon,
  StopIcon,
} from "./reader-icons";
import { AnnotationOptions, AnnotationTools, Group, ToolButton, type AnnotationState } from "./annotation-tools";
import {
  DEFAULT_FINGER_SIZE,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LINER_WIDTH,
  DEFAULT_PEN_WIDTH,
  PEN_COLORS,
  type Finger,
  type Tool,
} from "./score-annotator";
import { ScoreSheet } from "./score-sheet";
import { SessionPanel } from "./session-panel";
import { StudyPlanPanel, TeacherChat } from "./study-plan";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
  onRename: (name: string) => void;
  onPlanChange: (plan: PlanState | undefined) => void;
}

/**
 * Sitio que se reserva para los mandos en una pantalla de ratón, donde se
 * quedan puestos y la página tiene que caber entre ellos. En táctil se esconden
 * solos y flotan sobre la partitura, así que allí no se reserva nada.
 */
const TOP_BAR = 72;
const BOTTOM_BAR = 88;
/**
 * Margen alrededor de la página con ratón, donde además hay que dejarle sitio
 * a las barras porque nunca se esconden. En táctil no hay ninguno: la partitura
 * va de borde a borde y los mandos flotan encima, así que nada de esto cambia
 * al aparecer o retirarse —la página mantiene su tamaño y el zoom no salta—.
 */
const SIDE = 12;
const MAX_ZOOM = 4;
/** How long the chrome stays up after the last thing touched, like a video player's controls. */
const CHROME_LINGER = 3500;
/** Starting zoom on desktop: there's width to spare, and bigger reads better. */
const DESKTOP_ZOOM = 1.5;
/**
 * True desktop: wide and mouse-driven. Mobile/tablet start at the full page,
 * however wide the screen: an iPad with a trackpad reports a fine pointer too,
 * so any touchscreen at all counts it out.
 */
const isDesktop = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 48rem) and (pointer: fine)").matches &&
  !window.matchMedia("(any-pointer: coarse)").matches;
/**
 * Wide enough for the side panel (session and analysis) next to the score.
 * Below this, both open as sheets over the page.
 */
const WIDE_QUERY = "(min-width: 64rem)";
/** Tailwind's `sm` from below: a phone, where the bars have to give up their labels. */
const NARROW_QUERY = "(max-width: 39.99rem)";
/**
 * Any touchscreen — a phone or an iPad. There the score reads best bare: the
 * chrome floats over the page, tucks itself away a few seconds after the last
 * thing touched, and comes back with a tap. Pages turn and zoom by gesture, so
 * the buttons for either would only take up room.
 */
const TOUCH_QUERY = "(any-pointer: coarse)";
const isWide = () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches;
const isTouch = () => typeof window !== "undefined" && window.matchMedia(TOUCH_QUERY).matches;
type PanelTab = "sesion" | "pomodoro" | "analisis";
/** Rótulos e iconos de las pestañas del panel lateral, en el orden en que salen. */
const PANEL_TABS = [
  { id: "sesion", label: "Sesión" },
  { id: "pomodoro", label: "Pomodoro" },
  { id: "analisis", label: "Análisis" },
] as const;
/** Gap between carousel pages: nearly touching, so neighbors peek in without stealing space from the centered one. */
const PAGE_GAP = 24;

/* ---------- Toolbar pieces ---------- */

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

/**
 * A round action in the navbar. `tone` marks the two that aren't just another
 * grey icon: the analysis when the piece has one, and play while it sounds.
 */
function NavButton({
  label,
  onClick,
  disabled,
  tone = "plain",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "ok" | "accent" | "bad";
  children: React.ReactNode;
}) {
  const skin = {
    plain: "text-ink-2 hover:bg-surface-2 hover:text-ink",
    ok: "bg-ok-soft text-ok",
    accent: "bg-accent text-bg",
    bad: "bg-bad text-bg",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      // algo más pequeños en un móvil: ahí son cinco y el nombre necesita su sitio
      className={`grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${skin}`}
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
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH);
  const [linerWidth, setLinerWidth] = useState(DEFAULT_LINER_WIDTH);
  const [finger, setFinger] = useState<Finger>("1");
  const [fingerSize, setFingerSize] = useState(DEFAULT_FINGER_SIZE);
  const [annotations, setAnnotations] = useState<Annotations>(record.annotations ?? {});
  // a touchscreen reads best bare: the chrome starts tucked away and comes back with a tap
  const [chrome, setChrome] = useState(() => !isTouch());
  const [notesOpen, setNotesOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  // on a wide screen the session and the analysis sit in a panel beside the
  // score, open from the start when the piece has a plan; the session tab first
  // when it's scheduled, since that's what's studied today
  const wide = useMediaQuery(WIDE_QUERY);
  // below `sm`, the navbar buttons drop their labels and the chat launcher climbs over the toolbar
  const narrow = useMediaQuery(NARROW_QUERY);
  // touch input: zoom and page turns are gestures, and the chrome floats over the page and auto-hides
  const touch = useMediaQuery(TOUCH_QUERY);
  /**
   * What the page leaves free above and below. It doesn't depend on whether the
   * chrome is showing: on a touchscreen the bars float over the page — so the
   * page keeps the whole height and its zoom never jumps when they tuck away —
   * and with a mouse they always have their room, since there they never hide.
   */
  const inset = touch ? { top: 0, bottom: 0, side: 0 } : { top: TOP_BAR, bottom: BOTTOM_BAR, side: SIDE };
  const [panelOpen, setPanelOpen] = useState(() => isWide() && !!record.plan);
  const [panelTab, setPanelTab] = useState<PanelTab>(() => (record.plan?.schedule ? "sesion" : "analisis"));
  const [notes, setNotes] = useState(record.notes);
  const [name, setName] = useState(record.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedXml, setLinkedXml] = useState<Blob | undefined>(record.linkedXml);
  const [askXml, setAskXml] = useState(false);
  // long-running task for this score: keeps going even with panels closed
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
  /** Space the page leaves for the chrome, for gestures that live outside the render. */
  const insetRef = useRef({ top: 0, bottom: 0, side: 0 });
  /** A gesture that moved: the click it ends with is a swipe or a pan, not a tap on the page. */
  const dragged = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
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
  /** Chrome auto-hide, like a video player's controls: alive while there's a reason to stay. */
  const chromeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const { parsed, error: xmlError } = useParsedXml(linkedXml);
  const player = useScorePlayer(parsed);
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
    pageRef.current = page;
    zoomRef.current = zoom;
    viewRef.current = view;
    chromeRef.current = chrome;
    insetRef.current = inset;
    // a tool in hand is reason enough for the bars to stay: its colours and
    // sizes live down there, and they're wanted between one stroke and the next
    busyRef.current = !!tool || notesOpen || tempoOpen || planOpen || sessionOpen || pomodoroOpen || askXml;
  });

  const stopHideTimer = () => {
    if (chromeHideTimer.current) clearTimeout(chromeHideTimer.current);
    chromeHideTimer.current = null;
  };
  /**
   * Arms the countdown that tucks the chrome away, like a video player's
   * controls. Only on a touchscreen: with a mouse the bars keep their own room
   * on screen and hiding them would resize the page.
   */
  const armHide = () => {
    stopHideTimer();
    if (!isTouch()) return;
    chromeHideTimer.current = setTimeout(() => {
      // something half-done — a note being written, a tool in hand — is reason enough to stay
      if (busyRef.current) return armHide();
      setChrome(false);
    }, CHROME_LINGER);
  };
  /** Brings the bars up and restarts the countdown. */
  const wakeChrome = () => {
    setChrome(true);
    armHide();
  };
  /** Keeps them up a little longer, but doesn't summon them: a swipe shouldn't. */
  const nudgeChrome = () => {
    if (chromeRef.current) armHide();
  };
  const hideChrome = () => {
    stopHideTimer();
    setChrome(false);
    setNotesOpen(false);
    setTool(null);
  };
  /**
   * A tap on the page: the bars come and go with it, as in a video player.
   * With a mouse they stay: there they keep their own room on screen, and
   * hiding them would leave a band of nothing where the page can't grow.
   */
  const toggleChrome = () => (chromeRef.current && isTouch() ? hideChrome() : wakeChrome());

  // on a touchscreen they start tucked away, so the countdown only matters once
  // something brings them up; this covers the mount, when `chrome` starts true
  // on a screen that does auto-hide (a phone rotated into a mouse… or a resize)
  useEffect(() => {
    if (chrome) armHide();
    return stopHideTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const map = layout && layout.of === parsed ? layout.map : null;
  const pager = zoom === 1;

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

  const fit = { w: Math.max(0, area.w - inset.side * 2), h: Math.max(0, area.h - inset.top - inset.bottom) };
  /** Page width at 100%: on wide screens, height is the limiting factor. */
  const pageW = ratio ? Math.min(fit.w, fit.h * ratio) : fit.w;
  /** Carousel cell. On desktop, barely wider than the page so neighbors peek in on
   *  the sides with just one centered; on mobile the page already fills the screen. */
  // En táctil cada página ocupa una pantalla entera: así no asoman trozos de la
  // vecina por los lados y la partitura se queda con todo el sitio que hay.
  const cell = touch ? Math.max(1, area.w) : Math.max(1, Math.min(area.w, pageW + PAGE_GAP));
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
    const { top, bottom, side } = insetRef.current;
    if (z === 1) {
      return { sx: (pageRef.current - 1) * cellRef.current, sy: 0, left: (cw - w) / 2, top: top + (ch - top - bottom - h) / 2 };
    }
    const x = Math.max(0, (cw - w - side * 2) / 2) + side;
    const sx = clamp(x + a.u * w - a.fx, 0, Math.max(0, w + side * 2 - cw));
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
    // a touch doesn't summon the bars — the tap it may become does; it only
    // keeps them from tucking away mid-gesture
    nudgeChrome();
    dragged.current = false;
    touchStart.current = e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
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
      // a swipe between pages is the browser's own scroll — there's no gesture of
      // ours to look at, so the finger's travel is what tells a swipe from a tap
      const s = touchStart.current;
      const t = e.touches[0];
      if (s && t && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) dragged.current = true;
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
      if (planOpen || askXml) return;
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
  }, [onClose, view, area.w, planOpen, askXml, notesOpen]);

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

  const pickTool = (t: Tool) => setTool((cur) => (cur === t ? null : t));
  const annotationState: AnnotationState = {
    tool,
    onTool: pickTool,
    color,
    onColor: setColor,
    highlightColor,
    onHighlightColor: setHighlightColor,
    penWidth,
    onPenWidth: setPenWidth,
    linerWidth,
    onLinerWidth: setLinerWidth,
    finger,
    onFinger: setFinger,
    fingerSize,
    onFingerSize: setFingerSize,
  };
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
    if (wide) {
      showPanel("sesion");
      return;
    }
    player.stop();
    setSessionOpen(true);
  };
  /** The pomodoro is its own thing: it gets used with or without a session scheduled. */
  const openPomodoro = () => {
    if (wide) {
      showPanel("pomodoro");
      return;
    }
    setPomodoroOpen(true);
  };
  const planShown = planOpen || (wide && panelOpen && panelTab === "analisis");


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
  const backgroundJob = !planShown && planJob?.status === "running" ? planJob : undefined;
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
            // a tap on the page brings the bars up or tucks them away; a swipe
            // or a pan ends in a click too, and that one isn't a tap
            onClick={() => {
              if (!tool && !dragged.current) toggleChrome();
            }}
            // Fondo blanco, el del papel: una página no tiene la forma de una
            // pantalla, y lo que sobra a los lados se ve como una franja oscura
            // alrededor de la partitura. En blanco no se ve nada: la hoja llega
            // de borde a borde.
            // `select-none` y sin menú de iOS: apoyar la mano sobre la hoja no
            // debe seleccionarla ni sacar el «Copiar» encima de la partitura
            className={`bg-white select-none [-webkit-touch-callout:none] ${
              pager
                ? "flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none]"
                : "flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:var(--surface-3)_transparent]"
            }`}
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
                      : "w-fit mx-auto"
                  }
                  // tapping a neighbor centers it; it mustn't also count as a tap on the page
                  onClick={
                    pager && p !== page
                      ? (e) => {
                          e.stopPropagation();
                          goTo(p);
                        }
                      : undefined
                  }
                  style={
                    pager
                      ? {
                          width: cell,
                          paddingTop: inset.top,
                          paddingBottom: inset.bottom,
                          // only the centered one is fully opaque; neighbors are just hinted at
                          opacity: p === page ? 1 : 0.45,
                        }
                      : { paddingTop: inset.top, paddingBottom: inset.bottom }
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
                        highlightColor={highlightColor}
                        penWidth={penWidth}
                        linerWidth={linerWidth}
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
          <div
            ref={areaRef}
            onClick={() => toggleChrome()}
            // the room for the bars doesn't move with them: this view scrolls,
            // so reflowing it every time they come and go would lose the place
            className="flex-1 overflow-auto px-3 pt-20 pb-28 [scrollbar-width:thin] [scrollbar-color:var(--surface-3)_transparent]"
          >
            <div className="max-w-4xl mx-auto">
              {xmlError && <p className="text-sm text-bad">{xmlError}</p>}
              {parsed ? <ScoreSheet parsed={parsed} active={player.active} showNames={showNames} /> : <p className="text-sm text-ink-2">Leyendo…</p>}
            </div>
          </div>
        )}

        {/* ---- Barra de navegación ----
             Una barra de borde a borde, no una burbuja: el nombre y la página a
             la izquierda, y a la derecha lo que se hace con la pieza entera
             —análisis y escuchar—. Se retira hacia arriba con el resto de los
             mandos y vuelve al tocar la partitura. */}
        <div
          onPointerDown={() => wakeChrome()}
          aria-hidden={!chrome}
          inert={!chrome}
          className={`absolute inset-x-0 top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            chrome ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{ paddingTop: "var(--safe-t)" }}
        >
          <div className="flex h-14 items-center gap-0.5 sm:gap-1 px-2 sm:px-3">
            <button type="button" onClick={onClose} className="btn-circle w-9 h-9 sm:w-10 sm:h-10 shrink-0" aria-label="Volver">
              <ChevronIcon dir="left" className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1 px-1.5">
              <p className="font-semibold text-sm truncate leading-tight">{name}</p>
              <p className="text-[11px] text-ink-2 truncate">
                {view === "pdf" ? `Página ${page} de ${record.pageCount}` : "Partitura MusicXML vinculada"}
                {linkedXml && parsed && view === "pdf" ? " · se puede escuchar" : ""}
              </p>
            </div>

            {planJob && <JobIndicator job={planJob} onOpen={() => { setNotesOpen(false); openPlan(); }} />}

            <NavButton label="Notas y opciones de la partitura" onClick={() => setNotesOpen((v) => !v)}>
              <span className="text-base leading-none">✎</span>
            </NavButton>

            {/* La sesión y el pomodoro van por separado: el reloj se usa igual
                cuando no hay ninguna sesión puesta para hoy. */}
            <NavButton label="Sesión de estudio de hoy" onClick={openSession}>
              <SessionIcon className="w-5 h-5" />
            </NavButton>

            <NavButton label="Pomodoro: estudio y descansos" onClick={openPomodoro}>
              <TomatoIcon className="w-5 h-5" />
            </NavButton>

            <NavButton
              label={record.plan ? "Análisis y sesiones de esta partitura" : "Analizar la partitura con IA"}
              onClick={openPlan}
              tone={record.plan ? "ok" : "plain"}
            >
              <PlanIcon className="w-5 h-5" />
            </NavButton>

            <NavButton
              label={
                settings.sound ? (player.playing ? "Detener" : "Escuchar la partitura") : "El sonido está desactivado en Ajustes"
              }
              onClick={onPlay}
              disabled={!settings.sound || (!!linkedXml && !parsed)}
              tone={player.playing ? "bad" : "accent"}
            >
              {player.playing ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </NavButton>
          </div>
        </div>

        {/* ---- Pomodoro ----
             Sigue a la vista con los mandos retirados —para eso está—, así que
             va suelto sobre la esquina y solo baja para no quedar tapado por la
             barra cuando esta aparece. */}
        <div
          className="pointer-events-none absolute left-3 z-10 transition-[top] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ top: chrome ? "calc(4.25rem + var(--safe-t))" : "calc(0.75rem + var(--safe-t))" }}
        >
          <div className="pointer-events-auto">
            <PomodoroFloatingButton onOpen={() => { setNotesOpen(false); openPomodoro(); }} />
          </div>
        </div>

        {/* ---- Panel de notas y opciones ----
             Cuelga del botón ✎, contra el mismo borde derecho. */}
        {chrome && notesOpen && (
          <div
            className="absolute right-3 z-20 w-[min(22rem,calc(100%-1.5rem))] card p-3 shadow-md space-y-3"
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

        {/* ---- Zoom: mando aparte, contra el borde ----
             Solo con ratón. En táctil el zoom son dos dedos, así que un mando
             aquí sería un botón más quitándole sitio a la partitura. */}
        {view === "pdf" && !touch && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 card shadow-md p-1 flex flex-col items-center">
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

        {/* ---- Pie: avisos, opciones de la herramienta puesta y la barra ----
             En columna: lo que se abre crece hacia arriba y no reordena los
             botones. Se retira hacia abajo a la vez que la barra de navegación. */}
        <div
          onPointerDown={() => wakeChrome()}
          aria-hidden={!chrome}
          inert={!chrome}
          className={`absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 pointer-events-none transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            chrome ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
          style={{ paddingBottom: "calc(0.75rem + var(--safe-b))" }}
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

          {view === "pdf" && (
            <div className="pointer-events-auto max-w-full">
              <AnnotationOptions state={annotationState} />
            </div>
          )}

          {/* ---- Barra de herramientas ----
               Solo lo que se hace *sobre* la página: escribir en ella y las
               ayudas del MusicXML. Analizar y escuchar viven arriba, en la
               barra de navegación, y en táctil el zoom y el cambio de página
               son gestos: aquí no hay botones para ellos. */}
          <div className="pointer-events-auto card shadow-md p-1.5 flex items-center gap-1.5 min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {view === "pdf" && (
              <>
                {!touch && record.pageCount > 1 && (
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

                {/* Lápiz, subrayador, digitación… a la vista desde el principio:
                    escribir sobre la partitura es media práctica, y esconderlas
                    detrás de un botón era un toque de más cada vez. */}
                <AnnotationTools
                  state={annotationState}
                  onUndo={() => setStrokes(page, strokesOf(page).slice(0, -1))}
                  canUndo={!!strokesOf(page).length}
                />
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
        </div>

        {/* ---- Escritorio: pestaña en el borde para volver a abrir el panel plegado ---- */}
        {/* it fades in once the panel has folded, instead of popping while it's still moving */}
        {wide && chrome && (
          <button
            type="button"
            onClick={() => showPanel(panelTab)}
            title="Mostrar la sesión, el pomodoro y el análisis"
            aria-label="Mostrar la sesión, el pomodoro y el análisis"
            tabIndex={panelOpen ? -1 : 0}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5 py-3 pl-2 pr-1.5 rounded-l-2xl bg-surface border border-r-0 border-line shadow-md text-ink-2 hover:text-ink hover:bg-surface-2 transition-[opacity,transform] duration-200 ${
              panelOpen ? "opacity-0 translate-x-3 pointer-events-none" : "opacity-100 translate-x-0 delay-200"
            }`}
          >
            <ChevronIcon dir="left" className="w-4 h-4" />
            <SessionIcon className="w-5 h-5" />
            <TomatoIcon className="w-5 h-5" />
            <PlanIcon className="w-5 h-5" />
          </button>
        )}

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
              {issue && <p className="text-xs text-bad">{issue}</p>}
              <div className="flex justify-end">
                <button type="button" onClick={() => setAskXml(false)} className="pill text-xs py-1.5">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Chat con el profesor, flotando sobre la partitura ----
           En un móvil la barra de herramientas llega de lado a lado, así que el
           lanzador sube por encima de ella (0.75rem + 3.25rem de barra) y la
           ventana se abre encima del lanzador (3.5rem de alto y su holgura). */}
      {record.plan && (
        <TeacherChat
          record={record}
          state={record.plan}
          parsed={parsed}
          launcherBottom={narrow ? "5.5rem" : undefined}
          windowBottom={narrow ? "9.75rem" : undefined}
        />
      )}

      {/* ---- Escritorio: sesión, pomodoro y análisis junto a la partitura ----
           Las tres pestañas quedan montadas: el reloj sigue corriendo mientras
           se lee el análisis. */}
      {wide && (
        <aside
          aria-label="Sesión, pomodoro y análisis"
          aria-hidden={!panelOpen}
          inert={!panelOpen}
          // narrower on a tablet in landscape (1024px): at 34rem the score kept under half the screen
          className={`shrink-0 overflow-hidden bg-surface border-l transition-[width,border-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            panelOpen ? "w-[27rem] xl:w-[34rem] 2xl:w-[38rem] border-line" : "w-0 border-transparent"
          }`}
        >
        {/* full width inside, so nothing reflows while the panel moves */}
        <div className="w-[27rem] xl:w-[34rem] 2xl:w-[38rem] h-full flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
              <div role="tablist" aria-label="Sesión, pomodoro o análisis" className="flex-1 flex rounded-full bg-surface-2 p-1">
                {PANEL_TABS.map(({ id, label }) => {
                  const Icon = id === "sesion" ? SessionIcon : id === "pomodoro" ? TomatoIcon : PlanIcon;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={panelTab === id}
                      onClick={() => setPanelTab(id)}
                      className={`flex-1 h-9 rounded-full text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                        panelTab === id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
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
              <div role="tabpanel" hidden={panelTab !== "pomodoro"}>
                <PomodoroPanel />
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
          <Sheet open={pomodoroOpen} onClose={() => setPomodoroOpen(false)} title="Pomodoro" subtitle="Estudio y descansos">
            <PomodoroPanel />
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
