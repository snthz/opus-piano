import Link from "next/link";

/**
 * Logotipo: una «O» (de Opus) con tres teclas negras recortadas, como un piano
 * visto de frente. Se dibuja con `currentColor` y los huecos son transparentes,
 * así funciona sobre cualquier fondo y en modo oscuro sin variantes.
 */
export function LogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16 2a14 14 0 1 1 0 28 14 14 0 1 1 0-28ZM10 6.5A1.5 1.5 0 0 0 8.5 8v8a1.5 1.5 0 0 0 3 0V8A1.5 1.5 0 0 0 10 6.5Zm6 0A1.5 1.5 0 0 0 14.5 8v8a1.5 1.5 0 0 0 3 0V8A1.5 1.5 0 0 0 16 6.5Zm6 0A1.5 1.5 0 0 0 20.5 8v8a1.5 1.5 0 0 0 3 0V8A1.5 1.5 0 0 0 22 6.5Z"
      />
    </svg>
  );
}

/** Marca completa: nombre en negrita seguido del logotipo. Enlaza a la portada. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Opus Piano, ir al inicio" className={`inline-flex items-center gap-1.5 text-ink shrink-0 ${className}`}>
      <span className="font-bold tracking-tight text-[22px] md:text-2xl leading-none">Opus Piano</span>
      <LogoMark className="w-6 h-6 md:w-7 md:h-7" />
    </Link>
  );
}
