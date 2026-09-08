import Link from "next/link";

/** Pestaña de la fila de navegación: texto plano; la activa va en negrita con una línea gruesa debajo. */
export const tabClass = (active: boolean) =>
  `relative inline-flex items-center h-12 px-3.5 text-[15px] transition-colors ${
    active ? "text-ink font-semibold" : "text-ink-2 font-medium hover:text-ink"
  }`;

export const Underline = () => <span aria-hidden className="absolute inset-x-1 bottom-0 h-[3px] rounded-t-full bg-ink" />;

export function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      {children}
      {active && <Underline />}
    </Link>
  );
}

export const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
