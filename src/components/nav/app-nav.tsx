"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlyphIcon } from "@/components/notation/glyph-icon";

type Item = { href: string; label: string; icon: React.ReactNode };

const items: Item[] = [
  {
    href: "/",
    label: "Inicio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v10h13V10" strokeLinejoin="round" />
        <path d="M10 20v-6h4v6" />
      </svg>
    ),
  },
  {
    href: "/teoria",
    label: "Teoría",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" strokeLinejoin="round" />
        <path d="M4 20.5V5.5M8 7h8M8 10.5h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/practica",
    label: "Práctica",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/partituras",
    label: "Partituras",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
        <path d="M14 3v4h4M9 12h6M9 15.5h6M9 9h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/glosario",
    label: "Glosario",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z" strokeLinejoin="round" />
        <path d="M9 7.5h6M9 11h6M9 14.5h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/mas",
    label: "Más",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v4l2.5 1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const settingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      strokeLinejoin="round"
    />
  </svg>
);

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Móvil: píldora flotante abajo. Escritorio: panel lateral con nombres. */
export function AppNav() {
  return (
    <>
      <MobileNav />
      <SideNav />
    </>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none safe-bottom px-3">
      <ul className="pointer-events-auto mx-auto max-w-md card flex items-center justify-between px-1.5 py-1.5">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-colors ${
                  active ? "bg-ink text-bg" : "text-ink-3 active:bg-surface-2"
                }`}
              >
                <span className="w-5 h-5">{it.icon}</span>
                <span className="text-[10px] font-medium leading-none">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideNav() {
  const pathname = usePathname();
  const settingsActive = isActive(pathname, "/ajustes");
  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:flex fixed left-4 top-4 bottom-4 z-40 w-64 card flex-col p-4"
    >
      <Link href="/" className="flex items-center gap-3 px-2 py-2 font-semibold tracking-tight">
        <span className="btn-circle w-10 h-10">
          <GlyphIcon name="gClef" size={22} />
        </span>
        <span className="text-xl">Etude</span>
      </Link>

      {/* El menú va pegado a la marca; el espacio sobrante queda abajo, antes de Ajustes. */}
      <p className="px-4 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Aprender</p>
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-full text-[15px] font-medium transition-colors ${
                  active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="w-5 h-5 shrink-0">{it.icon}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex-1" />
      <Link
        href="/ajustes"
        aria-current={settingsActive ? "page" : undefined}
        className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors ${
          settingsActive ? "bg-ink text-bg" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
        }`}
      >
        <span className="w-5 h-5 shrink-0">{settingsIcon}</span>
        Ajustes
      </Link>
    </nav>
  );
}
