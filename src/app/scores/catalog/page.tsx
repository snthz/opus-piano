import { PageHeader } from "@/components/ui/page-header";
import { ScoreCatalog } from "@/components/scores/score-catalog";
import { CATALOG } from "@/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partituras gratis de dominio público para piano",
  description:
    "Piezas famosas de dominio público para practicar en Opus Piano: Para Elisa, el Preludio BWV 846, Gymnopédie, Clair de lune, The Entertainer y más, en MusicXML, ordenadas por dificultad y listas para sonar, leerse nota a nota y analizarse.",
  path: "/scores/catalog",
  keywords: [
    "partituras gratis piano",
    "partituras dominio público",
    "partituras fáciles para principiantes",
    "partituras sin derechos de autor",
  ],
});

export default function CatalogPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Partituras"
        title="Piezas libres para empezar"
        intro={`${CATALOG.length} obras de dominio público en MusicXML, de la más fácil a la más difícil. Ábrelas para escucharlas y verlas nota a nota; se guardan en tu biblioteca con un toque.`}
        back={{ href: "/scores", label: "Volver a la biblioteca" }}
      />
      <ScoreCatalog />
    </div>
  );
}
