"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { Logo } from "@/components/ui/logo";
import { ALL_LESSONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { exercisePath, lessonPath } from "@/lib/routes";
import { isActive } from "./app-nav";
import { Chevron, Tab, tabClass } from "./nav-tab";
import { ProgressMenu } from "./progress-menu";
import { logout, useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { THEMES } from "@/lib/theme";
import { dayStreak, useProgress } from "@/lib/progress";

const TABS = [
  { href: "/", label: "Inicio" },
  { href: "/practice", label: "Práctica" },
  { href: "/scores", label: "Partituras" },
];

/** Secciones que ya no van en la fila de pestañas: viven en «Más» del menú de usuario. */
const MORE_LINKS = [
  { href: "/theory", label: "Teoría" },
  { href: "/glossary", label: "Glosario" },
  { href: "/more", label: "Todos los recursos" },
];

const AUTH_PATHS = ["/login", "/register"];

/**
 * Cabecera fija en dos filas. Arriba, la marca y la cuenta (racha, ayuda y
 * el menú de usuario o «Iniciar sesión»); debajo, en escritorio, las pestañas
 * principales con el desplegable «Explorar» que lista lecciones y ejercicios
 * y, a la derecha, «Progreso» (ProgressMenu) con el resumen y las prácticas
 * sugeridas.
 * Teoría, Glosario y Ajustes no van como pestañas: están en el menú de usuario
 * (UserMenu), junto al cambio de tema y «Cerrar sesión».
 * En móvil solo se ve la fila de arriba: la navegación está abajo (AppNav).
 * En /login y /register la fila de pestañas se oculta para no distraer.
 * Su alto vive también en `--header-h` (globals.css): al cambiarlo aquí, hay
 * que ajustarlo allí para que el lector de partituras siga cuadrando.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const authPage = AUTH_PATHS.includes(pathname);

  return (
    // data-app-header: el lector de partituras la esconde al ocultar sus
    // controles, y en móvil mientras esté abierto (globals.css).
    // z-60: por encima del lector (fixed, z-50) para que los desplegables no queden tapados.
    // safe-top: instalada como PWA la ventana empieza en el borde de la pantalla,
    // así que sin este relleno la barra de estado del teléfono tapa la fila de marca.
    <header data-app-header className="sticky top-0 z-60 bg-surface border-b border-line safe-top">
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
          // key={pathname}: al navegar se desmonta y el menú se cierra solo.
          <UserMenu key={pathname} pathname={pathname} name={user.name} email={user.email} />
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
            <ProgressMenu key={`progress-${pathname}`} />
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
        <Chevron open={open} />
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

/**
 * Menú de usuario en la esquina superior derecha. Reúne lo que no cabe en la
 * fila de pestañas: cuenta y ajustes, el cambio de tema, la sección «Más»
 * (Teoría, Glosario y el resto de recursos) y «Cerrar sesión».
 */
function UserMenu({ pathname, name, email }: { pathname: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { settings, update } = useSettings();
  const initial = name.trim()[0]?.toUpperCase();
  const accountActive = isActive(pathname, "/account") || isActive(pathname, "/settings");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${name}`}
        title={name}
        onClick={() => setOpen((v) => !v)}
        className={`grid place-items-center w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
          open || accountActive ? "bg-ink text-bg" : "bg-ash text-ink hover:opacity-80"
        }`}
      >
        {initial}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full pt-2 w-72 z-50">
          <div className="card p-2 shadow-lg">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-ink-3 truncate">{email}</p>
            </div>

            <Divider />
            <MenuItem href="/account" active={isActive(pathname, "/account")}>
              <UserIcon />
              Mi cuenta
            </MenuItem>
            <MenuItem href="/settings" active={isActive(pathname, "/settings")}>
              <GearIcon />
              Ajustes
            </MenuItem>

            <Divider />
            <div className="px-2 py-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Tema</p>
              <div role="radiogroup" aria-label="Tema" className="flex gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={settings.theme === t.value}
                    onClick={() => update({ theme: t.value })}
                    className={`pill flex-1 justify-center text-xs py-1.5 px-2 ${settings.theme === t.value ? "pill-active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Divider />
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Más</p>
            {MORE_LINKS.map((l) => (
              <MenuItem key={l.href} href={l.href} active={isActive(pathname, l.href)}>
                {l.label}
              </MenuItem>
            ))}

            <Divider />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm text-ink hover:bg-surface-2 transition-colors"
            >
              <LogoutIcon />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Divider = () => <hr className="my-1.5 border-line" />;

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" strokeLinecap="round" />
    <path d="M20 12H10M16 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
