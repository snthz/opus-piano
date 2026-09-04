import Link from "next/link";
import { ChevronIcon } from "./arrow-icon";

export function PageHeader({
  eyebrow,
  title,
  intro,
  back,
  action,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {(back || action) && (
        <div className="flex items-center justify-between mb-4">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="card w-11 h-11 flex items-center justify-center text-ink hover:bg-surface-2"
            >
              <ChevronIcon dir="left" />
            </Link>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {eyebrow && <p className="text-sm text-ink-2">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight leading-tight">{title}</h1>
      {intro && <p className="mt-3 text-ink-2 leading-relaxed">{intro}</p>}
    </header>
  );
}
