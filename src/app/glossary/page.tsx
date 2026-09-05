import { PageHeader } from "@/components/ui/page-header";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { GLOSSARY } from "@/data/glossary";
import { pageMetadata } from "@/lib/seo";

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
      <PageHeader
        eyebrow="Glosario"
        title="Términos musicales"
        intro={`${GLOSSARY.length} palabras que aparecen en las partituras y en las lecciones, explicadas en pocas líneas.`}
      />
      <GlossaryList />
    </div>
  );
}
