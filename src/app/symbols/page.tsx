import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ALL_SYMBOLS, SYMBOL_CATEGORIES, type SymbolCategory } from "@/data/symbols";
import { GLYPH_BBOX } from "@/data/smufl-bbox";
import { symbolCategoryPath } from "@/lib/routes";
import { JsonLd } from "@/components/seo/json-ld";
import { itemListJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `Símbolos de la partitura: los ${ALL_SYMBOLS.length} signos y su significado`,
  description: `Diccionario visual de los símbolos musicales: claves, figuras, silencios, alteraciones, dinámicas, articulaciones, adornos, repeticiones y pedal, con su significado y cómo se tocan al piano.`,
  path: "/symbols",
  keywords: [
    "símbolos musicales",
    "signos de la partitura",
    "símbolos de música y su significado",
    "signos musicales y su significado",
    "notación musical",
    "diccionario de símbolos musicales",
  ],
});

const COLORS = ["bg-yellow", "bg-mint", "bg-ash", "bg-pink", "bg-blue", "bg-peach"];

/** El glifo más alto de la familia: el que mejor se lee ampliado y difuminado. */
function watermarkGlyph(category: SymbolCategory): string {
  const height = (glyph: string) => GLYPH_BBOX[glyph]?.[3] ?? 0;
  return category.items.reduce((best, item) => (height(item.glyph) > height(best.glyph) ? item : best)).glyph;
}

export default function SymbolsPage() {
  return (
    <div>
      <JsonLd
        data={itemListJsonLd({
          name: "Familias de símbolos de la partitura",
          description: `Los ${ALL_SYMBOLS.length} signos musicales más habituales, agrupados en ${SYMBOL_CATEGORIES.length} familias.`,
          path: "/symbols",
          items: SYMBOL_CATEGORIES.map((c) => ({
            name: c.title,
            description: c.intro,
            path: symbolCategoryPath(c.id),
          })),
        })}
      />
      <Breadcrumbs items={[{ name: "Símbolos", path: "/symbols" }]} />
      <PageHeader
        eyebrow="Diccionario visual"
        title="Símbolos de la partitura"
        intro={`Toda partitura se escribe con un puñado de signos que se repiten una y otra vez. Aquí están los ${ALL_SYMBOLS.length} más habituales, agrupados en ${SYMBOL_CATEGORIES.length} familias, dibujados con las fuentes originales del estándar SMuFL y explicados en una línea: qué son, cómo se llaman también y qué hay que hacer al tocarlos.`}
      />

      <ul className="grid sm:grid-cols-2 gap-3">
        {SYMBOL_CATEGORIES.map((category, i) => (
          <li key={category.id}>
            <Link
              href={symbolCategoryPath(category.id)}
              className={`card-pastel ${COLORS[i % COLORS.length]} p-5 h-full flex flex-col gap-2 relative overflow-hidden group`}
            >
              <GlyphIcon
                name={watermarkGlyph(category)}
                size={120}
                className="absolute -right-4 -top-4 opacity-[0.10] pointer-events-none"
              />
              <h2 className="text-lg font-semibold tracking-tight pr-16">{category.title}</h2>
              <p className="text-sm text-ink-2 leading-relaxed">{category.intro}</p>
              <p className="text-xs text-ink-3 mt-auto pt-2">
                {category.items.length} símbolos ·{" "}
                {category.items.slice(0, 3).map((s) => s.name).join(", ")}
                {category.items.length > 3 && "…"}
              </p>
              <span className="btn-circle absolute right-3 bottom-3 w-9 h-9 group-hover:-translate-y-0.5">
                <ArrowIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10 card p-5 md:p-6">
        <h2 className="text-xl font-semibold tracking-tight">¿Buscas un símbolo concreto?</h2>
        <p className="mt-2 text-ink-2 leading-relaxed">
          El catálogo completo tiene buscador: escribe «staccato», «bemol» o «coda» y aparece el
          signo con su explicación. Y cuando quieras comprobar si te los sabes, las flashcards te
          los van mostrando al azar.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/theory/symbols" className="pill pill-active text-sm">
            Buscar en el catálogo
          </Link>
          <Link href="/practice/symbols" className="pill text-sm">
            Practicar con flashcards
          </Link>
        </div>
      </section>
    </div>
  );
}
