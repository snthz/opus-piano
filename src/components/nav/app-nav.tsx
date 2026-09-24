"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";

/** tint: icon color inside the active section's black pill. */
type Item = { href: string; label: string; icon: React.ReactNode; tint?: string };

const HomeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 10v10h13V10" strokeLinejoin="round" />
    <path d="M10 20v-6h4v6" />
  </svg>
);

const PracticeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);

const ScoresIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
    <path d="M14 3v4h4M9 12h6M9 15.5h6M9 9h2" strokeLinecap="round" />
  </svg>
);

const MetronomeIcon = (
  // Pirámide del metrónomo mecánico, con su varilla y su peso.
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M9 3h6l3.5 18h-13z" strokeLinejoin="round" />
    <path d="M12 6.5v11" strokeLinecap="round" />
    <path d="M9.6 12.5h4.8" strokeLinecap="round" />
  </svg>
);

const CalendarIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    <circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const RoutesIcon = (
  // Hitos unidos por un camino: piezas en orden, una detrás de otra.
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" strokeLinecap="round" />
  </svg>
);

/**
 * Las secciones del día a día, las mismas que las pestañas de escritorio
 * (AppHeader). Todo lo demás vive en la hoja de «Más»: con ocho iconos en fila
 * la barra se leía como una lista, no como una navegación. El metrónomo se
 * fue a «Más» para dejar sitio a las rutas: se abre desde la sesión y desde
 * el lector, que es donde hace falta.
 * Cada sección lleva su pastel: es el único color de la barra, y solo aparece
 * en el icono de la que está abierta, así que la fila sigue leyéndose en tinta.
 */
const PRIMARY: Item[] = [
  { href: "/", label: "Inicio", icon: HomeIcon, tint: "text-yellow" },
  { href: "/scores", label: "Partituras", icon: ScoresIcon, tint: "text-blue" },
  { href: "/routes", label: "Rutas", icon: RoutesIcon, tint: "text-mint" },
  { href: "/practice", label: "Práctica", icon: PracticeIcon, tint: "text-peach" },
  { href: "/calendar", label: "Sesiones", icon: CalendarIcon, tint: "text-pink" },
];

