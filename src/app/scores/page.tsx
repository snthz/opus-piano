import { Suspense } from "react";
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
        intro="Tus PDF y MusicXML, con tus anotaciones. Los MusicXML además suenan y muestran el nombre de cada nota."
      />
      <ClientOnly>
        {/* La biblioteca lee `?score=` con useSearchParams: Next pide un Suspense alrededor. */}
        <Suspense>
          <ScoreLibrary />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
