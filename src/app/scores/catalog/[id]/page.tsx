import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { CatalogPreview } from "@/components/scores/catalog-preview";
import { CATALOG, pieceById } from "@/data/catalog";
import { pageMetadata } from "@/lib/seo";

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
    description: `${piece.about} Partitura de dominio público en MusicXML: escúchala, mírala nota a nota y guárdala en tu biblioteca de Opus Piano. Con un análisis breve de cómo abordarla.`,
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
      <PageHeader
        eyebrow={piece.composer}
        title={piece.title}
        intro={`${piece.year}. Vista previa completa: escúchala, mira el nombre de cada nota y lee cómo abordarla antes de guardarla.`}
        back={{ href: "/scores/catalog", label: "Volver al catálogo" }}
      />
      <ClientOnly>
        <CatalogPreview piece={piece} />
      </ClientOnly>
    </div>
  );
}
