import Link from "next/link";
import { DesktopNav } from "./app-nav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="smufl text-2xl text-accent leading-none" aria-hidden="true">
            {""}
          </span>
          <span>Piano Learn</span>
        </Link>
        <DesktopNav />
      </div>
    </header>
  );
}
