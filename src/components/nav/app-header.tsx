"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { Logo } from "@/components/ui/logo";
import { ALL_LESSONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { exercisePath, lessonPath } from "@/lib/routes";
import { isActive } from "./app-nav";
import { useAuth } from "@/lib/auth";
import { dayStreak, useProgress } from "@/lib/progress";

const TABS = [
  { href: "/", label: "Inicio" },
  { href: "/theory", label: "Teoría" },
  { href: "/practice", label: "Práctica" },
  { href: "/scores", label: "Partituras" },
  { href: "/glossary", label: "Glosario" },
  { href: "/settings", label: "Ajustes" },
];

const AUTH_PATHS = ["/login", "/register"];

/**
 * Cabecera fija en dos filas. Arriba, la marca y la cuenta (racha, ayuda y
 * avatar o «Iniciar sesión»); debajo, en escritorio, las pestañas de las
 * secciones con el desplegable «Explorar» que lista lecciones y ejercicios.
 * En móvil solo se ve la fila de arriba: la navegación está abajo (AppNav).
 * En /login y /register la fila de pestañas se oculta para no distraer.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const authPage = AUTH_PATHS.includes(pathname);

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 md:h-[72px] flex items-center gap-2 md:gap-3">
        <Logo />
        <div className="flex-1" />

        {user && <StreakPill />}

        <IconLink href="/faq" label="Ayuda y preguntas frecuentes" active={isActive(pathname, "/faq")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" strokeLinecap="round" />
            <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </IconLink>

        {user ? (
          <Link
            href="/account"
            aria-label={`Cuenta de ${user.name}`}
            title={user.name}
            className={`grid place-items-center w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
              isActive(pathname, "/account") ? "bg-ink text-bg" : "bg-lavender text-ink hover:opacity-80"
            }`}
          >
            {user.name.trim()[0]?.toUpperCase()}
          </Link>
        ) : (
          <Link href="/login" className="btn-outline h-10 px-3.5 md:h-11 md:px-4 text-sm md:text-[15px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
              <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
              <path d="M4 12h10M10 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Iniciar sesión
          </Link>
        )}
      </div>

      {!authPage && (
        <div className="hidden md:block border-t border-line">
          <nav aria-label="Navegación principal" className="max-w-5xl mx-auto px-8 h-12 flex items-center">
            {/* key={pathname}: al navegar se desmonta y el desplegable se cierra solo. */}
            <ExploreMenu key={pathname} pathname={pathname} />
            <span aria-hidden className="w-px h-6 bg-line mx-3" />
            {TABS.map((t) => (
              <Tab key={t.href} href={t.href} active={isActive(pathname, t.href)}>
                {t.label}
              </Tab>
            ))}
            <span className="flex-1" />
            <Tab href="/more" active={isActive(pathname, "/more")}>
              Más
            </Tab>
          </nav>
        </div>
      )}
    </header>
  );
}

/** Racha de días seguidos con práctica, al estilo del saldo de la cabecera de Preply. */
function StreakPill() {
  const streak = dayStreak(useProgress());
  return (
    <Link
      href="/account"
      title="Días seguidos practicando"
      className="hidden md:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border-2 border-ink text-sm font-bold hover:bg-surface-2 transition-colors"
    >
      Racha: {streak}
    </Link>
  );
}

function IconLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`hidden md:grid place-items-center w-10 h-10 rounded-xl transition-colors ${
        active ? "bg-ink text-bg" : "text-ink hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

/** Pestaña: texto plano; la activa va en negrita con una línea gruesa de acento debajo. */
const tabClass = (active: boolean) =>
  `relative inline-flex items-center h-12 px-3.5 text-[15px] transition-colors ${
    active ? "text-ink font-semibold" : "text-ink-2 font-medium hover:text-ink"
  }`;

const Underline = () => <span aria-hidden className="absolute inset-x-1 bottom-0 h-[3px] rounded-t-full bg-ink" />;

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      {children}
      {active && <Underline />}
    </Link>
  );
}

function ExploreMenu({ pathname }: { pathname: string }) {
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
        className={`${tabClass(false)} gap-2 pl-0 text-ink`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5z" strokeLinejoin="round" />
          <path d="M4 20.5V6.5M8 8.5h8M8 12h6" strokeLinecap="round" />
        </svg>
        Explorar lecciones
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full pt-1 w-[620px]">
          <div className="card p-5 grid grid-cols-[1.1fr_1fr] gap-6 shadow-lg">
            <section>
              <MenuHeading href="/theory" active={isActive(pathname, "/theory")}>Teoría</MenuHeading>
              <ul className="mt-2 space-y-0.5">
                {ALL_LESSONS.map((l, i) => (
                  <li key={l.slug}>
                    <MenuItem href={lessonPath(l.slug)} active={pathname === lessonPath(l.slug)}>
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
                <MenuHeading href="/practice" active={isActive(pathname, "/practice")}>Práctica</MenuHeading>
                <ul className="mt-2 space-y-0.5">
                  {EXERCISES.map((e) => (
                    <li key={e.id}>
                      <MenuItem href={exercisePath(e.id)} active={isActive(pathname, exercisePath(e.id))}>
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
                <MenuHeading href="/guide" active={isActive(pathname, "/guide")}>Guía</MenuHeading>
                <p className="mt-1 text-xs text-ink-2 px-2">Cómo leer partituras, del pentagrama a los símbolos.</p>
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
        active ? "text-ink" : "text-ink-3 hover:text-ink"
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
