import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SymbolCard } from "@/components/notation/symbol-catalog";
import { SYMBOL_CATEGORIES } from "@/data/symbols";
import { SYMBOL_CATEGORY_SLUGS, symbolCategoryPath } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ category: string }> };

const categoryBySlug = (slug: string) =>
  SYMBOL_CATEGORIES.find((c) => (SYMBOL_CATEGORY_SLUGS[c.id] ?? c.id) === slug);

export function generateStaticParams() {
  return SYMBOL_CATEGORIES.map((c) => ({ category: SYMBOL_CATEGORY_SLUGS[c.id] ?? c.id }));
}

export const dynamicParams = false;

/** Corta a la longitud que Google muestra (~160) sin partir una palabra. */
function clamp(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};

  const names = category.items.map((s) => s.name);
  return pageMetadata({
    title: `${category.title} en la partitura: símbolos y significado`,
    description: clamp(`${category.intro} ${names.join(", ")}.`),
    path: symbolCategoryPath(category.id),
    type: "article",
    keywords: [
      `${category.title.toLowerCase()} musicales`,
      `símbolos de ${category.title.toLowerCase()}`,
      ...names.slice(0, 8).map((n) => `${n.toLowerCase()} música`),
    ],
  });
}

export default async function SymbolCategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const others = SYMBOL_CATEGORIES.filter((c) => c.id !== category.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Símbolos", path: "/symbols" },
          { name: category.title, path: symbolCategoryPath(category.id) },
        ]}
      />
      <PageHeader
        eyebrow="Símbolos de la partitura"
        title={category.title}
        intro={category.intro}
        back={{ href: "/symbols", label: "Volver a los símbolos" }}
      />

      <ul className="grid gap-3">
        {category.items.map((symbol) => (
          <li key={symbol.id}>
            <SymbolCard s={symbol} />
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight mb-3">Otras familias de símbolos</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.id}>
              <Link href={symbolCategoryPath(other.id)} className="pill text-sm hover:bg-surface-2">
                {other.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/practice/symbols" className="pill pill-active text-sm">
          Practicar estos símbolos
        </Link>
        <Link href="/theory/symbols" className="pill text-sm">
          Ver la lección de símbolos
        </Link>
      </div>
    </div>
  );
}
