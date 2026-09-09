import { PageHeader } from "@/components/ui/page-header";
import { ScoreCatalog } from "@/components/scores/score-catalog";
import { CATALOG } from "@/data/catalog";
import { JsonLd } from "@/components/seo/json-ld";
import { itemListJsonLd, pageMetadata } from "@/lib/seo";

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
      <JsonLd
        data={itemListJsonLd({
          name: "Partituras de dominio público para piano",
          description: `${CATALOG.length} obras en MusicXML, de la más fácil a la más difícil, con análisis de cómo estudiarlas.`,
          path: "/scores/catalog",
          items: CATALOG.map((piece) => ({
            name: `${piece.title} — ${piece.composer}`,
            description: piece.about,
            path: `/scores/catalog/${piece.id}`,
          })),
        })}
      />
      <PageHeader
        eyebrow="Partituras"
        title="Piezas libres para empezar"
        intro={`${CATALOG.length} obras de dominio público, de la más fácil a la más difícil. Ábrelas para leer la partitura original entera y escucharla; se guardan en tu biblioteca con un toque.`}
        back={{ href: "/scores", label: "Volver a la biblioteca" }}
      />
      <ScoreCatalog />
    </div>
  );
}
