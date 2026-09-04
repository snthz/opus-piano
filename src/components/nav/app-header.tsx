import Link from "next/link";
import { DesktopNav } from "./app-nav";
import { Glyph } from "@/components/notation/glyph";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="btn-circle w-9 h-9">
            <Glyph name="gClef" size={20} />
          </span>
          <span className="text-lg">Etude</span>
        </Link>
        <DesktopNav />
      </div>
    </header>
  );
}