/** El resto de la app, agrupado por para qué sirve, dentro de la hoja de «Más». */
const MORE_GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Herramientas",
    items: [{ href: "/metronome", label: "Metrónomo", icon: MetronomeIcon }],
  },
  {
    title: "Aprender",
    items: [
      {
        href: "/path",
        label: "Ruta del curso",
        icon: (
          // Una bandera al final de un camino: la ruta lleva a algún sitio.
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M7 21V3" strokeLinecap="round" />
            <path d="M7 4h10l-2.5 3.5L17 11H7z" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/theory",
        label: "Teoría",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" strokeLinejoin="round" />
            <path d="M4 20.5V5.5M8 7h8M8 10.5h8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/guide",
        label: "Guía",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2z" strokeLinejoin="round" />
            <path d="M12 6.5v13" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/symbols",
        label: "Símbolos",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            <circle cx="8.5" cy="9.5" r="2" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="14.5" r="2" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
      {
        href: "/teacher",
        label: "Profesor",
        icon: (
          // Un bocadillo con una corchea: se pregunta, y se pregunta de música.
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M20 5.5v9a2 2 0 0 1-2 2H9l-4 3.5v-3.5a2 2 0 0 1-1-1.7v-9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 1.7z" strokeLinejoin="round" />
            <path d="M11 13V7l3-.7v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/glossary",
        label: "Glosario",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z" strokeLinejoin="round" />
            <path d="M9 7.5h6M9 11h6M9 14.5h3" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/faq",
        label: "Preguntas",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" strokeLinecap="round" />
            <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Tu cuenta",
    items: [
      {
        href: "/account",
        label: "Cuenta",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/settings",
        label: "Ajustes",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="12" cy="12" r="3" />
            {/* La misma rueda dentada de la cabecera: con radios sueltos el
                icono se lee como un sol, no como unos ajustes. */}
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
];

const MORE_HREFS = MORE_GROUPS.flatMap((g) => g.items.map((i) => i.href));

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Short spring: the pill arrives, overshoots a touch and settles. */
const SPRING = "cubic-bezier(0.34, 1.32, 0.5, 1)";

/** Active icon hops; the rest sink when pressed. */
const iconClass = (active: boolean, tint?: string) =>
  active
    ? `w-6 h-6 shrink-0 ${tint ?? ""} animate-[nav-pop_0.38s_cubic-bezier(0.34,1.32,0.5,1)]`
    : "w-6 h-6 shrink-0 transition-transform duration-150 group-active:scale-90";

/**
 * Barra inferior flotante, en móvil y tableta (hasta `lg`). En escritorio la
 * navegación está en AppHeader. `safe-bottom` la levanta por encima del gesto
 * del sistema para que la franja inferior del teléfono no se coma la fila de iconos.
 * Las secciones del día a día y un botón «Más» que abre una hoja con el resto:
 * así cada destino tiene sitio para respirar y el pulgar no falla el objetivo.
 * La pestaña activa se ensancha y muestra su nombre; las demás quedan en icono.
 * Su fondo negro es una única píldora absoluta que se mide y se desliza: al
 * cambiar de sección el negro viaja por la barra en vez de saltar.
 */
export function AppNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_HREFS.some((href) => isActive(pathname, href));

  // Al cambiar de ruta, cerrar la hoja: el <dialog> sobrevive a la navegación.
  // Se ajusta en el render (no en un efecto) para no encadenar un repintado.
  const [shownAt, setShownAt] = useState(pathname);
  if (shownAt !== pathname) {
    setShownAt(pathname);
    setMoreOpen(false);
  }

  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  // animate is false on the first measure: on load the pill is already in place.
  const [pill, setPill] = useState<{ x: number; w: number; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    const item = activeRef.current;
    const list = listRef.current;
    if (!item || !list) return;
    const measure = () => {
      const a = item.getBoundingClientRect();
      const b = list.getBoundingClientRect();
      // Hidden bar (reader open) measures 0; storing that would make the pill
      // stretch from the edge when it comes back.
      if (!a.width) return;
      setPill((prev) => {
        // clientLeft: `left` on the absolute pill counts from the padding box.
        const x = a.left - b.left - list.clientLeft;
        if (prev && prev.x === x && prev.w === a.width) return prev;
        return { x, w: a.width, animate: prev !== null };
      });
    };
    measure();
    // Remeasure on rotation (the bar stretches) and when the label changes width.
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(item);
    return () => ro.disconnect();
  }, [pathname, moreActive]);

  // Until the first measure (and in the server HTML) the active tab paints its
  // own background, or its light text would be invisible over the glass.
  const ownBg = pill === null;

  return (
    <>
      {/* data-app-nav: el lector de partituras la esconde mientras está abierto. */}
      <nav data-app-nav aria-label="Navegación principal" className="fixed bottom-0 inset-x-0 z-40 lg:hidden pointer-events-none safe-bottom px-3">
        {/* gap-0.5: con seis huecos (cinco secciones y «Más») en un teléfono
            estrecho, cualquier separación mayor se come el ancho de la píldora
            activa y su nombre se parte. */}
        <ul ref={listRef} className="pointer-events-auto relative mx-auto max-w-md nav-glass rounded-[1.75rem] flex items-center gap-0.5 p-1.5">
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 rounded-[1.375rem] bg-ink will-change-transform"
            style={{
              width: pill?.w ?? 0,
              opacity: pill ? 1 : 0,
              transform: `translate3d(${pill?.x ?? 0}px, 0, 0)`,
              // Short: while travelling the pill covers the icons it passes.
              transition: pill?.animate ? `transform 0.36s ${SPRING}, width 0.36s ${SPRING}` : undefined,
            }}
          />

          {PRIMARY.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href} ref={active ? activeRef : undefined} className={active ? "shrink-0" : "flex-1 min-w-0"}>
                <Link
                  href={it.href}
                  aria-label={it.label}
                  aria-current={active ? "page" : undefined}
                  // relative: paint the links above the positioned pill.
                  className={`group relative flex items-center justify-center gap-1.5 h-12 rounded-[1.375rem] transition-colors duration-200 ${
                    active ? `text-bg px-3.5 ${ownBg ? "bg-ink" : ""}` : "text-ink-2 active:bg-surface-2"
                  }`}
                >
                  {/* key: remounting the span replays the hop. */}
                  <span key={active ? "on" : "off"} className={iconClass(active, it.tint)}>
                    {it.icon}
                  </span>
                  {active && <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap animate-[nav-label_0.4s_ease-out]">{it.label}</span>}
                </Link>
              </li>
            );
          })}

          <li ref={moreActive ? activeRef : undefined} className={moreActive ? "shrink-0" : "flex-1 min-w-0"}>
            <button
              type="button"
              aria-label="Más secciones"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={moreActive ? "page" : undefined}
              onClick={() => setMoreOpen(true)}
              className={`group relative w-full flex items-center justify-center gap-1.5 h-12 rounded-[1.375rem] transition-colors duration-200 ${
                moreActive ? `text-bg px-3.5 ${ownBg ? "bg-ink" : ""}` : "text-ink-2 active:bg-surface-2"
              }`}
            >
              <span key={moreActive ? "on" : "off"} className={iconClass(moreActive, "text-ash")}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5.5" cy="12" r="1.85" />
                  <circle cx="12" cy="12" r="1.85" />
                  <circle cx="18.5" cy="12" r="1.85" />
                </svg>
              </span>
              {moreActive && <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap animate-[nav-label_0.4s_ease-out]">Más</span>}
            </button>
          </li>
        </ul>
      </nav>

      {/* Fuera del <nav>: `pointer-events-none` se hereda, y dentro la hoja no
          recibiría ni toques ni clics aunque el navegador la suba a la capa
          superior. */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Más" subtitle="El resto de Opus Piano">
        {MORE_GROUPS.map((group) => (
          <section key={group.title} className="mb-4 last:mb-0">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{group.title}</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {group.items.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                      // Teclado: la tecla en reposo es clara con su línea de
                      // canto y lleva su «tecla negra» —el círculo del icono—;
                      // la sección en la que ya estás es la tecla pulsada, en
                      // negro entero. Sin color: el contraste es el del piano.
                      className={`rounded-card border p-3 flex items-center gap-3 transition-transform active:scale-[0.98] ${
                        active ? "bg-ink text-bg border-ink" : "bg-surface-2 border-line"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-10 h-10 rounded-full grid place-items-center ${
                          active ? "bg-bg text-ink" : "bg-ink text-bg"
                        }`}
                      >
                        <span className="w-5 h-5">{it.icon}</span>
                      </span>
                      <span className="text-sm font-semibold truncate">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <Link href="/more" onClick={() => setMoreOpen(false)} className="btn-secondary w-full mt-1">
          Todos los recursos
        </Link>
      </Sheet>
    </>
  );
}
