import Link from "next/link";
import { GlyphIcon } from "@/components/notation/glyph-icon";

/** Solo en móvil: en escritorio la marca vive en el panel lateral (AppNav). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur md:hidden">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="btn-circle w-9 h-9">
            <GlyphIcon name="gClef" size={20} />
          </span>
          <span className="text-lg">Etude</span>
        </Link>
      </div>
    </header>
  );
}
