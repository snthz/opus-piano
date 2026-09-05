import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { ScoreLibrary } from "@/components/scores/score-library";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mis partituras",
  description:
    "Tu biblioteca de partituras en PDF y MusicXML, en todos tus dispositivos con tu cuenta.",
  path: "/scores",
  noindex: true,
});

export default function PartiturasPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca"
        title="Mis partituras"
        intro="Tus PDF y MusicXML. Dibuja encima, y con MusicXML escucha la pieza y ve el nombre de cada nota. Con una cuenta, la biblioteca te sigue a todos tus dispositivos."
      />
      <ClientOnly>
        <ScoreLibrary />
      </ClientOnly>
    </div>
  );
}
