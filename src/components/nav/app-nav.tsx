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

/** Barra inferior flotante, solo en móvil. En escritorio la navegación está en AppHeader. */
export function AppNav() {
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
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center py-2.5 rounded-2xl transition-colors ${
                  active ? "bg-ink text-bg" : "text-ink-3 active:bg-surface-2"
                }`}
              >
                <span className="w-6 h-6">{it.icon}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
