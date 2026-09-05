"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ALL_LESSONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { isActive } from "./app-nav";

const LEARN_PREFIXES = ["/teoria", "/practica", "/glosario"];

/**
 * Cabecera fija. En escritorio lleva la navegación con un desplegable «Aprender»
 * que agrupa teoría, práctica y glosario, para que la barra no se llene de opciones.
 * En móvil solo muestra la marca: la navegación está abajo (AppNav).
 */
export function AppHeader() {
  const pathname = usePathname();
  const learnActive = LEARN_PREFIXES.some((p) => isActive(pathname, p));

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight shrink-0">
          <span className="btn-circle w-9 h-9">
            <GlyphIcon name="gClef" size={20} />
          </span>
          <span className="text-lg">Opus Piano</span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1 flex-1">
          <TopLink href="/" active={pathname === "/"}>Inicio</TopLink>
          {/* key={pathname}: al navegar se desmonta y el desplegable se cierra solo. */}
          <LearnMenu key={pathname} active={learnActive} pathname={pathname} />
          <TopLink href="/partituras" active={isActive(pathname, "/partituras")}>Partituras</TopLink>
          <TopLink href="/mas" active={isActive(pathname, "/mas")}>Más</TopLink>
        </nav>

        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className={`hidden md:grid place-items-center w-10 h-10 rounded-full transition-colors ${
            isActive(pathname, "/ajustes") ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </header>
  );
}

/** Texto plano, sin fondo ni sombra; el activo se marca con una línea corta debajo. */
const topLinkClass = (active: boolean) =>
  `relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
    active ? "text-ink" : "text-ink-2 hover:text-ink"
  }`;

const Indicator = () => <span aria-hidden className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-accent" />;

function TopLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={topLinkClass(active)}>
      {children}
      {active && <Indicator />}
    </Link>
  );
}

function LearnMenu({ active, pathname }: { active: boolean; pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${topLinkClass(active)} gap-1.5`}
      >
        Aprender
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {active && <Indicator />}
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full pt-2 w-[620px]">
          <div className="card p-5 grid grid-cols-[1.1fr_1fr] gap-6 shadow-lg">
            <section>
              <MenuHeading href="/teoria" active={isActive(pathname, "/teoria")}>Teoría</MenuHeading>
              <ul className="mt-2 space-y-0.5">
                {ALL_LESSONS.map((l, i) => (
                  <li key={l.slug}>
                    <MenuItem href={`/teoria/${l.slug}`} active={pathname === `/teoria/${l.slug}/` || pathname === `/teoria/${l.slug}`}>
                      <span className="w-5 text-ink-3 tabular-nums text-xs">{i + 1}.</span>
                      <span className="flex-1 truncate">{l.title}</span>
                      <span className="text-xs text-ink-3">{l.minutes} min</span>
                    </MenuItem>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-5">
              <div>
                <MenuHeading href="/practica" active={isActive(pathname, "/practica")}>Práctica</MenuHeading>
                <ul className="mt-2 space-y-0.5">
                  {EXERCISES.map((e) => (
                    <li key={e.id}>
                      <MenuItem href={e.href} active={isActive(pathname, e.href)}>
                        <span className="w-5 grid place-items-center text-ink-2">
                          <GlyphIcon name={e.glyph} size={14} />
                        </span>
                        <span className="flex-1 truncate">{e.title}</span>
                      </MenuItem>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <MenuHeading href="/glosario" active={isActive(pathname, "/glosario")}>Glosario</MenuHeading>
                <p className="mt-1 text-xs text-ink-2 px-2">Términos musicales de la A a la Z.</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuHeading({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`inline-flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider rounded-full ${
        active ? "text-accent" : "text-ink-3 hover:text-ink"
      }`}
    >
      {children} →
    </Link>
  );
}

function MenuItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm transition-colors ${
        active ? "bg-ink text-bg" : "text-ink hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
