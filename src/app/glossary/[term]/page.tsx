import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import {
  GLOSSARY_SLUGS,
  glossaryBySlug,
  glossaryNeighbors,
  glossarySlug,
  relatedGlossary,
} from "@/data/glossary";
import { normalizePath } from "@/lib/routes";
import { definedTermJsonLd, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ term: string }> };

/**
 * Una página por término del glosario.
 *
 * El glosario completo es una sola URL: no puede posicionar para «qué es una
 * anacrusa» y a la vez para «qué significa staccato». Estas fichas son las
 * búsquedas de cola larga que traen a la mayoría de los visitantes nuevos.
 */
export function generateStaticParams() {
  return GLOSSARY_SLUGS.map(({ slug }) => ({ term: slug }));
}

/** Nada fuera de la lista: cualquier otro slug es un 404, no una página vacía. */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term } = await params;
  const entry = glossaryBySlug(term);
  if (!entry) return {};

  return pageMetadata({
    title: `${entry.term}: qué es y qué significa en música`,
    description: `${entry.definition} Definición con ejemplos, símbolo y lección relacionada.`.slice(0, 300),
    path: `/glossary/${term}`,
    type: "article",
    keywords: [
      `qué es ${entry.term.toLowerCase()}`,
      `${entry.term.toLowerCase()} música`,
      `${entry.term.toLowerCase()} partitura`,
      "glosario musical",
      "términos de música en español",
    ],
  });
}

export default async function GlossaryTermPage({ params }: Props) {
  const { term } = await params;
  const entry = glossaryBySlug(term);
  if (!entry) notFound();

  const { prev, next } = glossaryNeighbors(term);
  const related = relatedGlossary(entry);
  const lessonHref = entry.href ? normalizePath(entry.href) : undefined;

  return (
    <div>
      <JsonLd data={definedTermJsonLd(entry.term, entry.definition, `/glossary/${term}`)} />
      <Breadcrumbs
        items={[
          { name: "Glosario", path: "/glossary" },
          { name: entry.term, path: `/glossary/${term}` },
        ]}
      />

      <PageHeader eyebrow="Glosario" title={entry.term} />

      <div className="card p-5 md:p-6 flex gap-5 items-start">
        {entry.glyph && (
          <span className="shrink-0 w-16 h-16 rounded-2xl bg-surface-2 grid place-items-center text-ink">
            <GlyphIcon name={entry.glyph} size={30} label={entry.term} />
          </span>
        )}
        <p className="text-lg leading-relaxed">{entry.definition}</p>
      </div>

      {lessonHref && (
        <Link
          href={lessonHref}
          className="card-pastel bg-mint p-4 mt-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-2">Dónde se explica</span>
            <span className="block font-medium">Ver la lección completa</span>
          </span>
          <ArrowIcon className="w-5 h-5" />
        </Link>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight mb-3">Términos relacionados</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {related.map((item) => (
              <li key={item.term}>
                <Link
                  href={`/glossary/${glossarySlug(item.term)}`}
                  className="card p-3 flex items-start gap-3 h-full hover:bg-surface-2 transition-colors"
                >
                  {item.glyph && (
                    <span className="shrink-0 w-7 text-center text-ink-2 pt-0.5">
                      <GlyphIcon name={item.glyph} size={22} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">{item.term}</span>
                    <span className="block text-xs text-ink-2 mt-0.5 line-clamp-2">{item.definition}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="mt-10 grid grid-cols-2 gap-3" aria-label="Término anterior y siguiente">
        {prev ? (
          <Link href={`/glossary/${glossarySlug(prev.term)}`} className="card p-4 hover:bg-surface-2">
            <span className="block text-xs text-ink-3">Anterior</span>
            <span className="font-medium">{prev.term}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/glossary/${glossarySlug(next.term)}`} className="card p-4 text-right hover:bg-surface-2">
            <span className="block text-xs text-ink-3">Siguiente</span>
            <span className="font-medium">{next.term}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p className="mt-8 text-sm text-ink-2">
        <Link href="/glossary" className="text-accent hover:underline">
          ← Volver al glosario completo
        </Link>
      </p>
    </div>
  );
}
