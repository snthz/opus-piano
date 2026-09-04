import Link from "next/link";
import { lessonBySlug, lessonNeighbors, ALL_LESSONS } from "@/data/lessons";
import { Glyph } from "@/components/notation/glyph";
import { ChevronIcon } from "@/components/ui/arrow-icon";

export function LessonLayout({ slug, children }: { slug: string; children: React.ReactNode }) {
  const lesson = lessonBySlug(slug);
  const { prev, next } = lessonNeighbors(slug);
  if (!lesson) return <div>{children}</div>;
  const number = ALL_LESSONS.findIndex((l) => l.slug === slug) + 1;
  return (
    <article className="prose-music">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/teoria"
            aria-label="Volver a Teoría"
            className="card w-11 h-11 flex items-center justify-center hover:bg-surface-2"
          >
            <ChevronIcon dir="left" />
          </Link>
          <span className="pill">
            <Glyph name={lesson.glyph} size={16} />
            Lección {number}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{lesson.title}</h1>
        <p className="mt-3 text-ink-2 leading-relaxed">{lesson.summary}</p>
      </header>

      <div className="space-y-10">{children}</div>

      <nav className="mt-12 grid grid-cols-2 gap-3" aria-label="Lecciones anterior y siguiente">
        {prev ? (
          <Link href={`/teoria/${prev.slug}`} className="card p-4 hover:bg-surface-2">
            <span className="block text-xs text-ink-3">Anterior</span>
            <span className="font-medium">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/teoria/${next.slug}`} className="card-pastel bg-mint p-4 text-right">
            <span className="block text-xs text-ink-2">Siguiente</span>
            <span className="font-medium">{next.title}</span>
          </Link>
        ) : (
          <Link href="/practica" className="card-pastel bg-mint p-4 text-right">
            <span className="block text-xs text-ink-2">Continuar</span>
            <span className="font-medium">Ir a la práctica</span>
          </Link>
        )}
      </nav>
    </article>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-ink leading-relaxed">{children}</p>;
}

export function Figure({ caption, children }: { caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="card p-3 md:p-5 overflow-x-auto">
      {children}
      {caption && <figcaption className="mt-3 text-sm text-ink-2">{caption}</figcaption>}
    </figure>
  );
}
