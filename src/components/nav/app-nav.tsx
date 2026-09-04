"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Riel vertical flotante, centrado en el borde izquierdo.
 * No es una barra lateral clásica de altura completa: es una cápsula estrecha
 * que solo mide lo que ocupan sus iconos. El nombre aparece como etiqueta
 * superpuesta, nunca ensanchando el riel, para que no tape el contenido.
 */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40">
      <ul className="card flex flex-col gap-1 p-2">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href} className="relative group">
              <Link
                href={it.href}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                className={`grid place-items-center w-11 h-11 rounded-full transition-colors ${
                  active ? "bg-ink text-bg" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="w-5 h-5">{it.icon}</span>
              </Link>
              {/* Etiqueta flotante: se superpone al contenido, no desplaza nada. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-full
                  bg-ink text-bg text-xs font-medium whitespace-nowrap opacity-0 transition-opacity
                  group-hover:opacity-100 group-focus-within:opacity-100 hidden md:block"
              >
                {it.label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
