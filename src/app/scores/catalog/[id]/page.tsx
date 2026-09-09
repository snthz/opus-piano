import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { CatalogPreview } from "@/components/scores/catalog-preview";
import { CATALOG, catalogCover, pieceById } from "@/data/catalog";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { musicCompositionJsonLd, pageMetadata } from "@/lib/seo";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return CATALOG.map((piece) => ({ id: piece.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const piece = pieceById(id);
  if (!piece) return {};
  return pageMetadata({
    title: `${piece.title} (${piece.composer}): partitura gratis y cómo estudiarla`,
    description: `${piece.about} Partitura original de dominio público: léela entera, escúchala y guárdala en tu biblioteca de Opus Piano. Con un análisis breve de cómo abordarla.`,
    path: `/scores/catalog/${piece.id}`,
    keywords: [`${piece.title} partitura`, `${piece.title} piano`, `${piece.composer} partitura gratis`, "partitura dominio público"],
    type: "article",
  });
}

export default async function CatalogPiecePage({ params }: Params) {
  const { id } = await params;
  const piece = pieceById(id);
  if (!piece) notFound();
  return (
    <div>
      {/* La obra por un lado (Beethoven, 1824, dominio público) y nuestro
          análisis por otro: es lo segundo lo que da motivo para citar esta
          página en lugar de cualquier otra que tenga la misma partitura. */}
      <JsonLd
        data={musicCompositionJsonLd({
          title: piece.title,
          composer: piece.composer,
          year: piece.year,
          path: `/scores/catalog/${piece.id}`,
          about: piece.about,
          skills: piece.skills,
          level: piece.level,
          analysis: piece.analysis,
          source: piece.source.origin,
          image: catalogCover(piece.id),
        })}
      />
      <Breadcrumbs
        items={[
          { name: "Partituras", path: "/scores/catalog" },
          { name: piece.title, path: `/scores/catalog/${piece.id}` },
        ]}
      />
      <PageHeader
        eyebrow={piece.composer}
        title={piece.title}
        intro={`${piece.year}. La partitura original entera: léela, escúchala y mira cómo abordarla antes de guardarla.`}
        back={{ href: "/scores/catalog", label: "Volver al catálogo" }}
      />
      <ClientOnly>
        <CatalogPreview piece={piece} />
      </ClientOnly>
    </div>
  );
}
