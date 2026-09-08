import Link from "next/link";
import { LOGO_MARK_PATH, LOGO_MARK_VIEWBOX } from "@/lib/brand";

/**
 * Logotipo: la «O» con teclas de `@/lib/brand`. Se dibuja con `currentColor`
 * y los huecos son transparentes, así funciona sobre cualquier fondo y en
 * modo oscuro sin variantes.
 */
export function LogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox={LOGO_MARK_VIEWBOX} className={className} aria-hidden fill="currentColor">
      <path fillRule="evenodd" d={LOGO_MARK_PATH} />
    </svg>
  );
}

/** Marca completa: nombre en negrita seguido del logotipo. Enlaza a la portada. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Opus Piano, ir al inicio"
      className={`inline-flex items-center gap-1.5 md:gap-2 text-ink shrink-0 ${className}`}
    >
      <span className="font-bold tracking-tight text-[22px] md:text-2xl leading-none">Opus Piano</span>
      {/* Un pelín más grande que la altura de las mayúsculas y bajado 1 px: así el disco se ve centrado con el texto. */}
      <LogoMark className="w-6 h-6 md:w-7 md:h-7 translate-y-px" />
    </Link>
  );
}
