"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { engraveScore, type EngravedScore as Engraved } from "@/lib/music/engrave";
import { ChevronIcon } from "@/components/ui/arrow-icon";

/**
 * La partitura tal y como está escrita, página a página, como si fuera el
 * papel: título, ligaduras, matices, digitaciones y pedal incluidos. Es lo
 * que se ve de un PDF en la biblioteca, pero salido del MusicXML: lo graba
 * Verovio en el propio navegador.
 *
 * Y suena siguiéndose: el mismo grabado trae el instante en que ataca cada
 * nota, en negras, que es lo que cuenta el reloj de la reproducción. Así la
 * nota que suena se enciende sobre la partitura de verdad, y la hoja pasa
 * sola cuando la música llega a la siguiente.
 */
export function EngravedScore({
  xml,
  position,
  playing = false,
  fallback = null,
  overlay,
  onMeasure,
  onPage,
  className = "",
}: {
  xml: string;
  /** Negras transcurridas desde el principio, o null si no suena. */
  position?: () => number | null;
  playing?: boolean;
  /** Qué enseñar si el archivo no se puede grabar; el dibujo de la app, normalmente. */
  fallback?: ReactNode;
  /** Lo que va encima de la hoja: el lienzo de anotaciones, en píxeles de pantalla. */
  overlay?: (page: number, size: { width: number; height: number }) => ReactNode;
  /** Por qué compás va la reproducción; null cuando no suena. */
  onMeasure?: (measure: number | null) => void;
  /** Qué página se está viendo, contando desde 1 (pasa sola al sonar). */
  onPage?: (page: number) => void;
  className?: string;
}) {
  const [score, setScore] = useState<Engraved | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [index, setIndex] = useState(-1);
  const sheet = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Los avisos van por referencia: así una función nueva en cada render del
  // padre no reinicia el seguimiento ni dispara efectos en cadena.
  const report = useRef({ onMeasure, onPage });
  useEffect(() => {
    report.current = { onMeasure, onPage };
  });

  useEffect(() => {
    let cancelled = false;
    engraveScore(xml).then(
      (engraved) => !cancelled && setScore(engraved),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [xml]);

  // Qué nota suena ahora. Se sigue el reloj de audio en cada frame (con
  // `setTimeout` se desincroniza en cuanto el hilo principal se atasca), pero
  // solo se avisa a React cuando de verdad cambia la nota.
  useEffect(() => {
    if (!playing || !score?.events.length || !position) return;
    let frame = 0;
    let last = -1;
    const tick = () => {
      const at = position();
      if (at !== null) {
        // último evento que ya ha empezado (los eventos están ordenados)
        let lo = 0;
        let hi = score.events.length - 1;
        let found = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (score.events[mid].at <= at) {
            found = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (found !== last) {
          last = found;
          setIndex(found);
          report.current.onMeasure?.(found >= 0 ? score.events[found].measure : null);
          // la hoja pasa sola cuando la música llega a la siguiente
          const first = found >= 0 ? score.events[found].sounding.at(-1) : undefined;
          const turn = first === undefined ? undefined : score.pageOf.get(first);
          if (turn !== undefined) setPage(turn);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, score, position]);

  // El lienzo de anotaciones se dibuja en píxeles, así que se mide la hoja
  // y se vuelve a medir cuando cambia de tamaño (girar el móvil, cambiar de página).
  useEffect(() => {
    const box = sheet.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) report.current.onMeasure?.(null);
  }, [playing]);

  // Al parar, la partitura se queda quieta y sin nada encendido.
  const active = playing ? index : -1;
  const shown = score ? Math.min(page, score.pages.length - 1) : 0;

  useEffect(() => {
    if (score) report.current.onPage?.(shown + 1);
  }, [score, shown]);

  // La página se monta como SVG, no como HTML: el MusicXML puede venir de
  // otra persona (una partitura compartida), y aunque Verovio escapa lo que
  // escribe, lo que se cuelga del documento se revisa antes.
  useEffect(() => {
    const box = sheet.current;
    if (!box || !score) return;
    const svg = parseSvg(score.pages[shown]);
    if (svg) box.replaceChildren(svg);
    return () => box.replaceChildren();
  }, [score, shown]);

  useEffect(() => {
    const box = sheet.current;
    if (!box) return;
    for (const el of box.querySelectorAll("[data-playing]")) el.removeAttribute("data-playing");
    for (const el of box.querySelectorAll("[data-band]")) el.remove();
    if (active < 0 || !score) return;
    for (const id of score.events[active]?.sounding ?? []) {
      const note = box.querySelector(`[id="${CSS.escape(id)}"]`);
      if (!note) continue;
      note.setAttribute("data-playing", "");
      band(note as SVGGraphicsElement);
    }
  }, [active, shown, score]);

  if (failed) return <>{fallback}</>;



  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div className="relative">
          <div ref={sheet} hidden={!score} className="engraved [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" />
          {score && overlay?.(shown + 1, size)}
        </div>
        {!score && <div className="grid aspect-[3/4] place-items-center text-sm text-ink-2">Preparando la partitura…</div>}
      </div>

      {score && score.pages.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, shown - 1))}
            disabled={shown === 0}
            className="btn-circle h-9 w-9 disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronIcon dir="left" />
          </button>
          <span className="min-w-16 text-center text-xs text-ink-2">
            {shown + 1} / {score.pages.length}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(score.pages.length - 1, shown + 1))}
            disabled={shown >= score.pages.length - 1}
            className="btn-circle h-9 w-9 disabled:opacity-30"
            aria-label="Página siguiente"
          >
            <ChevronIcon dir="right" />
          </button>
        </div>
      )}
    </div>
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** Margen de la banda, en unidades de Verovio (la página mide unos 2250 de ancho). */
const BAND_PAD = 45;
/** La tinta del papel: la misma que dibuja la partitura. */
const BAND_INK = "#111114";

