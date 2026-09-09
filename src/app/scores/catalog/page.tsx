import { PageHeader } from "@/components/ui/page-header";
import { ScoreCatalog } from "@/components/scores/score-catalog";
import { CATALOG } from "@/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partituras gratis de dominio público para piano",
  description:
    "Piezas famosas libres de derechos para practicar en Opus Piano: Oda a la alegría, Campanita del lugar, Cumpleaños feliz y Jingle Bells, ordenadas por dificultad y listas para sonar, leerse nota a nota y analizarse.",
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
        intro={`${CATALOG.length} obras de dominio público, ordenadas de la más fácil a la más difícil. Se añaden a tu biblioteca con un toque y, como vienen en MusicXML, suenan, te muestran el nombre de cada nota y puedes pedirles un análisis.`}
        back={{ href: "/scores", label: "Volver a la biblioteca" }}
      />
      <ScoreCatalog />
    </div>
  );
}
