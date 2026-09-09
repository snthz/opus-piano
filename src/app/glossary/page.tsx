import { PageHeader } from "@/components/ui/page-header";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { GLOSSARY, GLOSSARY_SLUGS } from "@/data/glossary";
import { JsonLd } from "@/components/seo/json-ld";
import { definedTermSetJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Glosario de términos musicales de la A a la Z",
  description:
    "Diccionario de música en español: acorde, anacrusa, calderón, staccato, tesitura… cada término explicado en pocas líneas y con su símbolo.",
  path: "/glossary",
  keywords: ["glosario musical", "términos musicales", "diccionario de música", "vocabulario musical español"],
});

export default function GlosarioPage() {
  return (
    <div>
      {/* Las definiciones van dentro del marcado, no solo en el HTML: así una
          respuesta sobre «qué es una anacrusa» se puede construir —y citar—
          sin abrir las 120 páginas de término. */}
      <JsonLd
        data={definedTermSetJsonLd({
          name: "Glosario de términos musicales de Opus Piano",
          description: `Diccionario de música en español con ${GLOSSARY.length} términos definidos.`,
          path: "/glossary",
          terms: GLOSSARY_SLUGS.map(({ slug, entry }) => ({
            term: entry.term,
            definition: entry.definition,
            path: `/glossary/${slug}`,
          })),
        })}
      />
      <PageHeader
        eyebrow="Glosario"
        title="Términos musicales"
        intro={`${GLOSSARY.length} palabras que aparecen en las partituras y en las lecciones, explicadas en pocas líneas.`}
      />
      <GlossaryList />
    </div>
  );
}
