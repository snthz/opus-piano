import Link from "next/link";
import { LOGO_MARK_PATH, LOGO_MARK_VIEWBOX } from "@/lib/brand";

/**
 * Logo mark: the "O" with keys from `@/lib/brand`. Drawn with `currentColor`
 * and transparent gaps, so it works on any background and in dark mode
 * without variants.
 */
export function LogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox={LOGO_MARK_VIEWBOX} className={className} aria-hidden fill="currentColor">
      <path fillRule="evenodd" d={LOGO_MARK_PATH} />
    </svg>
  );
}

/** Full wordmark: bold name followed by the logo mark. Links to home. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Opus Piano, ir al inicio"
      className={`inline-flex items-center gap-1.5 md:gap-2 text-ink shrink-0 ${className}`}
    >
      <span className="font-bold tracking-tight text-[22px] md:text-2xl leading-none">Opus Piano</span>
      {/* slightly taller than cap height and nudged down 1px so the disc looks centered with the text */}
      <LogoMark className="w-6 h-6 md:w-7 md:h-7 translate-y-px" />
    </Link>
  );
}
