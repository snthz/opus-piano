import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { CommunityList } from "@/components/scores/community-list";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partituras compartidas",
  description: "Partituras que otras personas han puesto en público en Opus Piano: míralas, escúchalas y guárdate las que quieras.",
  path: "/scores/community",
  noindex: true,
});

export default function CommunityPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Partituras"
        title="Compartidas por otros"
        intro="Lo que otras personas han decidido poner en público desde su biblioteca. Ábrelas para verlas enteras y, si te interesan, guárdate una copia. Para compartir las tuyas: menú ⋯ de la partitura y «Compartir»."
        back={{ href: "/scores", label: "Volver a la biblioteca" }}
      />
      <ClientOnly>
        <CommunityList />
      </ClientOnly>
    </div>
  );
}