/**
 * Banda detrás de la nota que suena.
 *
 * El color de acento del tema es casi negro, así que teñir la nota no se
 * vería: lo que se ve es la banda, igual que en el dibujo de la app. Va
 * dentro del propio grupo de la nota, que es lo que hace que las coordenadas
 * de `getBBox` valgan tal cual y que el dibujo quede por encima.
 */
function band(note: SVGGraphicsElement): void {
  let box: DOMRect;
  try {
    box = note.getBBox();
  } catch {
    return; // aún sin dibujar
  }
  if (!box.width || !box.height) return;
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("data-band", "");
  // El color va en el propio elemento y no en la hoja de estilos: un `rect`
  // sin `fill` es negro sólido, y con eso una hoja que no llegue tapa la
  // nota en vez de señalarla. El papel es blanco en los dos temas, así que
  // la tinta de la banda tampoco cambia.
  rect.setAttribute("fill", BAND_INK);
  rect.setAttribute("opacity", "0.16");
  rect.setAttribute("x", String(box.x - BAND_PAD));
  rect.setAttribute("y", String(box.y - BAND_PAD));
  rect.setAttribute("width", String(box.width + BAND_PAD * 2));
  rect.setAttribute("height", String(box.height + BAND_PAD * 2));
  rect.setAttribute("rx", "40");
  note.insertBefore(rect, note.firstChild);
}

/**
 * El SVG de una página, listo para colgar del documento: se analiza como SVG
 * (que no ejecuta nada) y se le quitan las pocas cosas que en un dibujo no
 * pintan nada y sí podrían hacer daño.
 */
function parseSvg(source: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName !== "svg" || doc.querySelector("parsererror")) return null;
  scrub(root);
  return document.importNode(root, true) as unknown as SVGElement;
}

function scrub(el: Element): void {
  for (const child of [...el.children]) {
    const name = child.nodeName.toLowerCase();
    if (name === "script" || name === "foreignobject" || name === "a") child.remove();
    else scrub(child);
  }
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    // los `use` de Verovio apuntan siempre a un glifo de la propia página («#…»)
    const external = (name === "href" || name.endsWith(":href")) && !attr.value.startsWith("#");
    if (name.startsWith("on") || external) el.removeAttributeNode(attr);
  }
}
