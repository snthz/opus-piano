import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { CommunityPreview } from "@/components/scores/community-preview";
import { pageMetadata } from "@/lib/seo";

type Params = { params: Promise<{ id: string }> };

export const metadata = pageMetadata({
  title: "Partitura compartida",
  description: "Una partitura que alguien ha compartido en Opus Piano.",
  path: "/scores/community",
  noindex: true,
});

/** La ficha la pide el navegador: la visibilidad puede cambiar en cualquier momento y esta página no se cachea. */
export default async function SharedScorePage({ params }: Params) {
  const { id } = await params;
  return (
    <div>
      <PageHeader eyebrow="Partitura compartida" title="Vista previa" back={{ href: "/scores/community", label: "Volver a las compartidas" }} />
      <ClientOnly>
        <CommunityPreview id={id} />
      </ClientOnly>
    </div>
  );
}
