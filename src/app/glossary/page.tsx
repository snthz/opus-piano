import { PageHeader } from "@/components/ui/page-header";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { GLOSSARY } from "@/data/glossary";

export const metadata = { title: "Glosario" };

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
