"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";

type Item = { href: string; label: string; icon: React.ReactNode };

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

/**
 * Las secciones del día a día, las mismas que las pestañas de escritorio
 * (AppHeader). Todo lo demás vive en la hoja de «Más»: con ocho iconos en fila
 * la barra se leía como una lista, no como una navegación.
 */
const PRIMARY: Item[] = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/practice", label: "Práctica", icon: PracticeIcon },
  { href: "/metronome", label: "Metrónomo", icon: MetronomeIcon },
  { href: "/scores", label: "Partituras", icon: ScoresIcon },
  { href: "/calendar", label: "Agenda", icon: CalendarIcon },
];

/** El resto de la app, agrupado por para qué sirve, dentro de la hoja de «Más». */
const MORE_GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Aprender",
    items: [
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

/**
 * Barra inferior flotante, solo en móvil. En escritorio la navegación está en
 * AppHeader. `safe-bottom` la levanta por encima del gesto del sistema para que
 * la franja inferior del teléfono no se coma la fila de iconos.
 * Las secciones del día a día y un botón «Más» que abre una hoja con el resto:
 * así cada destino tiene sitio para respirar y el pulgar no falla el objetivo.
 * La pestaña activa se ensancha y muestra su nombre; las demás quedan en icono.
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

  return (
    <>
      {/* data-app-nav: el lector de partituras la esconde mientras está abierto. */}
      <nav data-app-nav aria-label="Navegación principal" className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none safe-bottom px-3">
        {/* gap-0.5: con seis huecos (cinco secciones y «Más») en un teléfono
            estrecho, cualquier separación mayor se come el ancho de la píldora
            activa y su nombre se parte. */}
        <ul className="pointer-events-auto mx-auto max-w-md card flex items-center gap-0.5 px-1.5 py-1.5">
          {PRIMARY.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href} className={active ? "shrink-0" : "flex-1 min-w-0"}>
                <Link
                  href={it.href}
                  aria-label={it.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-center gap-1.5 h-11 rounded-2xl transition-colors ${
                    active ? "bg-ink text-bg px-3" : "text-ink-3 active:bg-surface-2"
                  }`}
                >
                  <span className="w-6 h-6 shrink-0">{it.icon}</span>
                  {active && <span className="text-[13px] font-semibold whitespace-nowrap">{it.label}</span>}
                </Link>
              </li>
            );
          })}

          <li className={moreActive ? "shrink-0" : "flex-1 min-w-0"}>
            <button
              type="button"
              aria-label="Más secciones"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={moreActive ? "page" : undefined}
              onClick={() => setMoreOpen(true)}
              className={`w-full flex items-center justify-center gap-1.5 h-11 rounded-2xl transition-colors ${
                moreActive ? "bg-ink text-bg px-3" : "text-ink-3 active:bg-surface-2"
              }`}
            >
              <span className="w-6 h-6 shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5.5" cy="12" r="1.85" />
                  <circle cx="12" cy="12" r="1.85" />
                  <circle cx="18.5" cy="12" r="1.85" />
                </svg>
              </span>
              {moreActive && <span className="text-[13px] font-semibold whitespace-nowrap">Más</span>}
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
